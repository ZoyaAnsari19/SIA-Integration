import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';

export async function pathRankRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/path-rank:
   *   get:
   *     tags:
   *       - Path Rank
   *     summary: Get level-wise details and earnings
   *     description: |
   *       Retrieve level-wise details and earnings for the authenticated user.
   *       Includes eligibility status, commission percentages, and earnings breakdown per level.
   *     operationId: getPathRank
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Path rank details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 levels:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 1
   *                       title:
   *                         type: string
   *                         example: "Company City Manager"
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 2.50
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 0.30
   *                       eligible:
   *                         type: boolean
   *                         example: true
   *                       earnings:
   *                         type: object
   *                         properties:
   *                           spot_commissions:
   *                             type: number
   *                             example: 5000.00
   *                           monthly_commissions:
   *                             type: number
   *                             example: 2500.00
   *                           total_earnings:
   *                             type: number
   *                             example: 7500.00
   *                           commission_count:
   *                             type: number
   *                             example: 50
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'Get level-wise details and earnings',
      tags: ['Path Rank'],
      summary: 'Get Path Rank',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            levels: {
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
                  eligible: { type: 'boolean' },
                  earnings: {
                    type: 'object',
                    properties: {
                      spot_commissions: { type: 'number' },
                      monthly_commissions: { type: 'number' },
                      total_earnings: { type: 'number' },
                      commission_count: { type: 'number' },
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
      const userId = BigInt((req as any).user.user_id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get eligibility and levels
      const [elig, levels] = await Promise.all([
        prisma.level_eligibility.findUnique({ where: { user_id: userId } }),
        prisma.levels.findMany({ orderBy: { level: 'asc' } }),
      ]);

      const eligibility = elig?.eligibility ?? {};
      const levelsMap = new Map(levels.map(l => [l.level, l]));

      // Get commission earnings by level from metadata
      const allCommissions = await prisma.ledger_entries.findMany({
        where: {
          receiver_user_id: userId,
          commission_type: { in: ['SPOT', 'MONTHLY'] },
        },
        select: { 
          amount: true, 
          commission_type: true, 
          metadata: true, 
          source_user_id: true,
          id: true,
        },
      });

      // Get user tree paths to calculate level from depth
      const userTreePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: { gte: 1, lte: 9 },
        },
        select: { descendant_id: true, depth: true },
      });
      
      // Create map: source_user_id -> depth (which equals level)
      const sourceToLevelMap = new Map<string, number>();
      userTreePaths.forEach(path => {
        const sourceId = path.descendant_id.toString();
        const level = path.depth; // depth 1 = level 0, depth 2 = level 1, etc.
        sourceToLevelMap.set(sourceId, level - 1); // Convert depth to level (depth 1 -> level 0)
      });

      // Get direct referrals to identify level 0 commissions
      const directReferrals = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: 1,
        },
        select: { descendant_id: true },
      });
      const directReferralIds = new Set(directReferrals.map(r => r.descendant_id.toString()));

      // Group earnings by level from metadata
      const levelEarnings: Record<number, { spot: number; monthly: number; count: number }> = {};
      for (let level = 0; level <= 9; level++) {
        levelEarnings[level] = { spot: 0, monthly: 0, count: 0 };
      }

      allCommissions.forEach((c) => {
        const metadata = c.metadata as any;
        let level = metadata?.level !== undefined && metadata?.level !== null 
          ? parseInt(String(metadata.level), 10) 
          : null;
        
        // If level not in metadata, try to calculate from source_user_id and tree paths
        if (level === null && c.source_user_id) {
          const sourceId = c.source_user_id.toString();
          
          // Check if it's a direct referral (level 0)
          if (directReferralIds.has(sourceId)) {
            level = 0;
          } else {
            // Get level from tree path (depth - 1 = level)
            const calculatedLevel = sourceToLevelMap.get(sourceId);
            if (calculatedLevel !== undefined && calculatedLevel >= 0 && calculatedLevel <= 9) {
              level = calculatedLevel;
            }
          }
        }
        
        // For SPOT commissions, also check depth in metadata as fallback
        if (level === null && c.commission_type === 'SPOT' && metadata?.depth) {
          const depth = parseInt(String(metadata.depth), 10);
          if (depth >= 1 && depth <= 10) {
            level = depth - 1; // depth 1 = level 0, depth 2 = level 1, etc.
          }
        }
        
        if (level !== null && level >= 0 && level <= 9) {
          if (c.commission_type === 'SPOT') {
            levelEarnings[level].spot += Number(c.amount);
          } else if (c.commission_type === 'MONTHLY') {
            levelEarnings[level].monthly += Number(c.amount);
          }
          levelEarnings[level].count += 1;
        }
      });

      // Build response
      const levelsWithEarnings = [];
      for (let level = 0; level <= 9; level++) {
        const levelData = levelsMap.get(level);
        const earnings = levelEarnings[level];
        // Level 0 is always eligible (direct referrer), others check eligibility
        const isEligible = level === 0 ? true : Boolean(eligibility[String(level)]);

        levelsWithEarnings.push({
          level,
          title: levelData?.title || `Level ${level}`,
          description: levelData?.description || null,
          reward: levelData?.reward || null,
          spot_commission_percent: levelData?.spot_commission_percent ? Number(levelData.spot_commission_percent) : null,
          monthly_royalty_percent: levelData?.monthly_royalty_percent ? Number(levelData.monthly_royalty_percent) : null,
          eligible: isEligible,
          earnings: {
            spot_commissions: earnings.spot,
            monthly_commissions: earnings.monthly,
            total_earnings: earnings.spot + earnings.monthly,
            commission_count: earnings.count,
          },
        });
      }

      return reply.send({
        user_id: userId.toString(),
        levels: levelsWithEarnings,
      });
    } catch (error) {
      console.error('Error getting user levels:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/path-rank/eligibility:
   *   get:
   *     tags:
   *       - Path Rank
   *     summary: Get detailed eligibility information
   *     description: |
   *       Retrieve detailed eligibility information including business volume per leg,
   *       level requirements, and eligibility status for each level.
   *     operationId: getPathRankEligibility
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Eligibility details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 eligibility_status:
   *                   type: object
   *                   additionalProperties:
   *                     type: boolean
   *                   example:
   *                     "1": true
   *                     "2": false
   *                     "3": false
   *                 leg_volumes:
   *                   type: object
   *                   additionalProperties:
   *                     type: number
   *                   example:
   *                     "5": 20000.00
   *                     "6": 15000.00
   *                 level_requirements:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 2
   *                       required_leg_count:
   *                         type: number
   *                         nullable: true
   *                         example: 2
   *                       required_leg_min_amount:
   *                         type: number
   *                         nullable: true
   *                         example: 10000.00
   *                       is_eligible:
   *                         type: boolean
   *                         example: true
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/eligibility', {
    preHandler: requireUser,
    schema: {
      description: 'Get detailed eligibility information',
      tags: ['Path Rank'],
      summary: 'Get Eligibility Details',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            eligibility_status: {
              type: 'object',
              additionalProperties: { type: 'boolean' },
            },
            leg_volumes: {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
            leg_details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  leg_user_id: { type: 'string' },
                  leg_business_volume: { type: 'number' },
                  leg_user_name: { type: ['string', 'null'] },
                },
              },
            },
            level_requirements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  required_leg_count: { type: ['number', 'null'] },
                  required_leg_min_amount: { type: ['number', 'null'] },
                  total_business: { type: ['number', 'null'] },
                  is_eligible: { type: 'boolean' },
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
      const userId = BigInt((req as any).user.user_id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get eligibility status
      const eligibility = await prisma.level_eligibility.findUnique({
        where: { user_id: userId },
      });

      // Get direct referrals (legs)
      const directLegs = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: 1,
        },
      });

      // Calculate business volume per leg with user names
      const legVolumes: Record<string, number> = {};
      const legDetails: Array<{ leg_user_id: string; leg_business_volume: number; leg_user_name: string | null }> = [];
      
      for (const leg of directLegs) {
        const legId = leg.descendant_id as unknown as bigint;
        const legTeam = await prisma.user_tree_paths.findMany({
          where: { ancestor_id: legId },
        });
        const memberIds = [
          legId.toString(),
          ...legTeam.map((t) => t.descendant_id.toString()),
        ];

        const sum = await prisma.purchases.aggregate({
          _sum: { amount: true },
          where: {
            user_id: { in: memberIds.map((x) => BigInt(x)) },
            status: 'completed',
          },
        });
        const volume = Number(sum._sum.amount ?? 0);
        legVolumes[legId.toString()] = volume;
        legDetails.push({
          leg_user_id: legId.toString(),
          leg_business_volume: volume,
          leg_user_name: null, // Will be filled below
        });
      }

      // Get leg user names
      if (legDetails.length > 0) {
        const legUserIds = legDetails.map(l => BigInt(l.leg_user_id));
        const legUsers = await prisma.users.findMany({
          where: { id: { in: legUserIds } },
          select: { id: true, name: true },
        });
        const legUserMap = new Map(legUsers.map(u => [u.id.toString(), u.name]));
        
        legDetails.forEach(leg => {
          leg.leg_user_name = legUserMap.get(leg.leg_user_id) ?? null;
        });
      }

      // Get level requirements
      const levels = await prisma.levels.findMany({
        where: { level: { gte: 1, lte: 9 } },
        orderBy: { level: 'asc' },
      });

      const eligibilityStatus = (eligibility?.eligibility as Record<string, boolean>) || {};
      const levelRequirements = levels.map((levelData) => {
        const level = levelData.level;
        const businessReq = levelData.business_requirement as {
          required_leg_count?: number;
          required_leg_min_amount?: number;
          total_business?: number;
        } | null;

        const requiredLegCount = businessReq?.required_leg_count ?? null;
        const requiredLegMinAmount = businessReq?.required_leg_min_amount ?? null;
        const totalBusiness = businessReq?.total_business ?? null;

        // Check if eligible
        const isEligible = eligibilityStatus[String(level)] ?? false;

        return {
          level,
          required_leg_count: requiredLegCount,
          required_leg_min_amount: requiredLegMinAmount
            ? Number(requiredLegMinAmount)
            : null,
          total_business: totalBusiness != null ? Number(totalBusiness) : null,
          is_eligible: isEligible,
        };
      });

      return reply.send({
        user_id: userId.toString(),
        eligibility_status: eligibilityStatus,
        leg_volumes: legVolumes,
        leg_details: legDetails.sort((a, b) => b.leg_business_volume - a.leg_business_volume), // Sort by volume descending
        level_requirements: levelRequirements,
      });
    } catch (error) {
      console.error('Error getting eligibility details:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/path-rank/all-levels:
   *   get:
   *     tags:
   *       - Path Rank
   *     summary: Get all levels with details
   *     description: |
   *       Retrieve all levels (0-9) with their official titles, descriptions, rewards,
   *       commission percentages, and business requirements.
   *     operationId: getPathRankAllLevels
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: All levels retrieved successfully
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
   *                       level:
   *                         type: number
   *                         example: 1
   *                       title:
   *                         type: string
   *                         example: "Company City Manager"
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 2.50
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 0.30
   *                       business_requirement:
   *                         type: object
   *                         nullable: true
   *                       icon_url:
   *                         type: string
   *                         nullable: true
   *                       color:
   *                         type: string
   *                         nullable: true
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *       '401':
   *         description: Unauthorized
   */
  app.get('/all-levels', {
    preHandler: requireUser,
    schema: {
      description: 'Get all levels with details',
      tags: ['Path Rank'],
      summary: 'Get All Levels',
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
                  level: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  reward: { type: 'string', nullable: true },
                  spot_commission_percent: { type: 'number', nullable: true },
                  monthly_royalty_percent: { type: 'number', nullable: true },
                  business_requirement: { type: 'object', nullable: true },
                  icon_url: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
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
      const levels = await prisma.levels.findMany({ 
        orderBy: { level: 'asc' },
      });

      return reply.send({
        count: levels.length,
        items: levels.map(l => ({
          level: l.level,
          title: l.title,
          description: l.description,
          reward: l.reward,
          spot_commission_percent: l.spot_commission_percent ? Number(l.spot_commission_percent) : null,
          monthly_royalty_percent: l.monthly_royalty_percent ? Number(l.monthly_royalty_percent) : null,
          business_requirement: l.business_requirement,
          icon_url: l.icon_url,
          color: l.color,
          created_at: l.created_at,
          updated_at: l.updated_at,
        })),
      });
    } catch (error) {
      console.error('Error fetching levels:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

