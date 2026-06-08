/**
 * Fix Spot Balance based on 5 Jan 2026 baseline + Ledger entries
 * 
 * Logic:
 * 1. Get spot_balance on 5 Jan 2026 (calculated from ledger up to 5 Jan)
 * 2. Get all SPOT-related ledger entries after 5 Jan 2026
 * 3. Expected current balance = 5Jan_balance + ledger_net_change_after_5Jan
 * 4. Compare with actual current balance and fix if needed
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_2024@localhost:5442/mlm_commission?schema=public'
    }
  }
});

const CUTOFF_DATE = new Date('2026-01-05 00:00:00');

interface SpotCalculation {
  userId: bigint;
  displayId: string;
  name: string;
  spotBalance5Jan: number;
  spotCreditsAfter5Jan: number;
  spotDeductionsAfter5Jan: number;
  expectedCurrentBalance: number;
  actualCurrentBalance: number;
  difference: number;
}

async function getSpotBalanceOn5Jan(userId: bigint): Promise<number> {
  // Calculate spot balance from ledger up to 5 Jan 2026
  const spotCredits = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: userId,
      OR: [
        { commission_type: 'SPOT', amount: { gt: 0 } },
        { 
          commission_type: 'ADMIN_OPS',
          metadata: { path: ['wallet_type'], equals: 'spot_balance' },
          amount: { gt: 0 }
        }
      ],
      credited_at: { lt: CUTOFF_DATE }
    },
    _sum: { amount: true }
  });

  const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
    FROM ledger_entries
    WHERE receiver_user_id = ${userId}
      AND metadata->>'spot_deducted' IS NOT NULL
      AND credited_at < ${CUTOFF_DATE}
  `;

  const adminOpsDebit = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: userId,
      commission_type: 'ADMIN_OPS',
      metadata: { path: ['wallet_type'], equals: 'spot_balance' },
      amount: { lt: 0 },
      credited_at: { lt: CUTOFF_DATE }
    },
    _sum: { amount: true }
  });

  const credits = Number(spotCredits._sum.amount || 0);
  const deductions = Number(spotDeductions[0]?.total || 0);
  const debits = Math.abs(Number(adminOpsDebit._sum.amount || 0));

  return credits - deductions - debits;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔧 Fix Spot Balance (5 Jan 2026 baseline + Ledger entries)');
  console.log('='.repeat(80));
  console.log();

  try {
    // Get all users
    const users = await prisma.users.findMany({
      where: { display_id: { not: null } },
      select: { id: true, display_id: true, name: true },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Found ${users.length} users`);
    console.log();

    // Calculate expected balances
    console.log('📊 Calculating expected spot balances...');
    const calculations: SpotCalculation[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      if (i % 200 === 0) {
        console.log(`   Processing ${i + 1}/${users.length}...`);
      }

      const spotBalance5Jan = await getSpotBalanceOn5Jan(user.id);
      
      // Get spot credits after 5 Jan
      const spotCredits = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: user.id,
          OR: [
            { commission_type: 'SPOT', amount: { gt: 0 } },
            { 
              commission_type: 'ADMIN_OPS',
              metadata: { path: ['wallet_type'], equals: 'spot_balance' },
              amount: { gt: 0 }
            }
          ],
          credited_at: { gte: CUTOFF_DATE }
        },
        _sum: { amount: true }
      });

      const spotCreditsAfter5Jan = Number(spotCredits._sum.amount || 0);

      // Get spot deductions after 5 Jan
      const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
        FROM ledger_entries
        WHERE receiver_user_id = ${user.id}
          AND metadata->>'spot_deducted' IS NOT NULL
          AND credited_at >= ${CUTOFF_DATE}
      `;

      const spotDeductionsAfter5Jan = Number(spotDeductions[0]?.total || 0);

      // Get admin ops spot debit after 5 Jan
      const adminOpsDebit = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: user.id,
          commission_type: 'ADMIN_OPS',
          metadata: { path: ['wallet_type'], equals: 'spot_balance' },
          amount: { lt: 0 },
          credited_at: { gte: CUTOFF_DATE }
        },
        _sum: { amount: true }
      });

      const adminOpsDebitAfter5Jan = Math.abs(Number(adminOpsDebit._sum.amount || 0));

      const expectedCurrentBalance = spotBalance5Jan + spotCreditsAfter5Jan - spotDeductionsAfter5Jan - adminOpsDebitAfter5Jan;

      // Get actual current balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: user.id },
        select: { spot_balance: true, balance: true, other_balance: true }
      });

      const actualCurrentBalance = Number(balance?.spot_balance || 0);
      const actualTotalBalance = Number(balance?.balance || 0);
      const actualOtherBalance = Number(balance?.other_balance || 0);
      const difference = actualCurrentBalance - expectedCurrentBalance;

      calculations.push({
        userId: user.id,
        displayId: user.display_id || '',
        name: user.name || '',
        spotBalance5Jan,
        spotCreditsAfter5Jan,
        spotDeductionsAfter5Jan: spotDeductionsAfter5Jan + adminOpsDebitAfter5Jan,
        expectedCurrentBalance,
        actualCurrentBalance,
        difference
      });
    }

    // Filter users with mismatch
    const mismatches = calculations.filter(c => Math.abs(c.difference) > 0.01);
    
    console.log(`\n⚠️  Found ${mismatches.length} users with mismatch`);
    console.log();

    // Show top 30 mismatches
    mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    console.log('Top 30 Mismatches:');
    console.log('-'.repeat(140));
    console.log('Display ID | Name | 5Jan Balance | Credits After | Deductions | Expected | Actual | Difference');
    console.log('-'.repeat(140));
    
    for (const m of mismatches.slice(0, 30)) {
      console.log(
        `${m.displayId.padEnd(12)} | ${(m.name || '').slice(0, 20).padEnd(20)} | ` +
        `${m.spotBalance5Jan.toFixed(2).padStart(12)} | ${m.spotCreditsAfter5Jan.toFixed(2).padStart(13)} | ` +
        `${m.spotDeductionsAfter5Jan.toFixed(2).padStart(11)} | ${m.expectedCurrentBalance.toFixed(2).padStart(9)} | ` +
        `${m.actualCurrentBalance.toFixed(2).padStart(7)} | ${m.difference.toFixed(2).padStart(10)}`
      );
    }
    console.log();

    // Summary before update
    const totalDiff = mismatches.reduce((sum, m) => sum + Math.abs(m.difference), 0);
    console.log('📊 Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   Users with mismatch: ${mismatches.length}`);
    console.log(`   Total absolute difference: ₹${totalDiff.toFixed(2)}`);
    console.log(`   Average difference: ₹${(totalDiff / mismatches.length).toFixed(2)}`);
    console.log();

    // Ask for confirmation before updating
    console.log(`\n⚠️  Ready to update ${mismatches.length} users in LOCAL DB`);
    console.log('   This will set spot_balance = expectedCurrentBalance for each user');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update balances
    console.log('\n🔄 Updating spot balances...');
    let updated = 0;
    
    for (const m of mismatches) {
      // Get current balance to calculate new total balance
      const currentBalance = await prisma.user_balances.findUnique({
        where: { user_id: m.userId },
        select: { balance: true, other_balance: true }
      });

      const currentTotal = Number(currentBalance?.balance || 0);
      const currentOther = Number(currentBalance?.other_balance || 0);
      const currentSpot = m.actualCurrentBalance;
      
      // New total = other_balance (unchanged) + new spot_balance
      const newTotal = currentOther + m.expectedCurrentBalance;
      const totalDiff = newTotal - currentTotal;

      await prisma.user_balances.upsert({
        where: { user_id: m.userId },
        update: {
          spot_balance: m.expectedCurrentBalance,
          balance: newTotal,
          updated_at: new Date()
        },
        create: {
          user_id: m.userId,
          balance: m.expectedCurrentBalance,
          spot_balance: m.expectedCurrentBalance,
          other_balance: 0
        }
      });
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated}/${mismatches.length}...`);
      }
    }

    console.log(`\n✅ Updated ${updated} users`);
    console.log();

    // Final summary
    console.log('📊 Final Summary:');
    console.log(`   Total users processed: ${users.length}`);
    console.log(`   Users corrected: ${updated}`);
    console.log(`   Total absolute difference corrected: ₹${totalDiff.toFixed(2)}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
