import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import { deductFromWallet, getLockedSpotBalance, getLockedMainBalance } from '../utils/wallet.js';
import { FeeService } from '../modules/fees/feeService.js';
import { isWithdrawalDateAllowed, isWithdrawalTimeAllowed } from '../utils/withdrawal-date.js';
import { getSpotTeamWithdrawLimit } from '../utils/spotTeamWithdrawLimit.js';

const createWithdrawBody = z.object({
  amount: z.coerce.number().positive(),
  payment_method: z.string().min(1),
  account_details: z.string().min(1),
  remarks: z.string().optional(),
  withdraw_type: z.enum(['wallet', 'spot', 'team_royalty']).default('wallet'),
  transaction_password: z.string().min(1, 'Transaction password is required'),
});

const updateWithdrawBody = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'processing', 'cancelled']).optional(),
  remarks: z.string().optional(),
  rejection_reason: z.string().optional(),
});

const apiErrorResponse = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

const apiNotFoundResponse = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' },
  },
};

export async function withdrawRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/withdraw/requests:
   *   get:
   *     tags:
   *       - Withdraw
   *     summary: List withdraw requests
   *     description: |
   *       Retrieve a paginated list of withdraw requests for the authenticated user.
   *       Supports filtering by status and withdraw type.
   *     operationId: listWithdrawRequests
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
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, rejected, processing, cancelled]
   *         description: Filter by status
   *       - in: query
   *         name: withdraw_type
   *         schema:
   *           type: string
   *           enum: [wallet, spot]
   *         description: Filter by withdraw type
   *     responses:
   *       '200':
   *         description: Withdraw requests retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                 page:
   *                   type: number
   *                 limit:
   *                   type: number
   *                 total_pages:
   *                   type: number
   *                 total:
   *                   type: number
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       user_id:
   *                         type: string
   *                       withdraw_type:
   *                         type: string
   *                       amount:
   *                         type: number
   *                       payment_method:
   *                         type: string
   *                       account_details:
   *                         type: string
   *                       status:
   *                         type: string
   *                       remarks:
   *                         type: string
   *                         nullable: true
   *                       processed_at:
   *                         type: string
   *                         nullable: true
   *                       rejection_reason:
   *                         type: string
   *                         nullable: true
   *                       created_at:
   *                         type: string
   *       '401':
   *         description: Unauthorized
   */
  app.get('/requests', {
    preHandler: requireUser,
    schema: {
      description: 'List withdraw requests',
      tags: ['Withdraw'],
      summary: 'List Withdraw Requests',
      operationId: 'listWithdrawRequests',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'processing', 'cancelled'] },
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
                  withdraw_type: { type: 'string' },
                  amount: { type: 'number' },
                  payment_method: { type: 'string' },
                  account_details: { type: 'string' },
                  status: { type: 'string' },
                  remarks: { type: ['string', 'null'] },
                  processed_at: { type: ['string', 'null'] },
                  rejection_reason: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                },
              },
            },
          },
        },
        500: apiErrorResponse,
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = { user_id: userId };
      if (query.status) where.status = query.status;
      if (query.withdraw_type) where.withdraw_type = query.withdraw_type;

      const [items, total] = await Promise.all([
        prisma.withdraw_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        prisma.withdraw_requests.count({ where }),
      ]);

      // Get withdrawal fees from ledger entries for approved/processing requests
      const approvedRequestIds = items
        .filter(r => r.status === 'approved' || r.status === 'processing')
        .map(r => r.id.toString());
      
      let feeMap = new Map<string, number>();
      if (approvedRequestIds.length > 0) {
        // Fetch all withdrawal ledger entries for this user
        // Filter by reference_type and reference_id in application code for better compatibility
        const allWithdrawalEntries = await prisma.ledger_entries.findMany({
          where: {
            receiver_user_id: userId,
            commission_type: 'FEE_DEDUCTION',
          },
          select: {
            id: true,
            metadata: true,
          },
        });
        
        // Filter and map request ID to withdrawal fee
        for (const entry of allWithdrawalEntries) {
          const metadata = entry.metadata as any;
          if (
            metadata?.reference_type === 'withdraw_request' &&
            metadata?.reference_id &&
            metadata?.withdrawal_fee &&
            approvedRequestIds.includes(metadata.reference_id)
          ) {
            feeMap.set(metadata.reference_id, Number(metadata.withdrawal_fee) || 0);
          }
        }
      }

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: items.map(item => ({
          id: item.id.toString(),
          user_id: item.user_id.toString(),
          withdraw_type: item.withdraw_type,
          amount: Number(item.amount),
          payment_method: item.payment_method,
          account_details: item.account_details,
          status: item.status,
          remarks: item.remarks,
          processed_at: item.processed_at?.toISOString() || null,
          rejection_reason: item.rejection_reason || null,
          created_at: item.created_at.toISOString(),
          withdrawal_fee: feeMap.get(item.id.toString()) || 0, // Add withdrawal fee (0 for pending/rejected)
        })),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * Get withdrawal rules for users (min/max limits, charges)
   */
  app.get('/rules', {
    preHandler: requireUser,
    schema: {
      description: 'Get withdrawal rules (min/max limits and charges)',
      tags: ['Withdraw'],
      summary: 'Get Withdraw Rules',
      response: {
        200: {
          type: 'object',
          properties: {
            min_withdraw: { type: 'number' },
            max_withdraw: { type: ['number', 'null'] },
            spot_min_withdraw: { type: 'number' },
            admin_charges: { type: 'number' },
            withdrawal_enabled: { type: 'boolean' },
          },
        },
        500: apiErrorResponse,
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (_req, reply) => {
    try {
      let rules: any = null;
      try {
        rules = await (prisma as any).withdrawal_transfer_rules.findFirst({
          where: { is_active: true },
          orderBy: { updated_at: 'desc' },
        });
      } catch (e) {
        // Table might not exist yet
        console.log('Withdrawal rules table not found, using defaults for /withdraw/rules');
      }

      // Default values (must match admin defaults)
      const minWithdraw = rules ? Number(rules.min_withdraw) : 100;
      const maxWithdraw = rules && rules.max_withdraw ? Number(rules.max_withdraw) : null;
      const spotMinWithdraw = rules && rules.spot_min_withdraw ? Number(rules.spot_min_withdraw) : minWithdraw;
      const adminCharges = rules ? Number(rules.admin_charges) : 0;
      // IMPORTANT: Use actual database value, not default true
      // withdrawal_enabled = true means "enabled for any date"
      // withdrawal_enabled = false means "date-based mode (15th & 30th only)"
      const withdrawalEnabled = rules ? Boolean(rules.withdrawal_enabled) : true;

      console.log('[Withdraw Rules API] Rules from DB:', {
        hasRules: !!rules,
        withdrawal_enabled: rules?.withdrawal_enabled,
        withdrawalEnabled,
      });

      return reply.send({
        min_withdraw: minWithdraw,
        max_withdraw: maxWithdraw,
        spot_min_withdraw: spotMinWithdraw,
        admin_charges: adminCharges,
        withdrawal_enabled: withdrawalEnabled,
      });
    } catch (error: any) {
      return reply.code(500).send({
        error: 'internal_server_error',
        message: error.message,
      });
    }
  });

  /**
   * @openapi
   * /api/v1/withdraw/requests:
   *   post:
   *     tags:
   *       - Withdraw
   *     summary: Create withdraw request
   *     description: |
   *       Create a new withdraw request. The amount will be deducted from the user's wallet
   *       when the request is approved. For spot withdrawals, only spot commission balance
   *       can be withdrawn.
   *     operationId: createWithdrawRequest
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *               - payment_method
   *               - account_details
   *             properties:
   *               amount:
   *                 type: number
   *                 minimum: 0.01
   *                 example: 5000.00
   *               payment_method:
   *                 type: string
   *                 example: "Bank Transfer"
   *               account_details:
   *                 type: string
   *                 example: "****1234 - HDFC Bank"
   *               remarks:
   *                 type: string
   *                 nullable: true
   *               withdraw_type:
   *                 type: string
   *                 enum: [wallet, spot]
   *                 default: wallet
   *     responses:
   *       '201':
   *         description: Withdraw request created successfully
   *       '400':
   *         description: Insufficient balance or validation error
   *       '401':
   *         description: Unauthorized
   */
  app.post('/requests', {
    preHandler: requireUser,
    schema: {
      description: 'Create withdraw request',
      tags: ['Withdraw'],
      summary: 'Create Withdraw Request',
      operationId: 'createWithdrawRequest',
      body: {
        type: 'object',
        required: ['amount', 'payment_method', 'account_details', 'transaction_password'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          payment_method: { type: 'string', minLength: 1 },
          account_details: { type: 'string', minLength: 1 },
          remarks: { type: 'string' },
          withdraw_type: { type: 'string', enum: ['wallet', 'spot', 'team_royalty'], default: 'wallet' },
          transaction_password: { type: 'string', minLength: 1, description: 'User transaction PIN' },
        },
      },
      security: [{ bearerAuth: [] }],
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            withdraw_type: { type: 'string' },
            amount: { type: 'number' },
            payment_method: { type: 'string' },
            account_details: { type: 'string' },
            status: { type: 'string' },
            created_at: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        403: apiErrorResponse,
        500: apiErrorResponse,
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = createWithdrawBody.parse(req.body);

      // Check KYC approval and transaction password - mandatory for withdrawals
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { kyc_status: true, transaction_pin: true, display_id: true, withdrawal_blocked: true }
      });

      // Admin may block withdrawal for this user specifically
      if (user?.withdrawal_blocked) {
        return reply.code(403).send({
          error: 'withdrawal_blocked',
          message: 'Withdrawal is disabled for your account. Please contact support.'
        });
      }

      // Check if transaction password is set
      if (!user || !user.transaction_pin) {
        return reply.code(400).send({
          error: 'transaction_password_not_set',
          message: 'Transaction password is required for withdrawals. Please set your transaction password first.'
        });
      }

      // Verify transaction password (trim both to handle whitespace issues)
      // Convert both to string and trim to ensure exact match
      const storedPin = String(user.transaction_pin || '').trim();
      const providedPin = String(body.transaction_password || '').trim();
      
      // Debug logging
      console.log('Transaction PIN verification:', {
        userId: userId.toString(),
        displayId: user.display_id,
        storedPin: storedPin,
        storedPinLength: storedPin.length,
        storedPinType: typeof storedPin,
        providedPin: providedPin,
        providedPinLength: providedPin.length,
        providedPinType: typeof providedPin,
        match: storedPin === providedPin,
        charCodes: {
          stored: storedPin.split('').map(c => c.charCodeAt(0)),
          provided: providedPin.split('').map(c => c.charCodeAt(0))
        }
      });
      
      if (storedPin !== providedPin) {
        return reply.code(400).send({
          error: 'invalid_transaction_password',
          message: 'Transaction password is incorrect'
        });
      }

      if (!user || user.kyc_status !== 'approved') {
        let errorMessage = 'KYC verification is required to create withdrawal requests';
        if (user) {
          if (user.kyc_status === 'rejected') {
            errorMessage = 'KYC is rejected. Please complete KYC verification to withdraw funds.';
          } else if (user.kyc_status === 'submitted') {
            errorMessage = 'KYC is submitted but not approved yet. Please wait for approval to withdraw funds.';
          } else if (user.kyc_status === 'pending') {
            errorMessage = 'KYC verification is required. Please complete KYC to withdraw funds.';
          }
        }
        return reply.code(400).send({
          error: 'kyc_not_approved',
          message: errorMessage
        });
      }

      // Check if user has any pending or processing withdrawal requests for the SAME wallet type
      // User can have one pending request from spot wallet AND one from main wallet simultaneously
      // But cannot create another request from the same wallet type until previous one is approved or rejected
      const existingRequest = await prisma.withdraw_requests.findFirst({
        where: {
          user_id: userId,
          withdraw_type: body.withdraw_type, // Check for same wallet type only
          status: {
            in: ['pending', 'processing']
          }
        },
        orderBy: { created_at: 'desc' }
      });

      if (existingRequest) {
        const walletTypeName = body.withdraw_type === 'spot' ? 'Spot Wallet' : body.withdraw_type === 'team_royalty' ? 'Team Royalty Wallet' : 'Main Wallet';
        return reply.code(400).send({
          error: 'pending_withdrawal_exists',
          message: `You already have a ${existingRequest.status} withdrawal request from ${walletTypeName}. Please wait for it to be approved or rejected before creating a new request from ${walletTypeName}.`,
          existing_request_id: existingRequest.id.toString(),
          existing_request_status: existingRequest.status,
          withdraw_type: body.withdraw_type
        });
      }

      // Check withdrawal toggle (admin control)
      let rules: any = null;
      try {
        rules = await (prisma as any).withdrawal_transfer_rules.findFirst({
          where: { is_active: true },
          orderBy: { updated_at: 'desc' },
        });
      } catch (e) {
        // Table might not exist yet
        console.log('Withdrawal transfer rules table not found');
      }

      const withdrawalEnabled = rules?.withdrawal_enabled ?? true;
      
      // Check time restrictions only if withdrawal is date-based (not enabled for any date)
      // If admin has enabled withdrawals for any date, skip time restrictions
      // Note: withdrawal_enabled = false means "date-based mode", not "disabled"
      if (!withdrawalEnabled) {
        const timeCheck = isWithdrawalTimeAllowed();
        if (!timeCheck.allowed) {
          return reply.code(400).send({
            error: 'withdrawal_time_not_allowed',
            message: timeCheck.message || 'Withdrawal is only allowed between 10:00 AM and 5:00 PM IST.'
          });
        }
      }

      // Get wallet balances and 10x limit (for Spot/Team Royalty)
      const [balance, networkLimit] = await Promise.all([
        prisma.user_balances.findUnique({
          where: { user_id: userId },
          select: { spot_balance: true, other_balance: true, team_royalty_balance: true, balance: true },
        }),
        (body.withdraw_type === 'spot' || body.withdraw_type === 'team_royalty')
          ? getSpotTeamWithdrawLimit(userId)
          : Promise.resolve(null),
      ]);

      const spotBalance = Number(balance?.spot_balance || 0);
      const otherBalance = Number(balance?.other_balance || 0);
      const teamRoyaltyBalance = Number(balance?.team_royalty_balance || 0);
      const totalBalance = Number(balance?.balance || 0);

      // SPOT 14-day hold: only amount released from hold is withdrawable
      const lockedSpotBalance = body.withdraw_type === 'spot' ? await getLockedSpotBalance(userId) : 0;
      const availableSpotBalance = Math.max(0, spotBalance - lockedSpotBalance);

      // Main wallet: reinvestment SELF+GLOBAL lock – only unlocked amount is withdrawable
      const mainLockedHold = body.withdraw_type === 'wallet' ? await getLockedMainBalance(userId) : 0;
      const availableMainBalance = Math.max(0, otherBalance - mainLockedHold);

      // 10x limit: Spot + Team Royalty withdrawals capped by (active package value × 10)
      // Also account for PENDING requests (not just approved ones)
      if (networkLimit && (body.withdraw_type === 'spot' || body.withdraw_type === 'team_royalty')) {
        // Sum pending Spot + Team Royalty requests (not yet approved)
        const pendingRequests = await prisma.withdraw_requests.findMany({
          where: {
            user_id: userId,
            status: 'pending',
            withdraw_type: { in: ['spot', 'team_royalty'] },
          },
          select: { amount: true },
        });
        const pendingAmount = pendingRequests.reduce((sum, r) => sum + Number(r.amount), 0);
        
        // Total used = approved (spot_team_withdraw_used) + pending requests
        const totalUsed = networkLimit.spot_team_withdraw_used + pendingAmount;
        const effectiveRemaining = Math.max(0, networkLimit.spot_team_withdraw_limit - totalUsed);
        
        if (body.amount > effectiveRemaining) {
          return reply.code(400).send({
            error: 'spot_team_withdraw_limit_exceeded',
            message: `Withdrawal from ${body.withdraw_type === 'spot' ? 'SPOT' : 'Team Royalty'} wallet cannot exceed your ${networkLimit.spot_team_withdraw_multiplier ?? 10}× package limit. Remaining limit: ₹${effectiveRemaining.toFixed(2)} (approved: ₹${networkLimit.spot_team_withdraw_used.toFixed(2)}, pending: ₹${pendingAmount.toFixed(2)}, total used: ₹${totalUsed.toFixed(2)} of ₹${networkLimit.spot_team_withdraw_limit.toFixed(2)}).`,
            spot_team_withdraw_remaining: effectiveRemaining,
            spot_team_withdraw_used: networkLimit.spot_team_withdraw_used,
            spot_team_withdraw_limit: networkLimit.spot_team_withdraw_limit,
            pending_amount: pendingAmount,
            total_used: totalUsed,
            requested_amount: body.amount,
          });
        }
      }

      let availableBalance = 0;
      let dateCheck: { allowed: boolean; allowedWallets: Array<'spot' | 'other' | 'team_royalty'>; message?: string } | null = null;

      // If withdrawal is enabled by admin, skip date restrictions and allow from any wallet
      if (withdrawalEnabled) {
        if (body.withdraw_type === 'spot') {
          availableBalance = availableSpotBalance;
          if (body.amount > availableSpotBalance) {
            return reply.code(400).send({
              error: 'insufficient_spot_balance',
              message: lockedSpotBalance > 0
                ? `Insufficient SPOT balance. Available to withdraw: ₹${availableSpotBalance.toFixed(2)} (₹${lockedSpotBalance.toFixed(2)} under 14-day hold).`
                : `Insufficient SPOT balance. Available: ₹${availableSpotBalance.toFixed(2)}`,
              available_balance: availableSpotBalance,
              spot_balance: spotBalance,
              spot_locked_hold: lockedSpotBalance,
              requested_amount: body.amount
            });
          }
        } else if (body.withdraw_type === 'team_royalty') {
          availableBalance = teamRoyaltyBalance;
          if (body.amount > teamRoyaltyBalance) {
            return reply.code(400).send({
              error: 'insufficient_team_royalty_balance',
              message: `Insufficient Team Royalty wallet balance. Available: ₹${teamRoyaltyBalance.toFixed(2)}`,
              available_balance: teamRoyaltyBalance,
              team_royalty_balance: teamRoyaltyBalance,
              requested_amount: body.amount
            });
          }
        } else {
          availableBalance = availableMainBalance;
          if (body.amount > availableMainBalance) {
            return reply.code(400).send({
              error: 'insufficient_other_balance',
              message: mainLockedHold > 0
                ? `Insufficient Main wallet balance. Available to withdraw: ₹${availableMainBalance.toFixed(2)} (₹${mainLockedHold.toFixed(2)} under reinvestment 90-day lock). You can withdraw only the unlocked amount.`
                : `Insufficient Main wallet balance. Available: ₹${availableMainBalance.toFixed(2)}`,
              available_balance: availableMainBalance,
              main_locked_hold: mainLockedHold,
              other_balance: otherBalance,
              requested_amount: body.amount
            });
          }
        }
        dateCheck = { allowed: true, allowedWallets: ['spot', 'other', 'team_royalty'] };
      } else {
        // Withdrawal is date-based - check date restrictions
        dateCheck = isWithdrawalDateAllowed();
        if (!dateCheck.allowed) {
          return reply.code(400).send({
            error: 'withdrawal_not_allowed',
            message: dateCheck.message || 'Withdrawal is only allowed on 10th, 20th and 30th of each month (28th in February).'
          });
        }

        // Validate based on date restrictions and wallet type
        const today = new Date();
        const day = today.getDate();
        const walletKey = body.withdraw_type === 'spot' ? 'spot' : body.withdraw_type === 'team_royalty' ? 'team_royalty' : 'other';

        const walletAllowed = dateCheck.allowedWallets.includes(walletKey as 'spot' | 'other' | 'team_royalty');
        if (!walletAllowed) {
          if (walletKey === 'spot') {
            return reply.code(400).send({
              error: 'wallet_not_allowed_on_date',
              message: `SPOT withdrawals are only allowed on 10th, 20th and 30th of each month (28th in February). Today is ${day}.`
            });
          } else if (walletKey === 'team_royalty') {
            return reply.code(400).send({
              error: 'wallet_not_allowed_on_date',
              message: `Team Royalty withdrawals are only allowed on 10th, 20th and 30th of each month (28th in February). Today is ${day}.`
            });
          } else {
            return reply.code(400).send({
              error: 'wallet_not_allowed_on_date',
              message: `Main balance withdrawals are only allowed on 30th of each month (28th in February). Today is ${day}.`
            });
          }
        }

        // Date and wallet allowed; validate balance per wallet
        if (body.withdraw_type === 'spot') {
          availableBalance = availableSpotBalance;
          if (body.amount > availableSpotBalance) {
            return reply.code(400).send({
              error: 'insufficient_spot_balance',
              message: lockedSpotBalance > 0
                ? `Insufficient SPOT balance. Available to withdraw: ₹${availableSpotBalance.toFixed(2)} (₹${lockedSpotBalance.toFixed(2)} under 14-day hold).`
                : `Insufficient SPOT balance. Available: ₹${availableSpotBalance.toFixed(2)}`,
              available_balance: availableSpotBalance,
              spot_balance: spotBalance,
              spot_locked_hold: lockedSpotBalance,
              requested_amount: body.amount
            });
          }
        } else if (body.withdraw_type === 'team_royalty') {
          availableBalance = teamRoyaltyBalance;
          if (body.amount > teamRoyaltyBalance) {
            return reply.code(400).send({
              error: 'insufficient_team_royalty_balance',
              message: `Insufficient Team Royalty wallet balance. Available: ₹${teamRoyaltyBalance.toFixed(2)}`,
              available_balance: teamRoyaltyBalance,
              team_royalty_balance: teamRoyaltyBalance,
              requested_amount: body.amount
            });
          }
        } else {
          availableBalance = availableMainBalance;
          if (body.amount > availableMainBalance) {
            return reply.code(400).send({
              error: 'insufficient_other_balance',
              message: mainLockedHold > 0
                ? `Insufficient Main wallet balance. Available to withdraw: ₹${availableMainBalance.toFixed(2)} (₹${mainLockedHold.toFixed(2)} under reinvestment 90-day lock). You can withdraw only the unlocked amount.`
                : `Insufficient Main wallet balance. Available: ₹${availableMainBalance.toFixed(2)}`,
              available_balance: availableMainBalance,
              main_locked_hold: mainLockedHold,
              other_balance: otherBalance,
              requested_amount: body.amount
            });
          }
        }
      }

      // Get active withdrawal/transfer rules (already fetched above)
      // Note: This will work after schema migration
      if (!rules) {
        try {
          rules = await (prisma as any).withdrawal_transfer_rules.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' },
          });
        } catch (e) {
          // Table might not exist yet, use default values
          console.log('Withdrawal rules table not found, using defaults');
        }
      }

      // Use default values if rules not found
      const baseMinWithdraw = rules ? Number(rules.min_withdraw) : 100;
      const spotMinWithdraw =
        rules && rules.spot_min_withdraw
          ? Number(rules.spot_min_withdraw)
          : baseMinWithdraw;
      const maxWithdraw = rules && rules.max_withdraw ? Number(rules.max_withdraw) : null;
      const adminCharges = rules ? Number(rules.admin_charges) : 0;

      // Select effective minimum based on withdraw type (team_royalty same as main/wallet)
      const effectiveMinWithdraw =
        body.withdraw_type === 'spot' ? spotMinWithdraw : baseMinWithdraw;

      // Validate withdrawal amount against rules
      if (body.amount < effectiveMinWithdraw) {
        return reply.code(400).send({
          error: 'amount_below_minimum',
          message: `Minimum withdrawal amount is ₹${effectiveMinWithdraw.toFixed(
            2
          )}. You requested ₹${body.amount.toFixed(2)}`,
          min_withdraw: effectiveMinWithdraw,
          requested_amount: body.amount,
        });
      }

      if (maxWithdraw !== null && body.amount > maxWithdraw) {
        return reply.code(400).send({
          error: 'amount_above_maximum',
          message: `Maximum withdrawal amount is ₹${maxWithdraw.toFixed(2)}. You requested ₹${body.amount.toFixed(2)}`,
          max_withdraw: maxWithdraw,
          requested_amount: body.amount,
        });
      }

      // Balance check already done above based on date restrictions

      // Get withdrawal processing fee (will be included in request amount, not deducted separately)
      // This is just for information/display purposes
      let withdrawalProcessingFee = 0;
      try {
        const processingFeeCheck = await FeeService.checkFeeApplicable(userId, 'WITHDRAWAL_PROCESSING');
        if (processingFeeCheck.applicable && processingFeeCheck.amount > 0) {
          withdrawalProcessingFee = processingFeeCheck.amount;
        }
      } catch (e) {
        // If WITHDRAWAL_PROCESSING rule doesn't exist, try FUND_WITHDRAW as fallback
        try {
          const fundWithdrawFeeCheck = await FeeService.checkFeeApplicable(userId, 'FUND_WITHDRAW');
          if (fundWithdrawFeeCheck.applicable && fundWithdrawFeeCheck.amount > 0) {
            withdrawalProcessingFee = fundWithdrawFeeCheck.amount;
          }
        } catch (e2) {
          // No fee rule found, fee will be 0
          console.log('No withdrawal processing fee rule found, using 0');
        }
      }

      // Wallet-specific balance (other_balance / spot_balance) already validated above.
      // We do not check totalBalance here; user_balances.balance can be out of sync with spot_balance + other_balance.
      // Dead block removed: totalBalance check was redundant and caused wrong "Insufficient balance" when total column was stale.
      if (false as boolean) {
        return reply.code(400).send({
          error: 'INSUFFICIENT_BALANCE',
          message: `Insufficient balance. Available: ₹${totalBalance.toFixed(2)}, Required: ₹${body.amount.toFixed(2)} (withdrawal amount - fee included)`,
          available_balance: totalBalance,
          spot_balance: spotBalance,
          other_balance: otherBalance,
          requested_amount: body.amount,
          withdrawal_processing_fee: withdrawalProcessingFee,
          withdrawal_fee_included: true, // Fee is included in request amount
          note: `Withdrawal fee (₹${withdrawalProcessingFee.toFixed(2)}) is included in the requested amount`,
        });
      }

      // NOTE: No separate fee deduction at request creation
      // Fee will be included in the withdrawal amount and handled at approval time
      // This prevents negative balance issues

      // Create withdraw request
      const request = await prisma.withdraw_requests.create({
        data: {
          user_id: userId,
          withdraw_type: body.withdraw_type,
          amount: body.amount,
          payment_method: body.payment_method,
          account_details: body.account_details,
          remarks: body.remarks,
          status: 'pending',
        },
      });

      return reply.code(201).send({
        id: request.id.toString(),
        user_id: request.user_id.toString(),
        withdraw_type: request.withdraw_type,
        amount: Number(request.amount),
        payment_method: request.payment_method,
        account_details: request.account_details,
        status: request.status,
        available_balances: {
          spot: spotBalance,
          other: otherBalance,
          total: totalBalance
        },
        allowed_wallets: dateCheck ? dateCheck.allowedWallets : ['spot', 'other'],
        created_at: request.created_at.toISOString(),
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
   * /api/v1/withdraw/requests/{id}:
   *   get:
   *     tags:
   *       - Withdraw
   *     summary: Get withdraw request details
   *     description: Retrieve details of a specific withdraw request
   *     operationId: getWithdrawRequest
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Withdraw request ID
   *     responses:
   *       '200':
   *         description: Withdraw request details
   *       '404':
   *         description: Request not found
   */
  app.get('/requests/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Get withdraw request details',
      tags: ['Withdraw'],
      summary: 'Get Withdraw Request',
      operationId: 'getWithdrawRequest',
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
            withdraw_type: { type: 'string' },
            amount: { type: 'number' },
            payment_method: { type: 'string' },
            account_details: { type: 'string' },
            status: { type: 'string' },
            remarks: { type: ['string', 'null'] },
            processed_at: { type: ['string', 'null'] },
            rejection_reason: { type: ['string', 'null'] },
            created_at: { type: 'string' },
          },
        },
        404: apiNotFoundResponse,
        500: apiErrorResponse,
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const requestId = BigInt((req.params as any).id);

      const request = await prisma.withdraw_requests.findFirst({
        where: {
          id: requestId,
          user_id: userId,
        },
      });

      if (!request) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      return reply.send({
        id: request.id.toString(),
        user_id: request.user_id.toString(),
        withdraw_type: request.withdraw_type,
        amount: Number(request.amount),
        payment_method: request.payment_method,
        account_details: request.account_details,
        status: request.status,
        remarks: request.remarks,
        processed_at: request.processed_at?.toISOString() || null,
        rejection_reason: request.rejection_reason || null,
        created_at: request.created_at.toISOString(),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/withdraw/requests/{id}:
   *   delete:
   *     tags:
   *       - Withdraw
   *     summary: Cancel withdraw request
   *     description: Cancel a pending withdraw request. Only pending requests can be cancelled.
   *     operationId: cancelWithdrawRequest
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Withdraw request ID
   *     responses:
   *       '200':
   *         description: Request cancelled successfully
   *       '400':
   *         description: Cannot cancel non-pending request
   *       '404':
   *         description: Request not found
   */
  app.delete('/requests/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Cancel withdraw request',
      tags: ['Withdraw'],
      summary: 'Cancel Withdraw Request',
      operationId: 'cancelWithdrawRequest',
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
          },
        },
        400: apiErrorResponse,
        404: apiNotFoundResponse,
        500: apiErrorResponse,
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const requestId = BigInt((req.params as any).id);

      const request = await prisma.withdraw_requests.findFirst({
        where: {
          id: requestId,
          user_id: userId,
        },
      });

      if (!request) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      if (request.status !== 'pending') {
        return reply.code(400).send({
          error: 'cannot_cancel',
          message: `Cannot cancel request with status: ${request.status}. Only pending requests can be cancelled.`,
        });
      }

      await prisma.withdraw_requests.update({
        where: { id: requestId },
        data: { status: 'cancelled' },
      });

      return reply.send({
        message: 'Request cancelled successfully',
        id: request.id.toString(),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });
}
