import { prisma } from '../../config/prisma.js';
import { CommissionService } from '../commissions/commission.service.js';

export class LeaderboardService {
  /**
   * Get top earners by wallet balance
   * @param limit - Number of results to return
   * @param offset - Number of results to skip
   * @param period - Time period filter: 'today' | 'week' | 'month' | 'all'
   * @param category - Commission category filter: 'spot' | 'monthly_royalty' | 'all_income'
   */
  static async getTopEarners(limit: number = 10, offset: number = 0, period: 'today' | 'week' | 'month' | 'all' = 'all', category: 'spot' | 'monthly_royalty' | 'all_income' = 'all_income') {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    // Calculate date range based on period
    let dateFilter: { gte?: Date } | undefined = undefined;
    if (period === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: todayStart };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      dateFilter = { gte: weekAgo };
    } else if (period === 'month') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: monthStart };
    }

    // Determine commission_type filter based on category
    let commissionTypeFilter: { in?: string[] } | { equals?: string } | undefined = undefined;
    if (category === 'spot') {
      commissionTypeFilter = { equals: 'SPOT' };
    } else if (category === 'monthly_royalty') {
      commissionTypeFilter = { equals: 'MONTHLY' };
    } else if (category === 'all_income') {
      commissionTypeFilter = { in: ['SPOT', 'MONTHLY', 'GLOBAL_HELPING', 'SELF'] };
    }

    // If period filter is applied, calculate balances based on commissions in that period
    // Otherwise, use current wallet balance
    let balances;
    if (period === 'all') {
      // For 'all' period with category filter, we need to calculate from ledger_entries
      // because user_balances doesn't have commission_type breakdown
      if (category !== 'all_income') {
        // Calculate balance from ledger_entries filtered by commission_type
        const commissionTotals = await prisma.ledger_entries.groupBy({
          by: ['receiver_user_id'],
          where: {
            amount: { gt: 0 }, // Only credits
            commission_type: commissionTypeFilter,
            receiver_user_id: { in: studentUserIds }, // Filter by STUDENT users only
          },
          _sum: {
            amount: true,
          },
          orderBy: {
            _sum: {
              amount: 'desc',
            },
          },
          take: limit,
          skip: offset,
        });

        balances = commissionTotals.map(c => ({
          user_id: c.receiver_user_id,
          balance: c._sum.amount || 0,
        }));
      } else {
        // For 'all_income', use current wallet balance (sum of all commission types)
        balances = await prisma.user_balances.findMany({
          where: { user_id: { in: studentUserIds } },
          orderBy: { balance: 'desc' },
          take: limit,
          skip: offset,
          select: {
            user_id: true,
            balance: true,
          },
        });
      }
    } else {
      // For week/month, calculate balance from commissions in that period (only for STUDENT users)
      const whereClause: any = {
        amount: { gt: 0 }, // Only credits
        credited_at: dateFilter,
        receiver_user_id: { in: studentUserIds }, // Filter by STUDENT users only
      };
      
      // Add commission_type filter if category is specified
      if (commissionTypeFilter) {
        whereClause.commission_type = commissionTypeFilter;
      }

      const commissionTotals = await prisma.ledger_entries.groupBy({
        by: ['receiver_user_id'],
        where: whereClause,
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
        take: limit,
        skip: offset,
      });

      balances = commissionTotals.map(c => ({
        user_id: c.receiver_user_id,
        balance: c._sum.amount || 0,
      }));
    }

    const userIds = balances.map(b => b.user_id);
    const [users, userProfiles] = await Promise.all([
      prisma.users.findMany({
        where: { 
          id: { in: userIds },
          role: 'STUDENT', // Additional filter to ensure only STUDENT users
        },
        select: {
          id: true,
          name: true,
          email: true,
          kyc_status: true,
          display_id: true,
          display_title: true,
          display_title_icon_url: true,
        },
      }),
      prisma.user_profiles.findMany({
        where: { user_id: { in: userIds } },
        select: {
          user_id: true,
          profile_photo_url: true,
        },
      }),
    ]);

    const userMap = new Map(users.map(u => [u.id.toString(), u]));
    // Convert BigInt user_id to string for map key
    const profileMap = new Map(
      userProfiles.map(p => [p.user_id.toString(), p.profile_photo_url])
    );

    // Get total commissions for each user (filtered by period and category if specified)
    const commissionTotals = await Promise.all(
      userIds.map(async (userId) => {
        const whereClause: any = { receiver_user_id: userId };
        if (dateFilter) {
          whereClause.credited_at = dateFilter;
        }
        // Add commission_type filter if category is specified
        if (commissionTypeFilter) {
          whereClause.commission_type = commissionTypeFilter;
        }
        const total = await prisma.ledger_entries.aggregate({
          where: whereClause,
          _sum: { amount: true },
        });
        return {
          user_id: userId,
          total_commissions: total._sum.amount || 0,
        };
      })
    );

    const commissionMap = new Map(
      commissionTotals.map(c => [c.user_id.toString(), Number(c.total_commissions)])
    );

    // Get level eligibility and global IDs for each user
    let levelEligibilities: any[] = [];
    let globalIdsData: any[] = [];
    
    try {
      [levelEligibilities, globalIdsData] = await Promise.all([
        prisma.level_eligibility.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, eligibility: true },
        }).catch(() => []),
        Promise.all(
          userIds.map(async (userId) => {
            try {
              // Get all completed purchases
              const purchases = await prisma.purchases.findMany({
                where: {
                  user_id: userId,
                  status: 'completed',
                },
                select: {
                  id: true,
                  package_id: true,
                },
              });

              // number_of_ids column removed - return 0 for all users
              // This field is no longer displayed in UI, so returning 0
              return {
                user_id: userId,
                global_ids: 0, // Keep field name as global_ids for backward compatibility
              };
            } catch (err) {
              console.error(`Error getting total IDs for user ${userId}:`, err);
              return {
                user_id: userId,
                global_ids: 0,
              };
            }
          })
        ).catch(() => userIds.map(uid => ({ user_id: uid, global_ids: 0 }))),
      ]);
    } catch (err) {
      console.error('Error getting level eligibility and global IDs:', err);
      levelEligibilities = [];
      globalIdsData = userIds.map(uid => ({ user_id: uid, global_ids: 0 }));
    }

    const levelMap = new Map(
      levelEligibilities.map(elig => {
        const eligibility = (elig.eligibility as Record<string, boolean>) || {};
        // Find highest eligible level (1-8 first, then 9 only if they've achieved at least level 1)
        // Level 9 has no requirements (0 legs, 0 amount), so we only show it if user has real achievements
        let highestLevel = 0;
        
        // First, check levels 1-8 (real levels with actual requirements)
        for (let level = 8; level >= 1; level--) {
          if (eligibility[String(level)] === true) {
            highestLevel = level;
            break;
          }
        }
        
        // Only show level 9 if user has qualified for at least level 1
        // This prevents showing level 9 for users who haven't achieved any real level
        if (highestLevel > 0 && eligibility['9'] === true) {
          highestLevel = 9;
        }
        // If highestLevel is still 0, they haven't qualified for any level (1-8), so show LEVEL 0
        
        return [elig.user_id.toString(), highestLevel];
      })
    );

    const globalIdsMap = new Map(
      globalIdsData.map(g => [g.user_id.toString(), g.global_ids])
    );

    const result = balances.map((balance, index) => {
      const userIdStr = balance.user_id.toString();
      const user = userMap.get(userIdStr);
      const profilePhoto = profileMap.get(userIdStr);
      const highestLevel = levelMap.get(userIdStr) ?? 0;
      const globalIds = globalIdsMap.get(userIdStr) ?? 0;
      
      // Get level name - always return a string, never null
      // Use "LEVEL 0" instead of "DIRECT" for better clarity
      let levelName = "LEVEL 0";
      if (highestLevel > 0) {
        levelName = `LEVEL ${highestLevel}`;
      }

      const item = {
        rank: offset + index + 1,
        user_id: userIdStr,
        display_id: user?.display_id ?? null,
        name: user?.name ?? null,
        email: user?.email ?? null,
        kyc_status: user?.kyc_status ?? null,
        display_title: user?.display_title ?? null,
        display_title_icon_url: user?.display_title_icon_url ?? null,
        wallet_balance: Number(balance.balance),
        total_commissions: commissionMap.get(userIdStr) || 0,
        profile_photo_url: profilePhoto ?? null,
        level: highestLevel, // This will be 0 if not found, not null
        level_name: levelName, // This will be "LEVEL 0" if not found, not null
        global_ids: globalIds, // This will be 0 if not found, not null
      };
      
      
      return item;
    });
    
    return result;
  }

  /**
   * Get top referrers by number of direct referrals
   */
  static async getTopReferrers(limit: number = 10, offset: number = 0) {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    // Get users with their direct referral counts (only for STUDENT users)
    const referralCounts = await prisma.user_tree_paths.groupBy({
      by: ['ancestor_id'],
      where: { 
        depth: 1,
        ancestor_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
      _count: { descendant_id: true },
      orderBy: { _count: { descendant_id: 'desc' } },
      take: limit,
      skip: offset,
    });

    const userIds = referralCounts.map(r => r.ancestor_id as unknown as bigint);
    const users = await prisma.users.findMany({
      where: { 
        id: { in: userIds },
        role: 'STUDENT', // Additional filter to ensure only STUDENT users
      },
      select: {
        id: true,
        name: true,
        email: true,
        kyc_status: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id.toString(), u]));

    // Get total team size for each user (all levels)
    const teamSizes = await Promise.all(
      userIds.map(async (userId) => {
        const total = await prisma.user_tree_paths.count({
          where: {
            ancestor_id: userId,
            depth: { gt: 0 },
          },
        });
        return {
          user_id: userId,
          total_team_size: total,
        };
      })
    );

    const teamSizeMap = new Map(
      teamSizes.map(t => [t.user_id.toString(), t.total_team_size])
    );

    // Get active referrals count
    const activeReferrals = await Promise.all(
      userIds.map(async (userId) => {
        const directReferrals = await prisma.user_tree_paths.findMany({
          where: { ancestor_id: userId, depth: 1 },
          select: { descendant_id: true },
        });

        const referralIds = directReferrals.map(r => r.descendant_id as unknown as bigint);
        
        if (referralIds.length === 0) return { user_id: userId, active_count: 0 };

        // Count active purchases (not reached 2x income)
        // NOTE: active_until is NOT used - expiry is ONLY based on 2x income, not date
        // Active = income < amount * 2 (income tracks SELF + GLOBAL_HELPING commissions)
        const activeCount = await prisma.purchases.count({
          where: {
            user_id: { in: referralIds },
            status: 'completed',
            // Use raw SQL to check income < amount * 2 (active = not reached 2x)
            // Prisma doesn't support computed fields in where, so we use a workaround
          },
        });
        
        // Filter to only count purchases that haven't reached 2x
        // We need to fetch and filter since Prisma can't do computed comparisons in count
        const allPurchases = await prisma.purchases.findMany({
          where: {
            user_id: { in: referralIds },
            status: 'completed',
          },
          select: { id: true, amount: true, income: true },
        });
        
        const actuallyActiveCount = allPurchases.filter(p => {
          const income = Number(p.income || 0);
          const amount = Number(p.amount);
          return income < amount * 2; // Active = not reached 2x
        }).length;

        return {
          user_id: userId,
          active_count: actuallyActiveCount,
        };
      })
    );

    const activeMap = new Map(
      activeReferrals.map(a => [a.user_id.toString(), a.active_count])
    );

    return referralCounts.map((ref, index) => {
      const user = userMap.get(ref.ancestor_id.toString());
      const directCount = ref._count.descendant_id;
      return {
        rank: offset + index + 1,
        user_id: ref.ancestor_id.toString(),
        name: user?.name ?? null,
        email: user?.email ?? null,
        kyc_status: user?.kyc_status ?? null,
        direct_referrals: directCount,
        total_team_size: teamSizeMap.get(ref.ancestor_id.toString()) || 0,
        active_referrals: activeMap.get(ref.ancestor_id.toString()) || 0,
      };
    });
  }

  /**
   * Get top users by business volume
   * Business volume = user's own purchases + team's purchases
   */
  static async getTopBusinessVolume(limit: number = 10, offset: number = 0) {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    // Get all users who have made purchases or have team members with purchases (only STUDENT users)
    const allUsersWithPurchases = await prisma.purchases.groupBy({
      by: ['user_id'],
      where: { 
        status: 'completed',
        user_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
    });

    const userIds = Array.from(new Set(allUsersWithPurchases.map(p => p.user_id)));

    // Calculate total business volume for each user (own + team)
    const businessVolumes = await Promise.all(
      userIds.map(async (userId) => {
        // Direct business (user's own purchases)
        const directBusiness = await prisma.purchases.aggregate({
          where: {
            user_id: userId,
            status: 'completed',
          },
          _sum: { amount: true },
        });

        // Team business (downline purchases)
        const downlinePaths = await prisma.user_tree_paths.findMany({
          where: {
            ancestor_id: userId,
            depth: { gt: 0 },
          },
          select: { descendant_id: true },
        });

        const downlineIds = Array.from(
          new Set(downlinePaths.map(p => p.descendant_id as unknown as bigint))
        );

        let teamBusiness = 0;
        if (downlineIds.length > 0) {
          const teamTotal = await prisma.purchases.aggregate({
            where: {
              user_id: { in: downlineIds },
              status: 'completed',
            },
            _sum: { amount: true },
          });
          teamBusiness = Number(teamTotal._sum.amount || 0);
        }

        const direct = Number(directBusiness._sum.amount || 0);
        const total = direct + teamBusiness;

        return {
          user_id: userId,
          total_business_volume: total,
          direct_business: direct,
          team_business: teamBusiness,
        };
      })
    );

    // Sort by total business volume and apply pagination
    const sorted = businessVolumes.sort((a, b) => b.total_business_volume - a.total_business_volume);
    const paginated = sorted.slice(offset, offset + limit);

    const paginatedUserIds = paginated.map(p => p.user_id);
    const users = await prisma.users.findMany({
      where: { 
        id: { in: paginatedUserIds },
        role: 'STUDENT', // Additional filter to ensure only STUDENT users
      },
      select: {
        id: true,
        name: true,
        email: true,
        kyc_status: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id.toString(), u]));

    return paginated.map((bv, index) => {
      const user = userMap.get(bv.user_id.toString());
      return {
        rank: offset + index + 1,
        user_id: bv.user_id.toString(),
        name: user?.name ?? null,
        email: user?.email ?? null,
        kyc_status: user?.kyc_status ?? null,
        total_business_volume: bv.total_business_volume,
        direct_business: bv.direct_business,
        team_business: bv.team_business,
      };
    });
  }

  /**
   * Get user's position in various leaderboards
   * @param userId - User ID
   * @param period - Time period filter: 'week' | 'month' | 'all'
   */
  static async getUserPosition(userId: bigint, period: 'week' | 'month' | 'all' = 'all') {
    // Calculate date range based on period
    let dateFilter: { gte?: Date } | undefined = undefined;
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      dateFilter = { gte: weekAgo };
    } else if (period === 'month') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: monthStart };
    }

    // Get user's wallet balance or period-based earnings
    let walletBalance = 0;
    let commissionsTotal = 0;

    if (period === 'all') {
      // Use current wallet balance for 'all' period
      const userBalance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
        select: { balance: true },
      });
      walletBalance = userBalance ? Number(userBalance.balance) : 0;

      // Get user's total commissions (all time)
      const totalCommissions = await prisma.ledger_entries.aggregate({
        where: { receiver_user_id: userId },
        _sum: { amount: true },
      });
      commissionsTotal = Number(totalCommissions._sum.amount || 0);
    } else {
      // For week/month, calculate earnings from commissions in that period
      const periodCommissions = await prisma.ledger_entries.aggregate({
        where: {
          receiver_user_id: userId,
          amount: { gt: 0 }, // Only credits
          credited_at: dateFilter,
        },
        _sum: { amount: true },
      });
      walletBalance = Number(periodCommissions._sum.amount || 0);
      commissionsTotal = walletBalance; // For period-based, they're the same
    }

    // Get user's direct referrals count
    const directReferrals = await prisma.user_tree_paths.count({
      where: { ancestor_id: userId, depth: 1 },
    });

    // Get user's total team size
    const totalTeamSize = await prisma.user_tree_paths.count({
      where: {
        ancestor_id: userId,
        depth: { gt: 0 },
      },
    });

    // Get user's business volume
    const businessVolume = await prisma.purchases.aggregate({
      where: {
        user_id: userId,
        status: 'completed',
      },
      _sum: { amount: true },
    });
    const totalBusiness = Number(businessVolume._sum.amount || 0);

    // Calculate ranks (with period filter for top earners)
    const topEarnersRank = await this.getRankByBalance(userId, walletBalance, period);
    const topReferrersRank = await this.getRankByReferrals(userId, directReferrals);
    const businessVolumeRank = await this.getRankByBusinessVolume(userId, totalBusiness);

    // Get total participants (only STUDENT users)
    // For period-based, count only users with earnings in that period
    let totalUsers = 0;
    if (period === 'all') {
      totalUsers = await prisma.users.count({
        where: { role: 'STUDENT' },
      });
    } else {
      // For week/month, count only users with commissions in that period
      const periodEarners = await prisma.ledger_entries.groupBy({
        by: ['receiver_user_id'],
        where: {
          amount: { gt: 0 }, // Only credits
          credited_at: dateFilter,
          receiver_user_id: {
            in: await prisma.users.findMany({
              where: { role: 'STUDENT' },
              select: { id: true },
            }).then(users => users.map(u => u.id)),
          },
        },
      });
      totalUsers = periodEarners.length;
    }
    
    // Get all STUDENT user IDs for filtering
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);
    
    const totalWithReferrals = await prisma.user_tree_paths.groupBy({
      by: ['ancestor_id'],
      where: { 
        depth: 1,
        ancestor_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
    });
    const totalWithBusiness = await prisma.purchases.groupBy({
      by: ['user_id'],
      where: { 
        status: 'completed',
        user_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
    });

    return {
      user_id: userId.toString(),
      leaderboards: {
        top_earners: {
          rank: topEarnersRank || null,
          total_participants: totalUsers,
          value: walletBalance,
          total_commissions: commissionsTotal,
        },
        top_referrers: {
          rank: topReferrersRank || null,
          total_participants: totalWithReferrals.length,
          value: directReferrals,
          total_team_size: totalTeamSize,
        },
        business_volume: {
          rank: businessVolumeRank || null,
          total_participants: totalWithBusiness.length,
          value: totalBusiness,
        },
      },
    };
  }

  /**
   * Get rank by wallet balance
   * @param period - Time period filter: 'week' | 'month' | 'all'
   */
  private static async getRankByBalance(userId: bigint, balance: number, period: 'week' | 'month' | 'all' = 'all'): Promise<number | null> {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    if (period === 'all') {
      // For 'all' period, use wallet balance
      if (balance === 0) {
        // If user has no balance, count all STUDENT users with balance > 0
        const count = await prisma.user_balances.count({
          where: {
            balance: { gt: 0 },
            user_id: { in: studentUserIds }, // Filter by STUDENT users only
          },
        });
        return count > 0 ? count + 1 : 1;
      }
      
      const count = await prisma.user_balances.count({
        where: {
          balance: { gt: balance },
          user_id: { in: studentUserIds }, // Filter by STUDENT users only
        },
      });
      return count + 1;
    } else {
      // For today/week/month, calculate rank based on period commissions
      const dateFilter: { gte?: Date } = {};
      if (period === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        dateFilter.gte = todayStart;
      } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        dateFilter.gte = weekAgo;
      } else if (period === 'month') {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        dateFilter.gte = monthStart;
      }

      // Get all users' period commissions
      const periodCommissions = await prisma.ledger_entries.groupBy({
        by: ['receiver_user_id'],
        where: {
          amount: { gt: 0 }, // Only credits
          credited_at: dateFilter,
          receiver_user_id: { in: studentUserIds }, // Filter by STUDENT users only
        },
        _sum: {
          amount: true,
        },
      });

      // Count users with higher period earnings
      const usersWithHigherEarnings = periodCommissions.filter(
        c => Number(c._sum.amount || 0) > balance
      ).length;

      return usersWithHigherEarnings + 1;
    }
  }

  /**
   * Get rank by number of referrals
   */
  private static async getRankByReferrals(userId: bigint, referralCount: number): Promise<number | null> {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    const referralCounts = await prisma.user_tree_paths.groupBy({
      by: ['ancestor_id'],
      where: { 
        depth: 1,
        ancestor_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
      _count: { descendant_id: true },
    });

    const sorted = referralCounts
      .map(r => ({ user_id: r.ancestor_id, count: r._count.descendant_id }))
      .sort((a, b) => b.count - a.count);

    const rank = sorted.findIndex(r => r.user_id.toString() === userId.toString());
    return rank >= 0 ? rank + 1 : null;
  }

  /**
   * Get rank by business volume
   */
  private static async getRankByBusinessVolume(userId: bigint, volume: number): Promise<number | null> {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    const volumes = await prisma.purchases.groupBy({
      by: ['user_id'],
      where: { 
        status: 'completed',
        user_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
      _sum: { amount: true },
    });

    const sorted = volumes
      .map(v => ({
        user_id: v.user_id,
        volume: Number(v._sum.amount || 0),
      }))
      .sort((a, b) => b.volume - a.volume);

    const rank = sorted.findIndex(v => v.user_id.toString() === userId.toString());
    return rank >= 0 ? rank + 1 : null;
  }

  /**
   * Get total count for leaderboard (for pagination)
   * @param period - Time period filter: 'week' | 'month' | 'all'
   * @param category - Commission category filter: 'spot' | 'monthly_royalty' | 'all_income'
   */
  static async getTopEarnersCount(period: 'today' | 'week' | 'month' | 'all' = 'all', category: 'spot' | 'monthly_royalty' | 'all_income' = 'all_income'): Promise<number> {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    // Determine commission_type filter based on category
    let commissionTypeFilter: { in?: string[] } | { equals?: string } | undefined = undefined;
    if (category === 'spot') {
      commissionTypeFilter = { equals: 'SPOT' };
    } else if (category === 'monthly_royalty') {
      commissionTypeFilter = { equals: 'MONTHLY' };
    } else if (category === 'all_income') {
      commissionTypeFilter = { in: ['SPOT', 'MONTHLY', 'GLOBAL_HELPING', 'SELF'] };
    }

    if (period === 'all') {
      // For 'all' period with category filter, count from ledger_entries
      if (category !== 'all_income') {
        const uniqueUsers = await prisma.ledger_entries.groupBy({
          by: ['receiver_user_id'],
          where: {
            amount: { gt: 0 },
            commission_type: commissionTypeFilter,
            receiver_user_id: { in: studentUserIds }, // Filter by STUDENT users only
          },
        });
        return uniqueUsers.length;
      } else {
        // For 'all_income', use user_balances count
        return prisma.user_balances.count({
          where: { user_id: { in: studentUserIds } }, // Filter by STUDENT users only
        });
      }
    }
    
    // For today/week/month, count unique STUDENT users with commissions in that period
    const dateFilter: { gte?: Date } = {};
    if (period === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      dateFilter.gte = todayStart;
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      dateFilter.gte = weekAgo;
    } else if (period === 'month') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      dateFilter.gte = monthStart;
    }
    
    const whereClause: any = {
      amount: { gt: 0 },
      credited_at: dateFilter,
      receiver_user_id: { in: studentUserIds }, // Filter by STUDENT users only
    };
    
    // Add commission_type filter if category is specified
    if (commissionTypeFilter) {
      whereClause.commission_type = commissionTypeFilter;
    }
    
    const uniqueUsers = await prisma.ledger_entries.groupBy({
      by: ['receiver_user_id'],
      where: whereClause,
    });
    
    return uniqueUsers.length;
  }

  static async getTopReferrersCount(): Promise<number> {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    const result = await prisma.user_tree_paths.groupBy({
      by: ['ancestor_id'],
      where: { 
        depth: 1,
        ancestor_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
    });
    return result.length;
  }

  static async getBusinessVolumeCount(): Promise<number> {
    // Get all STUDENT user IDs first (exclude ADMIN users)
    const studentUsers = await prisma.users.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    const studentUserIds = studentUsers.map(u => u.id);

    // Count unique STUDENT users who have purchases or have team members with purchases
    const result = await prisma.purchases.groupBy({
      by: ['user_id'],
      where: { 
        status: 'completed',
        user_id: { in: studentUserIds }, // Filter by STUDENT users only
      },
    });
    return result.length;
  }
}


