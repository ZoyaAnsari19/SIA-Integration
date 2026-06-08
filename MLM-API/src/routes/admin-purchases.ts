import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { PackageStatusService } from '../modules/purchases/package-status.service.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { resetSpotTeamWithdrawUsed } from '../utils/spotTeamWithdrawLimit.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';

type GatewayFlowType = 'NEW_PURCHASE' | 'REINVESTMENT' | 'RENEWAL' | 'UPGRADE';

/**
 * Classify a gateway purchase into a high-level flow type without changing business logic.
 *
 * Rules:
 * - If is_renewal = true:
 *   - previous_package_id != package_id and previous_package_id not null → UPGRADE
 *   - otherwise → RENEWAL
 * - Else (is_renewal = false):
 *   - If purchased_at equals user's first completed purchase date → NEW_PURCHASE
 *   - Otherwise → REINVESTMENT
 *
 * firstPurchaseMap maps user_id.toString() → earliest completed purchase date for that user.
 */
function classifyGatewayPurchase(
  purchase: {
    user_id: bigint;
    package_id: number;
    is_renewal: boolean | null;
    previous_package_id: number | null;
    purchased_at: Date;
  },
  firstPurchaseMap: Map<string, Date | null>,
): GatewayFlowType {
  if (purchase.is_renewal) {
    if (purchase.previous_package_id && purchase.previous_package_id !== purchase.package_id) {
      return 'UPGRADE';
    }
    return 'RENEWAL';
  }

  const userKey = purchase.user_id.toString();
  const firstPurchaseDate = firstPurchaseMap.get(userKey);

  if (firstPurchaseDate) {
    const currentTime = new Date(purchase.purchased_at).getTime();
    const firstTime = new Date(firstPurchaseDate).getTime();
    if (currentTime === firstTime) {
      return 'NEW_PURCHASE';
    }
  }

  return 'REINVESTMENT';
}

export async function adminPurchasesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/purchases:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: List all purchases (Admin view)
   *     description: |
   *       Retrieve a paginated list of all purchases with filtering and sorting options.
   *       This endpoint provides admin-level access to all purchases across all users.
   *     operationId: listAllPurchasesAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *         description: Number of items per page
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         description: Filter by user ID
   *       - in: query
   *         name: package_id
   *         schema:
   *           type: integer
   *         description: Filter by package ID
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [completed, pending, cancelled]
   *         description: Filter by purchase status
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter purchases from this date
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter purchases until this date
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [id, purchased_at, amount, user_id]
   *           default: purchased_at
   *         description: Sort field
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *     responses:
   *       '200':
   *         description: List of purchases retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 20
   *                 page:
   *                   type: number
   *                   example: 1
   *                 limit:
   *                   type: number
   *                   example: 20
   *                 total_pages:
   *                   type: number
   *                   example: 5
   *                 total:
   *                   type: number
   *                   example: 100
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "15"
   *                       user_id:
   *                         type: string
   *                         example: "7"
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Test User"
   *                       user_email:
   *                         type: string
   *                         nullable: true
   *                         example: "test@example.com"
   *                       package_id:
   *                         type: number
   *                         example: 1
   *                       package_name:
   *                         type: string
   *                         example: "Premium Package"
   *                       amount:
   *                         type: number
   *                         example: 2500.00
   *                       status:
   *                         type: string
   *                         example: "completed"
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *                       // active_until removed
   *                         type: string
   *                         format: date-time
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/purchases', {
    preHandler: adminAuth,
    schema: {
      description: 'List all purchases (Admin view with pagination and filtering)',
      tags: ['Admin Purchases'],
      summary: 'List Purchases',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          user_id: { type: 'string' },
          package_id: { type: 'number' },
          status: { type: 'string', enum: ['completed', 'pending', 'cancelled'] },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          sort: { type: 'string', enum: ['id', 'purchased_at', 'amount', 'user_id'], default: 'purchased_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  user_email: { type: ['string', 'null'] },
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  amount: { type: 'number' },
                  status: { type: 'string' },
                  purchased_at: { type: 'string' },
                  // active_until removed - expiry is ONLY based on 2x income
                },
              },
            },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const userId = (req.query as any).user_id;
      const packageId = (req.query as any).package_id;
      const status = (req.query as any).status;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const sort = (req.query as any).sort || 'purchased_at';
      const order = (req.query as any).order || 'desc';

      const where: any = {};
      if (userId) {
        where.user_id = BigInt(userId);
      }
      if (packageId) {
        where.package_id = parseInt(packageId, 10);
      }
      if (status) {
        where.status = status;
      }
      if (startDate || endDate) {
        where.purchased_at = {};
        if (startDate) {
          where.purchased_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.purchased_at.lte = new Date(endDate);
        }
      }

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { [sort]: order },
          skip: offset,
          take: limit,
        }),
        prisma.purchases.count({ where }),
      ]);

      // Get user details and package details for each purchase
      const userIds = [...new Set(purchases.map(p => p.user_id.toString()))];
      const packageIds = [...new Set(purchases.map(p => p.package_id))];

      const [users, packages] = await Promise.all([
        prisma.users.findMany({
          where: {
            id: { in: userIds.map(id => BigInt(id)) },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        }),
        prisma.packages.findMany({
          where: {
            id: { in: packageIds },
          },
          select: {
            id: true,
            name: true,
          },
        }),
      ]);

      const userMap = new Map(users.map(u => [u.id.toString(), { name: u.name, email: u.email }]));
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      // Convert to response format
      const items = purchases.map(purchase => {
        const user = userMap.get(purchase.user_id.toString());
        return {
          id: purchase.id.toString(),
          user_id: purchase.user_id.toString(),
          user_name: user?.name ?? null,
          user_email: user?.email ?? null,
          package_id: purchase.package_id,
          package_name: packageMap.get(purchase.package_id) ?? 'Unknown',
          amount: Number(purchase.amount),
          status: purchase.status,
          purchased_at: purchase.purchased_at,
          // active_until removed - expiry is ONLY based on 2x income
        };
      });

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: totalPages,
        total,
        items,
      });
    } catch (error) {
      console.error('Error listing purchases:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/purchases/{id}:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: Get single purchase details (Admin view)
   *     description: |
   *       Retrieve detailed information about a specific purchase by ID.
   *       This endpoint provides comprehensive purchase details including user and package information.
   *     operationId: getPurchaseByIdAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Purchase ID
   *         example: "15"
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
   *                   example: "15"
   *                 user_id:
   *                   type: string
   *                   example: "7"
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "7"
   *                     name:
   *                       type: string
   *                       nullable: true
   *                       example: "Test User"
   *                     email:
   *                       type: string
   *                       nullable: true
   *                       example: "test@example.com"
   *                 package_id:
   *                   type: number
   *                   example: 1
   *                 package:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: number
   *                       example: 1
   *                     name:
   *                       type: string
   *                       example: "Premium Package"
   *                     price:
   *                       type: number
   *                       example: 2500.00
   *                 amount:
   *                   type: number
   *                   example: 2500.00
   *                 status:
   *                   type: string
   *                   example: "completed"
   *                 purchased_at:
   *                   type: string
   *                   format: date-time
   *                 // active_until removed
   *                   type: string
   *                   format: date-time
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: Purchase not found
   *       '500':
   *         description: Internal server error
   */
  app.get('/purchases/:id', {
    preHandler: adminAuth,
    schema: {
      description: 'Get single purchase details (Admin view)',
      tags: ['Admin Purchases'],
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
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
              },
            },
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
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const purchaseId = BigInt((req.params as any).id);

      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
      });

      if (!purchase) {
        return reply.code(404).send({ error: 'Purchase not found' });
      }

      // Get user and package details
      const [user, pkg] = await Promise.all([
        prisma.users.findUnique({
          where: { id: purchase.user_id },
          select: {
            id: true,
            name: true,
            email: true,
          },
        }),
        prisma.packages.findUnique({
          where: { id: purchase.package_id },
          select: {
            id: true,
            name: true,
            price: true,
          },
        }),
      ]);

      return reply.send({
        id: purchase.id.toString(),
        user_id: purchase.user_id.toString(),
        user: user ? {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
        } : null,
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
      });
    } catch (error) {
      console.error('Error getting purchase:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/purchases/by-user:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: Filter purchases by user
   *     description: |
   *       Retrieve all purchases for a specific user with pagination.
   *       Includes user and package details.
   *     operationId: getPurchasesByUser
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID to filter by
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *         description: Number of items per page
   *     responses:
   *       '200':
   *         description: Purchases retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                 page:
   *                   type: number
   *                 limit:
   *                   type: number
   *                 total_pages:
   *                   type: number
   *                 total:
   *                   type: number
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       user_id:
   *                         type: string
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                       package_id:
   *                         type: number
   *                       package_name:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       status:
   *                         type: string
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *       '400':
   *         description: Bad request - user_id required
   *       '401':
   *         description: Unauthorized
   */
  app.get('/purchases/by-user', {
    preHandler: adminAuth,
    schema: {
      description: 'Filter purchases by user',
      tags: ['Admin Purchases'],
      summary: 'Get Purchases by User',
      querystring: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  amount: { type: 'number' },
                  income: { type: 'number' },
                  status: { type: 'string' },
                  purchased_at: { type: 'string' },
                  // active_until removed - expiry is ONLY based on 2x income
                  is_active: { type: 'boolean' },
                  is_renewal: { type: 'boolean' },
                  previous_package_id: { type: ['number', 'null'] },
                  global_ids_info: {
                    type: ['object', 'null'],
                    nullable: true,
                    properties: {
                      package_cap: { type: 'number' },
                      used_ids: { type: 'number' },
                      remaining_ids: { type: 'number' },
                      is_cap_reached: { type: 'boolean' },
                      new_ids_after_cap: { type: ['number', 'null'] },
                      cap_exceed_loss: { type: ['number', 'null'] },
                      total_global_users: { type: 'number' },
                      contributors_raw_in_window: { type: 'number' },
                      contributors_active_in_window: { type: 'number' },
                      inactive_global_contributors: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = (req.query as any).user_id;
      if (!userId) {
        return reply.code(400).send({ error: 'user_id is required' });
      }

      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const where = { user_id: BigInt(userId) };

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { purchased_at: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            user_id: true,
            package_id: true,
            amount: true,
            income: true,
            status: true,
            purchased_at: true,
            // active_until removed - expiry is ONLY based on 2x income
            is_renewal: true,
            previous_package_id: true,
          },
        }),
        prisma.purchases.count({ where }),
      ]);

      // Get user and package details
      const user = await prisma.users.findUnique({
        where: { id: BigInt(userId) },
        select: { name: true },
      });

      const packageIds = [...new Set(purchases.map(p => p.package_id))];
      const packages = await prisma.packages.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true },
      });
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      const now = new Date();
      
      // Calculate detailed info for each purchase (income progress, global IDs, etc.)
      const items = await Promise.all(
        purchases.map(async (p) => {
          // Check if purchase has reached 2x (expiry is based on 2x, not active_until date)
          const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
          const isActive = p.status === 'completed' && !isDoubleReached;

          // Calculate global IDs info for active purchases
          let globalIdsInfo = null;
          if (isActive) {
            try {
              globalIdsInfo = await PackageStatusService.calculateGlobalIdsInfo(p.id, p.user_id);
            } catch (error) {
              console.error('Error calculating global IDs info:', error);
            }
          }

          return {
            id: p.id.toString(),
            user_id: p.user_id.toString(),
            user_name: user?.name ?? null,
            package_id: p.package_id,
            package_name: packageMap.get(p.package_id) ?? 'Unknown',
            amount: Number(p.amount),
            income: Number(p.income || 0),
            status: p.status,
            purchased_at: p.purchased_at,
            // active_until removed - expiry is ONLY based on 2x income
            is_active: isActive,
            is_renewal: p.is_renewal || false,
            previous_package_id: p.previous_package_id || null,
            ...(globalIdsInfo && { global_ids_info: globalIdsInfo }),
          };
        })
      );

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting purchases by user:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/purchases/by-package:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: Filter purchases by package
   *     description: |
   *       Retrieve all purchases for a specific package with pagination.
   *       Includes user and package details.
   *     operationId: getPurchasesByPackage
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: package_id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Package ID to filter by
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *         description: Number of items per page
   *     responses:
   *       '200':
   *         description: Purchases retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                 page:
   *                   type: number
   *                 limit:
   *                   type: number
   *                 total_pages:
   *                   type: number
   *                 total:
   *                   type: number
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       user_id:
   *                         type: string
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                       package_id:
   *                         type: number
   *                       package_name:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       status:
   *                         type: string
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *       '400':
   *         description: Bad request - package_id required
   *       '401':
   *         description: Unauthorized
   */
  app.get('/purchases/by-package', {
    preHandler: adminAuth,
    schema: {
      description: 'Filter purchases by package',
      tags: ['Admin Purchases'],
      summary: 'Get Purchases by Package',
      querystring: {
        type: 'object',
        required: ['package_id'],
        properties: {
          package_id: { type: 'number' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  amount: { type: 'number' },
                  status: { type: 'string' },
                  purchased_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const packageId = (req.query as any).package_id;
      if (!packageId) {
        return reply.code(400).send({ error: 'package_id is required' });
      }

      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const where = { package_id: parseInt(packageId, 10) };

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { purchased_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.purchases.count({ where }),
      ]);

      // Get user and package details
      const userIds = [...new Set(purchases.map(p => p.user_id.toString()))];
      const users = await prisma.users.findMany({
        where: { id: { in: userIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id.toString(), u.name]));

      const pkg = await prisma.packages.findUnique({
        where: { id: parseInt(packageId, 10) },
        select: { name: true },
      });

      const items = purchases.map(p => ({
        id: p.id.toString(),
        user_id: p.user_id.toString(),
        user_name: userMap.get(p.user_id.toString()) ?? null,
        package_id: p.package_id,
        package_name: pkg?.name ?? 'Unknown',
        amount: Number(p.amount),
        status: p.status,
        purchased_at: p.purchased_at,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting purchases by package:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/purchases/by-date:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: Filter purchases by date range
   *     description: |
   *       Retrieve purchases within a specific date range with pagination.
   *       Includes user and package details.
   *     operationId: getPurchasesByDate
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: start_date
   *         required: true
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date (ISO 8601)
   *       - in: query
   *         name: end_date
   *         required: true
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date (ISO 8601)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *         description: Number of items per page
   *     responses:
   *       '200':
   *         description: Purchases retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                 page:
   *                   type: number
   *                 limit:
   *                   type: number
   *                 total_pages:
   *                   type: number
   *                 total:
   *                   type: number
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       user_id:
   *                         type: string
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                       package_id:
   *                         type: number
   *                       package_name:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       status:
   *                         type: string
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *       '400':
   *         description: Bad request - start_date and end_date required
   *       '401':
   *         description: Unauthorized
   */
  app.get('/purchases/by-date', {
    preHandler: adminAuth,
    schema: {
      description: 'Filter purchases by date range',
      tags: ['Admin Purchases'],
      summary: 'Get Purchases by Date Range',
      querystring: {
        type: 'object',
        required: ['start_date', 'end_date'],
        properties: {
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  amount: { type: 'number' },
                  status: { type: 'string' },
                  purchased_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;

      if (!startDate || !endDate) {
        return reply.code(400).send({ error: 'start_date and end_date are required' });
      }

      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const where = {
        purchased_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { purchased_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.purchases.count({ where }),
      ]);

      // Get user and package details
      const userIds = [...new Set(purchases.map(p => p.user_id.toString()))];
      const packageIds = [...new Set(purchases.map(p => p.package_id))];

      const [users, packages] = await Promise.all([
        prisma.users.findMany({
          where: { id: { in: userIds.map(id => BigInt(id)) } },
          select: { id: true, name: true },
        }),
        prisma.packages.findMany({
          where: { id: { in: packageIds } },
          select: { id: true, name: true },
        }),
      ]);

      const userMap = new Map(users.map(u => [u.id.toString(), u.name]));
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      const items = purchases.map(p => ({
        id: p.id.toString(),
        user_id: p.user_id.toString(),
        user_name: userMap.get(p.user_id.toString()) ?? null,
        package_id: p.package_id,
        package_name: packageMap.get(p.package_id) ?? 'Unknown',
        amount: Number(p.amount),
        status: p.status,
        purchased_at: p.purchased_at,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting purchases by date:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/purchases/admin-assigned:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: Get all admin-assigned packages
   *     description: |
   *       Retrieve a paginated list of all packages assigned by admins.
   *       Filters purchases where is_manual=true OR payment_type='admin_assignment'
   *     operationId: getAdminAssignedPackages
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         description: Filter by user ID
   *       - in: query
   *         name: admin_user_id
   *         schema:
   *           type: string
   *         description: Filter by admin user ID (from txn_id)
   *       - in: query
   *         name: package_id
   *         schema:
   *           type: integer
   *         description: Filter by package ID
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter from this date (YYYY-MM-DD)
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter until this date (YYYY-MM-DD)
   *     responses:
   *       '200':
   *         description: Admin-assigned packages retrieved successfully
   */
  app.get('/purchases/admin-assigned', {
    preHandler: adminAuth,
    schema: {
      description: 'Get all admin-assigned packages',
      tags: ['Admin Purchases'],
      summary: 'Get Admin Assigned Packages',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          user_id: { type: 'string' },
          admin_user_id: { type: 'string' },
          package_id: { type: 'number' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const userId = (req.query as any).user_id;
      const adminUserId = (req.query as any).admin_user_id;
      const packageId = (req.query as any).package_id;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;

      // Build where clause - filter for admin-assigned packages
      // Only show packages that were actually assigned through the admin UI feature
      // Feature was implemented on Dec 21, 2025, so ONLY show packages from Dec 21, 2025 onwards
      // AND must have either:
      // 1. txn_id starts with 'ADMIN-' (actual admin assignment via UI)
      // 2. OR (is_manual=true OR payment_type='admin_assignment')
      const adminAssignmentDate = new Date('2025-12-21T00:00:00.000Z');
      
      // Build base condition: Must be after Dec 21, 2025 AND have admin assignment indicators
      const adminAssignmentCondition: any = {
        AND: [
          // Must be after feature implementation date
          { purchased_at: { gte: adminAssignmentDate } },
          // AND must have admin assignment indicators
          {
            OR: [
              // Actual admin assignments via UI (txn_id pattern: ADMIN-{adminId}-{timestamp})
              {
                txn_id: { startsWith: 'ADMIN-' },
              },
              // OR have admin assignment flags
              {
                OR: [
                  { is_manual: true },
                  { payment_type: 'admin_assignment' },
                ],
              },
            ],
          },
        ],
      };

      // Build final where clause - ensure ALL entries are after Dec 21, 2025
      const where: any = {
        AND: [...adminAssignmentCondition.AND], // Copy the AND array
      };

      if (userId) {
        where.user_id = BigInt(userId);
      }
      if (packageId) {
        where.package_id = parseInt(packageId, 10);
      }
      
      // Apply additional date range filter if provided by user
      if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) {
          // Ensure start date is at least Dec 21, 2025
          const userStartDate = new Date(startDate);
          dateFilter.gte = userStartDate.getTime() > adminAssignmentDate.getTime() 
            ? userStartDate 
            : adminAssignmentDate;
        } else {
          // If no start date provided, still enforce Dec 21, 2025 minimum
          dateFilter.gte = adminAssignmentDate;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }
        
        // Merge with existing purchased_at filter in AND array
        const existingDateFilter = where.AND.find((condition: any) => condition.purchased_at);
        if (existingDateFilter) {
          // Merge date filters
          existingDateFilter.purchased_at = {
            ...existingDateFilter.purchased_at,
            ...dateFilter,
            gte: dateFilter.gte || existingDateFilter.purchased_at.gte,
          };
        } else {
          // Add new date filter
          where.AND.push({ purchased_at: dateFilter });
        }
      }

      // If admin_user_id is provided, filter by txn_id pattern
      if (adminUserId) {
        where.txn_id = { startsWith: `ADMIN-${adminUserId}-` };
      }

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { purchased_at: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            user_id: true,
            package_id: true,
            amount: true,
            income: true,
            status: true,
            purchased_at: true,
            is_manual: true,
            payment_type: true,
            effective_global_ids: true,
            txn_id: true,
            is_renewal: true,
            previous_package_id: true,
          },
        }),
        prisma.purchases.count({ where }),
      ]);

      // Get user details, package details, and admin details
      const userIds = [...new Set(purchases.map(p => p.user_id.toString()))];
      const packageIds = [...new Set(purchases.map(p => p.package_id))];

      // Extract admin IDs from txn_id (format: ADMIN-{adminId}-{timestamp})
      const adminIdsFromTxn = purchases
        .map(p => {
          if (p.txn_id && p.txn_id.startsWith('ADMIN-')) {
            const parts = p.txn_id.split('-');
            return parts[1];
          }
          return null;
        })
        .filter((id): id is string => id !== null);
      const uniqueAdminIds = [...new Set(adminIdsFromTxn)];

      const [users, packages, admins] = await Promise.all([
        prisma.users.findMany({
          where: {
            id: { in: userIds.map(id => BigInt(id)) },
          },
          select: {
            id: true,
            name: true,
            email: true,
            display_id: true,
          },
        }),
        prisma.packages.findMany({
          where: {
            id: { in: packageIds },
          },
          select: {
            id: true,
            name: true,
          },
        }),
        uniqueAdminIds.length > 0
          ? prisma.users.findMany({
              where: {
                id: { in: uniqueAdminIds.map(id => BigInt(id)) },
              },
              select: {
                id: true,
                name: true,
                email: true,
                display_id: true,
              },
            })
          : [],
      ]);

      const userMap = new Map(users.map(u => [u.id.toString(), u]));
      const packageMap = new Map(packages.map(p => [p.id, p.name]));
      const adminMap = new Map(admins.map(a => [a.id.toString(), a]));

      // Convert to response format
      const items = purchases.map(purchase => {
        const user = userMap.get(purchase.user_id.toString());
        
        // Extract admin ID from txn_id
        let assignedByAdmin = null;
        if (purchase.txn_id && purchase.txn_id.startsWith('ADMIN-')) {
          const parts = purchase.txn_id.split('-');
          const adminId = parts[1];
          const admin = adminMap.get(adminId);
          if (admin) {
            assignedByAdmin = {
              id: admin.id.toString(),
              name: admin.name,
              email: admin.email,
              display_id: admin.display_id,
            };
          }
        }

        return {
          id: purchase.id.toString(),
          user_id: purchase.user_id.toString(),
          user_name: user?.name ?? null,
          user_email: user?.email ?? null,
          user_display_id: user?.display_id ?? null,
          package_id: purchase.package_id,
          package_name: packageMap.get(purchase.package_id) ?? 'Unknown',
          amount: Number(purchase.amount),
          income: Number(purchase.income || 0),
          status: purchase.status,
          purchased_at: purchase.purchased_at,
          is_manual: purchase.is_manual || false,
          payment_type: purchase.payment_type || null,
          effective_global_ids: purchase.effective_global_ids ? Number(purchase.effective_global_ids) : null,
          txn_id: purchase.txn_id,
          is_renewal: purchase.is_renewal || false,
          previous_package_id: purchase.previous_package_id || null,
          assigned_by: assignedByAdmin,
        };
      });

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: totalPages,
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting admin-assigned packages:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/admin/purchases/revert-from-request/:id
   *
   * Revert an approved purchase that was created from a specific purchase request.
   *
   * NOTE: This endpoint assumes that the purchase was created via the standard
   * admin approval flow, where purchase_requests → purchases, and that
   * commissions / wallet credits are linked via ledger_entries and wallet_transactions.
   */
  app.post(
    '/purchases/revert-from-request/:id',
    {
      preHandler: [adminAuth, checkPermission('PURCHASE_REVERT')],
      schema: {
        description: 'Revert an approved purchase created from a purchase request',
        tags: ['Admin Purchases'],
        summary: 'Revert Purchase (from Request)',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }, // purchase_request ID
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', minLength: 10 },
            force: { type: 'boolean', default: false },
          },
          required: ['reason'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              summary: {
                type: 'object',
                properties: {
                  affected_users_count: { type: 'number' },
                  total_spot_amount: { type: 'number' },
                  total_other_amount: { type: 'number' },
                  total_amount: { type: 'number' },
                  ledger_entries_deleted: { type: 'number' },
                  wallet_transactions_deleted: { type: 'number' },
                  pending_commissions_deleted: { type: 'number' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
        security: [{ adminAuth: [] }],
      },
    },
    async (req, reply) => {
      try {
        const requestId = BigInt((req.params as any).id);
        const { reason, force = false } = (req.body || {}) as { reason: string; force?: boolean };

        const admin = (req as any).admin;

        // 1) Load purchase request
        const purchaseRequest = await prisma.purchase_requests.findUnique({
          where: { id: requestId },
        });

        if (!purchaseRequest) {
          return reply.code(404).send({
            error: 'request_not_found',
            message: `Purchase request ${requestId.toString()} not found`,
          });
        }

        if (purchaseRequest.status !== 'approved') {
          return reply.code(400).send({
            error: 'invalid_status',
            message: `Only approved requests can be reverted. Current status: ${purchaseRequest.status}`,
          });
        }

        // 2) Find corresponding purchase (by user_id, amount, txn_id)
        const purchase = await prisma.purchases.findFirst({
          where: {
            user_id: purchaseRequest.user_id,
            amount: purchaseRequest.amount,
            txn_id: purchaseRequest.txn_id,
          },
          orderBy: { purchased_at: 'desc' },
        });

        if (!purchase) {
          return reply.code(404).send({
            error: 'purchase_not_found',
            message:
              'No purchase found matching this request. It may have been manually deleted or never created.',
          });
        }

        if (purchase.status !== 'completed') {
          return reply.code(400).send({
            error: 'invalid_purchase_status',
            message: `Only completed purchases can be reverted. Current status: ${purchase.status}`,
          });
        }

        // 3) Basic age-based safety check (e.g. older than 7 days)
        const hoursSincePurchase =
          (Date.now() - new Date(purchase.purchased_at).getTime()) / (1000 * 60 * 60);
        const maxHours = 24 * 7; // 7 days

        if (hoursSincePurchase > maxHours && !force) {
          return reply.code(400).send({
            error: 'too_old_to_revert',
            message:
              'This purchase is older than the allowed revert window. Use force flag in backend or run manual script.',
          });
        }

        const purchaseId = purchase.id as unknown as bigint;

        // 4) Load related financial data
        const [ledgerEntries, pendingCommissions] = await Promise.all([
          prisma.ledger_entries.findMany({
            where: { purchase_id: purchaseId },
          }),
          prisma.pending_commissions.findMany({
            where: { purchase_id: purchaseId },
          }),
        ]);

        const ledgerEntryIds = ledgerEntries.map((le) => le.id);

        const walletTransactions =
          ledgerEntryIds.length > 0
            ? await prisma.wallet_transactions.findMany({
                where: { ledger_entry_id: { in: ledgerEntryIds } },
              })
            : [];

        // Calculate balance adjustments per user
        const balanceAdjustments = new Map<
          string,
          { spotAmount: number; otherAmount: number }
        >();

        for (const entry of ledgerEntries) {
          const userId = entry.receiver_user_id.toString();
          const amount = Number(entry.amount);

          if (!balanceAdjustments.has(userId)) {
            balanceAdjustments.set(userId, { spotAmount: 0, otherAmount: 0 });
          }

          const adj = balanceAdjustments.get(userId)!;
          if (entry.commission_type === 'SPOT') {
            adj.spotAmount += amount;
          } else {
            adj.otherAmount += amount;
          }
        }

        const affectedUsersCount = balanceAdjustments.size;
        let totalSpotAmount = 0;
        let totalOtherAmount = 0;

        for (const [, adj] of balanceAdjustments.entries()) {
          totalSpotAmount += adj.spotAmount;
          totalOtherAmount += adj.otherAmount;
        }

        // 5) Execute revert in a single transaction
        await prisma.$transaction(async (tx) => {
          // Step 1: Delete wallet transactions
          if (walletTransactions.length > 0) {
            await tx.wallet_transactions.deleteMany({
              where: { ledger_entry_id: { in: ledgerEntryIds } },
            });
          }

          // Step 2: Delete ledger entries
          if (ledgerEntries.length > 0) {
            await tx.ledger_entries.deleteMany({
              where: { purchase_id: purchaseId },
            });
          }

          // Step 3: Delete pending commissions
          if (pendingCommissions.length > 0) {
            await tx.pending_commissions.deleteMany({
              where: { purchase_id: purchaseId },
            });
          }

          // Step 4: Adjust user balances
          for (const [userId, adj] of balanceAdjustments.entries()) {
            const userIdBigInt = BigInt(userId);

            const currentBalance = await tx.user_balances.findUnique({
              where: { user_id: userIdBigInt },
            });

            if (currentBalance) {
              await tx.$executeRawUnsafe(
                `UPDATE user_balances 
                 SET balance = balance - $1,
                     spot_balance = spot_balance - $2,
                     other_balance = other_balance - $3,
                     updated_at = now()
                 WHERE user_id = $4`,
                adj.spotAmount + adj.otherAmount,
                adj.spotAmount,
                adj.otherAmount,
                userIdBigInt,
              );
            }
          }

          // Step 5: Update purchase request status
          const adminUserId =
            admin?.user_id !== undefined && admin?.user_id !== null
              ? BigInt(admin.user_id)
              : null;

          await tx.purchase_requests.update({
            where: { id: purchaseRequest.id },
            data: {
              status: 'rejected',
              rejection_reason: `Reverted by admin: ${reason}`,
              processed_at: new Date(),
              processed_by: adminUserId ?? undefined,
            },
          });

          // Step 6: Delete purchase record
          await tx.purchases.delete({
            where: { id: purchaseId },
          });
        });

        // 6) Recalculate eligibility (best-effort, non-blocking)
        try {
          await CommissionService.recalculateEligibility();
        } catch (e) {
          console.error('Error recalculating eligibility after revert:', e);
        }

        return reply.send({
          message: 'Purchase reverted successfully',
          summary: {
            affected_users_count: affectedUsersCount,
            total_spot_amount: totalSpotAmount,
            total_other_amount: totalOtherAmount,
            total_amount: totalSpotAmount + totalOtherAmount,
            ledger_entries_deleted: ledgerEntries.length,
            wallet_transactions_deleted: walletTransactions.length,
            pending_commissions_deleted: pendingCommissions.length,
          },
        });
      } catch (error: any) {
        console.error('Error reverting purchase from request:', error);
        if (error?.message && typeof error.message === 'string') {
          return reply.code(400).send({
            error: 'revert_failed',
            message: error.message,
          });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * @openapi
   * /api/v1/admin/gateway-purchases:
   *   get:
   *     tags:
   *       - Admin Purchases
   *     summary: List ICICI payment gateway purchases
   *     description: |
   *       Read-only listing of purchases created via the ICICI payment gateway (non-manual).
   *       This endpoint does NOT change any business logic; it derives a high-level flow type
   *       (New Purchase, Reinvestment, Renewal, Upgrade) from existing purchase fields.
   *     operationId: listGatewayPurchases
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           minimum: 1
   *           maximum: 100
   *         description: Number of items per page
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         description: Filter by user ID
   *       - in: query
   *         name: display_id
   *         schema:
   *           type: string
   *         description: Filter by user display ID (e.g. SIA00021)
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [completed, pending, cancelled]
   *         description: Filter by purchase status
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter purchases from this date (inclusive)
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter purchases until this date (inclusive)
   *       - in: query
   *         name: flow_type
   *         schema:
   *           type: string
   *           enum: [NEW_PURCHASE, REINVESTMENT, RENEWAL, UPGRADE]
   *         description: Optional high-level flow type filter (derived from existing data)
   *     responses:
   *       '200':
   *         description: List of gateway purchases retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                 page:
   *                   type: number
   *                 limit:
   *                   type: number
   *                 total_pages:
   *                   type: number
   *                 total:
   *                   type: number
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       user_id:
   *                         type: string
   *                       user_display_id:
   *                         type: string
   *                         nullable: true
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                       package_id:
   *                         type: number
   *                       package_name:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       status:
   *                         type: string
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *                       payment_type:
   *                         type: string
   *                         nullable: true
   *                       is_renewal:
   *                         type: boolean
   *                       previous_package_id:
   *                         type: number
   *                         nullable: true
   *                       previous_purchase_id:
   *                         type: string
   *                         nullable: true
   *                       flow_type:
   *                         type: string
   *                         enum: [NEW_PURCHASE, REINVESTMENT, RENEWAL, UPGRADE]
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/gateway-purchases', {
    preHandler: adminAuth,
    schema: {
      description: 'List ICICI payment gateway purchases (read-only, derived flow types)',
      tags: ['Admin Purchases'],
      summary: 'List Gateway Purchases',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          user_id: { type: 'string' },
          display_id: { type: 'string' },
          status: { type: 'string', enum: ['completed', 'pending', 'cancelled'] },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          flow_type: { type: 'string', enum: ['NEW_PURCHASE', 'REINVESTMENT', 'RENEWAL', 'UPGRADE'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  user_display_id: { type: ['string', 'null'] },
                  user_name: { type: ['string', 'null'] },
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  amount: { type: 'number' },
                  status: { type: 'string' },
                  purchased_at: { type: 'string' },
                  payment_type: { type: ['string', 'null'] },
                  is_renewal: { type: 'boolean' },
                  previous_package_id: { type: ['number', 'null'] },
                  previous_purchase_id: { type: ['string', 'null'] },
                  flow_type: {
                    type: 'string',
                    enum: ['NEW_PURCHASE', 'REINVESTMENT', 'RENEWAL', 'UPGRADE'],
                  },
                },
              },
            },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
      const offset = (page - 1) * limit;
      const userId = query.user_id as string | undefined;
      const displayId = query.display_id as string | undefined;
      const status = query.status as string | undefined;
      const startDate = query.start_date as string | undefined;
      const endDate = query.end_date as string | undefined;
      const flowTypeFilter = query.flow_type as GatewayFlowType | undefined;

      const where: any = {
        payment_type: 'icici',
        is_manual: false,
      };

      if (userId) {
        where.user_id = BigInt(userId);
      }

      if (status) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.purchased_at = {};
        if (startDate) {
          where.purchased_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.purchased_at.lte = new Date(endDate);
        }
      }

      // If display_id is provided, resolve it to a user_id first.
      if (displayId) {
        const user = await prisma.users.findUnique({
          where: { display_id: displayId },
          select: { id: true },
        });

        if (!user) {
          return reply.send({
            count: 0,
            page,
            limit,
            total_pages: 0,
            total: 0,
            items: [],
          });
        }

        where.user_id = user.id;
      }

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { purchased_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.purchases.count({ where }),
      ]);

      if (purchases.length === 0) {
        const totalPages = Math.ceil(total / limit);
        return reply.send({
          count: 0,
          page,
          limit,
          total_pages: totalPages,
          total,
          items: [],
        });
      }

      // Load related user/package data and first completed purchase date per user.
      const userIds = [...new Set(purchases.map((p) => p.user_id.toString()))];
      const packageIds = [...new Set(purchases.map((p) => p.package_id))];

      const [users, packages, firstPurchases] = await Promise.all([
        prisma.users.findMany({
          where: {
            id: { in: userIds.map((id) => BigInt(id)) },
          },
          select: {
            id: true,
            name: true,
            email: true,
            display_id: true,
          },
        }),
        prisma.packages.findMany({
          where: {
            id: { in: packageIds },
          },
          select: {
            id: true,
            name: true,
          },
        }),
        prisma.purchases.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: userIds.map((id) => BigInt(id)) },
            status: 'completed',
          },
          _min: {
            purchased_at: true,
          },
        }) as any,
      ]);

      const userMap = new Map<string, { name: string | null; email: string | null; display_id: string | null }>();
      for (const u of users) {
        userMap.set(u.id.toString(), {
          name: u.name ?? null,
          email: u.email ?? null,
          display_id: u.display_id ?? null,
        });
      }

      const packageMap = new Map<number, string>();
      for (const pkg of packages) {
        packageMap.set(pkg.id, pkg.name);
      }

      const firstPurchaseMap = new Map<string, Date | null>();
      for (const fp of firstPurchases) {
        if (fp._min && fp._min.purchased_at) {
          firstPurchaseMap.set(fp.user_id.toString(), fp._min.purchased_at);
        }
      }

      const itemsWithFlow = purchases.map((purchase) => {
        const userInfo = userMap.get(purchase.user_id.toString()) || {
          name: null,
          email: null,
          display_id: null,
        };

        const flowType = classifyGatewayPurchase(
          {
            user_id: purchase.user_id,
            package_id: purchase.package_id,
            is_renewal: purchase.is_renewal ?? false,
            previous_package_id: purchase.previous_package_id ?? null,
            purchased_at: purchase.purchased_at,
          },
          firstPurchaseMap,
        );

        return {
          id: purchase.id.toString(),
          user_id: purchase.user_id.toString(),
          user_display_id: userInfo.display_id,
          user_name: userInfo.name,
          package_id: purchase.package_id,
          package_name: packageMap.get(purchase.package_id) ?? 'Unknown',
          amount: Number(purchase.amount),
          status: purchase.status,
          purchased_at: purchase.purchased_at,
          payment_type: purchase.payment_type || null,
          is_renewal: purchase.is_renewal || false,
          previous_package_id: purchase.previous_package_id || null,
          previous_purchase_id: purchase.previous_purchase_id
            ? purchase.previous_purchase_id.toString()
            : null,
          flow_type: flowType,
        };
      });

      const filteredItems = flowTypeFilter
        ? itemsWithFlow.filter((item) => item.flow_type === flowTypeFilter)
        : itemsWithFlow;

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        count: filteredItems.length,
        page,
        limit,
        total_pages: totalPages,
        total,
        items: filteredItems,
      });
    } catch (error) {
      console.error('Error getting gateway purchases:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/admin/gateway-purchases/reconcile
   * Mark a pending ICICI gateway purchase as completed and run commissions/activation.
   * Body: purchase_id (optional), OR merchant_txn_no (optional), OR display_id + amount.
   * Optional: txn_id, icici_txn_id, icici_payment_id.
   */
  app.post('/gateway-purchases/reconcile', {
    preHandler: [adminAuth, checkPermission('PURCHASE_REVERT')],
    schema: {
      description: 'Reconcile a pending gateway purchase as completed (admin only)',
      tags: ['Admin Purchases'],
      summary: 'Reconcile Gateway Purchase',
      body: {
        type: 'object',
        required: [],
        properties: {
          purchase_id: { type: 'string' },
          merchant_txn_no: { type: 'string' },
          display_id: { type: 'string' },
          amount: { type: 'number' },
          txn_id: { type: 'string' },
          icici_txn_id: { type: 'string' },
          icici_payment_id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            purchase_id: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const purchaseId = body.purchase_id as string | undefined;
      const merchantTxnNo = (body.merchant_txn_no as string)?.trim();
      const displayId = (body.display_id as string)?.trim();
      const amount = body.amount != null ? Number(body.amount) : undefined;
      const txnId = (body.txn_id as string)?.trim() || undefined;
      const iciciTxnId = (body.icici_txn_id as string)?.trim() || undefined;
      const iciciPaymentId = (body.icici_payment_id as string)?.trim() || undefined;

      let purchase: { id: bigint; user_id: bigint; course_id: number | null; merchant_txn_no: string | null; amount: bigint; package_id: number } | null = null;

      if (purchaseId) {
        purchase = await prisma.purchases.findFirst({
          where: {
            id: BigInt(purchaseId),
            status: 'pending',
            payment_type: 'icici',
            is_manual: false,
          },
        }) as typeof purchase;
      } else if (merchantTxnNo) {
        purchase = await prisma.purchases.findFirst({
          where: {
            merchant_txn_no: merchantTxnNo,
            status: 'pending',
            payment_type: 'icici',
            is_manual: false,
          },
        }) as typeof purchase;
      } else if (displayId != null && displayId !== '' && amount != null && !Number.isNaN(amount)) {
        const user = await prisma.users.findUnique({
          where: { display_id: displayId },
          select: { id: true },
        });
        if (!user) {
          return reply.code(404).send({ error: 'User not found for display_id: ' + displayId });
        }
        purchase = await prisma.purchases.findFirst({
          where: {
            user_id: user.id,
            amount: amount,
            status: 'pending',
            payment_type: 'icici',
            is_manual: false,
          },
        }) as typeof purchase;
      }

      if (!purchase) {
        return reply.code(404).send({
          error: 'No pending ICICI gateway purchase found. Provide purchase_id, or merchant_txn_no, or display_id + amount.',
        });
      }

      const txnIdFinal = txnId || purchase.merchant_txn_no || undefined;

      const updatedPurchase = await prisma.purchases.update({
        where: { id: purchase.id },
        data: {
          status: 'completed',
          ...(txnIdFinal && { txn_id: txnIdFinal }),
          ...(iciciTxnId && { icici_txn_id: iciciTxnId }),
          ...(iciciPaymentId && { icici_payment_id: iciciPaymentId }),
          payment_type: 'icici',
        },
      });

      if (updatedPurchase.course_id) {
        await prisma.course_cart_entries.deleteMany({
          where: {
            user_id: updatedPurchase.user_id,
            course_id: updatedPurchase.course_id,
          },
        });
        await prisma.courses.update({
          where: { id: updatedPurchase.course_id },
          data: { total_students: { increment: 1 } },
        });
      }
      try {
        await resetSpotTeamWithdrawUsed(updatedPurchase.user_id);
      } catch (e) {
        console.error('Error resetting network withdraw used:', e);
      }
      try {
        await CommissionService.handlePurchase(updatedPurchase.id);
      } catch (error) {
        console.error('Error triggering commissions on reconcile:', error);
        return reply.code(500).send({
          error: 'Purchase updated to completed but commission processing failed. Check logs.',
        });
      }

      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: updatedPurchase.user_id },
          select: { display_id: true, name: true },
        });
        const pkg = await prisma.packages.findUnique({
          where: { id: updatedPurchase.package_id },
          select: { name: true },
        });
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'GATEWAY_RECONCILE',
          targetUserId: updatedPurchase.user_id,
          targetEntityType: 'purchase',
          targetEntityId: updatedPurchase.id.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id ?? null,
            user_name: targetUser?.name ?? null,
            purchase_id: updatedPurchase.id.toString(),
            amount: Number(updatedPurchase.amount),
            package_id: updatedPurchase.package_id,
            package_name: pkg?.name ?? null,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        success: true,
        purchase_id: updatedPurchase.id.toString(),
        message: 'Purchase reconciled and commissions processed.',
      });
    } catch (error) {
      console.error('Error reconciling gateway purchase:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

