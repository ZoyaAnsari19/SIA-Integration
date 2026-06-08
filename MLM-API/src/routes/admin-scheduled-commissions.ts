import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';

export async function adminScheduledCommissionsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/scheduled-commissions:
   *   get:
   *     tags:
   *       - Admin Scheduled Commissions
   *     summary: Get all scheduled commissions
   *     description: |
   *       Retrieve all scheduled commissions with pagination and filtering options.
   *       Includes user details and purchase information.
   *     operationId: getAllScheduledCommissions
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
   *         name: receiver_user_id
   *         schema:
   *           type: string
   *         description: Filter by receiver user ID
   *       - in: query
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, GLOBAL_HELPING, MONTHLY]
   *         description: Filter by commission type
   *       - in: query
   *         name: active_only
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Show only active scheduled commissions (not expired)
   *     responses:
   *       '200':
   *         description: Scheduled commissions retrieved successfully
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
   *                       receiver_user_id:
   *                         type: string
   *                       receiver_name:
   *                         type: string
   *                         nullable: true
   *                       source_user_id:
   *                         type: string
   *                         nullable: true
   *                       source_name:
   *                         type: string
   *                         nullable: true
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                       commission_type:
   *                         type: string
   *                       monthly_amount:
   *                         type: number
   *                       daily_amount:
   *                         type: number
   *                       total_credited:
   *                         type: number
   *                       days_processed:
   *                         type: number
   *                       start_date:
   *                         type: string
   *                         format: date
   *                       end_date:
   *                         type: string
   *                         format: date
   *                       is_active:
   *                         type: boolean
   *       '401':
   *         description: Unauthorized
   */
  app.get('/scheduled-commissions', {
    preHandler: adminAuth,
    schema: {
      description: 'Get all scheduled commissions',
      tags: ['Admin Scheduled Commissions'],
      summary: 'Get All Scheduled Commissions',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          receiver_user_id: { type: 'string' },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'MONTHLY'] },
          active_only: { type: 'boolean', default: false },
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
                  receiver_user_id: { type: 'string' },
                  receiver_name: { type: ['string', 'null'] },
                  source_user_id: { type: ['string', 'null'] },
                  source_name: { type: ['string', 'null'] },
                  purchase_id: { type: ['string', 'null'] },
                  commission_type: { type: 'string' },
                  monthly_amount: { type: 'number' },
                  daily_amount: { type: 'number' },
                  total_credited: { type: 'number' },
                  days_processed: { type: 'number' },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const receiverUserId = (req.query as any).receiver_user_id;
      const commissionType = (req.query as any).commission_type;
      const activeOnly = (req.query as any).active_only === 'true' || (req.query as any).active_only === true;

      const where: any = {};
      if (receiverUserId) {
        where.receiver_user_id = BigInt(receiverUserId);
      }
      if (commissionType) {
        where.commission_type = commissionType;
      }
      if (activeOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.end_date = { gte: today };
      }

      // NOTE: scheduled_commissions table removed (Dec 20, 2025)
      // All commissions are now processed dynamically
      // Return empty results for backward compatibility
      const scheduled: any[] = [];
      const total = 0;

      // Get user details
      const userIds = new Set<string>();
      scheduled.forEach(s => {
        userIds.add(s.receiver_user_id.toString());
        if (s.source_user_id) {
          userIds.add(s.source_user_id.toString());
        }
      });

      const users = await prisma.users.findMany({
        where: { id: { in: Array.from(userIds).map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id.toString(), u.name]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const items = scheduled.map(s => {
        const endDate = new Date(s.end_date);
        endDate.setHours(0, 0, 0, 0);
        return {
          id: s.id.toString(),
          receiver_user_id: s.receiver_user_id.toString(),
          receiver_name: userMap.get(s.receiver_user_id.toString()) ?? null,
          source_user_id: s.source_user_id ? s.source_user_id.toString() : null,
          source_name: s.source_user_id ? userMap.get(s.source_user_id.toString()) ?? null : null,
          purchase_id: s.purchase_id ? s.purchase_id.toString() : null,
          commission_type: s.commission_type,
          monthly_amount: Number(s.monthly_amount),
          daily_amount: Number(s.daily_amount),
          total_credited: Number(s.total_credited),
          days_processed: s.days_processed,
          start_date: s.start_date,
          end_date: s.end_date,
          is_active: endDate >= today,
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
      console.error('Error getting scheduled commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/scheduled-commissions/{id}:
   *   get:
   *     tags:
   *       - Admin Scheduled Commissions
   *     summary: Get single scheduled commission
   *     description: |
   *       Retrieve detailed information about a specific scheduled commission.
   *       Includes user details and purchase information.
   *     operationId: getScheduledCommissionById
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Scheduled commission ID
   *     responses:
   *       '200':
   *         description: Scheduled commission retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 receiver_user_id:
   *                   type: string
   *                 receiver:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                       nullable: true
   *                     email:
   *                       type: string
   *                       nullable: true
   *                 source_user_id:
   *                   type: string
   *                   nullable: true
   *                 source:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                       nullable: true
   *                 purchase_id:
   *                   type: string
   *                   nullable: true
   *                 commission_type:
   *                   type: string
   *                 monthly_amount:
   *                   type: number
   *                 daily_amount:
   *                   type: number
   *                 total_credited:
   *                   type: number
   *                 days_processed:
   *                   type: number
   *                 start_date:
   *                   type: string
   *                   format: date
   *                 end_date:
   *                   type: string
   *                   format: date
   *                 is_active:
   *                   type: boolean
   *       '404':
   *         description: Scheduled commission not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/scheduled-commissions/:id', {
    preHandler: adminAuth,
    schema: {
      description: 'Get single scheduled commission',
      tags: ['Admin Scheduled Commissions'],
      summary: 'Get Scheduled Commission',
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
            receiver_user_id: { type: 'string' },
            receiver: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
              },
            },
            source_user_id: { type: ['string', 'null'] },
            source: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string' },
                name: { type: ['string', 'null'] },
              },
            },
            purchase_id: { type: ['string', 'null'] },
            commission_type: { type: 'string' },
            monthly_amount: { type: 'number' },
            daily_amount: { type: 'number' },
            total_credited: { type: 'number' },
            days_processed: { type: 'number' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            is_active: { type: 'boolean' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const scheduledId = BigInt((req.params as any).id);

      // NOTE: scheduled_commissions table removed (Dec 20, 2025)
      // All commissions are now processed dynamically
      return reply.code(404).send({ error: 'Scheduled commission not found. Table has been removed - all commissions are now processed dynamically.' });

      // Get user details
      const [receiver, source] = await Promise.all([
        prisma.users.findUnique({
          where: { id: scheduled.receiver_user_id },
          select: { id: true, name: true, email: true },
        }),
        scheduled.source_user_id
          ? prisma.users.findUnique({
              where: { id: scheduled.source_user_id },
              select: { id: true, name: true },
            })
          : null,
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(scheduled.end_date);
      endDate.setHours(0, 0, 0, 0);

      return reply.send({
        id: scheduled.id.toString(),
        receiver_user_id: scheduled.receiver_user_id.toString(),
        receiver: receiver
          ? {
              id: receiver.id.toString(),
              name: receiver.name,
              email: receiver.email,
            }
          : null,
        source_user_id: scheduled.source_user_id ? scheduled.source_user_id.toString() : null,
        source: source
          ? {
              id: source.id.toString(),
              name: source.name,
            }
          : null,
        purchase_id: scheduled.purchase_id ? scheduled.purchase_id.toString() : null,
        commission_type: scheduled.commission_type,
        monthly_amount: Number(scheduled.monthly_amount),
        daily_amount: Number(scheduled.daily_amount),
        total_credited: Number(scheduled.total_credited),
        days_processed: scheduled.days_processed,
        start_date: scheduled.start_date,
        end_date: scheduled.end_date,
        is_active: endDate >= today,
      });
    } catch (error) {
      console.error('Error getting scheduled commission:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

