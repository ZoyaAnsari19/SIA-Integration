#!/usr/bin/env tsx
/**
 * Fix SIA00514 user's commissions from Jan 24, 2026 to today
 * Update existing entries and create missing entries with correct amounts
 */

import { PrismaClient } from '@prisma/client';
import { daysInMonth } from '../src/utils/dateUtils.js';
import { 
  rupeesToPaise, 
  paiseToRupees, 
  calculateDailyPaise,
} from '../src/utils/paise.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';

const prisma = new PrismaClient();

const USER_DISPLAY_ID = 'SIA00514';
const AFFECTED_PURCHASE_IDS = [1779, 1778, 1777];
const PACKAGE_ASSIGN_DATE = new Date('2026-01-24T00:00:00.000Z');
const GLOBAL_MONTHLY_PER_ID = 6.25;

async function main() {
  console.log('='.repeat(80));
  console.log('🔧 FIXING SIA00514 COMMISSIONS - Jan 24 to Today');
  console.log('='.repeat(80));

  // Get user
  const user = await prisma.users.findUnique({
    where: { display_id: USER_DISPLAY_ID },
    select: { id: true, display_id: true, name: true },
  });

  if (!user) {
    console.log('\n❌ User not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ User: ${user.display_id} (${user.name})`);

  // Get purchases
  const purchases = await prisma.purchases.findMany({
    where: {
      id: { in: AFFECTED_PURCHASE_IDS.map((id) => BigInt(id)) as any },
    },
  });

  // Get package details
  const packageIds = [...new Set(purchases.map((p) => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: {
      id: true,
      name: true,
      price: true,
      global_ids: true,
      self_roi_percent: true,
    },
  });

  const packageMap = new Map(packages.map((p) => [p.id, p]));

  // Get today's date
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  console.log(`\n📅 Date Range: ${PACKAGE_ASSIGN_DATE.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);

  let totalUpdated = 0;
  let totalCreated = 0;
  let totalWalletAdjustment = 0;

  for (const purchase of purchases) {
    const pkg = packageMap.get(purchase.package_id);
    const effectiveGlobalIds = Number((purchase as any).effective_global_ids || 0);
    const packageGlobalIds = Number(pkg?.global_ids || 0);
    const selfRoiPercent = Number(pkg?.self_roi_percent || 0);
    const purchasedAt = new Date(purchase.purchased_at);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${pkg?.name || 'N/A'}`);
    console.log(`   Effective Global IDs: ${effectiveGlobalIds}`);
    console.log(`   Package Cap: ${packageGlobalIds}`);
    console.log(`   Self ROI: ${selfRoiPercent}%`);

    // Generate dates from NEXT day after purchase (commissions start next day at 12:05 AM)
    const dates: Date[] = [];
    const nextDay = new Date(purchasedAt);
    nextDay.setDate(nextDay.getDate() + 1); // Next day after purchase
    nextDay.setHours(0, 0, 0, 0);
    
    const currentDate = new Date(nextDay);
    while (currentDate <= today) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`   Processing ${dates.length} days...`);

    let purchaseTotalAdjustment = 0;

    for (const date of dates) {
      const dateStr = date.toISOString().slice(0, 10);
      const daysInMonthForDate = daysInMonth(date);
      const isLastDayOfMonth = date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

      // Count new users up to this date
      const newUsers = await prisma.purchases.findMany({
        where: {
          status: 'completed',
          is_renewal: false,
          purchased_at: {
            gt: purchasedAt,
            lte: new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1), // End of day
          },
          NOT: { user_id: user.id },
        } as any,
        select: { user_id: true },
        distinct: ['user_id'],
      });

      const newUsersCount = newUsers.length;
      const expectedUsedIds = Math.min(effectiveGlobalIds + newUsersCount, packageGlobalIds);

      // Calculate expected GLOBAL_HELPING commission
      const { dailyPaise: perIdDailyPaise, remainderPaise: perIdRemainderPaise } = 
        calculateDailyPaise(GLOBAL_MONTHLY_PER_ID, daysInMonthForDate);
      
      const totalDailyPaise = perIdDailyPaise * BigInt(expectedUsedIds);
      let expectedGlobalAmount: number;
      
      if (isLastDayOfMonth && perIdRemainderPaise > 0n) {
        const totalRemainderPaise = perIdRemainderPaise * BigInt(expectedUsedIds);
        expectedGlobalAmount = paiseToRupees(totalDailyPaise + totalRemainderPaise);
      } else {
        expectedGlobalAmount = paiseToRupees(totalDailyPaise);
      }

      // Calculate expected SELF commission
      let expectedSelfAmount = 0;
      if (selfRoiPercent > 0 && pkg?.price) {
        const selfMonthly = Number(pkg.price) * selfRoiPercent / 100;
        const { dailyPaise: selfDailyPaise, remainderPaise: selfRemainderPaise } = 
          calculateDailyPaise(selfMonthly, daysInMonthForDate);
        
        if (isLastDayOfMonth && selfRemainderPaise > 0n) {
          expectedSelfAmount = paiseToRupees(selfDailyPaise + selfRemainderPaise);
        } else {
          expectedSelfAmount = paiseToRupees(selfDailyPaise);
        }
      }

      // Check existing GLOBAL_HELPING entry
      const globalIdk = `daily:global:${purchase.id}:${dateStr}`;
      const existingGlobal = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: globalIdk },
      });

      if (existingGlobal) {
        const existingAmount = Number(existingGlobal.amount);
        const difference = expectedGlobalAmount - existingAmount;
        
        if (Math.abs(difference) > 0.01) { // More than 1 paisa difference
          console.log(`   📝 ${dateStr} GLOBAL: Updating ₹${existingAmount.toFixed(2)} → ₹${expectedGlobalAmount.toFixed(2)} (diff: ₹${difference.toFixed(2)})`);
          
          // Update ledger entry
          await prisma.ledger_entries.update({
            where: { id: existingGlobal.id },
            data: {
              amount: expectedGlobalAmount,
              metadata: {
                used_ids: expectedUsedIds,
                package_cap: packageGlobalIds,
              },
            },
          });

          // Update wallet transaction if exists
          const walletTxn = await prisma.wallet_transactions.findFirst({
            where: { ledger_entry_id: existingGlobal.id },
          });

          if (walletTxn) {
            await prisma.wallet_transactions.update({
              where: { id: walletTxn.id },
              data: { amount: expectedGlobalAmount },
            });
          }

          // Adjust wallet balance
          if (difference !== 0) {
            await prisma.user_balances.updateMany({
              where: { user_id: user.id },
              data: {
                other_balance: { increment: difference },
              },
            });
            totalWalletAdjustment += difference;
            purchaseTotalAdjustment += difference;
          }

          totalUpdated++;
        } else {
          console.log(`   ✅ ${dateStr} GLOBAL: Already correct (₹${existingAmount.toFixed(2)})`);
        }
      } else {
        // Create missing entry
        console.log(`   ➕ ${dateStr} GLOBAL: Creating entry (₹${expectedGlobalAmount.toFixed(2)})`);
        
        const creditedAt = new Date(date);
        creditedAt.setHours(6, 24, 47, 0); // Match existing pattern

        await addLedgerAndWallet({
          receiverId: user.id,
          sourceId: user.id,
          purchaseId: purchase.id,
          amount: expectedGlobalAmount,
          type: 'GLOBAL_HELPING',
          metadata: {
            used_ids: expectedUsedIds,
            package_cap: packageGlobalIds,
          },
          idempotencyKey: globalIdk,
          creditedAt,
        });

        // Update purchase income
        await prisma.purchases.update({
          where: { id: purchase.id },
          data: { income: { increment: expectedGlobalAmount } } as any,
        });

        totalCreated++;
        purchaseTotalAdjustment += expectedGlobalAmount;
      }

      // Check existing SELF entry
      const selfIdk = `daily:self:${purchase.id}:${dateStr}`;
      const existingSelf = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: selfIdk },
      });

      if (existingSelf) {
        const existingAmount = Number(existingSelf.amount);
        const difference = expectedSelfAmount - existingAmount;
        
        if (Math.abs(difference) > 0.01) {
          console.log(`   📝 ${dateStr} SELF: Updating ₹${existingAmount.toFixed(2)} → ₹${expectedSelfAmount.toFixed(2)} (diff: ₹${difference.toFixed(2)})`);
          
          await prisma.ledger_entries.update({
            where: { id: existingSelf.id },
            data: { amount: expectedSelfAmount },
          });

          const walletTxn = await prisma.wallet_transactions.findFirst({
            where: { ledger_entry_id: existingSelf.id },
          });

          if (walletTxn) {
            await prisma.wallet_transactions.update({
              where: { id: walletTxn.id },
              data: { amount: expectedSelfAmount },
            });
          }

          if (difference !== 0) {
            await prisma.user_balances.updateMany({
              where: { user_id: user.id },
              data: {
                other_balance: { increment: difference },
              },
            });
            totalWalletAdjustment += difference;
            purchaseTotalAdjustment += difference;
          }

          totalUpdated++;
        } else {
          console.log(`   ✅ ${dateStr} SELF: Already correct (₹${existingAmount.toFixed(2)})`);
        }
      } else if (expectedSelfAmount > 0) {
        // Create missing SELF entry
        console.log(`   ➕ ${dateStr} SELF: Creating entry (₹${expectedSelfAmount.toFixed(2)})`);
        
        const creditedAt = new Date(date);
        creditedAt.setHours(6, 24, 47, 0);

        await addLedgerAndWallet({
          receiverId: user.id,
          sourceId: user.id,
          purchaseId: purchase.id,
          amount: expectedSelfAmount,
          type: 'SELF',
          metadata: {},
          idempotencyKey: selfIdk,
          creditedAt,
        });

        await prisma.purchases.update({
          where: { id: purchase.id },
          data: { income: { increment: expectedSelfAmount } } as any,
        });

        totalCreated++;
        purchaseTotalAdjustment += expectedSelfAmount;
      }
    }

    // Recalculate purchase income
    const allCommissions = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchase.id,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      },
    });

    const totalIncome = allCommissions.reduce((sum, e) => sum + Number(e.amount), 0);
    
    await prisma.purchases.update({
      where: { id: purchase.id },
      data: { income: totalIncome } as any,
    });

    console.log(`\n   💰 Purchase ${purchase.id} Total Adjustment: ₹${purchaseTotalAdjustment.toFixed(2)}`);
    console.log(`   💰 Purchase ${purchase.id} Total Income: ₹${totalIncome.toFixed(2)}`);
  }

  // Final wallet balance check
  const finalBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { other_balance: true },
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n✅ Entries Updated: ${totalUpdated}`);
  console.log(`✅ Entries Created: ${totalCreated}`);
  console.log(`💰 Total Wallet Adjustment: ₹${totalWalletAdjustment.toFixed(2)}`);
  console.log(`💰 Final Wallet Balance: ₹${Number(finalBalance?.other_balance || 0).toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ FIX COMPLETE');
  console.log('='.repeat(80));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
