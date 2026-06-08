import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';

// Allowed image MIME types for slider images
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;

const createSliderBody = z.object({
  title: z.string().min(1, 'Title is required'),
  image_url: z.string().url('Invalid image URL'),
  link: z.string().url('Invalid link URL').optional().nullable(),
  display_order: z.coerce.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const updateSliderBody = z.object({
  title: z.string().min(1).optional(),
  image_url: z.string().url().optional(),
  link: z.string().url().optional().nullable(),
  display_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const createWebsiteNoticeBody = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  is_active: z.boolean().optional().default(true),
});

const updateWebsiteNoticeBody = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

export async function adminWebsiteRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/website/slider:
   *   get:
   *     tags:
   *       - Admin Website
   *     summary: Get landing slider images
   *     description: Retrieve all slider images with pagination
   *     operationId: getWebsiteSliders
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
   *         description: Sliders retrieved successfully
   */
  app.get('/website/slider', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Get landing slider images',
      tags: ['Admin Website'],
      summary: 'Get Website Sliders',
      operationId: 'getWebsiteSliders',
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
                  image_url: { type: 'string' },
                  link: { type: ['string', 'null'] },
                  display_order: { type: 'number' },
                  is_active: { type: 'boolean' },
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
        prisma.website_sliders.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ display_order: 'asc' }, { created_at: 'desc' }],
        }),
        prisma.website_sliders.count({ where }),
      ]);

      return reply.send({
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          link: item.link || null,
          display_order: item.display_order,
          is_active: item.is_active,
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
   * /api/v1/admin/website/slider:
   *   post:
   *     tags:
   *       - Admin Website
   *     summary: Upload slider image
   *     description: Create a new slider image with title, image URL, and optional link
   *     operationId: createWebsiteSlider
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
   *               - image_url
   *             properties:
   *               title:
   *                 type: string
   *                 example: "Welcome Offer"
   *               image_url:
   *                 type: string
   *                 format: uri
   *                 example: "https://example.com/slider1.jpg"
   *               link:
   *                 type: string
   *                 format: uri
   *                 nullable: true
   *                 example: "https://example.com/offer"
   *               display_order:
   *                 type: integer
   *                 default: 0
   *               is_active:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       '201':
   *         description: Slider created successfully
   */
  app.post('/website/slider', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Upload slider image',
      tags: ['Admin Website'],
      summary: 'Create Website Slider',
      operationId: 'createWebsiteSlider',
      body: {
        type: 'object',
        required: ['title', 'image_url'],
        properties: {
          title: { type: 'string', minLength: 1 },
          image_url: { type: 'string', format: 'uri' },
          link: { type: ['string', 'null'], format: 'uri' },
          display_order: { type: 'number', minimum: 0, default: 0 },
          is_active: { type: 'boolean', default: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            image_url: { type: 'string' },
            link: { type: ['string', 'null'] },
            display_order: { type: 'number' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const body = createSliderBody.parse(req.body);

      const slider = await prisma.website_sliders.create({
        data: {
          title: body.title,
          image_url: body.image_url,
          link: body.link || null,
          display_order: body.display_order ?? 0,
          is_active: body.is_active ?? true,
        },
      });

      return reply.code(201).send({
        id: slider.id,
        title: slider.title,
        image_url: slider.image_url,
        link: slider.link || null,
        display_order: slider.display_order,
        is_active: slider.is_active,
        created_at: slider.created_at.toISOString(),
        updated_at: slider.updated_at.toISOString(),
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
   * /api/v1/admin/website/slider/{id}:
   *   put:
   *     tags:
   *       - Admin Website
   *     summary: Update slider image
   *     description: Update an existing slider image
   *     operationId: updateWebsiteSlider
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
   *               image_url:
   *                 type: string
   *                 format: uri
   *               link:
   *                 type: string
   *                 format: uri
   *                 nullable: true
   *               display_order:
   *                 type: integer
   *               is_active:
   *                 type: boolean
   *     responses:
   *       '200':
   *         description: Slider updated successfully
   *       '404':
   *         description: Slider not found
   */
  app.put('/website/slider/:id', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Update slider image',
      tags: ['Admin Website'],
      summary: 'Update Website Slider',
      operationId: 'updateWebsiteSlider',
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          image_url: { type: 'string', format: 'uri' },
          link: { type: ['string', 'null'], format: 'uri' },
          display_order: { type: 'number', minimum: 0 },
          is_active: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            image_url: { type: 'string' },
            link: { type: ['string', 'null'] },
            display_order: { type: 'number' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const sliderId = Number((req.params as any).id);
      const body = updateSliderBody.parse(req.body);

      const existing = await prisma.website_sliders.findUnique({
        where: { id: sliderId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'slider_not_found', message: 'Slider not found' });
      }

      const updateData: any = {
        updated_at: new Date(),
      };
      if (body.title !== undefined) updateData.title = body.title;
      if (body.image_url !== undefined) updateData.image_url = body.image_url;
      if (body.link !== undefined) updateData.link = body.link;
      if (body.display_order !== undefined) updateData.display_order = body.display_order;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const slider = await prisma.website_sliders.update({
        where: { id: sliderId },
        data: updateData,
      });

      return reply.send({
        id: slider.id,
        title: slider.title,
        image_url: slider.image_url,
        link: slider.link || null,
        display_order: slider.display_order,
        is_active: slider.is_active,
        created_at: slider.created_at.toISOString(),
        updated_at: slider.updated_at.toISOString(),
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
   * /api/v1/admin/website/slider/{id}:
   *   delete:
   *     tags:
   *       - Admin Website
   *     summary: Delete slider image
   *     description: Delete an existing slider image
   *     operationId: deleteWebsiteSlider
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
   *         description: Slider deleted successfully
   *       '404':
   *         description: Slider not found
   */
  app.delete('/website/slider/:id', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Delete slider image',
      tags: ['Admin Website'],
      summary: 'Delete Website Slider',
      operationId: 'deleteWebsiteSlider',
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
        required: ['id'],
      },
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
      const sliderId = Number((req.params as any).id);

      const existing = await prisma.website_sliders.findUnique({
        where: { id: sliderId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'slider_not_found', message: 'Slider not found' });
      }

      await prisma.website_sliders.delete({
        where: { id: sliderId },
      });

      return reply.send({
        message: 'Slider deleted successfully',
        id: sliderId,
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/website/notices:
   *   get:
   *     tags:
   *       - Admin Website
   *     summary: Get website notices
   *     description: Retrieve all website notices with pagination
   *     operationId: getWebsiteNotices
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
   *         description: Website notices retrieved successfully
   */
  app.get('/website/notices', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Get website notices',
      tags: ['Admin Website'],
      summary: 'Get Website Notices',
      operationId: 'getWebsiteNotices',
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
                  is_active: { type: 'boolean' },
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
        prisma.website_notices.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        prisma.website_notices.count({ where }),
      ]);

      return reply.send({
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          is_active: item.is_active,
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
   * /api/v1/admin/website/notices:
   *   post:
   *     tags:
   *       - Admin Website
   *     summary: Create website notice
   *     description: Create a new website notice with title and content
   *     operationId: createWebsiteNotice
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
   *                 example: "Website Maintenance"
   *               content:
   *                 type: string
   *                 example: "The website will be under maintenance..."
   *               is_active:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       '201':
   *         description: Website notice created successfully
   */
  app.post('/website/notices', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Create website notice',
      tags: ['Admin Website'],
      summary: 'Create Website Notice',
      operationId: 'createWebsiteNotice',
      body: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
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
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const body = createWebsiteNoticeBody.parse(req.body);

      const notice = await prisma.website_notices.create({
        data: {
          title: body.title,
          content: body.content,
          is_active: body.is_active ?? true,
        },
      });

      return reply.code(201).send({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        is_active: notice.is_active,
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
   * /api/v1/admin/website/slider/image/upload:
   *   post:
   *     tags:
   *       - Admin Website
   *     summary: Upload slider image
   *     description: |
   *       Upload slider image to Bunny CDN.
   *       Returns CDN URL that can be used when creating or updating sliders.
   *     operationId: uploadSliderImage
   *     security:
   *       - adminAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Slider image file (JPG, PNG, GIF, WebP, max 5MB)
   *     responses:
   *       '200':
   *         description: Slider image uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 image_url:
   *                   type: string
   *                   format: uri
   *                   example: "https://mlm-cdn.b-cdn.net/landing_sliders/landing_slider_1234567890.jpg"
   *                 uploaded_at:
   *                   type: string
   *                   format: date-time
   *       '400':
   *         description: Validation error (invalid file type or size)
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.post('/website/slider/image/upload', {
    preHandler: [adminAuth, checkPermission('WEBSITE_SETTINGS_MANAGE')],
    schema: {
      description: 'Upload slider image to Bunny CDN',
      tags: ['Admin Website'],
      summary: 'Upload Slider Image',
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            image_url: { type: 'string' },
            uploaded_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      // Get uploaded file from multipart/form-data
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ message: 'No file uploaded' });
      }

      // Validate file type
      if (!bunnyCDNService.isValidFileType(data.mimetype, ALLOWED_IMAGE_TYPES)) {
        return reply.code(400).send({
          message: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP',
        });
      }

      // Read file buffer
      const fileBuffer = await data.toBuffer();

      // Validate file size
      if (!bunnyCDNService.isValidFileSize(fileBuffer.length, MAX_FILE_SIZE_MB)) {
        return reply.code(400).send({
          message: `File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB`,
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = data.filename.split('.').pop() || 'jpg';
      const filename = `landing_slider_${timestamp}.${extension}`;

      // Upload to Bunny CDN with proper Content-Type
      const cdnUrl = await bunnyCDNService.uploadFile(
        fileBuffer,
        filename,
        'landing_sliders',
        data.mimetype
      );

      return reply.send({
        image_url: cdnUrl,
        uploaded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Slider image upload error:', error);
      return reply.code(500).send({
        message: 'Failed to upload slider image',
      });
    }
  });
}

