import 'dotenv/config';
import XLSX from 'xlsx';
import { prisma } from '../src/config/prisma.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExcelRow {
  [key: string]: any;
}

interface NewUserDetails {
  user_id?: string;
  member_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  packages: Array<{
    package_name: string;
    package_price?: number;
    column: string;
  }>;
  referrer_id?: string;
  referrer_name?: string;
  referrer_email?: string;
}

async function getNewUsersDetails() {
  try {
    // Read Excel file
    const excelPath = path.join(__dirname, '../../products-export-2.xlsx');
    console.log('📖 Reading Excel file:', excelPath);
    
    if (!fs.existsSync(excelPath)) {
      console.error('❌ Excel file not found:', excelPath);
      return;
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📄 Found ${excelData.length} rows in Excel`);

    // Get all existing users from database
    console.log('\n🔍 Fetching existing users from database...');
    const existingUsers = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        display_id: true,
        name: true,
      },
    });

    const existingUserMap = new Map<string, boolean>();
    existingUsers.forEach(user => {
      if (user.email) existingUserMap.set(user.email.toLowerCase().trim(), true);
      if (user.display_id) existingUserMap.set(user.display_id.toLowerCase().trim(), true);
      if (user.id) existingUserMap.set(user.id.toString(), true);
    });

    // Extract new users from Excel
    const newUsers: NewUserDetails[] = [];
    
    for (const row of excelData) {
      const userId = row['ID'] ? String(row['ID']) : undefined;
      const memberId = row['Member ID'] ? String(row['Member ID']) : undefined;
      const userName = row['Name'] ? String(row['Name']) : undefined;
      const userEmail = row['Email'] ? String(row['Email']) : undefined;
      const userPhone = row['Phone'] ? String(row['Phone']) : undefined;

      // Check if user exists in database
      let userExists = false;
      if (userEmail) {
        userExists = existingUserMap.has(userEmail.toLowerCase().trim());
      }
      if (!userExists && memberId) {
        userExists = existingUserMap.has(memberId.toLowerCase().trim());
      }
      if (!userExists && userId) {
        userExists = existingUserMap.has(userId);
      }

      // If user doesn't exist, it's a new user
      if (!userExists) {
        const packages: Array<{ package_name: string; package_price?: number; column: string }> = [];
        
        // Extract packages from Pack. 1-8 name and amount columns
        for (let i = 1; i <= 8; i++) {
          const pkgNameCol = `Pack. ${i} name`;
          const pkgAmtCol = `Pack. ${i} amt.`;
          
          const pkgName = row[pkgNameCol];
          const pkgAmt = row[pkgAmtCol];
          
          if (pkgName !== null && pkgName !== undefined && pkgName !== '') {
            const packageName = String(pkgName).trim();
            const packageAmount = pkgAmt ? Number(pkgAmt) : undefined;
            
            packages.push({
              package_name: packageName,
              package_price: packageAmount,
              column: pkgNameCol,
            });
          }
        }

        // Get referrer information
        const sponsorId = row['Sponsor ID'] ? String(row['Sponsor ID']) : undefined;
        const sponsorName = row['Sponsor Name'] ? String(row['Sponsor Name']) : undefined;

        newUsers.push({
          user_id: userId,
          member_id: memberId,
          name: userName,
          email: userEmail,
          phone: userPhone,
          packages: packages,
          referrer_id: sponsorId,
          referrer_name: sponsorName,
        });
      }
    }

    console.log(`\n👥 Found ${newUsers.length} new users`);

    // Get referrer email from database if referrer_id is available
    const allDbUsers = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        display_id: true,
      },
    });

    const dbUserMap = new Map<string, any>();
    allDbUsers.forEach(user => {
      if (user.email) dbUserMap.set(user.email.toLowerCase().trim(), user);
      if (user.display_id) dbUserMap.set(user.display_id.toLowerCase().trim(), user);
      if (user.id) dbUserMap.set(user.id.toString(), user);
    });

    // Find referrer email for each new user
    for (const newUser of newUsers) {
      if (newUser.referrer_id) {
        // Try to find referrer in database by ID, display_id, or name
        const referrer = dbUserMap.get(newUser.referrer_id.toLowerCase().trim()) ||
                        Array.from(dbUserMap.values()).find(u => 
                          u.name?.toLowerCase() === newUser.referrer_name?.toLowerCase()
                        );
        
        if (referrer) {
          newUser.referrer_email = referrer.email || undefined;
        }
      }
    }

    // Generate detailed report
    const report: any = {
      timestamp: new Date().toISOString(),
      total_new_users: newUsers.length,
      new_users: newUsers.map(user => ({
        user_id: user.user_id,
        member_id: user.member_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        packages: user.packages.map(pkg => ({
          package_name: pkg.package_name,
          package_price: pkg.package_price || 'N/A',
          column: pkg.column,
        })),
        referrer_id: user.referrer_id || 'N/A',
        referrer_name: user.referrer_name || 'N/A',
        referrer_email: user.referrer_email || 'N/A',
      })),
    };

    // Save JSON report
    const jsonPath = path.join(__dirname, '../../new-users-details.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ JSON report saved to: ${jsonPath}`);

    // Generate CSV report
    const csvRows: string[] = [];
    csvRows.push('User ID,Member ID,Name,Email,Phone,Package Name,Package Price,Column,Referrer ID,Referrer Name,Referrer Email');
    
    newUsers.forEach(user => {
      if (user.packages.length === 0) {
        csvRows.push([
          user.user_id || 'N/A',
          user.member_id || 'N/A',
          user.name || 'N/A',
          user.email || 'N/A',
          user.phone || 'N/A',
          'No Package',
          'N/A',
          'N/A',
          user.referrer_id || 'N/A',
          user.referrer_name || 'N/A',
          user.referrer_email || 'N/A',
        ].join(','));
      } else {
        user.packages.forEach(pkg => {
          csvRows.push([
            user.user_id || 'N/A',
            user.member_id || 'N/A',
            user.name || 'N/A',
            user.email || 'N/A',
            user.phone || 'N/A',
            `"${pkg.package_name}"`,
            pkg.package_price?.toString() || 'N/A',
            pkg.column,
            user.referrer_id || 'N/A',
            user.referrer_name || 'N/A',
            user.referrer_email || 'N/A',
          ].join(','));
        });
      }
    });

    const csvPath = path.join(__dirname, '../../new-users-details.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ CSV report saved to: ${csvPath}`);

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 NEW USERS DETAILS SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal New Users: ${newUsers.length}\n`);

    newUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'N/A'} (${user.email || user.member_id || user.user_id || 'Unknown'})`);
      console.log(`   📦 Packages (${user.packages.length}):`);
      if (user.packages.length === 0) {
        console.log('      - No packages found');
      } else {
        user.packages.forEach(pkg => {
          console.log(`      - ${pkg.package_name} (Column: ${pkg.column})`);
        });
      }
      console.log(`   👤 Direct Referrer: ${user.referrer_name || 'N/A'} (${user.referrer_id || 'N/A'})`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error analyzing new users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

getNewUsersDetails()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

