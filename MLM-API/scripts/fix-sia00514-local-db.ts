#!/usr/bin/env tsx
/**
 * Fix SIA00514 user's commissions in LOCAL DB
 * Connection: postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission
 * Fix all entries from Jan 24, 2026 to today with correct amounts
 */

import { PrismaClient } from '@prisma/client';
import { daysInMonth } from '../src/utils/dateUtils.js';
import { 
  rupeesToPaise, 
  paiseToRupees, 
  calculateDailyPaise,
} from '../src/utils/paise.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';

// Use local DB connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission',
    },
  },
});

const USER_DISPLAY_ID = 'SIA00514';
const AFFECTED_PURCHASE_IDS = [1779, 1778, 1777];
const GLOBAL_MONTHLY_PER_ID = 6.25;

async function main() {
  console.log('='.repeat(80));
  console.log('🔧 FIXING SIA00514 COMMISSIONS - Local DB');
  console.log('='.repeat(80));
  console.log('📡 Database: postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission\n');

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

  console.log(`✅ User: ${user.display_id} (${user.name})`);

  // Get purchases
  const purchases = await prisma.purchases.findMany({
    where: {
      id: { in: AFFECTED_PURCHASE_IDS.map((id) => BigInt(id)) as any },
    },
  });

  if (purchases.length === 0) {
    console.log('\n❌ No purchases found!');
    await prisma.$disconnect();
    return;
  }

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

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let totalUpdated = 0;
  let totalDeleted = 0;
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

    // Generate dates from NEXT day after purchase to today
    const dates: Date[] = [];
    const nextDay = new Date(purchasedAt);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    
    const currentDate = new Date(nextDay);
    while (currentDate <= today) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`   Processing ${dates.length} days (${nextDay.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]})...`);

    let purchaseTotalAdjustment = 0;

    for (const date of dates) {
      const dateStr = date.toISOString().slice(0, 10);
      const daysInMonthForDate = daysInMonth(date);
      const isLastDayOfMonth = date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

      // Count new users up to this date
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const newUsers = await prisma.purchases.findMany({
        where: {
          status: 'completed',
          is_renewal: false,
          purchased_at: {
            gt: purchasedAt,
            lte: dateEnd,
          },
          NOT: { user_id: user.id },
        } as any,
        select: { user_id: true },
        distinct: ['user_id'],
      });

      const newUsersCount = newUsers.length;
      const expectedUsedIds = Math.min(effectiveGlobalIds + newUsersCount, packageGlobalIds);

      // Calculate expected GLOBAL_HELPING
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

      // Calculate expected SELF
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

      // Handle GLOBAL_HELPING entries - DELETE ALL DUPLICATES FIRST
      const globalIdk = `daily:global:${purchase.id}:${dateStr}`;
      const existingGlobals = await prisma.ledger_entries.findMany({
        where: { idempotency_key: globalIdk },
        orderBy: { id: 'asc' },
      });

      if (existingGlobals.length > 1) {
        // Delete all duplicates, keep first one
        console.log(`   🗑️  ${dateStr} GLOBAL: Deleting ${existingGlobals.length - 1} duplicate(s)`);
        for (let i = 1; i < existingGlobals.length; i++) {
          // Delete wallet transactions
          const walletTxns = await prisma.wallet_transactions.findMany({
            where: { ledger_entry_id: existingGlobals[i].id },
          });
          for (const wtxn of walletTxns) {
            await prisma.wallet_transactions.delete({ where: { id: wtxn.id } });
          }
          await prisma.ledger_entries.delete({ where: { id: existingGlobals[i].id } });
          totalDeleted++;
        }
      }

      const existingGlobal = existingGlobals[0];

      if (existingGlobal) {
        const existingAmount = Number(existingGlobal.amount);
        const existingMetadata = existingGlobal.metadata as any;
        const existingUsedIds = existingMetadata?.used_ids || 0;
        const difference = expectedGlobalAmount - existingAmount;
        
        if (Math.abs(difference) > 0.01 || existingUsedIds !== expectedUsedIds) {
          console.log(`   📝 ${dateStr} GLOBAL: Updating ₹${existingAmount.toFixed(2)} → ₹${expectedGlobalAmount.toFixed(2)}`);
          console.log(`      Used IDs: ${existingUsedIds} → ${expectedUsedIds} (diff: ${expectedUsedIds - existingUsedIds})`);
          
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

          // Update wallet transaction
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
          console.log(`   ✅ ${dateStr} GLOBAL: Already correct (₹${existingAmount.toFixed(2)}, Used IDs: ${expectedUsedIds})`);
        }
      } else {
        // Create missing entry
        console.log(`   ➕ ${dateStr} GLOBAL: Creating entry (₹${expectedGlobalAmount.toFixed(2)}, Used IDs: ${expectedUsedIds})`);
        
        const creditedAt = new Date(date);
        creditedAt.setHours(6, 24, 47, 0);

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

        await prisma.purchases.update({
          where: { id: purchase.id },
          data: { income: { increment: expectedGlobalAmount } } as any,
        });

        totalCreated++;
        purchaseTotalAdjustment += expectedGlobalAmount;
      }

      // Handle SELF entries - DELETE DUPLICATES
      const selfIdk = `daily:self:${purchase.id}:${dateStr}`;
      const existingSelfs = await prisma.ledger_entries.findMany({
        where: { idempotency_key: selfIdk },
        orderBy: { id: 'asc' },
      });

      if (existingSelfs.length > 1) {
        console.log(`   🗑️  ${dateStr} SELF: Deleting ${existingSelfs.length - 1} duplicate(s)`);
        for (let i = 1; i < existingSelfs.length; i++) {
          const walletTxns = await prisma.wallet_transactions.findMany({
            where: { ledger_entry_id: existingSelfs[i].id },
          });
          for (const wtxn of walletTxns) {
            await prisma.wallet_transactions.delete({ where: { id: wtxn.id } });
          }
          await prisma.ledger_entries.delete({ where: { id: existingSelfs[i].id } });
          totalDeleted++;
        }
      }

      const existingSelf = existingSelfs[0];

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

    // Recalculate total income
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

  // Final wallet balance
  const finalBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { other_balance: true },
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n✅ Entries Updated: ${totalUpdated}`);
  console.log(`✅ Entries Created: ${totalCreated}`);
  console.log(`🗑️  Duplicate Entries Deleted: ${totalDeleted}`);
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
