import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { boss } from '../config/pgboss.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { addMonths } from '../utils/dateUtils.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';
import { resetSpotTeamWithdrawUsed } from '../utils/spotTeamWithdrawLimit.js';
import { getMinReinvestmentAmount, getMinReinvestmentMessage } from '../utils/reinvestmentMinAmount.js';

/**
 * Get user's previous purchases with package names and status
 */
async function getPreviousPurchases(userId: bigint) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const purchases = await prisma.purchases.findMany({
    where: {
      user_id: userId,
      status: 'completed',
    },
    orderBy: { purchased_at: 'desc' },
    select: {
      id: true,
      package_id: true,
      amount: true,
      purchased_at: true,
      // active_until removed - expiry is ONLY based on 2x income
    },
  });

  const purchasesWithDetails = await Promise.all(
    purchases.map(async (purchase) => {
      const pkg = await prisma.packages.findUnique({
        where: { id: purchase.package_id },
        select: { id: true, name: true, price: true },
      });

      // Expiry is based on 2x income (self + global), NOT active_until date
      const is2xReached = await CommissionService.isPurchaseDoubleReached(
        purchase.id as unknown as bigint
      );

      let status = 'active';
      if (is2xReached) {
        status = '2x_reached'; // Package expired (reached 2x income)
      }

      return {
        id: purchase.id.toString(),
        package_id: purchase.package_id,
        package_name: pkg?.name || 'Unknown',
        package_price: pkg ? Number(pkg.price) : 0,
        purchased_at: purchase.purchased_at,
        // active_until removed - expiry is ONLY based on 2x income
        amount: Number(purchase.amount),
        status,
        is_2x_reached: is2xReached,
      };
    })
  );

  return purchasesWithDetails;
}

/**
 * Format request response with all required fields
 */
async function formatRequestResponse(request: any) {
  const [user, userProfile, pkg] = await Promise.all([
    prisma.users.findUnique({
      where: { id: request.user_id },
      select: { id: true, name: true, email: true, display_id: true },
    }),
    prisma.user_profiles.findUnique({
      where: { user_id: request.user_id },
      select: { phone: true },
    }),
    prisma.packages.findUnique({
      where: { id: request.package_id },
      select: { id: true, name: true, price: true },
    }),
  ]);

  // Fetch previous_purchases only for renew/reinvestment (for expired-package display).
  // For activation, send [] so first-purchase requests show "New Purchase (Manual)" correctly.
  const previousPurchases =
    request.request_type === 'renew' || request.request_type === 'reinvestment'
      ? await getPreviousPurchases(request.user_id)
      : [];

  const userPhone = userProfile?.phone || null;

  return {
    id: request.id.toString(),
    user_id: request.user_id.toString(),
    user_display_id: user?.display_id || null,
    user_name: user?.name || null,
    user_email: user?.email || null,
    user_phone: userPhone,
    package_id: request.package_id,
    previous_package_id: request.previous_package_id, // For renewals: expired package's package_id
    package_name: pkg?.name || null,
    package_price: pkg ? Number(pkg.price) : null,
    request_type: request.request_type,
    amount: Number(request.amount),
    status: request.status,
    txn_id: request.txn_id,
    payment_proof_url: request.payment_proof_url,
    payment_type: request.payment_type,
    remarks: request.remarks,
    rejection_reason: request.rejection_reason,
    processed_at: request.processed_at,
    processed_by: request.processed_by?.toString() || null,
    previous_purchases: previousPurchases,
    created_at: request.created_at,
    updated_at: request.updated_at,
  };
}

export async function adminPurchaseRequestsRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/activation/requests
   * List all purchase requests with filters
   */
  app.get(
    '/activation/requests',
    {
      preHandler: [adminAuth, checkPermission('ACTIVATION_REQUEST_VIEW')],
      schema: {
        description: 'List all purchase requests with filters',
        tags: ['Admin Purchase Requests'],
        summary: 'List Purchase Requests',
          querystring: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['pending', 'approved', 'rejected'],
              },
              request_type: {
                type: 'string',
                enum: ['activation', 'renew', 'reinvestment'],
              },
              user_id: { type: 'string' },
              display_id: { type: 'string' },
              name: { type: 'string' },
              from_date: { type: 'string', format: 'date-time' },
              to_date: { type: 'string', format: 'date-time' },
              page: { type: 'number', default: 1, minimum: 1 },
              limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
            },
          },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                // Allow dynamic properties so we don't strip fields from
                // formatRequestResponse. If we leave properties empty,
                // fast-json-stringify will return {} for each item.
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  total_pages: { type: 'number' },
                },
              },
            },
          },
        },
        security: [{ adminAuth: [] }],
      },
    },
    async (req, reply) => {
      try {
        const query = req.query as any;
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (query.status) {
          where.status = query.status;
        }

        if (query.request_type) {
          where.request_type = query.request_type;
        }

        // Handle user_id, display_id, and name filters
        if (query.user_id || query.display_id || query.name) {
          const userWhere: any = {};
          if (query.display_id) {
            const displayIdStr = query.display_id.trim();
            userWhere.display_id = { 
              contains: displayIdStr, 
              mode: 'insensitive' 
            };
          } else if (query.user_id) {
            userWhere.id = BigInt(query.user_id);
          }
          if (query.name) {
            userWhere.name = { contains: query.name, mode: 'insensitive' };
          }
          const matchingUsers = await prisma.users.findMany({
            where: userWhere,
            select: { id: true },
          });
          if (matchingUsers.length === 0) {
            // No users match, return empty result
            return reply.send({
              items: [],
              pagination: {
                page,
                limit,
                total: 0,
                total_pages: 0,
              },
            });
          }
          where.user_id = { in: matchingUsers.map(u => u.id) };
        }

        if (query.from_date || query.to_date) {
          where.created_at = {};
          if (query.from_date) {
            where.created_at.gte = new Date(query.from_date);
          }
          if (query.to_date) {
            where.created_at.lte = new Date(query.to_date);
          }
        }

        const [requests, total] = await Promise.all([
          prisma.purchase_requests.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
          }),
          prisma.purchase_requests.count({ where }),
        ]);

        const items = await Promise.all(
          requests.map(async (req) => {
            try {
              return await formatRequestResponse(req);
            } catch (itemError: any) {
              console.error(`Error formatting request ${req.id}:`, itemError);
              console.error('Request data:', {
                id: req.id.toString(),
                user_id: req.user_id.toString(),
                package_id: req.package_id,
                request_type: req.request_type,
              });
              // Return a minimal response for this item instead of failing entire request
              // Try to get user display_id for minimal response
              const user = await prisma.users.findUnique({
                where: { id: req.user_id },
                select: { display_id: true },
              });
              return {
                id: req.id.toString(),
                user_id: req.user_id.toString(),
                user_display_id: user?.display_id || null,
                user_name: null,
                user_email: null,
                user_phone: null,
                package_id: req.package_id,
                previous_package_id: req.previous_package_id,
                package_name: null,
                package_price: null,
                request_type: req.request_type,
                amount: Number(req.amount),
                status: req.status,
                txn_id: req.txn_id,
                payment_proof_url: req.payment_proof_url,
                payment_type: req.payment_type,
                remarks: req.remarks,
                rejection_reason: req.rejection_reason,
                processed_at: req.processed_at,
                processed_by: req.processed_by?.toString() || null,
                previous_purchases: [],
                created_at: req.created_at,
                updated_at: req.updated_at,
              };
            }
          })
        );

        return reply.send({
          items,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
          },
        });
      } catch (error: any) {
        console.error('Error listing purchase requests:', error);
        console.error('Error stack:', error?.stack);
        console.error('Error message:', error?.message);
        return reply.code(500).send({ 
          error: 'Internal server error',
          message: error?.message || 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/admin/activation/requests/:id
   * Get detailed request information
   */
  app.get(
    '/activation/requests/:id',
    {
      preHandler: [adminAuth, checkPermission('ACTIVATION_REQUEST_VIEW')],
      schema: {
        description: 'Get detailed purchase request information',
        tags: ['Admin Purchase Requests'],
        summary: 'Get Purchase Request',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            // Same reason as list endpoint: we return a rich object from
            // formatRequestResponse, so allow arbitrary properties.
            type: 'object',
            additionalProperties: true,
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
    },
    async (req, reply) => {
      try {
        const requestId = BigInt((req.params as any).id);

        const request = await prisma.purchase_requests.findUnique({
          where: { id: requestId },
        });

        if (!request) {
          return reply.code(404).send({ error: 'Request not found' });
        }

        const formatted = await formatRequestResponse(request);

        return reply.send(formatted);
      } catch (error) {
        console.error('Error getting purchase request:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /api/v1/admin/activation/requests/:id/approve
   * Approve request and create purchase
   */
  app.post(
    '/activation/requests/:id/approve',
    {
      preHandler: [adminAuth, checkPermission('ACTIVATION_REQUEST_APPROVE')],
      schema: {
        description: 'Approve purchase request and create purchase',
        tags: ['Admin Purchase Requests'],
        summary: 'Approve Purchase Request',
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
              purchase: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  package_id: { type: 'number' },
                  amount: { type: 'number' },
                },
              },
              request: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
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
    },
    async (req, reply) => {
      try {
        const requestId = BigInt((req.params as any).id);
        const admin = (req as any).admin;

        const request = await prisma.purchase_requests.findUnique({
          where: { id: requestId },
        });

        if (!request) {
          return reply.code(404).send({ error: 'Request not found' });
        }

        if (request.status !== 'pending') {
          return reply.code(400).send({
            error: 'invalid_status',
            message: `Request is already ${request.status}. Cannot approve.`,
          });
        }

        // Get package details
        const pkg = await prisma.packages.findUnique({
          where: { id: request.package_id },
        });

        if (!pkg) {
          return reply.code(400).send({ error: 'Invalid package' });
        }

        // Reinvestment min amount: 2× last Main withdrawal OR 50% of current package (if never withdrew from Main)
        if (request.request_type === 'reinvestment') {
          const minReinvest = await getMinReinvestmentAmount(request.user_id);
          const requestAmount = Number(request.amount);
          if (minReinvest.minAmount > 0 && requestAmount < minReinvest.minAmount) {
            return reply.code(400).send({
              error: 'reinvestment_min_amount',
              message: getMinReinvestmentMessage(minReinvest),
            });
          }
        }

        // Handle renewal: UPDATE existing purchase instead of creating new one
        let purchase;
        
        if (request.request_type === 'renew') {
          // Determine if this is an upgrade or same package renewal
          // previous_package_id = expired package's package_id
          // package_id = new package_id (same or upgraded)
          // IMPORTANT: previous_package_id can be null for old requests, so we need to handle it
          const requestWithPrevious = request as any;
          const previousPackageId = requestWithPrevious.previous_package_id || request.package_id;
          const previousPurchaseId = requestWithPrevious.previous_purchase_id
            ? BigInt(requestWithPrevious.previous_purchase_id)
            : null;
          // isUpgrade = true if previous_package_id exists AND is different from package_id
          const isUpgrade = requestWithPrevious.previous_package_id && requestWithPrevious.previous_package_id !== request.package_id;
          
          console.log(`🔄 Renewal request details:`, {
            request_id: requestId.toString(),
            user_id: request.user_id.toString(),
            package_id: request.package_id,
            previous_package_id: requestWithPrevious.previous_package_id,
            previous_purchase_id: previousPurchaseId ? previousPurchaseId.toString() : null,
            calculated_previous_package_id: previousPackageId,
            is_upgrade: isUpgrade,
          });

          // Find expired purchase using exact previous_purchase_id (PREFERRED) or smart fallback (if no ambiguity)
          // SMART FALLBACK: Only use if user has exactly ONE expired package of that type (no ambiguity)
          // If multiple expired packages exist, previous_purchase_id is MANDATORY to avoid selecting wrong one
          console.log(`🔍 Searching for expired purchase:`, {
            user_id: request.user_id.toString(),
            previous_package_id: previousPackageId,
            previous_purchase_id: previousPurchaseId ? previousPurchaseId.toString() : null,
            is_upgrade: isUpgrade,
          });
          
          let expiredPurchase;
          
          if (previousPurchaseId) {
            // BEST CASE: Use exact previous_purchase_id if provided (no ambiguity)
            expiredPurchase = await prisma.purchases.findUnique({
              where: { id: previousPurchaseId },
            });
            
            if (!expiredPurchase) {
              return reply.code(400).send({
                error: 'Invalid previous_purchase_id',
                message: 'Expired purchase not found with the provided previous_purchase_id.',
                details: {
                  previous_purchase_id: previousPurchaseId.toString(),
                  user_id: request.user_id.toString(),
                },
              });
            }
            
            console.log(`✅ Using exact previous_purchase_id: ${expiredPurchase.id.toString()}`);
          } else if (previousPackageId) {
            // FALLBACK: Find expired packages for this package_id (only if no ambiguity)
            // This handles old requests created before frontend was updated to send previous_purchase_id
            const expiredPurchases = await prisma.purchases.findMany({
              where: {
                user_id: request.user_id,
                package_id: previousPackageId,
                status: 'completed',
              },
              orderBy: { purchased_at: 'desc' },
            });
            
            // Filter to only expired packages (2x reached)
            const trulyExpiredPurchases = expiredPurchases.filter(purchase => {
              const is2xReached = Number(purchase.income || 0) >= Number(purchase.amount) * 2;
              return is2xReached;
            });
            
            console.log(`🔍 Fallback search: Found ${trulyExpiredPurchases.length} expired package(s) for package_id ${previousPackageId}`);
            
            // CRITICAL: Only allow fallback if exactly ONE expired package exists (no ambiguity)
            if (trulyExpiredPurchases.length === 0) {
              return reply.code(400).send({
                error: 'previous_purchase_id_required',
                message: 'previous_purchase_id is required. No expired packages found for this package_id.',
                details: {
                  user_id: request.user_id.toString(),
                  previous_package_id: previousPackageId,
                  expired_packages_found: 0,
                },
              });
            } else if (trulyExpiredPurchases.length > 1) {
              // AMBIGUITY RISK: Multiple expired packages - cannot use fallback
              return reply.code(400).send({
                error: 'previous_purchase_id_required',
                message: 'previous_purchase_id is MANDATORY. User has multiple expired packages with same package_id. Cannot determine which one to renew without exact previous_purchase_id.',
                details: {
                  user_id: request.user_id.toString(),
                  previous_package_id: previousPackageId,
                  expired_packages_found: trulyExpiredPurchases.length,
                  expired_purchase_ids: trulyExpiredPurchases.map(p => p.id.toString()),
                  reason: 'Ambiguity risk: Multiple expired packages exist. Exact purchase_id required to identify which specific purchase to renew.',
                },
              });
            } else {
              // SAFE: Exactly one expired package - can use fallback
              expiredPurchase = trulyExpiredPurchases[0];
              console.log(`✅ Fallback: Using single expired package (no ambiguity): ${expiredPurchase.id.toString()}`);
            }
          } else {
            // Neither previous_purchase_id nor previous_package_id provided
            return reply.code(400).send({
              error: 'previous_purchase_id_required',
              message: 'previous_purchase_id is required for renewal/upgrade requests. Please ensure the request includes previous_purchase_id or previous_package_id.',
              details: {
                user_id: request.user_id.toString(),
                reason: 'Neither previous_purchase_id nor previous_package_id provided in request.',
              },
            });
          }
          
          // Validate: purchase belongs to same user
          if (expiredPurchase.user_id.toString() !== request.user_id.toString()) {
            return reply.code(400).send({
              error: 'Invalid previous_purchase_id',
              message: 'The provided previous_purchase_id does not belong to this user.',
            });
          }
          
          // Validate: purchase is expired (2x reached)
          const is2xReached = Number(expiredPurchase.income || 0) >= Number(expiredPurchase.amount) * 2;
          if (!is2xReached) {
            return reply.code(400).send({
              error: 'Invalid previous_purchase_id',
              message: 'The provided previous_purchase_id is not expired (2x income not reached).',
            });
          }
          
          // Use the purchase ID
          const actualPreviousPurchaseId = expiredPurchase.id;

          // Validate: purchase belongs to same user
          if (expiredPurchase.user_id.toString() !== request.user_id.toString()) {
            return reply.code(400).send({
              error: 'Invalid previous_purchase_id',
              message: 'The provided previous_purchase_id does not belong to this user.',
            });
          }

          // CRITICAL: Validate renewal window (backend enforcement)
          // Renewal is allowed within 65 days of last income (extended from 30 days for all users)
          // IMPORTANT: Use request.created_at (when user submitted request) instead of approval time
          // This ensures fairness: if user submitted request within window, admin can approve later (even days/weeks later)
          
          // Get the last income date from commission service (uses SAME logic as API's renewal_deadline)
          const lastIncomeDate = await CommissionService.getLastIncomeDate(actualPreviousPurchaseId, request.user_id);
          
          if (!lastIncomeDate) {
            return reply.code(400).send({
              error: 'renewal_window_expired',
              message: '❌ Cannot determine last income date for this purchase. Renewal window validation failed.',
              details: {
                purchase_id: actualPreviousPurchaseId.toString(),
                user_id: request.user_id.toString(),
              },
            });
          }

          // Use request creation time, not approval time - user submitted request when countdown was active
          const requestCreatedAt = new Date(request.created_at);
          
          // Calculate renewal deadline: last income + 65 days (extended for all users)
          // IMPORTANT: Use UTC dates to avoid timezone issues
          const lastIncomeDateUTC = new Date(Date.UTC(
            lastIncomeDate.getUTCFullYear(),
            lastIncomeDate.getUTCMonth(),
            lastIncomeDate.getUTCDate()
          ));
          
          // Deadline is last income date + 65 days, end of day UTC (extended from 30 days)
          const renewalDeadline = new Date(lastIncomeDateUTC);
          renewalDeadline.setUTCDate(renewalDeadline.getUTCDate() + 65); // Extended to 65 days for all users
          renewalDeadline.setUTCHours(23, 59, 59, 999); // End of deadline day UTC

          // Normalize request created date to start of day UTC for fair comparison
          const requestCreatedAtStart = new Date(Date.UTC(
            requestCreatedAt.getUTCFullYear(),
            requestCreatedAt.getUTCMonth(),
            requestCreatedAt.getUTCDate()
          ));

          console.log(`📅 Renewal window check for expired purchase ${actualPreviousPurchaseId.toString()}:`, {
            last_income_date: lastIncomeDate.toISOString(),
            request_created_at: requestCreatedAt.toISOString(),
            request_created_at_normalized: requestCreatedAtStart.toISOString(),
            renewal_deadline: renewalDeadline.toISOString(),
            renewal_window_days: 65, // Extended deadline for all users
            approval_time: new Date().toISOString(),
            is_within_window: requestCreatedAtStart <= renewalDeadline,
            days_between_last_income_and_request: Math.floor((requestCreatedAtStart.getTime() - lastIncomeDate.getTime()) / (1000 * 60 * 60 * 24)),
            days_since_request: Math.floor((new Date().getTime() - requestCreatedAt.getTime()) / (1000 * 60 * 60 * 24)),
          });

          // Check: Request must be created BEFORE or ON the renewal deadline (last income + 65 days)
          // IMPORTANT: This validation uses request.created_at (when user submitted), NOT approval time
          // This ensures fairness: If user submitted request within window, admin can approve anytime later
          // Example: User submits request 1 hour before deadline → Admin can approve 5 days later → Still valid
          // Compare normalized dates to avoid time-of-day issues
          // Extended deadline: 65 days for all users (was 30 days)
          
          // Calculate time difference in milliseconds
          const timeDiffMs = requestCreatedAtStart.getTime() - renewalDeadline.getTime();
          const hoursAfterDeadline = timeDiffMs / (1000 * 60 * 60);
          
          if (requestCreatedAtStart > renewalDeadline) {
            // Request was created AFTER deadline
            return reply.code(400).send({
              error: 'renewal_window_expired',
              message: '❌ Renewal window closed! This package can only be renewed within 65 days of last income. The renewal period had already expired when the request was created.',
              details: {
                last_income_date: lastIncomeDate.toISOString(),
                request_created_at: requestCreatedAt.toISOString(),
                request_created_at_normalized: requestCreatedAtStart.toISOString(),
                renewal_deadline: renewalDeadline.toISOString(),
                approval_time: new Date().toISOString(),
                days_since_last_income: Math.floor((requestCreatedAtStart.getTime() - lastIncomeDate.getTime()) / (1000 * 60 * 60 * 24)),
                hours_after_deadline: Math.round(hoursAfterDeadline * 100) / 100,
                renewal_window_days: 65,
                note: 'This validation checks request creation time, not approval time. Admin can approve anytime if user submitted request within window.',
              },
            });
          }
          
          // Log successful validation (request was created within window)
          const hoursBeforeDeadline = Math.abs(timeDiffMs) / (1000 * 60 * 60);
          console.log(`✅ Renewal window validation PASSED:`, {
            request_created_within_window: true,
            hours_before_deadline_when_requested: Math.round(hoursBeforeDeadline * 100) / 100,
            admin_can_approve_anytime: true,
            note: 'User submitted request within window. Admin can approve anytime, even days/weeks later.',
          });

          console.log(`✅ Found expired purchase: ${expiredPurchase.id.toString()} (${previousPurchaseId ? 'from previous_purchase_id' : 'from previous_package_id'})`);

          if (isUpgrade) {
            // UPGRADE: Create NEW purchase with carry-forward IDs
            console.log(`🔄 Upgrade: Creating new purchase for upgrade from package ${previousPackageId} to ${request.package_id}`);
            
            // Get used IDs from expired purchase
            // For expired packages, we need to calculate used_ids from actual global users count
            // Count unique users who joined AFTER the expired purchase was made
            const expiredPurchaseDate = expiredPurchase.purchased_at;
            const expiredPkg = await prisma.packages.findUnique({
              where: { id: previousPackageId },
              select: { global_ids: true },
            });
            
            // Count global users who joined after expired purchase
            // This gives us the actual used_ids from the expired package
            // NOTE: Prisma count() doesn't support distinct, so we use findMany with distinct and count the results
            const uniquePurchases = await prisma.purchases.findMany({
              where: {
                status: 'completed',
                is_renewal: false, // Only count first purchases, not renewals
                purchased_at: {
                  gt: expiredPurchaseDate,
                },
                NOT: { user_id: request.user_id }, // Exclude the user themselves
              },
              select: {
                user_id: true, // Only need user_id for distinct count
              },
              distinct: ['user_id'],
            });
            const globalUsersAfterPurchase = uniquePurchases.length;
            
            // Used IDs = min(global_users_count, package_cap)
            // This ensures we don't exceed the package cap
            const expiredPackageCap = expiredPkg?.global_ids || 0;
            const usedIds = Math.min(globalUsersAfterPurchase, expiredPackageCap);
            
            console.log(`📊 Used IDs calculation:`, {
              global_users_after_purchase: globalUsersAfterPurchase,
              expired_package_cap: expiredPackageCap,
              used_ids: usedIds,
            });

            // Get new package details
            const newPkg = await prisma.packages.findUnique({
              where: { id: request.package_id },
              select: { global_ids: true },
            });

            if (!newPkg) {
              return reply.code(400).send({ error: 'New package not found' });
            }

            // Calculate effective_global_ids: new_package_ids - used_ids_from_old_package
            const newPackageGlobalIds = newPkg.global_ids || 0;
            const effectiveGlobalIds = Math.max(0, newPackageGlobalIds - usedIds);

            console.log(`📊 Upgrade calculation:`, {
              expired_package_id: previousPackageId,
              new_package_id: request.package_id,
              used_ids_from_old: usedIds,
              new_package_global_ids: newPackageGlobalIds,
              effective_global_ids: effectiveGlobalIds,
            });

            // Create NEW purchase for upgrade
            const purchasedAt = new Date();
            purchase = await prisma.purchases.create({
              data: {
                user_id: request.user_id,
                package_id: request.package_id, // New upgraded package
                previous_package_id: previousPackageId, // Track which package was upgraded
                previous_purchase_id: expiredPurchase.id, // Track exact expired purchase upgraded from
                amount: Number(request.amount),
                purchased_at: purchasedAt,
                txn_id: request.txn_id,
                payment_proof_url: request.payment_proof_url,
                payment_type: request.payment_type,
                is_renewal: true,
                effective_global_ids: effectiveGlobalIds, // Carry-forward IDs: new - used
                status: 'completed',
                income: 0, // Fresh start for income tracking
              },
            });

            console.log(`✨ Upgrade purchase created: ${purchase.id} (effective_global_ids: ${effectiveGlobalIds})`);
          } else {
            // SAME PACKAGE: UPDATE existing purchase
            console.log(`🔄 Same Package Renewal: Updating existing purchase ${expiredPurchase.id}`);
            
          const renewedAt = new Date();
          purchase = await prisma.purchases.update({
            where: { id: expiredPurchase.id },
            data: {
              income: 0, // Reset income for fresh 2x tracking
              renewed_at: renewedAt, // Track renewal date
              // purchased_at stays unchanged (original purchase date)
              txn_id: request.txn_id,
              payment_proof_url: request.payment_proof_url,
              payment_type: request.payment_type,
              is_renewal: true,
              // effective_global_ids stays same (global IDs continue from where they were)
            },
          });

          console.log(`🔄 Renewal: Updated existing purchase ${purchase.id} (reset income to 0, renewed_at: ${renewedAt.toISOString()})`);
          }
        } else {
          // For activation/reinvestment, create new purchase (existing logic)
          const purchasedAt = new Date();
          // NOTE: active_until removed - expiry is ONLY based on 2x income, NOT date
          // DB column exists but we don't set it anymore

          purchase = await prisma.purchases.create({
            data: {
              user_id: request.user_id,
              package_id: request.package_id,
              amount: Number(request.amount),
              purchased_at: purchasedAt,
              // active_until omitted - expiry is ONLY based on 2x income, NOT date
              txn_id: request.txn_id,
              payment_proof_url: request.payment_proof_url,
              payment_type: request.payment_type,
              is_renewal: false,
              effective_global_ids: null, // For new purchases, set to null so system calculates actual global users count dynamically
              status: 'completed',
              income: 0, // Always 0 for new purchases (fresh start for 2x tracking)
            },
          });

          console.log(`✨ New purchase created: ${purchase.id}`);
        }

        // Phase 2: Reset 10x withdrawal cycle on package purchase/upgrade
        await resetSpotTeamWithdrawUsed(request.user_id);

        // Queue commission job to schedule SELF and GLOBAL_HELPING commissions
        // For renewals, this will create NEW scheduled commissions with fresh dates
        console.log(
          `📤 Queueing purchase-commission job for purchase ID: ${purchase.id}`
        );
        try {
          const jobId = await boss.send(
            'purchase-commission',
            { purchaseId: purchase.id.toString() },
            { retryLimit: 3, retryDelay: 30 }
          );
          console.log(`  ✅ Job queued with ID: ${jobId}`);
        } catch (error) {
          console.error(`  ❌ Error queueing job:`, error);
          console.log(`  ⚠️ Falling back to immediate processing...`);
          await CommissionService.handlePurchase(purchase.id);
        }

        // Update request status
        const adminUserId = admin?.user_id
          ? BigInt(admin.user_id)
          : BigInt(1); // Fallback to user ID 1 if admin object doesn't have user_id

        await prisma.purchase_requests.update({
          where: { id: requestId },
          data: {
            status: 'approved',
            processed_at: new Date(),
            processed_by: adminUserId,
          },
        });

        // Log admin activity
        if (admin?.user_id) {
          const { ipAddress, userAgent } = getRequestInfo(req);
          const targetUser = await prisma.users.findUnique({
            where: { id: request.user_id },
            select: { display_id: true, name: true, email: true },
          });
          const pkg = await prisma.packages.findUnique({
            where: { id: request.package_id },
            select: { name: true, price: true },
          });
          
          logAdminActivity({
            adminUserId: BigInt(admin.user_id),
            actionType: 'ACTIVATION_APPROVE',
            targetUserId: request.user_id,
            targetEntityType: 'activation_request',
            targetEntityId: requestId.toString(),
            actionDetails: {
              user_display_id: targetUser?.display_id || null,
              user_name: targetUser?.name || null,
              user_email: targetUser?.email || null,
              request_id: requestId.toString(),
              request_type: request.request_type,
              package_id: request.package_id,
              package_name: pkg?.name || null,
              package_price: pkg ? Number(pkg.price) : null,
              amount: Number(request.amount),
              purchase_id: purchase.id.toString(),
              is_renewal: purchase.is_renewal || false,
            },
            ipAddress,
            userAgent,
            status: 'success',
          });
        }

        return reply.send({
          message: 'Request approved and purchase created successfully',
          purchase: {
            id: purchase.id.toString(),
            user_id: purchase.user_id.toString(),
            package_id: purchase.package_id,
            amount: Number(purchase.amount),
            is_renewal: purchase.is_renewal,
            previous_package_id: purchase.previous_package_id,
            effective_global_ids: purchase.effective_global_ids,
          },
          request: {
            id: request.id.toString(),
            status: 'approved',
          },
        });
      } catch (error) {
        console.error('Error approving purchase request:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /api/v1/admin/activation/requests/:id/reject
   * Reject request
   */
  app.post(
    '/activation/requests/:id/reject',
    {
      preHandler: [adminAuth, checkPermission('ACTIVATION_REQUEST_APPROVE')],
      schema: {
        description: 'Reject purchase request',
        tags: ['Admin Purchase Requests'],
        summary: 'Reject Purchase Request',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['rejection_reason'],
          properties: {
            rejection_reason: {
              type: 'string',
              minLength: 1,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              request: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
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
    },
    async (req, reply) => {
      try {
        const requestId = BigInt((req.params as any).id);
        const body = z
          .object({
            rejection_reason: z.string().min(1, 'Rejection reason is required'),
          })
          .parse(req.body);
        const admin = (req as any).admin;

        const request = await prisma.purchase_requests.findUnique({
          where: { id: requestId },
        });

        if (!request) {
          return reply.code(404).send({ error: 'Request not found' });
        }

        if (request.status !== 'pending') {
          return reply.code(400).send({
            error: 'invalid_status',
            message: `Request is already ${request.status}. Cannot reject.`,
          });
        }

        const adminUserId = admin?.user_id
          ? BigInt(admin.user_id)
          : BigInt(1); // Fallback to user ID 1 if admin object doesn't have user_id

        await prisma.purchase_requests.update({
          where: { id: requestId },
          data: {
            status: 'rejected',
            rejection_reason: body.rejection_reason,
            processed_at: new Date(),
            processed_by: adminUserId,
          },
        });

        // Log admin activity
        if (admin?.user_id) {
          const { ipAddress, userAgent } = getRequestInfo(req);
          const targetUser = await prisma.users.findUnique({
            where: { id: request.user_id },
            select: { display_id: true, name: true, email: true },
          });
          const pkg = await prisma.packages.findUnique({
            where: { id: request.package_id },
            select: { name: true, price: true },
          });
          
          logAdminActivity({
            adminUserId: BigInt(admin.user_id),
            actionType: 'ACTIVATION_REJECT',
            targetUserId: request.user_id,
            targetEntityType: 'activation_request',
            targetEntityId: requestId.toString(),
            actionDetails: {
              user_display_id: targetUser?.display_id || null,
              user_name: targetUser?.name || null,
              user_email: targetUser?.email || null,
              request_id: requestId.toString(),
              request_type: request.request_type,
              package_id: request.package_id,
              package_name: pkg?.name || null,
              package_price: pkg ? Number(pkg.price) : null,
              amount: Number(request.amount),
              rejection_reason: body.rejection_reason,
            },
            ipAddress,
            userAgent,
            status: 'success',
          });
        }

        return reply.send({
          message: 'Request rejected successfully',
          request: {
            id: request.id.toString(),
            status: 'rejected',
          },
        });
      } catch (error) {
        console.error('Error rejecting purchase request:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}


