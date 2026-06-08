import { prisma } from '../src/config/prisma.js';

/**
 * Script to fix double SPOT credit issue
 * 
 * Problem: Some users have extra amount in spot_balance that doesn't match ledger entries
 * Root Cause: Balance was updated twice (once when ledger created, once when wallet transaction created later)
 * 
 * This script:
 * 1. Identifies all affected users
 * 2. Calculates the extra amount
 * 3. Deducts the extra amount from spot_balance
 * 4. Creates correction ledger entries for audit trail
 */

async function fixDoubleSpotCredit() {
  console.log('🚀 Starting double SPOT credit fix...\n');

  try {
    // Find all affected users
    // Calculate expected balance: SPOT credits - KYC deductions - Admin debits (excluding corrections)
    const affectedUsers = await prisma.$queryRaw<Array<{
      user_id: bigint;
      display_id: string;
      total_ledger_credits: number;
      total_debits: number;
      expected_balance: number;
      spot_balance: number;
      extra_amount: number;
    }>>`
      SELECT 
        u.id as user_id,
        u.display_id,
        COALESCE(SUM(CASE WHEN le.commission_type = 'SPOT' AND le.amount > 0 THEN le.amount ELSE 0 END), 0)::numeric as total_ledger_credits,
        COALESCE(SUM(CASE WHEN (le.commission_type = 'FEE_DEDUCTION' OR (le.commission_type = 'ADMIN_OPS' AND le.amount < 0 AND (le.metadata->>'correction_type')::text IS NULL)) AND le.amount < 0 THEN ABS(le.amount) ELSE 0 END), 0)::numeric as total_debits,
        (COALESCE(SUM(CASE WHEN le.commission_type = 'SPOT' AND le.amount > 0 THEN le.amount ELSE 0 END), 0) - 
         COALESCE(SUM(CASE WHEN (le.commission_type = 'FEE_DEDUCTION' OR (le.commission_type = 'ADMIN_OPS' AND le.amount < 0 AND (le.metadata->>'correction_type')::text IS NULL)) AND le.amount < 0 THEN ABS(le.amount) ELSE 0 END), 0))::numeric as expected_balance,
        ub.spot_balance,
        (ub.spot_balance - (COALESCE(SUM(CASE WHEN le.commission_type = 'SPOT' AND le.amount > 0 THEN le.amount ELSE 0 END), 0) - 
         COALESCE(SUM(CASE WHEN (le.commission_type = 'FEE_DEDUCTION' OR (le.commission_type = 'ADMIN_OPS' AND le.amount < 0 AND (le.metadata->>'correction_type')::text IS NULL)) AND le.amount < 0 THEN ABS(le.amount) ELSE 0 END), 0)))::numeric as extra_amount
      FROM users u
      JOIN user_balances ub ON u.id = ub.user_id
      LEFT JOIN ledger_entries le ON le.receiver_user_id = u.id 
        AND (le.metadata->>'wallet_type')::text = 'spot_balance'
      WHERE u.id IN (
        SELECT DISTINCT le2.receiver_user_id
        FROM ledger_entries le2
        WHERE le2.commission_type = 'SPOT' 
          AND (le2.metadata->>'wallet_type')::text = 'spot_balance'
          AND le2.amount > 0
      )
      GROUP BY u.id, u.display_id, ub.spot_balance
      HAVING ub.spot_balance - (COALESCE(SUM(CASE WHEN le.commission_type = 'SPOT' AND le.amount > 0 THEN le.amount ELSE 0 END), 0) - 
         COALESCE(SUM(CASE WHEN (le.commission_type = 'FEE_DEDUCTION' OR (le.commission_type = 'ADMIN_OPS' AND le.amount < 0 AND (le.metadata->>'correction_type')::text IS NULL)) AND le.amount < 0 THEN ABS(le.amount) ELSE 0 END), 0)) > 0
      ORDER BY extra_amount DESC
    `;

    console.log(`✅ Found ${affectedUsers.length} affected users\n`);

    if (affectedUsers.length === 0) {
      console.log('No affected users found. Exiting.');
      return;
    }

    // Show summary before correction
    console.log('📊 Affected Users Summary:');
    console.log('─'.repeat(100));
    let totalExtra = 0;
    affectedUsers.forEach((user, index) => {
      const extra = Number(user.extra_amount);
      totalExtra += extra;
      console.log(`${(index + 1).toString().padStart(3)}. ${user.display_id.padEnd(10)} | Current: ₹${Number(user.spot_balance).toFixed(2).padStart(10)} | Credits: ₹${Number(user.total_ledger_credits).toFixed(2).padStart(10)} | Debits: ₹${Number(user.total_debits).toFixed(2).padStart(10)} | Expected: ₹${Number(user.expected_balance).toFixed(2).padStart(10)} | Extra: ₹${extra.toFixed(2).padStart(10)}`);
    });
    console.log('─'.repeat(80));
    console.log(`   Total Extra Amount: ₹${totalExtra.toFixed(2)}\n`);

    // Ask for confirmation (in production, you might want to add a flag)
    console.log('⚠️  This will deduct the extra amounts from affected users.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    let correctedCount = 0;
    let totalCorrectedAmount = 0;
    const errors: Array<{ user: string; error: string }> = [];

    for (const user of affectedUsers) {
      const extraAmount = Number(user.extra_amount);
      const correctBalance = Number(user.expected_balance); // Use expected_balance which accounts for debits

      try {
        console.log(`\n📊 Processing: ${user.display_id}`);
        console.log(`   Current Balance: ₹${user.spot_balance}`);
        console.log(`   Expected Balance: ₹${correctBalance}`);
        console.log(`   Extra Amount: ₹${extraAmount}`);

        // Generate idempotency key before transaction
        const correctionIdk = `correction:double-spot:${user.user_id}:${Date.now()}`;

        // Deduct extra amount from spot_balance in a transaction
        await prisma.$transaction(async (tx) => {
          // Update balance
          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET spot_balance = spot_balance - $1,
                 balance = balance - $1,
                 updated_at = now()
             WHERE user_id = $2`,
            extraAmount,
            user.user_id
          );

          // Create correction ledger entry for audit trail
          const correctionLedger = await tx.ledger_entries.create({
            data: {
              receiver_user_id: user.user_id,
              source_user_id: user.user_id,
              purchase_id: null,
              commission_type: 'ADMIN_OPS',
              amount: -extraAmount, // Negative for correction
              metadata: {
                wallet_type: 'spot_balance',
                admin_ops: true,
                reason: 'Correction: Removed duplicate SPOT credit',
                correction_type: 'double_credit_fix',
                original_balance: user.spot_balance,
                corrected_balance: correctBalance,
              } as any,
              idempotency_key: correctionIdk,
            },
          });

          // Create wallet transaction for the correction
          await tx.wallet_transactions.create({
            data: {
              receiver_user_id: user.user_id,
              ledger_entry_id: correctionLedger.id,
              amount: -extraAmount,
              idempotency_key: correctionIdk,
            },
          });
        });

        // Verify correction
        const updatedBalance = await prisma.user_balances.findUnique({
          where: { user_id: user.user_id },
          select: { spot_balance: true },
        });

        const newBalance = Number(updatedBalance?.spot_balance || 0);
        const difference = Math.abs(newBalance - correctBalance);

        if (difference < 0.01) {
          console.log(`   ✅ Corrected! New Balance: ₹${newBalance.toFixed(2)}`);
          correctedCount++;
          totalCorrectedAmount += extraAmount;
        } else {
          console.log(`   ⚠️  Warning: Balance mismatch. Expected: ₹${correctBalance}, Got: ₹${newBalance}`);
          errors.push({
            user: user.display_id,
            error: `Balance mismatch: expected ${correctBalance}, got ${newBalance}`,
          });
        }
      } catch (error: any) {
        console.error(`   ❌ Error correcting ${user.display_id}: ${error.message}`);
        errors.push({
          user: user.display_id,
          error: error.message,
        });
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Final Summary:`);
    console.log(`   Total Affected Users: ${affectedUsers.length}`);
    console.log(`   ✅ Successfully Corrected: ${correctedCount}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log(`   💰 Total Amount Corrected: ₹${totalCorrectedAmount.toFixed(2)}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.forEach(err => {
        console.log(`   - ${err.user}: ${err.error}`);
      });
    }
    
    console.log(`${'='.repeat(80)}\n`);

    // Verification query
    console.log('🔍 Verification: Checking if any users still have extra amounts...');
    const remainingIssues = await prisma.$queryRaw<Array<{
      display_id: string;
      extra_amount: number;
    }>>`
      SELECT 
        u.display_id,
        (ub.spot_balance - SUM(le.amount))::numeric as extra_amount
      FROM ledger_entries le
      JOIN users u ON le.receiver_user_id = u.id
      JOIN user_balances ub ON u.id = ub.user_id
      WHERE le.commission_type = 'SPOT' 
        AND (le.metadata->>'wallet_type')::text = 'spot_balance'
        AND le.amount > 0
      GROUP BY u.id, u.display_id, ub.spot_balance
      HAVING ub.spot_balance - SUM(le.amount) > 0
      ORDER BY extra_amount DESC
      LIMIT 10
    `;

    if (remainingIssues.length > 0) {
      console.log(`   ⚠️  Warning: ${remainingIssues.length} users still have extra amounts:`);
      remainingIssues.forEach(issue => {
        console.log(`      - ${issue.display_id}: ₹${Number(issue.extra_amount).toFixed(2)}`);
      });
    } else {
      console.log(`   ✅ All issues resolved!`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error during correction:`, error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixDoubleSpotCredit()
  .then(() => {
    console.log(`\n🎉 Correction completed successfully!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n💥 Correction failed:`, error);
    process.exit(1);
  });

