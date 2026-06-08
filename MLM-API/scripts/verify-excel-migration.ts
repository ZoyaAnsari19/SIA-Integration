import XLSX from 'xlsx';
import { prisma } from '../src/config/prisma.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExcelRow {
  [key: string]: any;
}

interface PackageInfo {
  name: string;
  price: number;
  [key: string]: any;
}

interface UserPurchase {
  user_id?: string;
  user_name?: string;
  user_email?: string;
  package_name: string;
  package_price?: number;
  purchase_date?: string;
  [key: string]: any;
}

async function verifyExcelMigration() {
  try {
    // Read Excel file
    const excelPath = path.join(__dirname, '../../products-export-2.xlsx');
    console.log('📖 Reading Excel file:', excelPath);
    
    if (!fs.existsSync(excelPath)) {
      console.error('❌ Excel file not found:', excelPath);
      return;
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetNames = workbook.SheetNames;
    console.log('📋 Found sheets:', sheetNames);

    // Get all sheets data
    const allData: ExcelRow[] = [];
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet);
      console.log(`📄 Sheet "${sheetName}": ${sheetData.length} rows`);
      
      // Log first row to understand structure
      if (sheetData.length > 0) {
        console.log(`   First row columns:`, Object.keys(sheetData[0]));
        console.log(`   First row sample:`, JSON.stringify(sheetData[0], null, 2).substring(0, 200));
      }
      
      allData.push(...sheetData);
    }

    // Extract unique packages from Excel
    const excelPackages = new Map<string, PackageInfo>();
    const excelUsers = new Map<string, UserPurchase[]>();
    
    // Analyze data structure - Excel has columns like "Pack. 1 self + global", "Pack. 2 self + global", etc.
    // These contain package IDs or names
    for (const row of allData) {
      const rowKeys = Object.keys(row);
      
      // Extract user information
      const userId = row['ID'] ? String(row['ID']) : undefined;
      const memberId = row['Member ID'] ? String(row['Member ID']) : undefined;
      const userName = row['Name'] ? String(row['Name']) : undefined;
      const userEmail = row['Email'] ? String(row['Email']) : undefined;
      const userPhone = row['Phone'] ? String(row['Phone']) : undefined;
      
      // Extract packages from Pack. 1-8 columns
      const packageColumns = rowKeys.filter(key => key.startsWith('Pack.') || key.includes('Pack'));
      
      for (const pkgCol of packageColumns) {
        const pkgValue = row[pkgCol];
        if (pkgValue !== null && pkgValue !== undefined && pkgValue !== '') {
          const pkgIdOrName = String(pkgValue).trim();
          
          // Store package
          if (!excelPackages.has(pkgIdOrName)) {
            excelPackages.set(pkgIdOrName, {
              name: pkgIdOrName,
              price: 0, // Price not in Excel, will need to fetch from DB
            });
          }
          
          // Store user purchase
          const userKey = userId || memberId || userEmail || userName || 'unknown';
          if (!excelUsers.has(userKey)) {
            excelUsers.set(userKey, []);
          }
          
          excelUsers.get(userKey)!.push({
            user_id: userId,
            user_name: userName,
            user_email: userEmail,
            package_name: pkgIdOrName,
            package_price: undefined,
            purchase_date: undefined,
            column: pkgCol,
            member_id: memberId,
            phone: userPhone,
          });
        }
      }
    }

    console.log('\n📦 Packages found in Excel:', excelPackages.size);
    excelPackages.forEach((pkg, name) => {
      console.log(`  - ${name}: ₹${pkg.price}`);
    });

    console.log('\n👥 Users found in Excel:', excelUsers.size);

    // Fetch existing packages from database
    console.log('\n🔍 Fetching existing packages from database...');
    const existingPackages = await prisma.packages.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        status: true,
      },
    });

    // Create maps for both package ID, name, and price lookup
    const existingPackageMapByName = new Map(
      existingPackages.map(pkg => [pkg.name.toLowerCase().trim(), pkg])
    );
    const existingPackageMapById = new Map(
      existingPackages.map(pkg => [pkg.id.toString(), pkg])
    );
    // Map by price (rounded to nearest rupee for matching)
    const existingPackageMapByPrice = new Map(
      existingPackages.map(pkg => [Math.round(Number(pkg.price)).toString(), pkg])
    );

    // Compare packages - check both by ID and by name
    console.log('\n📊 Package Comparison:');
    const missingPackages: PackageInfo[] = [];
    const existingPackagesList: Array<{ excel: PackageInfo; db: any; matchedBy: 'id' | 'name' }> = [];
    const priceMismatches: Array<{ excel: PackageInfo; db: any; excelPrice: number; dbPrice: number }> = [];

    excelPackages.forEach((excelPkg, excelName) => {
      // Try to match by ID first (if excelName is a number)
      const isNumeric = !isNaN(Number(excelName)) && excelName.trim() !== '';
      let dbPackage: any = null;
      let matchedBy: 'id' | 'name' | 'price' | null = null;
      
      if (isNumeric) {
        // Try matching by package ID
        dbPackage = existingPackageMapById.get(excelName.trim());
        if (dbPackage) {
          matchedBy = 'id';
        }
        
        // If not found by ID, try matching by price (if excelName looks like a price)
        if (!dbPackage && Number(excelName) >= 100) {
          const roundedPrice = Math.round(Number(excelName)).toString();
          dbPackage = existingPackageMapByPrice.get(roundedPrice);
          if (dbPackage) {
            matchedBy = 'price';
          }
        }
      }
      
      // If not found by ID or price, try by name
      if (!dbPackage) {
        const normalizedName = excelName.toLowerCase().trim().replace(/^["']|["']$/g, ''); // Remove quotes
        dbPackage = existingPackageMapByName.get(normalizedName);
        if (dbPackage) {
          matchedBy = 'name';
        }
      }
      
      if (!dbPackage) {
        missingPackages.push(excelPkg);
        const matchType = isNumeric ? 'ID/Price' : 'Name';
        console.log(`  ❌ MISSING: "${excelName}" (${matchType})`);
      } else {
        existingPackagesList.push({ excel: excelPkg, db: dbPackage, matchedBy: matchedBy! });
        const dbPrice = Number(dbPackage.price);
        const excelPrice = excelPkg.price || (isNumeric ? Number(excelName) : 0);
        const priceDiff = Math.abs(dbPrice - excelPrice);
        const priceMatch = priceDiff < 0.01 || (matchedBy === 'price' && priceDiff < 1); // Allow 1 rupee difference for price matching
        
        if (!priceMatch && excelPrice > 0) {
          priceMismatches.push({
            excel: excelPkg,
            db: dbPackage,
            excelPrice: excelPrice,
            dbPrice: dbPrice,
          });
          console.log(`  ⚠️  EXISTS (Price Diff): "${excelName}" - Excel: ₹${excelPrice}, DB: ₹${dbPrice} (Diff: ₹${priceDiff.toFixed(2)}) - Matched by ${matchedBy}`);
        } else {
          console.log(`  ✅ EXISTS: "${excelName}" (DB ID: ${dbPackage.id}, DB Name: "${dbPackage.name}", ₹${dbPrice}) - Matched by ${matchedBy}`);
        }
      }
    });

    // Analyze user purchases
    console.log('\n🛒 User Purchase Analysis:');
    const purchaseSummary = new Map<string, {
      package_name: string;
      user_count: number;
      users: Array<{ user_id?: string; user_name?: string; user_email?: string }>;
    }>();

    excelUsers.forEach((purchases, userKey) => {
      purchases.forEach(purchase => {
        const pkgName = purchase.package_name;
        if (!pkgName) return;

        if (!purchaseSummary.has(pkgName)) {
          purchaseSummary.set(pkgName, {
            package_name: pkgName,
            user_count: 0,
            users: [],
          });
        }

        const summary = purchaseSummary.get(pkgName)!;
        summary.user_count++;
        summary.users.push({
          user_id: purchase.user_id,
          user_name: purchase.user_name,
          user_email: purchase.user_email,
        });
      });
    });

    purchaseSummary.forEach((summary, pkgName) => {
      console.log(`\n  📦 "${pkgName}":`);
      console.log(`     Purchased by ${summary.user_count} user(s)`);
      summary.users.slice(0, 10).forEach(user => {
        const userDisplay = user.user_name || user.user_email || user.user_id || 'Unknown';
        console.log(`     - ${userDisplay}`);
      });
      if (summary.users.length > 10) {
        console.log(`     ... and ${summary.users.length - 10} more`);
      }
    });

    // Check existing users in database
    console.log('\n👤 Checking existing users in database...');
    const allUserKeys = Array.from(excelUsers.keys());
    const userEmails = allUserKeys.filter(key => key.includes('@'));
    const userIds = allUserKeys.filter(key => !key.includes('@') && !isNaN(Number(key)));
    
    let existingUsersCount = 0;
    let newUsersCount = 0;
    
    if (userEmails.length > 0) {
      const dbUsersByEmail = await prisma.users.findMany({
        where: {
          email: { in: userEmails },
        },
        select: { id: true, email: true, name: true },
      });
      existingUsersCount += dbUsersByEmail.length;
    }
    
    if (userIds.length > 0) {
      const numericIds = userIds.map(id => BigInt(id)).filter(id => id > 0n);
      if (numericIds.length > 0) {
        const dbUsersById = await prisma.users.findMany({
          where: {
            id: { in: numericIds },
          },
          select: { id: true, email: true, name: true },
        });
        existingUsersCount += dbUsersById.length;
      }
    }
    
    newUsersCount = excelUsers.size - existingUsersCount;
    console.log(`  ✅ Existing users: ${existingUsersCount}`);
    console.log(`  🆕 New users to migrate: ${newUsersCount}`);

    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      excel_file: 'products-export-2.xlsx',
      summary: {
        total_packages_in_excel: excelPackages.size,
        total_users_in_excel: excelUsers.size,
        existing_users: existingUsersCount,
        new_users: newUsersCount,
        missing_packages: missingPackages.length,
        existing_packages: existingPackagesList.length,
        price_mismatches: priceMismatches.length,
      },
      missing_packages: missingPackages.map(pkg => ({
        name: pkg.name,
        price: pkg.price,
      })),
      price_mismatches: priceMismatches.map(({ excel, db, excelPrice, dbPrice }) => ({
        package_name: excel.name,
        excel_price: excelPrice,
        db_id: db.id,
        db_name: db.name,
        db_price: dbPrice,
        difference: Math.abs(excelPrice - dbPrice),
      })),
      existing_packages: existingPackagesList.map(({ excel, db }) => ({
        excel_name: excel.name,
        excel_price: excel.price,
        db_id: db.id,
        db_name: db.name,
        db_price: Number(db.price),
        db_status: db.status,
      })),
      purchase_summary: Array.from(purchaseSummary.entries()).map(([pkgName, summary]) => ({
        package_name: pkgName,
        user_count: summary.user_count,
        users: summary.users,
      })),
    };

    // Save report to JSON file
    const reportPath = path.join(__dirname, '../../excel-migration-verification.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Verification complete! Report saved to: ${reportPath}`);

    // Generate CSV for easy viewing
    const csvRows: string[] = [];
    csvRows.push('Package Name,Status,Excel Price,DB ID,DB Price,DB Status,Price Match,User Count');
    
    excelPackages.forEach((excelPkg, excelName) => {
      // Find matching package using same logic as above
      const isNumeric = !isNaN(Number(excelName)) && excelName.trim() !== '';
      let dbPackage: any = null;
      
      if (isNumeric) {
        dbPackage = existingPackageMapById.get(excelName.trim());
        if (!dbPackage && Number(excelName) >= 100) {
          const roundedPrice = Math.round(Number(excelName)).toString();
          dbPackage = existingPackageMapByPrice.get(roundedPrice);
        }
      }
      
      if (!dbPackage) {
        const normalizedName = excelName.toLowerCase().trim().replace(/^["']|["']$/g, '');
        dbPackage = existingPackageMapByName.get(normalizedName);
      }
      
      const purchaseInfo = purchaseSummary.get(excelName);
      const excelPrice = excelPkg.price || (isNumeric ? Number(excelName) : 0);
      const priceMatch = dbPackage ? Math.abs(Number(dbPackage.price) - excelPrice) < 0.01 : false;
      
      csvRows.push([
        `"${excelName}"`,
        dbPackage ? 'EXISTS' : 'MISSING',
        excelPrice.toString(),
        dbPackage?.id.toString() || 'N/A',
        dbPackage ? Number(dbPackage.price).toString() : 'N/A',
        dbPackage?.status || 'N/A',
        priceMatch ? 'YES' : 'NO',
        purchaseInfo?.user_count.toString() || '0',
      ].join(','));
    });

    const csvPath = path.join(__dirname, '../../excel-migration-verification.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved to: ${csvPath}`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Packages in Excel: ${excelPackages.size}`);
    console.log(`  ✅ Existing in DB: ${existingPackagesList.length}`);
    console.log(`  ❌ Missing from DB: ${missingPackages.length}`);
    console.log(`  ⚠️  Price Mismatches: ${priceMismatches.length}`);
    console.log(`\nTotal Users in Excel: ${excelUsers.size}`);
    console.log(`  ✅ Existing: ${existingUsersCount}`);
    console.log(`  🆕 New to Migrate: ${newUsersCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error verifying Excel file:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyExcelMigration()
  .then(() => {
    console.log('\n✅ Verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

