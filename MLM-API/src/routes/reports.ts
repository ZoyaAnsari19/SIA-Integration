import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt.js';
import { FeeService } from '../modules/fees/feeService.js';

export async function reportsRoutes(app: FastifyInstance) {
  app.get('/reconciliation', async (_req, reply) => {
    const ledger = await prisma.ledger_entries.aggregate({ _sum: { amount: true } });
    const wallet = await prisma.user_balances.aggregate({ _sum: { balance: true } });
    return reply.send({
      ledger_total: ledger._sum.amount ?? 0,
      wallet_total: wallet._sum.balance ?? 0,
      diff: Number(ledger._sum.amount ?? 0) - Number(wallet._sum.balance ?? 0),
    });
  });

  /**
   * @openapi
   * /api/v1/reports/download:
   *   post:
   *     tags:
   *       - Reports
   *     summary: Generate and download report
   *     description: |
   *       Generate and download a report (PDF/Excel). Fee will be deducted from wallet.
   *       Returns report data or file download link.
   *     operationId: downloadReport
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - report_type
   *             properties:
   *               report_type:
   *                 type: string
   *                 enum: [income, commission, wallet, team, payment_history]
   *                 description: Type of report to generate
   *               format:
   *                 type: string
   *                 enum: [pdf, excel]
   *                 default: pdf
   *                 description: Output format
   *               start_date:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for report data
   *               end_date:
   *                 type: string
   *                 format: date-time
   *                 description: End date for report data
   *     responses:
   *       '200':
   *         description: Report generated successfully
   *       '400':
   *         description: Insufficient balance or validation error
   */
  app.post('/download', {
    preHandler: requireUser,
    schema: {
      description: 'Generate and download report (fee will be deducted)',
      tags: ['Reports'],
      summary: 'Download Report',
      body: {
        type: 'object',
        required: ['report_type'],
        properties: {
          report_type: {
            type: 'string',
            enum: ['income', 'commission', 'wallet', 'team', 'payment_history'],
          },
          format: {
            type: 'string',
            enum: ['pdf', 'excel'],
            default: 'pdf',
          },
          start_date: {
            type: 'string',
            format: 'date-time',
          },
          end_date: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            report_data: { type: 'object' },
            download_url: { type: 'string', nullable: true },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            required_amount: { type: 'number' },
            available_balance: { type: 'number' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        report_type: z.enum(['income', 'commission', 'wallet', 'team', 'payment_history']),
        format: z.enum(['pdf', 'excel']).default('pdf'),
        start_date: z.string().datetime().optional(),
        end_date: z.string().datetime().optional(),
      }).parse(req.body);

      // Check fee applicability
      const feeCheck = await FeeService.checkFeeApplicable(userId, 'REPORT_DOWNLOAD');
      if (!feeCheck.applicable) {
        return reply.code(400).send({
          error: 'INSUFFICIENT_BALANCE',
          message: feeCheck.message,
          required_amount: feeCheck.amount,
          available_balance: Number(
            (await prisma.user_balances.findUnique({ where: { user_id: userId } }))?.balance || 0
          ),
        });
      }

      // Deduct fee
      let reportId: bigint | null = null;
      try {
        // Deduct from wallet (this will create fee transaction)
        const feeTransaction = await FeeService.deductFee(userId, 'REPORT_DOWNLOAD', null, body.report_type);
        reportId = feeTransaction.id as unknown as bigint;
      } catch (error: any) {
        if (error.code === 'INSUFFICIENT_BALANCE') {
          return reply.code(400).send({
            error: 'INSUFFICIENT_BALANCE',
            message: error.message || 'Insufficient balance for report download',
            required_amount: error.required,
            available_balance: error.available,
          });
        }
        throw error;
      }

      // Generate report data based on type
      const reportData = await generateReportData(userId, body.report_type, body.start_date, body.end_date);

      return reply.send({
        success: true,
        message: 'Report generated successfully',
        report_data: reportData,
        fee_deducted: feeCheck.amount,
        report_id: reportId?.toString(),
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error generating report:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

/**
 * Generate report data based on type
 */
async function generateReportData(
  userId: bigint,
  reportType: string,
  startDate?: string,
  endDate?: string
) {
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;

  switch (reportType) {
    case 'income':
      // Get all commission income
      const income = await prisma.ledger_entries.findMany({
        where: {
          receiver_user_id: userId,
          ...(start && end ? {
            credited_at: {
              gte: start,
              lte: end,
            },
          } : {}),
        },
        orderBy: { credited_at: 'desc' },
      });
      return {
        type: 'income',
        total: income.reduce((sum, entry) => sum + Number(entry.amount), 0),
        count: income.length,
        items: income.map(e => ({
          id: e.id.toString(),
          type: e.commission_type,
          amount: Number(e.amount),
          date: e.credited_at,
        })),
      };

    case 'commission':
      // Get commission breakdown by type
      const commissions = await prisma.ledger_entries.groupBy({
        by: ['commission_type'],
        where: {
          receiver_user_id: userId,
          ...(start && end ? {
            credited_at: {
              gte: start,
              lte: end,
            },
          } : {}),
        },
        _sum: { amount: true },
        _count: { id: true },
      });
      return {
        type: 'commission',
        breakdown: commissions.map(c => ({
          commission_type: c.commission_type,
          total: Number(c._sum.amount || 0),
          count: c._count.id,
        })),
      };

    case 'wallet':
      // Get wallet transactions
      const wallet = await prisma.wallet_transactions.findMany({
        where: {
          receiver_user_id: userId,
          ...(start && end ? {
            created_at: {
              gte: start,
              lte: end,
            },
          } : {}),
        },
        orderBy: { created_at: 'desc' },
      });
      return {
        type: 'wallet',
        total_credits: wallet.filter(w => Number(w.amount) > 0).reduce((sum, w) => sum + Number(w.amount), 0),
        total_debits: Math.abs(wallet.filter(w => Number(w.amount) < 0).reduce((sum, w) => sum + Number(w.amount), 0)),
        count: wallet.length,
        items: wallet.map(w => ({
          id: w.id.toString(),
          amount: Number(w.amount),
          date: w.created_at,
        })),
      };

    case 'team':
      // Get team statistics
      const teamStats = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: { gt: 0, lte: 9 },
        },
      });
      return {
        type: 'team',
        total_team_size: teamStats.length,
        level_breakdown: teamStats.reduce((acc, path) => {
          acc[path.depth] = (acc[path.depth] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
      };

    case 'payment_history':
      // Get payment history
      const payments = await prisma.wallet_transactions.findMany({
        where: {
          receiver_user_id: userId,
          ...(start && end ? {
            created_at: {
              gte: start,
              lte: end,
            },
          } : {}),
        },
        orderBy: { created_at: 'desc' },
      });
      return {
        type: 'payment_history',
        total_transactions: payments.length,
        items: payments.map(p => ({
          id: p.id.toString(),
          amount: Number(p.amount),
          date: p.created_at,
        })),
      };

    default:
      return { type: reportType, message: 'Report type not implemented' };
  }
}


