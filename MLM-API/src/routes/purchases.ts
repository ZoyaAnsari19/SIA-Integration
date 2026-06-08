import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { boss } from '../config/pgboss.js';
import { requireUser } from '../middleware/jwt.js';
import { addMonths } from '../utils/dateUtils.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { getMinReinvestmentAmount, getMinReinvestmentMessage } from '../utils/reinvestmentMinAmount.js';

const purchaseBody = z.object({
  package_id: z.coerce.number(),
  request_type: z.enum(['activation', 'renew', 'reinvestment']), // REQUIRED
  amount: z.coerce.number().optional(),
  txn_id: z.string().optional(),
  payment_proof_url: z.string().optional(),
  payment_type: z.string().optional(),
  remarks: z.string().optional(),
  is_manual: z.boolean().default(false),
  user_id: z.coerce.bigint().optional(), // For admin adding balance to other users
});

const reinvestmentCheckBody = z.object({
  amount: z.coerce.number(),
});

export async function purchasesRoutes(app: FastifyInstance) {
  // Lightweight endpoint so dashboard can check reinvestment min (50% of active package if never Main withdraw)
  // before sending user to payment gateway.
  app.post('/reinvestment/check', { preHandler: requireUser }, async (req, reply) => {
    const user = (req as any).user;
    if (!user || !user.user_id) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const body = reinvestmentCheckBody.parse(req.body);
    const targetUserId = BigInt(user.user_id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Same checks as manual reinvestment flow
    const hasActive = await CommissionService.hasActiveCourse(targetUserId, today);
    if (!hasActive) {
      return reply.code(400).send({
        error: 'invalid_request_type',
        message: 'Cannot create reinvestment request. No active purchase found. Use \"activation\" or \"renew\" instead.',
      });
    }

    const minReinvest = await getMinReinvestmentAmount(targetUserId);
    if (minReinvest.minAmount > 0 && body.amount < minReinvest.minAmount) {
      return reply.code(400).send({
        error: 'reinvestment_min_amount',
        message: getMinReinvestmentMessage(minReinvest),
        min_amount: minReinvest.minAmount,
        last_withdrawal_amount: minReinvest.lastWithdrawalAmount ?? 0,
        current_package_amount: minReinvest.currentPackageAmount ?? 0,
      });
    }

    return reply.send({
      ok: true,
      min_amount: minReinvest.minAmount,
      last_withdrawal_amount: minReinvest.lastWithdrawalAmount ?? 0,
      current_package_amount: minReinvest.currentPackageAmount ?? 0,
    });
  });

  app.post('/', { preHandler: requireUser }, async (req, reply) => {
    const user = (req as any).user;
    if (!user || !user.user_id) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    
    const body = purchaseBody.parse(req.body);
    const pkg = await prisma.packages.findUnique({ where: { id: body.package_id } });
    if (!pkg) return reply.code(400).send({ message: 'Invalid package' });

    // Use provided amount or default to package price
    const purchaseAmount = body.amount ?? Number(pkg.price);

    // Determine user_id: use provided user_id (for admin) or current user
    const targetUserId = body.user_id ? body.user_id : BigInt(user.user_id);

    // If user_id is provided and different from current user, check if current user is admin
    // For now, allow if user_id matches current user or if it's a manual purchase
    if (body.user_id && body.user_id.toString() !== user.user_id.toString() && !body.is_manual) {
      return reply.code(403).send({ error: 'forbidden', message: 'Cannot create purchase for another user' });
    }

    // Validate request_type against user's actual state (strict validation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (body.request_type === 'activation') {
      // Check: User has NO purchases OR all purchases expired AND 2x
      const allPurchases = await prisma.purchases.findMany({
        where: {
          user_id: targetUserId,
          status: 'completed',
        },
      });

      if (allPurchases.length > 0) {
        // Check if any purchase is active (not expired, not 2x)
        const hasActive = await CommissionService.hasActiveCourse(targetUserId, today);
        if (hasActive) {
          return reply.code(400).send({ 
            error: 'invalid_request_type',
            message: 'Cannot create activation request. User has active purchase. Use "reinvestment" or "renew" instead.'
          });
        }

        // Check if all purchases reached 2x
        let allReached2x = true;
        for (const purchase of allPurchases) {
          const is2xReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
          if (!is2xReached) {
            allReached2x = false;
            break;
          }
        }

        if (!allReached2x) {
          return reply.code(400).send({ 
            error: 'invalid_request_type',
            message: 'Cannot create activation request. User has purchases that have not reached 2x. Use "reinvestment" or "renew" instead.'
          });
        }
      }
    }

    if (body.request_type === 'renew') {
      // Check: User has expired OR 2x reached purchase
      const { isRenewal } = await CommissionService.checkIfRenewal(targetUserId);
      if (!isRenewal) {
        return reply.code(400).send({ 
          error: 'invalid_request_type',
          message: 'Cannot create renew request. No expired or 2x reached purchase found. Use "activation" or "reinvestment" instead.'
        });
      }
    }

    if (body.request_type === 'reinvestment') {
      // Check: User has active purchase (not expired, not 2x)
      const hasActive = await CommissionService.hasActiveCourse(targetUserId, today);
      if (!hasActive) {
        return reply.code(400).send({ 
          error: 'invalid_request_type',
          message: 'Cannot create reinvestment request. No active purchase found. Use "activation" or "renew" instead.'
        });
      }
      // Reinvestment min amount: 2× last Main withdrawal OR 50% of current package (if never withdrew from Main)
      const minReinvest = await getMinReinvestmentAmount(targetUserId);
      if (minReinvest.minAmount > 0 && purchaseAmount < minReinvest.minAmount) {
        return reply.code(400).send({
          error: 'reinvestment_min_amount',
          message: getMinReinvestmentMessage(minReinvest),
        });
      }
    }

    // Check if user already has a pending purchase request
    const existingPendingRequest = await prisma.purchase_requests.findFirst({
      where: {
        user_id: targetUserId,
        status: 'pending',
      },
    });

    if (existingPendingRequest) {
      return reply.code(400).send({
        error: 'pending_request_exists',
        message: 'You already have a pending purchase request. Please wait for admin approval or rejection before creating a new request.',
      });
    }

    // Create purchase request instead of direct purchase
    const request = await prisma.purchase_requests.create({
      data: {
        user_id: targetUserId,
        package_id: body.package_id,
        request_type: body.request_type,
        amount: purchaseAmount,
        status: 'pending',
        txn_id: body.txn_id || null,
        payment_proof_url: body.payment_proof_url || null,
        payment_type: body.payment_type || null,
        remarks: body.remarks || null,
      },
    });

    return reply.code(201).send({ 
      request: {
        id: request.id.toString(),
        user_id: request.user_id.toString(),
        package_id: request.package_id,
        request_type: request.request_type,
        status: request.status,
        amount: Number(request.amount),
        created_at: request.created_at,
      },
      message: 'Purchase request created. Awaiting admin approval.'
    });
  });

  /**
   * @openapi
   * /api/v1/purchases/{id}/commissions:
   *   get:
   *     tags:
   *       - Purchases
   *     summary: Get commissions from a purchase
   *     description: |
   *       Retrieve all commissions generated from a specific purchase.
   *       Includes both ledger entries (credited) and pending commissions.
   *     operationId: getPurchaseCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Purchase ID
   *     responses:
   *       '200':
   *         description: Commissions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 purchase_id:
   *                   type: string
   *                 credited_commissions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       commission_type:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       receiver_user_id:
   *                         type: string
   *                       receiver_name:
   *                         type: string
   *                         nullable: true
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                 pending_commissions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       commission_type:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       receiver_user_id:
   *                         type: string
   *                       receiver_name:
   *                         type: string
   *                         nullable: true
   *                 scheduled_commissions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       commission_type:
   *                         type: string
   *                       monthly_amount:
   *                         type: number
   *                       receiver_user_id:
   *                         type: string
   *                       receiver_name:
   *                         type: string
   *                         nullable: true
   *                       start_date:
   *                         type: string
   *                         format: date
   *                       end_date:
   *                         type: string
   *                         format: date
   *       '404':
   *         description: Purchase not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions', {
    preHandler: requireUser,
    schema: {
      description: 'Get commissions from a purchase',
      tags: ['Purchases'],
      summary: 'Get Purchase Commissions',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            purchase_id: { type: 'string' },
            credited_commissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  commission_type: { type: 'string' },
                  amount: { type: 'number' },
                  receiver_user_id: { type: 'string' },
                  receiver_name: { type: ['string', 'null'] },
                  credited_at: { type: 'string', format: 'date-time' },
                },
              },
            },
            pending_commissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  commission_type: { type: 'string' },
                  amount: { type: 'number' },
                  receiver_user_id: { type: 'string' },
                  receiver_name: { type: ['string', 'null'] },
                },
              },
            },
            scheduled_commissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  commission_type: { type: 'string' },
                  monthly_amount: { type: 'number' },
                  receiver_user_id: { type: 'string' },
                  receiver_name: { type: ['string', 'null'] },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const purchaseId = BigInt((req.params as any).id);

      // Check if purchase exists
      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
      });

      if (!purchase) {
        return reply.code(404).send({ error: 'Purchase not found' });
      }

      // Get all commissions related to this purchase
      const [credited, pending, scheduled] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { purchase_id: purchaseId },
          orderBy: { credited_at: 'desc' },
        }),
        prisma.pending_commissions.findMany({
          where: { purchase_id: purchaseId },
        }),
        // NOTE: scheduled_commissions table removed (Dec 20, 2025)
        Promise.resolve([] as any[]), // Return empty array
      ]);

      // Get user names for all receivers
      const receiverIds = [
        ...new Set([
          ...credited.map(c => c.receiver_user_id.toString()),
          ...pending.map(p => p.receiver_user_id.toString()),
          // scheduled_commissions removed
        ]),
      ];

      const users = await prisma.users.findMany({
        where: { id: { in: receiverIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id.toString(), u.name]));

      return reply.send({
        purchase_id: purchaseId.toString(),
        credited_commissions: credited.map(c => ({
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          receiver_user_id: c.receiver_user_id.toString(),
          receiver_name: userMap.get(c.receiver_user_id.toString()) ?? null,
          credited_at: c.credited_at,
        })),
        pending_commissions: pending.map(p => ({
          id: p.id.toString(),
          commission_type: p.commission_type,
          amount: Number(p.amount),
          receiver_user_id: p.receiver_user_id.toString(),
          receiver_name: userMap.get(p.receiver_user_id.toString()) ?? null,
        })),
        scheduled_commissions: scheduled.map(s => ({
          id: s.id.toString(),
          commission_type: s.commission_type,
          monthly_amount: Number(s.monthly_amount),
          receiver_user_id: s.receiver_user_id.toString(),
          receiver_name: userMap.get(s.receiver_user_id.toString()) ?? null,
          start_date: s.start_date,
          end_date: s.end_date,
        })),
      });
    } catch (error) {
      console.error('Error getting purchase commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/purchases/{id}:
   *   get:
   *     tags:
   *       - Purchases
   *     summary: Get purchase details
   *     description: |
   *       Retrieve detailed information about a specific purchase.
   *       Users can only view their own purchases.
   *     operationId: getPurchaseById
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Purchase ID
   *     responses:
   *       '200':
   *         description: Purchase details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 user_id:
   *                   type: string
   *                 package_id:
   *                   type: number
   *                 package:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: number
   *                     name:
   *                       type: string
   *                     price:
   *                       type: number
   *                 amount:
   *                   type: number
   *                 status:
   *                   type: string
   *                 purchased_at:
   *                   type: string
   *                   format: date-time
   *                 // active_until removed
   *                   type: string
   *                   format: date-time
   *                 is_active:
   *                   type: boolean
   *       '404':
   *         description: Purchase not found or access denied
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Get purchase details',
      tags: ['Purchases'],
      summary: 'Get Purchase',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            package_id: { type: 'number' },
            package: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                price: { type: 'number' },
              },
            },
            amount: { type: 'number' },
            status: { type: 'string' },
            purchased_at: { type: 'string' },
            // active_until removed - expiry is ONLY based on 2x income
            is_active: { type: 'boolean' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const purchaseId = BigInt((req.params as any).id);
      const user = (req as any).user;

      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
      });

      if (!purchase) {
        return reply.code(404).send({ error: 'Purchase not found' });
      }

      // Check if user owns this purchase
      if (purchase.user_id.toString() !== user.user_id) {
        return reply.code(404).send({ error: 'Purchase not found' });
      }

      // Get package details
      const pkg = await prisma.packages.findUnique({
        where: { id: purchase.package_id },
        select: { id: true, name: true, price: true },
      });

      // Expiry is based on 2x income (self + global), NOT active_until date
      const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
      const isActive = purchase.status === 'completed' && !isDoubleReached;

      return reply.send({
        id: purchase.id.toString(),
        user_id: purchase.user_id.toString(),
        package_id: purchase.package_id,
        package: pkg ? {
          id: pkg.id,
          name: pkg.name,
          price: Number(pkg.price),
        } : null,
        amount: Number(purchase.amount),
        status: purchase.status,
        purchased_at: purchase.purchased_at,
        // active_until removed - expiry is ONLY based on 2x income
        is_active: isActive,
      });
    } catch (error) {
      console.error('Error getting purchase:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/purchases/renew:
   *   post:
   *     tags:
   *       - Purchases
   *     summary: Renew package (upgrade or same package)
   *     description: |
   *       Renew user's package. Can renew with same package or upgrade to bigger package.
   *       For same package: effective_global_ids = 0 (no additional IDs)
   *       For bigger package: effective_global_ids = new package's global_ids (full new cap)
   *     operationId: renewPackage
   *     security:
   *       - bearerAuth: []
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
   *                 description: Package ID to renew with
   *               amount:
   *                 type: number
   *                 description: Optional custom amount (defaults to package price)
   *               txn_id:
   *                 type: string
   *                 description: Transaction ID
   *               payment_proof_url:
   *                 type: string
   *                 description: Payment proof URL
   *               payment_type:
   *                 type: string
   *                 description: Payment type (UPI, bank, etc.)
   *     responses:
   *       '201':
   *         description: Package renewed successfully
   *       '400':
   *         description: Invalid package or no expired/2x purchase found
   *       '401':
   *         description: Unauthorized
   */
  app.post('/renew', {
    preHandler: requireUser,
    schema: {
      description: 'Renew package (upgrade or same package) - Creates purchase request',
      tags: ['Purchases'],
      summary: 'Renew Package',
      body: {
        type: 'object',
        required: ['package_id'],
        properties: {
          package_id: { type: 'number' },
          amount: { type: 'number' },
          txn_id: { type: 'string' },
          payment_proof_url: { type: 'string' },
          payment_type: { type: 'string' },
          remarks: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            request: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                user_id: { type: 'string' },
                package_id: { type: 'number' },
                request_type: { type: 'string' },
                status: { type: 'string' },
                amount: { type: 'number' },
                created_at: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const user = (req as any).user;
    if (!user || !user.user_id) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    
    const renewBody = z.object({
      package_id: z.coerce.number(),
      previous_package_id: z.coerce.number().optional(), // For upgrades: expired package's package_id
      previous_purchase_id: z.string().transform((val) => val ? BigInt(val) : undefined).optional(), // For upgrades/renew: exact expired purchase id (string to BigInt)
      amount: z.coerce.number().optional(),
      txn_id: z.string().optional(),
      payment_proof_url: z.string().optional(),
      payment_type: z.string().optional(),
      remarks: z.string().optional(),
    });
    
    const body = renewBody.parse(req.body);
    
    const pkg = await prisma.packages.findUnique({ where: { id: body.package_id } });
    if (!pkg) return reply.code(400).send({ message: 'Invalid package' });

    const targetUserId = BigInt(user.user_id);

    // Check if user has expired or 2x reached purchase (required for renewal)
    const { isRenewal } = await CommissionService.checkIfRenewal(targetUserId);
    
    if (!isRenewal) {
      return reply.code(400).send({ 
        error: 'invalid_request_type',
        message: 'Cannot create renew request. No expired or 2x reached purchase found. Use "activation" or "reinvestment" instead.'
      });
    }

    const purchaseAmount = body.amount ?? Number(pkg.price);

    // Create purchase request with request_type=renew
    // If previous_package_id is provided, it's an upgrade; otherwise same package renewal
    const request = await prisma.purchase_requests.create({
      data: {
        user_id: targetUserId,
        package_id: body.package_id,
        previous_package_id: body.previous_package_id || null,
        previous_purchase_id: body.previous_purchase_id || null,
        request_type: 'renew',
        amount: purchaseAmount,
        status: 'pending',
        txn_id: body.txn_id || null,
        payment_proof_url: body.payment_proof_url || null,
        payment_type: body.payment_type || null,
        remarks: body.remarks || null,
      },
    });

    return reply.code(201).send({ 
      request: {
        id: request.id.toString(),
        user_id: request.user_id.toString(),
        package_id: request.package_id,
        request_type: request.request_type,
        status: request.status,
        amount: Number(request.amount),
        created_at: request.created_at,
      },
      message: 'Renewal request created. Awaiting admin approval.'
    });
  });
}


