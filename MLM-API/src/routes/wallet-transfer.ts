import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import { addLedgerAndWallet } from '../utils/wallet.js';
import { newIdempotencyKey } from '../utils/idempotency.js';

const transferBody = z.object({
  to_user_id: z.coerce.bigint(),
  amount: z.coerce.number().positive('Amount must be positive'),
  from_wallet: z.enum(['spot', 'other', 'team_royalty']),
  remarks: z.string().optional(),
});

export async function walletTransferRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/wallet/transfer:
   *   post:
   *     tags:
   *       - Wallet Transfer
   *     summary: Transfer money to another user's wallet
   *     description: |
   *       Transfer money from your wallet to another user's wallet.
   *       Transfer rules (min/max amount, tax) will be applied automatically.
   *     operationId: transferWallet
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - to_user_id
   *               - amount
   *             properties:
   *               to_user_id:
   *                 type: string
   *                 description: User ID of the recipient
   *                 example: "10"
   *               amount:
   *                 type: number
   *                 minimum: 0.01
   *                 description: Transfer amount
   *                 example: 1000.00
   *               remarks:
   *                 type: string
   *                 description: Optional remarks
   *     responses:
   *       '200':
   *         description: Transfer completed successfully
   *       '400':
   *         description: Validation error or insufficient balance
   *       '404':
   *         description: Recipient user not found
   */
  app.post('/transfer', {
    preHandler: requireUser,
    schema: {
      description: 'Transfer money to another user wallet',
      tags: ['Wallet Transfer'],
      summary: 'Transfer Wallet',
      operationId: 'transferWallet',
      body: {
        type: 'object',
        required: ['to_user_id', 'amount', 'from_wallet'],
        properties: {
          to_user_id: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          from_wallet: { type: 'string', enum: ['spot', 'other', 'team_royalty'] },
          remarks: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            from_user_id: { type: 'string' },
            to_user_id: { type: 'string' },
            amount: { type: 'number' },
            tax_amount: { type: 'number' },
            net_amount: { type: 'number' },
            status: { type: 'string' },
            created_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const fromUserId = BigInt((req as any).user.user_id);
      const body = transferBody.parse(req.body);
      const toUserId = body.to_user_id;

      // Validate: Cannot transfer to self
      if (fromUserId === toUserId) {
        return reply.code(400).send({
          error: 'invalid_transfer',
          message: 'Cannot transfer to your own wallet',
        });
      }

      // Check if recipient user exists
      const recipient = await prisma.users.findUnique({
        where: { id: toUserId },
      });

      if (!recipient) {
        return reply.code(404).send({
          error: 'recipient_not_found',
          message: 'Recipient user not found',
        });
      }

      // Get active withdrawal/transfer rules
      const rules = await prisma.withdrawal_transfer_rules.findFirst({
        where: { is_active: true },
        orderBy: { updated_at: 'desc' },
      });

      // Use default values if rules not found
      const minTransferAmt = rules ? Number(rules.min_transfer_amt) : 10;
      const maxTransferAmt = rules && rules.max_transfer_amt ? Number(rules.max_transfer_amt) : null;
      const transferTaxPercent = rules ? Number(rules.transfer_amt_tax) : 0;

      // Validate transfer amount against rules
      if (body.amount < minTransferAmt) {
        return reply.code(400).send({
          error: 'amount_below_minimum',
          message: `Minimum transfer amount is ₹${minTransferAmt.toFixed(2)}. You requested ₹${body.amount.toFixed(2)}`,
          min_transfer_amt: minTransferAmt,
          requested_amount: body.amount,
        });
      }

      if (maxTransferAmt !== null && body.amount > maxTransferAmt) {
        return reply.code(400).send({
          error: 'amount_above_maximum',
          message: `Maximum transfer amount is ₹${maxTransferAmt.toFixed(2)}. You requested ₹${body.amount.toFixed(2)}`,
          max_transfer_amt: maxTransferAmt,
          requested_amount: body.amount,
        });
      }

      // Calculate tax amount
      const taxAmount = (body.amount * transferTaxPercent) / 100;
      const netAmount = body.amount - taxAmount; // Amount received by recipient
      const totalDeductible = body.amount + taxAmount; // Total deducted from sender (transfer amount + tax)

      // Check sender's wallet balance in specified wallet
      const senderBalance = await prisma.user_balances.findUnique({
        where: { user_id: fromUserId },
        select: { spot_balance: true, other_balance: true, team_royalty_balance: true },
      });

      const availableBalance = body.from_wallet === 'spot'
        ? Number(senderBalance?.spot_balance || 0)
        : body.from_wallet === 'team_royalty'
          ? Number(senderBalance?.team_royalty_balance || 0)
          : Number(senderBalance?.other_balance || 0);

      if (totalDeductible > availableBalance) {
        return reply.code(400).send({
          error: 'insufficient_balance',
          message: `Insufficient ${body.from_wallet} balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${totalDeductible.toFixed(2)}`,
          available_balance: availableBalance,
          from_wallet: body.from_wallet,
          required_amount: totalDeductible,
        });
      }

      // Perform transfer in transaction
      const transfer = await prisma.$transaction(async (tx) => {
        // Use advisory lock for both users to prevent race conditions
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1));',
          `user:${fromUserId.toString()}`
        );
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1));',
          `user:${toUserId.toString()}`
        );

        const transferIdempotencyKey = newIdempotencyKey(`transfer:${fromUserId}:${toUserId}:${Date.now()}`);

        // 1. Create ledger entry for sender debit (transfer amount)
        const senderLedger = await tx.ledger_entries.create({
          data: {
            receiver_user_id: fromUserId,
            source_user_id: fromUserId,
            purchase_id: null,
            commission_type: 'FEE_DEDUCTION',
            amount: -body.amount, // Negative for debit
            metadata: {
              transfer_type: 'wallet_transfer',
              to_user_id: toUserId.toString(),
              transfer_amount: body.amount,
              from_wallet: body.from_wallet,
              wallet_type: body.from_wallet === 'spot' ? 'spot_balance' : 'other_balance',
            },
            idempotency_key: `${transferIdempotencyKey}:from`,
          },
        });

        // 2. Create ledger entry for tax deduction (if tax > 0)
        let taxLedger = null;
        if (taxAmount > 0) {
          taxLedger = await tx.ledger_entries.create({
            data: {
              receiver_user_id: fromUserId,
              source_user_id: fromUserId,
              purchase_id: null,
              commission_type: 'FEE_DEDUCTION',
              amount: -taxAmount, // Negative for debit
              metadata: {
                transfer_type: 'wallet_transfer_tax',
                to_user_id: toUserId.toString(),
                tax_percent: transferTaxPercent,
                tax_amount: taxAmount,
              },
              idempotency_key: `${transferIdempotencyKey}:tax`,
            },
          });
        }

        // 3. Create ledger entry for recipient credit (net amount) - goes to other_balance
        const recipientLedger = await tx.ledger_entries.create({
          data: {
            receiver_user_id: toUserId,
            source_user_id: fromUserId,
            purchase_id: null,
            commission_type: 'FEE_DEDUCTION', // Using FEE_DEDUCTION type but with positive amount for transfer credit
            amount: netAmount, // Positive for credit
            metadata: {
              transfer_type: 'wallet_transfer',
              from_user_id: fromUserId.toString(),
              transfer_amount: body.amount,
              tax_amount: taxAmount,
              net_amount: netAmount,
              wallet_type: 'other_balance', // Always goes to other_balance
            },
            idempotency_key: `${transferIdempotencyKey}:to`,
          },
        });

        // 4. Create wallet transactions
        // Sender debit (transfer amount)
        await tx.wallet_transactions.create({
          data: {
            receiver_user_id: fromUserId,
            ledger_entry_id: senderLedger.id,
            amount: -body.amount,
            idempotency_key: `${transferIdempotencyKey}:from:wallet`,
          },
        });

        // Sender debit (tax)
        if (taxAmount > 0 && taxLedger) {
          await tx.wallet_transactions.create({
            data: {
              receiver_user_id: fromUserId,
              ledger_entry_id: taxLedger.id,
              amount: -taxAmount,
              idempotency_key: `${transferIdempotencyKey}:tax:wallet`,
            },
          });
        }

        // Recipient credit (net amount)
        await tx.wallet_transactions.create({
          data: {
            receiver_user_id: toUserId,
            ledger_entry_id: recipientLedger.id,
            amount: netAmount,
            idempotency_key: `${transferIdempotencyKey}:to:wallet`,
          },
        });

        // 5. Update balances using raw SQL for atomic operations
        const spotDeducted = body.from_wallet === 'spot' ? totalDeductible : 0;
        const otherDeducted = body.from_wallet === 'other' ? totalDeductible : 0;
        const teamRoyaltyDeducted = body.from_wallet === 'team_royalty' ? totalDeductible : 0;

        await tx.$executeRawUnsafe(
          `UPDATE user_balances 
           SET balance = balance - $1::numeric, 
               spot_balance = spot_balance - $2::numeric, 
               other_balance = other_balance - $3::numeric,
               team_royalty_balance = team_royalty_balance - $4::numeric,
               updated_at = NOW() 
           WHERE user_id = $5`,
          totalDeductible.toString(),
          spotDeducted.toString(),
          otherDeducted.toString(),
          teamRoyaltyDeducted.toString(),
          fromUserId.toString()
        );

        // Increment recipient balance to other_balance only (net amount after tax)
        await tx.user_balances.upsert({
          where: { user_id: toUserId },
          update: { updated_at: new Date() },
          create: {
            user_id: toUserId,
            balance: 0,
            spot_balance: 0,
            other_balance: 0,
          },
        });
        
        // Use raw SQL to increment balance to other_balance only
        await tx.$executeRawUnsafe(
          `UPDATE user_balances 
           SET balance = balance + $1::numeric, 
               other_balance = other_balance + $1::numeric, 
               updated_at = NOW() 
           WHERE user_id = $2`,
          netAmount.toString(),
          toUserId.toString()
        );

        // 6. Create transfer record
        const transferRecord = await (tx as any).wallet_transfers.create({
          data: {
            from_user_id: fromUserId,
            to_user_id: toUserId,
            amount: body.amount,
            tax_amount: taxAmount,
            net_amount: netAmount,
            status: 'completed',
            remarks: body.remarks,
          },
        });

        return transferRecord;
      });

      return reply.send({
        id: transfer.id.toString(),
        from_user_id: transfer.from_user_id.toString(),
        to_user_id: transfer.to_user_id.toString(),
        amount: Number(transfer.amount),
        tax_amount: Number(transfer.tax_amount),
        net_amount: Number(transfer.net_amount),
        status: transfer.status,
        created_at: transfer.created_at.toISOString(),
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
   * /api/v1/wallet/transfer/history:
   *   get:
   *     tags:
   *       - Wallet Transfer
   *     summary: Get wallet transfer history
   *     description: |
   *       Retrieve transfer history for the authenticated user (both sent and received).
   *     operationId: getTransferHistory
   *     security:
   *       - bearerAuth: []
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
   *         name: type
   *         schema:
   *           type: string
   *           enum: [sent, received]
   *         description: Filter by transfer type
   *     responses:
   *       '200':
   *         description: Transfer history retrieved successfully
   */
  app.get('/transfer/history', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet transfer history',
      tags: ['Wallet Transfer'],
      summary: 'Get Transfer History',
      operationId: 'getTransferHistory',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          type: { type: 'string', enum: ['sent', 'received'] },
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
                  from_user_id: { type: 'string' },
                  from_user_name: { type: ['string', 'null'] },
                  to_user_id: { type: 'string' },
                  to_user_name: { type: ['string', 'null'] },
                  amount: { type: 'number' },
                  tax_amount: { type: 'number' },
                  net_amount: { type: 'number' },
                  status: { type: 'string' },
                  remarks: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                  transfer_type: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (query.type === 'sent') {
        where.from_user_id = userId;
      } else if (query.type === 'received') {
        where.to_user_id = userId;
      } else {
        // Get both sent and received
        where.OR = [
          { from_user_id: userId },
          { to_user_id: userId },
        ];
      }

      const [items, total] = await Promise.all([
        (prisma as any).wallet_transfers.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        (prisma as any).wallet_transfers.count({ where }),
      ]);

      // Get user details
      const userIds = [
        ...new Set<string>([
          ...items.map((i: any) => i.from_user_id.toString()),
          ...items.map((i: any) => i.to_user_id.toString()),
        ]),
      ].map(id => BigInt(id));

      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id.toString(), u]));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: items.map((item: any) => {
          const fromUser = userMap.get(item.from_user_id.toString());
          const toUser = userMap.get(item.to_user_id.toString());
          const isSent = item.from_user_id === userId;
          
          return {
            id: item.id.toString(),
            from_user_id: item.from_user_id.toString(),
            from_user_name: fromUser?.name || null,
            to_user_id: item.to_user_id.toString(),
            to_user_name: toUser?.name || null,
            amount: Number(item.amount),
            tax_amount: Number(item.tax_amount),
            net_amount: Number(item.net_amount),
            status: item.status,
            remarks: item.remarks,
            created_at: item.created_at.toISOString(),
            transfer_type: isSent ? 'sent' : 'received',
          };
        }),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });
}

