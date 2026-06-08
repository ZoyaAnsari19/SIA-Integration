import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';

/** Inactive global contributors at credit time: raw − active from ledger metadata */
function inactiveGlobalContributorsFromMetadata(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata) return null;
  const raw = metadata.global_contributors_raw;
  const active = metadata.global_contributors_active;
  if (raw == null || active == null) return null;
  const rawN = Number(raw);
  const activeN = Number(active);
  if (!Number.isFinite(rawN) || !Number.isFinite(activeN)) return null;
  return Math.max(0, rawN - activeN);
}

export async function incomeHistoryRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/income-history/self-income:
   *   get:
   *     tags:
   *       - Income History
   *     summary: Get SELF commissions only
   *     description: |
   *       Retrieve only SELF type commissions for the authenticated user with pagination.
   *       SELF commissions are earned when a user purchases a package themselves.
   *     operationId: getSelfIncome
   *     security:
   *       - bearerAuth: []
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
   *     responses:
   *       '200':
   *         description: SELF commissions retrieved successfully
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
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF]
   *                         example: "SELF"
   *                       amount:
   *                         type: number
   *                         example: 5000.00
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2024-01-16T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/self-income', {
    preHandler: requireUser,
    schema: {
      description: 'Get SELF commissions only',
      tags: ['Income History'],
      summary: 'Get Self Income',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'SELF' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'SELF' } }),
      ]);

      // Enrich with package information (via purchase -> package)
      const purchaseIds = commissions
        .map(c => c.purchase_id)
        .filter((id): id is bigint => id !== null && id !== undefined);

      let purchasePackageMap = new Map<string, { package_id: number | null; package_name: string | null }>();

      if (purchaseIds.length > 0) {
        const purchases = await prisma.purchases.findMany({
          where: { id: { in: purchaseIds } },
          select: { id: true, package_id: true },
        });

        const packageIds = purchases
          .map(p => p.package_id)
          .filter((id): id is number => id !== null && id !== undefined);

        const packages = packageIds.length > 0
          ? await prisma.packages.findMany({
              where: { id: { in: packageIds } },
              select: { id: true, name: true },
            })
          : [];

        const packageById = new Map<number, string>();
        packages.forEach(pkg => {
          packageById.set(pkg.id, pkg.name);
        });

        purchases.forEach(p => {
          const pkgName = p.package_id != null ? packageById.get(p.package_id) || null : null;
          purchasePackageMap.set(p.id.toString(), {
            package_id: p.package_id ?? null,
            package_name: pkgName,
          });
        });
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const items = commissions.map(c => {
        const purchaseId = c.purchase_id ? c.purchase_id.toString() : null;
        const pkgInfo = purchaseId ? purchasePackageMap.get(purchaseId) : undefined;
        const existingMetadata: any = (c.metadata as any) || {};
        const holdUntil = existingMetadata.hold_until as string | undefined;
        const isLocked = !!holdUntil && holdUntil > todayStr;

        return {
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          credited_at: c.credited_at,
          settled: c.settled,
          purchase_id: purchaseId,
          hold_until: holdUntil ?? null,
          is_locked: isLocked,
          metadata: {
            ...existingMetadata,
            package_id: pkgInfo?.package_id ?? existingMetadata.package_id ?? null,
            package_name: pkgInfo?.package_name ?? existingMetadata.package_name ?? null,
          },
        };
      });

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting SELF commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/income-history/global-help-income:
   *   get:
   *     tags:
   *       - Income History
   *     summary: Get GLOBAL_HELPING commissions only
   *     description: |
   *       Retrieve only GLOBAL_HELPING type commissions for the authenticated user with pagination.
   *       GLOBAL_HELPING commissions are earned from global helping pool.
   *     operationId: getGlobalHelpIncome
   *     security:
   *       - bearerAuth: []
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
   *     responses:
   *       '200':
   *         description: GLOBAL_HELPING commissions retrieved successfully
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
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [GLOBAL_HELPING]
   *                         example: "GLOBAL_HELPING"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/global-help-income', {
    preHandler: requireUser,
    schema: {
      description: 'Get GLOBAL_HELPING commissions only',
      tags: ['Income History'],
      summary: 'Get Global Help Income',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total, allCommissionsForTotal] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' } }),
        // Get all commissions to calculate total global IDs used (for summary card)
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' },
          select: { metadata: true },
        }),
      ]);

      // Enrich with package information (via purchase -> package)
      const purchaseIds = commissions
        .map(c => c.purchase_id)
        .filter((id): id is bigint => id !== null && id !== undefined);

      let purchasePackageMap = new Map<string, { package_id: number | null; package_name: string | null }>();

      if (purchaseIds.length > 0) {
        const purchases = await prisma.purchases.findMany({
          where: { id: { in: purchaseIds } },
          select: { id: true, package_id: true },
        });

        const packageIds = purchases
          .map(p => p.package_id)
          .filter((id): id is number => id !== null && id !== undefined);

        const packages = packageIds.length > 0
          ? await prisma.packages.findMany({
              where: { id: { in: packageIds } },
              select: { id: true, name: true },
            })
          : [];

        const packageById = new Map<number, string>();
        packages.forEach(pkg => {
          packageById.set(pkg.id, pkg.name);
        });

        purchases.forEach(p => {
          const pkgName = p.package_id != null ? packageById.get(p.package_id) || null : null;
          purchasePackageMap.set(p.id.toString(), {
            package_id: p.package_id ?? null,
            package_name: pkgName,
          });
        });
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const items = commissions.map(c => {
        const purchaseId = c.purchase_id ? c.purchase_id.toString() : null;
        const pkgInfo = purchaseId ? purchasePackageMap.get(purchaseId) : undefined;
        const existingMetadata: any = (c.metadata as any) || {};

        // Extract used_ids from metadata (for Global Help Income display)
        const usedIds = existingMetadata.used_ids ?? existingMetadata.effective_global_ids ?? null;
        const inactiveGlobalContributors = inactiveGlobalContributorsFromMetadata(existingMetadata);
        const holdUntil = existingMetadata.hold_until as string | undefined;
        const isLocked = !!holdUntil && holdUntil > todayStr;

        return {
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          credited_at: c.credited_at,
          settled: c.settled,
          purchase_id: purchaseId,
          used_ids: usedIds !== null ? Number(usedIds) : null,
          inactive_global_contributors: inactiveGlobalContributors,
          hold_until: holdUntil ?? null,
          is_locked: isLocked,
          metadata: {
            ...existingMetadata,
            package_id: pkgInfo?.package_id ?? existingMetadata.package_id ?? null,
            package_name: pkgInfo?.package_name ?? existingMetadata.package_name ?? null,
            used_ids: usedIds,
            inactive_global_contributors: inactiveGlobalContributors,
          },
        };
      });

      // Calculate total global IDs used across ALL entries (not just current page)
      // This is for the summary card to show accurate total
      // allCommissionsForTotal is already fetched in Promise.all above
      const totalGlobalIdsUsed = allCommissionsForTotal.reduce((sum, entry) => {
        const metadata: any = entry.metadata || {};
        const usedIds = metadata.used_ids ?? metadata.effective_global_ids ?? 0;
        return sum + (Number(usedIds) || 0);
      }, 0);

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        total_global_ids_used: totalGlobalIdsUsed, // Total across all entries (all pages)
        items,
      });
    } catch (error) {
      console.error('Error getting GLOBAL commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/income-history/spot-income:
   *   get:
   *     tags:
   *       - Income History
   *     summary: Get SPOT commissions only
   *     description: |
   *       Retrieve only SPOT type commissions for the authenticated user with pagination.
   *       SPOT commissions are one-time commissions earned from downline purchases.
   *     operationId: getSpotIncome
   *     security:
   *       - bearerAuth: []
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
   *     responses:
   *       '200':
   *         description: SPOT commissions retrieved successfully
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
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SPOT]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       source_user_display_id:
   *                         type: string
   *                         nullable: true
   *                         example: "SIA00005"
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/spot-income', {
    preHandler: requireUser,
    schema: {
      description: 'Get SPOT commissions only',
      tags: ['Income History'],
      summary: 'Get Spot Income',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total, totalAmountResult, withdrawalEntries] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'SPOT' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'SPOT' } }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'SPOT' },
          _sum: { amount: true },
        }),
        // Get spot wallet withdrawals directly from withdraw_requests table
        // This is more accurate than checking ledger entries
        prisma.withdraw_requests.findMany({
          where: {
            user_id: userId,
            withdraw_type: 'spot',
            status: {
              in: ['approved', 'processing'],
            },
          },
          select: {
            amount: true,
          },
        }),
      ]);

      // Calculate total spot withdrawals from withdraw_requests
      // Sum all approved/processing spot wallet withdrawals
      const totalSpotWithdrawals = withdrawalEntries.reduce((sum, entry) => {
        return sum + Number(entry.amount || 0);
      }, 0);
      
      // Debug log
      console.log(`[Spot Income] User ${userId}: withdrawals=${withdrawalEntries.length}, total=${totalSpotWithdrawals}`);

      // Get source user names and display_ids
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true, display_id: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));
      const userDisplayIdMap = new Map(sourceUsers.map(u => [u.id.toString(), u.display_id]));

      // Derive level from user_tree_paths (depth between current user and source user)
      const treePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          descendant_id: { in: sourceUserIds.map(id => BigInt(id)) },
        },
        select: {
          ancestor_id: true,
          descendant_id: true,
          depth: true,
        },
      });
      const levelMap = new Map<string, number>();
      treePaths.forEach(path => {
        levelMap.set(path.descendant_id.toString(), path.depth);
      });

      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for hold comparison

      const items = commissions.map(c => {
        const meta = c.metadata as any;
        const sourceIdStr = c.source_user_id.toString();
        const depth = levelMap.get(sourceIdStr) ?? null;
        // Business level mapping: depth 1 = Level 0 (direct), depth 2 = Level 1, etc.
        const businessLevel = depth === null ? null : Math.max(0, depth - 1);
        const holdUntil = meta?.hold_until as string | undefined;
        const isLocked = !!holdUntil && holdUntil > todayStr;

        return {
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          source_user_id: sourceIdStr,
          source_user_name: userMap.get(sourceIdStr) ?? null,
          source_user_display_id: userDisplayIdMap.get(sourceIdStr) ?? null,
          level: meta?.level ?? businessLevel,
          credited_at: c.credited_at,
          settled: c.settled,
          metadata: meta || undefined,
          hold_until: holdUntil ?? null,
          is_locked: isLocked,
        };
      });

      const totalSpotCommissions = Number(totalAmountResult._sum.amount || 0);
      const netSpotAmount = totalSpotCommissions - totalSpotWithdrawals;

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        total_amount: totalSpotCommissions, // Total sum of all spot commissions (gross)
        total_withdrawals: totalSpotWithdrawals, // Total spot withdrawals
        net_amount: netSpotAmount, // Net amount after withdrawals (commissions - withdrawals)
        items,
      });
    } catch (error) {
      console.error('Error getting SPOT commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/income-history/team-income:
   *   get:
   *     tags:
   *       - Income History
   *     summary: Get Team MONTHLY commissions only (excludes direct Level 0)
   *     description: |
   *       Retrieve only MONTHLY type commissions for the authenticated user with pagination.
   *       MONTHLY commissions are recurring commissions earned monthly from active downline members.
   *       This endpoint excludes Level 0 (direct referrer) commissions, which are shown in Direct Monthly Recurring page.
   *     operationId: getTeamIncome
   *     security:
   *       - bearerAuth: []
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
   *     responses:
   *       '200':
   *         description: MONTHLY commissions retrieved successfully
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
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [MONTHLY]
   *                         example: "MONTHLY"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       level:
   *                         type: number
   *                         nullable: true
   *                         example: 1
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/team-income', {
    preHandler: requireUser,
    schema: {
      description: 'Get MONTHLY commissions only',
      tags: ['Income History'],
      summary: 'Get Team Income',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get all MONTHLY commissions first
      const allCommissions = await prisma.ledger_entries.findMany({
        where: { receiver_user_id: userId, commission_type: 'MONTHLY' },
        orderBy: { credited_at: 'desc' },
      });

      // Get all source user IDs to calculate levels
      const allSourceUserIds = [...new Set(allCommissions.map(c => c.source_user_id.toString()))];

      // Get source user names and display IDs
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: allSourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true, display_id: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), { name: u.name, display_id: u.display_id }]));

      // Derive level from user_tree_paths (depth between current user and source user)
      const treePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          descendant_id: { in: allSourceUserIds.map(id => BigInt(id)) },
        },
        select: {
          ancestor_id: true,
          descendant_id: true,
          depth: true,
        },
      });
      const levelMap = new Map<string, number>();
      treePaths.forEach(path => {
        levelMap.set(path.descendant_id.toString(), path.depth);
      });

      // Filter out Level 0 (direct) commissions - they are shown in Direct Monthly Recurring page
      const teamCommissions = allCommissions.filter(c => {
        const metadata = c.metadata as any;
        const sourceIdStr = c.source_user_id.toString();
        const depth = levelMap.get(sourceIdStr) ?? null;
        // Business level mapping: depth 1 = Level 0 (direct), depth 2 = Level 1, etc.
        const businessLevel = depth === null ? null : Math.max(0, depth - 1);
        // Prefer explicit metadata.level if present, otherwise computed business level
        const level = metadata?.level ?? businessLevel;
        // Exclude Level 0 (direct commissions)
        return level !== 0 && level !== null;
      });

      const total = teamCommissions.length;
      const commissions = teamCommissions.slice(offset, offset + limit);

      // Get unique source user IDs and purchase IDs from filtered commissions
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const purchaseIds = [...new Set(commissions.filter(c => c.purchase_id).map(c => c.purchase_id!.toString()))];

      // Get purchase and package details
      const [purchases, packages] = await Promise.all([
        purchaseIds.length > 0 ? prisma.purchases.findMany({
          where: { id: { in: purchaseIds.map(id => BigInt(id)) } },
          select: { 
            id: true, 
            amount: true,
            package_id: true,
          },
        }) : Promise.resolve([]),
        purchaseIds.length > 0 ? (async () => {
          const purchaseData = await prisma.purchases.findMany({
            where: { id: { in: purchaseIds.map(id => BigInt(id)) } },
            select: { package_id: true },
          });
          const packageIds = [...new Set(purchaseData.map(p => p.package_id))];
          return packageIds.length > 0 ? prisma.packages.findMany({
            where: { id: { in: packageIds } },
            select: { id: true, name: true, price: true },
          }) : [];
        })() : Promise.resolve([]),
      ]);

      const purchaseMap = new Map(purchases.map(p => [p.id.toString(), { amount: Number(p.amount), package_id: p.package_id }]));
      const packageMap = new Map(packages.map(p => [p.id, { name: p.name, price: Number(p.price) }]));

      const items = commissions.map(c => {
        const metadata = c.metadata as any;
        const sourceIdStr = c.source_user_id.toString();
        const depth = levelMap.get(sourceIdStr) ?? null;
        // Business level mapping: depth 1 = Level 0 (direct), depth 2 = Level 1, etc.
        const businessLevel = depth === null ? null : Math.max(0, depth - 1);
        const sourceUser = userMap.get(sourceIdStr);
        
        // Get package details
        const purchase = c.purchase_id ? purchaseMap.get(c.purchase_id.toString()) : null;
        const packageInfo = purchase ? packageMap.get(purchase.package_id) : null;
        
        // Get reinvestment status from metadata
        const isReinvestment = metadata?.is_reinvestment === true;

        return {
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          source_user_id: sourceIdStr,
          source_user_name: sourceUser?.name ?? null,
          source_user_display_id: sourceUser?.display_id ?? null,
          // Prefer explicit metadata.level if present, otherwise computed business level
          level: metadata?.level ?? businessLevel,
          credited_at: c.credited_at,
          settled: c.settled,
          purchase_id: c.purchase_id ? c.purchase_id.toString() : null,
          package_name: packageInfo?.name ?? null,
          package_price: packageInfo?.price ?? null,
          investment: purchase ? purchase.amount : null,
          is_reinvestment: isReinvestment,
        };
      });

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting MONTHLY commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/income-history/direct-income:
   *   get:
   *     tags:
   *       - Income History
   *     summary: Get direct referral monthly recurring commissions
   *     description: |
   *       Retrieve direct referral monthly recurring commissions for the authenticated user with pagination.
   *       These are MONTHLY commissions from direct referrals (Level 0, depth = 1).
   *       These commissions are credited daily as long as the purchase remains active (not reached 2x investment).
   *     operationId: getDirectIncome
   *     security:
   *       - bearerAuth: []
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
   *     responses:
   *       '200':
   *         description: Direct monthly recurring commissions retrieved successfully
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
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [MONTHLY]
   *                         example: "MONTHLY"
   *                       amount:
   *                         type: number
   *                         example: 16.67
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Ramesh Kumar"
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *                       investment:
   *                         type: number
   *                         nullable: true
   *                         example: 5000.00
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-01-01T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/direct-income', {
    preHandler: requireUser,
    schema: {
      description: 'Get direct referral monthly recurring commissions',
      tags: ['Income History'],
      summary: 'Get Direct Monthly Recurring',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get direct referrals (depth = 1)
      const directReferrals = await prisma.user_tree_paths.findMany({
        where: { ancestor_id: userId, depth: 1 },
        select: { descendant_id: true },
      });
      const directReferralIds = directReferrals.map(r => r.descendant_id as unknown as bigint);

      if (directReferralIds.length === 0) {
        return reply.send({
          count: 0,
          page,
          limit,
          total_pages: 0,
          total: 0,
          items: [],
        });
      }

      // Get MONTHLY commissions from direct referrals (Level 0)
      // First get all MONTHLY commissions from direct referrals, then filter by metadata level = 0
      const allMonthlyCommissions = await prisma.ledger_entries.findMany({
        where: {
          receiver_user_id: userId,
          commission_type: 'MONTHLY',
          source_user_id: { in: directReferralIds },
        },
        orderBy: { credited_at: 'desc' },
      });

      // Filter by metadata level = 0 to ensure only direct referrer (Level 0) commissions
      const level0Commissions = allMonthlyCommissions.filter(c => {
        const metadata = c.metadata as any;
        return metadata?.level === 0;
      });

      const total = level0Commissions.length;
      const commissions = level0Commissions.slice(offset, offset + limit);

      // Get source user names and purchase info with package details
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const purchaseIds = [...new Set(commissions.filter(c => c.purchase_id).map(c => c.purchase_id!.toString()))];

      const [sourceUsers, purchases] = await Promise.all([
        prisma.users.findMany({
          where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
          select: { id: true, name: true, display_id: true }, // Include display_id
        }),
        purchaseIds.length > 0 ? prisma.purchases.findMany({
          where: { id: { in: purchaseIds.map(id => BigInt(id)) } },
          select: { 
            id: true, 
            amount: true,
            package_id: true,
          },
        }) : Promise.resolve([]),
      ]);

      // Get package details
      const packageIds = [...new Set(purchases.map(p => p.package_id))];
      const packages = packageIds.length > 0 ? await prisma.packages.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true, price: true },
      }) : [];

      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), { name: u.name, display_id: u.display_id }]));
      const purchaseMap = new Map(purchases.map(p => [p.id.toString(), { amount: Number(p.amount), package_id: p.package_id }]));
      const packageMap = new Map(packages.map(p => [p.id, { name: p.name, price: Number(p.price) }]));

      const items = commissions.map(c => {
        const purchase = c.purchase_id ? purchaseMap.get(c.purchase_id.toString()) : null;
        const packageInfo = purchase ? packageMap.get(purchase.package_id) : null;
        
        const sourceUser = userMap.get(c.source_user_id.toString());
        return {
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          source_user_id: c.source_user_id.toString(),
          source_user_name: sourceUser?.name ?? null,
          source_user_display_id: sourceUser?.display_id ?? null, // Add display_id
          purchase_id: c.purchase_id ? c.purchase_id.toString() : null,
          investment: purchase ? purchase.amount : null,
          package_name: packageInfo ? packageInfo.name : null,
          package_price: packageInfo ? packageInfo.price : null,
          credited_at: c.credited_at,
          settled: c.settled,
        };
      });

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting direct monthly recurring:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

