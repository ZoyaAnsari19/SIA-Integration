import { prisma } from '../src/config/prisma.js';
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface UserData {
  id: string;
  display_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  kyc_status: string | null;
  joined_date: string;
  joined_time: string;
  wallet_balance_main: number;
  wallet_balance_spot: number;
  referrer_display_id: string | null;
  referrer_name: string | null;
  direct_referrals: number;
  total_team_size: number;
}

async function exportUsersWithoutPackages() {
  console.log('🚀 Starting export of users without packages...\n');

  try {
    // Fetch all active users without completed packages
    const users = await prisma.$queryRaw<UserData[]>`
      SELECT 
        u.id::text as id,
        u.display_id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.kyc_status,
        TO_CHAR(u.created_at, 'YYYY-MM-DD') as joined_date,
        TO_CHAR(u.created_at, 'HH24:MI:SS') as joined_time,
        COALESCE(ub.balance, 0) as wallet_balance_main,
        COALESCE(ub.spot_balance, 0) as wallet_balance_spot,
        (SELECT display_id FROM users WHERE id = u.referrer_user_id) as referrer_display_id,
        (SELECT name FROM users WHERE id = u.referrer_user_id) as referrer_name,
        (SELECT COUNT(*)::int FROM user_tree_paths WHERE ancestor_id = u.id AND depth = 1) as direct_referrals,
        (SELECT COUNT(*)::int FROM user_tree_paths WHERE ancestor_id = u.id AND depth > 0) as total_team_size
      FROM users u
      LEFT JOIN user_balances ub ON u.id = ub.user_id
      WHERE u.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM purchases p 
          WHERE p.user_id = u.id AND p.status = 'completed'
        )
      ORDER BY u.created_at DESC
    `;

    console.log(`✅ Found ${users.length} active users without packages\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found. Exiting...');
      await prisma.$disconnect();
      return;
    }

    // Prepare data for Excel
    const excelData = users.map((user, index) => ({
      'S.No': index + 1,
      'User ID': user.display_id || '',
      'Name': user.name || '',
      'Email': user.email || '',
      'Phone': user.phone || '',
      'Status': user.status || '',
      'KYC Status': user.kyc_status || 'N/A',
      'Joined Date': user.joined_date || '',
      'Joined Time': user.joined_time || '',
      'Wallet Balance (Main)': Number(user.wallet_balance_main || 0).toFixed(2),
      'Wallet Balance (Spot)': Number(user.wallet_balance_spot || 0).toFixed(2),
      'Referrer ID': user.referrer_display_id || 'N/A',
      'Referrer Name': user.referrer_name || 'N/A',
      'Direct Referrals': user.direct_referrals || 0,
      'Total Team Size': user.total_team_size || 0,
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 12 },  // User ID
      { wch: 25 },  // Name
      { wch: 30 },  // Email
      { wch: 15 },  // Phone
      { wch: 10 },  // Status
      { wch: 12 },  // KYC Status
      { wch: 12 },  // Joined Date
      { wch: 12 },  // Joined Time
      { wch: 20 },  // Wallet Balance (Main)
      { wch: 20 },  // Wallet Balance (Spot)
      { wch: 12 },  // Referrer ID
      { wch: 25 },  // Referrer Name
      { wch: 15 },  // Direct Referrals
      { wch: 15 },  // Total Team Size
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users Without Packages');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `users-without-packages-${timestamp}.xlsx`;
    const filepath = join(process.cwd(), filename);

    // Write file
    XLSX.writeFile(workbook, filepath);

    console.log(`✅ Excel file created successfully!`);
    console.log(`📁 File location: ${filepath}`);
    console.log(`📊 Total records: ${users.length}\n`);

    // Summary statistics
    const stats = {
      total: users.length,
      with_referrer: users.filter(u => u.referrer_display_id).length,
      without_referrer: users.filter(u => !u.referrer_display_id).length,
      with_wallet_balance: users.filter(u => Number(u.wallet_balance_main || 0) > 0 || Number(u.wallet_balance_spot || 0) > 0).length,
      with_direct_referrals: users.filter(u => (u.direct_referrals || 0) > 0).length,
    };

    console.log('📈 Summary Statistics:');
    console.log(`   Total Users: ${stats.total}`);
    console.log(`   With Referrer: ${stats.with_referrer}`);
    console.log(`   Without Referrer: ${stats.without_referrer}`);
    console.log(`   With Wallet Balance: ${stats.with_wallet_balance}`);
    console.log(`   With Direct Referrals: ${stats.with_direct_referrals}\n`);

  } catch (error: any) {
    console.error('❌ Error exporting users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the export
exportUsersWithoutPackages()
  .then(() => {
    console.log('🎉 Export completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Export failed:', error);
    process.exit(1);
  });

