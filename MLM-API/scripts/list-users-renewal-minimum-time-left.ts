/**
 * List users with EXPIRED packages who have MINIMUM time left before 65-day renewal window closes.
 * Sorted by least time remaining (urgent first).
 * Run: npx tsx scripts/list-users-renewal-minimum-time-left.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const RENEWAL_WINDOW_DAYS = 65;
const TOP_N = 50; // show at least this many with least time left (or all if fewer)

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
  console.log('Expired packages: MINIMUM time left before renewal window closes (as of', now.toISOString(), ')');
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
    remainingMs: number;
    daysLeft: number;
    hoursLeft: number;
  };

  const withinWindow: Row[] = [];

  for (const p of purchases) {
    const amt = Number(p.amount);
    const inc = Number(p.income ?? 0);
    if (inc < amt * 2) continue;

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

    const remainingMs = renewalDeadline.getTime() - now.getTime();
    if (remainingMs <= 0) continue; // already passed, skip

    const daysLeft = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    withinWindow.push({
      userId: p.user_id,
      purchaseId: p.id,
      packageId: p.package_id,
      amount: amt,
      income: inc,
      lastIncomeDate,
      renewalDeadline,
      remainingMs,
      daysLeft,
      hoursLeft,
    });
  }

  // Sort by LEAST time remaining (most urgent first)
  withinWindow.sort((a, b) => a.remainingMs - b.remainingMs);

  const toShow = withinWindow.slice(0, Math.max(TOP_N, withinWindow.length));
  const userIds = [...new Set(toShow.map((r) => r.userId))];
  const users = await prisma.users.findMany({
    where: { id: { in: userIds } },
    select: { id: true, display_id: true, name: true, phone: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  console.log('Total expired packages still within renewal window:', withinWindow.length);
  console.log('Showing top', toShow.length, 'with MINIMUM time left (urgent first):\n');
  console.log(
    'display_id\tname\tphone\temail\tuser_id\tpurchase_id\tpackage_id\tamount\tincome\tlast_income_date\trenewal_deadline\tdays_left\thours_left'
  );
  console.log('-'.repeat(140));

  for (const r of toShow) {
    const u = userMap.get(r.userId.toString());
    const lastDateStr = r.lastIncomeDate ? r.lastIncomeDate.toISOString().slice(0, 10) : '';
    const deadlineStr = r.renewalDeadline.toISOString().slice(0, 19) + 'Z';
    console.log(
      [
        u?.display_id ?? '',
        u?.name ?? '',
        u?.phone ?? '',
        u?.email ?? '',
        r.userId.toString(),
        r.purchaseId.toString(),
        r.packageId,
        r.amount,
        r.income,
        lastDateStr,
        deadlineStr,
        r.daysLeft,
        r.hoursLeft,
      ].join('\t')
    );
  }

  console.log('\n--- Summary ---');
  console.log('Expired packages with time still left:', withinWindow.length);
  if (withinWindow.length > 0) {
    const min = withinWindow[0];
    const u0 = userMap.get(min.userId.toString());
    console.log('Least time left:', u0?.display_id ?? min.userId.toString(), '-', min.daysLeft, 'days', min.hoursLeft, 'hours until', min.renewalDeadline.toISOString());
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
