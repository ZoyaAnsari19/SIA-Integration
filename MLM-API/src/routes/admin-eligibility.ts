import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { computeEligibilityForUser } from '../modules/commissions/eligibility.compute.js';

export async function adminEligibilityRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/users/{id}/eligibility:
   *   get:
   *     tags:
   *       - Admin Eligibility
   *     summary: View any user's eligibility
   *     description: |
   *       Retrieve eligibility information for any user (Admin only).
   *       Includes detailed level information and eligibility status.
   *     operationId: getUserEligibilityAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Eligibility retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                 user_name:
   *                   type: string
   *                   nullable: true
   *                 eligibility:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                       title:
   *                         type: string
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                       business_requirement:
   *                         type: object
   *                         nullable: true
   *                       eligible:
   *                         type: boolean
   *                       icon_url:
   *                         type: string
   *                         nullable: true
   *                       color:
   *                         type: string
   *                         nullable: true
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/users/:id/eligibility', {
    preHandler: adminAuth,
    schema: {
      description: 'View any user eligibility (Admin only)',
      tags: ['Admin Eligibility'],
      summary: 'Get User Eligibility',
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
            user_id: { type: 'string' },
            user_name: { type: ['string', 'null'] },
            eligibility: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  reward: { type: ['string', 'null'] },
                  spot_commission_percent: { type: ['number', 'null'] },
                  monthly_royalty_percent: { type: ['number', 'null'] },
                  business_requirement: { type: ['object', 'null'] },
                  eligible: { type: 'boolean' },
                  icon_url: { type: ['string', 'null'] },
                  color: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Fetch user eligibility and all levels
      const [elig, levels] = await Promise.all([
        prisma.level_eligibility.findUnique({ where: { user_id: userId } }),
        prisma.levels.findMany({ orderBy: { level: 'asc' } }),
      ]);

      const eligibility = elig?.eligibility ?? {};
      const levelsMap = new Map(levels.map(l => [l.level, l]));

      // Build response with level details
      const eligibilityWithDetails = [];

      for (let level = 0; level <= 9; level++) {
        const levelData = levelsMap.get(level);
        const isEligible = Boolean(eligibility[String(level)]);

        eligibilityWithDetails.push({
          level,
          title: levelData?.title || `Level ${level}`,
          description: levelData?.description || null,
          reward: levelData?.reward || null,
          spot_commission_percent: levelData?.spot_commission_percent ? Number(levelData.spot_commission_percent) : null,
          monthly_royalty_percent: levelData?.monthly_royalty_percent ? Number(levelData.monthly_royalty_percent) : null,
          business_requirement: levelData?.business_requirement || null,
          eligible: isEligible,
          icon_url: levelData?.icon_url || null,
          color: levelData?.color || null,
        });
      }

      return reply.send({
        user_id: userId.toString(),
        user_name: user.name,
        eligibility: eligibilityWithDetails,
      });
    } catch (error) {
      console.error('Error getting user eligibility:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/eligibility/recalculate:
   *   post:
   *     tags:
   *       - Admin Eligibility
   *     summary: Manually recalculate eligibility
   *     description: |
   *       Manually trigger recalculation of eligibility for a specific user or all users.
   *       This updates the level_eligibility table based on current business volume.
   *     operationId: recalculateEligibility
   *     security:
   *       - adminAuth: []
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               user_id:
   *                 type: string
   *                 description: User ID to recalculate. If not provided, recalculates for all users.
   *     responses:
   *       '200':
   *         description: Eligibility recalculated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 users_processed:
   *                   type: number
   *       '404':
   *         description: User not found (if user_id provided)
   *       '401':
   *         description: Unauthorized
   */
  app.post('/eligibility/recalculate', {
    preHandler: adminAuth,
    schema: {
      description: 'Manually recalculate eligibility',
      tags: ['Admin Eligibility'],
      summary: 'Recalculate Eligibility',
      body: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID to recalculate. If not provided, recalculates for all users.' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            users_processed: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = (req.body as any).user_id;

      if (userId) {
        // Recalculate for specific user
        const user = await prisma.users.findUnique({
          where: { id: BigInt(userId) },
          select: { id: true },
        });

        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }

        await computeEligibilityForUser(BigInt(userId));

        return reply.send({
          success: true,
          message: `Eligibility recalculated for user ${userId}`,
          users_processed: 1,
        });
      } else {
        // Recalculate for all users
        const users = await prisma.users.findMany({
          select: { id: true },
        });

        let processed = 0;
        for (const user of users) {
          try {
            await computeEligibilityForUser(user.id as unknown as bigint);
            processed++;
          } catch (error) {
            console.error(`Error recalculating eligibility for user ${user.id}:`, error);
          }
        }

        return reply.send({
          success: true,
          message: `Eligibility recalculated for ${processed} users`,
          users_processed: processed,
        });
      }
    } catch (error) {
      console.error('Error recalculating eligibility:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

