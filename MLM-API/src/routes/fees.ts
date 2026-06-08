import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { FeeService } from '../modules/fees/feeService.js';

export async function feesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/fees/history:
   *   get:
   *     tags:
   *       - Fees
   *     summary: Get user's fee transaction history
   *     description: |
   *       Retrieve fee transaction history for the authenticated user with pagination.
   *     operationId: getFeeHistory
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
   *         description: Fee history retrieved successfully
   */
  app.get('/history', {
    preHandler: requireUser,
    schema: {
      description: 'Get fee transaction history',
      tags: ['Fees'],
      summary: 'Get Fee History',
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

      const history = await FeeService.getFeeHistory(userId, page, limit);
      return reply.send(history);
    } catch (error) {
      console.error('Error getting fee history:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/fees/rules:
   *   get:
   *     tags:
   *       - Fees
   *     summary: Get active fee rules
   *     description: |
   *       Retrieve all active fee rules (for user information).
   *     operationId: getActiveFeeRules
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Active fee rules retrieved successfully
   */
  app.get('/rules', {
    preHandler: requireUser,
    schema: {
      description: 'Get active fee rules',
      tags: ['Fees'],
      summary: 'Get Active Fee Rules',
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const rules = await FeeService.getActiveFeeRules();
      return reply.send({
        count: rules.length,
        items: rules.map(r => ({
          id: r.id,
          rule_code: r.rule_code,
          rule_name: r.rule_name,
          description: r.description,
          amount: Number(r.amount),
          applies_to: r.applies_to,
        })),
      });
    } catch (error) {
      console.error('Error getting fee rules:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

