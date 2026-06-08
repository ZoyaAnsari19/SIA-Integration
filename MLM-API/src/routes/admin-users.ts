import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission, adminHasPermission } from '../middleware/checkPermission.js';
import { isUserActive } from '../utils/business.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';

const updateUserBody = z.object({
  name: z.string().min(1).optional(),
  display_title: z.string().max(100).optional().nullable(),
  display_title_icon_url: z.string().url().optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  referrer_user_id: z.coerce.bigint().optional().nullable(),
  kyc_status: z.enum(['pending', 'submitted', 'approved', 'rejected']).optional(),
  transaction_pin: z.string().regex(/^[0-9]{4,6}$/, 'Transaction PIN must be 4-6 digits').optional(),
  withdrawal_blocked: z.boolean().optional(),
});

export async function adminUsersRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/users:
   *   get:
   *     tags:
   *       - Admin Users
   *     summary: List all users (Admin view)
   *     description: |
   *       Retrieve a paginated list of all users with comprehensive details.
   *       This endpoint provides admin-level information including wallet balance, team stats, and purchase history.
   *       Supports filtering by KYC status, user status, and sorting options.
   *     operationId: listAllUsersAdmin
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
   *         name: kyc_status
   *         schema:
   *           type: string
   *           enum: [pending, submitted, approved, rejected]
   *         description: Filter by KYC status
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, inactive]
   *         description: Filter by user status
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [created_at, name, email, updated_at, direct_referrals, total_business_volume]
   *           default: created_at
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
   *         description: List of users retrieved successfully
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
   *                         example: "7"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Test User"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "test@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "approved"
   *                       status:
   *                         type: string
   *                         example: "active"
   *                       referrer_user_id:
   *                         type: string
   *                         nullable: true
   *                         example: "5"
   *                       wallet_balance:
   *                         type: number
   *                         example: 5000.00
   *                       direct_referrals:
   *                         type: number
   *                         example: 10
   *                       total_team_size:
   *                         type: number
   *                         example: 50
   *                       total_purchases:
   *                         type: number
   *                         example: 3
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T11:43:03.027Z"
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-10T14:04:04.265Z"
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/users', {
    preHandler: [adminAuth, checkPermission('USERS_VIEW')],
    schema: {
      description: 'List all users with comprehensive admin details',
      tags: ['Admin Users'],
      summary: 'List All Users (Admin)',
      querystring: {
      type: 'object',
      properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 1000 },
          id: { type: 'string' },
          user_id: { type: 'string' },
          name: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          display_id: { type: 'string' },
          package_id: { type: 'integer', description: 'Filter users who have at least one purchase with this package ID' },
          has_active_package: { type: 'string', enum: ['true', 'false'], description: 'true = users with at least one active package (not 2x); false = users with no active package' },
          kyc_status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'rejected'] },
          status: { type: 'string', enum: ['active', 'inactive'] },
          sort: { type: 'string', enum: ['created_at', 'name', 'email', 'updated_at', 'direct_referrals', 'total_business_volume'], default: 'created_at' },
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
                  display_id: { type: 'string', nullable: true },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  password: { type: 'string', nullable: true },
                  phone: { type: 'string', nullable: true },
                  total_investment: { type: 'number' },
                  active_investment: { type: 'number' },
                  total_active_packages: { type: 'number' },
                  kyc_status: { type: 'string' },
                  status: { type: 'string' },
                  referrer_user_id: { type: 'string', nullable: true },
                  referrer_display_id: { type: 'string', nullable: true },
                  wallet_balance: { type: 'number' },
                  other_balance: { type: 'number' },
                  spot_balance: { type: 'number' },
                  team_royalty_balance: { type: 'number' },
                  direct_referrals: { type: 'number' },
                  total_team_size: { type: 'number' },
                  total_purchases: { type: 'number' },
                  total_business_volume: { type: 'number' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
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
      const limit = Math.min(1000, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const query = req.query as any;
      const sort = query.sort || 'created_at';
      const order = query.order || 'desc';

      // Build where clause with all filters
      const where: any = {};
      if (query.kyc_status) {
        where.kyc_status = query.kyc_status;
      }
      if (query.status) {
        where.status = query.status;
      }
      // Filter by ID (exact match)
      if (query.id || query.user_id) {
        where.id = BigInt(query.id || query.user_id);
      }
      // Filter by name (partial search, case-insensitive)
      if (query.name) {
        where.name = { contains: query.name, mode: 'insensitive' };
      }
      // Filter by display_id (search by user's own display_id)
      if (query.display_id) {
        const displayIdStr = query.display_id.trim();
        // Search by user's own display_id (partial match, case-insensitive)
        // Handle nullable field properly - use AND condition to combine not null and contains
        const andConditions: any[] = [];
        if (where.AND) {
          andConditions.push(...where.AND);
        }
        // Add condition: display_id is not null AND contains the search string
        andConditions.push({
          AND: [
            { display_id: { not: null } },
            { display_id: { contains: displayIdStr, mode: 'insensitive' } }
          ]
        });
        where.AND = andConditions;
      }
      // Filter by referrer_user_id (sponsor ID) - supports both numeric ID and display_id
      if (query.referrer_user_id) {
        const referrerIdStr = query.referrer_user_id.trim();
        // Check if it's a display_id (starts with letters) or numeric ID
        if (isNaN(Number(referrerIdStr))) {
          // It's a display_id, find the user first
          const referrerUser = await prisma.users.findFirst({
            where: { display_id: referrerIdStr },
            select: { id: true },
          });
          if (referrerUser) {
            where.referrer_user_id = referrerUser.id;
          } else {
            // No user found with this display_id, return empty result
            where.referrer_user_id = BigInt(-1); // This will match nothing
          }
        } else {
          // It's a numeric ID
          where.referrer_user_id = BigInt(referrerIdStr);
        }
      }
      // Filter by date range
      if (query.start_date || query.end_date) {
        where.created_at = {};
        if (query.start_date) {
          // Create date at start of day in UTC (00:00:00.000 UTC)
          const startDateStr = query.start_date.toString();
          const [year, month, day] = startDateStr.split('-').map(Number);
          const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
          where.created_at.gte = startDate;
          console.log(`[Admin Users] Date filter - start_date: ${startDateStr} -> ${startDate.toISOString()} (UTC)`);
        }
        if (query.end_date) {
          // Create date at end of day in UTC (23:59:59.999 UTC)
          const endDateStr = query.end_date.toString();
          const [year, month, day] = endDateStr.split('-').map(Number);
          const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
          where.created_at.lte = endDate;
          console.log(`[Admin Users] Date filter - end_date: ${endDateStr} -> ${endDate.toISOString()} (UTC)`);
        }
      }

      // Filter by package: only users who have at least one purchase with this package_id
      if (query.package_id != null && query.package_id !== '' && !query.id && !query.user_id) {
        const pkgId = parseInt(String(query.package_id), 10);
        if (!isNaN(pkgId)) {
          const purchasesWithPackage = await prisma.purchases.findMany({
            where: { package_id: pkgId },
            select: { user_id: true },
            distinct: ['user_id'],
          });
          const userIds = purchasesWithPackage.map((p) => p.user_id);
          if (userIds.length === 0) {
            where.id = BigInt(-1); // no users have this package -> match nothing
          } else {
            where.id = { in: userIds };
          }
        }
      }

      // Filter by has_active_package: which users have active (not 2x) vs no active package
      if ((query.has_active_package === 'true' || query.has_active_package === 'false') && !query.id && !query.user_id) {
        type UserIdRow = { user_id: bigint };
        const activeUserIdsResult = await prisma.$queryRaw<UserIdRow[]>`
          SELECT DISTINCT user_id FROM purchases
          WHERE status = 'completed' AND (COALESCE((income)::numeric, 0) < (amount)::numeric * 2)
        `;
        const activeUserIds = activeUserIdsResult.map((r) => r.user_id);
        if (query.has_active_package === 'true') {
          if (activeUserIds.length === 0) {
            where.id = BigInt(-1);
          } else {
            where.id = { in: activeUserIds };
          }
        } else {
          if (activeUserIds.length > 0) {
            where.id = { notIn: activeUserIds };
          }
        }
      }

      // For computed fields (direct_referrals, total_business_volume), we need to fetch all users,
      // calculate stats, sort in memory, then paginate
      const isComputedSort = sort === 'direct_referrals' || sort === 'total_business_volume';
      
      let users: any[];
      let total: number;

      if (isComputedSort) {
        // Fetch all users matching filters (no pagination yet)
        const allUsers = await prisma.users.findMany({
          where,
          select: {
            id: true,
            display_id: true,
            name: true,
            display_title: true,
            display_title_icon_url: true,
            email: true,
            phone: true,
            password_plain: true,
            transaction_pin: true,
            kyc_status: true,
            status: true,
            referrer_user_id: true,
            created_at: true,
            updated_at: true,
          },
        });
        
        total = allUsers.length;
        
        // Calculate stats for all users
        const allUserIds = allUsers.map(u => u.id);
        const allReferrerIds = Array.from(new Set(
          allUsers
            .map(u => u.referrer_user_id)
            .filter((id): id is bigint => id !== null)
        ));
        
        // Calculate direct referrals for all users
        const allDirectReferrals = await Promise.all(
          allUserIds.map(id => 
            prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: 1 } })
          )
        );
        
        // Calculate total business volume (team business) for all users
        const allTotalBusinessVolumes = await Promise.all(
          allUserIds.map(async (id) => {
            // Get all downline user IDs
            const downlinePaths = await prisma.user_tree_paths.findMany({
              where: {
                ancestor_id: id,
                depth: { gt: 0 },
              },
              select: { descendant_id: true },
            });
            
            const downlineIds = [...new Set(downlinePaths.map(p => p.descendant_id))];
            
            if (downlineIds.length === 0) {
              return 0;
            }
            
            // Calculate total business from downline
            const teamBusiness = await prisma.purchases.aggregate({
              where: {
                user_id: { in: downlineIds },
                status: 'completed',
              },
              _sum: { amount: true },
            });
            
            return Number(teamBusiness._sum.amount || 0);
          })
        );
        
        // Create a map for sorting
        const sortMap = new Map(
          allUsers.map((u, index) => [
            u.id.toString(),
            sort === 'direct_referrals' 
              ? allDirectReferrals[index] 
              : allTotalBusinessVolumes[index]
          ])
        );
        
        // Sort users in memory
        allUsers.sort((a, b) => {
          const aValue = sortMap.get(a.id.toString()) || 0;
          const bValue = sortMap.get(b.id.toString()) || 0;
          
          if (order === 'desc') {
            return bValue - aValue;
          } else {
            return aValue - bValue;
          }
        });
        
        // Now paginate
        users = allUsers.slice(offset, offset + limit);
      } else {
        // For database fields, use normal pagination
        const [usersResult, totalResult] = await Promise.all([
          prisma.users.findMany({
            where,
            select: {
              id: true,
              display_id: true,
              name: true,
              display_title: true,
              email: true,
              phone: true,
              password_plain: true,
              transaction_pin: true,
              kyc_status: true,
              status: true,
              referrer_user_id: true,
              created_at: true,
              updated_at: true,
            },
            orderBy: { [sort]: order },
            skip: offset,
            take: limit,
          }),
          prisma.users.count({ where }),
        ]);
        users = usersResult;
        total = totalResult;
      }

      // Get stats for each user
      const userIds = users.map(u => u.id);
      // Get unique referrer IDs
      const referrerIds = Array.from(new Set(
        users
          .map(u => u.referrer_user_id)
          .filter((id): id is bigint => id !== null)
      ));
      
      // For computed sorts, we already have direct_referrals calculated, but we still need other stats
      let preCalculatedDirectReferrals: number[] | null = null;
      let preCalculatedTotalBusinessVolumes: number[] | null = null;
      
      // Always calculate total_business_volume for response (even if not sorting by it)
      const calculateTotalBusinessVolume = async (userId: bigint): Promise<number> => {
        const downlinePaths = await prisma.user_tree_paths.findMany({
          where: {
            ancestor_id: userId,
            depth: { gt: 0 },
          },
          select: { descendant_id: true },
        });
        
        const downlineIds = [...new Set(downlinePaths.map(p => p.descendant_id))];
        
        if (downlineIds.length === 0) {
          return 0;
        }
        
        const teamBusiness = await prisma.purchases.aggregate({
          where: {
            user_id: { in: downlineIds },
            status: 'completed',
          },
          _sum: { amount: true },
        });
        
        return Number(teamBusiness._sum.amount || 0);
      };
      
      if (isComputedSort) {
        // Re-fetch the computed values for the paginated users
        preCalculatedDirectReferrals = await Promise.all(
          userIds.map(id => 
            prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: 1 } })
          )
        );
        
        preCalculatedTotalBusinessVolumes = await Promise.all(
          userIds.map(id => calculateTotalBusinessVolume(id))
        );
      }
      
      // Calculate total_business_volume for all users (if not already calculated)
      const totalBusinessVolumes = preCalculatedTotalBusinessVolumes 
        ? preCalculatedTotalBusinessVolumes
        : await Promise.all(userIds.map(id => calculateTotalBusinessVolume(id)));
      
      const [walletBalances, directReferrals, totalTeamSizes, totalPurchases, totalInvestments, activePackagesData, userProfiles, referrers] = await Promise.all([
        prisma.user_balances.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, balance: true, spot_balance: true, other_balance: true, team_royalty_balance: true },
        }),
        preCalculatedDirectReferrals 
          ? Promise.resolve(preCalculatedDirectReferrals)
          : Promise.all(userIds.map(id => 
              prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: 1 } })
            )),
        Promise.all(userIds.map(id => 
          prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: { gt: 0 } } })
        )),
        Promise.all(userIds.map(id => 
          prisma.purchases.count({ where: { user_id: id } })
        )),
        Promise.all(userIds.map(id =>
          prisma.purchases.aggregate({
            where: { user_id: id, status: 'completed' },
            _sum: { amount: true },
          }).then(result => Number(result._sum.amount || 0))
        )),
        Promise.all(userIds.map(async (id) => {
          // Get all completed purchases for this user
          const purchases = await prisma.purchases.findMany({
            where: {
              user_id: id,
              status: 'completed',
            },
            select: {
              id: true,
              amount: true,
              income: true,
            },
          });
          
          // Check each purchase to see if it has reached 2x (expiry is based on 2x, not active_until date)
          // Also calculate active investment amount
          let activeCount = 0;
          let activeInvestment = 0;
          for (const p of purchases) {
            const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
            if (!isDoubleReached) {
              activeCount++;
              activeInvestment += Number(p.amount || 0);
            }
          }
          
          return { count: activeCount, investment: activeInvestment };
        })),
        prisma.user_profiles.findMany({
          where: { user_id: { in: userIds } },
          select: { user_id: true, phone: true },
        }),
        referrerIds.length > 0 
          ? prisma.users.findMany({
              where: { id: { in: referrerIds } },
              select: { id: true, display_id: true },
            })
          : Promise.resolve([]),
      ]);

      const walletMap = new Map(walletBalances.map(w => [w.user_id.toString(), Number(w.balance || 0)]));
      const otherWalletMap = new Map(walletBalances.map(w => {
        const val = w.other_balance;
        const numVal = val != null && val !== null ? Number(val) : 0;
        return [w.user_id.toString(), numVal];
      }));
      const spotWalletMap = new Map(walletBalances.map(w => {
        const val = w.spot_balance;
        const numVal = val != null && val !== null ? Number(val) : 0;
        return [w.user_id.toString(), numVal];
      }));
      const teamRoyaltyWalletMap = new Map(walletBalances.map(w => {
        const val = (w as any).team_royalty_balance;
        const numVal = val != null && val !== undefined ? Number(val) : 0;
        return [w.user_id.toString(), numVal];
      }));
      const phoneMap = new Map(userProfiles.map(p => [p.user_id.toString(), p.phone]));
      const referrerDisplayIdMap = new Map(referrers.map(r => [r.id.toString(), r.display_id]));
      
      // Debug: Log referrer mapping for verification
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Admin Users] Referrer Mapping Debug:', {
          totalReferrers: referrers.length,
          referrerMap: Array.from(referrerDisplayIdMap.entries()).slice(0, 10),
          sampleUsers: users.slice(0, 5).map(u => ({
            user_id: u.id.toString(),
            user_display_id: u.display_id,
            referrer_user_id: u.referrer_user_id?.toString(),
            mapped_referrer_display_id: u.referrer_user_id ? referrerDisplayIdMap.get(u.referrer_user_id.toString()) : null,
          })),
        });
      }

      const response = {
        count: users.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: users.map((u, index) => {
          const referrerIdStr = u.referrer_user_id ? u.referrer_user_id.toString() : null;
          const referrerDisplayId = referrerIdStr 
            ? (referrerDisplayIdMap.get(referrerIdStr) || null)
            : null;
          
          const userIdStr = u.id.toString();
          const otherBalanceVal = otherWalletMap.get(userIdStr);
          const spotBalanceVal = spotWalletMap.get(userIdStr);
          const teamRoyaltyBalanceVal = teamRoyaltyWalletMap.get(userIdStr);
          const otherBalance = (otherBalanceVal !== undefined && otherBalanceVal !== null) ? Number(otherBalanceVal) : 0;
          const spotBalance = (spotBalanceVal !== undefined && spotBalanceVal !== null) ? Number(spotBalanceVal) : 0;
          const teamRoyaltyBalance = (teamRoyaltyBalanceVal !== undefined && teamRoyaltyBalanceVal !== null) ? Number(teamRoyaltyBalanceVal) : 0;
          
          // Debug first user
          if (index === 0) {
            console.log('[Admin Users] Wallet mapping debug:', {
              userId: userIdStr,
              hasOtherBalance: otherWalletMap.has(userIdStr),
              otherBalanceVal,
              otherBalance,
              hasSpotBalance: spotWalletMap.has(userIdStr),
              spotBalanceVal,
              spotBalance,
              walletBalancesCount: walletBalances.length,
              sampleBalance: walletBalances[0] ? {
                user_id: walletBalances[0].user_id.toString(),
                other_balance: walletBalances[0].other_balance,
                spot_balance: walletBalances[0].spot_balance,
              } : null,
            });
            console.log('[Admin Users] Transaction PIN debug:', {
              userId: userIdStr,
              display_id: u.display_id,
              raw_transaction_pin: u.transaction_pin,
              transaction_pin_type: typeof u.transaction_pin,
              transaction_pin_length: u.transaction_pin?.length,
              password_plain: u.password_plain,
            });
          }
          
          // Explicitly handle transaction_pin to ensure it's included
          const transactionPinValue = u.transaction_pin ? String(u.transaction_pin).trim() : null;
          
          // Debug log for SIA00299 specifically
          if (u.display_id === 'SIA00299') {
            console.log('[Admin Users] SIA00299 Response Mapping:', {
              raw_transaction_pin: u.transaction_pin,
              transaction_pin_type: typeof u.transaction_pin,
              transaction_pin_value: transactionPinValue,
              password_plain: u.password_plain,
            });
          }
          
          return {
            id: u.id.toString(),
            display_id: u.display_id || null,
            name: u.name,
            display_title: u.display_title ?? null,
            display_title_icon_url: u.display_title_icon_url ?? null,
            email: u.email,
            password: u.password_plain || null, // Plain text password for admin view
            transaction_pin: transactionPinValue, // Transaction PIN for admin view
            phone: phoneMap.get(u.id.toString()) ?? u.phone ?? null,
            total_investment: totalInvestments[index] || 0,
            active_investment: activePackagesData[index]?.investment || 0,
            total_active_packages: activePackagesData[index]?.count || 0,
            kyc_status: u.kyc_status,
            status: u.status,
            referrer_user_id: referrerIdStr,
            referrer_display_id: referrerDisplayId,
            wallet_balance: walletMap.get(u.id.toString()) ?? 0, // Total balance (for backward compatibility)
            other_balance: otherBalance, // Main Wallet (other_balance)
            spot_balance: spotBalance, // Spot Wallet
            team_royalty_balance: teamRoyaltyBalance, // Team Royalty Wallet
            direct_referrals: directReferrals[index],
            total_team_size: totalTeamSizes[index],
            total_purchases: totalPurchases[index],
            total_business_volume: totalBusinessVolumes[index] || 0,
            created_at: u.created_at,
            updated_at: u.updated_at,
          };
        }),
      };
      
      // Hide wallet balances from admins without WALLET_MANAGE permission
      const canViewWallet = await adminHasPermission(req, 'WALLET_MANAGE');
      if (!canViewWallet && response.items.length > 0) {
        response.items = response.items.map((item: any) => ({
          ...item,
          wallet_balance: 0,
          other_balance: 0,
          spot_balance: 0,
          team_royalty_balance: 0,
        }));
      }

      // Debug: Log final response for SIA00299
      const siaUser = response.items.find((item: any) => item.display_id === 'SIA00299');
      if (siaUser) {
        console.log('[Admin Users] Final API Response for SIA00299:', {
          transaction_pin: siaUser.transaction_pin,
          transaction_pin_type: typeof siaUser.transaction_pin,
          password: siaUser.password,
          all_keys: Object.keys(siaUser),
        });
      }
      
      return reply.send(response);
    } catch (error) {
      console.error('Error listing users (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   get:
   *     tags:
   *       - Admin Users
   *     summary: Get single user details (Admin view)
   *     description: |
   *       Retrieve comprehensive details about a specific user including wallet balance, team statistics,
   *       purchase history, commission details, and referral information.
   *       This endpoint provides admin-level access to all user data.
   *     operationId: getUserDetailsAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *         example: "7"
   *     responses:
   *       '200':
   *         description: User details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 name:
   *                   type: string
   *                   nullable: true
   *                   example: "Test User"
   *                 email:
   *                   type: string
   *                   nullable: true
   *                   example: "test@example.com"
   *                 kyc_status:
   *                   type: string
   *                   example: "approved"
   *                 status:
   *                   type: string
   *                   example: "active"
   *                 referrer_user_id:
   *                   type: string
   *                   nullable: true
   *                   example: "5"
   *                 referrer_name:
   *                   type: string
   *                   nullable: true
   *                   example: "Referrer Name"
   *                 wallet_balance:
   *                   type: number
   *                   example: 5000.00
   *                 total_commissions:
   *                   type: number
   *                   example: 7500.00
   *                 direct_referrals:
   *                   type: number
   *                   example: 10
   *                 total_team_size:
   *                   type: number
   *                   example: 50
   *                 total_purchases:
   *                   type: number
   *                   example: 3
   *                 total_business_volume:
   *                   type: number
   *                   example: 15000.00
   *                 is_active:
   *                   type: boolean
   *                   example: true
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-08T11:43:03.027Z"
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-10T14:04:04.265Z"
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.get('/users/:id', {
    preHandler: [adminAuth, checkPermission('USERS_VIEW')],
    schema: {
      description: 'Get single user details with comprehensive stats (Admin only)',
      tags: ['Admin Users'],
      summary: 'Get User Details (Admin)',
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
            display_id: { type: 'string', nullable: true },
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            display_title: { type: 'string', nullable: true },
            display_title_icon_url: { type: 'string', nullable: true },
            password: { type: 'string', nullable: true },
            transaction_pin: { type: 'string', nullable: true },
            kyc_status: { type: 'string' },
            status: { type: 'string' },
            referrer_user_id: { type: 'string', nullable: true },
            referrer_display_id: { type: 'string', nullable: true },
            referrer_name: { type: 'string', nullable: true },
            wallet_balance: { type: 'number' },
            total_commissions: { type: 'number' },
            direct_referrals: { type: 'number' },
            total_team_size: { type: 'number' },
            total_purchases: { type: 'number' },
            total_business_volume: { type: 'number' },
            is_active: { type: 'boolean' },
            withdrawal_blocked: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            address: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            pincode: { type: 'string', nullable: true },
            date_of_birth: { type: 'string', nullable: true },
            bank_account_no: { type: 'string', nullable: true },
            bank_ifsc: { type: 'string', nullable: true },
            bank_name: { type: 'string', nullable: true },
            bank_branch: { type: 'string', nullable: true },
            pan_number: { type: 'string', nullable: true },
            aadhar_number: { type: 'string', nullable: true },
            profile_photo_url: { type: 'string', nullable: true },
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
      const userId = BigInt((req.params as any).id);

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          display_id: true,
          name: true,
          display_title: true,
          display_title_icon_url: true,
          email: true,
          password_plain: true, // Add plain text password for admin view
          transaction_pin: true, // Add transaction PIN for admin view
          phone: true,
          kyc_status: true,
          status: true,
          referrer_user_id: true,
          withdrawal_blocked: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get user profile for additional details
      // NOTE: Some environments may have missing unique constraint on user_profiles.user_id.
      // Use findFirst to avoid relying on DB uniqueness.
      const userProfile = await prisma.user_profiles.findFirst({
        where: { user_id: userId },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Admin Users] GET /users/:id phone debug:', {
          user_id: userId.toString(),
          users_phone: user.phone ?? null,
          profile_phone: userProfile?.phone ?? null,
          response_phone: (userProfile?.phone ?? user.phone ?? null),
        });
      }

      // Get referrer name and display_id if exists
      let referrerName = null;
      let referrerDisplayId = null;
      if (user.referrer_user_id) {
        const referrer = await prisma.users.findUnique({
          where: { id: user.referrer_user_id },
          select: { name: true, display_id: true },
        });
        referrerName = referrer?.name ?? null;
        referrerDisplayId = referrer?.display_id ?? null;
      }

      // Get comprehensive stats
      const [
        wallet,
        totalCommissions,
        directReferrals,
        totalTeamSize,
        totalPurchases,
        totalBusinessVolume,
        isActive,
      ] = await Promise.all([
        prisma.user_balances.findUnique({ where: { user_id: userId }, select: { balance: true } }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
        prisma.user_tree_paths.count({ where: { ancestor_id: userId, depth: 1 } }),
        prisma.user_tree_paths.count({ where: { ancestor_id: userId, depth: { gt: 0 } } }),
        prisma.purchases.count({ where: { user_id: userId } }),
        prisma.purchases.aggregate({
          where: { user_id: userId, status: 'completed' },
          _sum: { amount: true },
        }),
        isUserActive(userId),
      ]);

      return reply.send({
        id: user.id.toString(),
        display_id: user.display_id || null,
        name: user.name,
        display_title: user.display_title ?? null,
        display_title_icon_url: user.display_title_icon_url ?? null,
        email: user.email,
        password: user.password_plain || null, // Plain text password for admin view
        transaction_pin: user.transaction_pin || null, // Transaction PIN for admin view
        // Prefer KYC/profile phone; fallback to users.phone (same as profile.ts / login)
        phone: userProfile?.phone ?? user.phone ?? null,
        kyc_status: user.kyc_status,
        status: user.status,
        referrer_user_id: user.referrer_user_id ? user.referrer_user_id.toString() : null,
        referrer_display_id: referrerDisplayId || null,
        referrer_name: referrerName,
        wallet_balance: (await adminHasPermission(req, 'WALLET_MANAGE')) && wallet ? Number(wallet.balance) : 0,
        total_commissions: Number(totalCommissions._sum.amount || 0),
        direct_referrals: directReferrals,
        total_team_size: totalTeamSize,
        total_purchases: totalPurchases,
        total_business_volume: Number(totalBusinessVolume._sum.amount || 0),
        is_active: isActive,
        created_at: user.created_at,
        updated_at: user.updated_at,
        withdrawal_blocked: user.withdrawal_blocked,
        // Additional profile fields for UI
        address: userProfile?.address || null,
        city: userProfile?.city || null,
        state: userProfile?.state || null,
        pincode: userProfile?.pincode || null,
        date_of_birth: userProfile?.date_of_birth || null,
        bank_account_no: userProfile?.bank_account_no || null,
        bank_ifsc: userProfile?.bank_ifsc || null,
        bank_name: userProfile?.bank_name || null,
        bank_branch: userProfile?.bank_branch || null,
        pan_number: userProfile?.pan_number || null,
        aadhar_number: userProfile?.aadhar_number || null,
        profile_photo_url: userProfile?.profile_photo_url || null,
      });
    } catch (error) {
      console.error('Error getting user details (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   put:
   *     tags:
   *       - Admin Users
   *     summary: Update user details (Admin)
   *     description: |
   *       Update user information including name, email, referrer, and KYC status.
   *       Only provided fields will be updated. This endpoint is only accessible to administrators.
   *     operationId: updateUserAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *         example: "7"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Updated Name"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "updated@example.com"
   *               referrer_user_id:
   *                 type: string
   *                 nullable: true
   *                 example: "5"
   *               kyc_status:
   *                 type: string
   *                 enum: [pending, submitted, approved, rejected]
   *                 example: "approved"
   *     responses:
   *       '200':
   *         description: User updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 name:
   *                   type: string
   *                   example: "Updated Name"
   *                 email:
   *                   type: string
   *                   example: "updated@example.com"
   *                 status:
   *                   type: string
   *                   example: "active"
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *       '400':
   *         description: Invalid request data
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.put('/users/:id', {
    preHandler: [adminAuth, checkPermission('USERS_EDIT')],
    schema: {
      description: 'Update user details (Admin only)',
      tags: ['Admin Users'],
      summary: 'Update User (Admin)',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string', nullable: true },
          referrer_user_id: { type: 'string', nullable: true },
          kyc_status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'rejected'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            kyc_status: { type: 'string' },
            status: { type: 'string' },
            referrer_user_id: { type: 'string', nullable: true },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
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
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const existingUser = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Parse and validate request body
      const body = updateUserBody.parse(req.body);
      const existingProfile = await prisma.user_profiles.findFirst({
        where: { user_id: userId },
        select: { phone: true },
      });
      const oldPhone = existingProfile?.phone ?? null;

      let normalizedPhone: string | null | undefined = undefined;
      if (body.phone !== undefined) {
        normalizedPhone = body.phone === null ? null : body.phone.trim();
        if (normalizedPhone === '') normalizedPhone = null;
      }

      // Updating display_title or display_title_icon_url requires DISPLAY_TITLE_MANAGE permission
      if (body.display_title !== undefined || body.display_title_icon_url !== undefined) {
        const canManageTitle = await adminHasPermission(req, 'DISPLAY_TITLE_MANAGE');
        if (!canManageTitle) {
          return reply.code(403).send({
            error: 'forbidden',
            message: 'Permission required: DISPLAY_TITLE_MANAGE to update display title',
          });
        }
      }

      // Build update data object (only include provided fields)
      // Note: duplicate email is allowed here (admin-only). Register/profile paths block duplicates.
      const updateData: any = {
        updated_at: new Date(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.display_title !== undefined) updateData.display_title = body.display_title;
      if (body.display_title_icon_url !== undefined) updateData.display_title_icon_url = body.display_title_icon_url;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phone !== undefined) updateData.phone = normalizedPhone;
      if (body.referrer_user_id !== undefined) updateData.referrer_user_id = body.referrer_user_id;
      if (body.kyc_status !== undefined) {
        updateData.kyc_status = body.kyc_status;
        if (body.kyc_status === 'approved') {
          updateData.kyc_verified_at = new Date();
        }
      }
      if (body.transaction_pin !== undefined) {
        updateData.transaction_pin = body.transaction_pin.trim();
      }
      if (body.withdrawal_blocked !== undefined) updateData.withdrawal_blocked = body.withdrawal_blocked;

      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: updateData,
      });

      // Phone change should be reflected in user_profiles (used by admin UI + many app flows)
      if (body.phone !== undefined) {
        // NOTE: Some environments may be missing the DB unique constraint on user_profiles.user_id.
        // So update all matching rows; if none exist, create one.
        const updateResult = await prisma.user_profiles.updateMany({
          where: { user_id: userId },
          data: { phone: normalizedPhone, updated_at: new Date() },
        });
        if (updateResult.count === 0) {
          await prisma.user_profiles.create({
            data: { user_id: userId, phone: normalizedPhone, updated_at: new Date() },
          });
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[Admin Users] PUT /users/:id phone debug:', {
            user_id: userId.toString(),
            normalizedPhone,
            users_phone_after: updatedUser.phone ?? null,
            user_profiles_updated_rows: updateResult.count,
          });
        }

        // Admin activity log (helps audit who changed what)
        const admin = (req as any).admin;
        if (admin?.user_id) {
          const { ipAddress, userAgent } = getRequestInfo(req);
          logAdminActivity({
            adminUserId: BigInt(admin.user_id),
            actionType: 'USER_PHONE_UPDATE',
            targetUserId: userId,
            targetEntityType: 'user',
            targetEntityId: userId.toString(),
            actionDetails: {
              user_display_id: existingUser.display_id ?? null,
              user_name: existingUser.name ?? null,
              user_email: existingUser.email ?? null,
              old_phone: oldPhone,
              new_phone: normalizedPhone,
            },
            ipAddress,
            userAgent,
            status: 'success',
          });
        }
      }

      return reply.send({
        id: updatedUser.id.toString(),
        name: updatedUser.name,
        display_title: updatedUser.display_title ?? null,
        display_title_icon_url: updatedUser.display_title_icon_url ?? null,
        email: updatedUser.email,
        phone: updatedUser.phone ?? null,
        kyc_status: updatedUser.kyc_status,
        status: updatedUser.status,
        referrer_user_id: updatedUser.referrer_user_id ? updatedUser.referrer_user_id.toString() : null,
        withdrawal_blocked: updatedUser.withdrawal_blocked,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      });
    } catch (error) {
      console.error('Error updating user (admin):', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Allowed image types and size for display title icon (PNG, etc.)
  const DISPLAY_TITLE_ICON_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  const DISPLAY_TITLE_ICON_MAX_MB = 2;

  /**
   * POST /api/v1/admin/users/:id/display-title-icon
   * Upload display title icon (PNG/image) for a user. Admin only.
   */
  app.post('/users/:id/display-title-icon', {
    preHandler: [adminAuth, checkPermission('DISPLAY_TITLE_MANAGE')],
    schema: {
      description: 'Upload display title icon image for user (shown next to title on dashboard)',
      tags: ['Admin Users'],
      consumes: ['multipart/form-data'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      response: {
        200: { type: 'object', properties: { display_title_icon_url: { type: 'string' } } },
        400: { type: 'object', properties: { message: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const existing = await prisma.users.findUnique({ where: { id: userId }, select: { id: true, display_title_icon_url: true } });
      if (!existing) {
        return reply.code(404).send({ error: 'User not found' });
      }
      const data = await req.file();
      if (!data) {
        return reply.code(400).send({ message: 'No file uploaded' });
      }
      if (!bunnyCDNService.isValidFileType(data.mimetype, DISPLAY_TITLE_ICON_TYPES)) {
        return reply.code(400).send({ message: 'Invalid file type. Allowed: PNG, JPG, GIF, WebP' });
      }
      const fileBuffer = await data.toBuffer();
      if (!bunnyCDNService.isValidFileSize(fileBuffer.length, DISPLAY_TITLE_ICON_MAX_MB)) {
        return reply.code(400).send({ message: `File too large. Max: ${DISPLAY_TITLE_ICON_MAX_MB}MB` });
      }
      const filename = bunnyCDNService.generateFilename(userId, data.filename || 'icon.png');
      const cdnUrl = await bunnyCDNService.uploadFile(fileBuffer, filename, 'display_title_icons');
      await prisma.users.update({
        where: { id: userId },
        data: { display_title_icon_url: cdnUrl, updated_at: new Date() },
      });
      return reply.send({ display_title_icon_url: cdnUrl });
    } catch (err: any) {
      console.error('Display title icon upload error:', err);
      return reply.code(500).send({ error: err?.message || 'Upload failed' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   delete:
   *     tags:
   *       - Admin Users
   *     summary: Delete/Deactivate user (Admin)
   *     description: |
   *       Delete a user by ID. This operation sets the user status to 'inactive'.
   *       This is a soft delete operation - the user record is preserved but marked as inactive.
   *       This endpoint is only accessible to administrators.
   *     operationId: deleteUserAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *         example: "7"
   *     responses:
   *       '200':
   *         description: User deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User deactivated successfully"
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 status:
   *                   type: string
   *                   example: "inactive"
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.delete('/users/:id', {
    preHandler: [adminAuth, checkPermission('USERS_VIEW')],
    schema: {
      description: 'Delete/Deactivate user (Admin only)',
      tags: ['Admin Users'],
      summary: 'Delete User (Admin)',
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
            message: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string' },
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
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const existingUser = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Soft delete - set status to inactive
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          status: 'inactive',
          updated_at: new Date(),
        },
      });

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'USER_BLOCK',
          targetUserId: userId,
          targetEntityType: 'user',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            user_email: targetUser?.email || null,
            old_status: existingUser.status,
            new_status: 'inactive',
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        message: 'User deactivated successfully',
        id: updatedUser.id.toString(),
        status: updatedUser.status,
      });
    } catch (error) {
      console.error('Error deleting user (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/users/{id}/activate:
   *   post:
   *     tags:
   *       - Admin Users
   *     summary: Activate user
   *     description: |
   *       Activate a user by setting their status to 'active'.
   *       This endpoint is only accessible to administrators.
   *     operationId: activateUser
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *         example: "7"
   *     responses:
   *       '200':
   *         description: User activated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User activated successfully"
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 status:
   *                   type: string
   *                   example: "active"
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.post('/users/:id/activate', {
    preHandler: [adminAuth, checkPermission('USERS_EDIT')],
    schema: {
      description: 'Activate user (Admin only)',
      tags: ['Admin Users'],
      summary: 'Activate User',
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
            message: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string' },
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
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const existingUser = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Activate user
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          status: 'active',
          updated_at: new Date(),
        },
      });

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'USER_UNBLOCK',
          targetUserId: userId,
          targetEntityType: 'user',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            user_email: targetUser?.email || null,
            old_status: existingUser.status,
            new_status: 'active',
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        message: 'User activated successfully',
        id: updatedUser.id.toString(),
        status: updatedUser.status,
      });
    } catch (error) {
      console.error('Error activating user:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/users/{id}/deactivate:
   *   post:
   *     tags:
   *       - Admin Users
   *     summary: Deactivate user
   *     description: |
   *       Deactivate a user by setting their status to 'inactive'.
   *       This endpoint is only accessible to administrators.
   *     operationId: deactivateUser
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *         example: "7"
   *     responses:
   *       '200':
   *         description: User deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User deactivated successfully"
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 status:
   *                   type: string
   *                   example: "inactive"
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.post('/users/:id/deactivate', {
    preHandler: [adminAuth, checkPermission('USERS_EDIT')],
    schema: {
      description: 'Deactivate user (Admin only)',
      tags: ['Admin Users'],
      summary: 'Deactivate User',
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
            message: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string' },
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
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const existingUser = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Deactivate user
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          status: 'inactive',
          updated_at: new Date(),
        },
      });

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'USER_BLOCK',
          targetUserId: userId,
          targetEntityType: 'user',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            user_email: targetUser?.email || null,
            old_status: existingUser.status,
            new_status: 'inactive',
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        message: 'User deactivated successfully',
        id: updatedUser.id.toString(),
        status: updatedUser.status,
      });
    } catch (error) {
      console.error('Error deactivating user:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/users/{id}/team-business:
   *   get:
   *     tags:
   *       - Admin Users
   *     summary: Get team business volume with date filters (Admin)
   *     description: |
   *       Get total business volume from user's downline (team) with optional date filters.
   *       Returns direct business and team business separately.
   *     operationId: getTeamBusinessVolumeAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date (YYYY-MM-DD)
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: End date (YYYY-MM-DD)
   *     responses:
   *       '200':
   *         description: Team business volume retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                 direct_business:
   *                   type: number
   *                 team_business:
   *                   type: number
   *                 total_business_volume:
   *                   type: number
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.get('/users/:id/team-business', {
    preHandler: [adminAuth, checkPermission('USERS_VIEW')],
    schema: {
      description: 'Get team business volume with date filters (Admin only)',
      tags: ['Admin Users'],
      summary: 'Get Team Business Volume (Admin)',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            direct_business: { type: 'number' },
            team_business: { type: 'number' },
            total_business_volume: { type: 'number' },
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
      const userId = BigInt((req.params as any).id);
      const query = req.query as { start_date?: string; end_date?: string };

      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Build date filter for purchases
      const purchaseWhere: any = {
        status: 'completed',
      };

      if (query.start_date || query.end_date) {
        purchaseWhere.purchased_at = {};
        if (query.start_date) {
          // Set start date to beginning of day in UTC to avoid timezone issues
          const startDate = new Date(query.start_date);
          startDate.setUTCHours(0, 0, 0, 0);
          purchaseWhere.purchased_at.gte = startDate;
        }
        if (query.end_date) {
          // Set end date to end of day in UTC to include entire end date
          const endDate = new Date(query.end_date);
          endDate.setUTCHours(23, 59, 59, 999);
          purchaseWhere.purchased_at.lte = endDate;
        }
      }

      // Get direct business (user's own purchases)
      const directBusiness = await prisma.purchases.aggregate({
        where: {
          user_id: userId,
          ...purchaseWhere,
        },
        _sum: { amount: true },
      });

      // Get downline IDs (team members)
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

      // Get team business (downline purchases)
      let teamBusiness = 0;
      if (downlineIds.length > 0) {
        const teamBusinessResult = await prisma.purchases.aggregate({
          where: {
            user_id: { in: downlineIds },
            ...purchaseWhere,
          },
          _sum: { amount: true },
        });
        teamBusiness = Number(teamBusinessResult._sum.amount || 0);
      }

      const direct = Number(directBusiness._sum.amount || 0);
      const total = direct + teamBusiness;

      return reply.send({
        user_id: userId.toString(),
        direct_business: direct,
        team_business: teamBusiness,
        total_business_volume: total,
      });
    } catch (error) {
      console.error('Error getting team business volume (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get business volume with legs breakdown and date filters (Admin only)
  app.get('/users/:id/business-volume', {
    preHandler: [adminAuth, checkPermission('USERS_VIEW')],
    schema: {
      description: 'Get business volume with legs breakdown and date filters (Admin only)',
      tags: ['Admin Users'],
      summary: 'Get Business Volume with Legs (Admin)',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            direct_business: { type: 'number' },
            team_business: { type: 'number' },
            total_business_volume: { type: 'number' },
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
      const userId = BigInt((req.params as any).id);
      const query = req.query as { start_date?: string; end_date?: string };

      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Build date filter for purchases
      const purchaseWhere: any = {
        status: 'completed',
      };

      if (query.start_date || query.end_date) {
        purchaseWhere.purchased_at = {};
        if (query.start_date) {
          // Set start date to beginning of day in UTC to avoid timezone issues
          const startDate = new Date(query.start_date);
          startDate.setUTCHours(0, 0, 0, 0);
          purchaseWhere.purchased_at.gte = startDate;
        }
        if (query.end_date) {
          // Set end date to end of day in UTC to include entire end date
          const endDate = new Date(query.end_date);
          endDate.setUTCHours(23, 59, 59, 999);
          purchaseWhere.purchased_at.lte = endDate;
        }
      }

      // Get direct business (user's own purchases)
      const directBusiness = await prisma.purchases.aggregate({
        where: {
          user_id: userId,
          ...purchaseWhere,
        },
        _sum: { amount: true },
      });

      // Also get purchase details for debugging/display (all purchases, not filtered by date)
      const directPurchases = await prisma.purchases.findMany({
        where: {
          user_id: userId,
          status: 'completed',
        },
        select: {
          id: true,
          amount: true,
          purchased_at: true,
        },
        orderBy: {
          purchased_at: 'desc',
        },
        take: 10, // Get last 10 purchases
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
              ...purchaseWhere,
            },
            _sum: { amount: true },
          });

          // Calculate leg's team business
          let legTeamBusiness = 0;
          if (legTeamIds.length > 1) {
            const legTeamTotal = await prisma.purchases.aggregate({
              where: {
                user_id: { in: legTeamIds.slice(1).map((x) => BigInt(x)) },
                ...purchaseWhere,
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
        select: { id: true, name: true, display_id: true },
      });
      const legUserMap = new Map(legUsers.map((u) => [u.id.toString(), { name: u.name, display_id: u.display_id }]));

      const legs = legVolumes.map((leg) => ({
        ...leg,
        leg_user_name: legUserMap.get(leg.leg_user_id)?.name ?? null,
        leg_user_display_id: legUserMap.get(leg.leg_user_id)?.display_id ?? null,
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
        // Include purchase details for debugging
        purchase_details: directPurchases.map(p => ({
          id: p.id.toString(),
          amount: Number(p.amount),
          purchased_at: p.purchased_at.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Error getting business volume with legs (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

