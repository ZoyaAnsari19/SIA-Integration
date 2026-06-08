import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';

const updateRulesBody = z.object({
  admin_charges: z.coerce.number().min(0).optional(),
  min_withdraw: z.coerce.number().min(0).optional(),
  max_withdraw: z.coerce.number().min(0).nullable().optional(),
  spot_min_withdraw: z.coerce.number().min(0).optional(),
  spot_team_withdraw_multiplier: z.coerce.number().int().min(1).max(100).optional(), // e.g. 5 or 10 (limit = package value × this)
  min_transfer_amt: z.coerce.number().min(0).optional(),
  max_transfer_amt: z.coerce.number().min(0).nullable().optional(),
  transfer_amt_tax: z.coerce.number().min(0).max(100).optional(), // Percentage (0-100)
  withdrawal_enabled: z.boolean().optional(), // Admin toggle to enable/disable withdrawals
  is_active: z.boolean().optional(),
});

export async function adminWithdrawalTransferRulesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/withdrawal-transfer-rules:
   *   get:
   *     tags:
   *       - Admin Withdrawal Transfer Rules
   *     summary: Get withdrawal and transfer rules
   *     description: |
   *       Retrieve current withdrawal and transfer rules configured by admin.
   *       Returns the active rules or creates default if none exist.
   *     operationId: getWithdrawalTransferRules
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: Rules retrieved successfully
   */
  app.get('/withdrawal-transfer-rules', {
    preHandler: [adminAuth, checkPermission('TRANSACTION_RULES_MANAGE')],
    schema: {
      description: 'Get withdrawal and transfer rules',
      tags: ['Admin Withdrawal Transfer Rules'],
      summary: 'Get Withdrawal Transfer Rules',
      operationId: 'getWithdrawalTransferRules',
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            admin_charges: { type: 'number' },
            min_withdraw: { type: 'number' },
            max_withdraw: { type: ['number', 'null'] },
            spot_min_withdraw: { type: ['number', 'null'] },
            spot_team_withdraw_multiplier: { type: 'number' },
            min_transfer_amt: { type: 'number' },
            max_transfer_amt: { type: ['number', 'null'] },
            transfer_amt_tax: { type: 'number' },
            withdrawal_enabled: { type: 'boolean' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      // Get active rules or create default if none exist
      // Note: This will work after schema migration
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

      // If no rules exist, create default
      if (!rules) {
        try {
            rules = await (prisma as any).withdrawal_transfer_rules.create({
            data: {
              admin_charges: 0,
              min_withdraw: 100,
              max_withdraw: null,
              spot_min_withdraw: 100,
              spot_team_withdraw_multiplier: 10,
              min_transfer_amt: 10,
              max_transfer_amt: null,
              transfer_amt_tax: 0,
              withdrawal_enabled: true,
              is_active: true,
            },
          });
        } catch (e) {
          // Table doesn't exist yet, return default values
          return reply.send({
            id: 0,
            admin_charges: 0,
            min_withdraw: 100,
            max_withdraw: null,
            spot_min_withdraw: 1000,
            spot_team_withdraw_multiplier: 10,
            min_transfer_amt: 10,
            max_transfer_amt: null,
            transfer_amt_tax: 0,
            withdrawal_enabled: true,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      return reply.send({
        id: rules.id,
        admin_charges: Number(rules.admin_charges),
        min_withdraw: Number(rules.min_withdraw),
        max_withdraw: rules.max_withdraw ? Number(rules.max_withdraw) : null,
        spot_min_withdraw: rules.spot_min_withdraw ? Number(rules.spot_min_withdraw) : null,
        spot_team_withdraw_multiplier: rules.spot_team_withdraw_multiplier ?? 10,
        min_transfer_amt: Number(rules.min_transfer_amt),
        max_transfer_amt: rules.max_transfer_amt ? Number(rules.max_transfer_amt) : null,
        transfer_amt_tax: Number(rules.transfer_amt_tax),
        withdrawal_enabled: rules.withdrawal_enabled ?? true,
        is_active: rules.is_active,
        created_at: rules.created_at.toISOString(),
        updated_at: rules.updated_at.toISOString(),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/withdrawal-transfer-rules:
   *   put:
   *     tags:
   *       - Admin Withdrawal Transfer Rules
   *     summary: Update withdrawal and transfer rules
   *     description: |
   *       Update withdrawal and transfer rules. All fields are optional.
   *       If no active rules exist, creates new rules. Otherwise updates existing active rules.
   *     operationId: updateWithdrawalTransferRules
   *     security:
   *       - adminAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               admin_charges:
   *                 type: number
   *                 minimum: 0
   *                 description: Withdrawal charges (fixed amount)
   *                 example: 10
   *               min_withdraw:
   *                 type: number
   *                 minimum: 0
   *                 description: Minimum withdrawal amount
   *                 example: 100
   *               max_withdraw:
   *                 type: number
   *                 nullable: true
   *                 minimum: 0
   *                 description: Maximum withdrawal amount (null = no limit)
   *                 example: 50000
   *               min_transfer_amt:
   *                 type: number
   *                 minimum: 0
   *                 description: Minimum transfer amount
   *                 example: 10
   *               max_transfer_amt:
   *                 type: number
   *                 nullable: true
   *                 minimum: 0
   *                 description: Maximum transfer amount (null = no limit)
   *                 example: 10000
   *               transfer_amt_tax:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 100
   *                 description: Transfer amount tax percentage (0-100)
   *                 example: 2.5
   *               is_active:
   *                 type: boolean
   *                 description: Enable/disable rules
   *                 example: true
   *     responses:
   *       '200':
   *         description: Rules updated successfully
   */
  app.put('/withdrawal-transfer-rules', {
    preHandler: [adminAuth, checkPermission('TRANSACTION_RULES_MANAGE')],
    schema: {
      description: 'Update withdrawal and transfer rules',
      tags: ['Admin Withdrawal Transfer Rules'],
      summary: 'Update Withdrawal Transfer Rules',
      operationId: 'updateWithdrawalTransferRules',
      body: {
        type: 'object',
        properties: {
          admin_charges: { type: 'number', minimum: 0 },
          min_withdraw: { type: 'number', minimum: 0 },
          max_withdraw: { type: ['number', 'null'], minimum: 0 },
          spot_min_withdraw: { type: 'number', minimum: 0 },
          min_transfer_amt: { type: 'number', minimum: 0 },
          max_transfer_amt: { type: ['number', 'null'], minimum: 0 },
          transfer_amt_tax: { type: 'number', minimum: 0, maximum: 100 },
          withdrawal_enabled: { type: 'boolean' },
          is_active: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            admin_charges: { type: 'number' },
            min_withdraw: { type: 'number' },
            max_withdraw: { type: ['number', 'null'] },
            spot_min_withdraw: { type: ['number', 'null'] },
            spot_team_withdraw_multiplier: { type: 'number' },
            min_transfer_amt: { type: 'number' },
            max_transfer_amt: { type: ['number', 'null'] },
            transfer_amt_tax: { type: 'number' },
            withdrawal_enabled: { type: 'boolean' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const body = updateRulesBody.parse(req.body);

      // Get active rules or create new if none exist
      // Note: This will work after schema migration
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

      const updateData: any = {
        updated_at: new Date(),
      };

      if (body.admin_charges !== undefined) updateData.admin_charges = body.admin_charges;
      if (body.min_withdraw !== undefined) updateData.min_withdraw = body.min_withdraw;
      if (body.max_withdraw !== undefined) updateData.max_withdraw = body.max_withdraw;
      if (body.spot_min_withdraw !== undefined) updateData.spot_min_withdraw = body.spot_min_withdraw;
      if (body.spot_team_withdraw_multiplier !== undefined) updateData.spot_team_withdraw_multiplier = body.spot_team_withdraw_multiplier;
      if (body.min_transfer_amt !== undefined) updateData.min_transfer_amt = body.min_transfer_amt;
      if (body.max_transfer_amt !== undefined) updateData.max_transfer_amt = body.max_transfer_amt;
      if (body.transfer_amt_tax !== undefined) updateData.transfer_amt_tax = body.transfer_amt_tax;
      if (body.withdrawal_enabled !== undefined) updateData.withdrawal_enabled = body.withdrawal_enabled;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      if (rules) {
        // Update existing rules
        rules = await (prisma as any).withdrawal_transfer_rules.update({
          where: { id: rules.id },
          data: updateData,
        });
      } else {
        // Create new rules with defaults
        const defaultData = {
          admin_charges: body.admin_charges ?? 0,
          min_withdraw: body.min_withdraw ?? 100,
          max_withdraw: body.max_withdraw ?? null,
          spot_min_withdraw: body.spot_min_withdraw ?? 100,
          spot_team_withdraw_multiplier: body.spot_team_withdraw_multiplier ?? 10,
          min_transfer_amt: body.min_transfer_amt ?? 10,
          max_transfer_amt: body.max_transfer_amt ?? null,
          transfer_amt_tax: body.transfer_amt_tax ?? 0,
          withdrawal_enabled: body.withdrawal_enabled ?? true,
          is_active: body.is_active ?? true,
          ...updateData,
        };
        try {
          rules = await (prisma as any).withdrawal_transfer_rules.create({
            data: defaultData,
          });
        } catch (e) {
          return reply.code(500).send({
            error: 'table_not_created',
            message: 'Withdrawal transfer rules table does not exist. Please run database migration first.',
          });
        }
      }

      return reply.send({
        id: rules.id,
        admin_charges: Number(rules.admin_charges),
        min_withdraw: Number(rules.min_withdraw),
        max_withdraw: rules.max_withdraw ? Number(rules.max_withdraw) : null,
        spot_min_withdraw: rules.spot_min_withdraw ? Number(rules.spot_min_withdraw) : null,
        spot_team_withdraw_multiplier: rules.spot_team_withdraw_multiplier ?? 10,
        min_transfer_amt: Number(rules.min_transfer_amt),
        max_transfer_amt: rules.max_transfer_amt ? Number(rules.max_transfer_amt) : null,
        transfer_amt_tax: Number(rules.transfer_amt_tax),
        withdrawal_enabled: rules.withdrawal_enabled ?? true,
        is_active: rules.is_active,
        created_at: rules.created_at.toISOString(),
        updated_at: rules.updated_at.toISOString(),
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', details: error.errors });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });
}

