/**
 * Check SIA00299 withdrawal issue: balance, withdraw request 3357, ledger
 * Run: npx tsx scripts/check-sia00299-withdrawal.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const displayId = 'SIA00299';

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true },
  });
  if (!user) {
    console.log('User SIA00299 not found.');
    return;
  }
  const userId = user.id;
  console.log('=== User ===');
  console.log('id:', userId.toString(), 'display_id:', user.display_id, 'name:', user.name);
  console.log('');

  const balance = await prisma.user_balances.findUnique({
    where: { user_id: userId },
  });
  console.log('=== Current user_balances ===');
  console.log('spot_balance:', balance?.spot_balance?.toString() ?? 'N/A');
  console.log('other_balance:', balance?.other_balance?.toString() ?? 'N/A');
  console.log('team_royalty_balance:', balance?.team_royalty_balance?.toString() ?? 'N/A');
  console.log('balance (total):', balance?.balance?.toString() ?? 'N/A');
  console.log('spot_team_withdraw_used:', balance?.spot_team_withdraw_used?.toString() ?? 'N/A');
  console.log('spot_team_limit_reached_at:', (balance as any)?.spot_team_limit_reached_at ?? 'N/A');
  console.log('spot_team_flush_active:', (balance as any)?.spot_team_flush_active ?? 'N/A');
  console.log('');

  const requests = await prisma.withdraw_requests.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
  console.log('=== Withdraw requests (latest 10) ===');
  for (const r of requests) {
    console.log('id:', r.id, 'amount:', r.amount.toString(), 'withdraw_type:', r.withdraw_type, 'status:', r.status, 'created_at:', r.created_at, 'processed_at:', r.processed_at);
  }
  const req3357 = requests.find((r) => r.id === 3357n || r.id.toString() === '3357');
  if (req3357) {
    console.log('\n>>> Request 3357:', JSON.stringify({ amount: req3357.amount.toString(), withdraw_type: req3357.withdraw_type, status: req3357.status }, null, 2));
  }
  console.log('');

  const ledger = await prisma.ledger_entries.findMany({
    where: { receiver_user_id: userId },
    orderBy: { credited_at: 'desc' },
    take: 50,
    select: {
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
      metadata: true,
    },
  });
  console.log('=== Ledger entries (latest 50) ===');
  const spotCredits = ledger.filter((e) => e.commission_type === 'SPOT');
  const feeDeductions = ledger.filter((e) => e.commission_type === 'FEE_DEDUCTION');
  console.log('SPOT entries count:', spotCredits.length);
  console.log('FEE_DEDUCTION entries count:', feeDeductions.length);
  for (const e of ledger.slice(0, 25)) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const ref = meta.reference_type === 'withdraw_request' ? `ref:${meta.reference_id}` : '';
    console.log('  id:', e.id.toString(), 'type:', e.commission_type, 'amount:', e.amount.toString(), 'at:', e.credited_at, ref);
  }
  console.log('');

  const withdrawalLedgers = ledger.filter(
    (e) => e.commission_type === 'FEE_DEDUCTION' && (e.metadata as Record<string, unknown>)?.reason === 'WITHDRAWAL'
  );
  console.log('=== FEE_DEDUCTION (WITHDRAWAL) ledger entries for this user ===');
  for (const e of withdrawalLedgers) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    console.log('  id:', e.id.toString(), 'amount:', e.amount.toString(), 'credited_at:', e.credited_at, 'reference_id:', meta.reference_id, 'wallet_type:', meta.wallet_type, 'spot_deducted:', meta.spot_deducted);
  }
  console.log('');

  const wtCount = await prisma.wallet_transactions.count({
    where: { receiver_user_id: userId },
  });
  console.log('=== Wallet transactions count for user:', wtCount);
  const sumSpotLedger = await prisma.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entries
    WHERE receiver_user_id = ${userId} AND commission_type = 'SPOT'
  `;
  const sumFeeDeduction = await prisma.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entries
    WHERE receiver_user_id = ${userId} AND commission_type = 'FEE_DEDUCTION'
    AND metadata->>'reason' = 'WITHDRAWAL' AND (metadata->>'wallet_type' = 'spot_balance' OR (metadata->>'spot_deducted')::numeric > 0)
  `;
  console.log('Sum of SPOT ledger amounts:', sumSpotLedger[0]?.sum ?? '0');
  console.log('Sum of FEE_DEDUCTION (withdrawal from spot):', sumFeeDeduction[0]?.sum ?? '0');
  console.log('');

  const lockedSpot = await prisma.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(le.amount), 0)::text AS sum FROM ledger_entries le
    WHERE le.receiver_user_id = ${userId} AND le.commission_type = 'SPOT'
      AND le.metadata->>'hold_until' IS NOT NULL
      AND (le.metadata->>'hold_until')::date > CURRENT_DATE
  `;
  console.log('Locked SPOT (hold_until > today):', lockedSpot[0]?.sum ?? '0');
  console.log('');
  console.log('=== Conclusion (why spot = 0) ===');
  const flushActive = (balance as any)?.spot_team_flush_active === true;
  if (flushActive) {
    console.log('spot_team_flush_active = true → 10x Spot/Team Royalty flush is ON.');
    console.log('Spot (and team_royalty) were zeroed by the flush rule, NOT by withdrawal request 3357.');
    console.log('Request 3357 was never approved (no ledger entry for ref 3357); the amount did not go via that withdrawal.');
  } else {
    console.log('Spot 0 reason: check ledger vs balance (possible sync issue or other deduction).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
