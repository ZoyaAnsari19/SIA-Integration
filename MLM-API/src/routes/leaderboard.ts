import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { LeaderboardService } from '../modules/leaderboard/leaderboardService.js';
import { getBadgeForRank } from '../constants/leaderboard.js';

export async function leaderboardRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/leaderboard/top-earners:
   *   get:
   *     tags:
   *       - Leaderboard
   *     summary: Get top earners by wallet balance
   *     description: |
   *       Retrieve a ranked list of users sorted by their wallet balance (highest first).
   *       This leaderboard shows users with the highest earnings in their wallet.
   *     operationId: getTopEarners
   *     security:
   *       - bearerAuth: []
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
   *                 total:
   *                   type: number
   *                   example: 100
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
   *                         example: "9"
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
   *                         example: 75000.00
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/top-earners', {
    preHandler: requireUser,
    schema: {
      description: 'Get top earners by wallet balance',
      tags: ['Leaderboard'],
      summary: 'Top Earners',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 10, minimum: 1, maximum: 100 },
          offset: { type: 'number', default: 0, minimum: 0 },
          period: { type: 'string', enum: ['today', 'week', 'month', 'all'], default: 'all' },
          category: { type: 'string', enum: ['spot', 'monthly_royalty', 'all_income'], default: 'all_income' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  rank: { type: 'number' },
                  user_id: { type: 'string' },
                  display_id: { type: 'string', nullable: true },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string', nullable: true },
                  display_title: { type: 'string', nullable: true },
                  display_title_icon_url: { type: 'string', nullable: true },
                  wallet_balance: { type: 'number' },
                  total_commissions: { type: 'number' },
                  profile_photo_url: { type: 'string', nullable: true },
                  level: { type: 'number', nullable: true },
                  level_name: { type: 'string', nullable: true },
                  global_ids: { type: 'number', nullable: true },
                  badge: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      name: { type: 'string' },
                      emoji: { type: 'string' },
                      description: { type: 'string' },
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
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '10', 10)));
      const offset = Math.max(0, parseInt((req.query as any).offset || '0', 10));
      const period = ((req.query as any).period || 'all') as 'today' | 'week' | 'month' | 'all';
      const category = ((req.query as any).category || 'all_income') as 'spot' | 'monthly_royalty' | 'all_income';

      console.log('[Leaderboard API] Request received:', { limit, offset, period, category, query: req.query });

      const [items, total] = await Promise.all([
        LeaderboardService.getTopEarners(limit, offset, period, category),
        LeaderboardService.getTopEarnersCount(period, category),
      ]);

      console.log('[Leaderboard API] Response:', { period, category, itemsCount: items.length, firstItemBalance: items[0]?.wallet_balance });

      return reply.send({
        count: items.length,
        total,
        items: items.map((item, index) => {
          const rank = offset + index + 1;
          const badge = getBadgeForRank(rank);
          return {
            ...item,
            rank,
            badge: badge ? {
              name: badge.name,
              emoji: badge.emoji,
              description: badge.description,
            } : null,
          };
        }),
      });
    } catch (error) {
      console.error('Error getting top earners:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/leaderboard/top-referrers:
   *   get:
   *     tags:
   *       - Leaderboard
   *     summary: Get top referrers by number of direct referrals
   *     description: |
   *       Retrieve a ranked list of users sorted by the number of direct referrals they have.
   *       This leaderboard shows users who have successfully referred the most people.
   *     operationId: getTopReferrers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           minimum: 1
   *           maximum: 100
   *         description: Number of top referrers to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *           minimum: 0
   *         description: Offset for pagination
   *     responses:
   *       '200':
   *         description: Top referrers retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 10
   *                 total:
   *                   type: number
   *                   example: 50
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
   *                         example: "9"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Top Referrer"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "referrer@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "approved"
   *                       direct_referrals:
   *                         type: number
   *                         example: 25
   *                       total_team_size:
   *                         type: number
   *                         example: 500
   *                       active_referrals:
   *                         type: number
   *                         example: 20
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/top-referrers', {
    preHandler: requireUser,
    schema: {
      description: 'Get top referrers by number of direct referrals',
      tags: ['Leaderboard'],
      summary: 'Top Referrers',
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
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  rank: { type: 'number' },
                  user_id: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string', nullable: true },
                  direct_referrals: { type: 'number' },
                  total_team_size: { type: 'number' },
                  active_referrals: { type: 'number' },
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
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '10', 10)));
      const offset = Math.max(0, parseInt((req.query as any).offset || '0', 10));

      const [items, total] = await Promise.all([
        LeaderboardService.getTopReferrers(limit, offset),
        LeaderboardService.getTopReferrersCount(),
      ]);

      return reply.send({
        count: items.length,
        total,
        items: items.map((item, index) => {
          const rank = offset + index + 1;
          const badge = getBadgeForRank(rank);
          return {
            ...item,
            rank,
            badge: badge ? {
              name: badge.name,
              emoji: badge.emoji,
              description: badge.description,
            } : null,
          };
        }),
      });
    } catch (error) {
      console.error('Error getting top referrers:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/leaderboard/business-volume:
   *   get:
   *     tags:
   *       - Leaderboard
   *     summary: Get top users by business volume
   *     description: |
   *       Retrieve a ranked list of users sorted by their total business volume (sum of all purchases).
   *       This includes both direct purchases and team purchases.
   *     operationId: getTopBusinessVolume
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           minimum: 1
   *           maximum: 100
   *         description: Number of top users to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *           minimum: 0
   *         description: Offset for pagination
   *     responses:
   *       '200':
   *         description: Top business volume users retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 10
   *                 total:
   *                   type: number
   *                   example: 75
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
   *                         example: "9"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Top Business"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "business@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "approved"
   *                       total_business_volume:
   *                         type: number
   *                         example: 500000.00
   *                       direct_business:
   *                         type: number
   *                         example: 25000.00
   *                       team_business:
   *                         type: number
   *                         example: 475000.00
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/business-volume', {
    preHandler: requireUser,
    schema: {
      description: 'Get top users by business volume',
      tags: ['Leaderboard'],
      summary: 'Top Business Volume',
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
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  rank: { type: 'number' },
                  user_id: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string', nullable: true },
                  total_business_volume: { type: 'number' },
                  direct_business: { type: 'number' },
                  team_business: { type: 'number' },
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
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '10', 10)));
      const offset = Math.max(0, parseInt((req.query as any).offset || '0', 10));

      const [items, total] = await Promise.all([
        LeaderboardService.getTopBusinessVolume(limit, offset),
        LeaderboardService.getBusinessVolumeCount(),
      ]);

      return reply.send({
        count: items.length,
        total,
        items: items.map((item, index) => {
          const rank = offset + index + 1;
          const badge = getBadgeForRank(rank);
          return {
            ...item,
            rank,
            badge: badge ? {
              name: badge.name,
              emoji: badge.emoji,
              description: badge.description,
            } : null,
          };
        }),
      });
    } catch (error) {
      console.error('Error getting business volume leaderboard:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/leaderboard/my-position:
   *   get:
   *     tags:
   *       - Leaderboard
   *     summary: Get current user's position in all leaderboards
   *     description: |
   *       Retrieve the authenticated user's rank and position across all leaderboards.
   *       This includes their rank in top earners, top referrers, and business volume leaderboards.
   *     operationId: getMyPosition
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: User position retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "9"
   *                 leaderboards:
   *                   type: object
   *                   properties:
   *                     top_earners:
   *                       type: object
   *                       properties:
   *                         rank:
   *                           type: number
   *                           nullable: true
   *                           example: 15
   *                         total_participants:
   *                           type: number
   *                           example: 1000
   *                         value:
   *                           type: number
   *                           example: 25000.00
   *                         total_commissions:
   *                           type: number
   *                           example: 35000.00
   *                     top_referrers:
   *                       type: object
   *                       properties:
   *                         rank:
   *                           type: number
   *                           nullable: true
   *                           example: 5
   *                         total_participants:
   *                           type: number
   *                           example: 500
   *                         value:
   *                           type: number
   *                           example: 25
   *                         total_team_size:
   *                           type: number
   *                           example: 250
   *                     business_volume:
   *                       type: object
   *                       properties:
   *                         rank:
   *                           type: number
   *                           nullable: true
   *                           example: 8
   *                         total_participants:
   *                           type: number
   *                           example: 800
   *                         value:
   *                           type: number
   *                           example: 500000.00
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/my-position', {
    preHandler: requireUser,
    schema: {
      description: 'Get current user position in all leaderboards',
      tags: ['Leaderboard'],
      summary: 'My Position',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'week', 'month', 'all'], default: 'all' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            leaderboards: {
              type: 'object',
              properties: {
                top_earners: {
                  type: 'object',
                  properties: {
                    rank: { type: 'number', nullable: true },
                    total_participants: { type: 'number' },
                    value: { type: 'number' },
                    total_commissions: { type: 'number' },
                  },
                },
                top_referrers: {
                  type: 'object',
                  properties: {
                    rank: { type: 'number', nullable: true },
                    total_participants: { type: 'number' },
                    value: { type: 'number' },
                    total_team_size: { type: 'number' },
                  },
                },
                business_volume: {
                  type: 'object',
                  properties: {
                    rank: { type: 'number', nullable: true },
                    total_participants: { type: 'number' },
                    value: { type: 'number' },
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
      const authenticatedUser = (req as any).user;
      const userId = BigInt(authenticatedUser.user_id);
      const period = ((req.query as any).period || 'all') as 'week' | 'month' | 'all';

      const position = await LeaderboardService.getUserPosition(userId, period);
      return reply.send(position);
    } catch (error) {
      console.error('Error getting user position:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

