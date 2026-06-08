import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import { PackageStatusService } from '../modules/purchases/package-status.service.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export async function myCourseRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/my-course:
   *   get:
   *     tags:
   *       - My Course
   *     summary: Get user purchase history (courses/packages)
   *     description: |
   *       Retrieve purchase history for the authenticated user with package details.
   *       Supports filtering by status (completed, active, expired).
   *     operationId: getMyCourses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [completed, active, expired]
   *         description: Filter by purchase status
   *     responses:
   *       '200':
   *         description: Purchase history retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 5
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "1"
   *                       package_id:
   *                         type: number
   *                         example: 1
   *                       package_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Premium Package"
   *                       amount:
   *                         type: number
   *                         example: 5000.00
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       // active_until removed
   *                         type: string
   *                         format: date-time
   *                         example: "2026-11-08T10:00:00.000Z"
   *                       status:
   *                         type: string
   *                         example: "completed"
   *                       is_active:
   *                         type: boolean
   *                         example: true
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'Get user purchase history with package details',
      tags: ['My Course'],
      summary: 'Get My Courses',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['completed', 'active', 'expired'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  package_id: { type: 'number' },
                  package_name: { type: 'string', nullable: true },
                  amount: { type: 'number' },
                  purchased_at: { type: 'string', format: 'date-time' },
                  // active_until removed - expiry is ONLY based on 2x income
                  status: { type: 'string' },
                  is_active: { type: 'boolean' },
                  global_ids_info: {
                    type: 'object',
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
                  expiry_loss: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      total_loss: { type: 'number' },
                      days_since_expiry: { type: 'number' },
                      daily_breakdown: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            day: { type: 'number' },
                            date: { type: 'string' },
                            self_income: { type: 'number' },
                            monthly_royalty: { type: 'number' },
                            spot_income: { type: 'number' },
                            total: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                  renewal_countdown: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      last_income_date: { type: ['string', 'null'] },
                      renewal_deadline: { type: 'string' },
                      countdown: {
                        type: 'object',
                        properties: {
                          days: { type: 'number' },
                          hours: { type: 'number' },
                          minutes: { type: 'number' },
                          seconds: { type: 'number' },
                          total_seconds: { type: 'number' },
                        },
                      },
                      can_renew: { type: 'boolean' },
                    },
                  },
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
      const id = BigInt((req as any).user.user_id);
      const statusFilter = (req.query as any).status;
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { user_id: id };
      // Note: active/expired filtering is now done after fetching, based on 2x check
      if (statusFilter && statusFilter !== 'active' && statusFilter !== 'expired') {
        where.status = statusFilter;
      } else {
        // For active/expired, we need all completed purchases to check 2x
        where.status = 'completed';
      }

      const purchases = await prisma.purchases.findMany({
        where,
        orderBy: { purchased_at: 'desc' },
        select: {
          id: true,
          package_id: true,
          amount: true,
          income: true, // Include income for 2x progress calculation
          purchased_at: true,
          // active_until removed - expiry is ONLY based on 2x income
          status: true,
          is_renewal: true,
          previous_package_id: true,
          previous_purchase_id: true,
        },
      });

      // Get package names
      const packageIds = Array.from(new Set(purchases.map(p => p.package_id)));
      const packages = await prisma.packages.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true },
      });
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      const now = new Date();
      
      // Calculate global IDs info and expiry loss for each purchase
      const items = await Promise.all(
        purchases.map(async (p) => {
          // Check if purchase has reached 2x (expiry is based on 2x, not active_until date)
          const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
          const isActive = p.status === 'completed' && !isDoubleReached;
          const isExpired = p.status === 'completed' && isDoubleReached;

          // Calculate global IDs info for active purchases
          let globalIdsInfo = null;
          if (isActive) {
            try {
              globalIdsInfo = await PackageStatusService.calculateGlobalIdsInfo(p.id, id);
            } catch (error) {
              console.error('Error calculating global IDs info:', error);
            }
          }

          // Calculate expiry loss and renewal countdown for expired purchases
          let expiryLoss = null;
          let renewalCountdown = null;
          if (isExpired) {
            try {
              expiryLoss = await PackageStatusService.calculateExpiryLoss(p.id, id, 20);
            } catch (error) {
              console.error('Error calculating expiry loss:', error);
            }
            try {
              renewalCountdown = await PackageStatusService.calculateRenewalCountdown(p.id, id);
            } catch (error) {
              console.error('Error calculating renewal countdown:', error);
            }
          }

          return {
            id: p.id.toString(),
            package_id: p.package_id,
            package_name: packageMap.get(p.package_id) ?? null,
            amount: Number(p.amount),
            income: Number(p.income || 0), // Include income for progress bar
            purchased_at: p.purchased_at,
            // active_until removed - expiry is ONLY based on 2x income
            status: p.status,
            is_active: isActive,
            is_renewal: p.is_renewal || false,
            previous_package_id: p.previous_package_id || null,
            previous_purchase_id: p.previous_purchase_id ? p.previous_purchase_id.toString() : null,
            ...(globalIdsInfo && { global_ids_info: globalIdsInfo }),
            ...(expiryLoss && { expiry_loss: expiryLoss }),
            ...(renewalCountdown && { renewal_countdown: renewalCountdown }),
          };
        })
      );

      // Filter by status if needed (after 2x check)
      let filteredItems = items;
      if (statusFilter === 'active') {
        filteredItems = items.filter(item => item.is_active);
      } else if (statusFilter === 'expired') {
        filteredItems = items.filter(item => !item.is_active && item.status === 'completed');
      }

      return reply.send({
        count: filteredItems.length,
        items: filteredItems,
      });
    } catch (error) {
      console.error('Error getting purchases:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/my-course/{id}:
   *   get:
   *     tags:
   *       - My Course
   *     summary: Get purchase details by ID
   *     description: |
   *       Retrieve detailed information about a specific purchase.
   *       Users can only view their own purchases.
   *     operationId: getMyCourseById
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
   *                   example: "1"
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 package_id:
   *                   type: number
   *                   example: 1
   *                 package:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     id:
   *                       type: number
   *                       example: 1
   *                     name:
   *                       type: string
   *                       example: "Premium Package"
   *                     price:
   *                       type: number
   *                       example: 5000.00
   *                 amount:
   *                   type: number
   *                   example: 5000.00
   *                 status:
   *                   type: string
   *                   example: "completed"
   *                 purchased_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-08T10:00:00.000Z"
   *                 // active_until removed
   *                   type: string
   *                   format: date-time
   *                   example: "2026-11-08T10:00:00.000Z"
   *                 is_active:
   *                   type: boolean
   *                   example: true
   *       '403':
   *         description: Forbidden - You can only view your own purchases
   *       '404':
   *         description: Purchase not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Get purchase details',
      tags: ['My Course'],
      summary: 'Get Course Details',
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
            purchased_at: { type: 'string', format: 'date-time' },
            // active_until removed - expiry is ONLY based on 2x income
            is_active: { type: 'boolean' },
            global_ids_info: {
              type: 'object',
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
            expiry_loss: {
              type: 'object',
              nullable: true,
              properties: {
                total_loss: { type: 'number' },
                days_since_expiry: { type: 'number' },
                daily_breakdown: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      day: { type: 'number' },
                      date: { type: 'string' },
                      self_income: { type: 'number' },
                      monthly_royalty: { type: 'number' },
                      spot_income: { type: 'number' },
                      total: { type: 'number' },
                    },
                  },
                },
              },
            },
            renewal_countdown: {
              type: 'object',
              nullable: true,
              properties: {
                last_income_date: { type: ['string', 'null'] },
                renewal_deadline: { type: 'string' },
                countdown: {
                  type: 'object',
                  properties: {
                    days: { type: 'number' },
                    hours: { type: 'number' },
                    minutes: { type: 'number' },
                    seconds: { type: 'number' },
                    total_seconds: { type: 'number' },
                  },
                },
                can_renew: { type: 'boolean' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const purchaseId = BigInt((req.params as any).id);
      const userId = BigInt((req as any).user.user_id);

      const purchase = await prisma.purchases.findUnique({
        where: { id: purchaseId },
      });

      if (!purchase) {
        return reply.code(404).send({ error: 'Purchase not found' });
      }

      // Verify user owns this purchase
      if (purchase.user_id.toString() !== userId.toString()) {
        return reply.code(403).send({ error: 'Forbidden: You can only view your own purchases' });
      }

      // Get package details
      const packageData = await prisma.packages.findUnique({
        where: { id: purchase.package_id },
        select: { id: true, name: true, price: true },
      });

      // Expiry is based on 2x income (self + global), NOT active_until date
      const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
      const isActive = purchase.status === 'completed' && !isDoubleReached;
      const isExpired = purchase.status === 'completed' && isDoubleReached;

      // Calculate global IDs info for active purchases
      let globalIdsInfo = null;
      
      if (isActive) {
        try {
          globalIdsInfo = await PackageStatusService.calculateGlobalIdsInfo(purchase.id, userId);
        } catch (error) {
          console.error('[my-course/:id] Error calculating global IDs info:', error);
        }
      }

      // Calculate expiry loss and renewal countdown for expired purchases
      let expiryLoss = null;
      let renewalCountdown = null;
      if (isExpired) {
        try {
          expiryLoss = await PackageStatusService.calculateExpiryLoss(purchase.id, userId, 20);
        } catch (error) {
          console.error('[my-course/:id] Error calculating expiry loss:', error);
        }
        try {
          renewalCountdown = await PackageStatusService.calculateRenewalCountdown(purchase.id, userId);
        } catch (error) {
          console.error('[my-course/:id] Error calculating renewal countdown:', error);
        }
      }

      const responseData: any = {
        id: purchase.id.toString(),
        user_id: purchase.user_id.toString(),
        package_id: purchase.package_id,
        package: packageData ? {
          id: packageData.id,
          name: packageData.name,
          price: Number(packageData.price),
        } : null,
        amount: Number(purchase.amount),
        status: purchase.status,
        purchased_at: purchase.purchased_at,
        // active_until removed - expiry is ONLY based on 2x income
        is_active: isActive,
      };

      // Add global_ids_info if purchase is active
      if (isActive) {
        responseData.global_ids_info = globalIdsInfo;
      }

      // Add expiry_loss and renewal_countdown if purchase is expired
      if (isExpired) {
        responseData.expiry_loss = expiryLoss;
        responseData.renewal_countdown = renewalCountdown;
      }

      return reply.send(responseData);
    } catch (error) {
      console.error('Error getting purchase:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

