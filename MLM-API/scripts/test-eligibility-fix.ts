import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';
import dotenv from 'dotenv';
import { addMonths } from '../src/utils/dateUtils.js';

dotenv.config();

const prisma = new PrismaClient();

async function testEligibilityFix() {
  console.log('🧪 Testing Eligibility Fix...\n');
  
  // Get the test purchase request
  const request = await prisma.purchase_requests.findUnique({
    where: { id: 15 }
  });
  
  if (!request) {
    console.log('❌ Purchase request not found');
    await prisma.$disconnect();
    return;
  }
  
  const user = await prisma.users.findUnique({ where: { id: request.user_id } });
  const pkg = await prisma.packages.findUnique({ where: { id: request.package_id } });
  
  console.log(`📦 Purchase Request: ${user?.display_id} - ₹${request.amount}`);
  console.log(`📦 Package: ${pkg?.name}\n`);
  
  // Check SIA00300 eligibility BEFORE
  const beforeEligibility = await prisma.level_eligibility.findUnique({
    where: { user_id: BigInt(281) }, // SIA00300
    select: { eligibility: true }
  });
  console.log('📊 SIA00300 Eligibility BEFORE:', JSON.stringify(beforeEligibility?.eligibility, null, 2));
  
  // Check commission count BEFORE
  const beforeCount = await prisma.ledger_entries.count({
    where: {
      receiver_user_id: BigInt(281), // SIA00300
      source_user_id: BigInt(446), // SIA00465
      commission_type: 'SPOT'
    }
  });
  console.log(`💰 SIA00300 Commission Count BEFORE: ${beforeCount}\n`);
  
  // Create purchase (simulating admin approval)
  console.log('🔄 Creating purchase...');
  const purchasedAt = new Date();
  const activeUntil = addMonths(purchasedAt, pkg?.duration_months || 12);
  
  const purchase = await prisma.purchases.create({
    data: {
      user_id: request.user_id,
      package_id: request.package_id,
      amount: request.amount,
      status: 'completed',
      purchased_at: purchasedAt,
      active_until: activeUntil,
      is_renewal: false,
      effective_global_ids: null,
      income: 0
    }
  });
  console.log(`✅ Purchase created: ID ${purchase.id}\n`);
  
  // Call handlePurchase (this should recalculate eligibility BEFORE checking)
  console.log('🔄 Calling handlePurchase (should recalculate eligibility FIRST)...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await CommissionService.handlePurchase(purchase.id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check SIA00300 eligibility AFTER
  const afterEligibility = await prisma.level_eligibility.findUnique({
    where: { user_id: BigInt(281) }, // SIA00300
    select: { eligibility: true }
  });
  console.log('📊 SIA00300 Eligibility AFTER:', JSON.stringify(afterEligibility?.eligibility, null, 2));
  
  // Check commission count AFTER
  const afterCount = await prisma.ledger_entries.count({
    where: {
      receiver_user_id: BigInt(281), // SIA00300
      source_user_id: BigInt(446), // SIA00465
      commission_type: 'SPOT'
    }
  });
  console.log(`💰 SIA00300 Commission Count AFTER: ${afterCount}`);
  
  // Check if commission was created
  const commission = await prisma.ledger_entries.findFirst({
    where: {
      receiver_user_id: BigInt(281), // SIA00300
      source_user_id: BigInt(446), // SIA00465
      commission_type: 'SPOT',
      purchase_id: purchase.id
    },
    orderBy: { credited_at: 'desc' }
  });
  
  if (commission) {
    console.log(`\n✅ SUCCESS! Commission created: ₹${commission.amount}`);
    console.log(`   Commission ID: ${commission.id}`);
    console.log(`   Credited At: ${commission.credited_at}`);
  } else {
    console.log('\n❌ FAILED! Commission not created');
    
    // Check pending commissions
    const pending = await prisma.pending_commissions.findFirst({
      where: {
        receiver_user_id: BigInt(281), // SIA00300
        source_user_id: BigInt(446), // SIA00465
        commission_type: 'SPOT',
        purchase_id: purchase.id
      }
    });
    
    if (pending) {
      console.log(`⚠️  Commission is PENDING: ₹${pending.amount} (Level ${pending.level})`);
    } else {
      console.log('⚠️  Commission not found in pending either!');
    }
  }
  
  await prisma.$disconnect();
}

testEligibilityFix().catch(console.error);
