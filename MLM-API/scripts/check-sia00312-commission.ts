import { prisma } from '../src/config/prisma.js';

async function checkSIA00312Commission() {
  console.log('🔍 Checking ₹48.38 team income for SIA00312 from SIA00635...\n');

  // Get user IDs
  const sia00312 = await prisma.users.findUnique({
    where: { display_id: 'SIA00312' },
    select: { id: true, name: true, display_id: true },
  });

  const sia00635 = await prisma.users.findUnique({
    where: { display_id: 'SIA00635' },
    select: { id: true, name: true, display_id: true },
  });

  if (!sia00312) {
    console.error('❌ SIA00312 not found');
    return;
  }

  if (!sia00635) {
    console.error('❌ SIA00635 not found');
    return;
  }

  console.log(`✅ Found Users:`);
  console.log(`   SIA00312: ${sia00312.name} (ID: ${sia00312.id})`);
  console.log(`   SIA00635: ${sia00635.name} (ID: ${sia00635.id})\n`);

  // Find ALL MONTHLY ledger entries where SIA00312 received commission from SIA00635
  const monthlyEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: sia00312.id as unknown as bigint,
      source_user_id: sia00635.id as unknown as bigint,
      commission_type: 'MONTHLY',
    },
    orderBy: { credited_at: 'desc' },
  });

  console.log(`📊 Found ${monthlyEntries.length} MONTHLY commission entries\n`);

  // Group by amount to see all different amounts
  const amountGroups = new Map<number, any[]>();
  for (const entry of monthlyEntries) {
    const amount = Number(entry.amount);
    if (!amountGroups.has(amount)) {
      amountGroups.set(amount, []);
    }
    amountGroups.get(amount)!.push(entry);
  }

  console.log(`💰 Different Amount Groups:\n`);
  const sortedAmounts = Array.from(amountGroups.entries()).sort((a, b) => b[0] - a[0]);
  for (const [amount, entries] of sortedAmounts) {
    console.log(`   ₹${amount.toFixed(2)}: ${entries.length} entry/entries`);
  }
  console.log(`\n`);

  // Find entries with amount around ₹48.38
  const targetAmount = 48.38;
  const matchingEntries = monthlyEntries.filter(
    (entry) => Math.abs(Number(entry.amount) - targetAmount) < 0.01
  );

  // Also find entries with amount around ₹24.19
  const targetAmount2 = 24.19;
  const matchingEntries2 = monthlyEntries.filter(
    (entry) => Math.abs(Number(entry.amount) - targetAmount2) < 0.01
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 DETAILED ANALYSIS\n`);

  // Check all purchases by SIA00635
  const allPurchases = await prisma.purchases.findMany({
    where: {
      user_id: sia00635.id as unknown as bigint,
      status: 'completed',
    },
    orderBy: { purchased_at: 'desc' },
  });

  console.log(`📦 All Purchases by SIA00635 (${allPurchases.length}):\n`);
  for (const purchase of allPurchases) {
    const pkg = await prisma.packages.findUnique({
      where: { id: purchase.package_id },
      select: { name: true, price: true },
    });
    console.log(`   Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${pkg?.name || 'N/A'} (₹${Number(purchase.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
    console.log(`   Purchased At: ${purchase.purchased_at.toISOString()}`);
    console.log(`   Status: ${purchase.status}`);
    console.log(`   Income: ₹${Number(purchase.income || 0).toFixed(2)}`);
    console.log(`   Is Renewal: ${(purchase as any).is_renewal || false}`);
    console.log(``);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`💰 MONTHLY ENTRIES ANALYSIS\n`);

  if (matchingEntries.length === 0 && matchingEntries2.length === 0) {
    console.log(`⚠️  No entries found with amounts ₹${targetAmount} or ₹${targetAmount2}`);
    console.log(`\n📋 Recent entries found:`);
    for (const entry of monthlyEntries.slice(0, 10)) {
      console.log(`   Amount: ₹${Number(entry.amount).toFixed(2)}, Date: ${entry.credited_at.toISOString()}, Purchase ID: ${entry.purchase_id || 'N/A'}`);
    }
    return;
  }

  if (matchingEntries.length > 0) {
    console.log(`✅ Found ${matchingEntries.length} entry/entries with amount ₹${targetAmount}\n`);
  }
  
  if (matchingEntries2.length > 0) {
    console.log(`✅ Found ${matchingEntries2.length} entry/entries with amount ₹${targetAmount2}\n`);
  }

  // Process both amounts
  const allMatchingEntries = [...matchingEntries, ...matchingEntries2];

  for (const entry of allMatchingEntries) {
    console.log(`📝 Entry Details:`);
    console.log(`   Amount: ₹${Number(entry.amount).toFixed(2)}`);
    console.log(`   Credited At: ${entry.credited_at.toISOString()}`);
    console.log(`   Purchase ID: ${entry.purchase_id || 'N/A'}`);
    console.log(`   Metadata:`, JSON.stringify(entry.metadata, null, 2));

    if (entry.purchase_id) {
      // Get purchase details
      const purchase = await prisma.purchases.findUnique({
        where: { id: entry.purchase_id as unknown as bigint },
      });

      if (purchase) {
        // Get package details separately
        const pkg = await prisma.packages.findUnique({
          where: { id: purchase.package_id },
          select: {
            id: true,
            name: true,
            price: true,
            direct_monthly_royalty_percent: true,
            recurring_rate_percent: true,
          },
        });

        console.log(`\n📦 Purchase Details:`);
        console.log(`   Purchase ID: ${purchase.id}`);
        console.log(`   Package ID: ${purchase.package_id}`);
        if (pkg) {
          console.log(`   Package Name: ${pkg.name}`);
          console.log(`   Package Price: ₹${Number(pkg.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        }
        console.log(`   Purchase Amount: ₹${Number(purchase.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        console.log(`   Purchased At: ${purchase.purchased_at.toISOString()}`);
        console.log(`   Status: ${purchase.status}`);
        console.log(`\n💰 Commission Calculation:`);
        if (pkg) {
          console.log(`   Package direct_monthly_royalty_percent: ${pkg.direct_monthly_royalty_percent || 'NULL'}`);
          console.log(`   Package recurring_rate_percent: ${pkg.recurring_rate_percent || 'NULL'}`);
        }

        // Check metadata for level
        const metadata = entry.metadata as any;
        const level = metadata?.level ?? 'N/A';
        console.log(`   Level: ${level}`);

        // Calculate expected monthly
        let monthlyPercent = 0;
        if (level === 0) {
          // Level 0 uses package direct_monthly_royalty_percent
          monthlyPercent = pkg?.direct_monthly_royalty_percent
            ? Number(pkg.direct_monthly_royalty_percent)
            : (pkg?.recurring_rate_percent ? Number(pkg.recurring_rate_percent) : 0.5);
        } else {
          // Level 1+ uses levels table
          const levelData = await prisma.levels.findUnique({
            where: { level: Number(level) },
            select: { monthly_royalty_percent: true },
          });
          monthlyPercent = levelData?.monthly_royalty_percent
            ? Number(levelData.monthly_royalty_percent)
            : 0.5;
        }

        const expectedMonthly = (Number(purchase.amount) * monthlyPercent) / 100;
        console.log(`   Monthly Percent: ${monthlyPercent}%`);
        console.log(`   Expected Monthly: ₹${expectedMonthly.toFixed(2)}`);
        
        // Calculate daily amount (December has 31 days)
        const daysInMonth = new Date(entry.credited_at.getFullYear(), entry.credited_at.getMonth() + 1, 0).getDate();
        const expectedDaily = expectedMonthly / daysInMonth;
        console.log(`   Days in Month: ${daysInMonth}`);
        console.log(`   Expected Daily: ₹${expectedDaily.toFixed(2)}`);
        console.log(`   Actual Daily Amount: ₹${Number(entry.amount).toFixed(2)}`);

        // Check if reinvestment
        const isReinvestment = metadata?.is_reinvestment === true;
        if (isReinvestment && Number(level) >= 1) {
          const beforeReduction = expectedMonthly;
          const afterReduction = expectedMonthly * 0.5;
          const afterReductionDaily = afterReduction / daysInMonth;
          console.log(`   ⚠️  REINVESTMENT: 50% reduction applied`);
          console.log(`   Before Reduction Monthly: ₹${beforeReduction.toFixed(2)}`);
          console.log(`   After Reduction Monthly: ₹${afterReduction.toFixed(2)}`);
          console.log(`   After Reduction Daily: ₹${afterReductionDaily.toFixed(2)}`);
        } else {
          console.log(`   ✅ First Purchase: No reduction (100%)`);
        }
      } else {
        console.log(`   ⚠️  Purchase not found for ID: ${entry.purchase_id}`);
      }
    }

    console.log(`\n${'='.repeat(60)}\n`);
  }

  await prisma.$disconnect();
}

checkSIA00312Commission().catch(console.error);

