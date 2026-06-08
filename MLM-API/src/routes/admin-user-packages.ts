import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { boss } from '../config/pgboss.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';
import { resetSpotTeamWithdrawUsed } from '../utils/spotTeamWithdrawLimit.js';

const assignPackageBody = z.object({
  package_id: z.coerce.number(),
  used_ids: z.coerce.number().optional().default(0),
  income: z.coerce.number().optional().default(0),
});

export async function adminUserPackagesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/users/{id}/assign-package:
   *   post:
   *     tags:
   *       - Admin Users
   *     summary: Assign package to user (Admin only)
   *     description: |
     *       Admin can manually assign a package to a user with custom settings:
     *       - Set used IDs (must be <= package.global_ids)
     *       - Set initial income (for 2x progress tracking)
   *     operationId: assignPackageToUser
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - package_id
   *             properties:
   *               package_id:
   *                 type: number
   *                 example: 1
   *               used_ids:
   *                 type: number
   *                 example: 10
   *                 description: Number of used global IDs (must be <= package.global_ids)
   *               income:
   *                 type: number
   *                 example: 0
   *                 description: Initial income for 2x progress tracking
   *     responses:
   *       '200':
   *         description: Package assigned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Package assigned successfully"
   *                 purchase_id:
   *                   type: string
   *                   example: "123"
   *       '400':
   *         description: Bad request (invalid package or validation error)
   *       '404':
   *         description: User or package not found
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.post('/users/:id/assign-package', {
    preHandler: [adminAuth, checkPermission('PACKAGE_ASSIGN')],
    schema: {
      description: 'Assign package to user (Admin only)',
      tags: ['Admin Users'],
      summary: 'Assign Package to User',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['package_id'],
        properties: {
          package_id: { type: 'number' },
          used_ids: { type: 'number' },
          income: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            purchase_id: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const body = assignPackageBody.parse(req.body);
      const admin = (req as any).admin;

      // Verify user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Verify package exists
      const pkg = await prisma.packages.findUnique({
        where: { id: body.package_id },
      });

      if (!pkg) {
        return reply.code(404).send({ error: 'Package not found' });
      }

      if (pkg.status !== 'active') {
        return reply.code(400).send({ error: 'Package is not active' });
      }

      // Validate used_ids doesn't exceed package global_ids
      const packageGlobalIds = pkg.global_ids || 0;
      const usedIds = Math.min(Math.max(0, body.used_ids || 0), packageGlobalIds);

      // Validate income doesn't exceed (2x package amount - 1 rupee)
      // Package expires at exactly 2x, so max allowed is 1 rupee less to keep it active
      const packagePrice = Number(pkg.price);
      const maxIncome = (packagePrice * 2) - 1; // 1 rupee less than 2x to keep package active
      const enteredIncome = body.income || 0;
      
      if (enteredIncome > maxIncome) {
        return reply.code(400).send({ 
          error: 'Invalid income amount',
          message: `Initial Income cannot exceed ₹${maxIncome.toFixed(2)} (1 rupee less than 2x package amount = ₹${(packagePrice * 2).toFixed(2)}). Package expires when income reaches exactly 2x the package amount.`
        });
      }

      // Get admin user_id for txn_id
      const adminUserId = admin?.user_id || admin?.id || '1';

      // Create purchase record
      const purchase = await prisma.purchases.create({
        data: {
          user_id: userId,
          package_id: body.package_id,
          purchase_type: 'DIRECT_PACKAGE',
          amount: Number(pkg.price),
          purchased_at: new Date(),
          status: 'completed',
          is_manual: true,
          is_renewal: false,
          income: body.income || 0,
          // Set effective_global_ids to used_ids if provided (for manual assignment)
          effective_global_ids: usedIds > 0 ? usedIds : null,
          txn_id: `ADMIN-${adminUserId}-${Date.now()}`,
          payment_type: 'admin_assignment',
        },
      });

      // Phase 2: Reset 10x withdrawal cycle on package assign
      await resetSpotTeamWithdrawUsed(userId);

      // Queue commission job
      try {
        const jobId = await boss.send(
          'purchase-commission',
          { purchaseId: purchase.id.toString() },
          { retryLimit: 3, retryDelay: 30 }
        );
        console.log(`✅ Commission job queued for purchase ${purchase.id}: ${jobId}`);
      } catch (error) {
        console.error(`❌ Error queueing commission job:`, error);
        // Fallback to immediate processing
        console.log(`⚠️ Falling back to immediate processing...`);
        await CommissionService.handlePurchase(purchase.id);
      }

      // Log admin activity
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'PACKAGE_ASSIGN',
          targetUserId: userId,
          targetEntityType: 'package',
          targetEntityId: purchase.id.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            package_id: body.package_id,
            package_name: pkg.name,
            package_price: Number(pkg.price),
            used_ids: usedIds,
            initial_income: body.income || 0,
            purchase_id: purchase.id.toString(),
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        success: true,
        message: 'Package assigned successfully',
        purchase_id: purchase.id.toString(),
      });
    } catch (error: any) {
      console.error('Error assigning package:', error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Validation error',
          message: error.errors.map((e: any) => e.message).join(', '),
        });
      }

      return reply.code(500).send({
        error: 'Failed to assign package',
        message: error.message || 'Internal server error',
      });
    }
  });
}

