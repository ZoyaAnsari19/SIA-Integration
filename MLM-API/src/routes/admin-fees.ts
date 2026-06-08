import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { FeeService } from '../modules/fees/feeService.js';

const feeRuleBody = z.object({
  rule_code: z.string().min(1),
  rule_name: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().min(0),
  is_active: z.boolean().optional().default(true),
  applies_to: z.string().optional().default('all_users'),
});

export async function adminFeesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/fees/rules:
   *   get:
   *     tags:
   *       - Admin Fees
   *     summary: List all fee rules
   *     description: |
   *       Retrieve all fee rules with pagination and filtering options.
   *     operationId: listFeeRules
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
   *       - in: query
   *         name: is_active
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       '200':
   *         description: Fee rules retrieved successfully
   */
  app.get('/fees/rules', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'List all fee rules',
      tags: ['Admin Fees'],
      summary: 'List Fee Rules',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          is_active: { type: 'boolean' },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const isActive = (req.query as any).is_active;

      const where: any = {};
      if (isActive !== undefined) {
        where.is_active = isActive === 'true' || isActive === true;
      }

      const [rules, total] = await Promise.all([
        prisma.fee_rules.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.fee_rules.count({ where }),
      ]);

      return reply.send({
        count: rules.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: rules.map(r => ({
          id: r.id,
          rule_code: r.rule_code,
          rule_name: r.rule_name,
          description: r.description,
          amount: Number(r.amount),
          is_active: r.is_active,
          applies_to: r.applies_to,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      });
    } catch (error) {
      console.error('Error listing fee rules:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/fees/rules:
   *   post:
   *     tags:
   *       - Admin Fees
   *     summary: Create fee rule
   *     description: |
   *       Create a new fee rule for charging users for various actions.
   *     operationId: createFeeRule
   *     security:
   *       - adminAuth: []
   */
  app.post('/fees/rules', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'Create fee rule',
      tags: ['Admin Fees'],
      summary: 'Create Fee Rule',
      body: {
        type: 'object',
        required: ['rule_code', 'rule_name', 'amount'],
        properties: {
          rule_code: { type: 'string', minLength: 1 },
          rule_name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          is_active: { type: 'boolean', default: true },
          applies_to: { type: 'string', default: 'all_users' },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const body = feeRuleBody.parse(req.body);

      // Check if rule_code already exists
      const existing = await prisma.fee_rules.findUnique({
        where: { rule_code: body.rule_code },
      });
      if (existing) {
        return reply.code(400).send({ error: 'Fee rule with this code already exists' });
      }

      const rule = await prisma.fee_rules.create({
        data: {
          rule_code: body.rule_code,
          rule_name: body.rule_name,
          description: body.description,
          amount: body.amount,
          is_active: body.is_active ?? true,
          applies_to: body.applies_to ?? 'all_users',
        },
      });

      return reply.code(201).send({
        id: rule.id,
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        description: rule.description,
        amount: Number(rule.amount),
        is_active: rule.is_active,
        applies_to: rule.applies_to,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Fee rule with this code already exists' });
      }
      console.error('Error creating fee rule:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/fees/rules/{id}:
   *   get:
   *     tags:
   *       - Admin Fees
   *     summary: Get fee rule by ID
   *     operationId: getFeeRule
   *     security:
   *       - adminAuth: []
   */
  app.get('/fees/rules/:id', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'Get fee rule by ID',
      tags: ['Admin Fees'],
      summary: 'Get Fee Rule',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = parseInt((req.params as any).id, 10);
      const rule = await prisma.fee_rules.findUnique({ where: { id } });

      if (!rule) {
        return reply.code(404).send({ error: 'Fee rule not found' });
      }

      return reply.send({
        id: rule.id,
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        description: rule.description,
        amount: Number(rule.amount),
        is_active: rule.is_active,
        applies_to: rule.applies_to,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      });
    } catch (error) {
      console.error('Error getting fee rule:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/fees/rules/{id}:
   *   put:
   *     tags:
   *       - Admin Fees
   *     summary: Update fee rule
   *     operationId: updateFeeRule
   *     security:
   *       - adminAuth: []
   */
  app.put('/fees/rules/:id', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'Update fee rule',
      tags: ['Admin Fees'],
      summary: 'Update Fee Rule',
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
          rule_name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          is_active: { type: 'boolean' },
          applies_to: { type: 'string' },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = parseInt((req.params as any).id, 10);
      const body = z.object({
        rule_name: z.string().min(1).optional(),
        description: z.string().optional(),
        amount: z.coerce.number().min(0).optional(),
        is_active: z.boolean().optional(),
        applies_to: z.string().optional(),
      }).parse(req.body);

      const existing = await prisma.fee_rules.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Fee rule not found' });
      }

      const updated = await prisma.fee_rules.update({
        where: { id },
        data: {
          rule_name: body.rule_name ?? undefined,
          description: body.description ?? undefined,
          amount: body.amount ?? undefined,
          is_active: body.is_active ?? undefined,
          applies_to: body.applies_to ?? undefined,
          updated_at: new Date(),
        },
      });

      return reply.send({
        id: updated.id,
        rule_code: updated.rule_code,
        rule_name: updated.rule_name,
        description: updated.description,
        amount: Number(updated.amount),
        is_active: updated.is_active,
        applies_to: updated.applies_to,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'Fee rule not found' });
      }
      console.error('Error updating fee rule:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/fees/rules/{id}:
   *   delete:
   *     tags:
   *       - Admin Fees
   *     summary: Delete fee rule
   *     operationId: deleteFeeRule
   *     security:
   *       - adminAuth: []
   */
  app.delete('/fees/rules/:id', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'Delete fee rule',
      tags: ['Admin Fees'],
      summary: 'Delete Fee Rule',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = parseInt((req.params as any).id, 10);
      const existing = await prisma.fee_rules.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Fee rule not found' });
      }

      await prisma.fee_rules.delete({ where: { id } });

      return reply.send({
        message: 'Fee rule deleted successfully',
        id,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'Fee rule not found' });
      }
      console.error('Error deleting fee rule:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/fees/transactions:
   *   get:
   *     tags:
   *       - Admin Fees
   *     summary: List all fee transactions
   *     description: |
   *       Retrieve all fee transactions with pagination and filtering options.
   *     operationId: listFeeTransactions
   *     security:
   *       - adminAuth: []
   */
  app.get('/fees/transactions', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'List all fee transactions',
      tags: ['Admin Fees'],
      summary: 'List Fee Transactions',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          user_id: { type: 'string' },
          rule_code: { type: 'string' },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const userId = (req.query as any).user_id;
      const ruleCode = (req.query as any).rule_code;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;

      const where: any = {};
      if (userId) {
        where.user_id = BigInt(userId);
      }
      if (ruleCode) {
        where.rule_code = ruleCode;
      }
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      const [transactions, total] = await Promise.all([
        prisma.fee_transactions.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
          include: {
            // Note: We'll need to manually join user data if needed
          },
        }),
        prisma.fee_transactions.count({ where }),
      ]);

      // Get user names for transactions
      const userIds = Array.from(new Set(transactions.map(t => t.user_id.toString())));
      const users = await prisma.users.findMany({
        where: { id: { in: userIds.map(id => BigInt(id)) } },
        select: { id: true, name: true, email: true },
      });
      const userMap = new Map(users.map(u => [u.id.toString(), u]));

      return reply.send({
        count: transactions.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: transactions.map(t => {
          const user = userMap.get(t.user_id.toString());
          return {
            id: t.id.toString(),
            user_id: t.user_id.toString(),
            user_name: user?.name ?? null,
            user_email: user?.email ?? null,
            rule_code: t.rule_code,
            amount: Number(t.amount),
            transaction_type: t.transaction_type,
            reference_id: t.reference_id?.toString(),
            reference_type: t.reference_type,
            description: t.description,
            created_at: t.created_at,
          };
        }),
      });
    } catch (error) {
      console.error('Error listing fee transactions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/fees/transactions/{userId}:
   *   get:
   *     tags:
   *       - Admin Fees
   *     summary: Get user's fee transactions
   *     description: |
   *       Retrieve fee transaction history for a specific user.
   *     operationId: getUserFeeTransactions
   *     security:
   *       - adminAuth: []
   */
  app.get('/fees/transactions/:userId', {
    preHandler: [adminAuth, checkPermission('FEE_RULES_MANAGE')],
    schema: {
      description: 'Get user fee transactions',
      tags: ['Admin Fees'],
      summary: 'Get User Fee Transactions',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).userId);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));

      const history = await FeeService.getFeeHistory(userId, page, limit);
      return reply.send(history);
    } catch (error) {
      console.error('Error getting user fee transactions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

