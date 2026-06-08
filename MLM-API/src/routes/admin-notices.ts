import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';

const createNoticeBody = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  link: z.string().url('Invalid link URL').optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const updateNoticeBody = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  link: z.string().url('Invalid link URL').optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function adminNoticesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/notices:
   *   get:
   *     tags:
   *       - Admin Notices
   *     summary: List all notices
   *     description: Retrieve all notices with pagination and optional filters
   *     operationId: listNotices
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
   *         description: Items per page
   *       - in: query
   *         name: is_active
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       '200':
   *         description: Notices retrieved successfully
   */
  app.get('/notices', {
    preHandler: [adminAuth, checkPermission('NOTICE_MANAGE')],
    schema: {
      description: 'List all notices',
      tags: ['Admin Notices'],
      summary: 'List Notices',
      operationId: 'listNotices',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          is_active: { type: 'boolean' },
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
                  id: { type: 'number' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  link: { type: ['string', 'null'] },
                  is_active: { type: 'boolean' },
                  created_by: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
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
      },
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (query.is_active !== undefined) {
        where.is_active = query.is_active === 'true' || query.is_active === true;
      }

      const [items, total] = await Promise.all([
        prisma.notices.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        prisma.notices.count({ where }),
      ]);

      return reply.send({
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          link: item.link,
          is_active: item.is_active,
          created_by: item.created_by?.toString() || null,
          created_at: item.created_at.toISOString(),
          updated_at: item.updated_at.toISOString(),
        })),
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

  /**
   * @openapi
   * /api/v1/admin/notices:
   *   post:
   *     tags:
   *       - Admin Notices
   *     summary: Create a new notice
   *     description: Create a new notice with title and content
   *     operationId: createNotice
   *     security:
   *       - adminAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - content
   *             properties:
   *               title:
   *                 type: string
   *                 example: "Important Announcement"
   *               content:
   *                 type: string
   *                 example: "This is the notice content..."
   *               is_active:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       '201':
   *         description: Notice created successfully
   */
  app.post('/notices', {
    preHandler: [adminAuth, checkPermission('NOTICE_MANAGE')],
    schema: {
      description: 'Create a new notice',
      tags: ['Admin Notices'],
      summary: 'Create Notice',
      operationId: 'createNotice',
      body: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
          link: { type: ['string', 'null'], format: 'uri' },
          is_active: { type: 'boolean', default: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            content: { type: 'string' },
            link: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_by: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const body = createNoticeBody.parse(req.body);
      const adminId = (req as any).admin?.user_id || null;

      const notice = await prisma.notices.create({
        data: {
          title: body.title,
          content: body.content,
          link: body.link || null,
          is_active: body.is_active ?? true,
          created_by: adminId ? BigInt(adminId) : null,
        },
      });

      return reply.code(201).send({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        link: notice.link,
        is_active: notice.is_active,
        created_by: notice.created_by?.toString() || null,
        created_at: notice.created_at.toISOString(),
        updated_at: notice.updated_at.toISOString(),
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
   * /api/v1/admin/notices/{id}:
   *   get:
   *     tags:
   *       - Admin Notices
   *     summary: Get a notice by ID
   *     description: Retrieve a single notice by its ID
   *     operationId: getNoticeById
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       '200':
   *         description: Notice retrieved successfully
   *       '404':
   *         description: Notice not found
   */
  app.get('/notices/:id', {
    preHandler: adminAuth,
    schema: {
      description: 'Get a notice by ID',
      tags: ['Admin Notices'],
      summary: 'Get Notice by ID',
      operationId: 'getNoticeById',
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
            id: { type: 'number' },
            title: { type: 'string' },
            content: { type: 'string' },
            link: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_by: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const noticeId = Number((req.params as any).id);

      if (isNaN(noticeId)) {
        return reply.code(400).send({ error: 'invalid_id', message: 'Invalid notice ID' });
      }

      const notice = await prisma.notices.findUnique({
        where: { id: noticeId },
      });

      if (!notice) {
        return reply.code(404).send({ error: 'notice_not_found', message: 'Notice not found' });
      }

      return reply.send({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        link: notice.link,
        is_active: notice.is_active,
        created_by: notice.created_by?.toString() || null,
        created_at: notice.created_at.toISOString(),
        updated_at: notice.updated_at.toISOString(),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/notices/{id}:
   *   put:
   *     tags:
   *       - Admin Notices
   *     summary: Update a notice
   *     description: Update an existing notice
   *     operationId: updateNotice
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               content:
   *                 type: string
   *               is_active:
   *                 type: boolean
   *     responses:
   *       '200':
   *         description: Notice updated successfully
   *       '404':
   *         description: Notice not found
   */
  app.put('/notices/:id', {
    preHandler: [adminAuth, checkPermission('NOTICE_MANAGE')],
    schema: {
      description: 'Update a notice',
      tags: ['Admin Notices'],
      summary: 'Update Notice',
      operationId: 'updateNotice',
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
          title: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
          link: { type: ['string', 'null'], format: 'uri' },
          is_active: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            content: { type: 'string' },
            link: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_by: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const noticeId = Number((req.params as any).id);
      
      if (isNaN(noticeId)) {
        return reply.code(400).send({ error: 'invalid_id', message: 'Invalid notice ID' });
      }
      
      const body = updateNoticeBody.parse(req.body);

      const existing = await prisma.notices.findUnique({
        where: { id: noticeId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'notice_not_found', message: 'Notice not found' });
      }

      const updateData: any = {
        updated_at: new Date(),
      };
      if (body.title !== undefined) updateData.title = body.title;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.link !== undefined) updateData.link = body.link;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const notice = await prisma.notices.update({
        where: { id: noticeId },
        data: updateData,
      });

      return reply.send({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        link: notice.link,
        is_active: notice.is_active,
        created_by: notice.created_by?.toString() || null,
        created_at: notice.created_at.toISOString(),
        updated_at: notice.updated_at.toISOString(),
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
   * /api/v1/admin/notices/{id}:
   *   delete:
   *     tags:
   *       - Admin Notices
   *     summary: Delete a notice
   *     description: Delete an existing notice
   *     operationId: deleteNotice
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       '200':
   *         description: Notice deleted successfully
   *       '404':
   *         description: Notice not found
   */
  app.delete('/notices/:id', {
    preHandler: [adminAuth, checkPermission('NOTICE_MANAGE')],
    schema: {
      description: 'Delete a notice',
      tags: ['Admin Notices'],
      summary: 'Delete Notice',
      operationId: 'deleteNotice',
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            id: { type: 'number' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const noticeId = Number((req.params as any).id);
      
      if (isNaN(noticeId)) {
        return reply.code(400).send({ error: 'invalid_id', message: 'Invalid notice ID' });
      }

      const existing = await prisma.notices.findUnique({
        where: { id: noticeId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'notice_not_found', message: 'Notice not found' });
      }

      await prisma.notices.delete({
        where: { id: noticeId },
      });

      return reply.send({
        message: 'Notice deleted successfully',
        id: noticeId,
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });
}

