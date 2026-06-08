import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../src/modules/commissions/commission.service.js';

const prisma = new PrismaClient();

async function recalcUserEligibility() {
  try {
    const userId = BigInt(50); // User 2047
    
    console.log(`\n🔄 Recalculating eligibility for user ${userId}...`);
    
    // Recalculate eligibility - this will trigger MONTHLY scheduling for all eligible levels
    await CommissionService.recalculateEligibility();
    
    console.log(`✅ Eligibility recalculated for all users`);
    
    // Check scheduled MONTHLY for user 50 from Level-2 users (153, 154, 155, 156)
    const scheduled = await prisma.scheduled_commissions.findMany({
      where: {
        receiver_user_id: userId,
        source_user_id: { in: [BigInt(153), BigInt(154), BigInt(155), BigInt(156)] },
        commission_type: 'MONTHLY',
      },
      orderBy: { id: 'asc' },
    });
    
    console.log(`\n📊 MONTHLY scheduled for user ${userId} from Level-2 users (153,154,155,156):`);
    console.log(`   Count: ${scheduled.length}`);
    if (scheduled.length > 0) {
      scheduled.forEach(s => {
        console.log(`   - Source: ${s.source_user_id}, Amount: ₹${Number(s.monthly_amount).toFixed(2)}/month, Start: ${s.start_date.toISOString().split('T')[0]}`);
      });
    } else {
      console.log(`   ⚠️  No MONTHLY scheduled yet`);
    }
    
    console.log(`\n✅ Done!`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

recalcUserEligibility();

