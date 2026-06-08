import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log('🔍 Checking Ledger Metadata and Wallet Tracking\n');
    console.log('='.repeat(60));
    
    // Check User 3's SELF commission details
    console.log('\n1️⃣  User 3 SELF Commission (should be in other_balance)');
    console.log('-'.repeat(60));
    const user3 = await client.query(`
      SELECT 
        le.id,
        le.commission_type,
        le.amount,
        le.metadata,
        le.credited_at,
        ub.balance,
        ub.spot_balance,
        ub.other_balance
      FROM ledger_entries le
      LEFT JOIN user_balances ub ON ub.user_id = le.receiver_user_id
      WHERE le.receiver_user_id = 3
        AND le.commission_type = 'SELF'
      ORDER BY le.credited_at DESC
      LIMIT 5
    `);
    
    user3.rows.forEach((row: any) => {
      console.log(`Entry ${row.id}:`);
      console.log(`  Amount: ₹${Number(row.amount).toFixed(2)}`);
      console.log(`  Metadata: ${JSON.stringify(row.metadata)}`);
      console.log(`  Wallet Balance: ₹${Number(row.balance).toFixed(2)}`);
      console.log(`  SPOT: ₹${Number(row.spot_balance).toFixed(2)}`);
      console.log(`  Other: ₹${Number(row.other_balance).toFixed(2)}`);
      console.log(`  Date: ${row.credited_at}`);
      console.log('');
    });
    
    // Check recent SPOT entries metadata
    console.log('\n2️⃣  Recent SPOT Entries Metadata');
    console.log('-'.repeat(60));
    const spotMeta = await client.query(`
      SELECT 
        id,
        receiver_user_id,
        amount,
        metadata->>'wallet_type' as wallet_type,
        metadata
      FROM ledger_entries
      WHERE commission_type = 'SPOT'
        AND amount > 0
      ORDER BY credited_at DESC
      LIMIT 5
    `);
    
    spotMeta.rows.forEach((row: any) => {
      console.log(`Entry ${row.id} (User ${row.receiver_user_id}):`);
      console.log(`  Amount: ₹${Number(row.amount).toFixed(2)}`);
      console.log(`  Wallet Type: ${row.wallet_type || 'NOT SET ⚠️'}`);
      console.log(`  Full Metadata: ${JSON.stringify(row.metadata)}`);
      console.log('');
    });
    
    // Check metadata statistics
    console.log('\n3️⃣  Ledger Metadata Statistics');
    console.log('-'.repeat(60));
    const withMeta = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE metadata->>'wallet_type' IS NOT NULL) as with_wallet_type,
        COUNT(*) FILTER (WHERE metadata->>'from_wallet' IS NOT NULL) as with_from_wallet,
        COUNT(*) FILTER (WHERE metadata->>'spot_deducted' IS NOT NULL) as with_spot_deducted
      FROM ledger_entries
      WHERE metadata IS NOT NULL
    `);
    
    console.log(`Total entries with metadata: ${withMeta.rows[0].total}`);
    console.log(`With wallet_type: ${withMeta.rows[0].with_wallet_type}`);
    console.log(`With from_wallet: ${withMeta.rows[0].with_from_wallet}`);
    console.log(`With spot_deducted: ${withMeta.rows[0].with_spot_deducted}`);
    console.log('');
    
    // Check withdrawal-related entries
    console.log('\n4️⃣  Withdrawal/Fee Deduction Entries');
    console.log('-'.repeat(60));
    const withdrawals = await client.query(`
      SELECT 
        le.id,
        le.commission_type,
        le.amount,
        le.metadata->>'wallet_type' as wallet_type,
        le.metadata->>'spot_deducted' as spot_deducted,
        le.metadata->>'other_deducted' as other_deducted,
        le.metadata
      FROM ledger_entries le
      WHERE le.commission_type = 'FEE_DEDUCTION'
        OR le.amount < 0
      ORDER BY le.credited_at DESC
      LIMIT 5
    `);
    
    if (withdrawals.rows.length > 0) {
      withdrawals.rows.forEach((row: any) => {
        console.log(`Entry ${row.id}:`);
        console.log(`  Type: ${row.commission_type}`);
        console.log(`  Amount: ₹${Number(row.amount).toFixed(2)}`);
        console.log(`  Wallet Type: ${row.wallet_type || 'N/A'}`);
        console.log(`  Spot Deducted: ₹${Number(row.spot_deducted || 0).toFixed(2)}`);
        console.log(`  Other Deducted: ₹${Number(row.other_deducted || 0).toFixed(2)}`);
        console.log(`  Full Metadata: ${JSON.stringify(row.metadata)}`);
        console.log('');
      });
    } else {
      console.log('No withdrawal/fee deduction entries found yet.');
    }
    
    console.log('\n✅ Ledger metadata check completed!\n');
    
  } catch (error) {
    console.error('❌ Error checking ledger:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

