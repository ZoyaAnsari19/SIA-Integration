import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { deductFromWallet } from '../utils/wallet.js';
import { FeeService } from '../modules/fees/feeService.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';
import { getSpotTeamWithdrawLimit } from '../utils/spotTeamWithdrawLimit.js';

const approveWithdrawBody = z.object({
  remarks: z.string().optional(),
});

const rejectWithdrawBody = z.object({
  rejection_reason: z.string().min(1, 'Rejection reason is required'),
  remarks: z.string().optional(),
});

const adminWithdrawErrorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    details: {},
  },
  additionalProperties: true,
};

const adminWithdrawServerError = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
  additionalProperties: true,
};

export async function adminWithdrawRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/withdraw/pending:
   *   get:
   *     tags:
   *       - Admin Withdraw
   *     summary: List pending withdrawal requests
   *     description: |
   *       Retrieve all pending withdrawal requests for admin review.
   *       Returns paginated list of requests with user information.
   *     operationId: listPendingWithdrawals
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
   *     responses:
   *       '200':
   *         description: Pending withdrawal requests retrieved successfully
   */
  app.get('/withdraw/pending', {
    preHandler: [adminAuth, checkPermission('WITHDRAW_VIEW')],
    schema: {
      description: 'List pending withdrawal requests',
      tags: ['Admin Withdraw'],
      summary: 'List Pending Withdrawals',
      operationId: 'listPendingWithdrawals',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          withdraw_type: { type: 'string', enum: ['spot', 'wallet', 'team_royalty'] },
          user_id: { type: 'string' },
          name: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
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
                  user_id: { type: 'string' },
                  user_display_id: { type: ['string', 'null'] },
                  user_name: { type: ['string', 'null'] },
                  user_email: { type: ['string', 'null'] },
                  user_pan_number: { type: ['string', 'null'] },
                  user_phone: { type: ['string', 'null'] },
                  withdraw_type: { type: 'string' },
                  amount: { type: 'number' },
                  payment_method: { type: 'string' },
                  account_details: { type: 'string' },
                  status: { type: 'string' },
                  remarks: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                },
              },
            },
          },
        },
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = { status: 'pending' };

      // Handle withdraw_type filter
      if (query.withdraw_type) {
        where.withdraw_type = query.withdraw_type;
      }

      // Handle user_id and name filters
      if (query.user_id || query.name) {
        const userWhere: any = {};
        if (query.user_id) {
          const userIdStr = query.user_id.trim();
          // Check if it's a numeric ID
          if (/^\d+$/.test(userIdStr)) {
            userWhere.id = BigInt(userIdStr);
          } else {
            // It's a display_id, try exact match first, then partial match
            const displayIdUpper = userIdStr.toUpperCase();
            
            // First try exact match
            const exactUser = await prisma.users.findUnique({
              where: { display_id: displayIdUpper },
              select: { id: true },
            });
            
            if (exactUser) {
              // Exact match found, use it
              userWhere.id = exactUser.id;
            } else {
              // Try partial match (startsWith)
              const matchingUsers = await prisma.users.findMany({
                where: {
                  display_id: {
                    startsWith: displayIdUpper,
                  },
                },
                select: { id: true },
              });
              if (matchingUsers.length > 0) {
                // If multiple users match, filter by all matching user IDs
                userWhere.id = { in: matchingUsers.map(u => u.id) };
              } else {
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
            }
          }
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
            count: 0,
            page,
            limit,
            total_pages: 0,
            total: 0,
            items: [],
          });
        }
        where.user_id = { in: matchingUsers.map(u => u.id) };
      }

      // Date range filter (use created_at for pending requests)
      if (query.start_date || query.end_date) {
        where.created_at = {};
        if (query.start_date) {
          const startDate = new Date(query.start_date);
          startDate.setHours(0, 0, 0, 0);
          where.created_at.gte = startDate;
        }
        if (query.end_date) {
          const endDate = new Date(query.end_date);
          endDate.setHours(23, 59, 59, 999);
          where.created_at.lte = endDate;
        }
      }

      const [items, total] = await Promise.all([
        prisma.withdraw_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        prisma.withdraw_requests.count({ where }),
      ]);

      // Get user details for all requests
      const userIds = [...new Set(items.map((item: any) => item.user_id))];
      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, display_id: true },
      });
      const userMap = new Map(users.map((u: any) => [u.id.toString(), u]));

      // Profile fields included in list response so export does not N+1 fetch per user
      const userProfiles = await prisma.user_profiles.findMany({
        where: { user_id: { in: userIds } },
        select: {
          user_id: true,
          pan_number: true,
          phone: true,
          bank_name: true,
          bank_branch: true,
          bank_ac_holder: true,
          bank_account_no: true,
          bank_ifsc: true,
          bank_upi: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          aadhar_number: true,
        },
      });
      const profileMap = new Map(userProfiles.map((p: any) => [p.user_id.toString(), p]));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: items.map((item: any) => {
          const user = userMap.get(item.user_id.toString()) as any;
          const profile = profileMap.get(item.user_id.toString()) as any;
          return {
            id: item.id.toString(),
            user_id: item.user_id.toString(),
            user_display_id: user?.display_id || null,
            user_name: user?.name || null,
            user_email: user?.email || null,
            user_pan_number: profile?.pan_number || null,
            user_phone: profile?.phone || null,
            user_bank_name: profile?.bank_name || null,
            user_bank_branch: profile?.bank_branch || null,
            user_bank_ac_holder: profile?.bank_ac_holder || null,
            user_bank_account_no: profile?.bank_account_no || null,
            user_bank_ifsc: profile?.bank_ifsc || null,
            user_bank_upi: profile?.bank_upi || null,
            user_address: profile?.address || null,
            user_city: profile?.city || null,
            user_state: profile?.state || null,
            user_pincode: profile?.pincode || null,
            user_aadhar_number: profile?.aadhar_number || null,
            withdraw_type: item.withdraw_type,
            amount: Number(item.amount),
            payment_method: item.payment_method,
            account_details: item.account_details,
            status: item.status,
            remarks: item.remarks,
            created_at: item.created_at.toISOString(),
          };
        }),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/withdraw/requests:
   *   get:
   *     tags:
   *       - Admin Withdraw
   *     summary: List all withdrawal requests
   *     description: |
   *       Retrieve all withdrawal requests with filtering options.
   *       Supports filtering by status, user_id, and date range.
   *     operationId: listAllWithdrawals
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Number of items per page
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, rejected, processing, cancelled]
   *         description: Filter by status
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         description: Filter by user ID
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
   *       - in: query
   *         name: withdraw_type
   *         schema:
   *           type: string
   *           enum: [wallet, spot]
   *         description: Filter by withdraw type
   *     responses:
   *       '200':
   *         description: Withdrawal requests retrieved successfully
   */
  app.get('/withdraw/requests', {
    preHandler: [adminAuth, checkPermission('WITHDRAW_VIEW')],
    schema: {
      description: 'List all withdrawal requests with filters',
      tags: ['Admin Withdraw'],
      summary: 'List All Withdrawals',
      operationId: 'listAllWithdrawals',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'processing', 'cancelled'] },
          user_id: { type: 'string' },
          name: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          withdraw_type: { type: 'string', enum: ['wallet', 'spot', 'team_royalty'] },
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
                  user_id: { type: 'string' },
                  user_display_id: { type: ['string', 'null'] },
                  user_name: { type: ['string', 'null'] },
                  user_email: { type: ['string', 'null'] },
                  user_pan_number: { type: ['string', 'null'] },
                  user_phone: { type: ['string', 'null'] },
                  withdraw_type: { type: 'string' },
                  amount: { type: 'number' },
                  payment_method: { type: 'string' },
                  account_details: { type: 'string' },
                  status: { type: 'string' },
                  remarks: { type: ['string', 'null'] },
                  processed_at: { type: ['string', 'null'] },
                  processed_by: { type: ['string', 'null'] },
                  rejection_reason: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (query.status) where.status = query.status;
      if (query.withdraw_type) where.withdraw_type = query.withdraw_type;

      // Handle user_id and name filters
      if (query.user_id || query.name) {
        const userWhere: any = {};
        if (query.user_id) {
          const userIdStr = query.user_id.trim();
          if (/^\d+$/.test(userIdStr)) {
            userWhere.id = BigInt(userIdStr);
          } else {
            // It's a display_id, find the user
            const displayIdUpper = userIdStr.toUpperCase();
            const user = await prisma.users.findUnique({
              where: { display_id: displayIdUpper },
              select: { id: true },
            });
            if (user) {
              userWhere.id = user.id;
            } else {
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
          }
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
            count: 0,
            page,
            limit,
            total_pages: 0,
            total: 0,
            items: [],
          });
        }
        where.user_id = { in: matchingUsers.map(u => u.id) };
      }

      // Date range filter
      if (query.start_date || query.end_date) {
        where.created_at = {};
        if (query.start_date) {
          const startDate = new Date(query.start_date);
          startDate.setHours(0, 0, 0, 0);
          where.created_at.gte = startDate;
        }
        if (query.end_date) {
          const endDate = new Date(query.end_date);
          endDate.setHours(23, 59, 59, 999);
          where.created_at.lte = endDate;
        }
      }

      const [items, total] = await Promise.all([
        prisma.withdraw_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        prisma.withdraw_requests.count({ where }),
      ]);

      // Get user details for all requests
      const userIds = [...new Set(items.map((item: any) => item.user_id))];
      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, display_id: true },
      });
      const userMap = new Map(users.map((u: any) => [u.id.toString(), u]));

      // Get user profiles for PAN and phone
      const userProfiles = await prisma.user_profiles.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, pan_number: true, phone: true },
      });
      const profileMap = new Map(userProfiles.map((p: any) => [p.user_id.toString(), p]));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: items.map((item: any) => {
          const user = userMap.get(item.user_id.toString()) as any;
          const profile = profileMap.get(item.user_id.toString()) as any;
          return {
            id: item.id.toString(),
            user_id: item.user_id.toString(),
            user_display_id: user?.display_id || null,
            user_name: user?.name || null,
            user_email: user?.email || null,
            user_pan_number: profile?.pan_number || null,
            user_phone: profile?.phone || null,
            withdraw_type: item.withdraw_type,
            amount: Number(item.amount),
            payment_method: item.payment_method,
            account_details: item.account_details,
            status: item.status,
            remarks: item.remarks,
            processed_at: item.processed_at?.toISOString() || null,
            processed_by: item.processed_by ? item.processed_by.toString() : null,
            rejection_reason: item.rejection_reason || null,
            created_at: item.created_at.toISOString(),
            updated_at: item.updated_at.toISOString(),
          };
        }),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/withdraw/requests/{id}:
   *   get:
   *     tags:
   *       - Admin Withdraw
   *     summary: Get withdrawal request details
   *     description: Retrieve detailed information about a specific withdrawal request
   *     operationId: getWithdrawalDetails
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Withdrawal request ID
   *     responses:
   *       '200':
   *         description: Withdrawal request details
   *       '404':
   *         description: Request not found
   */
  app.get('/withdraw/requests/:id', {
    preHandler: [adminAuth, checkPermission('WITHDRAW_VIEW')],
    schema: {
      description: 'Get withdrawal request details',
      tags: ['Admin Withdraw'],
      summary: 'Get Withdrawal Details',
      operationId: 'getWithdrawalDetails',
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
            user_id: { type: 'string' },
            user_name: { type: ['string', 'null'] },
            user_email: { type: ['string', 'null'] },
            withdraw_type: { type: 'string' },
            amount: { type: 'number' },
            payment_method: { type: 'string' },
            account_details: { type: 'string' },
            status: { type: 'string' },
            remarks: { type: ['string', 'null'] },
            processed_at: { type: ['string', 'null'] },
            processed_by: { type: ['string', 'null'] },
            rejection_reason: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: adminWithdrawErrorResponse,
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const requestId = BigInt((req.params as any).id);

      const request = await prisma.withdraw_requests.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      // Get user details
      const user = await prisma.users.findUnique({
        where: { id: request.user_id },
        select: { id: true, name: true, email: true },
      });

      return reply.send({
        id: request.id.toString(),
        user_id: request.user_id.toString(),
        user_name: user?.name || null,
        user_email: user?.email || null,
        withdraw_type: request.withdraw_type,
        amount: Number(request.amount),
        payment_method: request.payment_method,
        account_details: request.account_details,
        status: request.status,
        remarks: request.remarks,
        processed_at: request.processed_at?.toISOString() || null,
        processed_by: request.processed_by ? request.processed_by.toString() : null,
        rejection_reason: request.rejection_reason || null,
        created_at: request.created_at.toISOString(),
        updated_at: request.updated_at.toISOString(),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/withdraw/requests/{id}/approve:
   *   post:
   *     tags:
   *       - Admin Withdraw
   *     summary: Approve withdrawal request
   *     description: |
   *       Approve a pending withdrawal request. This will:
   *       1. Update request status to 'approved'
   *       2. Deduct amount from user's wallet (if not already deducted)
   *       3. Record processed_by and processed_at
   *     operationId: approveWithdrawal
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Withdrawal request ID
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               remarks:
   *                 type: string
   *                 description: Optional remarks for approval
   *     responses:
   *       '200':
   *         description: Withdrawal approved successfully
   *       '400':
   *         description: Cannot approve non-pending request
   *       '404':
   *         description: Request not found
   */
  app.post('/withdraw/requests/:id/approve', {
    preHandler: [adminAuth, checkPermission('WITHDRAW_APPROVE')],
    schema: {
      description: 'Approve withdrawal request',
      tags: ['Admin Withdraw'],
      summary: 'Approve Withdrawal',
      operationId: 'approveWithdrawal',
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
          remarks: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string' },
          },
          additionalProperties: true,
        },
        400: adminWithdrawErrorResponse,
        404: adminWithdrawErrorResponse,
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const requestId = BigInt((req.params as any).id);
      const body = approveWithdrawBody.parse(req.body || {});
      const adminId = (req as any).admin?.user_id ?? null; // Admin ID from token; null if not admin

      const request = await prisma.withdraw_requests.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      if (request.status !== 'pending') {
        return reply.code(400).send({
          error: 'cannot_approve',
          message: `Cannot approve request with status: ${request.status}. Only pending requests can be approved.`,
        });
      }

      // Get active withdrawal rules to apply admin charges
      // Note: This will work after schema migration
      let rules: any = null;
      try {
        rules = await (prisma as any).withdrawal_transfer_rules.findFirst({
          where: { is_active: true },
          orderBy: { updated_at: 'desc' },
        });
      } catch (e) {
        // Table might not exist yet, use default values
        console.log('Withdrawal rules table not found, using defaults');
      }

      // Get WITHDRAWAL_PROCESSING fee from fee_rules (fee is included in request amount, not separate)
      let withdrawalProcessingFee = 0;
      try {
        const feeCheck = await FeeService.checkFeeApplicable(request.user_id as unknown as bigint, 'WITHDRAWAL_PROCESSING');
        if (feeCheck.applicable && feeCheck.amount > 0) {
          withdrawalProcessingFee = feeCheck.amount;
        }
      } catch (e) {
        // If WITHDRAWAL_PROCESSING rule doesn't exist, try FUND_WITHDRAW as fallback
        try {
          const feeCheck = await FeeService.checkFeeApplicable(request.user_id as unknown as bigint, 'FUND_WITHDRAW');
          if (feeCheck.applicable && feeCheck.amount > 0) {
            withdrawalProcessingFee = feeCheck.amount;
          }
        } catch (e2) {
          console.log('No withdrawal processing fee rule found, using 0');
        }
      }
      
      // Fee is included in request amount, so total deductible is just the request amount
      // No need to add fee separately - it's already part of the withdrawal amount
      const totalDeductible = Number(request.amount);

      // Get wallet balances for independent wallet deduction
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: request.user_id },
        select: { spot_balance: true, other_balance: true, team_royalty_balance: true, balance: true }
      });

      const spotBalance = Number(balance?.spot_balance || 0);
      const otherBalance = Number(balance?.other_balance || 0);
      const teamRoyaltyBalance = Number(balance?.team_royalty_balance || 0);
      const totalBalance = Number(balance?.balance || 0);
      const withdrawalAmount = Number(request.amount);

      let spotDeducted = 0;
      let otherDeducted = 0;
      let teamRoyaltyDeducted = 0;

      if (request.withdraw_type === 'spot') {
        if (spotBalance < withdrawalAmount) {
          return reply.code(400).send({
            error: 'insufficient_spot_balance',
            message: `Insufficient SPOT balance for withdrawal. Available: ₹${spotBalance.toFixed(2)}, Required: ₹${withdrawalAmount.toFixed(2)}`,
            available_balance: spotBalance,
            spot_balance: spotBalance,
            other_balance: otherBalance,
            requested_amount: withdrawalAmount,
            withdraw_type: 'spot',
          });
        }
        spotDeducted = withdrawalAmount;
      } else if (request.withdraw_type === 'wallet') {
        if (otherBalance < withdrawalAmount) {
          return reply.code(400).send({
            error: 'insufficient_other_balance',
            message: `Insufficient Main wallet balance for withdrawal. Available: ₹${otherBalance.toFixed(2)}, Required: ₹${withdrawalAmount.toFixed(2)}`,
            available_balance: otherBalance,
            spot_balance: spotBalance,
            other_balance: otherBalance,
            requested_amount: withdrawalAmount,
            withdraw_type: 'wallet',
          });
        }
        otherDeducted = withdrawalAmount;
      } else if (request.withdraw_type === 'team_royalty') {
        if (teamRoyaltyBalance < withdrawalAmount) {
          return reply.code(400).send({
            error: 'insufficient_team_royalty_balance',
            message: `Insufficient Team Royalty wallet balance for withdrawal. Available: ₹${teamRoyaltyBalance.toFixed(2)}, Required: ₹${withdrawalAmount.toFixed(2)}`,
            available_balance: teamRoyaltyBalance,
            team_royalty_balance: teamRoyaltyBalance,
            requested_amount: withdrawalAmount,
            withdraw_type: 'team_royalty',
          });
        }
        teamRoyaltyDeducted = withdrawalAmount;
      } else {
        return reply.code(400).send({
          error: 'invalid_withdraw_type',
          message: `Invalid withdrawal type: ${request.withdraw_type}. Must be 'spot', 'wallet', or 'team_royalty'.`,
        });
      }

      const idempotencyKey = `withdraw:approve:${request.id}`;

      // Idempotent recovery: a prior approve may have deducted wallet + created ledger but failed before status update
      const existingApprovalLedger = await prisma.ledger_entries.findUnique({
        where: { idempotency_key: idempotencyKey },
      });

      if (existingApprovalLedger) {
        const existingWalletTx = await prisma.wallet_transactions.findFirst({
          where: { idempotency_key: idempotencyKey },
        });
        if (!existingWalletTx) {
          await prisma.wallet_transactions.create({
            data: {
              receiver_user_id: request.user_id as unknown as bigint,
              ledger_entry_id: existingApprovalLedger.id,
              amount: -withdrawalAmount,
              idempotency_key: idempotencyKey,
            },
          });
        }

        const updated = await prisma.withdraw_requests.update({
          where: { id: requestId },
          data: {
            status: 'approved',
            processed_at: new Date(),
            processed_by: adminId,
            remarks: body.remarks || request.remarks,
          },
        });

        const tdsAmount = Number(request.amount) * 0.10;
        const netPayout = Number(request.amount) - tdsAmount - withdrawalProcessingFee;

        return reply.send({
          message: 'Withdrawal approved successfully',
          id: updated.id.toString(),
          status: updated.status,
          withdrawal_amount: Number(request.amount),
          withdrawal_processing_fee: withdrawalProcessingFee,
          tds_amount: tdsAmount,
          net_payout: netPayout,
          withdrawal_fee_included: true,
          total_deducted: totalDeductible,
        });
      }

      try {
        // Deduct from wallet using Prisma (type-safe; balance row exists per checks above)
        // For Spot/Team Royalty, also increment spot_team_withdraw_used (10x limit tracking)
        const isSpotOrTeamRoyalty = request.withdraw_type === 'spot' || request.withdraw_type === 'team_royalty';
        let limitInfo: { spot_team_withdraw_limit: number; spot_team_withdraw_used: number } | null = null;
        if (isSpotOrTeamRoyalty) {
          // Get current 10x limit info BEFORE incrementing used
          limitInfo = await getSpotTeamWithdrawLimit(request.user_id as unknown as bigint);
        }

        // Read existing balance row to check if limit was already marked as reached
        const existingBalance = await prisma.user_balances.findUnique({
          where: { user_id: request.user_id },
          select: { spot_team_limit_reached_at: true },
        });

        await prisma.user_balances.update({
          where: { user_id: request.user_id },
          data: {
            balance: { decrement: withdrawalAmount },
            spot_balance: { decrement: spotDeducted },
            other_balance: { decrement: otherDeducted },
            team_royalty_balance: { decrement: teamRoyaltyDeducted },
            ...(isSpotOrTeamRoyalty
              ? {
                  spot_team_withdraw_used: { increment: withdrawalAmount },
                  // If this approval causes user to fully use their 10x limit for the first time,
                  // mark the timestamp so flush rule can apply after 30 days.
                  ...(limitInfo &&
                  limitInfo.spot_team_withdraw_limit > 0 &&
                  existingBalance?.spot_team_limit_reached_at == null &&
                  limitInfo.spot_team_withdraw_used + withdrawalAmount >= limitInfo.spot_team_withdraw_limit
                    ? { spot_team_limit_reached_at: new Date() }
                    : {}),
                }
              : {}),
            updated_at: new Date(),
          },
        });

        const walletTypeForLedger = request.withdraw_type === 'spot' ? 'spot_balance' : request.withdraw_type === 'team_royalty' ? 'team_royalty_balance' : 'other_balance';
        const withdrawalLedger = await prisma.ledger_entries.create({
          data: {
            receiver_user_id: request.user_id as unknown as bigint,
            source_user_id: request.user_id as unknown as bigint,
            purchase_id: null,
            commission_type: 'FEE_DEDUCTION',
            amount: -withdrawalAmount,
            metadata: {
              reason: 'WITHDRAWAL',
              reference_id: request.id.toString(),
              reference_type: 'withdraw_request',
              wallet_type: walletTypeForLedger,
              spot_deducted: spotDeducted,
              other_deducted: otherDeducted,
              team_royalty_deducted: teamRoyaltyDeducted,
              withdrawal_fee: withdrawalProcessingFee,
              withdrawal_fee_included: true,
            } as any,
            idempotency_key: idempotencyKey,
          },
        });

        // Create wallet transaction entry so it shows in wallet history
        await prisma.wallet_transactions.create({
          data: {
            receiver_user_id: request.user_id as unknown as bigint,
            ledger_entry_id: withdrawalLedger.id,
            amount: -withdrawalAmount,
            idempotency_key: idempotencyKey,
          },
        });

        // NOTE: Withdrawal fee is now included in the request amount itself
        // No need to deduct fee separately - it's already part of withdrawalAmount
        // This prevents negative balance issues
      } catch (error: any) {
        if (error.code === 'INSUFFICIENT_BALANCE') {
          return reply.code(400).send({
            error: 'insufficient_balance',
            message: `User has insufficient balance. Available: ₹${error.available?.toFixed(2) || 0}, Required: ₹${totalDeductible.toFixed(2)} (₹${Number(request.amount).toFixed(2)} withdrawal - fee included in amount)`,
            withdrawal_amount: Number(request.amount),
            withdrawal_processing_fee: withdrawalProcessingFee,
            withdrawal_fee_included: true, // Fee is included in withdrawal amount
            total_required: totalDeductible,
          });
        }
        if (error?.code === 'P2002' && String(error?.meta?.target ?? '').includes('idempotency_key')) {
          const updated = await prisma.withdraw_requests.update({
            where: { id: requestId },
            data: {
              status: 'approved',
              processed_at: new Date(),
              processed_by: adminId,
              remarks: body.remarks || request.remarks,
            },
          });
          const tdsAmount = Number(request.amount) * 0.10;
          const netPayout = Number(request.amount) - tdsAmount - withdrawalProcessingFee;
          return reply.send({
            message: 'Withdrawal approved successfully',
            id: updated.id.toString(),
            status: updated.status,
            withdrawal_amount: Number(request.amount),
            withdrawal_processing_fee: withdrawalProcessingFee,
            tds_amount: tdsAmount,
            net_payout: netPayout,
            withdrawal_fee_included: true,
            total_deducted: totalDeductible,
          });
        }
        throw error;
      }

      // Update request status (processed_by null when no admin in token)
      const updated = await prisma.withdraw_requests.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          processed_at: new Date(),
          processed_by: adminId,
          remarks: body.remarks || request.remarks,
        },
      });

      // Calculate net payout after TDS (10%) and fee (both from request amount)
      const tdsAmount = Number(request.amount) * 0.10; // 10% TDS
      const netPayout = Number(request.amount) - tdsAmount - withdrawalProcessingFee;

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: request.user_id as unknown as bigint },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'WITHDRAWAL_APPROVE',
          targetUserId: request.user_id as unknown as bigint,
          targetEntityType: 'withdrawal',
          targetEntityId: requestId.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            user_email: targetUser?.email || null,
            withdrawal_request_id: requestId.toString(),
            withdrawal_amount: Number(request.amount),
            withdraw_type: request.withdraw_type,
            withdrawal_processing_fee: withdrawalProcessingFee,
            tds_amount: tdsAmount,
            net_payout: netPayout,
            remarks: body.remarks || null,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        message: 'Withdrawal approved successfully',
        id: updated.id.toString(),
        status: updated.status,
        withdrawal_amount: Number(request.amount),
        withdrawal_processing_fee: withdrawalProcessingFee,
        tds_amount: tdsAmount,
        net_payout: netPayout,
        withdrawal_fee_included: true, // Fee is included in withdrawal amount, not separate
        total_deducted: totalDeductible,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', details: error.errors });
      }
      console.error('[admin-withdraw] Approve error:', error?.message || error);
      if (error?.stack) console.error(error.stack);
      return reply.code(500).send({
        error: 'internal_server_error',
        message: error?.message || 'Server error. Please try again.',
      });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/withdraw/requests/{id}/reject:
   *   post:
   *     tags:
   *       - Admin Withdraw
   *     summary: Reject withdrawal request
   *     description: |
   *       Reject a pending withdrawal request. Requires a rejection reason.
   *       This will update the request status to 'rejected' and record the reason.
   *     operationId: rejectWithdrawal
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Withdrawal request ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - rejection_reason
   *             properties:
   *               rejection_reason:
   *                 type: string
   *                 minLength: 1
   *                 description: Reason for rejection (required)
   *               remarks:
   *                 type: string
   *                 description: Optional remarks
   *     responses:
   *       '200':
   *         description: Withdrawal rejected successfully
   *       '400':
   *         description: Cannot reject non-pending request or validation error
   *       '404':
   *         description: Request not found
   */
  app.post('/withdraw/requests/:id/reject', {
    preHandler: [adminAuth, checkPermission('WITHDRAW_APPROVE')],
    schema: {
      description: 'Reject withdrawal request',
      tags: ['Admin Withdraw'],
      summary: 'Reject Withdrawal',
      operationId: 'rejectWithdrawal',
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
          rejection_reason: { type: 'string', minLength: 1 },
          remarks: { type: 'string' },
        },
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
        400: adminWithdrawErrorResponse,
        404: adminWithdrawErrorResponse,
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const requestId = BigInt((req.params as any).id);
      const body = rejectWithdrawBody.parse(req.body);
      const adminId = (req as any).admin?.user_id || BigInt(0); // Admin ID from token or default

      const request = await prisma.withdraw_requests.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      if (request.status !== 'pending') {
        return reply.code(400).send({
          error: 'cannot_reject',
          message: `Cannot reject request with status: ${request.status}. Only pending requests can be rejected.`,
        });
      }

      // Update request status
      const updated = await prisma.withdraw_requests.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          processed_at: new Date(),
          processed_by: adminId,
          rejection_reason: body.rejection_reason,
          remarks: body.remarks || request.remarks,
        },
      });

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const targetUser = await prisma.users.findUnique({
          where: { id: request.user_id as unknown as bigint },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'WITHDRAWAL_REJECT',
          targetUserId: request.user_id as unknown as bigint,
          targetEntityType: 'withdrawal',
          targetEntityId: requestId.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            user_email: targetUser?.email || null,
            withdrawal_request_id: requestId.toString(),
            withdrawal_amount: Number(request.amount),
            withdraw_type: request.withdraw_type,
            rejection_reason: body.rejection_reason,
            remarks: body.remarks || null,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        message: 'Withdrawal rejected successfully',
        id: updated.id.toString(),
        status: updated.status,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', details: error.errors });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/withdraw/history:
   *   get:
   *     tags:
   *       - Admin Withdraw
   *     summary: Get withdrawal history
   *     description: |
   *       Retrieve withdrawal history with pagination and filtering options.
   *       Returns all processed (approved/rejected) withdrawal requests.
   *     operationId: getWithdrawalHistory
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Number of items per page
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [approved, rejected]
   *         description: Filter by status (default: both)
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         description: Filter by user ID
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
   *         description: Withdrawal history retrieved successfully
   */
  app.get('/withdraw/history', {
    preHandler: [adminAuth, checkPermission('WITHDRAW_VIEW')],
    schema: {
      description: 'Get withdrawal history with pagination',
      tags: ['Admin Withdraw'],
      summary: 'Get Withdrawal History',
      operationId: 'getWithdrawalHistory',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          status: { type: 'string', enum: ['approved', 'rejected'] },
          withdraw_type: { type: 'string', enum: ['spot', 'wallet', 'team_royalty'] },
          user_id: { type: 'string' },
          name: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
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
                  user_id: { type: 'string' },
                  user_display_id: { type: ['string', 'null'] },
                  user_name: { type: ['string', 'null'] },
                  user_email: { type: ['string', 'null'] },
                  user_pan_number: { type: ['string', 'null'] },
                  user_phone: { type: ['string', 'null'] },
                  withdraw_type: { type: 'string' },
                  amount: { type: 'number' },
                  payment_method: { type: 'string' },
                  account_details: { type: 'string' },
                  status: { type: 'string' },
                  remarks: { type: ['string', 'null'] },
                  processed_at: { type: ['string', 'null'] },
                  processed_by: { type: ['string', 'null'] },
                  rejection_reason: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                },
              },
            },
          },
        },
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        status: {
          in: query.status ? [query.status] : ['approved', 'rejected'],
        },
      };

      // Handle withdraw_type filter
      if (query.withdraw_type) {
        where.withdraw_type = query.withdraw_type;
      }

      // Handle user_id and name filters
      if (query.user_id || query.name) {
        const userWhere: any = {};
        if (query.user_id) {
          const userIdStr = query.user_id.trim();
          // Check if it's a numeric ID
          if (/^\d+$/.test(userIdStr)) {
            userWhere.id = BigInt(userIdStr);
          } else {
            // It's a display_id, try exact match first, then partial match
            const displayIdUpper = userIdStr.toUpperCase();
            
            // First try exact match
            const exactUser = await prisma.users.findUnique({
              where: { display_id: displayIdUpper },
              select: { id: true },
            });
            
            if (exactUser) {
              // Exact match found, use it
              userWhere.id = exactUser.id;
            } else {
              // Try partial match (startsWith)
              const matchingUsers = await prisma.users.findMany({
                where: {
                  display_id: {
                    startsWith: displayIdUpper,
                  },
                },
                select: { id: true },
              });
              if (matchingUsers.length > 0) {
                // If multiple users match, filter by all matching user IDs
                userWhere.id = { in: matchingUsers.map(u => u.id) };
              } else {
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
            }
          }
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
            count: 0,
            page,
            limit,
            total_pages: 0,
            total: 0,
            items: [],
          });
        }
        where.user_id = { in: matchingUsers.map(u => u.id) };
      }

      // Date range filter (use processed_at for history)
      if (query.start_date || query.end_date) {
        where.processed_at = {};
        if (query.start_date) {
          const startDate = new Date(query.start_date);
          startDate.setHours(0, 0, 0, 0);
          where.processed_at.gte = startDate;
        }
        if (query.end_date) {
          const endDate = new Date(query.end_date);
          endDate.setHours(23, 59, 59, 999);
          where.processed_at.lte = endDate;
        }
      }

      const [items, total] = await Promise.all([
        prisma.withdraw_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' }, // Order by created_at to show latest first
        }),
        prisma.withdraw_requests.count({ where }),
      ]);

      // Get user details for all requests
      const userIds = [...new Set(items.map((item: any) => item.user_id))];
      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, display_id: true },
      });
      const userMap = new Map(users.map((u: any) => [u.id.toString(), u]));

      // Get user profiles for PAN and phone
      const userProfiles = await prisma.user_profiles.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, pan_number: true, phone: true },
      });
      const profileMap = new Map(userProfiles.map((p: any) => [p.user_id.toString(), p]));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: items.map((item: any) => {
          const user = userMap.get(item.user_id.toString()) as any;
          const profile = profileMap.get(item.user_id.toString()) as any;
          return {
            id: item.id.toString(),
            user_id: item.user_id.toString(),
            user_display_id: user?.display_id || null,
            user_name: user?.name || null,
            user_email: user?.email || null,
            user_pan_number: profile?.pan_number || null,
            user_phone: profile?.phone || null,
            withdraw_type: item.withdraw_type,
            amount: Number(item.amount),
            payment_method: item.payment_method,
            account_details: item.account_details,
            status: item.status,
            remarks: item.remarks,
            processed_at: item.processed_at?.toISOString() || null,
            processed_by: item.processed_by ? item.processed_by.toString() : null,
            rejection_reason: item.rejection_reason || null,
            created_at: item.created_at.toISOString(),
          };
        }),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/wallet/transfers:
   *   get:
   *     tags:
   *       - Admin Withdraw
   *     summary: List all wallet transfers (user to user)
   *     description: |
   *       Retrieve all wallet-to-wallet transfers with sender and recipient details.
   *       Supports filtering by user_id, date range, and pagination.
   *     operationId: listWalletTransfers
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: from_user_id
   *         schema:
   *           type: string
   *         description: Filter by sender user ID
   *       - in: query
   *         name: to_user_id
   *         schema:
   *           type: string
   *         description: Filter by recipient user ID
   *       - in: query
   *         name: from_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter from this date (YYYY-MM-DD)
   *       - in: query
   *         name: to_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter until this date (YYYY-MM-DD)
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
   *         description: Wallet transfers retrieved successfully
   */
  app.get('/wallet/transfers', {
    preHandler: [adminAuth, checkPermission('P2P_VIEW')],
    schema: {
      description: 'List all wallet transfers (user to user)',
      tags: ['Admin Withdraw'],
      summary: 'List Wallet Transfers',
      operationId: 'listWalletTransfers',
        querystring: {
          type: 'object',
          properties: {
            from_user_id: { type: 'string' },
            to_user_id: { type: 'string' },
            from_user_name: { type: 'string' },
            to_user_name: { type: 'string' },
            from_date: { type: 'string', format: 'date' },
            to_date: { type: 'string', format: 'date' },
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
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  from_user_id: { type: 'string' },
                  from_user_display_id: { type: ['string', 'null'] },
                  from_user_name: { type: ['string', 'null'] },
                  from_user_email: { type: ['string', 'null'] },
                  to_user_id: { type: 'string' },
                  to_user_display_id: { type: ['string', 'null'] },
                  to_user_name: { type: ['string', 'null'] },
                  to_user_email: { type: ['string', 'null'] },
                  amount: { type: 'number' },
                  tax_amount: { type: 'number' },
                  net_amount: { type: 'number' },
                  status: { type: 'string' },
                  remarks: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                },
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
        500: adminWithdrawServerError,
      },
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = {};

      // Filter by sender user ID or name
      if (query.from_user_id || query.from_user_name) {
        const fromUserWhere: any = {};
        if (query.from_user_id) {
          const fromUserIdStr = query.from_user_id.toString().trim();
          if (fromUserIdStr.toUpperCase().startsWith('SIA')) {
            const displayIdUpper = fromUserIdStr.toUpperCase();
            const user = await prisma.users.findUnique({
              where: { display_id: displayIdUpper },
              select: { id: true },
            });
            if (!user) {
              return reply.send({
                items: [],
                pagination: { page, limit, total: 0, total_pages: 0 },
              });
            }
            fromUserWhere.id = user.id;
          } else if (/^\d+$/.test(fromUserIdStr)) {
            fromUserWhere.id = BigInt(fromUserIdStr);
          } else {
            return reply.send({
              items: [],
              pagination: { page, limit, total: 0, total_pages: 0 },
            });
          }
        }
        if (query.from_user_name) {
          fromUserWhere.name = { contains: query.from_user_name, mode: 'insensitive' };
        }
        const matchingFromUsers = await prisma.users.findMany({
          where: fromUserWhere,
          select: { id: true },
        });
        if (matchingFromUsers.length === 0) {
          return reply.send({
            items: [],
            pagination: { page, limit, total: 0, total_pages: 0 },
          });
        }
        where.from_user_id = { in: matchingFromUsers.map(u => u.id) };
      }

      // Filter by recipient user ID or name
      if (query.to_user_id || query.to_user_name) {
        const toUserWhere: any = {};
        if (query.to_user_id) {
          const toUserIdStr = query.to_user_id.toString().trim();
          if (toUserIdStr.toUpperCase().startsWith('SIA')) {
            const displayIdUpper = toUserIdStr.toUpperCase();
            const user = await prisma.users.findUnique({
              where: { display_id: displayIdUpper },
              select: { id: true },
            });
            if (!user) {
              return reply.send({
                items: [],
                pagination: { page, limit, total: 0, total_pages: 0 },
              });
            }
            toUserWhere.id = user.id;
          } else if (/^\d+$/.test(toUserIdStr)) {
            toUserWhere.id = BigInt(toUserIdStr);
          } else {
            return reply.send({
              items: [],
              pagination: { page, limit, total: 0, total_pages: 0 },
            });
          }
        }
        if (query.to_user_name) {
          toUserWhere.name = { contains: query.to_user_name, mode: 'insensitive' };
        }
        const matchingToUsers = await prisma.users.findMany({
          where: toUserWhere,
          select: { id: true },
        });
        if (matchingToUsers.length === 0) {
          return reply.send({
            items: [],
            pagination: { page, limit, total: 0, total_pages: 0 },
          });
        }
        where.to_user_id = { in: matchingToUsers.map(u => u.id) };
      }

      // Filter by date range
      if (query.from_date || query.to_date) {
        where.created_at = {};
        if (query.from_date) {
          const fromDate = new Date(query.from_date);
          fromDate.setHours(0, 0, 0, 0);
          where.created_at.gte = fromDate;
        }
        if (query.to_date) {
          const toDate = new Date(query.to_date);
          toDate.setHours(23, 59, 59, 999);
          where.created_at.lte = toDate;
        }
      }

      // Get transfers
      const [items, total] = await Promise.all([
        (prisma as any).wallet_transfers.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        (prisma as any).wallet_transfers.count({ where }),
      ]);

      // Get user details for all transfers - EXPLICITLY FETCH display_id from DB
      const userIds = new Set<bigint>();
      items.forEach((item: any) => {
        // item.from_user_id and item.to_user_id are already BigInt from Prisma
        userIds.add(BigInt(item.from_user_id));
        userIds.add(BigInt(item.to_user_id));
      });

      console.log('[Admin Wallet Transfers] Fetching users from DB:', {
        userIdsArray: Array.from(userIds).map(id => id.toString()),
        userIdsCount: userIds.size,
      });

      // EXPLICITLY SELECT display_id from database
      const users = await prisma.users.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { 
          id: true, 
          name: true, 
          email: true, 
          display_id: true  // EXPLICITLY fetch display_id from DB
        },
      });

      console.log('[Admin Wallet Transfers] Users fetched from DB:', {
        usersCount: users.length,
        users: users.map((u: any) => ({
          id: u.id.toString(),
          display_id: u.display_id,
          name: u.name,
        })),
      });

      // Create maps for quick lookup (same approach as Direct Income API)
      const userMap = new Map(users.map((u: any) => [u.id.toString(), u]));
      const userDisplayIdMap = new Map(users.map((u: any) => [u.id.toString(), u.display_id || null]));
      const userNameMap = new Map(users.map((u: any) => [u.id.toString(), u.name || null]));
      const userEmailMap = new Map(users.map((u: any) => [u.id.toString(), u.email || null]));

      console.log('[Admin Wallet Transfers] User maps created:', {
        userIdsCount: userIds.size,
        usersFetched: users.length,
        userMapSize: userMap.size,
        userDisplayIdMapSize: userDisplayIdMap.size,
        userDisplayIdMapEntries: Array.from(userDisplayIdMap.entries()).slice(0, 5),
        sampleUser: users[0] ? { 
          id: users[0].id.toString(), 
          display_id: users[0].display_id,
          name: users[0].name 
        } : null,
      });

      return reply.send({
        items: items.map((item: any) => {
          // Convert BigInt to string for lookup (same as Direct Income)
          const fromUserIdStr = item.from_user_id.toString();
          const toUserIdStr = item.to_user_id.toString();
          
          // Get display IDs directly from map (same approach as Direct Income)
          const fromUserDisplayId = userDisplayIdMap.get(fromUserIdStr) || null;
          const toUserDisplayId = userDisplayIdMap.get(toUserIdStr) || null;
          
          // VERIFY display IDs are being retrieved
          if (!fromUserDisplayId || !toUserDisplayId) {
            console.warn('[Admin Wallet Transfers] ⚠️ Missing display_id:', {
              item_id: item.id.toString(),
              from_user_id: fromUserIdStr,
              fromUser_display_id: fromUserDisplayId,
              fromUserInMap: userDisplayIdMap.has(fromUserIdStr),
              to_user_id: toUserIdStr,
              toUser_display_id: toUserDisplayId,
              toUserInMap: userDisplayIdMap.has(toUserIdStr),
            });
          }
          
          const result = {
            id: item.id.toString(),
            from_user_id: fromUserIdStr,
            from_user_display_id: fromUserDisplayId, // EXPLICITLY return display_id from DB
            from_user_name: userNameMap.get(fromUserIdStr) || null,
            from_user_email: userEmailMap.get(fromUserIdStr) || null,
            to_user_id: toUserIdStr,
            to_user_display_id: toUserDisplayId, // EXPLICITLY return display_id from DB
            to_user_name: userNameMap.get(toUserIdStr) || null,
            to_user_email: userEmailMap.get(toUserIdStr) || null,
            amount: Number(item.amount),
            tax_amount: Number(item.tax_amount),
            net_amount: Number(item.net_amount),
            status: item.status,
            remarks: item.remarks || null,
            created_at: item.created_at.toISOString(),
          };
          
          // Log first item to verify display_ids are in response
          if (items.indexOf(item) === 0) {
            console.log('[Admin Wallet Transfers] ✅ First item response:', {
              from_user_display_id: result.from_user_display_id,
              to_user_display_id: result.to_user_display_id,
            });
          }
          
          return result;
        }),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });
}

