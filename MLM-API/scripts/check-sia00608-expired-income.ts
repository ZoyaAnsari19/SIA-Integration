#!/usr/bin/env tsx
import { prisma } from '../src/config/prisma.js';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

async function main() {
  const displayId = 'SIA00608';
  
  console.log(`\n🔍 Checking User: ${displayId}\n`);
  console.log('='.repeat(80));
  
  // Find user
  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: { 
      id: true, 
      name: true, 
      display_id: true,
      is_disqualified: true,
    },
  });
  
  if (!user) {
    console.log(`❌ User ${displayId} not found`);
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ User found:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Display ID: ${user.display_id}`);
  console.log(`   Disqualified: ${user.is_disqualified || false}`);
  console.log('');
  
  // Get all purchases
  const purchases = await prisma.purchases.findMany({
    where: { 
      user_id: user.id,
      status: 'completed',
    },
    orderBy: { purchased_at: 'desc' },
    select: {
      id: true,
      package_id: true,
      amount: true,
      purchased_at: true,
      status: true,
      income: true,
      is_renewal: true,
    } as any,
  });
  
  // Get package names
  const packageIds = [...new Set(purchases.map(p => p.package_id))];
  const packages = await prisma.packages.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true },
  });
  const packageMap = new Map(packages.map(p => [p.id, p.name]));
  
  console.log(`📦 Total Purchases: ${purchases.length}\n`);
  console.log('='.repeat(80));
  
  let expiredPackages: any[] = [];
  let activePackages: any[] = [];
  
  for (const purchase of purchases) {
    const purchaseId = purchase.id as unknown as bigint;
    const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchaseId);
    const investmentAmount = Number(purchase.amount);
    const currentIncome = Number((purchase as any).income || 0);
    const doubleAmount = investmentAmount * 2;
    const isExpired = isDoubleReached;
    
    const packageName = packageMap.get(purchase.package_id) || 'N/A';
    
    console.log(`\n📦 Purchase ID: ${purchase.id}`);
    console.log(`   Package: ${packageName} (ID: ${purchase.package_id})`);
    console.log(`   Amount: ₹${investmentAmount.toFixed(2)}`);
    console.log(`   Income: ₹${currentIncome.toFixed(2)}`);
    console.log(`   2x Target: ₹${doubleAmount.toFixed(2)}`);
    console.log(`   Progress: ${((currentIncome / doubleAmount) * 100).toFixed(2)}%`);
    console.log(`   Purchased At: ${purchase.purchased_at}`);
    console.log(`   Is Renewal: ${purchase.is_renewal || false}`);
    console.log(`   Status: ${isExpired ? '❌ EXPIRED (reached 2x)' : '✅ ACTIVE (not reached 2x)'}`);
    
    if (isExpired) {
      expiredPackages.push({
        purchaseId: purchase.id,
        packageName,
        amount: investmentAmount,
        income: currentIncome,
        doubleAmount,
      });
    } else {
      activePackages.push({
        purchaseId: purchase.id,
        packageName,
        amount: investmentAmount,
        income: currentIncome,
        doubleAmount,
      });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Active Packages: ${activePackages.length}`);
  console.log(`   Expired Packages: ${expiredPackages.length}`);
  
  if (expiredPackages.length > 0) {
    console.log(`\n⚠️  EXPIRED PACKAGES (should NOT receive income):`);
    expiredPackages.forEach(p => {
      console.log(`   - ${p.packageName}: ₹${p.amount.toFixed(2)} (Income: ₹${p.income.toFixed(2)}, 2x: ₹${p.doubleAmount.toFixed(2)})`);
    });
  }
  
  // Check recent income (last 7 days) for expired packages
  console.log('\n' + '='.repeat(80));
  console.log(`\n💰 Checking Recent Income (Last 7 Days) for Expired Packages:\n`);
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  for (const expiredPkg of expiredPackages) {
    const purchaseId = expiredPkg.purchaseId as unknown as bigint;
    
    // Get all ledger entries for this purchase in last 7 days
    const recentIncome = await prisma.ledger_entries.findMany({
      where: {
        purchase_id: purchaseId,
        credited_at: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: { credited_at: 'desc' },
      select: {
        id: true,
        commission_type: true,
        amount: true,
        credited_at: true,
        receiver_user_id: true,
        source_user_id: true,
      },
    });
    
    if (recentIncome.length > 0) {
      console.log(`\n❌ ISSUE FOUND: Expired Package "${expiredPkg.packageName}" (Purchase ID: ${purchaseId})`);
      console.log(`   Received ${recentIncome.length} income entries in last 7 days:\n`);
      
      let totalIncome = 0;
      for (const entry of recentIncome) {
        const amount = Number(entry.amount);
        totalIncome += amount;
        console.log(`   - ${entry.commission_type}: ₹${amount.toFixed(2)} on ${entry.credited_at.toISOString()}`);
        console.log(`     Receiver: ${entry.receiver_user_id}, Source: ${entry.source_user_id}`);
      }
      
      console.log(`\n   ⚠️  TOTAL INCOME FROM EXPIRED PACKAGE: ₹${totalIncome.toFixed(2)}`);
      console.log(`   ❌ This is INVALID - expired packages should NOT receive income!`);
    } else {
      console.log(`✅ Expired Package "${expiredPkg.packageName}" (Purchase ID: ${purchaseId}): No recent income (correct)`);
    }
  }
  
  // Also check if user is receiving income as receiver (MONTHLY, SPOT from downlines)
  console.log('\n' + '='.repeat(80));
  console.log(`\n💰 Checking Income Received as Receiver (Last 7 Days):\n`);
  
  const receivedIncome = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: user.id,
      credited_at: {
        gte: sevenDaysAgo,
      },
    },
    orderBy: { credited_at: 'desc' },
    select: {
      id: true,
      commission_type: true,
      amount: true,
      credited_at: true,
      purchase_id: true,
      source_user_id: true,
    },
    take: 20, // Last 20 entries
  });
  
  if (receivedIncome.length > 0) {
    console.log(`Found ${receivedIncome.length} income entries received in last 7 days:\n`);
    
    // Group by purchase_id to check if any are from expired packages
    const incomeByPurchase = new Map<bigint, any[]>();
    for (const entry of receivedIncome) {
      if (entry.purchase_id) {
        const purchaseId = entry.purchase_id as unknown as bigint;
        if (!incomeByPurchase.has(purchaseId)) {
          incomeByPurchase.set(purchaseId, []);
        }
        incomeByPurchase.get(purchaseId)!.push(entry);
      }
    }
    
    let foundInvalidIncome = false;
    for (const [purchaseId, entries] of incomeByPurchase) {
      // Check if this purchase belongs to a downline and if it's expired
      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
        select: {
          id: true,
          user_id: true,
          amount: true,
          income: true,
          package_id: true,
        } as any,
      });
      
      if (purchase) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchaseId);
        const sourceUser = await prisma.users.findUnique({
          where: { id: purchase.user_id },
          select: { display_id: true, name: true },
        });
        
        if (isDoubleReached) {
          foundInvalidIncome = true;
          const packageName = packageMap.get(purchase.package_id) || 'N/A';
          const totalAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);
          
          console.log(`\n❌ ISSUE FOUND: Receiving income from EXPIRED purchase:`);
          console.log(`   Purchase ID: ${purchaseId}`);
          console.log(`   Package: ${packageName}`);
          console.log(`   Source User: ${sourceUser?.display_id || purchase.user_id} (${sourceUser?.name || 'N/A'})`);
          console.log(`   Purchase Amount: ₹${Number(purchase.amount).toFixed(2)}`);
          console.log(`   Purchase Income: ₹${Number((purchase as any).income || 0).toFixed(2)}`);
          console.log(`   Commission Type: ${entries.map(e => e.commission_type).join(', ')}`);
          console.log(`   Total Received: ₹${totalAmount.toFixed(2)}`);
          console.log(`   ❌ This is INVALID - should NOT receive income from expired purchases!`);
        }
      }
    }
    
    if (!foundInvalidIncome) {
      console.log(`✅ All received income is from active purchases (correct)`);
    }
  } else {
    console.log(`No income received in last 7 days`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Check Complete\n');
  
  await prisma.$disconnect();
}

main().catch(console.error);

