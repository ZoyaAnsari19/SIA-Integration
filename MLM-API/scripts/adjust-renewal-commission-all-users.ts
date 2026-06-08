import { PrismaClient } from '@prisma/client';

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
 * Adjust renewal commission amounts from 50% to 100% for ALL affected users
 * 
 * This script:
 * 1. Finds all affected users who got 50% instead of 100% on renewal purchases
 * 2. For each user, updates existing ledger entries from 50% to 100%
 * 3. Updates wallet balance by adding the remaining 50%
 * 4. Creates wallet transactions for audit trail
 * 5. Maintains original entry (no new entries, no confusion)
 * 
 * IMPORTANT: This script is for PRODUCTION database
 * Set PRODUCTION_DATABASE_URL environment variable before running
 */
async function adjustRenewalCommissionForAllUsers() {
  console.log('🚀 Starting Renewal Commission Adjustment Script for ALL Affected Users (PRODUCTION)...\n');
  console.log('⚠️  WARNING: This will UPDATE existing ledger entries in PRODUCTION database!\n');
  console.log('📅 Processing affected commissions from 18 Dec 2025 to 2 Jan 2026\n');

  // Find all affected users
  const affectedUsers = await prisma.$queryRaw<Array<{
    user_id: bigint;
    display_id: string;
    name: string;
    total_commissions: number;
    total_shortfall: number;
  }>>`
    SELECT 
      u.id as user_id,
      u.display_id,
      u.name,
      COUNT(le.id)::int as total_commissions,
      ROUND(SUM(ABS(le.amount))::numeric, 2) as total_shortfall
    FROM ledger_entries le
    INNER JOIN purchases p ON le.purchase_id = p.id
    INNER JOIN users u ON le.receiver_user_id = u.id
    WHERE p.is_renewal = true
      AND le.commission_type = 'MONTHLY'
      AND (le.metadata::jsonb->>'level')::int > 0
      AND DATE(le.credited_at) >= '2025-12-18'::date
      AND DATE(le.credited_at) <= '2026-01-02'::date
      AND (le.metadata::jsonb->>'renewal_adjusted')::text IS DISTINCT FROM 'true'
      AND ABS(le.amount) < (p.amount * 0.005 * 0.75)
    GROUP BY u.id, u.display_id, u.name
    ORDER BY total_shortfall DESC
  `;

  console.log(`📊 Found ${affectedUsers.length} affected users\n`);

  if (affectedUsers.length === 0) {
    console.log('✅ No affected users found. Exiting...');
    await prisma.$disconnect();
    return;
  }

  // Show summary of affected users
  console.log('📋 Affected Users Summary:');
  console.log('-'.repeat(80));
  console.log('User ID          | Name                      | Commissions | Shortfall');
  console.log('-'.repeat(80));
  for (const user of affectedUsers) {
    console.log(
      `${user.display_id.padEnd(16)} | ${(user.name || 'Unknown').padEnd(25)} | ${user.total_commissions.toString().padStart(11)} | ₹${user.total_shortfall.toFixed(2).padStart(10)}`
    );
  }
  console.log('-'.repeat(80));
  console.log(`Total Users: ${affectedUsers.length}`);
  console.log(`Total Shortfall: ₹${affectedUsers.reduce((sum, u) => sum + Number(u.total_shortfall), 0).toFixed(2)}\n`);

  // Ask for confirmation
  console.log('⚠️  Ready to process adjustments for ALL users. Starting in 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  let totalUsersProcessed = 0;
  let totalUsersSkipped = 0;
  let totalUsersErrors = 0;
  let totalCommissionsAdjusted = 0;
  let totalAdjustmentAmount = 0;

  // Process each affected user
  for (const userInfo of affectedUsers) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`👤 Processing User: ${userInfo.display_id} (${userInfo.name})`);
      console.log(`${'='.repeat(80)}`);

      // Find all affected commission entries for this user
      const affectedCommissions = await prisma.$queryRawUnsafe<Array<{
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
      }>>(`
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
        WHERE u_receiver.display_id = '${userInfo.display_id}'
          AND p.is_renewal = true
          AND le.commission_type = 'MONTHLY'
          AND (le.metadata::jsonb->>'level')::int > 0
          AND DATE(le.credited_at) >= '2025-12-18'::date
          AND DATE(le.credited_at) <= '2026-01-02'::date
          AND (le.metadata::jsonb->>'renewal_adjusted')::text IS DISTINCT FROM 'true'
          AND ABS(le.amount) < (p.amount * 0.005 * 0.75)
        ORDER BY le.credited_at ASC, le.id ASC
      `);

      if (affectedCommissions.length === 0) {
        console.log(`   ⏭️  No affected commissions found for ${userInfo.display_id}, skipping...`);
        totalUsersSkipped++;
        continue;
      }

      console.log(`   📊 Found ${affectedCommissions.length} affected commission entries`);

      let userCommissionsAdjusted = 0;
      let userAdjustmentAmount = 0;
      let userErrors = 0;

      // Process each affected commission for this user
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
          const expectedDaily = paidAmount * 2; // 50% → 100%
          
          // Adjustment amount = expected - paid (remaining 50%)
          const adjustmentAmount = expectedDaily - paidAmount;

          // Skip if adjustment is negligible (rounding differences)
          if (adjustmentAmount < 0.01) {
            continue;
          }

          // Get renewal user info for logging
          const renewalUser = await prisma.users.findUnique({
            where: { id: comm.p_user_id as unknown as bigint },
            select: { display_id: true, name: true },
          });

          const renewalUserDisplay = renewalUser?.display_id || comm.p_user_id.toString();
          const renewalUserName = renewalUser?.name || 'Unknown';

          console.log(`   📝 Adjusting Commission ${ledgerEntryId}:`);
          console.log(`      Date: ${creditedAt.toISOString().split('T')[0]}`);
          console.log(`      Renewal User: ${renewalUserDisplay} (${renewalUserName})`);
          console.log(`      Purchase Amount: ₹${purchaseAmount.toFixed(2)}`);
          console.log(`      Level: ${level}`);
          console.log(`      Current Amount (50%): ₹${paidAmount.toFixed(2)}`);
          console.log(`      New Amount (100%): ₹${expectedDaily.toFixed(2)}`);
          console.log(`      Adjustment: ₹${adjustmentAmount.toFixed(2)}`);

          // Update existing ledger entry (50% → 100%)
          await adjustLedgerEntryAmount({
            ledgerEntryId,
            receiverId,
            currentAmount: paidAmount,
            newAmount: expectedDaily,
            adjustmentAmount,
            creditedAt,
          });

          console.log(`      ✅ Entry updated: ₹${paidAmount.toFixed(2)} → ₹${expectedDaily.toFixed(2)}`);
          console.log(`      ✅ Wallet balance adjusted: +₹${adjustmentAmount.toFixed(2)}`);

          userCommissionsAdjusted++;
          userAdjustmentAmount += adjustmentAmount;

        } catch (error: any) {
          console.error(`      ❌ Error adjusting commission ${comm.le_id}:`, error.message);
          userErrors++;
        }
      }

      // Get final wallet balance for this user
      const finalBalance = await prisma.user_balances.findUnique({
        where: { user_id: userInfo.user_id },
        select: { balance: true, other_balance: true },
      });

      console.log(`\n   ✅ User ${userInfo.display_id} completed:`);
      console.log(`      Commissions Adjusted: ${userCommissionsAdjusted}`);
      console.log(`      Total Adjustment: ₹${userAdjustmentAmount.toFixed(2)}`);
      console.log(`      Errors: ${userErrors}`);
      console.log(`      Wallet Balance: ₹${finalBalance?.balance || 0} (Other: ₹${finalBalance?.other_balance || 0})`);

      totalUsersProcessed++;
      totalCommissionsAdjusted += userCommissionsAdjusted;
      totalAdjustmentAmount += userAdjustmentAmount;

      if (userErrors > 0) {
        totalUsersErrors++;
      }

    } catch (error: any) {
      console.error(`\n   ❌ Error processing user ${userInfo.display_id}:`, error.message);
      totalUsersErrors++;
    }
  }

  // Print final summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL ADJUSTMENT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Affected Users: ${affectedUsers.length}`);
  console.log(`Total Users Processed: ${totalUsersProcessed}`);
  console.log(`Total Users Skipped: ${totalUsersSkipped}`);
  console.log(`Total Users Errors: ${totalUsersErrors}`);
  console.log(`Total Commissions Adjusted: ${totalCommissionsAdjusted}`);
  console.log(`Total Adjustment Amount: ₹${totalAdjustmentAmount.toFixed(2)}`);
  console.log('='.repeat(80));
  console.log('\n✅ Adjustment script completed for ALL affected users!\n');
  console.log('📝 Note: Original ledger entries have been updated from 50% to 100%');
  console.log('📝 Note: Wallet balances have been adjusted accordingly');
  console.log('📝 Note: Metadata contains adjustment details for audit trail\n');

  await prisma.$disconnect();
}

// Run the script
adjustRenewalCommissionForAllUsers()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

