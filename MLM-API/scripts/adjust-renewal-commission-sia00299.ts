import { PrismaClient } from '@prisma/client';
import { calculateDailyPaise, paiseToRupees } from '../src/utils/paise.js';
import { daysInMonth } from '../src/utils/dateUtils.js';

// Production database connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

/**
 * Adjust existing ledger entry amount and update wallet balance
 * This updates the original commission entry from 50% to 100%
 */
async function adjustLedgerEntryAmount(params: {
  ledgerEntryId: bigint;
  receiverId: bigint;
  currentAmount: number;
  newAmount: number;
  adjustmentAmount: number;
  creditedAt: Date;
}) {
  const { ledgerEntryId, receiverId, currentAmount, newAmount, adjustmentAmount, creditedAt } = params;

  return prisma.$transaction(async (tx) => {
    // Per-user advisory lock for wallet concurrency safety
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1));',
      `user:${receiverId.toString()}`
    );

    // Get existing ledger entry
    const existingLedger = await tx.ledger_entries.findUnique({
      where: { id: ledgerEntryId },
      select: { 
        id: true, 
        amount: true, 
        metadata: true,
        idempotency_key: true,
      },
    });

    if (!existingLedger) {
      throw new Error(`Ledger entry ${ledgerEntryId} not found`);
    }

    // Check if already adjusted
    const metadata = existingLedger.metadata as any;
    if (metadata?.renewal_adjusted === true) {
      console.log(`    ⏭️  Ledger entry ${ledgerEntryId} already adjusted, skipping...`);
      return existingLedger;
    }

    // Update ledger entry amount (50% → 100%)
    const updatedLedger = await tx.ledger_entries.update({
      where: { id: ledgerEntryId },
      data: {
        amount: newAmount, // Update to 100%
        metadata: {
          ...metadata,
          renewal_adjusted: true,
          original_amount: currentAmount, // Keep original 50% for audit
          adjusted_amount: newAmount, // New 100% amount
          adjustment_amount: adjustmentAmount, // Additional 50% added
          adjustment_date: new Date().toISOString(),
          adjustment_reason: 'renewal_commission_correction',
        } as any,
      },
    });

    // Create wallet transaction for the adjustment amount (remaining 50%)
    const adjustmentIdempotencyKey = `adjustment:renewal:${ledgerEntryId}:${creditedAt.toISOString().split('T')[0]}`;
    
    // Check if adjustment wallet transaction already exists
    const existingAdjustment = await tx.wallet_transactions.findFirst({
      where: { idempotency_key: adjustmentIdempotencyKey },
    });

    if (!existingAdjustment) {
      await tx.wallet_transactions.create({
        data: {
          receiver_user_id: receiverId,
          ledger_entry_id: ledgerEntryId, // Link to same ledger entry
          amount: adjustmentAmount, // Additional 50%
          idempotency_key: adjustmentIdempotencyKey,
        },
      });
    }

    // Check if user_balances record exists
    const existingBalance = await tx.user_balances.findUnique({
      where: { user_id: receiverId },
    });
    if (!existingBalance) {
      await tx.user_balances.create({
        data: { user_id: receiverId, balance: 0, spot_balance: 0, other_balance: 0 },
      });
    } else {
      await tx.user_balances.update({
        where: { user_id: receiverId },
        data: { updated_at: new Date() },
      });
    }

    // Update wallet balance (add remaining 50% to other_balance)
    await tx.$executeRawUnsafe(
      'UPDATE user_balances SET balance = balance + $1, other_balance = other_balance + $1, updated_at = now() WHERE user_id = $2',
      adjustmentAmount,
      receiverId
    );

    return updatedLedger;
  });
}

/**
 * Adjust renewal commission amounts from 50% to 100% for SIA00299 ONLY
 * 
 * This script:
 * 1. Finds all MONTHLY commissions for renewal purchases where SIA00299 got 50% instead of 100%
 * 2. Updates the existing ledger entry amount from 50% to 100%
 * 3. Updates wallet balance by adding the remaining 50%
 * 4. Creates wallet transaction for audit trail
 * 5. Maintains original entry (no new entries, no confusion)
 * 
 * IMPORTANT: This script is for PRODUCTION database
 * Set PRODUCTION_DATABASE_URL environment variable before running
 */
async function adjustRenewalCommissionForSIA00299() {
  console.log('🚀 Starting Renewal Commission Adjustment Script for SIA00299 (PRODUCTION)...\n');
  console.log('⚠️  WARNING: This will UPDATE existing ledger entries in PRODUCTION database!\n');
  console.log('📅 Processing affected commissions from 18 Dec 2025 to 2 Jan 2026\n');

  // Get SIA00299 user ID
  const user = await prisma.users.findUnique({
    where: { display_id: 'SIA00299' },
    select: { id: true, name: true, display_id: true },
  });

  if (!user) {
    console.error('❌ User SIA00299 not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found user: ${user.display_id} (${user.name})\n`);

  // Find all affected commission entries for SIA00299
  const affectedCommissions = await prisma.$queryRaw<Array<{
    le_id: bigint;
    le_receiver_user_id: bigint;
    le_source_user_id: bigint;
    le_purchase_id: bigint;
    le_amount: number;
    le_credited_at: Date;
    le_metadata: any;
    p_amount: number;
    p_user_id: bigint;
    level: number;
    monthly_royalty_percent: number | null;
  }>>`
    SELECT 
      le.id as le_id,
      le.receiver_user_id as le_receiver_user_id,
      le.source_user_id as le_source_user_id,
      le.purchase_id as le_purchase_id,
      ABS(le.amount) as le_amount,
      le.credited_at as le_credited_at,
      le.metadata as le_metadata,
      p.amount as p_amount,
      p.user_id as p_user_id,
      (le.metadata::jsonb->>'level')::int as level,
      l.monthly_royalty_percent
    FROM ledger_entries le
    INNER JOIN purchases p ON le.purchase_id = p.id
    INNER JOIN users u_receiver ON le.receiver_user_id = u_receiver.id
    LEFT JOIN levels l ON (le.metadata::jsonb->>'level')::int = l.level
    WHERE u_receiver.display_id = 'SIA00299'
      AND p.is_renewal = true
      AND le.commission_type = 'MONTHLY'
      AND (le.metadata::jsonb->>'level')::int > 0
      AND DATE(le.credited_at) >= '2025-12-18'::date
      AND DATE(le.credited_at) <= '2026-01-02'::date
      AND (le.metadata::jsonb->>'renewal_adjusted')::text IS DISTINCT FROM 'true'
      AND ABS(le.amount) < (p.amount * 0.005 * 0.75)
    ORDER BY le.credited_at ASC, le.id ASC
  `;

  console.log(`📊 Found ${affectedCommissions.length} affected commission entries\n`);

  if (affectedCommissions.length === 0) {
    console.log('✅ No affected commissions found. Exiting...');
    await prisma.$disconnect();
    return;
  }

  // Show summary before processing
  // Since paid amount is 50%, expected is simply 2x
  const totalPaid = affectedCommissions.reduce((sum, comm) => sum + Number(comm.le_amount), 0);
  const totalExpected = totalPaid * 2; // 50% → 100%
  const totalShortfall = totalExpected - totalPaid;

  console.log('📋 Summary Before Adjustment:');
  console.log(`   Total Commissions: ${affectedCommissions.length}`);
  console.log(`   Total Paid (50%): ₹${totalPaid.toFixed(2)}`);
  console.log(`   Total Expected (100%): ₹${totalExpected.toFixed(2)}`);
  console.log(`   Total Shortfall: ₹${totalShortfall.toFixed(2)}\n`);

  // Ask for confirmation (in production, you might want to add a prompt)
  console.log('⚠️  Ready to process adjustments. Starting in 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  let totalAdjusted = 0;
  let totalAdjustmentAmount = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each affected commission
  for (const comm of affectedCommissions) {
    try {
      const receiverId = comm.le_receiver_user_id as unknown as bigint;
      const purchaseId = comm.le_purchase_id as unknown as bigint;
      const purchaseAmount = Number(comm.p_amount);
      const paidAmount = Number(comm.le_amount); // Current 50%
      const level = comm.level;
      const creditedAt = new Date(comm.le_credited_at);
      const ledgerEntryId = comm.le_id as unknown as bigint;

      // Since paid amount is 50%, expected amount is simply 2x the paid amount
      // This ensures we match exactly what was paid (no calculation differences)
      const expectedDaily = paidAmount * 2; // 50% → 100%
      
      // Adjustment amount = expected - paid (remaining 50%)
      const adjustmentAmount = expectedDaily - paidAmount;

      // Skip if adjustment is negligible (rounding differences)
      if (adjustmentAmount < 0.01) {
        console.log(`    ⏭️  Commission ${ledgerEntryId}: Adjustment too small (${adjustmentAmount.toFixed(4)}), skipping...`);
        totalSkipped++;
        continue;
      }

      // Get renewal user info for logging
      const renewalUser = await prisma.users.findUnique({
        where: { id: comm.p_user_id as unknown as bigint },
        select: { display_id: true, name: true },
      });

      const renewalUserDisplay = renewalUser?.display_id || comm.p_user_id.toString();
      const renewalUserName = renewalUser?.name || 'Unknown';

      console.log(`\n📝 Adjusting Commission ${ledgerEntryId}:`);
      console.log(`   Date: ${creditedAt.toISOString().split('T')[0]}`);
      console.log(`   Renewal User: ${renewalUserDisplay} (${renewalUserName})`);
      console.log(`   Purchase Amount: ₹${purchaseAmount.toFixed(2)}`);
      console.log(`   Level: ${level}`);
      console.log(`   Current Amount (50%): ₹${paidAmount.toFixed(2)}`);
      console.log(`   New Amount (100%): ₹${expectedDaily.toFixed(2)}`);
      console.log(`   Adjustment: ₹${adjustmentAmount.toFixed(2)}`);

      // Update existing ledger entry (50% → 100%)
      await adjustLedgerEntryAmount({
        ledgerEntryId,
        receiverId,
        currentAmount: paidAmount,
        newAmount: expectedDaily,
        adjustmentAmount,
        creditedAt,
      });

      console.log(`   ✅ Entry updated: ₹${paidAmount.toFixed(2)} → ₹${expectedDaily.toFixed(2)}`);
      console.log(`   ✅ Wallet balance adjusted: +₹${adjustmentAmount.toFixed(2)}`);

      totalAdjusted++;
      totalAdjustmentAmount += adjustmentAmount;

    } catch (error: any) {
      console.error(`   ❌ Error adjusting commission ${comm.le_id}:`, error.message);
      totalErrors++;
    }
  }

  // Get final wallet balance
  const finalBalance = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: { balance: true, other_balance: true },
  });

  // Print summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 ADJUSTMENT SUMMARY FOR SIA00299');
  console.log('='.repeat(80));
  console.log(`User: ${user.display_id} (${user.name})`);
  console.log(`Total Commissions Found: ${affectedCommissions.length}`);
  console.log(`Total Adjusted: ${totalAdjusted}`);
  console.log(`Total Skipped: ${totalSkipped}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Adjustment Amount: ₹${totalAdjustmentAmount.toFixed(2)}`);
  console.log(`\n💰 Wallet Balance After Adjustment:`);
  console.log(`   Total Balance: ₹${finalBalance?.balance || 0}`);
  console.log(`   Other Balance: ₹${finalBalance?.other_balance || 0}`);
  console.log('='.repeat(80));
  console.log('\n✅ Adjustment script completed for SIA00299!\n');
  console.log('📝 Note: Original ledger entries have been updated from 50% to 100%');
  console.log('📝 Note: Wallet balances have been adjusted accordingly');
  console.log('📝 Note: Metadata contains adjustment details for audit trail\n');

  await prisma.$disconnect();
}

// Run the script
adjustRenewalCommissionForSIA00299()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

