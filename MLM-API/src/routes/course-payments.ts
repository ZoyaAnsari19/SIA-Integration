import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';
import { CommissionService } from '../modules/commissions/commission.service';

export async function coursePaymentsRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/payments/test-purchase
   * Test mode: Direct purchase without payment (DISABLED IN PRODUCTION)
   * Only for development/testing - requires admin approval in production
   */
  app.post('/test-purchase', {
    preHandler: requireUser,
    schema: {
      description: 'Test purchase (DEVELOPMENT ONLY - DISABLED)',
      tags: ['Payments'],
      summary: 'Test Purchase (DEV ONLY)',
      body: {
        type: 'object',
        properties: {
          courseIds: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['courseIds']
      }
    }
  }, async (request, reply) => {
    // PRODUCTION: Disable test purchases
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({ 
        error: 'forbidden',
        message: 'Test purchases are disabled in production. Use real payment gateway or manual deposit with admin approval.'
      });
    }
    const userId = BigInt((request as any).user.user_id);
    const { courseIds } = request.body as { courseIds: string[] };

    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return reply.status(400).send({ error: 'Course IDs are required' });
    }

    const purchases = [];

    for (const courseId of courseIds) {
      // Check if course exists
      const course = await prisma.courses.findUnique({
        where: { id: courseId },
      });

      if (!course || !course.is_published || !course.package_id) {
        continue; // Skip invalid courses
      }

      // Check if already purchased
      const existingPurchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: courseId,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });

      if (existingPurchase) {
        continue; // Skip already purchased
      }

      // Get package details
      const pkg = await prisma.packages.findUnique({
        where: { id: course.package_id }
      });

      if (!pkg) continue;

      // NOTE: active_until removed - expiry is ONLY based on 2x income, NOT date
      // Create purchase record
      const purchase = await prisma.purchases.create({
        data: {
          user_id: userId,
          package_id: course.package_id,
          course_id: courseId,
          purchase_type: 'COURSE_PURCHASE',
          amount: course.price,
          status: 'completed',
          payment_type: 'test',
          purchased_at: new Date(),
          // active_until removed - expiry is ONLY based on 2x income
          txn_id: `TEST_${Date.now()}`,
          income: 0, // Always 0 for new purchases (fresh start for 2x tracking)
        },
      });

      // Remove from cart
      await prisma.course_cart_entries.deleteMany({
        where: {
          user_id: userId,
          course_id: courseId,
        },
      });

      // Update course student count
      await prisma.courses.update({
        where: { id: courseId },
        data: {
          total_students: {
            increment: 1,
          },
        },
      });

      // Trigger MLM commissions
      try {
        await CommissionService.handlePurchase(purchase.id);
      } catch (error) {
        console.error('Error triggering commissions:', error);
      }

      purchases.push(purchase);
    }

    return reply.send({
      message: 'Test purchase completed successfully',
      purchases: purchases.map(p => ({
        id: p.id.toString(),
        course_id: p.course_id,
        package_id: p.package_id,
        amount: Number(p.amount),
      })),
    });
  });
}

