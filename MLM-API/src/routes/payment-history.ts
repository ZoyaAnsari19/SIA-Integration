import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';

export async function paymentHistoryRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/payment-history:
   *   get:
   *     tags:
   *       - Payment History
   *     summary: Get wallet transaction history
   *     description: |
   *       Retrieve wallet transaction history for the authenticated user with pagination and filters.
   *       Supports filtering by date range and sorting options.
   *     operationId: getPaymentHistory
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
   *           enum: [created_at, amount]
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
   *         description: Payment history retrieved successfully
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
   *                       amount:
   *                         type: number
   *                         example: 5000.00
   *                       ledger_entry_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *                       commission_type:
   *                         type: string
   *                         nullable: true
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet transaction history with pagination and filters',
      tags: ['Payment History'],
      summary: 'Get Payment History',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          sort: { type: 'string', enum: ['created_at', 'amount'], default: 'created_at' },
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
                  transaction_id: { type: 'string' },
                  utr: { type: 'string' },
                  amount: { type: 'number' },
                  payment_method: { type: 'string' },
                  account_details: { type: 'string' },
                  status: { type: 'string', enum: ['successful', 'failed', 'pending'] },
                  payment_date: { type: 'string', format: 'date-time' },
                  request_id: { type: ['string', 'null'] },
                  remarks: { type: ['string', 'null'] },
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
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const sort = (req.query as any).sort || 'created_at';
      const order = (req.query as any).order || 'desc';

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Build date filter
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }

      // Fetch purchase_requests (manual deposits) - only pending/rejected (approved ones created purchases, so we skip them to avoid duplicates)
      const purchaseRequestWhere: any = { 
        user_id: userId,
        status: { in: ['pending', 'rejected'] }, // Only show pending/rejected, approved ones are already in purchases
      };
      if (startDate || endDate) {
        purchaseRequestWhere.created_at = dateFilter;
      }

      // Fetch purchases (completed payments) - fetch all, we'll paginate after combining
      const purchaseWhere: any = { user_id: userId };
      if (startDate || endDate) {
        purchaseWhere.purchased_at = dateFilter;
      }

      const [purchaseRequests, purchaseRequestsTotal, purchases, purchasesTotal] = await Promise.all([
        prisma.purchase_requests.findMany({
          where: purchaseRequestWhere,
          orderBy: { created_at: order },
        }),
        prisma.purchase_requests.count({ where: purchaseRequestWhere }),
        prisma.purchases.findMany({
          where: purchaseWhere,
          orderBy: { purchased_at: order },
        }),
        prisma.purchases.count({ where: purchaseWhere }),
      ]);

      // Combine and sort all payment records
      const allPayments: any[] = [
        ...purchaseRequests.map(pr => ({
          id: `PR${pr.id}`,
          type: 'purchase_request',
          amount: Number(pr.amount),
          txn_id: pr.txn_id,
          payment_type: pr.payment_type || 'bank_transfer',
          payment_proof_url: pr.payment_proof_url,
          status: pr.status, // pending, approved, rejected
          remarks: pr.remarks,
          created_at: pr.created_at,
          request_id: pr.id.toString(),
        })),
        ...purchases.map(p => ({
          id: `P${p.id}`,
          type: 'purchase',
          amount: Number(p.amount),
          txn_id: p.txn_id,
          payment_type: p.payment_type || 'razorpay',
          payment_proof_url: p.payment_proof_url,
          status: p.status === 'completed' ? 'approved' : p.status,
          remarks: null,
          created_at: p.purchased_at,
          purchase_id: p.id.toString(),
        })),
      ];

      // Sort combined results
      allPayments.sort((a, b) => {
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return order === 'desc' ? bDate - aDate : aDate - bDate;
      });

      // Paginate combined results
      const total = purchaseRequestsTotal + purchasesTotal;
      const paginatedPayments = allPayments.slice(offset, offset + limit);

      const items = paginatedPayments.map(payment => {
        // Format account details
        let accountDetails = 'N/A';
        if (payment.payment_type === 'razorpay') {
          accountDetails = 'Razorpay Gateway';
        } else if (payment.payment_type === 'upi') {
          accountDetails = 'UPI Payment';
        } else if (payment.payment_proof_url) {
          accountDetails = 'Bank Transfer - Proof Available';
        } else if (payment.payment_type === 'bank_transfer') {
          accountDetails = 'Bank Transfer';
        }

        // Format transaction ID
        const txnId = payment.txn_id 
          ? `TXN${String(payment.txn_id).padStart(9, '0')}` 
          : `TXN${payment.id.replace(/^PR|^P/, '').padStart(9, '0')}`;

        // Format UTR
        let utr = 'Pending...';
        if (payment.txn_id) {
          utr = payment.txn_id;
        } else if (payment.status === 'approved') {
          utr = `UTR${payment.id.replace(/^PR|^P/, '').padStart(9, '0')}`;
        } else if (payment.status === 'rejected') {
          utr = 'N/A';
        }

        return {
          id: payment.id,
          transaction_id: txnId,
          utr: utr,
          amount: payment.amount,
          payment_method: payment.payment_type === 'razorpay' ? 'Razorpay' : payment.payment_type === 'upi' ? 'UPI' : 'Bank Transfer',
          account_details: accountDetails,
          status: payment.status === 'approved' ? 'successful' : payment.status === 'rejected' ? 'failed' : 'pending',
          payment_date: payment.created_at,
          request_id: payment.request_id || payment.purchase_id,
          remarks: payment.remarks,
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
      console.error('Error getting payment history:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/payment-history/statement:
   *   get:
   *     tags:
   *       - Payment History
   *     summary: Get wallet statement
   *     description: |
   *       Retrieve wallet statement (summary) including current balance, total credits,
   *       total transactions, and transaction date range.
   *     operationId: getPaymentHistoryStatement
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Wallet statement retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 current_balance:
   *                   type: number
   *                   example: 5000.00
   *                 total_credits:
   *                   type: number
   *                   example: 10000.00
   *                 total_transactions:
   *                   type: number
   *                   example: 25
   *                 first_transaction_date:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-01-01T10:00:00.000Z"
   *                 last_transaction_date:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-11-08T10:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/statement', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet statement (summary)',
      tags: ['Payment History'],
      summary: 'Get Wallet Statement',
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            current_balance: { type: 'number' },
            total_credits: { type: 'number' },
            total_transactions: { type: 'number' },
            first_transaction_date: { type: ['string', 'null'], format: 'date-time' },
            last_transaction_date: { type: ['string', 'null'], format: 'date-time' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get wallet balance
      const balance = await prisma.user_balances.findUnique({ where: { user_id: userId } });

      // Get wallet transaction statistics
      const [transactionStats, firstTransaction, lastTransaction] = await Promise.all([
        prisma.wallet_transactions.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.wallet_transactions.findFirst({
          where: { receiver_user_id: userId },
          orderBy: { created_at: 'asc' },
          select: { created_at: true },
        }),
        prisma.wallet_transactions.findFirst({
          where: { receiver_user_id: userId },
          orderBy: { created_at: 'desc' },
          select: { created_at: true },
        }),
      ]);

      return reply.send({
        user_id: userId.toString(),
        current_balance: Number(balance?.balance || 0),
        total_credits: Number(transactionStats._sum.amount || 0),
        total_transactions: transactionStats._count.id,
        first_transaction_date: firstTransaction?.created_at ?? null,
        last_transaction_date: lastTransaction?.created_at ?? null,
      });
    } catch (error) {
      console.error('Error getting wallet statement:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/payment-history/ledger:
   *   get:
   *     tags:
   *       - Payment History
   *     summary: Get complete ledger entries
   *     description: |
   *       Retrieve all ledger entries (immutable audit log) for the authenticated user
   *       with pagination and filters. Ledger entries track all commission credits.
   *     operationId: getPaymentHistoryLedger
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
   *     responses:
   *       '200':
   *         description: Ledger entries retrieved successfully
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
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
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
  app.get('/ledger', {
    preHandler: requireUser,
    schema: {
      description: 'Get complete ledger entries (immutable audit log)',
      tags: ['Payment History'],
      summary: 'Get Ledger',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'SPOT', 'MONTHLY'] },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
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
                  purchase_id: { type: ['string', 'null'] },
                  credited_at: { type: 'string', format: 'date-time' },
                  settled: { type: 'boolean' },
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
      const userId = BigInt((req as any).user.user_id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const commissionType = (req.query as any).commission_type;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;

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

      const [ledgerEntries, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where,
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where }),
      ]);

      const items = ledgerEntries.map(entry => ({
        id: entry.id.toString(),
        commission_type: entry.commission_type,
        amount: Number(entry.amount),
        source_user_id: entry.source_user_id.toString(),
        purchase_id: entry.purchase_id ? entry.purchase_id.toString() : null,
        credited_at: entry.credited_at,
        settled: entry.settled,
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
      console.error('Error getting ledger entries:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

