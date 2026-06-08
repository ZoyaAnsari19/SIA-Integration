/**
 * Fix All Negative Spot Wallets
 * 
 * Logic:
 * 1. Find all users with negative spot_balance
 * 2. Calculate correct spot_balance from ledger (all time)
 * 3. Update user_balances.spot_balance to match ledger
 * 4. Adjust total balance accordingly
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

interface NegativeSpotUser {
  userId: bigint;
  displayId: string;
  name: string;
  currentSpotBalance: number;
  ledgerSpotCredits: number;
  ledgerSpotDeductions: number;
  expectedSpotBalance: number;
  difference: number;
}

async function calculateCorrectSpotBalance(userId: bigint): Promise<number> {
  // Get all SPOT credits (SPOT commission + ADMIN_OPS to spot_balance)
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
      ]
    },
    _sum: { amount: true }
  });

  // Get all spot deductions (from metadata->>'spot_deducted')
  const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
    FROM ledger_entries
    WHERE receiver_user_id = ${userId}
      AND metadata->>'spot_deducted' IS NOT NULL
  `;

  // Get ADMIN_OPS debits from spot_balance
  const adminOpsDebit = await prisma.ledger_entries.aggregate({
    where: {
      receiver_user_id: userId,
      commission_type: 'ADMIN_OPS',
      metadata: { path: ['wallet_type'], equals: 'spot_balance' },
      amount: { lt: 0 }
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
  console.log('🔧 Fix All Negative Spot Wallets');
  console.log('='.repeat(80));
  console.log();

  try {
    // Find all users with negative spot_balance
    const negativeBalances = await prisma.user_balances.findMany({
      where: {
        spot_balance: { lt: 0 }
      },
      orderBy: {
        spot_balance: 'asc'
      }
    });

    // Get user details
    const userIds = negativeBalances.map(ub => ub.user_id);
    const users = await prisma.users.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        display_id: true,
        name: true
      }
    });

    const userMap = new Map(users.map(u => [u.id, u]));
    const negativeUsers = negativeBalances.map(ub => ({
      ...ub,
      user: userMap.get(ub.user_id) || { id: ub.user_id, display_id: null, name: null }
    }));

    console.log(`📊 Found ${negativeUsers.length} users with negative spot_balance`);
    console.log();

    if (negativeUsers.length === 0) {
      console.log('✅ No users with negative spot_balance found!');
      return;
    }

    // Calculate correct balances from ledger
    console.log('🔄 Calculating correct spot balances from ledger...');
    const corrections: NegativeSpotUser[] = [];

    for (let i = 0; i < negativeUsers.length; i++) {
      const ub = negativeUsers[i];
      const user = ub.user;
      
      if (i % 50 === 0) {
        console.log(`   Processing ${i + 1}/${negativeUsers.length}...`);
      }

      const currentSpotBalance = Number(ub.spot_balance);
      const expectedSpotBalance = await calculateCorrectSpotBalance(user.id);

      // Get breakdown for reporting
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
          ]
        },
        _sum: { amount: true }
      });

      const spotDeductions = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM((metadata->>'spot_deducted')::numeric), 0) as total
        FROM ledger_entries
        WHERE receiver_user_id = ${user.id}
          AND metadata->>'spot_deducted' IS NOT NULL
      `;

      const credits = Number(spotCredits._sum.amount || 0);
      const deductions = Number(spotDeductions[0]?.total || 0);

      corrections.push({
        userId: user.id,
        displayId: user.display_id || '',
        name: user.name || '',
        currentSpotBalance,
        ledgerSpotCredits: credits,
        ledgerSpotDeductions: deductions,
        expectedSpotBalance,
        difference: expectedSpotBalance - currentSpotBalance
      });
    }

    console.log(`\n✅ Calculated correct balances for ${corrections.length} users`);
    console.log();

    // Show top 30 worst cases
    corrections.sort((a, b) => a.currentSpotBalance - b.currentSpotBalance);
    console.log('Top 30 Most Negative Spot Wallets:');
    console.log('-'.repeat(140));
    console.log('Display ID | Name | Current | Expected | Credits | Deductions | Difference');
    console.log('-'.repeat(140));
    
    for (const c of corrections.slice(0, 30)) {
      console.log(
        `${c.displayId.padEnd(12)} | ${(c.name || '').slice(0, 20).padEnd(20)} | ` +
        `${c.currentSpotBalance.toFixed(2).padStart(8)} | ${c.expectedSpotBalance.toFixed(2).padStart(9)} | ` +
        `${c.ledgerSpotCredits.toFixed(2).padStart(8)} | ${c.ledgerSpotDeductions.toFixed(2).padStart(11)} | ` +
        `${c.difference.toFixed(2).padStart(11)}`
      );
    }
    console.log();

    // Summary stats
    const totalNegative = corrections.reduce((sum, c) => sum + Math.abs(c.currentSpotBalance), 0);
    const totalExpected = corrections.reduce((sum, c) => sum + c.expectedSpotBalance, 0);
    const totalDifference = corrections.reduce((sum, c) => sum + Math.abs(c.difference), 0);

    console.log('📊 Summary:');
    console.log(`   Users with negative spot_balance: ${corrections.length}`);
    console.log(`   Total negative amount (current): ₹${totalNegative.toFixed(2)}`);
    console.log(`   Total expected amount (from ledger): ₹${totalExpected.toFixed(2)}`);
    console.log(`   Total correction needed: ₹${totalDifference.toFixed(2)}`);
    console.log();

    // Ask for confirmation
    console.log(`\n⚠️  Ready to fix ${corrections.length} users in LOCAL DB`);
    console.log('   This will set spot_balance = expectedSpotBalance (from ledger) for each user');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update balances
    console.log('\n🔄 Updating spot balances...');
    let updated = 0;
    
    for (const c of corrections) {
      // Get current balance to calculate new total
      const currentBalance = await prisma.user_balances.findUnique({
        where: { user_id: c.userId },
        select: { balance: true, other_balance: true }
      });

      const currentTotal = Number(currentBalance?.balance || 0);
      const currentOther = Number(currentBalance?.other_balance || 0);
      const currentSpot = c.currentSpotBalance;
      
      // New total = other_balance (unchanged) + new spot_balance
      const newTotal = currentOther + c.expectedSpotBalance;
      const totalDiff = newTotal - currentTotal;

      await prisma.user_balances.update({ where: { user_id: c.userId }, data: {
          spot_balance: c.expectedSpotBalance,
          balance: newTotal,
          updated_at: new Date()
        } });
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated}/${corrections.length}...`);
      }
    }

    console.log(`\n✅ Updated ${updated} users`);
    console.log();

    // Final verification
    const remainingNegative = await prisma.user_balances.count({
      where: { spot_balance: { lt: 0 } }
    });

    console.log('📊 Final Summary:');
    console.log(`   Users corrected: ${updated}`);
    console.log(`   Remaining negative spot_balance: ${remainingNegative}`);
    console.log(`   Total correction applied: ₹${totalDifference.toFixed(2)}`);
    console.log();

    if (remainingNegative === 0) {
      console.log('✅ All negative spot wallets have been corrected!');
    } else {
      console.log(`⚠️  ${remainingNegative} users still have negative spot_balance`);
      console.log('   These might be legitimate (from fees/deductions) or need further investigation');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
