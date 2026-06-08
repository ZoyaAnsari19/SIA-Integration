import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';

export async function adminAllCommissionsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/commissions:
   *   get:
   *     tags:
   *       - Admin Commissions
   *     summary: Get all user commissions with filters
   *     description: |
   *       Retrieve commission history for all users with comprehensive filters.
   *       Supports filtering by user, commission type, date range, and pagination.
   *       Returns detailed information based on commission type:
   *       - SELF: package_id, income_amount, activation_req_id
   *       - SPOT: income_lvl, from_id, investment_amt, investment_type, spot_added
   *       - MONTHLY: members (source), income_amount
   *       - GLOBAL_HELPING: direct flag, package_id, members
   *     operationId: getAllCommissions
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         description: Filter by receiver user ID (optional)
   *       - in: query
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, SPOT, MONTHLY, GLOBAL_HELPING]
   *         description: Filter by commission type (optional)
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter from date (optional)
   *              - in: query
       *         name: end_date
       *         schema:
       *           type: string
       *           format: date
       *         description: Filter to date (optional)
       *       - in: query
       *         name: package_id
       *         schema:
       *           type: integer
       *         description: Filter by package ID (optional)
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
   *           maximum: 1000
   *         description: Items per page (max 1000)
   *     responses:
   *       '200':
   *         description: Commissions retrieved successfully
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/commissions', {
    preHandler: adminAuth,
    schema: {
      description: 'Get all user commissions with filters',
      tags: ['Admin Commissions'],
      summary: 'Get All Commissions',
      querystring: {
        type: 'object',
        properties: {
          user_id: { type: 'string' }, // Receiver
          source_user_id: { type: 'string' }, // Source (from whom income came)
          commission_type: { 
            type: 'string', 
            enum: ['SELF', 'SPOT', 'MONTHLY', 'GLOBAL_HELPING'] 
          },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          package_id: { type: 'number' },
          status: { type: 'string', enum: ['credited', 'pending'] },
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 1000 },
        },
      },
      security: [{ adminAuth: [] }],
    },
    }, async (req, reply) => {
    try {
      const query = req.query as any;
      console.log(`[Admin Commissions] Request received. Query params:`, JSON.stringify(query));
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(1000, Math.max(1, parseInt(query.limit || '20', 10)));

      // Build where clause
      const where: any = {};
      
      // Handle package_id filter first (need to get purchase_ids for this package)
      let packagePurchaseIds: bigint[] | null = null;
      if (query.package_id) {
        const packageId = parseInt(query.package_id.toString(), 10);
        console.log(`[Admin Commissions] Filtering by package_id: ${packageId}`);
        const purchases = await prisma.purchases.findMany({
          where: { package_id: packageId },
          select: { id: true },
        });
        packagePurchaseIds = purchases.map(p => p.id);
        console.log(`[Admin Commissions] Found ${packagePurchaseIds.length} purchases for package_id ${packageId}`);
        if (packagePurchaseIds.length === 0) {
          // No purchases for this package, return empty result
          return reply.send({
            count: 0,
            page,
            limit,
            total_pages: 0,
            total: 0,
            items: [],
          });
        }
      }
      
      if (query.user_id) {
        // Check if user_id is a display_id (starts with SIA) or numeric ID
        let userId: bigint;
        const userIdStr = query.user_id.toString().trim();
        
        if (userIdStr.toUpperCase().startsWith('SIA')) {
          // It's a display_id, find the actual user ID
          // display_id is stored in uppercase format (SIA02047)
          const displayIdUpper = userIdStr.toUpperCase();
          console.log(`[Admin Commissions] Looking up user by display_id: ${displayIdUpper}`);
          const user = await prisma.users.findUnique({
            where: { display_id: displayIdUpper },
            select: { id: true },
          });
          if (!user) {
            console.log(`[Admin Commissions] User not found with display_id: ${displayIdUpper}`);
            // User not found, return empty result
            return reply.send({
              count: 0,
              page,
              limit,
              total_pages: 0,
              total: 0,
              items: [],
            });
          }
          console.log(`[Admin Commissions] Found user: display_id=${displayIdUpper}, id=${user.id}`);
          userId = user.id;
        } else {
          // It's a numeric ID, validate it's actually numeric before converting
          const numericMatch = userIdStr.match(/^\d+$/);
          if (!numericMatch) {
            // Not a valid numeric ID and not a display_id, return empty result
            console.log(`[Admin Commissions] Invalid user_id format: ${userIdStr}`);
            return reply.send({
              count: 0,
              page,
              limit,
              total_pages: 0,
              total: 0,
              items: [],
            });
          }
          // It's a valid numeric ID, use it directly
          userId = BigInt(userIdStr);
        }
        where.receiver_user_id = userId;
        console.log(`[Admin Commissions] Filtering by receiver_user_id: ${userId}`);
      }
      
      // Optional filter by source_user_id (can be display_id or numeric ID)
      if (query.source_user_id) {
        let sourceId: bigint;
        const sourceIdStr = query.source_user_id.toString().trim();

        if (sourceIdStr.toUpperCase().startsWith('SIA')) {
          const displayIdUpper = sourceIdStr.toUpperCase();
          console.log(`[Admin Commissions] Looking up source user by display_id: ${displayIdUpper}`);
          const srcUser = await prisma.users.findUnique({
            where: { display_id: displayIdUpper },
            select: { id: true },
          });
          if (!srcUser) {
            console.log(`[Admin Commissions] Source user not found with display_id: ${displayIdUpper}`);
            return reply.send({
              count: 0,
              page,
              limit,
              total_pages: 0,
              total: 0,
              items: [],
            });
          }
          console.log(`[Admin Commissions] Found source user: display_id=${displayIdUpper}, id=${srcUser.id}`);
          sourceId = srcUser.id;
        } else {
          const numericMatch = sourceIdStr.match(/^\d+$/);
          if (!numericMatch) {
            console.log(`[Admin Commissions] Invalid source_user_id format: ${sourceIdStr}`);
            return reply.send({
              count: 0,
              page,
              limit,
              total_pages: 0,
              total: 0,
              items: [],
            });
          }
          sourceId = BigInt(sourceIdStr);
        }

        where.source_user_id = sourceId;
        console.log(`[Admin Commissions] Filtering by source_user_id: ${sourceId}`);
      }
      if (query.commission_type) {
        where.commission_type = query.commission_type;
        console.log(`[Admin Commissions] Filtering by commission_type: ${query.commission_type}`);
      }
      if (query.start_date || query.end_date) {
        where.credited_at = {};
        if (query.start_date) {
          // Create date at start of day in UTC (00:00:00.000 UTC)
          // This ensures we get all records from the start of the selected date regardless of timezone
          const startDateStr = query.start_date.toString();
          // Parse YYYY-MM-DD and create UTC date at start of day
          const [year, month, day] = startDateStr.split('-').map(Number);
          const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
          where.credited_at.gte = startDate;
          console.log(`[Admin Commissions] Date filter - start_date: ${startDateStr} -> ${startDate.toISOString()} (UTC)`);
        }
        if (query.end_date) {
          // Create date at end of day in UTC (23:59:59.999 UTC)
          // This ensures we get all records until the end of the selected date
          const endDateStr = query.end_date.toString();
          const [year, month, day] = endDateStr.split('-').map(Number);
          const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
          where.credited_at.lte = endDate;
          console.log(`[Admin Commissions] Date filter - end_date: ${endDateStr} -> ${endDate.toISOString()} (UTC)`);
        }
      }
      
      // Apply package_id filter through purchase_ids
      if (packagePurchaseIds) {
        where.purchase_id = { in: packagePurchaseIds };
        console.log(`[Admin Commissions] Filtering by purchase_ids: ${packagePurchaseIds.length} purchases`);
      }
      
      // Handle status filter
      // credited = from ledger_entries (all entries in ledger are credited)
      // pending = from pending_commissions table (SPOT only)
      const statusFilter = query.status;
      let shouldQueryPending = false;
      let shouldQueryLedger = true;
      
      if (statusFilter === 'credited') {
        // Only ledger entries
        shouldQueryPending = false;
        shouldQueryLedger = true;
        console.log(`[Admin Commissions] Filtering by status: credited (ledger_entries only)`);
      } else if (statusFilter === 'pending') {
        // Only pending commissions (SPOT only, enforced below)
        shouldQueryPending = true;
        shouldQueryLedger = false;
        console.log(`[Admin Commissions] Filtering by status: pending (pending_commissions table)`);
      } else {
        // No explicit status filter - by default consider both sources
        shouldQueryPending = true;
        shouldQueryLedger = true;
        console.log(`[Admin Commissions] No status filter - querying both ledger and pending commissions where applicable`);
      }

      // Pending commissions table is ONLY used for SPOT type.
      // For SELF / MONTHLY / GLOBAL_HELPING we must NOT query or merge pending_commissions,
      // otherwise pagination will break (we'd always slice over a fixed in‑memory window).
      if (query.commission_type && query.commission_type !== 'SPOT') {
        shouldQueryPending = false;
        shouldQueryLedger = true;
        console.log(`[Admin Commissions] Skipping pending_commissions for non-SPOT type: ${query.commission_type}`);
      }
      
      // Log final where clause AFTER all filters are set
      console.log(`[Admin Commissions] Final where clause:`, JSON.stringify(where, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      ));

      // Query ledger entries if needed
      let ledgerEntries: any[] = [];
      let ledgerTotal = 0;
      if (shouldQueryLedger) {
        ledgerTotal = await prisma.ledger_entries.count({ where });
        ledgerEntries = await prisma.ledger_entries.findMany({
          where,
          orderBy: { credited_at: 'desc' },
          skip: shouldQueryPending ? 0 : (page - 1) * limit, // Only paginate if not merging with pending
          take: shouldQueryPending ? 1000 : limit, // Get all if merging (we'll paginate after merge)
        });
      }

      // Query pending commissions if needed (only for SPOT type)
      let pendingCommissions: any[] = [];
      let pendingTotal = 0;
      if (shouldQueryPending && query.commission_type === 'SPOT') {
        const pendingWhere: any = {};
        if (where.receiver_user_id) {
          pendingWhere.receiver_user_id = where.receiver_user_id;
        }
        if (where.source_user_id) {
          pendingWhere.source_user_id = where.source_user_id;
        }
        if (query.commission_type) {
          pendingWhere.commission_type = query.commission_type;
        }
        
        // Apply date filter to pending_commissions using created_at (pending commissions don't have credited_at)
        if (query.start_date || query.end_date) {
          pendingWhere.created_at = {};
          if (query.start_date) {
            const startDateStr = query.start_date.toString();
            const [year, month, day] = startDateStr.split('-').map(Number);
            const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            pendingWhere.created_at.gte = startDate;
            console.log(`[Admin Commissions] Pending commissions date filter - start_date: ${startDateStr} -> ${startDate.toISOString()} (UTC)`);
          }
          if (query.end_date) {
            const endDateStr = query.end_date.toString();
            const [year, month, day] = endDateStr.split('-').map(Number);
            const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            pendingWhere.created_at.lte = endDate;
            console.log(`[Admin Commissions] Pending commissions date filter - end_date: ${endDateStr} -> ${endDate.toISOString()} (UTC)`);
          }
        }
        
        pendingTotal = await prisma.pending_commissions.count({ where: pendingWhere });
        pendingCommissions = await prisma.pending_commissions.findMany({
          where: pendingWhere,
          orderBy: { created_at: 'desc' },
          skip: shouldQueryLedger ? 0 : (page - 1) * limit, // Only paginate if not merging with ledger
          take: shouldQueryLedger ? 1000 : limit, // Get all if merging (we'll paginate after merge)
        });
      }

      // Merge and sort entries (ledger first, then pending)
      const allEntries = [...ledgerEntries, ...pendingCommissions].sort((a, b) => {
        const dateA = a.credited_at || a.created_at;
        const dateB = b.credited_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      // Apply pagination after merge if both sources were queried
      const total = ledgerTotal + pendingTotal;
      const entries = shouldQueryLedger && shouldQueryPending
        ? allEntries.slice((page - 1) * limit, page * limit)
        : allEntries;
      
      console.log(`[Admin Commissions] Found ${ledgerEntries.length} ledger entries and ${pendingCommissions.length} pending commissions`);
      console.log(`[Admin Commissions] Total merged: ${allEntries.length}, Paginated: ${entries.length}`);
      if (entries.length > 0) {
        console.log(`[Admin Commissions] First entry receiver_user_id: ${entries[0].receiver_user_id.toString()}`);
        if (where.receiver_user_id && entries[0].receiver_user_id !== where.receiver_user_id) {
          console.error(`[Admin Commissions] ERROR: Filter mismatch! Expected ${where.receiver_user_id}, got ${entries[0].receiver_user_id}`);
        }
      }

      // Batch fetch all unique user IDs, purchase IDs, and source user IDs
      const userIds = new Set<bigint>();
      const purchaseIds = new Set<bigint>();
      const sourceUserIds = new Set<bigint>();
      
      entries.forEach(entry => {
        userIds.add(entry.receiver_user_id);
        if (entry.source_user_id) {
          sourceUserIds.add(entry.source_user_id);
        }
        if (entry.purchase_id) {
          purchaseIds.add(entry.purchase_id);
        }
      });
      
      // For GLOBAL_HELPING, we also need to get source users from purchases
      // (the user who made the purchase is the actual source for direct income)

      // Batch fetch users and purchases first
      const [users, purchases] = await Promise.all([
        prisma.users.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true, display_id: true },
        }),
        prisma.purchases.findMany({
          where: { id: { in: Array.from(purchaseIds) } },
          select: {
            id: true,
            user_id: true,
            package_id: true,
            amount: true,
            income: true, // CURRENT total income for 2x progress (always up-to-date)
            is_renewal: true,
            purchased_at: true,
          },
        }),
      ]);

      // Get unique package IDs from purchases
      const packageIds = [...new Set(purchases.map(p => p.package_id))];
      
      // Batch fetch packages
      const packages = packageIds.length > 0
        ? await prisma.packages.findMany({
            where: { id: { in: packageIds } },
            select: { id: true, name: true, price: true },
          })
        : [];

      // Create lookup maps for O(1) access
      const userMap = new Map(users.map(u => [u.id.toString(), u.name]));
      const userDisplayIdMap = new Map(users.map(u => [u.id.toString(), u.display_id || null]));
      const purchaseMap = new Map(purchases.map(p => [p.id.toString(), p]));
      const packageMap = new Map(packages.map(p => [p.id, p]));

      // Get source users if needed
      // For GLOBAL_HELPING, also add purchase user_ids as potential sources (the user who made the purchase)
      purchases.forEach(p => {
        if (p.user_id) {
          sourceUserIds.add(p.user_id);
        }
      });
      
      const sourceUsers = sourceUserIds.size > 0
        ? await prisma.users.findMany({
            where: { id: { in: Array.from(sourceUserIds) } },
            select: { id: true, name: true, display_id: true },
          })
        : [];
      const sourceUserMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));
      const sourceUserDisplayIdMap = new Map(sourceUsers.map(u => [u.id.toString(), u.display_id || null]));

      // Process each entry to add type-specific fields
      const items = await Promise.all(entries.map(async (entry) => {
        // Verify the entry matches the filter
        if (where.receiver_user_id && entry.receiver_user_id !== where.receiver_user_id) {
          console.error(`[Admin Commissions] ERROR: Entry receiver_user_id ${entry.receiver_user_id} does not match filter ${where.receiver_user_id}`);
        }
        
        // Check if this is a pending commission (from pending_commissions table)
        const isPending = !entry.credited_at && entry.created_at;
        
        const baseData: any = {
          id: entry.id.toString(),
          user_id: entry.receiver_user_id.toString(),
          user_display_id: userDisplayIdMap.get(entry.receiver_user_id.toString()) || null,
          commission_type: entry.commission_type || 'SPOT', // pending_commissions may have null commission_type
          income_amount: Number(entry.amount),
          created_at: entry.credited_at || entry.created_at, // Use credited_at for ledger, created_at for pending
        };

        // Get user name from map
        baseData.user_name = userMap.get(entry.receiver_user_id.toString()) || null;

        // Get source user name from map
        if (entry.source_user_id) {
          baseData.from_name = sourceUserMap.get(entry.source_user_id.toString()) || null;
        }

        // Get purchase details from map (always current/latest data)
        let purchase: any = null;
        let pkg: any = null;
        if (entry.purchase_id) {
          purchase = purchaseMap.get(entry.purchase_id.toString());
          if (purchase) {
            pkg = packageMap.get(purchase.package_id);
          }
        }

        // Get activation request ID (from purchase_requests)
        let activationReqId = null;
        if (entry.purchase_id) {
          const purchaseReq = await prisma.purchase_requests.findFirst({
            where: {
              status: 'approved',
            },
            orderBy: { processed_at: 'desc' },
            select: { id: true },
          });
          activationReqId = purchaseReq?.id.toString() || null;
        }
        
        // Get level/depth information if source exists
        // Always calculate from user_tree_paths to ensure consistency (even for pending commissions)
        // This ensures we use actual tree depth, not stored level which might be incorrect
        let depth = 0;
        let businessLevel = null;
        if (entry.source_user_id && entry.receiver_user_id) {
          const path = await prisma.user_tree_paths.findUnique({
            where: {
              ancestor_id_descendant_id: {
                ancestor_id: entry.receiver_user_id,
                descendant_id: entry.source_user_id,
              },
            },
            select: { depth: true },
          });
          depth = path?.depth || 0;
        } else if (isPending) {
          // Fallback: if no path found, use stored level (but this should rarely happen)
          // Note: entry.level in pending_commissions is business level (0-based), so convert to depth
          depth = (entry.level || 0) + 1; // business level + 1 = depth
        }
        // Business level mapping: depth 1 = Level 0 (direct), depth 2 = Level 1, etc.
        businessLevel = depth > 0 ? Math.max(0, depth - 1) : null;

        // Format based on commission type
        if (entry.commission_type === 'SELF') {
          const packageAmount = purchase ? Number(purchase.amount) : null;
          const packageIncome = purchase ? Number(purchase.income || 0) : null;
          const target2x = packageAmount != null ? packageAmount * 2 : null;
          const progress2x =
            target2x && packageIncome != null && target2x > 0
              ? Math.min(1, packageIncome / target2x)
              : null;
          
          // Debug log for package progress
          if (purchase && entry.purchase_id) {
            console.log(`[Admin Commissions] Purchase ${entry.purchase_id}: amount=${packageAmount}, income=${packageIncome}, progress=${progress2x}`);
          }

          return {
            ...baseData,
            package_id: purchase?.package_id || null,
            package_name: pkg?.name || null,
            package_amount: packageAmount,
            package_income: packageIncome,
            package_target_2x: target2x,
            package_progress_2x: progress2x,
            activation_req_id: activationReqId,
          };
        } else if (entry.commission_type === 'SPOT' || isPending) {
          // For SPOT: source is the user who made the purchase (from whom income came)
          const sourceDisplayId = entry.source_user_id ? sourceUserDisplayIdMap.get(entry.source_user_id.toString()) || null : null;
          
          // Use business level calculated from actual tree depth (consistent for both pending and ledger)
          // This ensures all entries show correct level based on actual tree structure
          const spotLevel = businessLevel;
          
          // spot_added logic:
          // - If from pending_commissions (isPending=true): always 'pending'
          // - If from ledger_entries (isPending=false): always 'credited' (because it's in ledger)
          const spotAdded = isPending ? 'pending' : 'credited'; // Return as string for UI consistency
          
          return {
            ...baseData,
            income_lvl: spotLevel,
            from_id: entry.source_user_id?.toString() || null,
            from_display_id: sourceDisplayId, // Source user display ID
            investment_amt: purchase ? Number(purchase.amount) : null,
            investment_type: purchase?.is_renewal ? 'reinvestment' : 'activation',
            spot_added: spotAdded, // 'credited' for ledger, 'pending' for pending_commissions
            status: spotAdded, // Also add status field for UI consistency
            activation_req_id: activationReqId,
            package_id: purchase?.package_id || null,
            package_name: pkg?.name || null,
          };
        } else if (entry.commission_type === 'MONTHLY') {
          return {
            ...baseData,
            members: entry.source_user_id?.toString() || null,
            from_display_id: entry.source_user_id ? sourceUserDisplayIdMap.get(entry.source_user_id.toString()) || null : null,
            from_name: entry.source_user_id ? sourceUserMap.get(entry.source_user_id.toString()) || null : null,
            income_lvl: businessLevel, // Business level: depth 1 = Level 0, depth 2 = Level 1, etc.
            activation_req_id: activationReqId,
          };
        } else { // GLOBAL_HELPING (Direct Income)
          // For Direct Income: receiver gets income from someone else's purchase
          // Source MUST be different from receiver - it's the user who made the purchase
          const receiverUserIdStr = entry.receiver_user_id.toString();
          let actualSourceUserId: string | null = null;
          
          // For Direct Income, source is ALWAYS the user who made the purchase
          // Use purchase.user_id as the source (the buyer)
          if (purchase?.user_id) {
            const purchaseUserIdStr = purchase.user_id.toString();
            // For Direct Income, purchase.user_id should be different from receiver
            // But if they're same, it means receiver bought their own package (not direct income)
            // In that case, we should still show purchase.user_id as source for consistency
            actualSourceUserId = purchaseUserIdStr;
          } else {
            // No purchase_id - use entry.source_user_id as fallback
            // But for Direct Income, there should always be a purchase
            actualSourceUserId = entry.source_user_id?.toString() || null;
          }
          
          const actualSourceDisplayId = actualSourceUserId ? sourceUserDisplayIdMap.get(actualSourceUserId) || null : null;
          
          // Warn if source and receiver are same (shouldn't happen for true Direct Income)
          if (actualSourceUserId === receiverUserIdStr) {
            console.warn(`[Admin Commissions] GLOBAL_HELPING: Source and Receiver are same! This might be self-purchase, not direct income.`, {
              entry_id: entry.id.toString(),
              receiver_user_id: receiverUserIdStr,
              purchase_id: entry.purchase_id?.toString(),
              purchase_user_id: purchase?.user_id?.toString(),
              entry_source_user_id: entry.source_user_id?.toString(),
              actualSourceUserId,
            });
          }
          
          return {
            ...baseData,
            direct: depth === 1,
            package_id: purchase?.package_id || null,
            package_name: pkg?.name || null,
            members: actualSourceUserId, // Source user ID (who made the purchase)
            from_display_id: actualSourceDisplayId, // Source user display ID
          };
        }
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting all commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

