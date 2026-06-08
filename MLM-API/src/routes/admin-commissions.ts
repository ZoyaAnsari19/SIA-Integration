import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { addLedgerAndWallet } from '../utils/wallet.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';

export async function adminCommissionsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/users/{id}/commissions:
   *   get:
   *     tags:
   *       - Admin Commissions
   *     summary: View any user's commission history (Admin)
   *     description: |
   *       Admin endpoint to retrieve complete commission history for any user with pagination and filtering options.
   *       Returns all commission types (SELF, GLOBAL_HELPING, SPOT, MONTHLY) from ledger entries.
   *     operationId: adminGetUserCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *         description: Filter by commission type
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter from this date
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter until this date
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [credited_at, amount]
   *           default: credited_at
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
   *         description: Commission history retrieved successfully
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
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
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
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
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
  app.get('/users/:id/commissions', {
    preHandler: adminAuth,
    schema: {
      description: 'Get any user commission history with pagination and filters (Admin)',
      tags: ['Admin Commissions'],
      summary: 'Get User Commissions (Admin)',
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
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'SPOT', 'MONTHLY'] },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          sort: { type: 'string', enum: ['credited_at', 'amount'], default: 'credited_at' },
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
                  commission_type: { type: 'string' },
                  amount: { type: 'number' },
                  source_user_id: { type: 'string' },
                  source_user_name: { type: ['string', 'null'] },
                  purchase_id: { type: ['string', 'null'] },
                  level: { type: ['number', 'null'] },
                  credited_at: { type: 'string', format: 'date-time' },
                  settled: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const commissionType = (req.query as any).commission_type;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const sort = (req.query as any).sort || 'credited_at';
      const order = (req.query as any).order || 'desc';

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { receiver_user_id: userId };
      if (commissionType) {
        where.commission_type = commissionType;
      }
      if (startDate || endDate) {
        where.credited_at = {};
        if (startDate) {
          where.credited_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.credited_at.lte = new Date(endDate);
        }
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where,
          orderBy: { [sort]: order },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where }),
      ]);

      // Get source user names
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = commissions.map(commission => {
        const metadata = commission.metadata as any;
        return {
          id: commission.id.toString(),
          commission_type: commission.commission_type,
          amount: Number(commission.amount),
          source_user_id: commission.source_user_id.toString(),
          source_user_name: userMap.get(commission.source_user_id.toString()) ?? null,
          purchase_id: commission.purchase_id ? commission.purchase_id.toString() : null,
          level: metadata?.level ?? null,
          credited_at: commission.credited_at,
          settled: commission.settled,
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
      console.error('Error getting user commissions (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/commissions/manual-credit:
   *   post:
   *     tags:
   *       - Admin Commissions
   *     summary: Manually credit commission to user (Admin)
   *     description: |
   *       Admin endpoint to manually credit a commission to a user.
   *       Creates ledger entry and wallet transaction, updates user balance.
   *     operationId: adminManualCredit
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - amount
   *               - commission_type
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "2"
   *                 description: User ID to credit
   *               amount:
   *                 type: number
   *                 example: 100.00
   *                 description: Amount to credit
   *               commission_type:
   *                 type: string
   *                 enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                 example: "SPOT"
   *                 description: Commission type
   *               source_user_id:
   *                 type: string
   *                 nullable: true
   *                 example: "5"
   *                 description: Source user ID (optional, defaults to user_id)
   *               purchase_id:
   *                 type: string
   *                 nullable: true
   *                 example: "10"
   *                 description: Purchase ID (optional)
   *               reason:
   *                 type: string
   *                 nullable: true
   *                 example: "Manual adjustment"
   *                 description: Reason for manual credit
   *     responses:
   *       '200':
   *         description: Commission credited successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Commission credited successfully"
   *                 ledger_entry_id:
   *                   type: string
   *                   example: "1"
   *                 wallet_transaction_id:
   *                   type: string
   *                   example: "1"
   *                 new_balance:
   *                   type: number
   *                   example: 100.00
   *       '400':
   *         description: Bad request
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.post('/commissions/manual-credit', {
    preHandler: adminAuth,
    schema: {
      description: 'Manually credit commission to user (Admin)',
      tags: ['Admin Commissions'],
      summary: 'Manual Commission Credit',
      body: {
        type: 'object',
        required: ['user_id', 'amount', 'commission_type'],
        properties: {
          user_id: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'SPOT', 'MONTHLY'] },
          source_user_id: { type: ['string', 'null'] },
          purchase_id: { type: ['string', 'null'] },
          reason: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ledger_entry_id: { type: 'string' },
            wallet_transaction_id: { type: 'string' },
            new_balance: { type: 'number' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { user_id, amount, commission_type, source_user_id, purchase_id, reason } = req.body as any;

      const receiverId = BigInt(user_id);
      const sourceId = source_user_id ? BigInt(source_user_id) : receiverId;
      const purchaseId = purchase_id ? BigInt(purchase_id) : null;

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: receiverId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Generate idempotency key
      const idempotencyKey = `admin-manual-credit-${receiverId}-${Date.now()}-${Math.random()}`;

      // Create ledger entry and wallet transaction
      const ledger = await addLedgerAndWallet({
        receiverId,
        sourceId,
        purchaseId,
        amount,
        type: commission_type,
        metadata: reason ? { reason, admin_manual: true } : { admin_manual: true },
        idempotencyKey,
        creditedAt: new Date(),
      });

      // Get wallet transaction
      const walletTransaction = await prisma.wallet_transactions.findFirst({
        where: { ledger_entry_id: ledger.id },
      });

      // Get updated balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: receiverId },
      });

      return reply.send({
        success: true,
        message: 'Commission credited successfully',
        ledger_entry_id: ledger.id.toString(),
        wallet_transaction_id: walletTransaction?.id.toString() ?? null,
        new_balance: Number(balance?.balance || 0),
      });
    } catch (error) {
      console.error('Error manually crediting commission:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/commissions/manual-debit:
   *   post:
   *     tags:
   *       - Admin Commissions
   *     summary: Manually debit from user wallet (Admin)
   *     description: |
   *       Admin endpoint to manually debit amount from a user's wallet.
   *       Creates a negative ledger entry and wallet transaction, updates user balance.
   *     operationId: adminManualDebit
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - amount
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "2"
   *                 description: User ID to debit
   *               amount:
   *                 type: number
   *                 example: 50.00
   *                 description: Amount to debit (positive number)
   *               reason:
   *                 type: string
   *                 nullable: true
   *                 example: "Manual adjustment"
   *                 description: Reason for manual debit
   *     responses:
   *       '200':
   *         description: Amount debited successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Amount debited successfully"
   *                 ledger_entry_id:
   *                   type: string
   *                   example: "1"
   *                 wallet_transaction_id:
   *                   type: string
   *                   example: "1"
   *                 new_balance:
   *                   type: number
   *                   example: 50.00
   *       '400':
   *         description: Bad request (insufficient balance)
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.post('/commissions/manual-debit', {
    preHandler: adminAuth,
    schema: {
      description: 'Manually debit from user wallet (Admin)',
      tags: ['Admin Commissions'],
      summary: 'Manual Commission Debit',
      body: {
        type: 'object',
        required: ['user_id', 'amount'],
        properties: {
          user_id: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          reason: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ledger_entry_id: { type: 'string' },
            wallet_transaction_id: { type: 'string' },
            new_balance: { type: 'number' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { user_id, amount, reason } = req.body as any;

      const userId = BigInt(user_id);
      const debitAmount = Math.abs(amount); // Ensure positive

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Check current balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
      });
      const currentBalance = Number(balance?.balance || 0);

      if (currentBalance < debitAmount) {
        return reply.code(400).send({
          error: 'Insufficient balance',
          current_balance: currentBalance,
          requested_debit: debitAmount,
        });
      }

      // Generate idempotency key
      const idempotencyKey = `admin-manual-debit-${userId}-${Date.now()}-${Math.random()}`;

      // Create negative ledger entry and wallet transaction
      return await prisma.$transaction(async (tx) => {
        // Per-user advisory lock
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1));',
          `user:${userId.toString()}`
        );

        // Idempotency check
        const existing = await tx.ledger_entries.findFirst({
          where: { idempotency_key: idempotencyKey },
        });
        if (existing) {
          const existingWallet = await tx.wallet_transactions.findFirst({
            where: { ledger_entry_id: existing.id },
          });
          const updatedBalance = await tx.user_balances.findUnique({
            where: { user_id: userId },
          });
          return reply.send({
            success: true,
            message: 'Debit already processed',
            ledger_entry_id: existing.id.toString(),
            wallet_transaction_id: existingWallet?.id.toString() ?? null,
            new_balance: Number(updatedBalance?.balance || 0),
          });
        }

        // Create ledger entry (using SELF type for manual debit, negative amount)
        const ledger = await tx.ledger_entries.create({
          data: {
            receiver_user_id: userId,
            source_user_id: userId, // Self debit
            purchase_id: null,
            commission_type: 'SELF', // Using SELF type for manual operations
            amount: -debitAmount, // Negative amount
            metadata: reason ? { reason, admin_manual: true, debit: true } : { admin_manual: true, debit: true },
            idempotency_key: idempotencyKey,
            credited_at: new Date(),
            settled: true,
          },
        });

        // Create wallet transaction (negative amount)
        const walletTransaction = await tx.wallet_transactions.create({
          data: {
            receiver_user_id: userId,
            ledger_entry_id: ledger.id,
            amount: -debitAmount, // Negative amount
            idempotency_key: idempotencyKey,
          },
        });

        // Update balance (decrement)
        await tx.user_balances.upsert({
          where: { user_id: userId },
          update: { updated_at: new Date() },
          create: { user_id: userId, balance: 0 },
        });

        // Use raw SQL to decrement balance
        await tx.$executeRawUnsafe(
          'UPDATE user_balances SET balance = balance - $1, updated_at = now() WHERE user_id = $2',
          debitAmount,
          userId
        );

        // Get updated balance
        const updatedBalance = await tx.user_balances.findUnique({
          where: { user_id: userId },
        });

        return reply.send({
          success: true,
          message: 'Amount debited successfully',
          ledger_entry_id: ledger.id.toString(),
          wallet_transaction_id: walletTransaction.id.toString(),
          new_balance: Number(updatedBalance?.balance || 0),
        });
      });
    } catch (error) {
      console.error('Error manually debiting:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/wallet/manage:
   *   post:
   *     tags:
   *       - Admin Commissions
   *     summary: Manage user wallet (Admin Operations)
   *     description: |
   *       Admin endpoint to add or subtract amounts from user's main wallet (other_balance) and spot wallet (spot_balance).
   *       Creates ledger entries with type ADMIN_OPS for audit trail.
   *     operationId: adminManageWallet
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - main_wallet_amount
   *               - spot_wallet_amount
   *             properties:
   *               user_id:
   *                 type: string
   *                 example: "2"
   *                 description: User ID to manage wallet for
   *               main_wallet_amount:
   *                 type: number
   *                 example: 100.00
   *                 description: Amount to add/subtract from main wallet (positive to add, negative to subtract)
   *               spot_wallet_amount:
   *                 type: number
   *                 example: 50.00
   *                 description: Amount to add/subtract from spot wallet (positive to add, negative to subtract)
   *               reason:
   *                 type: string
   *                 nullable: true
   *                 example: "Admin adjustment"
   *                 description: Reason for wallet adjustment
   *     responses:
   *       '200':
   *         description: Wallet managed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Wallet managed successfully"
   *                 ledger_entry_ids:
   *                   type: array
   *                   items:
   *                     type: string
   *                 new_main_balance:
   *                   type: number
   *                   example: 1100.00
   *                 new_spot_balance:
   *                   type: number
   *                   example: 550.00
   *       '400':
   *         description: Bad request (insufficient balance for negative amounts)
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.post('/wallet/manage', {
    preHandler: [adminAuth, checkPermission('WALLET_MANAGE')],
    schema: {
      description: 'Manage user wallet - add/subtract from main and spot wallets (Admin Operations)',
      tags: ['Admin Commissions'],
      summary: 'Manage Wallet',
      body: {
        type: 'object',
        required: ['user_id', 'main_wallet_amount', 'spot_wallet_amount'],
        properties: {
          user_id: { type: 'string' },
          main_wallet_amount: { type: 'number' },
          spot_wallet_amount: { type: 'number' },
          team_royalty_wallet_amount: { type: 'number' },
          reason: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            ledger_entry_ids: { type: 'array', items: { type: 'string' } },
            new_main_balance: { type: 'number' },
            new_spot_balance: { type: 'number' },
            new_team_royalty_balance: { type: 'number' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { user_id, main_wallet_amount, spot_wallet_amount, team_royalty_wallet_amount, reason } = req.body as any;

      const userId = BigInt(user_id);
      const mainAmount = Number(main_wallet_amount) || 0;
      const spotAmount = Number(spot_wallet_amount) || 0;
      const teamRoyaltyAmount = Number(team_royalty_wallet_amount) ?? 0;

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get current balances (for logging / audit only, NOT for blocking negatives)
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
      });
      const currentMainBalance = Number(balance?.other_balance || 0);
      const currentSpotBalance = Number(balance?.spot_balance || 0);
      const currentTeamRoyaltyBalance = Number((balance as any)?.team_royalty_balance || 0);

      // Generate idempotency keys
      const mainIdempotencyKey = `admin-manage-wallet-main-${userId}-${Date.now()}-${Math.random()}`;
      const spotIdempotencyKey = `admin-manage-wallet-spot-${userId}-${Date.now()}-${Math.random()}`;
      const teamRoyaltyIdempotencyKey = `admin-manage-wallet-team-royalty-${userId}-${Date.now()}-${Math.random()}`;

      // Process wallet adjustments in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Per-user advisory lock
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1));',
          `user:${userId.toString()}`
        );

        const ledgerEntryIds: string[] = [];

        // Process main wallet adjustment if amount is not zero
        if (mainAmount !== 0) {
          // Idempotency check for main wallet
          const existingMain = await tx.ledger_entries.findFirst({
            where: { idempotency_key: mainIdempotencyKey },
          });

          if (!existingMain) {
            // Create ledger entry for main wallet
            const mainLedger = await tx.ledger_entries.create({
              data: {
                receiver_user_id: userId,
                source_user_id: userId,
                purchase_id: null,
                commission_type: 'ADMIN_OPS',
                amount: mainAmount,
                metadata: {
                  wallet_type: 'other_balance',
                  admin_ops: true,
                  reason: reason || 'Admin wallet adjustment',
                } as any,
                idempotency_key: mainIdempotencyKey,
              },
            });
            ledgerEntryIds.push(mainLedger.id.toString());

            // Create wallet transaction
            await tx.wallet_transactions.create({
              data: {
                receiver_user_id: userId,
                ledger_entry_id: mainLedger.id,
                amount: mainAmount,
                idempotency_key: mainIdempotencyKey,
              },
            });
          } else {
            ledgerEntryIds.push(existingMain.id.toString());
          }
        }

        // Process spot wallet adjustment if amount is not zero
        if (spotAmount !== 0) {
          // Idempotency check for spot wallet
          const existingSpot = await tx.ledger_entries.findFirst({
            where: { idempotency_key: spotIdempotencyKey },
          });

          if (!existingSpot) {
            // Create ledger entry for spot wallet
            const spotLedger = await tx.ledger_entries.create({
              data: {
                receiver_user_id: userId,
                source_user_id: userId,
                purchase_id: null,
                commission_type: 'ADMIN_OPS',
                amount: spotAmount,
                metadata: {
                  wallet_type: 'spot_balance',
                  admin_ops: true,
                  reason: reason || 'Admin wallet adjustment',
                } as any,
                idempotency_key: spotIdempotencyKey,
              },
            });
            ledgerEntryIds.push(spotLedger.id.toString());

            // Create wallet transaction
            await tx.wallet_transactions.create({
              data: {
                receiver_user_id: userId,
                ledger_entry_id: spotLedger.id,
                amount: spotAmount,
                idempotency_key: spotIdempotencyKey,
              },
            });
          } else {
            ledgerEntryIds.push(existingSpot.id.toString());
          }
        }

        // Process team royalty wallet adjustment if amount is not zero
        if (teamRoyaltyAmount !== 0) {
          const existingTeamRoyalty = await tx.ledger_entries.findFirst({
            where: { idempotency_key: teamRoyaltyIdempotencyKey },
          });

          if (!existingTeamRoyalty) {
            const teamRoyaltyLedger = await tx.ledger_entries.create({
              data: {
                receiver_user_id: userId,
                source_user_id: userId,
                purchase_id: null,
                commission_type: 'ADMIN_OPS',
                amount: teamRoyaltyAmount,
                metadata: {
                  wallet_type: 'team_royalty_balance',
                  admin_ops: true,
                  reason: reason || 'Admin wallet adjustment',
                } as any,
                idempotency_key: teamRoyaltyIdempotencyKey,
              },
            });
            ledgerEntryIds.push(teamRoyaltyLedger.id.toString());

            await tx.wallet_transactions.create({
              data: {
                receiver_user_id: userId,
                ledger_entry_id: teamRoyaltyLedger.id,
                amount: teamRoyaltyAmount,
                idempotency_key: teamRoyaltyIdempotencyKey,
              },
            });
          } else {
            ledgerEntryIds.push(existingTeamRoyalty.id.toString());
          }
        }

        // Update user balances
        await tx.user_balances.upsert({
          where: { user_id: userId },
          update: { updated_at: new Date() },
          create: { user_id: userId, balance: 0, spot_balance: 0, other_balance: 0, team_royalty_balance: 0 },
        });

        // Update balances using raw SQL to avoid decimal math issues
        // Update main wallet if amount is not zero
        if (mainAmount !== 0) {
          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET balance = balance + $1,
                 other_balance = other_balance + $1,
                 updated_at = now() 
             WHERE user_id = $2`,
            mainAmount,
            userId
          );
        }
        
        // Update spot wallet if amount is not zero
        if (spotAmount !== 0) {
          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET balance = balance + $1,
                 spot_balance = spot_balance + $1,
                 updated_at = now() 
             WHERE user_id = $2`,
            spotAmount,
            userId
          );
        }

        // Update team royalty wallet if amount is not zero
        if (teamRoyaltyAmount !== 0) {
          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET balance = balance + $1,
                 team_royalty_balance = team_royalty_balance + $1,
                 updated_at = now() 
             WHERE user_id = $2`,
            teamRoyaltyAmount,
            userId
          );
        }

        // Get updated balances
        const updatedBalance = await tx.user_balances.findUnique({
          where: { user_id: userId },
        });

        return {
          ledgerEntryIds,
          newMainBalance: Number(updatedBalance?.other_balance || 0),
          newSpotBalance: Number(updatedBalance?.spot_balance || 0),
          newTeamRoyaltyBalance: Number((updatedBalance as any)?.team_royalty_balance || 0),
        };
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
          actionType: 'WALLET_MANAGE',
          targetUserId: userId,
          targetEntityType: 'wallet',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: targetUser?.display_id || null,
            user_name: targetUser?.name || null,
            main_wallet_amount: mainAmount,
            spot_wallet_amount: spotAmount,
            team_royalty_wallet_amount: teamRoyaltyAmount,
            old_main_balance: currentMainBalance,
            old_spot_balance: currentSpotBalance,
            old_team_royalty_balance: currentTeamRoyaltyBalance,
            new_main_balance: result.newMainBalance,
            new_spot_balance: result.newSpotBalance,
            new_team_royalty_balance: result.newTeamRoyaltyBalance,
            reason: reason || null,
            ledger_entry_ids: result.ledgerEntryIds,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        success: true,
        message: 'Wallet managed successfully',
        ledger_entry_ids: result.ledgerEntryIds,
        new_main_balance: result.newMainBalance,
        new_spot_balance: result.newSpotBalance,
        new_team_royalty_balance: result.newTeamRoyaltyBalance,
      });
    } catch (error: any) {
      console.error('Error managing wallet:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error message:', error?.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Log failed activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        try {
          const { ipAddress, userAgent } = getRequestInfo(req);
          const { user_id } = req.body as any;
          const userId = user_id ? BigInt(user_id) : null;
          const { main_wallet_amount, spot_wallet_amount, reason } = req.body as any;
          
          logAdminActivity({
            adminUserId: BigInt(admin.user_id),
            actionType: 'WALLET_MANAGE',
            targetUserId: userId || undefined,
            targetEntityType: 'wallet',
            targetEntityId: userId?.toString() || null,
            actionDetails: {
              main_wallet_amount: main_wallet_amount || 0,
              spot_wallet_amount: spot_wallet_amount || 0,
              reason: reason || null,
            },
            ipAddress,
            userAgent,
            status: 'failed',
            errorMessage: error?.message || 'Unknown error',
          });
        } catch (logError) {
          console.error('Error logging failed activity:', logError);
        }
      }
      
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });
}

