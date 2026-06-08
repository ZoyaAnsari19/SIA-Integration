/**
 * Credit SPOT Commissions from Purchases After 13 Jan 2026
 * 
 * Logic:
 * 1. Find all purchases (new, reinvestment, renew) after 13 Jan 2026
 * 2. Calculate SPOT commissions for each purchase (direct referrer + team uplines)
 * 3. Credit SPOT commissions to spot wallet via ledger entries
 * 4. Update user_balances.spot_balance
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { calculateCommissionPaise, paiseToRupees } from '../src/utils/paise.js';
import { isUserActive, getUplines, checkEligibility } from '../src/utils/business.js';
import { addLedgerAndWallet } from '../src/utils/wallet.js';
import { newIdempotencyKey } from '../src/utils/idempotency.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_2024@localhost:5436/mlm_commission?schema=public'
    }
  }
});

const CUTOFF_DATE = new Date('2026-01-13 23:59:59');

interface SpotCredit {
  purchaseId: bigint;
  buyerId: bigint;
  receiverId: bigint;
  amount: number;
  level: number;
  depth: number;
}

async function isReinvestment(purchaseId: bigint, userId: bigint): Promise<boolean> {
  const previousPurchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      id: { not: purchaseId },
      status: 'completed'
    },
    orderBy: { purchased_at: 'desc' },
    take: 1
  });
  
  return previousPurchases.length > 0;
}

async function hasActiveCourse(userId: bigint, date: Date): Promise<boolean> {
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      status: 'completed'
    }
  });

  for (const purchase of purchases) {
    const pkg = await prisma.packages.findUnique({ where: { id: purchase.package_id } });
    if (!pkg) continue;

    const totalEarned = await prisma.ledger_entries.aggregate({
      where: {
        receiver_user_id: userId,
        purchase_id: purchase.id,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
        amount: { gt: 0 }
      },
      _sum: { amount: true }
    });

    const totalEarnedAmount = Number(totalEarned._sum.amount || 0);
    const twoXInvestment = Number(purchase.amount) * 2;

    if (totalEarnedAmount < twoXInvestment) {
      return true;
    }
  }

  return false;
}

async function calculateAndCreditSpotForPurchase(purchase: any, dryRun: boolean = false): Promise<SpotCredit[]> {
  const credits: SpotCredit[] = [];
  const buyerId = purchase.user_id as unknown as bigint;
  const purchaseId = purchase.id as unknown as bigint;
  
  const pkg = await prisma.packages.findUnique({ where: { id: purchase.package_id } });
  if (!pkg) return credits;

  // Get buyer's referrer
  const buyer = await prisma.users.findUnique({
    where: { id: buyerId },
    select: { referrer_user_id: true }
  });

  if (!buyer?.referrer_user_id) return credits;

  const referrerId = buyer.referrer_user_id as unknown as bigint;

  // 1. Direct referrer SPOT (Level 0)
  const referrerHasActive = await hasActiveCourse(referrerId, new Date());
  if (referrerHasActive && pkg.direct_spot_percent) {
    const spotPercent = Number(pkg.direct_spot_percent);
    const spotPaise = calculateCommissionPaise(Number(purchase.amount), spotPercent);
    const spotAmount = paiseToRupees(spotPaise);
    
    if (spotAmount > 0) {
      credits.push({
        purchaseId,
        buyerId,
        receiverId: referrerId,
        amount: spotAmount,
        level: 0,
        depth: 1
      });
    }
  }

  // 2. Team SPOT (Level 1-9)
  const uplines = await getUplines(buyerId, 9);
  const isReinvest = await isReinvestment(purchaseId, buyerId);

  for (const { ancestor_id, depth } of uplines) {
    if (depth <= 1) continue; // Direct referrer already handled

    const levelForCommission = depth - 1;
    const eligible = await checkEligibility(ancestor_id, levelForCommission);
    if (!eligible) continue;

    const uplineHasActive = await hasActiveCourse(ancestor_id, new Date());
    if (!uplineHasActive) continue;

    // Get spot percent from levels table
    const levelData = await prisma.levels.findUnique({ where: { level: levelForCommission } });
    let spotPercent = 0;
    
    if (levelData?.spot_commission_percent) {
      spotPercent = Number(levelData.spot_commission_percent);
    } else {
      const spotRule = await prisma.commission_rules.findFirst({ 
        where: { type: 'LEVEL_SPOT', level: levelForCommission } 
      });
      spotPercent = Number(spotRule?.percent ?? 0);
    }

    if (spotPercent > 0) {
      let teamSpotAmount = (Number(purchase.amount) * spotPercent) / 100;

      // Apply 50% reduction for Level 1+ (depth 2+) on reinvestments
      if (isReinvest && depth >= 2) {
        teamSpotAmount = teamSpotAmount * 0.5;
      }

      if (teamSpotAmount > 0) {
        credits.push({
          purchaseId,
          buyerId,
          receiverId: ancestor_id,
          amount: teamSpotAmount,
          level: levelForCommission,
          depth
        });
      }
    }
  }

  // Credit SPOT commissions
  if (!dryRun) {
    for (const credit of credits) {
      // Check if already credited (idempotency)
      const idempotencyKey = `spot:${purchaseId}:${credit.receiverId}:${credit.level}`;
      
      const existing = await prisma.ledger_entries.findFirst({
        where: { idempotency_key: idempotencyKey }
      });

      if (existing) {
        console.log(`   ⚠️  SPOT already credited: ${idempotencyKey}`);
        continue;
      }

      try {
        await addLedgerAndWallet({
          receiverId: credit.receiverId,
          sourceId: buyerId,
          purchaseId: purchaseId,
          amount: credit.amount,
          type: 'SPOT',
          metadata: { level: credit.level, depth: credit.depth },
          idempotencyKey: idempotencyKey,
        });
        console.log(`   ✅ Credited ₹${credit.amount.toFixed(2)} SPOT to user ${credit.receiverId} (Level ${credit.level})`);
      } catch (error: any) {
        console.error(`   ❌ Error crediting SPOT to user ${credit.receiverId}:`, error.message);
      }
    }
  }

  return credits;
}

async function main() {
  console.log('='.repeat(80));
  console.log('💰 Credit SPOT Commissions from Purchases After 13 Jan 2026');
  console.log('='.repeat(80));
  console.log();

  try {
    // Find all purchases after 13 Jan 2026
    console.log('📦 Finding purchases after 13 Jan 2026...');
    const purchases = await prisma.purchases.findMany({
      where: {
        purchased_at: { gt: CUTOFF_DATE },
        status: 'completed'
      },
      orderBy: { purchased_at: 'asc' }
    });

    console.log(`✅ Found ${purchases.length} purchases after 13 Jan 2026`);
    console.log();

    if (purchases.length === 0) {
      console.log('✅ No purchases found. Nothing to credit.');
      return;
    }

    // Process each purchase
    console.log('🔄 Processing purchases and crediting SPOT commissions...');
    console.log();

    let totalCredits = 0;
    let totalAmount = 0;

    for (let i = 0; i < purchases.length; i++) {
      const purchase = purchases[i];
      console.log(`[${i + 1}/${purchases.length}] Processing Purchase ID: ${purchase.id} (User: ${purchase.user_id}, Amount: ₹${purchase.amount})`);
      
      const credits = await calculateAndCreditSpotForPurchase(purchase, false);
      
      totalCredits += credits.length;
      totalAmount += credits.reduce((sum, c) => sum + c.amount, 0);
      
      console.log(`   💰 Credited ${credits.length} SPOT commissions (Total: ₹${credits.reduce((sum, c) => sum + c.amount, 0).toFixed(2)})`);
      console.log();
    }

    console.log('='.repeat(80));
    console.log('✅ Completed!');
    console.log('='.repeat(80));
    console.log();
    console.log('📊 Summary:');
    console.log(`   Total purchases processed: ${purchases.length}`);
    console.log(`   Total SPOT credits: ${totalCredits}`);
    console.log(`   Total amount credited: ₹${totalAmount.toFixed(2)}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
