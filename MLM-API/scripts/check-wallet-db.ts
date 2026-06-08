import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    console.log('🔍 Checking 3-Wallet System Database State\n');
    console.log('='.repeat(60));
    
    // 1. Check user_balances structure (spot, other, team_royalty_balance)
    console.log('\n1️⃣  User Balances (spot_balance, other_balance, team_royalty_balance, balance)');
    console.log('-'.repeat(60));
    const balances = await client.query(`
      SELECT 
        user_id,
        balance,
        spot_balance,
        other_balance,
        COALESCE(team_royalty_balance, 0) as team_royalty_balance,
        (spot_balance + other_balance + COALESCE(team_royalty_balance, 0)) as calculated_total,
        (balance - (spot_balance + other_balance + COALESCE(team_royalty_balance, 0))) as difference
      FROM user_balances
      WHERE balance > 0 OR spot_balance > 0 OR other_balance > 0 OR COALESCE(team_royalty_balance, 0) > 0
      ORDER BY balance DESC
      LIMIT 10
    `);
    
    console.log(`Found ${balances.rows.length} users with balances:\n`);
    balances.rows.forEach((row: any) => {
      const diff = Number(row.difference || 0);
      const status = Math.abs(diff) < 0.01 ? '✅' : '⚠️';
      console.log(`${status} User ${row.user_id}:`);
      console.log(`   Total: ₹${Number(row.balance).toFixed(2)}`);
      console.log(`   SPOT: ₹${Number(row.spot_balance).toFixed(2)}`);
      console.log(`   Other: ₹${Number(row.other_balance).toFixed(2)}`);
      console.log(`   Team Royalty: ₹${Number(row.team_royalty_balance || 0).toFixed(2)}`);
      console.log(`   Calculated: ₹${Number(row.calculated_total).toFixed(2)}`);
      if (Math.abs(diff) >= 0.01) {
        console.log(`   ⚠️  Difference: ₹${diff.toFixed(2)} (fees/withdrawals)`);
      }
    });
    
    // 2. Check recent ledger entries with wallet_type metadata
    console.log('\n\n2️⃣  Recent Ledger Entries (with wallet_type metadata)');
    console.log('-'.repeat(60));
    const ledgerEntries = await client.query(`
      SELECT 
        id,
        receiver_user_id,
        commission_type,
        amount,
        metadata,
        credited_at
      FROM ledger_entries
      WHERE commission_type = 'SPOT' OR metadata::text LIKE '%wallet_type%'
      ORDER BY credited_at DESC
      LIMIT 15
    `);
    
    console.log(`Found ${ledgerEntries.rows.length} relevant ledger entries:\n`);
    ledgerEntries.rows.forEach((row: any) => {
      const metadata = row.metadata || {};
      const walletType = metadata.wallet_type || 'N/A';
      console.log(`Entry ${row.id}:`);
      console.log(`   Receiver: ${row.receiver_user_id}`);
      console.log(`   Type: ${row.commission_type}`);
      console.log(`   Amount: ₹${Number(row.amount).toFixed(2)}`);
      console.log(`   Wallet: ${walletType}`);
      if (metadata.spot_deducted || metadata.other_deducted) {
        console.log(`   Spot Deducted: ₹${Number(metadata.spot_deducted || 0).toFixed(2)}`);
        console.log(`   Other Deducted: ₹${Number(metadata.other_deducted || 0).toFixed(2)}`);
      }
      if (metadata.from_wallet) {
        console.log(`   From Wallet: ${metadata.from_wallet}`);
      }
      console.log(`   Date: ${row.created_at}`);
      console.log('');
    });
    
    // 3. Check SPOT commissions distribution
    console.log('\n\n3️⃣  SPOT Commission Distribution (should go to spot_balance)');
    console.log('-'.repeat(60));
    const spotCommissions = await client.query(`
      SELECT 
        receiver_user_id,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM ledger_entries
      WHERE commission_type = 'SPOT'
        AND amount > 0
      GROUP BY receiver_user_id
      ORDER BY total_amount DESC
      LIMIT 10
    `);
    
    console.log(`Found ${spotCommissions.rows.length} users with SPOT commissions:\n`);
    for (const row of spotCommissions.rows) {
      const userId = row.receiver_user_id;
      const balance = await client.query(`
        SELECT spot_balance, other_balance, balance
        FROM user_balances
        WHERE user_id = $1
      `, [userId]);
      
      if (balance.rows.length > 0) {
        const bal = balance.rows[0];
        const spotBal = Number(bal.spot_balance || 0);
        const totalSpot = Number(row.total_amount);
        const status = spotBal >= totalSpot * 0.9 ? '✅' : '⚠️';
        console.log(`${status} User ${userId}:`);
        console.log(`   SPOT Commissions: ₹${totalSpot.toFixed(2)} (${row.count} entries)`);
        console.log(`   Current spot_balance: ₹${spotBal.toFixed(2)}`);
        if (spotBal < totalSpot * 0.9) {
          console.log(`   ⚠️  Some SPOT may have been withdrawn/transferred`);
        }
      }
    }
    
    // 4. Check other commission types (SELF, GLOBAL_HELPING, MONTHLY)
    console.log('\n\n4️⃣  Other Commission Types (should go to other_balance)');
    console.log('-'.repeat(60));
    const otherCommissions = await client.query(`
      SELECT 
        receiver_user_id,
        commission_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM ledger_entries
      WHERE commission_type IN ('SELF', 'GLOBAL_HELPING', 'MONTHLY')
        AND amount > 0
      GROUP BY receiver_user_id, commission_type
      ORDER BY total_amount DESC
      LIMIT 10
    `);
    
    console.log(`Found ${otherCommissions.rows.length} entries:\n`);
    for (const row of otherCommissions.rows) {
      const userId = row.receiver_user_id;
      const balance = await client.query(`
        SELECT other_balance, balance
        FROM user_balances
        WHERE user_id = $1
      `, [userId]);
      
      if (balance.rows.length > 0) {
        const bal = balance.rows[0];
        const otherBal = Number(bal.other_balance || 0);
        console.log(`User ${userId} - ${row.commission_type}:`);
        console.log(`   Commissions: ₹${Number(row.total_amount).toFixed(2)} (${row.count} entries)`);
        console.log(`   Current other_balance: ₹${otherBal.toFixed(2)}`);
      }
    }
    
    // 5. Check pending commissions
    console.log('\n\n5️⃣  Pending Commissions (SPOT)');
    console.log('-'.repeat(60));
    const pending = await client.query(`
      SELECT 
        receiver_user_id,
        source_user_id,
        level,
        amount,
        commission_type,
        created_at
      FROM pending_commissions
      WHERE commission_type = 'SPOT'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${pending.rows.length} pending SPOT commissions:\n`);
    pending.rows.forEach((row: any) => {
      console.log(`Pending for User ${row.receiver_user_id}:`);
      console.log(`   From User ${row.source_user_id} at Level ${row.level || 'N/A'}`);
      console.log(`   Amount: ₹${Number(row.amount).toFixed(2)}`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });
    
    // 6. Check wallet transfers with from_wallet
    console.log('\n\n6️⃣  Recent Wallet Transfers (with from_wallet)');
    console.log('-'.repeat(60));
    const transfers = await client.query(`
      SELECT 
        wt.id,
        wt.from_user_id,
        wt.to_user_id,
        wt.amount,
        wt.created_at,
        le.metadata
      FROM wallet_transfers wt
      LEFT JOIN ledger_entries le ON le.id = (
        SELECT id FROM ledger_entries 
        WHERE source_user_id = wt.from_user_id 
          AND receiver_user_id = wt.to_user_id
          AND credited_at BETWEEN wt.created_at - INTERVAL '1 minute' AND wt.created_at + INTERVAL '1 minute'
        ORDER BY credited_at DESC
        LIMIT 1
      )
      ORDER BY wt.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${transfers.rows.length} recent transfers:\n`);
    transfers.rows.forEach((row: any) => {
      const metadata = row.metadata || {};
      console.log(`Transfer ${row.id}:`);
      console.log(`   From: ${row.from_user_id} → To: ${row.to_user_id}`);
      console.log(`   Amount: ₹${Number(row.amount).toFixed(2)}`);
      if (metadata.from_wallet) {
        console.log(`   From Wallet: ${metadata.from_wallet} ✅`);
      } else {
        console.log(`   From Wallet: Not specified ⚠️`);
      }
      if (metadata.wallet_type) {
        console.log(`   Wallet Type: ${metadata.wallet_type}`);
      }
      console.log(`   Date: ${row.created_at}`);
      console.log('');
    });
    
    // 7. Summary
    console.log('\n\n7️⃣  Summary');
    console.log('='.repeat(60));
    const summary = await client.query(`
      SELECT 
        COUNT(DISTINCT user_id) as users_with_balance,
        SUM(balance) as total_balance,
        SUM(spot_balance) as total_spot,
        SUM(other_balance) as total_other,
        COUNT(*) FILTER (WHERE spot_balance > 0) as users_with_spot,
        COUNT(*) FILTER (WHERE other_balance > 0) as users_with_other
      FROM user_balances
      WHERE balance > 0 OR spot_balance > 0 OR other_balance > 0
    `);
    
    const s = summary.rows[0];
    console.log(`Users with balances: ${s.users_with_balance}`);
    console.log(`Total balance: ₹${Number(s.total_balance).toFixed(2)}`);
    console.log(`Total SPOT: ₹${Number(s.total_spot).toFixed(2)}`);
    console.log(`Total Other: ₹${Number(s.total_other).toFixed(2)}`);
    console.log(`Users with SPOT: ${s.users_with_spot}`);
    console.log(`Users with Other: ${s.users_with_other}`);
    
    const ledgerSummary = await client.query(`
      SELECT 
        commission_type,
        COUNT(*) as count,
        SUM(amount) FILTER (WHERE amount > 0) as total_credits,
        SUM(amount) FILTER (WHERE amount < 0) as total_debits
      FROM ledger_entries
      GROUP BY commission_type
      ORDER BY total_credits DESC NULLS LAST
    `);
    
    console.log('\nLedger Summary by Commission Type:');
    ledgerSummary.rows.forEach((row: any) => {
      console.log(`  ${row.commission_type}:`);
      console.log(`    Entries: ${row.count}`);
      console.log(`    Credits: ₹${Number(row.total_credits || 0).toFixed(2)}`);
      console.log(`    Debits: ₹${Number(row.total_debits || 0).toFixed(2)}`);
    });
    
    console.log('\n✅ Database check completed!\n');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

