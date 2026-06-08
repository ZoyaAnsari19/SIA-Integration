import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { getSpotTeamWithdrawLimit } from '../utils/spotTeamWithdrawLimit.js';
import { getLockedSpotBalance, getSpotHoldDetails, getLockedMainBalance } from '../utils/wallet.js';

export async function dashboardRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/dashboard:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get user dashboard statistics
   *     description: |
   *       Retrieve comprehensive dashboard statistics for the authenticated user including
   *       wallet balance, commission summaries (SELF, GLOBAL_HELPING, SPOT, MONTHLY), direct referral commission,
   *       global helping team count, team balance, team stats, purchase stats, and recent activity.
   *     operationId: getDashboard
   *     security:
   *       - bearerAuth: []
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'Get user dashboard statistics',
      tags: ['Dashboard'],
      summary: 'Get Dashboard',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            wallet_balance: { type: 'number' },
            total_earnings: { type: 'number' },
            pending_commissions: { type: 'number' },
            total_commissions: { type: 'number' },
            commission_by_type: {
              type: 'object',
              properties: {
                SELF: { type: 'number' },
                GLOBAL_HELPING: { type: 'number' },
                SPOT: { type: 'number' },
                MONTHLY: { type: 'number' },
              },
            },
            direct_referral_commission: { type: 'number' },
            global_helping_team: {
              type: 'object',
              properties: {
                current: { type: 'number' },
                total: { type: 'number' },
              },
            },
            team_balance: { type: 'number' },
            team_stats: {
              type: 'object',
              properties: {
                direct_referrals: { type: 'number' },
                total_team_size: { type: 'number' },
                active_members: { type: 'number' },
                total_business_volume: { type: 'number' },
              },
            },
            purchase_stats: {
              type: 'object',
              properties: {
                total_purchases: { type: 'number' },
                total_spent: { type: 'number' },
                active_packages: { type: 'number' },
              },
            },
            recent_activity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  description: { type: 'string' },
                  amount: { type: ['number', 'null'] },
                  date: { type: 'string', format: 'date-time' },
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

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get wallet balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
      });

      // Get commission statistics
      const [
        totalCommissions,
        commissionsByType,
        pendingCommissions,
        mainWalletWithdrawalsResult,
      ] = await Promise.all([
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.groupBy({
          by: ['commission_type'],
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
        prisma.pending_commissions.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
        // Total withdrawals done from MAIN (other) wallet for this user
        prisma.withdraw_requests.aggregate({
          where: {
            user_id: userId,
            withdraw_type: 'wallet',
            status: {
              in: ['approved', 'processing'],
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      const commissionByTypeMap: Record<string, number> = {
        SELF: 0,
        GLOBAL_HELPING: 0,
        SPOT: 0,
        MONTHLY: 0,
      };
      commissionsByType.forEach((item: { commission_type: string; _sum: { amount: any } }) => {
        commissionByTypeMap[item.commission_type] = Number(item._sum.amount || 0);
      });

      // Get team statistics
      const [directReferrals, totalTeamSize, downlinePaths, directReferralIds] = await Promise.all([
        prisma.user_tree_paths.count({
          where: { ancestor_id: userId, depth: 1 },
        }),
        prisma.user_tree_paths.count({
          // IMPORTANT: Limit to 9 levels to match /team and /team/stats APIs
          where: { ancestor_id: userId, depth: { gt: 0, lte: 9 } },
        }),
        prisma.user_tree_paths.findMany({
          where: { ancestor_id: userId, depth: { gt: 0, lte: 9 } },
          select: { descendant_id: true },
        }),
        prisma.user_tree_paths.findMany({
          where: { ancestor_id: userId, depth: 1 },
          select: { descendant_id: true },
        }),
      ]);

      const downlineIds = [...new Set(downlinePaths.map((p: any) => p.descendant_id.toString()))];
      const downlineIdsBigInt = downlineIds.length > 0 ? downlineIds.map((id) => BigInt(id as string)) : [];
      const directReferralIdList = directReferralIds.map((r: any) => r.descendant_id as unknown as bigint);

      // Get Direct Referral Commission (SPOT commissions from direct referrals)
      const directReferralCommission = directReferralIdList.length > 0
        ? await prisma.ledger_entries.aggregate({
            where: {
              receiver_user_id: userId,
              commission_type: 'SPOT',
              source_user_id: { in: directReferralIdList },
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: null } };

      // Get Global Helping Team count
      // Global helping team = users who have active purchases (not reached 2x) and are in the global helping pool
      // Check each user if they have at least one active purchase (not reached 2x)
      let globalHelpingTeamCurrent = 0;
      let activeMembers = 0;
      if (downlineIdsBigInt.length > 0) {
        // Get all completed purchases for downline users
        const allDownlinePurchases = await prisma.purchases.findMany({
            where: {
              user_id: { in: downlineIdsBigInt },
              status: 'completed',
            },
          select: { id: true, user_id: true },
        });
        
        // Check each purchase if it hasn't reached 2x
        const activeUserIds = new Set<string>();
        for (const purchase of allDownlinePurchases) {
          const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
          if (!isDoubleReached) {
            activeUserIds.add(purchase.user_id.toString());
          }
        }
        globalHelpingTeamCurrent = activeUserIds.size;
        // Active members = unique users who still have at least one purchase that has NOT reached 2x
        activeMembers = activeUserIds.size;
      }

      const teamBusinessVolume = downlineIdsBigInt.length > 0
        ? await prisma.purchases.aggregate({
            where: {
              user_id: { in: downlineIdsBigInt },
              status: 'completed',
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: null } };

      // Get purchase statistics
      const [totalPurchases, totalSpent, allUserPurchases] = await Promise.all([
        prisma.purchases.count({
          where: { user_id: userId },
        }),
        prisma.purchases.aggregate({
          where: { user_id: userId, status: 'completed' },
          _sum: { amount: true },
        }),
        prisma.purchases.findMany({
          where: {
            user_id: userId,
            status: 'completed',
          },
          select: { id: true },
        }),
      ]);
      
      // Count active packages (not reached 2x)
      let activePackages = 0;
      for (const purchase of allUserPurchases) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
        if (!isDoubleReached) {
          activePackages++;
        }
      }

      // Get recent activity (last 10 transactions and purchases)
      const [recentCommissions, recentPurchases] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId },
          orderBy: { credited_at: 'desc' },
          take: 5,
          select: { amount: true, commission_type: true, credited_at: true },
        }),
        prisma.purchases.findMany({
          where: { user_id: userId },
          orderBy: { purchased_at: 'desc' },
          take: 5,
          select: { amount: true, purchased_at: true },
        }),
      ]);

      const recentActivity = [
        ...recentCommissions.map((c: { commission_type: string; amount: any; credited_at: Date }) => ({
          type: 'commission',
          description: `${c.commission_type} commission`,
          amount: Number(c.amount),
          date: c.credited_at,
        })),
        ...recentPurchases.map((p: { amount: any; purchased_at: Date }) => ({
          type: 'purchase',
          description: 'Package purchase',
          amount: Number(p.amount),
          date: p.purchased_at,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      return reply.send({
        user_id: userId.toString(),
        wallet_balance: Number(balance?.balance || 0),
        total_earnings: Number(totalCommissions._sum.amount || 0),
        pending_commissions: Number(pendingCommissions._sum.amount || 0),
        total_commissions: totalCommissions._count.id,
        commission_by_type: commissionByTypeMap,
        main_wallet_withdrawals: Number(mainWalletWithdrawalsResult._sum.amount || 0),
        direct_referral_commission: Number(directReferralCommission._sum.amount || 0),
        global_helping_team: {
          current: globalHelpingTeamCurrent,
          total: totalTeamSize,
        },
        team_balance: Number(pendingCommissions._sum.amount || 0), // Using pending commissions as team balance
        team_stats: {
          direct_referrals: directReferrals,
          total_team_size: totalTeamSize,
          active_members: activeMembers,
          total_business_volume: Number(teamBusinessVolume._sum.amount || 0),
        },
        purchase_stats: {
          total_purchases: totalPurchases,
          total_spent: Number(totalSpent._sum.amount || 0),
          active_packages: activePackages,
        },
        recent_activity: recentActivity,
      });
    } catch (error) {
      console.error('Error getting user dashboard:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/commissions-summary:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get commission summary by type
   *     description: |
   *       Retrieve a summary of all commissions grouped by type with total earnings.
   *       Includes totals for SELF, GLOBAL_HELPING, SPOT, and MONTHLY commissions.
   *       Also returns pending commission amount from pending_commissions table.
   *     operationId: getDashboardCommissionSummary
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Commission summary retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_earned:
   *                   type: number
   *                   example: 50000.00
   *                 by_type:
   *                   type: object
   *                   properties:
   *                     SELF:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 10000.00
   *                         count:
   *                           type: number
   *                           example: 50
   *                     GLOBAL_HELPING:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 15000.00
   *                         count:
   *                           type: number
   *                           example: 75
   *                     SPOT:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 20000.00
   *                         count:
   *                           type: number
   *                           example: 100
   *                     MONTHLY:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 5000.00
   *                         count:
   *                           type: number
   *                           example: 25
   *                 pending_amount:
   *                   type: number
   *                   example: 2500.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/commissions-summary', {
    preHandler: requireUser,
    schema: {
      description: 'Get commission summary by type',
      tags: ['Dashboard'],
      summary: 'Get Commission Summary',
      response: {
        200: {
          type: 'object',
          properties: {
            total_earned: { type: 'number' },
            by_type: {
              type: 'object',
              properties: {
                SELF: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                GLOBAL_HELPING: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                SPOT: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                MONTHLY: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
              },
            },
            pending_amount: { type: 'number' },
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

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get totals by commission type
      const [selfCommissions, globalCommissions, spotCommissions, monthlyCommissions, pendingCommissions] = await Promise.all([
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'SELF' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'SPOT' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'MONTHLY' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.pending_commissions.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
      ]);

      const totalEarned = 
        Number(selfCommissions._sum.amount || 0) +
        Number(globalCommissions._sum.amount || 0) +
        Number(spotCommissions._sum.amount || 0) +
        Number(monthlyCommissions._sum.amount || 0);

      return reply.send({
        total_earned: totalEarned,
        by_type: {
          SELF: {
            total: Number(selfCommissions._sum.amount || 0),
            count: selfCommissions._count.id,
          },
          GLOBAL_HELPING: {
            total: Number(globalCommissions._sum.amount || 0),
            count: globalCommissions._count.id,
          },
          SPOT: {
            total: Number(spotCommissions._sum.amount || 0),
            count: spotCommissions._count.id,
          },
          MONTHLY: {
            total: Number(monthlyCommissions._sum.amount || 0),
            count: monthlyCommissions._count.id,
          },
        },
        pending_amount: Number(pendingCommissions._sum.amount || 0),
      });
    } catch (error) {
      console.error('Error getting commission summary:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/wallet:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get wallet balance
   *     description: |
   *       Retrieve the current wallet balance for the authenticated user.
   *     operationId: getDashboardWallet
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Wallet balance retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 balance:
   *                   type: number
   *                   example: 5000.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/wallet', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet balance',
      tags: ['Dashboard'],
      summary: 'Get Wallet Balance',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            balance: { type: 'number' },
            spot_balance: { type: 'number' },
            other_balance: { type: 'number' },
            team_royalty_balance: { type: 'number' },
            main_locked_hold: { type: 'number' },
            available_main_balance: { type: 'number' },
            spot_team_withdraw_limit: { type: 'number' },
            spot_team_withdraw_used: { type: 'number' },
            spot_team_withdraw_remaining: { type: 'number' },
            spot_team_withdraw_multiplier: { type: 'number' },
            spot_team_limit_reached_at: { type: ['string', 'null'] },
            spot_team_flush_active: { type: 'boolean' },
            spot_locked_hold: { type: 'number' },
            available_spot_balance: { type: 'number' },
            spot_hold_details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ledger_id: { type: 'string' },
                  amount: { type: 'number' },
                  source_user_id: { type: 'string' },
                  source_display_id: { type: 'string' },
                  source_name: { type: ['string', 'null'] },
                  credited_at: { type: 'string' },
                  hold_until: { type: 'string' },
                  level: { type: ['number', 'null'] },
                  depth: { type: ['number', 'null'] },
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
      let balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
        select: {
          balance: true,
          spot_balance: true,
          other_balance: true,
          team_royalty_balance: true,
          spot_team_limit_reached_at: true,
          spot_team_flush_active: true,
        },
      });
      let limitResult: { spot_team_withdraw_limit: number; spot_team_withdraw_used: number; spot_team_withdraw_remaining: number; spot_team_withdraw_multiplier: number };
      try {
        limitResult = await getSpotTeamWithdrawLimit(userId);
      } catch (limitErr: any) {
        console.error('Error getting spot/team limit (using defaults):', limitErr?.message || limitErr);
        limitResult = { spot_team_withdraw_limit: 0, spot_team_withdraw_used: 0, spot_team_withdraw_remaining: 0, spot_team_withdraw_multiplier: 10 };
      }

      // Backfill spot_team_limit_reached_at for exhausted users where it's null (e.g. old data).
      // Require used >= limit explicitly so we never set when limit was 0 or due to rounding/race.
      if (
        limitResult.spot_team_withdraw_limit > 0 &&
        limitResult.spot_team_withdraw_remaining === 0 &&
        limitResult.spot_team_withdraw_used >= limitResult.spot_team_withdraw_limit &&
        balance &&
        !balance.spot_team_limit_reached_at
      ) {
        const now = new Date();
        await prisma.user_balances.update({
          where: { user_id: userId },
          data: { spot_team_limit_reached_at: now, updated_at: now },
        });
        balance = {
          ...balance,
          spot_team_limit_reached_at: now,
        };
      }
      const spotBalance = balance?.spot_balance != null ? Number(balance.spot_balance) : 0;
      const otherBalance = balance?.other_balance != null ? Number(balance.other_balance) : 0;
      const [spotLockedHold, spotHoldDetails, mainLockedHold] = await Promise.all([
        getLockedSpotBalance(userId),
        getSpotHoldDetails(userId),
        getLockedMainBalance(userId),
      ]);
      const availableSpotBalance = Math.max(0, spotBalance - spotLockedHold);
      const availableMainBalance = Math.max(0, otherBalance - mainLockedHold);

      return reply.send({
        user_id: userId.toString(),
        balance: balance?.balance != null ? Number(balance.balance) : 0,
        spot_balance: spotBalance,
        other_balance: otherBalance,
        team_royalty_balance: balance?.team_royalty_balance != null ? Number(balance.team_royalty_balance) : 0,
        main_locked_hold: mainLockedHold,
        available_main_balance: availableMainBalance,
        spot_team_withdraw_limit: limitResult.spot_team_withdraw_limit,
        spot_team_withdraw_used: limitResult.spot_team_withdraw_used,
        spot_team_withdraw_remaining: limitResult.spot_team_withdraw_remaining,
        spot_team_withdraw_multiplier: limitResult.spot_team_withdraw_multiplier,
        spot_team_limit_reached_at: balance?.spot_team_limit_reached_at
          ? (balance.spot_team_limit_reached_at as Date).toISOString()
          : null,
        spot_team_flush_active: balance?.spot_team_flush_active ?? false,
        spot_locked_hold: spotLockedHold,
        available_spot_balance: availableSpotBalance,
        spot_hold_details: spotHoldDetails,
      });
    } catch (error: any) {
      console.error('Error getting wallet balance:', error?.message || error);
      if (error?.stack) console.error(error.stack);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/business-volume:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get business volume
   *     description: |
   *       Retrieve business volume breakdown including direct business, team business,
   *       and per-leg business volume for the authenticated user.
   *     operationId: getDashboardBusinessVolume
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
      tags: ['Dashboard'],
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
      const userPayload = (req as any).user;
      if (!userPayload || !userPayload.user_id) {
        return reply.code(401).send({ error: 'Unauthorized - invalid token' });
      }
      const userId = BigInt(userPayload.user_id);

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
        directLegs.map(async (leg: { descendant_id: bigint }) => {
          const legId = leg.descendant_id as unknown as bigint;

          // Get leg's team (all descendants of this leg)
          const legTeam = await prisma.user_tree_paths.findMany({
            where: { ancestor_id: legId },
          });
          const legTeamIds = [
            legId.toString(),
            ...legTeam.map((t: { descendant_id: bigint }) => t.descendant_id.toString()),
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
      const legUserIds = legVolumes.map((l: { leg_user_id: string }) => BigInt(l.leg_user_id));
      const legUsers = await prisma.users.findMany({
        where: { id: { in: legUserIds } },
        select: { id: true, name: true },
      });
      const legUserMap = new Map(legUsers.map((u: { id: bigint; name: string | null }) => [u.id.toString(), u.name]));

      const legs = legVolumes.map((leg: { leg_user_id: string; leg_business_volume: number; direct_business: number; team_business: number }) => ({
        ...leg,
        leg_user_name: legUserMap.get(leg.leg_user_id) ?? null,
      }));

      // Calculate total team business (sum of all leg volumes)
      const teamBusiness = legs.reduce((sum: number, leg: { leg_business_volume: number }) => sum + leg.leg_business_volume, 0);
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
   * /api/v1/dashboard/team-business:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get team business income summary
   *     description: |
   *       Get total team business income from direct and level commissions
   *       (excluding SELF and GLOBAL_HELPING income).
   *     operationId: getTeamBusiness
   *     security:
   *       - bearerAuth: []
   */
  app.get('/team-business', {
    preHandler: requireUser,
    schema: {
      description: 'Get team business income summary',
      tags: ['Dashboard'],
      summary: 'Get Team Business',
      response: {
        200: {
          type: 'object',
          properties: {
            total_team_business: { type: 'number' },
            breakdown: {
              type: 'object',
              properties: {
                spot_income: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                monthly_income: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
              },
            },
            last_30_days: {
              type: 'object',
              properties: {
                spot: { type: 'number' },
                monthly: { type: 'number' },
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

      // Get total SPOT income
      const spotIncome = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          commission_type: 'SPOT',
        },
        _sum: { amount: true },
        _count: true,
      });

      // Get total MONTHLY income
      const monthlyIncome = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          commission_type: 'MONTHLY',
        },
        _sum: { amount: true },
        _count: true,
      });

      // Get last 30 days SPOT income
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const spotLast30 = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          commission_type: 'SPOT',
          credited_at: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      });

      // Get last 30 days MONTHLY income
      const monthlyLast30 = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          commission_type: 'MONTHLY',
          credited_at: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      });

      const spotTotal = Number(spotIncome._sum.amount || 0);
      const monthlyTotal = Number(monthlyIncome._sum.amount || 0);
      const totalTeamBusiness = spotTotal + monthlyTotal;

      return reply.send({
        total_team_business: totalTeamBusiness,
        breakdown: {
          spot_income: {
            total: spotTotal,
            count: spotIncome._count || 0,
          },
          monthly_income: {
            total: monthlyTotal,
            count: monthlyIncome._count || 0,
          },
        },
        last_30_days: {
          spot: Number(spotLast30._sum.amount || 0),
          monthly: Number(monthlyLast30._sum.amount || 0),
        },
      });
    } catch (error) {
      console.error('Team business error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/team-business-breakdown:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get team business breakdown by level and month
   *     description: |
   *       Retrieve team business breakdown for charts showing monthly spot income and monthly royalty
   *       by level (1, 2, 3) for the last N months.
   *     operationId: getTeamBusinessBreakdown
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: months
   *         schema:
   *           type: integer
   *           default: 4
   *           minimum: 1
   *           maximum: 12
   *         description: Number of months to retrieve (default: 4)
   *     responses:
   *       '200':
   *         description: Team business breakdown retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 levels:
   *                   type: object
   *                   additionalProperties:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         category:
   *                           type: string
   *                           example: "Jan"
   *                         spot_income:
   *                           type: number
   *                           example: 1200.00
   *                         monthly_royalty:
   *                           type: number
   *                           example: 800.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/team-business-breakdown', {
    preHandler: requireUser,
    schema: {
      description: 'Get team business breakdown by level and month',
      tags: ['Dashboard'],
      summary: 'Get Team Business Breakdown',
      querystring: {
        type: 'object',
        properties: {
          months: { type: 'number', default: 4, minimum: 1, maximum: 12 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            levels: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    spot_income: { type: 'number' },
                    monthly_royalty: { type: 'number' },
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
      const months = Math.min(12, Math.max(1, parseInt((req.query as any).months || '4', 10)));

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Generate month labels (last N months)
      const monthLabels: string[] = [];
      const monthDates: Date[] = [];
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthLabels.push(date.toLocaleDateString('en-IN', { month: 'short' }));
        monthDates.push(date);
      }

      // Get direct referrals (legs)
      const directLegs = await prisma.user_tree_paths.findMany({
        where: { ancestor_id: userId, depth: 1 },
      });

      const levels: Record<string, any[]> = {};

      // Process Direct (depth 1), Level-1 (depth 2), Level-2 (depth 3), Level-3 (depth 4)
      const levelMapping = [
        { depth: 1, label: 'Direct' },
        { depth: 2, label: 'Level-1' },
        { depth: 3, label: 'Level-2' },
        { depth: 4, label: 'Level-3' },
      ];

      for (const { depth, label } of levelMapping) {
        const levelData: any[] = [];

        // Get team members at this depth
        const levelPaths = await prisma.user_tree_paths.findMany({
          where: { ancestor_id: userId, depth: depth },
        });
        const levelMemberIds = Array.from(new Set(levelPaths.map((p: { descendant_id: bigint }) => p.descendant_id as unknown as bigint)));

        if (levelMemberIds.length === 0) {
          // No members at this level, return zeros
          levels[label] = monthLabels.map(category => ({
            category,
            spot_income: 0,
            monthly_royalty: 0,
          }));
          continue;
        }

        // For each month, calculate spot income and monthly royalty
        for (let i = 0; i < monthDates.length; i++) {
          const monthStart = new Date(monthDates[i].getFullYear(), monthDates[i].getMonth(), 1);
          const monthEnd = new Date(monthDates[i].getFullYear(), monthDates[i].getMonth() + 1, 0, 23, 59, 59);

          // Spot Income: SPOT commissions received from team members at this level
          const spotIncome = await prisma.ledger_entries.aggregate({
            where: {
              receiver_user_id: userId,
              source_user_id: { in: levelMemberIds },
              commission_type: 'SPOT',
              credited_at: { gte: monthStart, lte: monthEnd },
            },
            _sum: { amount: true },
          });

          // Monthly Royalty: MONTHLY commissions received from team members at this level
          const monthlyRoyalty = await prisma.ledger_entries.aggregate({
            where: {
              receiver_user_id: userId,
              source_user_id: { in: levelMemberIds },
              commission_type: 'MONTHLY',
              credited_at: { gte: monthStart, lte: monthEnd },
            },
            _sum: { amount: true },
          });

          levelData.push({
            category: monthLabels[i],
            spot_income: Number(spotIncome._sum.amount || 0),
            monthly_royalty: Number(monthlyRoyalty._sum.amount || 0),
          });
        }

        levels[label] = levelData;
      }

      return reply.send({ levels });
    } catch (error) {
      console.error('Error getting team business breakdown:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/commission-trend:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get self commission trend for last N days
   *     description: |
   *       Retrieve self commission trend data grouped by day for the last N days.
   *       Returns daily commission amounts for chart visualization.
   *     operationId: getCommissionTrend
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *           minimum: 1
   *           maximum: 90
   *         description: Number of days to retrieve (default: 30, max: 90)
   *     responses:
   *       '200':
   *         description: Commission trend retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 days:
   *                   type: number
   *                   example: 30
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       date:
   *                         type: string
   *                         example: "25 Oct"
   *                       commission:
   *                         type: number
   *                         example: 500.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/commission-trend', {
    preHandler: requireUser,
    schema: {
      description: 'Get self commission trend for last N days',
      tags: ['Dashboard'],
      summary: 'Get Commission Trend',
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', default: 30, minimum: 1, maximum: 90 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            days: { type: 'number' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  commission: { type: 'number' },
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
      const days = Math.min(90, Math.max(1, parseInt((req.query as any).days || '30', 10)));

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Calculate date range
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get all SELF commissions in date range
      const commissions = await prisma.ledger_entries.findMany({
        where: {
          receiver_user_id: userId,
          commission_type: 'SELF',
          credited_at: { gte: startDate, lte: endDate },
        },
        select: {
          amount: true,
          credited_at: true,
        },
        orderBy: { credited_at: 'asc' },
      });

      // Group by date (day)
      const dailyMap = new Map<string, number>();
      for (const commission of commissions) {
        const dateKey = commission.credited_at.toISOString().split('T')[0]; // YYYY-MM-DD
        const current = dailyMap.get(dateKey) || 0;
        dailyMap.set(dateKey, current + Number(commission.amount));
      }

      // Generate all days in range (fill missing days with 0)
      const data: Array<{ date: string; commission: number }> = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dateLabel = currentDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        data.push({
          date: dateLabel,
          commission: dailyMap.get(dateKey) || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return reply.send({
        days,
        data,
      });
    } catch (error) {
      console.error('Error getting commission trend:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/royalty-trend:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get royalty trend for last 6 months
   *     description: |
   *       Retrieve MONTHLY commission totals grouped by month for the last 6 months.
   *       Used for displaying royalty trend chart.
   *     operationId: getRoyaltyTrend
   *     security:
   *       - bearerAuth: []
   */
  app.get('/royalty-trend', {
    preHandler: requireUser,
    schema: {
      description: 'Get royalty trend for last 6 months',
      tags: ['Dashboard'],
      summary: 'Get Royalty Trend',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string' },
                  royalty: { type: 'number' },
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

      // Get last 6 months of MONTHLY commissions
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      // Get all MONTHLY commissions in the last 6 months
      const monthlyCommissions = await prisma.ledger_entries.findMany({
        where: {
          receiver_user_id: userId,
          commission_type: 'MONTHLY',
          credited_at: { gte: sixMonthsAgo },
        },
        select: {
          amount: true,
          credited_at: true,
        },
      });

      // Group by month
      const monthlyTotals = new Map<string, number>();
      
      // Initialize all 6 months with 0
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-IN', { month: 'short' });
        monthlyTotals.set(monthName, 0);
      }

      // Sum up commissions by month
      for (const commission of monthlyCommissions) {
        const date = new Date(commission.credited_at);
        const monthName = date.toLocaleDateString('en-IN', { month: 'short' });
        const current = monthlyTotals.get(monthName) || 0;
        monthlyTotals.set(monthName, current + Number(commission.amount));
      }

      // Convert to array format expected by frontend
      const data = Array.from(monthlyTotals.entries()).map(([month, royalty]) => ({
        month,
        royalty: Math.round(royalty * 100) / 100, // Round to 2 decimal places
      }));

      return reply.send({ data });
    } catch (error) {
      console.error('Royalty trend error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/notices:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get active notices for user dashboard
   *     description: Retrieve all active notices to display on user dashboard
   *     operationId: getDashboardNotices
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Notices retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: number
   *                       title:
   *                         type: string
   *                       content:
   *                         type: string
   *                       link:
   *                         type: string
   *                         nullable: true
   *                       created_at:
   *                         type: string
   *                         format: date-time
   */
  app.get('/notices', {
    preHandler: requireUser,
    schema: {
      description: 'Get active notices for dashboard',
      tags: ['Dashboard'],
      summary: 'Get Dashboard Notices',
      response: {
        200: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  link: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
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
      // Get only active notices, ordered by creation date (newest first)
      const notices = await prisma.notices.findMany({
        where: {
          is_active: true,
        },
        orderBy: { created_at: 'desc' },
        take: 10, // Limit to 10 most recent notices
      });

      return reply.send({
        items: notices.map(notice => ({
          id: notice.id,
          title: notice.title,
          content: notice.content,
          link: notice.link,
          created_at: notice.created_at.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Error getting dashboard notices:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/dashboard/banners:
   *   get:
   *     tags:
   *       - Dashboard
   *     summary: Get active banners for dashboard
   *     description: |
   *       Retrieve all active banner images (sliders) for display on the user dashboard.
   *       Returns banners ordered by display_order.
   *     operationId: getDashboardBanners
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Banners retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: number
   *                       title:
   *                         type: string
   *                       image_url:
   *                         type: string
   *                       link:
   *                         type: string
   *                         nullable: true
   *                       display_order:
   *                         type: number
   */
  app.get('/banners', {
    preHandler: requireUser,
    schema: {
      description: 'Get active banners for dashboard',
      tags: ['Dashboard'],
      summary: 'Get Dashboard Banners',
      response: {
        200: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  title: { type: 'string' },
                  image_url: { type: 'string' },
                  link: { type: ['string', 'null'] },
                  display_order: { type: 'number' },
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
      // Get only active banners, ordered by display_order
      const banners = await prisma.website_sliders.findMany({
        where: {
          is_active: true,
        },
        orderBy: [
          { display_order: 'asc' },
          { created_at: 'desc' },
        ],
      });

      return reply.send({
        items: banners.map(banner => ({
          id: banner.id,
          title: banner.title,
          image_url: banner.image_url,
          link: banner.link || null,
          display_order: banner.display_order,
        })),
      });
    } catch (error) {
      console.error('Error getting dashboard banners:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

