import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { LeaderboardService } from '../modules/leaderboard/leaderboardService.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export async function adminReportsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/reports:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get admin reports and analytics
   *     description: |
   *       Retrieve comprehensive reports including revenue analytics, user growth trends,
   *       commission reports, and other business metrics.
   *     operationId: getAdminReports
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [today, week, month, year, all]
   *           default: month
   *         description: Time period for the report
   *     responses:
   *       '200':
   *         description: Reports retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 revenue_report:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                       example: 500000.00
   *                     by_package:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           package_id:
   *                             type: number
   *                             example: 1
   *                           package_name:
   *                             type: string
   *                             example: "Premium Package"
   *                           count:
   *                             type: number
   *                             example: 50
   *                           total_amount:
   *                             type: number
   *                             example: 125000.00
   *                 user_growth:
   *                   type: object
   *                   properties:
   *                     total_users:
   *                       type: number
   *                       example: 150
   *                     active_users:
   *                       type: number
   *                       example: 120
   *                     new_users:
   *                       type: number
   *                       example: 25
   *                     growth_rate:
   *                       type: number
   *                       example: 20.0
   *                 commission_report:
   *                   type: object
   *                   properties:
   *                     total_commissions:
   *                       type: number
   *                       example: 100000.00
   *                     by_type:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             example: "SELF"
   *                           count:
   *                             type: number
   *                             example: 100
   *                           total_amount:
   *                             type: number
   *                             example: 50000.00
   *                     top_earners:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           user_id:
   *                             type: string
   *                             example: "7"
   *                           user_name:
   *                             type: string
   *                             nullable: true
   *                             example: "Test User"
   *                           total_commissions:
   *                             type: number
   *                             example: 10000.00
   *                 top_packages:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       package_id:
   *                         type: number
   *                         example: 1
   *                       package_name:
   *                         type: string
   *                         example: "Premium Package"
   *                       purchase_count:
   *                         type: number
   *                         example: 50
   *                       total_revenue:
   *                         type: number
   *                         example: 125000.00
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/reports', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get admin reports and analytics',
      tags: ['Admin Reports'],
      summary: 'Get Reports',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'], default: 'month' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            revenue_report: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                by_package: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      package_id: { type: 'number' },
                      package_name: { type: 'string' },
                      count: { type: 'number' },
                      total_amount: { type: 'number' },
                    },
                  },
                },
              },
            },
            user_growth: {
              type: 'object',
              properties: {
                total_users: { type: 'number' },
                active_users: { type: 'number' },
                new_users: { type: 'number' },
                growth_rate: { type: 'number' },
              },
            },
            commission_report: {
              type: 'object',
              properties: {
                total_commissions: { type: 'number' },
                by_type: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      count: { type: 'number' },
                      total_amount: { type: 'number' },
                    },
                  },
                },
                top_earners: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      user_id: { type: 'string' },
                      user_name: { type: ['string', 'null'] },
                      total_commissions: { type: 'number' },
                    },
                  },
                },
              },
            },
            top_packages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  purchase_count: { type: 'number' },
                  total_revenue: { type: 'number' },
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
      const period = (req.query as any).period || 'month';
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = new Date(0); // All time
      }

      const purchaseWhere = period === 'all'
        ? { status: 'completed' }
        : {
            status: 'completed',
            purchased_at: { gte: startDate },
          };

      // Revenue Report
      const [totalRevenue, purchasesByPackage] = await Promise.all([
        prisma.purchases.aggregate({
          where: purchaseWhere,
          _sum: { amount: true },
        }),
        prisma.purchases.groupBy({
          by: ['package_id'],
          where: purchaseWhere,
          _count: { id: true },
          _sum: { amount: true },
        }),
      ]);

      const packageIds = purchasesByPackage.map(p => p.package_id);
      const packages = await prisma.packages.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true },
      });
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      const revenueByPackage = purchasesByPackage.map(p => ({
        package_id: p.package_id,
        package_name: packageMap.get(p.package_id) ?? 'Unknown',
        count: p._count.id,
        total_amount: p._sum.amount ? Number(p._sum.amount) : 0,
      }));

      // User Growth
      const userWhere = period === 'all' ? {} : { created_at: { gte: startDate } };
      const [totalUsers, activeUsers, newUsers] = await Promise.all([
        prisma.users.count(),
        prisma.users.count({ where: { status: 'active' } }),
        prisma.users.count({ where: userWhere }),
      ]);

      const previousPeriodStart = new Date(startDate);
      if (period === 'month') {
        previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      } else if (period === 'week') {
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      } else {
        previousPeriodStart.setTime(0);
      }

      const previousPeriodUsers = await prisma.users.count({
        where: { created_at: { gte: previousPeriodStart, lt: startDate } },
      });

      const growthRate = previousPeriodUsers > 0
        ? ((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100
        : newUsers > 0 ? 100 : 0;

      // Commission Report
      const commissionWhere = period === 'all'
        ? {}
        : { credited_at: { gte: startDate } };

      const [totalCommissions, commissionsByType, topEarnersData] = await Promise.all([
        prisma.ledger_entries.aggregate({
          where: commissionWhere,
          _sum: { amount: true },
        }),
        prisma.ledger_entries.groupBy({
          by: ['commission_type'],
          where: commissionWhere,
          _count: { id: true },
          _sum: { amount: true },
        }),
        prisma.ledger_entries.groupBy({
          by: ['receiver_user_id'],
          where: commissionWhere,
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 10,
        }),
      ]);

      const topEarnerIds = topEarnersData.map(e => e.receiver_user_id.toString());
      const topEarnersUsers = await prisma.users.findMany({
        where: { id: { in: topEarnerIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(topEarnersUsers.map(u => [u.id.toString(), u.name]));

      const topEarners = topEarnersData.map(earner => ({
        user_id: earner.receiver_user_id.toString(),
        user_name: userMap.get(earner.receiver_user_id.toString()) ?? null,
        total_commissions: earner._sum.amount ? Number(earner._sum.amount) : 0,
      }));

      const commissionsByTypeFormatted = commissionsByType.map(c => ({
        type: c.commission_type,
        count: c._count.id,
        total_amount: c._sum.amount ? Number(c._sum.amount) : 0,
      }));

      // Top Packages
      const topPackagesData = purchasesByPackage
        .sort((a, b) => {
          const aAmount = a._sum.amount ? Number(a._sum.amount) : 0;
          const bAmount = b._sum.amount ? Number(b._sum.amount) : 0;
          return bAmount - aAmount;
        })
        .slice(0, 10);

      const topPackages = topPackagesData.map(p => ({
        package_id: p.package_id,
        package_name: packageMap.get(p.package_id) ?? 'Unknown',
        purchase_count: p._count.id,
        total_revenue: p._sum.amount ? Number(p._sum.amount) : 0,
      }));

      return reply.send({
        revenue_report: {
          total: totalRevenue._sum.amount ? Number(totalRevenue._sum.amount) : 0,
          by_package: revenueByPackage,
        },
        user_growth: {
          total_users: totalUsers,
          active_users: activeUsers,
          new_users: newUsers,
          growth_rate: Math.round(growthRate * 100) / 100,
        },
        commission_report: {
          total_commissions: totalCommissions._sum.amount ? Number(totalCommissions._sum.amount) : 0,
          by_type: commissionsByTypeFormatted,
          top_earners: topEarners,
        },
        top_packages: topPackages,
      });
    } catch (error) {
      console.error('Error getting reports:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/reports/top-earners:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get top earners list
   *     description: |
   *       Retrieve list of top earners ranked by wallet balance with pagination.
   *       Includes total commissions earned for each user.
   *     operationId: getTopEarners
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           minimum: 1
   *           maximum: 100
   *         description: Number of top earners to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *           minimum: 0
   *         description: Offset for pagination
   *     responses:
   *       '200':
   *         description: Top earners retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 10
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rank:
   *                         type: number
   *                         example: 1
   *                       user_id:
   *                         type: string
   *                         example: "7"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Top Earner"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "earner@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "approved"
   *                       wallet_balance:
   *                         type: number
   *                         example: 50000.00
   *                       total_commissions:
   *                         type: number
   *                         example: 55000.00
   *       '401':
   *         description: Unauthorized
   */
  app.get('/reports/top-earners', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get top earners list',
      tags: ['Admin Reports'],
      summary: 'Get Top Earners',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 10, minimum: 1, maximum: 100 },
          offset: { type: 'number', default: 0, minimum: 0 },
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
                  rank: { type: 'number' },
                  user_id: { type: 'string' },
                  name: { type: ['string', 'null'] },
                  email: { type: ['string', 'null'] },
                  kyc_status: { type: ['string', 'null'] },
                  wallet_balance: { type: 'number' },
                  total_commissions: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '10', 10)));
      const offset = Math.max(0, parseInt((req.query as any).offset || '0', 10));

      const topEarners = await LeaderboardService.getTopEarners(limit, offset);

      return reply.send({
        count: topEarners.length,
        items: topEarners,
      });
    } catch (error) {
      console.error('Error getting top earners:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/reports/commission-breakdown:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get commission breakdown by type
   *     description: |
   *       Retrieve comprehensive commission breakdown by commission type.
   *       Shows total amount and count for each commission type (SELF, GLOBAL_HELPING, SPOT, MONTHLY).
   *     operationId: getCommissionBreakdown
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter from this date
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter until this date
   *     responses:
   *       '200':
   *         description: Commission breakdown retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_commissions:
   *                   type: number
   *                   example: 500000.00
   *                 by_type:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       total_amount:
   *                         type: number
   *                         example: 125000.00
   *                       count:
   *                         type: number
   *                         example: 500
   *                       percentage:
   *                         type: number
   *                         example: 25.0
   *                         description: Percentage of total commissions
   *       '401':
   *         description: Unauthorized
   */
  app.get('/reports/commission-breakdown', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get commission breakdown by type',
      tags: ['Admin Reports'],
      summary: 'Get Commission Breakdown',
      querystring: {
        type: 'object',
        properties: {
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_commissions: { type: 'number' },
            by_type: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  commission_type: { type: 'string' },
                  total_amount: { type: 'number' },
                  count: { type: 'number' },
                  percentage: { type: 'number' },
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

      const where: any = {};
      if (startDate || endDate) {
        where.credited_at = {};
        if (startDate) {
          where.credited_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.credited_at.lte = new Date(endDate);
        }
      }

      // Get total commissions
      const totalCommissions = await prisma.ledger_entries.aggregate({
        where,
        _sum: { amount: true },
      });

      // Get breakdown by type
      const breakdown = await prisma.ledger_entries.groupBy({
        by: ['commission_type'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      const totalAmount = Number(totalCommissions._sum.amount || 0);

      const byType = breakdown.map((item) => {
        const amount = Number(item._sum.amount || 0);
        return {
          commission_type: item.commission_type,
          total_amount: amount,
          count: item._count.id,
          percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        };
      });

      return reply.send({
        total_commissions: totalAmount,
        by_type: byType,
      });
    } catch (error) {
      console.error('Error getting commission breakdown:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/reports/user-growth:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get user growth statistics
   *     description: |
   *       Retrieve user growth statistics with time-based breakdown.
   *       Includes total users, new users, growth rate, and trends.
   *     operationId: getUserGrowth
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [today, week, month, year, all]
   *           default: month
   *         description: Time period for the report
   *     responses:
   *       '200':
   *         description: User growth statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_users:
   *                   type: number
   *                 active_users:
   *                   type: number
   *                 inactive_users:
   *                   type: number
   *                 new_users:
   *                   type: number
   *                 growth_rate:
   *                   type: number
   *                   description: Percentage growth rate compared to previous period
   *                 period:
   *                   type: string
   *       '401':
   *         description: Unauthorized
   */
  app.get('/reports/user-growth', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get user growth statistics',
      tags: ['Admin Reports'],
      summary: 'Get User Growth',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'], default: 'month' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_users: { type: 'number' },
            active_users: { type: 'number' },
            inactive_users: { type: 'number' },
            new_users: { type: 'number' },
            growth_rate: { type: 'number' },
            period: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const period = (req.query as any).period || 'month';
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = new Date(0);
      }

      const userWhere = period === 'all' ? {} : { created_at: { gte: startDate } };
      const [totalUsers, activeUsers, inactiveUsers, newUsers] = await Promise.all([
        prisma.users.count(),
        prisma.users.count({ where: { status: 'active' } }),
        prisma.users.count({ where: { status: 'inactive' } }),
        prisma.users.count({ where: userWhere }),
      ]);

      const previousPeriodStart = new Date(startDate);
      if (period === 'month') {
        previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      } else if (period === 'week') {
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      } else {
        previousPeriodStart.setTime(0);
      }

      const previousPeriodUsers = await prisma.users.count({
        where: { created_at: { gte: previousPeriodStart, lt: startDate } },
      });

      const growthRate = previousPeriodUsers > 0
        ? ((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100
        : newUsers > 0 ? 100 : 0;

      return reply.send({
        total_users: totalUsers,
        active_users: activeUsers,
        inactive_users: inactiveUsers,
        new_users: newUsers,
        growth_rate: growthRate,
        period,
      });
    } catch (error) {
      console.error('Error getting user growth:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/reports/revenue:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get revenue reports
   *     description: |
   *       Retrieve revenue statistics with breakdown by package and time period.
   *       Includes total revenue, revenue by package, and purchase counts.
   *     operationId: getRevenueReport
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [today, week, month, year, all]
   *           default: month
   *         description: Time period for the report
   *     responses:
   *       '200':
   *         description: Revenue report retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_revenue:
   *                   type: number
   *                 total_purchases:
   *                   type: number
   *                 by_package:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       package_id:
   *                         type: number
   *                       package_name:
   *                         type: string
   *                       count:
   *                         type: number
   *                       total_amount:
   *                         type: number
   *                 period:
   *                   type: string
   *       '401':
   *         description: Unauthorized
   */
  app.get('/reports/revenue', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get revenue reports',
      tags: ['Admin Reports'],
      summary: 'Get Revenue Report',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'], default: 'month' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_revenue: { type: 'number' },
            total_purchases: { type: 'number' },
            by_package: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  package_id: { type: 'number' },
                  package_name: { type: 'string' },
                  count: { type: 'number' },
                  total_amount: { type: 'number' },
                },
              },
            },
            period: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const period = (req.query as any).period || 'month';
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = new Date(0);
      }

      const purchaseWhere = period === 'all'
        ? { status: 'completed' }
        : {
            status: 'completed',
            purchased_at: { gte: startDate },
          };

      const [totalRevenue, totalPurchases, purchasesByPackage] = await Promise.all([
        prisma.purchases.aggregate({
          where: purchaseWhere,
          _sum: { amount: true },
        }),
        prisma.purchases.count({ where: purchaseWhere }),
        prisma.purchases.groupBy({
          by: ['package_id'],
          where: purchaseWhere,
          _count: { id: true },
          _sum: { amount: true },
        }),
      ]);

      const packageIds = purchasesByPackage.map(p => p.package_id);
      const packages = await prisma.packages.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true },
      });
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      const byPackage = purchasesByPackage.map(p => ({
        package_id: p.package_id,
        package_name: packageMap.get(p.package_id) ?? 'Unknown',
        count: p._count.id,
        total_amount: p._sum.amount ? Number(p._sum.amount) : 0,
      }));

      return reply.send({
        total_revenue: totalRevenue._sum.amount ? Number(totalRevenue._sum.amount) : 0,
        total_purchases: totalPurchases,
        by_package: byPackage,
        period,
      });
    } catch (error) {
      console.error('Error getting revenue report:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/reports/active-users:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get active users count
   *     description: |
   *       Retrieve count of active users (users with active purchases).
   *       Includes breakdown by status and KYC status.
   *     operationId: getActiveUsers
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: Active users count retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_active:
   *                   type: number
   *                   description: Users with active purchases
   *                 total_users:
   *                   type: number
   *                 by_status:
   *                   type: object
   *                   properties:
   *                     active:
   *                       type: number
   *                     inactive:
   *                       type: number
   *                 by_kyc:
   *                   type: object
   *                   properties:
   *                     pending:
   *                       type: number
   *                     approved:
   *                       type: number
   *                     rejected:
   *                       type: number
   *       '401':
   *         description: Unauthorized
   */
  app.get('/reports/active-users', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get active users count',
      tags: ['Admin Reports'],
      summary: 'Get Active Users',
      response: {
        200: {
          type: 'object',
          properties: {
            total_active: { type: 'number' },
            total_users: { type: 'number' },
            by_status: {
              type: 'object',
              properties: {
                active: { type: 'number' },
                inactive: { type: 'number' },
              },
            },
            by_kyc: {
              type: 'object',
              properties: {
                pending: { type: 'number' },
                approved: { type: 'number' },
                rejected: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const now = new Date();

      // Get users with active purchases (expiry is based on 2x, not active_until date)
      const allPurchases = await prisma.purchases.findMany({
        where: {
          status: 'completed',
        },
        select: { id: true, user_id: true },
      });
      
      const activeUserIds = new Set<string>();
      for (const purchase of allPurchases) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
        if (!isDoubleReached) {
          activeUserIds.add(purchase.user_id.toString());
        }
      }
      
      const totalActive = activeUserIds.size;

      const [totalUsers, activeStatus, inactiveStatus, pendingKYC, approvedKYC, rejectedKYC] = await Promise.all([
        prisma.users.count(),
        prisma.users.count({ where: { status: 'active' } }),
        prisma.users.count({ where: { status: 'inactive' } }),
        prisma.users.count({ where: { kyc_status: 'pending' } }),
        prisma.users.count({ where: { kyc_status: 'approved' } }),
        prisma.users.count({ where: { kyc_status: 'rejected' } }),
      ]);

      return reply.send({
        total_active: totalActive,
        total_users: totalUsers,
        by_status: {
          active: activeStatus,
          inactive: inactiveStatus,
        },
        by_kyc: {
          pending: pendingKYC,
          approved: approvedKYC,
          rejected: rejectedKYC,
        },
      });
    } catch (error) {
      console.error('Error getting active users:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/reports/team-performance:
   *   get:
   *     tags:
   *       - Admin Reports
   *     summary: Get all teams performance
   *     description: |
   *       Retrieve performance statistics for all teams in the system.
   *       Includes top performing teams by business volume and referrals.
   *     operationId: getAllTeamsPerformance
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           minimum: 1
   *           maximum: 100
   *         description: Number of top teams to return
   *     responses:
   *       '200':
   *         description: Team performance retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 top_teams:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user_id:
   *                         type: string
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                       direct_referrals:
   *                         type: number
   *                       total_team_size:
   *                         type: number
   *                       active_members:
   *                         type: number
   *                       total_business_volume:
   *                         type: number
   *       '401':
   *         description: Unauthorized
   */
  app.get('/reports/team-performance', {
    preHandler: [adminAuth, checkPermission('INCOME_REPORT_VIEW')],
    schema: {
      description: 'Get all teams performance',
      tags: ['Admin Reports'],
      summary: 'Get All Teams Performance',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            top_teams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  direct_referrals: { type: 'number' },
                  total_team_size: { type: 'number' },
                  active_members: { type: 'number' },
                  total_business_volume: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '10', 10)));

      // Get users with direct referrals
      const referralCounts = await prisma.user_tree_paths.groupBy({
        by: ['ancestor_id'],
        where: { depth: 1 },
        _count: { descendant_id: true },
        orderBy: { _count: { descendant_id: 'desc' } },
        take: limit * 2, // Get more to filter by business volume
      });

      const userIds = referralCounts.map(r => r.ancestor_id as unknown as bigint);
      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id.toString(), u.name]));

      const now = new Date();
      const teamStats = await Promise.all(
        userIds.map(async (userId) => {
          const [directReferrals, totalTeamSize, downlinePaths] = await Promise.all([
            prisma.user_tree_paths.count({ where: { ancestor_id: userId, depth: 1 } }),
            prisma.user_tree_paths.count({ where: { ancestor_id: userId, depth: { gt: 0 } } }),
            prisma.user_tree_paths.findMany({
              where: { ancestor_id: userId, depth: { gt: 0 } },
              select: { descendant_id: true },
            }),
          ]);

          const downlineIds = [...new Set(downlinePaths.map(p => p.descendant_id.toString()))];
          // Expiry is based on 2x income (self + global), NOT active_until date
          const allPurchases = await prisma.purchases.findMany({
            where: {
              user_id: { in: downlineIds.map(id => BigInt(id)) },
              status: 'completed',
            },
            select: { id: true, user_id: true },
          });
          
          const activeMemberIds = new Set<string>();
          for (const purchase of allPurchases) {
            const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
            if (!isDoubleReached) {
              activeMemberIds.add(purchase.user_id.toString());
            }
          }
          const activeMembers = activeMemberIds.size;
          
          const [businessVolume] = await Promise.all([
            prisma.purchases.aggregate({
              where: {
                user_id: { in: downlineIds.map(id => BigInt(id)) },
                status: 'completed',
              },
              _sum: { amount: true },
            }),
          ]);

          return {
            user_id: userId.toString(),
            user_name: userMap.get(userId.toString()) ?? null,
            direct_referrals: directReferrals,
            total_team_size: totalTeamSize,
            active_members: activeMembers,
            total_business_volume: businessVolume._sum.amount ? Number(businessVolume._sum.amount) : 0,
          };
        })
      );

      // Sort by business volume and take top N
      const topTeams = teamStats
        .sort((a, b) => b.total_business_volume - a.total_business_volume)
        .slice(0, limit);

      return reply.send({
        top_teams: topTeams,
      });
    } catch (error) {
      console.error('Error getting team performance:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

