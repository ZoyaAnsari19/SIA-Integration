/**
 * List users whose 65-day renewal window has PASSED (renewal_deadline < now).
 * Run against prod: DATABASE_URL=<prod_url> npx tsx scripts/list-users-renewal-window-passed.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const RENEWAL_WINDOW_DAYS = 65;

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

async function main() {
  const now = new Date();
  console.log('============================================================');
  console.log('Users whose 65-day RENEWAL WINDOW has PASSED (as of', now.toISOString(), ')');
  console.log('============================================================\n');

  const purchases = await prisma.purchases.findMany({
    where: { status: 'completed' },
    select: {
      id: true,
      user_id: true,
      package_id: true,
      amount: true,
      income: true,
      purchased_at: true,
    },
    orderBy: { purchased_at: 'desc' },
  });

  type Row = {
    userId: bigint;
    purchaseId: bigint;
    packageId: number;
    amount: number;
    income: number;
    lastIncomeDate: Date | null;
    renewalDeadline: Date;
    daysPastDeadline: number;
  };

  const pastDeadline: Row[] = [];

  for (const p of purchases) {
    const amt = Number(p.amount);
    const inc = Number(p.income ?? 0);
    if (inc < amt * 2) continue; // not expired (2x not reached)

    const lastEntry = await prisma.ledger_entries.findFirst({
      where: {
        purchase_id: p.id,
        receiver_user_id: p.user_id,
        commission_type: { in: ['SELF', 'GLOBAL_HELPING'] },
      },
      orderBy: { credited_at: 'desc' },
      select: { credited_at: true },
    });

    let renewalDeadline: Date;
    let lastIncomeDate: Date | null = null;

    if (lastEntry?.credited_at) {
      lastIncomeDate = new Date(lastEntry.credited_at);
      const lastUTC = new Date(Date.UTC(
        lastIncomeDate.getUTCFullYear(),
        lastIncomeDate.getUTCMonth(),
        lastIncomeDate.getUTCDate()
      ));
      renewalDeadline = addDaysUTC(lastUTC, RENEWAL_WINDOW_DAYS);
    } else {
      const purchaseDate = new Date(p.purchased_at);
      const purchaseUTC = new Date(Date.UTC(
        purchaseDate.getUTCFullYear(),
        purchaseDate.getUTCMonth(),
        purchaseDate.getUTCDate()
      ));
      renewalDeadline = addDaysUTC(purchaseUTC, RENEWAL_WINDOW_DAYS);
    }

    if (renewalDeadline.getTime() >= now.getTime()) continue; // still within window

    const daysPastDeadline = Math.floor((now.getTime() - renewalDeadline.getTime()) / (1000 * 60 * 60 * 24));
    pastDeadline.push({
      userId: p.user_id,
      purchaseId: p.id,
      packageId: p.package_id,
      amount: amt,
      income: inc,
      lastIncomeDate,
      renewalDeadline,
      daysPastDeadline,
    });
  }

  const uniqueUserIds = [...new Set(pastDeadline.map((r) => r.userId))];
  const users = await prisma.users.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, display_id: true, name: true, phone: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  // Sort by days past deadline (most past first)
  pastDeadline.sort((a, b) => b.daysPastDeadline - a.daysPastDeadline);

  console.log('Total expired purchases with renewal window PASSED:', pastDeadline.length);
  console.log('Unique users:', uniqueUserIds.length);
  console.log('');

  const rows: Array<{
    display_id: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    user_id: string;
    purchase_id: string;
    package_id: number;
    amount: number;
    income: number;
    last_income_date: string | null;
    renewal_deadline: string;
    days_past_deadline: number;
  }> = [];

  for (const r of pastDeadline) {
    const u = userMap.get(r.userId.toString());
    rows.push({
      display_id: u?.display_id ?? null,
      name: u?.name ?? null,
      phone: u?.phone ?? null,
      email: u?.email ?? null,
      user_id: r.userId.toString(),
      purchase_id: r.purchaseId.toString(),
      package_id: r.packageId,
      amount: r.amount,
      income: r.income,
      last_income_date: r.lastIncomeDate ? r.lastIncomeDate.toISOString().slice(0, 10) : null,
      renewal_deadline: r.renewalDeadline.toISOString().slice(0, 19) + 'Z',
      days_past_deadline: r.daysPastDeadline,
    });
  }

  // Print table: one row per user (if multiple expired packages, show the one with max days past)
  const byUser = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    const key = row.user_id;
    const existing = byUser.get(key);
    if (!existing || row.days_past_deadline > existing.days_past_deadline) {
      byUser.set(key, row);
    }
  }
  const list = Array.from(byUser.values()).sort((a, b) => b.days_past_deadline - a.days_past_deadline);

  console.log('--- List of USERS (one per user, renewal window passed) ---\n');
  console.log(
    'display_id\tname\tphone\temail\tuser_id\tpurchase_id\tpackage_id\tamount\tincome\tlast_income_date\trenewal_deadline\tdays_past_deadline'
  );
  console.log('-'.repeat(120));
  for (const row of list) {
    console.log(
      [row.display_id ?? '', row.name ?? '', row.phone ?? '', row.email ?? '', row.user_id, row.purchase_id, row.package_id, row.amount, row.income, row.last_income_date ?? '', row.renewal_deadline, row.days_past_deadline].join('\t')
    );
  }

  console.log('\n--- Summary ---');
  console.log('Unique users with 65-day renewal window passed:', list.length);
  console.log('(Full list above; multiple expired packages per user show the one with max days past deadline.)');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
