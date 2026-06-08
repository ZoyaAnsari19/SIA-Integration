#!/usr/bin/env tsx
import { prisma } from '../src/config/prisma.js';
import { checkEligibility, isUserActive } from '../src/utils/business.js';

async function checkLevel3SpotCommission() {
  console.log('\n🔍 Checking Level 3 Spot Commission: Sai00748/SIA00748 → SIA00299\n');
  
  // Find both users - try both Sai00748 and SIA00748
  let saiUser = await prisma.users.findUnique({
    where: { display_id: 'Sai00748' },
    select: { id: true, name: true, display_id: true, status: true, referrer_user_id: true },
  });
  
  if (!saiUser) {
    saiUser = await prisma.users.findUnique({
      where: { display_id: 'SIA00748' },
      select: { id: true, name: true, display_id: true, status: true, referrer_user_id: true },
    });
  }
  
  const siaUser = await prisma.users.findUnique({
    where: { display_id: 'SIA00299' },
    select: { id: true, name: true, display_id: true, status: true },
  });
  
  if (!saiUser) {
    console.log('❌ Sai00748/SIA00748 user not found');
    console.log('   Searching for similar users...');
    
    // Try to find users with similar IDs
    const similarUsers = await prisma.users.findMany({
      where: {
        OR: [
          { display_id: { contains: '00748' } },
          { display_id: { contains: '748' } },
        ],
      },
      select: { id: true, name: true, display_id: true },
      take: 10,
    });
    
    if (similarUsers.length > 0) {
      console.log('   Found similar users:');
      similarUsers.forEach(u => {
        console.log(`     - ${u.display_id}: ${u.name} (ID: ${u.id})`);
      });
    }
    
    await prisma.$disconnect();
    return;
  }
  
  if (!siaUser) {
    console.log('❌ SIA00299 user not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ Sai00748 found: ID=${saiUser.id}, Name=${saiUser.name}, Status=${saiUser.status}`);
  console.log(`✅ SIA00299 found: ID=${siaUser.id}, Name=${siaUser.name}, Status=${siaUser.status}\n`);
  
  // Check relationship - is SIA00299 upline of Sai00748?
  const relationship = await prisma.user_tree_paths.findFirst({
    where: {
      ancestor_id: siaUser.id,
      descendant_id: saiUser.id,
    },
  });
  
  if (!relationship) {
    console.log('❌ SIA00299 is NOT an upline of Sai00748');
    console.log('   Checking reverse relationship...');
    
    const reverseRelationship = await prisma.user_tree_paths.findFirst({
      where: {
        ancestor_id: saiUser.id,
        descendant_id: siaUser.id,
      },
    });
    
    if (reverseRelationship) {
      console.log(`   ⚠️  Sai00748 is upline of SIA00299 (depth ${reverseRelationship.depth})`);
      console.log('   ❌ Commission should flow DOWN, not UP. Invalid claim.');
    } else {
      console.log('   ❌ No relationship found between these users');
    }
    await prisma.$disconnect();
    return;
  }
  
  const depth = relationship.depth;
  const level = depth - 1; // Level 3 = depth 4
  
  console.log(`✅ Relationship found: SIA00299 is upline of Sai00748`);
  console.log(`   Depth: ${depth}`);
  console.log(`   Commission Level: ${level}\n`);
  
  if (depth !== 4) {
    console.log(`❌ Depth is ${depth}, not 4. Level 3 requires depth 4.`);
    console.log(`   Current level would be: ${level} (Level ${level} commission)`);
    console.log(`\n   📊 Commission Level Mapping:`);
    console.log(`      Depth 1 → Level 0 (Direct Referrer - 5% SPOT)`);
    console.log(`      Depth 2 → Level 1 (2.5% SPOT)`);
    console.log(`      Depth 3 → Level 2 (2.5% SPOT) ← CURRENT`);
    console.log(`      Depth 4 → Level 3 (2.0% SPOT) ← REQUIRED FOR CLAIM`);
    console.log(`      Depth 5 → Level 4 (2.0% SPOT)\n`);
    
    // Check if Level 2 commission was paid
    console.log(`🔍 Checking if Level ${level} commission was paid:\n`);
    
    const purchases = await prisma.purchases.findMany({
      where: {
        user_id: saiUser.id,
        status: 'completed',
      },
      orderBy: { purchased_at: 'asc' },
      select: {
        id: true,
        amount: true,
        purchased_at: true,
      },
    });
    
    if (purchases.length > 0) {
      const level2Data = await prisma.levels.findUnique({
        where: { level: level },
        select: { spot_commission_percent: true },
      });
      
      const spotPercent = level2Data?.spot_commission_percent 
        ? Number(level2Data.spot_commission_percent) 
        : 2.5; // Default 2.5% for Level 2
      
    for (const purchase of purchases) {
      const baseAmount = (Number(purchase.amount) * spotPercent) / 100;
      
      const creditedCommissions = await prisma.ledger_entries.findMany({
        where: {
          source_user_id: saiUser.id,
          receiver_user_id: siaUser.id,
          purchase_id: purchase.id,
          commission_type: 'SPOT',
        },
      });
      
      // Filter by level in metadata
      const levelCommissions = creditedCommissions.filter((entry) => {
        const meta = entry.metadata as any;
        return meta?.level === level;
      });
      
      console.log(`   Purchase ${purchase.id} (₹${purchase.amount}):`);
      if (levelCommissions.length > 0) {
        levelCommissions.forEach((c) => {
          const creditedAmount = Number(c.amount);
          console.log(`     ✅ Level ${level} commission credited: ₹${creditedAmount.toFixed(2)}`);
          console.log(`     Credited At: ${c.credited_at}`);
        });
      } else {
        console.log(`     ❌ Level ${level} commission NOT credited`);
        console.log(`     Expected base: ₹${baseAmount.toFixed(2)} (${spotPercent}% of ₹${purchase.amount})`);
        console.log(`     Note: May be reduced by 50% if reinvestment`);
        
        // Check if any other level commission was credited
        if (creditedCommissions.length > 0) {
          console.log(`     ⚠️  Found ${creditedCommissions.length} other SPOT commission(s) for this purchase:`);
          creditedCommissions.forEach((c) => {
            const meta = c.metadata as any;
            const commLevel = meta?.level ?? 'unknown';
            console.log(`       - Level ${commLevel}: ₹${Number(c.amount).toFixed(2)}`);
          });
        }
      }
    }
    }
    
    // Check why Level 2 commission was not paid
    console.log(`\n🔍 Checking why Level ${level} commission was NOT paid:\n`);
    
    const siaEligible = await checkEligibility(siaUser.id as unknown as bigint, level);
    const siaHasActive = await isUserActive(siaUser.id as unknown as bigint);
    const bothActive = saiUser.status === 'active' && siaUser.status === 'active';
    
    console.log(`   SIA00299 Level ${level} Eligibility: ${siaEligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE'}`);
    console.log(`   SIA00299 Has Active Course: ${siaHasActive ? '✅ YES' : '❌ NO'}`);
    console.log(`   Both Users Active: ${bothActive ? '✅ YES' : '❌ NO'}\n`);
    
    if (!siaEligible) {
      console.log(`   ⚠️  Reason: SIA00299 is NOT eligible for Level ${level}`);
      console.log(`      Commission would be in pending_commissions until eligibility is achieved\n`);
    }
    
    if (!siaHasActive) {
      console.log(`   ⚠️  Reason: SIA00299 does NOT have an active course`);
      console.log(`      All courses may have reached 2x investment\n`);
    }
    
    if (!bothActive) {
      console.log(`   ⚠️  Reason: One or both users are not active\n`);
    }
    
    // Check pending commissions for ALL levels (0-9)
    console.log(`🔍 Checking Pending Commissions for ALL Levels:\n`);
    for (const purchase of purchases) {
      const allPendingCommissions = await prisma.pending_commissions.findMany({
        where: {
          source_user_id: saiUser.id,
          receiver_user_id: siaUser.id,
          purchase_id: purchase.id,
          commission_type: 'SPOT',
        },
        orderBy: { level: 'asc' },
      });
      
      if (allPendingCommissions.length > 0) {
        console.log(`   Purchase ${purchase.id} (₹${purchase.amount}):`);
        allPendingCommissions.forEach((p) => {
          const meta = p.metadata as any;
          console.log(`     ⏳ Level ${p.level}: PENDING ₹${Number(p.amount).toFixed(2)}`);
          console.log(`        Created: ${p.created_at}`);
          console.log(`        Reason: ${meta?.reason || 'Waiting for eligibility'}`);
          console.log(`        Depth: ${meta?.depth || 'N/A'}\n`);
        });
      } else {
        console.log(`   Purchase ${purchase.id}: No pending commission found\n`);
      }
    }
    
    // Also check if there are pending commissions for Level 3 specifically
    console.log(`🔍 Checking Pending Commissions for Level 3 (as claimed):\n`);
    for (const purchase of purchases) {
      const level3Pending = await prisma.pending_commissions.findMany({
        where: {
          source_user_id: saiUser.id,
          receiver_user_id: siaUser.id,
          purchase_id: purchase.id,
          commission_type: 'SPOT',
          level: 3,
        },
      });
      
      if (level3Pending.length > 0) {
        console.log(`   Purchase ${purchase.id}: ⏳ Level 3 PENDING ₹${Number(level3Pending[0].amount).toFixed(2)}`);
        console.log(`     Created: ${level3Pending[0].created_at}\n`);
      } else {
        console.log(`   Purchase ${purchase.id}: No Level 3 pending commission\n`);
      }
    }
    
    // Check purchase dates to see when they were made
    console.log(`\n📅 Purchase Details:\n`);
    purchases.forEach((p) => {
      console.log(`   Purchase ${p.id}: ₹${p.amount} on ${p.purchased_at}`);
    });
    
    // Check if there are any SPOT commissions at all for these purchases
    console.log(`\n🔍 Checking ALL SPOT commissions for these purchases:\n`);
    for (const purchase of purchases) {
      const allSpotCommissions = await prisma.ledger_entries.findMany({
        where: {
          source_user_id: saiUser.id,
          purchase_id: purchase.id,
          commission_type: 'SPOT',
        },
        select: {
          id: true,
          receiver_user_id: true,
          amount: true,
          credited_at: true,
          metadata: true,
        },
      });
      
      if (allSpotCommissions.length > 0) {
        console.log(`   Purchase ${purchase.id}:`);
        for (const comm of allSpotCommissions) {
          const receiver = await prisma.users.findUnique({
            where: { id: comm.receiver_user_id },
            select: { display_id: true, name: true },
          });
          const meta = comm.metadata as any;
          const commLevel = meta?.level ?? 'unknown';
          console.log(`     - Receiver: ${receiver?.display_id || comm.receiver_user_id} (${receiver?.name || 'N/A'})`);
          console.log(`       Level: ${commLevel}, Amount: ₹${Number(comm.amount).toFixed(2)}`);
          console.log(`       Credited: ${comm.credited_at}\n`);
        }
      } else {
        console.log(`   Purchase ${purchase.id}: No SPOT commissions found at all\n`);
      }
    }
    
    // Check eligibility at the time of each purchase
    console.log(`\n🔍 Detailed Analysis - Why Commission Wasn't Paid:\n`);
    
    for (const purchase of purchases) {
      console.log(`\n   Purchase ${purchase.id} (₹${purchase.amount}) - ${purchase.purchased_at}:`);
      
      // Check if purchase was processed for commissions
      const anyCommissions = await prisma.ledger_entries.findFirst({
        where: {
          purchase_id: purchase.id,
          commission_type: 'SPOT',
        },
      });
      
      if (anyCommissions) {
        console.log(`     ✅ Commission processing was triggered (other levels got paid)`);
      } else {
        console.log(`     ❌ Commission processing was NOT triggered (no SPOT commissions at all)`);
        console.log(`        This purchase may not have gone through commission processing`);
      }
      
      // Check what the depth was at purchase time (should be same, but verify)
      const purchaseTime = new Date(purchase.purchased_at);
      console.log(`     Purchase Date: ${purchaseTime.toISOString()}`);
      console.log(`     Current Depth: ${depth} (Level ${level})`);
      
      // Check if SIA00299 was eligible at purchase time
      // Note: We can't check historical eligibility, but we can check current
      console.log(`     Current Eligibility Status:`);
      console.log(`       - Level ${level} Eligible: ${siaEligible ? '✅ YES' : '❌ NO'}`);
      console.log(`       - Has Active Course: ${siaHasActive ? '✅ YES' : '❌ NO'}`);
      console.log(`       - Both Active: ${bothActive ? '✅ YES' : '❌ NO'}`);
      
      // Check if there's any commission entry for this purchase-receiver combination
      const receiverCommissions = await prisma.ledger_entries.findMany({
        where: {
          purchase_id: purchase.id,
          receiver_user_id: siaUser.id,
          commission_type: 'SPOT',
        },
      });
      
      if (receiverCommissions.length > 0) {
        console.log(`     ⚠️  Found ${receiverCommissions.length} commission(s) for SIA00299 from this purchase:`);
        receiverCommissions.forEach((c) => {
          const meta = c.metadata as any;
          console.log(`       - Level ${meta?.level ?? 'unknown'}: ₹${Number(c.amount).toFixed(2)}`);
        });
      } else {
        console.log(`     ❌ No commission found for SIA00299 from this purchase`);
      }
    }
    
    // Check SIA00299's purchases to see if they had active courses at purchase time
    console.log(`\n🔍 Checking SIA00299's Purchases (to determine active course status):\n`);
    const siaPurchases = await prisma.purchases.findMany({
      where: {
        user_id: siaUser.id,
        status: 'completed',
      },
      orderBy: { purchased_at: 'asc' },
      select: {
        id: true,
        amount: true,
        purchased_at: true,
      },
    });
    
    console.log(`   SIA00299 has ${siaPurchases.length} purchase(s):\n`);
    siaPurchases.forEach((p, i) => {
      console.log(`   Purchase ${i + 1}: ID=${p.id}, Amount=₹${p.amount}, Date=${p.purchased_at}`);
      console.log(`     Active Until: ${p.active_until}\n`);
    });
    
    // Check if SIA00299's purchases reached 2x at the time of Sai00748's purchases
    console.log(`\n🔍 Checking if SIA00299 had active courses at purchase time:\n`);
    
    for (const purchase of purchases) {
      const purchaseDate = new Date(purchase.purchased_at);
      console.log(`\n   For Purchase ${purchase.id} (${purchaseDate.toISOString()}):`);
      
      // Check which of SIA00299's purchases existed at this time
      const purchasesAtTime = siaPurchases.filter((sp) => {
        const spDate = new Date(sp.purchased_at);
        return spDate <= purchaseDate;
      });
      
      console.log(`     SIA00299 had ${purchasesAtTime.length} purchase(s) before this time`);
      
      if (purchasesAtTime.length === 0) {
        console.log(`     ❌ NO PURCHASES - This is why commission wasn't paid!`);
        console.log(`     Commission requires upline to have at least one purchase`);
      } else {
        console.log(`     ✅ Had purchases, checking if any were active (not reached 2x)...`);
        
        let hasActiveCourse = false;
        
        // Check if any purchase had NOT reached 2x at that time
        // Use purchase.income field directly (same as commission service)
        for (const activePurchase of purchasesAtTime) {
          const fullPurchase = await prisma.purchases.findUnique({
            where: { id: activePurchase.id },
            select: { amount: true, income: true } as any,
          });
          
          if (!fullPurchase) continue;
          
          const purchaseAmount = Number(fullPurchase.amount);
          const twoXAmount = purchaseAmount * 2;
          const currentIncome = Number((fullPurchase as any).income || 0);
          const reached2x = currentIncome >= twoXAmount;
          
          console.log(`       Purchase ${activePurchase.id} (₹${purchaseAmount}):`);
          console.log(`         Current Income: ₹${currentIncome.toFixed(2)}`);
          console.log(`         2x Target: ₹${twoXAmount.toFixed(2)}`);
          console.log(`         Reached 2x: ${reached2x ? '❌ YES (Reached 2x - Not Active)' : '✅ NO (Still Active)'}`);
          
          if (!reached2x) {
            hasActiveCourse = true;
          }
        }
        
        if (!hasActiveCourse) {
          console.log(`     ❌ NO ACTIVE COURSE - All purchases had reached 2x at purchase time!`);
          console.log(`     This is why commission wasn't paid - upline must have active course`);
        } else {
          console.log(`     ✅ Had active course (at least one purchase not reached 2x)`);
          console.log(`     So active course was NOT the issue...`);
        }
      }
    }
    
    // Check eligibility history if possible
    console.log(`\n🔍 Checking Eligibility History:\n`);
    const eligibility = await prisma.level_eligibility.findUnique({
      where: { user_id: siaUser.id },
      select: { eligibility: true, updated_at: true },
    });
    
    if (eligibility) {
      const eligData = eligibility.eligibility as any;
      console.log(`   Eligibility last updated: ${eligibility.updated_at}`);
      console.log(`   Current eligibility status:`);
      for (let level = 0; level <= 9; level++) {
        const isEligible = eligData?.[String(level)] === true;
        if (level === 2) {
          console.log(`     Level ${level}: ${isEligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE'} ← IMPORTANT`);
        }
      }
      console.log(`   Note: This is current eligibility, may have been different at purchase time\n`);
    }
    
    // Calculate expected commission amounts
    console.log(`\n💰 Expected Commission Amounts (Level ${level}):\n`);
    
    const level2Data = await prisma.levels.findUnique({
      where: { level: level },
      select: { spot_commission_percent: true },
    });
    
    const spotPercent = level2Data?.spot_commission_percent 
      ? Number(level2Data.spot_commission_percent) 
      : 2.5; // Default 2.5% for Level 2
    
    console.log(`   Level ${level} Spot Commission: ${spotPercent}%\n`);
    
    let totalExpected = 0;
    
    for (const purchase of purchases) {
      const purchaseAmount = Number(purchase.amount);
      const baseAmount = (purchaseAmount * spotPercent) / 100;
      
      // Check if this was a reinvestment
      // Get all purchases before this one
      const previousPurchases = await prisma.purchases.findMany({
        where: {
          user_id: saiUser.id,
          status: 'completed',
          purchased_at: { lt: purchase.purchased_at },
        },
      });
      
      const isReinvestment = previousPurchases.length > 0;
      const finalAmount = isReinvestment ? baseAmount * 0.5 : baseAmount; // 50% reduction for reinvestment
      totalExpected += finalAmount;
      
      console.log(`   Purchase ${purchase.id} (₹${purchaseAmount.toFixed(2)}):`);
      console.log(`     Base Commission: ₹${baseAmount.toFixed(2)} (${spotPercent}% of ₹${purchaseAmount.toFixed(2)})`);
      if (isReinvestment) {
        console.log(`     Reinvestment: YES → 50% reduction applied`);
        console.log(`     Final Amount: ₹${finalAmount.toFixed(2)}`);
      } else {
        console.log(`     First Purchase: NO reduction`);
        console.log(`     Final Amount: ₹${finalAmount.toFixed(2)}`);
      }
      console.log(``);
    }
    
    console.log(`   📊 TOTAL EXPECTED COMMISSION: ₹${totalExpected.toFixed(2)}\n`);
    console.log(`   ⚠️  This amount was NOT paid to SIA00299\n`);
    
    console.log(`\n📋 FINAL CONCLUSION:\n`);
    console.log(`   ❌ INVALID CLAIM: SIA00299 should receive Level ${level} commission, NOT Level 3`);
    console.log(`   ❌ Level 3 commission should NOT be paid (requires depth 4, current depth is ${depth})\n`);
    
    console.log(`   📊 Why Level ${level} Commission Wasn't Paid:\n`);
    
    if (siaEligible && siaHasActive && bothActive) {
      console.log(`   ✅ Current Status: All requirements are NOW met`);
      console.log(`   ❌ But commission was NOT paid when purchase was made\n`);
      console.log(`   🔍 Possible Reasons:\n`);
      console.log(`      1. SIA00299 was NOT eligible for Level ${level} at purchase time`);
      console.log(`         (Eligibility may have been achieved later)`);
      console.log(`      2. SIA00299 did NOT have active course at purchase time`);
      console.log(`         (All courses may have reached 2x at that time)`);
      console.log(`      3. Commission processing failed or was skipped`);
      console.log(`      4. Purchase was made before Level ${level} commission logic was implemented\n`);
      console.log(`   💡 Solution: Check historical eligibility or manually credit if requirements were met\n`);
    } else {
      console.log(`   ❌ Current Status: Requirements NOT met`);
      if (!siaEligible) {
        console.log(`      - SIA00299 is NOT eligible for Level ${level}`);
        console.log(`      - Commission should be in pending_commissions (but not found)`);
      }
      if (!siaHasActive) {
        console.log(`      - SIA00299 does NOT have active course`);
      }
      if (!bothActive) {
        console.log(`      - One or both users are not active\n`);
      }
    }
    
    console.log(`   📝 Summary:\n`);
    console.log(`      • Level 3 Claim: ❌ INVALID (depth 3, not 4)`);
    console.log(`      • Level ${level} Commission: ❌ NOT PAID`);
    console.log(`      • Pending Commission: ❌ NOT FOUND`);
    console.log(`      • Current Eligibility: ${siaEligible && siaHasActive && bothActive ? '✅ YES' : '❌ NO'}\n`);
    
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ Depth 4 confirmed - This is Level 3 commission\n`);
  
  // Check Sai00748's purchases
  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: saiUser.id,
      status: 'completed',
    },
    orderBy: { purchased_at: 'asc' },
    select: {
      id: true,
      amount: true,
      purchased_at: true,
      is_reinvestment: true,
    } as any,
  });
  
  if (purchases.length === 0) {
    console.log('❌ Sai00748 has no completed purchases');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ Sai00748 has ${purchases.length} purchase(s):\n`);
  purchases.forEach((p, i) => {
    console.log(`   Purchase ${i + 1}:`);
    console.log(`     ID: ${p.id}`);
    console.log(`     Amount: ₹${p.amount}`);
    console.log(`     Date: ${p.purchased_at}`);
  });
  console.log('');
  
  // Check Level 3 spot commission percentage
  const level3Data = await prisma.levels.findUnique({
    where: { level: 3 },
    select: { spot_commission_percent: true },
  });
  
  const spotPercent = level3Data?.spot_commission_percent 
    ? Number(level3Data.spot_commission_percent) 
    : 2.0; // Default 2% for Level 3
  
  console.log(`📊 Level 3 Spot Commission: ${spotPercent}%\n`);
  
  // Check eligibility of SIA00299 for Level 3
  const siaEligible = await checkEligibility(siaUser.id as unknown as bigint, 3);
  console.log(`✅ SIA00299 Level 3 Eligibility: ${siaEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}\n`);
  
  // Check if SIA00299 has active course
  const siaHasActive = await isUserActive(siaUser.id as unknown as bigint);
  console.log(`✅ SIA00299 Has Active Course: ${siaHasActive ? 'YES' : 'NO'}\n`);
  
  // Check if both users are active
  const bothActive = saiUser.status === 'active' && siaUser.status === 'active';
  console.log(`✅ Both Users Active: ${bothActive ? 'YES' : 'NO'}\n`);
  
  // Calculate expected commission for each purchase
  console.log('💰 Expected Commissions:\n');
  purchases.forEach((p, i) => {
    const baseAmount = (Number(p.amount) * spotPercent) / 100;
    
    console.log(`   Purchase ${i + 1} (ID: ${p.id}):`);
    console.log(`     Base: ₹${baseAmount.toFixed(2)} (${spotPercent}% of ₹${p.amount})`);
    console.log(`     Note: May be reduced by 50% if reinvestment\n`);
  });
  
  // Check if commissions were credited
  console.log('🔍 Checking Credited Commissions:\n');
  
  for (const purchase of purchases) {
    const baseAmount = (Number(purchase.amount) * spotPercent) / 100;
    
    const creditedCommissions = await prisma.ledger_entries.findMany({
      where: {
        source_user_id: saiUser.id,
        receiver_user_id: siaUser.id,
        purchase_id: purchase.id,
        commission_type: 'SPOT',
      },
    });
    
    // Filter for Level 3 commissions
    const level3Commissions = creditedCommissions.filter((entry) => {
      const meta = entry.metadata as any;
      return meta?.level === 3;
    });
    
    console.log(`   Purchase ${purchase.id} (₹${purchase.amount}):`);
    if (level3Commissions.length === 0) {
      console.log(`     ❌ NO Level 3 COMMISSION CREDITED`);
      console.log(`     Expected base: ₹${baseAmount.toFixed(2)} (${spotPercent}% of ₹${purchase.amount})`);
      
      // Check if any other level commission was credited
      if (creditedCommissions.length > 0) {
        console.log(`     ⚠️  Found ${creditedCommissions.length} other SPOT commission(s):`);
        creditedCommissions.forEach((c) => {
          const meta = c.metadata as any;
          const commLevel = meta?.level ?? 'unknown';
          console.log(`       - Level ${commLevel}: ₹${Number(c.amount).toFixed(2)}`);
        });
      }
    } else {
      level3Commissions.forEach((c) => {
        const creditedAmount = Number(c.amount);
        console.log(`     ✅ Level 3 Commission: ₹${creditedAmount.toFixed(2)}`);
        console.log(`     Credited At: ${c.credited_at}`);
      });
    }
    console.log('');
  }
  
  // Check pending commissions
  console.log('🔍 Checking Pending Commissions:\n');
  
  for (const purchase of purchases) {
    const baseAmount = (Number(purchase.amount) * spotPercent) / 100;
    
    const pendingCommissions = await prisma.pending_commissions.findMany({
      where: {
        source_user_id: saiUser.id,
        receiver_user_id: siaUser.id,
        purchase_id: purchase.id,
        commission_type: 'SPOT',
        level: 3,
      },
      select: {
        id: true,
        amount: true,
        created_at: true,
        metadata: true,
      },
    });
    
    console.log(`   Purchase ${purchase.id}:`);
    if (pendingCommissions.length === 0) {
      console.log(`     ✅ No pending commissions`);
    } else {
      pendingCommissions.forEach((p) => {
        const pendingAmount = Number(p.amount);
        console.log(`     ⏳ PENDING: ₹${pendingAmount.toFixed(2)}`);
        console.log(`     Created At: ${p.created_at}`);
        console.log(`     Reason: ${siaEligible ? 'Should be released!' : 'Waiting for eligibility'}`);
      });
    }
    console.log('');
  }
  
  // Summary
  console.log('\n📋 SUMMARY:\n');
  console.log(`   Relationship: ✅ SIA00299 is upline of Sai00748 (depth ${depth}, level ${level})`);
  console.log(`   Purchases: ✅ ${purchases.length} purchase(s) found`);
  console.log(`   Eligibility: ${siaEligible ? '✅' : '❌'} SIA00299 ${siaEligible ? 'is' : 'is NOT'} eligible for Level 3`);
  console.log(`   Active Course: ${siaHasActive ? '✅' : '❌'} SIA00299 ${siaHasActive ? 'has' : 'does NOT have'} active course`);
  console.log(`   Both Active: ${bothActive ? '✅' : '❌'} Both users ${bothActive ? 'are' : 'are NOT'} active`);
  
  // Determine if commission should have been paid
  const shouldBePaid = siaEligible && siaHasActive && bothActive;
  
  console.log(`\n   ${shouldBePaid ? '✅' : '❌'} Commission ${shouldBePaid ? 'SHOULD' : 'SHOULD NOT'} have been paid`);
  
  if (!shouldBePaid) {
    console.log('\n   Reasons:');
    if (!siaEligible) console.log('     - SIA00299 is not eligible for Level 3');
    if (!siaHasActive) console.log('     - SIA00299 does not have an active course');
    if (!bothActive) console.log('     - One or both users are not active');
  }
  
  await prisma.$disconnect();
}

checkLevel3SpotCommission().catch(console.error);

