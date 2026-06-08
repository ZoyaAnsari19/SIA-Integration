import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

export async function teamRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/team:
   *   get:
   *     tags:
   *       - Team
   *     summary: Get downline tree (team members)
   *     description: |
   *       Retrieve downline tree (team members) for the authenticated user with level-wise breakdown.
   *       Returns all team members up to 9 levels deep, organized by level.
   *     operationId: getTeam
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: max_depth
   *         schema:
   *           type: integer
   *           default: 9
   *           minimum: 1
   *           maximum: 9
   *         description: Maximum depth to retrieve (1-9)
   *     responses:
   *       '200':
   *         description: Team members retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_team_size:
   *                   type: number
   *                   example: 50
   *                 levels:
   *                   type: object
   *                   additionalProperties:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 1
   *                       count:
   *                         type: number
   *                         example: 5
   *                       members:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             id:
   *                               type: string
   *                               example: "8"
   *                             name:
   *                               type: string
   *                               nullable: true
   *                               example: "Team Member"
   *                             email:
   *                               type: string
   *                               nullable: true
   *                               example: "member@example.com"
   *                             kyc_status:
   *                               type: string
   *                               example: "approved"
   *                             created_at:
   *                               type: string
   *                               format: date-time
   *                               example: "2025-11-08T12:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'Get downline tree (9 levels) with level-wise breakdown',
      tags: ['Team'],
      summary: 'Get Team',
      querystring: {
        type: 'object',
        properties: {
          max_depth: { type: 'number', default: 9, minimum: 1, maximum: 9 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_team_size: { type: 'number' },
            levels: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  count: { type: 'number' },
                  members: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        display_id: { type: ['string', 'null'] },
                        name: { type: 'string', nullable: true },
                        email: { type: 'string', nullable: true },
                        kyc_status: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        has_active_package: { type: 'boolean' },
                        spot_amount: { type: 'number' },
                        pending_spot_amount: { type: 'number' },
                        // Current-month MONTHLY royalty that current user received from this member
                        last_month_royalty: { type: 'number' },
                        // Total investment (sum of completed purchase amounts) for this member
                        total_investment: { type: 'number' },
                      },
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
      const maxDepth = Math.min(9, Math.max(1, parseInt((req.query as any).max_depth || '9', 10)));
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get current user's level eligibility to determine if spot should be pending
      const userEligibility = await prisma.level_eligibility.findUnique({
        where: { user_id: id },
        select: { eligibility: true },
      });
      const eligibilityMap = (userEligibility?.eligibility as Record<string, boolean>) || {};

      // Get all downline members (depth 1 to maxDepth)
      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: id,
          depth: { gt: 0, lte: maxDepth },
        },
        orderBy: { depth: 'asc' },
      });

      if (downlinePaths.length === 0) {
        return reply.send({
          total_team_size: 0,
          levels: {},
        });
      }

      // Group by level
      const levelMap = new Map<number, bigint[]>();
      for (const path of downlinePaths) {
        const level = path.depth;
        const memberId = path.descendant_id as unknown as bigint;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(memberId);
      }

      // Get unique member IDs
      const allMemberIds = Array.from(new Set(downlinePaths.map(p => p.descendant_id as unknown as bigint)));

      // Determine which members have at least one active package (expiry is based on 2x, not active_until date)
      // Also compute active package amount per member (sum of amounts of purchases that have NOT reached 2x)
      const now = new Date();
      const allPurchases = await prisma.purchases.findMany({
        where: {
          user_id: { in: allMemberIds },
          status: 'completed',
        },
        select: { id: true, user_id: true, amount: true },
      });

      const activeMemberIds = new Set<string>();
      const activePackageAmountMap = new Map<string, number>();
      for (const purchase of allPurchases) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
        if (!isDoubleReached) {
          const uid = purchase.user_id.toString();
          activeMemberIds.add(uid);
          const current = activePackageAmountMap.get(uid) || 0;
          activePackageAmountMap.set(uid, current + Number(purchase.amount || 0));
        }
      }
      
      // Fetch all members
      const members = await prisma.users.findMany({
        where: { id: { in: allMemberIds } },
        select: {
          id: true,
          display_id: true,
          name: true,
          email: true,
          kyc_status: true,
          created_at: true,
        },
      });

      const memberMap = new Map(members.map(m => [m.id.toString(), m]));

      // Get spot amounts that CURRENT USER (id) received FROM these members (source_user_id = member, receiver_user_id = current user)
      // This shows what current user earned from each team member
      const spotCommissionsFromMembers = await prisma.ledger_entries.groupBy({
        by: ['source_user_id'],
        where: {
          receiver_user_id: id, // Current user received
          source_user_id: { in: allMemberIds }, // From these team members
          commission_type: 'SPOT',
        },
        _sum: {
          amount: true,
        },
      });
      const spotAmountMap = new Map(
        spotCommissionsFromMembers.map(s => [s.source_user_id.toString(), Number(s._sum.amount || 0)])
      );

      // Get pending spot amounts that CURRENT USER (id) should receive FROM these members
      // (waiting for level qualification)
      const pendingSpotCommissionsFromMembers = await prisma.pending_commissions.groupBy({
        by: ['source_user_id'],
        where: {
          receiver_user_id: id, // Current user should receive
          source_user_id: { in: allMemberIds }, // From these team members
          commission_type: 'SPOT',
        },
        _sum: {
          amount: true,
        },
      });
      const pendingSpotAmountMap = new Map(
        pendingSpotCommissionsFromMembers.map(s => [s.source_user_id.toString(), Number(s._sum.amount || 0)])
      );

      // Get current month royalty (MONTHLY commissions) that CURRENT USER (id) received FROM these members
      // "Current month" = from the 1st of this month until now
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthlyRoyaltyFromMembers = await prisma.ledger_entries.groupBy({
        by: ['source_user_id'],
        where: {
          receiver_user_id: id,
          source_user_id: { in: allMemberIds },
          commission_type: 'MONTHLY',
          credited_at: {
            gte: startOfThisMonth,
            lte: now,
          },
        },
        _sum: {
          amount: true,
        },
      });
      const lastMonthRoyaltyMap = new Map(
        monthlyRoyaltyFromMembers.map(r => [r.source_user_id.toString(), Number(r._sum.amount || 0)])
      );

      // Build level-wise response
      const levels: Record<string, any> = {};
      for (let level = 1; level <= maxDepth; level++) {
        const memberIds = levelMap.get(level) || [];
        const uniqueMemberIds = Array.from(new Set(memberIds.map(id => id.toString())));
        
        levels[String(level)] = {
          level,
          count: uniqueMemberIds.length,
          members: uniqueMemberIds.map(mid => {
            const member = memberMap.get(mid);
            if (!member) return null;
            const hasActivePackage = activeMemberIds.has(member.id.toString());
            // Spot amount that current user received FROM this member (credited)
            let creditedSpot = spotAmountMap.get(member.id.toString()) || 0;
            // Pending spot amount that current user should receive FROM this member (waiting for level qualification)
            let pendingSpot = pendingSpotAmountMap.get(member.id.toString()) || 0;
            const lastMonthRoyalty = lastMonthRoyaltyMap.get(member.id.toString()) || 0;
            
            // Direct referrals (Level 1) ALWAYS get spot immediately - no level qualification check
            // Only Level 2+ check level qualification
            if (level === 1) {
              // Level 1 (direct) - always show credited, never pending
              // Direct referrals get spot immediately regardless of qualification
              pendingSpot = 0;
            } else {
              // Level 2+ - check if current user is qualified for this level
              // eligibilityMap is keyed by business level (0 = direct, 1 = depth2, 2 = depth3, ...)
              // so for depth=N we need to look at levelIndex = N - 1
              const levelIndex = level - 1;
              const isQualifiedForLevel = eligibilityMap[String(levelIndex)] === true;
              if (!isQualifiedForLevel && creditedSpot > 0) {
                // User is not qualified, so show as pending (even if already credited in DB)
                pendingSpot = creditedSpot + pendingSpot;
                creditedSpot = 0;
              }
            }
            // Active package amount only (purchases that have not reached 2x), not total of all purchases
            const totalInvestment = activePackageAmountMap.get(member.id.toString()) || 0;
            return {
              id: member.id.toString(),
              display_id: member.display_id ?? null,
              name: member.name,
              email: member.email,
              kyc_status: member.kyc_status,
              created_at: member.created_at,
              has_active_package: hasActivePackage,
              spot_amount: creditedSpot,
              pending_spot_amount: pendingSpot,
              last_month_royalty: lastMonthRoyalty,
              total_investment: totalInvestment,
            };
          }).filter(Boolean),
        };
      }

      return reply.send({
        total_team_size: allMemberIds.length,
        levels,
      });
    } catch (error) {
      console.error('Error getting downline:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/team/stats:
   *   get:
   *     tags:
   *       - Team
   *     summary: Get team statistics
   *     description: |
   *       Retrieve comprehensive team statistics including total team size, active members,
   *       total business volume, direct referrals, and level-wise breakdown.
   *     operationId: getTeamStats
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Team statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_team_size:
   *                   type: number
   *                   example: 50
   *                 active_members:
   *                   type: number
   *                   example: 35
   *                 total_business_volume:
   *                   type: number
   *                   example: 250000.00
   *                 direct_referrals:
   *                   type: number
   *                   example: 5
   *                 level_breakdown:
   *                   type: object
   *                   additionalProperties:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 1
   *                       count:
   *                         type: number
   *                         example: 5
   *                       active_count:
   *                         type: number
   *                         example: 4
   *                       business_volume:
   *                         type: number
   *                         example: 50000.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/stats', {
    preHandler: requireUser,
    schema: {
      description: 'Get team statistics (size, active members, volume)',
      tags: ['Team'],
      summary: 'Get Team Stats',
      response: {
        200: {
          type: 'object',
          properties: {
            total_team_size: { type: 'number' },
            active_members: { type: 'number' },
            total_business_volume: { type: 'number' },
            direct_referrals: { type: 'number' },
            level_breakdown: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  count: { type: 'number' },
                  active_count: { type: 'number' },
                  business_volume: { type: 'number' },
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
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get all downline members (up to 9 levels)
      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: id,
          depth: { gt: 0, lte: 9 },
        },
      });

      if (downlinePaths.length === 0) {
        return reply.send({
          total_team_size: 0,
          active_members: 0,
          total_business_volume: 0,
          direct_referrals: 0,
          level_breakdown: {},
        });
      }

      const allMemberIds = Array.from(new Set(downlinePaths.map(p => p.descendant_id as unknown as bigint)));
      const directReferralIds = Array.from(new Set(
        downlinePaths.filter(p => p.depth === 1).map(p => p.descendant_id as unknown as bigint)
      ));

      // Get active members (have active purchases - not reached 2x)
      // Check each user if they have at least one active purchase (not reached 2x)
      const activeMemberIds = new Set<string>();
      const today = new Date();
      for (const memberId of allMemberIds) {
        const hasActive = await CommissionService.hasActiveCourse(memberId as bigint, today);
        if (hasActive) {
          activeMemberIds.add(memberId.toString());
        }
      }

      // Get business volume (sum of all purchases)
      const businessVolume = await prisma.purchases.aggregate({
        where: {
          user_id: { in: allMemberIds },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Level-wise breakdown
      const levelMap = new Map<number, bigint[]>();
      for (const path of downlinePaths) {
        const level = path.depth;
        const memberId = path.descendant_id as unknown as bigint;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(memberId);
      }

      const levelBreakdown: Record<string, any> = {};
      for (let level = 1; level <= 9; level++) {
        const memberIds = Array.from(new Set(levelMap.get(level) || []));
        if (memberIds.length === 0) continue;

        const levelActive = memberIds.filter(mid => activeMemberIds.has(mid.toString())).length;
        
        const levelVolume = await prisma.purchases.aggregate({
          where: {
            user_id: { in: memberIds },
            status: 'completed',
          },
          _sum: { amount: true },
        });

        levelBreakdown[String(level)] = {
          level,
          count: memberIds.length,
          active_count: levelActive,
          business_volume: levelVolume._sum.amount ? Number(levelVolume._sum.amount) : 0,
        };
      }

      return reply.send({
        total_team_size: allMemberIds.length,
        active_members: activeMemberIds.size,
        total_business_volume: businessVolume._sum.amount ? Number(businessVolume._sum.amount) : 0,
        direct_referrals: directReferralIds.length,
        level_breakdown: levelBreakdown,
      });
    } catch (error) {
      console.error('Error getting team stats:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/team/performance:
   *   get:
   *     tags:
   *       - Team
   *     summary: Get team performance report
   *     description: |
   *       Retrieve comprehensive team performance report including team summary,
   *       level-wise breakdown, and top performers from direct referrals.
   *     operationId: getTeamPerformance
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Team performance report retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 team_summary:
   *                   type: object
   *                   properties:
   *                     total_team_size:
   *                       type: number
   *                       example: 50
   *                     active_members:
   *                       type: number
   *                       example: 35
   *                     total_business_volume:
   *                       type: number
   *                       example: 250000.00
   *                     direct_referrals:
   *                       type: number
   *                       example: 5
   *                 level_breakdown:
   *                   type: object
   *                   additionalProperties:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                       count:
   *                         type: number
   *                       active_count:
   *                         type: number
   *                       business_volume:
   *                         type: number
   *                 top_performers:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user_id:
   *                         type: string
   *                       user_name:
   *                         type: string
   *                         nullable: true
   *                       business_volume:
   *                         type: number
   *                       direct_referrals:
   *                         type: number
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/performance', {
    preHandler: requireUser,
    schema: {
      description: 'Get team performance report',
      tags: ['Team'],
      summary: 'Get Team Performance',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            team_summary: {
              type: 'object',
              properties: {
                total_team_size: { type: 'number' },
                active_members: { type: 'number' },
                total_business_volume: { type: 'number' },
                direct_referrals: { type: 'number' },
              },
            },
            level_breakdown: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  count: { type: 'number' },
                  active_count: { type: 'number' },
                  business_volume: { type: 'number' },
                },
              },
            },
            top_performers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  business_volume: { type: 'number' },
                  direct_referrals: { type: 'number' },
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

      // Get downline paths
      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: { gt: 0, lte: 9 },
        },
      });

      const allMemberIds = [...new Set(downlinePaths.map(p => p.descendant_id.toString()))];
      // Expiry is based on 2x income (self + global), NOT active_until date
      const allPurchases = await prisma.purchases.findMany({
        where: {
          user_id: { in: allMemberIds.map(id => BigInt(id)) },
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

      // Get direct referrals
      const directReferralIds = downlinePaths
        .filter(p => p.depth === 1)
        .map(p => p.descendant_id.toString());

      // Calculate business volume
      const businessVolume = await prisma.purchases.aggregate({
        where: {
          user_id: { in: allMemberIds.map(id => BigInt(id)) },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Level-wise breakdown
      const levelMap = new Map<number, bigint[]>();
      for (const path of downlinePaths) {
        const level = path.depth;
        const memberId = path.descendant_id as unknown as bigint;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(memberId);
      }

      const levelBreakdown: Record<string, any> = {};
      for (let level = 1; level <= 9; level++) {
        const memberIds = Array.from(new Set(levelMap.get(level) || []));
        if (memberIds.length === 0) continue;

        const levelActive = memberIds.filter(mid => activeMemberIds.has(mid.toString())).length;
        
        const levelVolume = await prisma.purchases.aggregate({
          where: {
            user_id: { in: memberIds },
            status: 'completed',
          },
          _sum: { amount: true },
        });

        levelBreakdown[String(level)] = {
          level,
          count: memberIds.length,
          active_count: levelActive,
          business_volume: levelVolume._sum.amount ? Number(levelVolume._sum.amount) : 0,
        };
      }

      // Get top performers (direct referrals with highest business volume)
      const topPerformerIds = directReferralIds.slice(0, 10).map(id => BigInt(id));
      const topPerformersData = await Promise.all(
        topPerformerIds.map(async (memberId) => {
          const [memberBusiness, memberReferrals] = await Promise.all([
            prisma.purchases.aggregate({
              where: { user_id: memberId, status: 'completed' },
              _sum: { amount: true },
            }),
            prisma.user_tree_paths.count({
              where: { ancestor_id: memberId, depth: 1 },
            }),
          ]);

          return {
            user_id: memberId.toString(),
            business_volume: Number(memberBusiness._sum.amount || 0),
            direct_referrals: memberReferrals,
          };
        })
      );

      // Get user names
      const performerUsers = await prisma.users.findMany({
        where: { id: { in: topPerformerIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(performerUsers.map(u => [u.id.toString(), u.name]));

      const topPerformers = topPerformersData
        .map(p => ({
          ...p,
          user_name: userMap.get(p.user_id) ?? null,
        }))
        .sort((a, b) => b.business_volume - a.business_volume)
        .slice(0, 10);

      return reply.send({
        user_id: userId.toString(),
        team_summary: {
          total_team_size: allMemberIds.length,
          active_members: activeMemberIds.size,
          total_business_volume: businessVolume._sum.amount ? Number(businessVolume._sum.amount) : 0,
          direct_referrals: directReferralIds.length,
        },
        level_breakdown: levelBreakdown,
        top_performers: topPerformers,
      });
    } catch (error) {
      console.error('Error getting team performance:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/team/business-volume:
   *   get:
   *     tags:
   *       - Team
   *     summary: Get business volume per leg
   *     description: |
   *       Retrieve business volume breakdown including direct business, team business,
   *       and per-leg business volume for the authenticated user.
   *     operationId: getTeamBusinessVolume
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Business volume retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 total_business_volume:
   *                   type: number
   *                   example: 100000.00
   *                 direct_business:
   *                   type: number
   *                   example: 25000.00
   *                 team_business:
   *                   type: number
   *                   example: 75000.00
   *                 legs:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       leg_user_id:
   *                         type: string
   *                         example: "11"
   *                       leg_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "John Doe"
   *                       leg_business_volume:
   *                         type: number
   *                         example: 50000.00
   *                       direct_business:
   *                         type: number
   *                         example: 15000.00
   *                       team_business:
   *                         type: number
   *                         example: 35000.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/business-volume', {
    preHandler: requireUser,
    schema: {
      description: 'Get business volume',
      tags: ['Team'],
      summary: 'Get Business Volume',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            total_business_volume: { type: 'number' },
            direct_business: { type: 'number' },
            team_business: { type: 'number' },
            legs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  leg_user_id: { type: 'string' },
                  leg_user_name: { type: ['string', 'null'] },
                  leg_business_volume: { type: 'number' },
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
      const userId = BigInt((req as any).user.user_id);

      // Get direct business (user's own purchases)
      const directBusiness = await prisma.purchases.aggregate({
        where: {
          user_id: userId,
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Get direct referrals (legs)
      const directLegs = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: 1,
        },
      });

      // Calculate business volume per leg
      const legVolumes = await Promise.all(
        directLegs.map(async (leg) => {
          const legId = leg.descendant_id as unknown as bigint;

          // Get leg's team (all descendants of this leg)
          const legTeam = await prisma.user_tree_paths.findMany({
            where: { ancestor_id: legId },
          });
          const legTeamIds = [
            legId.toString(),
            ...legTeam.map((t) => t.descendant_id.toString()),
          ];

          // Calculate leg's direct business
          const legDirectBusiness = await prisma.purchases.aggregate({
            where: {
              user_id: legId,
              status: 'completed',
            },
            _sum: { amount: true },
          });

          // Calculate leg's team business
          let legTeamBusiness = 0;
          if (legTeamIds.length > 1) {
            const legTeamTotal = await prisma.purchases.aggregate({
              where: {
                user_id: { in: legTeamIds.slice(1).map((x) => BigInt(x)) },
                status: 'completed',
              },
              _sum: { amount: true },
            });
            legTeamBusiness = Number(legTeamTotal._sum.amount || 0);
          }

          const legDirect = Number(legDirectBusiness._sum.amount || 0);
          const legTotal = legDirect + legTeamBusiness;

          return {
            leg_user_id: legId.toString(),
            leg_business_volume: legTotal,
            direct_business: legDirect,
            team_business: legTeamBusiness,
          };
        })
      );

      // Get leg user names
      const legUserIds = legVolumes.map((l) => BigInt(l.leg_user_id));
      const legUsers = await prisma.users.findMany({
        where: { id: { in: legUserIds } },
        select: { id: true, name: true },
      });
      const legUserMap = new Map(legUsers.map((u) => [u.id.toString(), u.name]));

      const legs = legVolumes.map((leg) => ({
        ...leg,
        leg_user_name: legUserMap.get(leg.leg_user_id) ?? null,
      }));

      // Calculate total team business (sum of all leg volumes)
      const teamBusiness = legs.reduce((sum, leg) => sum + leg.leg_business_volume, 0);
      const direct = Number(directBusiness._sum.amount || 0);
      const total = direct + teamBusiness;

      return reply.send({
        user_id: userId.toString(),
        total_business_volume: total,
        direct_business: direct,
        team_business: teamBusiness,
        legs,
      });
    } catch (error) {
      console.error('Error getting business volume:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/team/tree:
   *   get:
   *     tags:
   *       - Team
   *     summary: Get team tree hierarchy (upline + downline)
   *     description: |
   *       Retrieve upline chain and downline tree for the authenticated user.
   *     operationId: getTeamTree
   *     security:
   *       - bearerAuth: []
   */
  app.get('/tree', {
    preHandler: requireUser,
    schema: {
      description: 'Get team tree hierarchy (upline + downline)',
      tags: ['Team'],
      summary: 'Get Team Tree',
      response: {
        200: {
          type: 'object',
          properties: {
            upline: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  display_id: { type: ['string', 'null'] },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: ['string', 'null'] },
                  depth: { type: 'number' },
                  level: { type: 'number' },
                  kyc_status: { type: ['string', 'null'] },
                },
              },
            },
            downline: {
              type: 'object',
              properties: {
                total_team_size: { type: 'number' },
                levels: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      level: { type: 'number' },
                      count: { type: 'number' },
                      members: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            display_id: { type: ['string', 'null'] },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            phone: { type: ['string', 'null'] },
                            status: { type: 'string' },
                            kyc_status: { type: ['string', 'null'] },
                            created_at: { type: 'string' },
                            referrer_user_id: { type: ['string', 'null'] },
                          },
                        },
                      },
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
      const userPayload = (req as any).user;
      if (!userPayload || !userPayload.user_id) {
        return reply.code(401).send({ error: 'Unauthorized - invalid token' });
      }
      const userId = BigInt(userPayload.user_id);

      // Get upline chain
      const uplinePaths = await prisma.user_tree_paths.findMany({
        where: {
          descendant_id: userId,
          depth: { gte: 1 },
        },
        orderBy: { depth: 'asc' },
      });

      const uplineUserIds = uplinePaths.map((p) => p.ancestor_id);

      const [uplineUsers, uplineProfiles, uplineKyc] = await Promise.all([
        prisma.users.findMany({
          where: { id: { in: uplineUserIds } },
          select: {
            id: true,
            display_id: true,
            name: true,
            email: true,
          },
        }),
        prisma.user_profiles.findMany({
          where: { user_id: { in: uplineUserIds } },
          select: { user_id: true, phone: true },
        }),
        prisma.kyc_documents.findMany({
          where: { user_id: { in: uplineUserIds } },
          select: { user_id: true, status: true },
        }),
      ]);

      const profileMap = new Map(uplineProfiles.map((p) => [p.user_id.toString(), p.phone]));
      const kycMap = new Map(uplineKyc.map((k) => [k.user_id.toString(), k.status]));
      const uplineMap = new Map(uplineUsers.map((u) => [u.id.toString(), u]));

      const upline = uplinePaths.map((path) => {
        const user = uplineMap.get(path.ancestor_id.toString());
        return {
          id: path.ancestor_id.toString(),
          display_id: user?.display_id ?? null,
          name: user?.name || '',
          email: user?.email || '',
          phone: profileMap.get(path.ancestor_id.toString()) || null,
          depth: path.depth,
          level: path.depth,
          kyc_status: kycMap.get(path.ancestor_id.toString()) || null,
        };
      });

      // Get downline tree (reuse logic from /team endpoint)
      const maxDepth = 9;

      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: { gte: 1, lte: maxDepth },
        },
      });

      const totalTeamSize = new Set(downlinePaths.map((p) => p.descendant_id.toString())).size;

      const downlineUserIds = Array.from(
        new Set(downlinePaths.map((p) => p.descendant_id))
      );

      const [downlineUsers, downlineProfiles, downlineKyc] = await Promise.all([
        prisma.users.findMany({
          where: { id: { in: downlineUserIds } },
          select: {
            id: true,
            display_id: true,
            name: true,
            email: true,
            status: true,
            created_at: true,
            referrer_user_id: true,
          },
        }),
        prisma.user_profiles.findMany({
          where: { user_id: { in: downlineUserIds } },
          select: { user_id: true, phone: true },
        }),
        prisma.kyc_documents.findMany({
          where: { user_id: { in: downlineUserIds } },
          select: { user_id: true, status: true },
        }),
      ]);

      const downlineProfileMap = new Map(downlineProfiles.map((p) => [p.user_id.toString(), p.phone]));
      const downlineKycMap = new Map(downlineKyc.map((k) => [k.user_id.toString(), k.status]));
      const downlineUserMap = new Map(
        downlineUsers.map((u) => [u.id.toString(), u])
      );

      // Group by level
      const levels: Record<string, any> = {};

      for (let level = 1; level <= maxDepth; level++) {
        const levelPaths = downlinePaths.filter((p) => p.depth === level);
        const levelMemberIds = Array.from(
          new Set(levelPaths.map((p) => p.descendant_id.toString()))
        );

        const members = levelMemberIds.map((id) => {
          const user = downlineUserMap.get(id);
          return {
            id,
            display_id: user?.display_id ?? null,
            name: user?.name || '',
            email: user?.email || '',
            phone: downlineProfileMap.get(id) || null,
            status: user?.status || '',
            kyc_status: downlineKycMap.get(id) || null,
            created_at: user?.created_at?.toISOString() || '',
            referrer_user_id: user?.referrer_user_id
              ? user.referrer_user_id.toString()
              : null,
          };
        });

        if (members.length > 0) {
          levels[String(level)] = {
            level,
            count: members.length,
            members,
          };
        }
      }

      return reply.send({
        upline,
        downline: {
          total_team_size: totalTeamSize,
          levels,
        },
      });
    } catch (error) {
      console.error('Team tree error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

