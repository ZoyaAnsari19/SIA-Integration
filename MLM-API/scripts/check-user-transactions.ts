import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

function maskAccountDetails(value: string | null | undefined) {
  if (!value) return null;
  // Keep only last 4 digits/characters visible
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '****';
  return `${'*'.repeat(Math.min(12, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function fmtINR(n: any) {
  const num = Number(n ?? 0);
  return `₹${num.toFixed(2)}`;
}

async function main() {
  const displayId = (process.argv[2] || process.env.DISPLAY_ID || 'SIA00299').trim();
  const take = Number(process.env.TAKE || 50);

  console.log('============================================================');
  console.log(`🔎 User Transactions: ${displayId}`);
  console.log('============================================================\n');

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { id: true, display_id: true, name: true, phone: true, created_at: true },
  });

  if (!user) {
    console.log(`❌ User not found for display_id=${displayId}`);
    process.exitCode = 1;
    return;
  }

  console.log(`👤 User: ${user.display_id} | id=${user.id} | name=${user.name || 'N/A'} | phone=${user.phone || 'N/A'} | created=${user.created_at.toISOString()}\n`);

  const balances = await prisma.user_balances.findUnique({
    where: { user_id: user.id },
    select: {
      balance: true,
      spot_balance: true,
      other_balance: true,
      team_royalty_balance: true,
      spot_team_withdraw_used: true,
      spot_team_limit_reached_at: true,
      spot_team_flush_active: true,
      updated_at: true,
    },
  });

  console.log('💰 Balances:');
  console.log(`   total=${fmtINR(balances?.balance)} | spot=${fmtINR(balances?.spot_balance)} | other=${fmtINR(balances?.other_balance)} | team_royalty=${fmtINR(balances?.team_royalty_balance)}`);
  console.log(`   spot_team_withdraw_used=${fmtINR(balances?.spot_team_withdraw_used)} | limit_reached_at=${balances?.spot_team_limit_reached_at?.toISOString() || 'N/A'} | flush_active=${balances?.spot_team_flush_active ? 'YES' : 'NO'}`);
  console.log(`   updated_at=${balances?.updated_at?.toISOString() || 'N/A'}\n`);

  // Ledger entries credited to this user (what wallet is based on)
  const ledger = await prisma.ledger_entries.findMany({
    where: { receiver_user_id: user.id },
    orderBy: { credited_at: 'desc' },
    take,
    select: {
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
      source_user_id: true,
      purchase_id: true,
      idempotency_key: true,
      metadata: true,
    },
  });

  console.log(`📒 Ledger entries (latest ${Math.min(take, ledger.length)}):`);
  for (const e of ledger.slice(0, 20)) {
    const md: any = e.metadata || {};
    const walletType = md.wallet_type || 'N/A';
    const fromWallet = md.from_wallet || null;
    const spotDed = md.spot_deducted != null ? fmtINR(md.spot_deducted) : null;
    const otherDed = md.other_deducted != null ? fmtINR(md.other_deducted) : null;
    const tag = e.idempotency_key?.startsWith('reversal:expired:') ? 'REVERSAL' : '';
    console.log(
      `   #${e.id} ${String(e.commission_type).padEnd(13)} ${fmtINR(e.amount).padStart(12)} | ${e.credited_at.toISOString()} | src=${e.source_user_id} | purchase=${e.purchase_id ?? 'N/A'} | wallet_type=${walletType}` +
        (fromWallet ? ` | from_wallet=${fromWallet}` : '') +
        (spotDed || otherDed ? ` | deducted(spot=${spotDed || fmtINR(0)}, other=${otherDed || fmtINR(0)})` : '') +
        (tag ? ` | ${tag}` : '')
    );
  }
  if (ledger.length > 20) console.log(`   ... (${ledger.length - 20} more)\n`);
  else console.log('');

  // Wallet transactions (audit trail linked to ledger entries)
  const walletTxns = await prisma.wallet_transactions.findMany({
    where: { receiver_user_id: user.id },
    orderBy: { created_at: 'desc' },
    take,
    select: { id: true, amount: true, created_at: true, ledger_entry_id: true, idempotency_key: true },
  });

  console.log(`💳 Wallet transactions (latest ${Math.min(take, walletTxns.length)}):`);
  for (const w of walletTxns.slice(0, 20)) {
    console.log(`   #${w.id} ${fmtINR(w.amount).padStart(12)} | ${w.created_at.toISOString()} | ledger_id=${w.ledger_entry_id ?? 'N/A'} | idem=${w.idempotency_key ?? 'N/A'}`);
  }
  if (walletTxns.length > 20) console.log(`   ... (${walletTxns.length - 20} more)\n`);
  else console.log('');

  // Fee transactions (if any)
  const feeTxns = await prisma.fee_transactions.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    take,
    select: { id: true, rule_code: true, amount: true, transaction_type: true, reference_id: true, reference_type: true, created_at: true },
  });

  console.log(`🧾 Fee transactions (latest ${Math.min(take, feeTxns.length)}):`);
  for (const f of feeTxns.slice(0, 20)) {
    console.log(
      `   #${f.id} ${String(f.transaction_type).padEnd(14)} ${fmtINR(f.amount).padStart(12)} | ${f.created_at.toISOString()} | rule=${f.rule_code} | ref=${f.reference_type || 'N/A'}:${f.reference_id ?? 'N/A'}`
    );
  }
  if (feeTxns.length > 20) console.log(`   ... (${feeTxns.length - 20} more)\n`);
  else console.log('');

  // Withdraw requests
  const withdraws = await prisma.withdraw_requests.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    take,
    select: {
      id: true,
      withdraw_type: true,
      amount: true,
      payment_method: true,
      account_details: true,
      status: true,
      remarks: true,
      reference_id: true,
      processed_at: true,
      created_at: true,
    },
  });

  console.log(`🏦 Withdraw requests (latest ${Math.min(take, withdraws.length)}):`);
  for (const wr of withdraws.slice(0, 20)) {
    console.log(
      `   #${wr.id} type=${wr.withdraw_type} amount=${fmtINR(wr.amount)} status=${wr.status} | ${wr.created_at.toISOString()} | method=${wr.payment_method} | acct=${maskAccountDetails(wr.account_details) || 'N/A'} | ref=${wr.reference_id || 'N/A'}` +
        (wr.processed_at ? ` | processed_at=${wr.processed_at.toISOString()}` : '') +
        (wr.remarks ? ` | remarks=${wr.remarks}` : '')
    );
  }
  if (withdraws.length > 20) console.log(`   ... (${withdraws.length - 20} more)\n`);
  else console.log('');

  // Wallet transfers (both directions)
  const transfers = await prisma.wallet_transfers.findMany({
    where: { OR: [{ from_user_id: user.id }, { to_user_id: user.id }] },
    orderBy: { created_at: 'desc' },
    take,
    select: { id: true, from_user_id: true, to_user_id: true, amount: true, tax_amount: true, net_amount: true, status: true, remarks: true, created_at: true },
  });

  console.log(`🔁 Wallet transfers (latest ${Math.min(take, transfers.length)}):`);
  for (const t of transfers.slice(0, 20)) {
    const dir = t.from_user_id === user.id ? 'OUT' : 'IN ';
    console.log(
      `   #${t.id} ${dir} ${t.from_user_id} → ${t.to_user_id} | amount=${fmtINR(t.amount)} tax=${fmtINR(t.tax_amount)} net=${fmtINR(t.net_amount)} | ${t.created_at.toISOString()} | status=${t.status}` +
        (t.remarks ? ` | remarks=${t.remarks}` : '')
    );
  }
  if (transfers.length > 20) console.log(`   ... (${transfers.length - 20} more)\n`);
  else console.log('');

  // Quick totals (from loaded data only)
  const ledgerTotal = ledger.reduce((s, e) => s + Number(e.amount), 0);
  const walletTotal = walletTxns.reduce((s, w) => s + Number(w.amount), 0);
  const feeTotal = feeTxns.reduce((s, f) => s + Number(f.amount), 0);
  const withdrawTotal = withdraws.reduce((s, w) => s + Number(w.amount), 0);

  console.log('📌 Totals (from fetched rows only):');
  console.log(`   ledger_sum=${fmtINR(ledgerTotal)} | wallet_txn_sum=${fmtINR(walletTotal)} | fee_sum=${fmtINR(feeTotal)} | withdraw_requested_sum=${fmtINR(withdrawTotal)}`);
  console.log('\n✅ Done.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

