import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';

// Allowed image MIME types for QR code
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;

const createCompanyBankBody = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  bank_ac_holder: z.string().min(1, 'Account holder name is required'),
  bank_ac_no: z.string().min(1, 'Account number is required'),
  bank_ifsc: z.string().min(1, 'IFSC code is required'),
  bank_branch: z.string().optional(),
  bank_upi: z.string().optional(),
  qr_image: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

const updateCompanyBankBody = z.object({
  bank_name: z.string().min(1).optional(),
  bank_ac_holder: z.string().min(1).optional(),
  bank_ac_no: z.string().min(1).optional(),
  bank_ifsc: z.string().min(1).optional(),
  bank_branch: z.string().optional(),
  bank_upi: z.string().optional(),
  qr_image: z.string().optional(),
  is_active: z.boolean().optional(),
});

export async function adminCompanyBankRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/company-bank:
   *   get:
   *     tags:
   *       - Admin Company Bank
   *     summary: List company bank accounts
   *     description: |
   *       Retrieve all company bank accounts. Supports filtering by active status.
   *     operationId: listCompanyBankAccounts
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: is_active
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       '200':
   *         description: Company bank accounts retrieved successfully
   */
  app.get('/company-bank', {
    preHandler: [adminAuth, checkPermission('COMPANY_BANK_MANAGE')],
    schema: {
      description: 'List company bank accounts',
      tags: ['Admin Company Bank'],
      summary: 'List Company Bank Accounts',
      operationId: 'listCompanyBankAccounts',
      querystring: {
        type: 'object',
        properties: {
          is_active: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  bank_name: { type: 'string' },
                  bank_ac_holder: { type: 'string' },
                  bank_ac_no: { type: 'string' },
                  bank_ifsc: { type: 'string' },
                  bank_branch: { type: ['string', 'null'] },
                  bank_upi: { type: ['string', 'null'] },
                  qr_image: { type: ['string', 'null'] },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const where: any = {};

      if (query.is_active !== undefined) {
        where.is_active = query.is_active === 'true' || query.is_active === true;
      }

      const items = await prisma.company_bank_accounts.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        count: items.length,
        items: items.map(item => ({
          id: item.id,
          bank_name: item.bank_name,
          bank_ac_holder: item.bank_ac_holder,
          bank_ac_no: item.bank_ac_no,
          bank_ifsc: item.bank_ifsc,
          bank_branch: item.bank_branch,
          bank_upi: item.bank_upi,
          qr_image: item.qr_image,
          is_active: item.is_active,
          created_at: item.created_at.toISOString(),
          updated_at: item.updated_at.toISOString(),
        })),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/company-bank:
   *   post:
   *     tags:
   *       - Admin Company Bank
   *     summary: Add company bank account
   *     description: |
   *       Create a new company bank account with all required details.
   *     operationId: createCompanyBankAccount
   *     security:
   *       - adminAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - bank_name
   *               - bank_ac_holder
   *               - bank_ac_no
   *               - bank_ifsc
   *             properties:
   *               bank_name:
   *                 type: string
   *                 example: "HDFC Bank"
   *               bank_ac_holder:
   *                 type: string
   *                 example: "Company Name Pvt Ltd"
   *               bank_ac_no:
   *                 type: string
   *                 example: "1234567890123"
   *               bank_ifsc:
   *                 type: string
   *                 example: "HDFC0001234"
   *               bank_branch:
   *                 type: string
   *                 example: "Mumbai Main Branch"
   *               bank_upi:
   *                 type: string
   *                 example: "company@upi"
   *               qr_image:
   *                 type: string
   *                 description: QR code image URL or base64 string
   *                 example: "https://example.com/qr.png"
   *               is_active:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       '201':
   *         description: Company bank account created successfully
   *       '400':
   *         description: Validation error
   */
  app.post('/company-bank', {
    preHandler: [adminAuth, checkPermission('COMPANY_BANK_MANAGE')],
    schema: {
      description: 'Add company bank account',
      tags: ['Admin Company Bank'],
      summary: 'Add Company Bank Account',
      operationId: 'createCompanyBankAccount',
      body: {
        type: 'object',
        required: ['bank_name', 'bank_ac_holder', 'bank_ac_no', 'bank_ifsc'],
        properties: {
          bank_name: { type: 'string', minLength: 1 },
          bank_ac_holder: { type: 'string', minLength: 1 },
          bank_ac_no: { type: 'string', minLength: 1 },
          bank_ifsc: { type: 'string', minLength: 1 },
          bank_branch: { type: 'string' },
          bank_upi: { type: 'string' },
          qr_image: { type: 'string' },
          is_active: { type: 'boolean', default: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            bank_name: { type: 'string' },
            bank_ac_holder: { type: 'string' },
            bank_ac_no: { type: 'string' },
            bank_ifsc: { type: 'string' },
            bank_branch: { type: ['string', 'null'] },
            bank_upi: { type: ['string', 'null'] },
            qr_image: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const body = createCompanyBankBody.parse(req.body);

      const account = await prisma.company_bank_accounts.create({
        data: {
          bank_name: body.bank_name,
          bank_ac_holder: body.bank_ac_holder,
          bank_ac_no: body.bank_ac_no,
          bank_ifsc: body.bank_ifsc,
          bank_branch: body.bank_branch,
          bank_upi: body.bank_upi,
          qr_image: body.qr_image,
          is_active: body.is_active,
        },
      });

      return reply.code(201).send({
        id: account.id,
        bank_name: account.bank_name,
        bank_ac_holder: account.bank_ac_holder,
        bank_ac_no: account.bank_ac_no,
        bank_ifsc: account.bank_ifsc,
        bank_branch: account.bank_branch,
        bank_upi: account.bank_upi,
        qr_image: account.qr_image,
        is_active: account.is_active,
        created_at: account.created_at.toISOString(),
        updated_at: account.updated_at.toISOString(),
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
   * /api/v1/admin/company-bank/{id}:
   *   put:
   *     tags:
   *       - Admin Company Bank
   *     summary: Update company bank account
   *     description: |
   *       Update an existing company bank account. All fields are optional.
   *     operationId: updateCompanyBankAccount
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Company bank account ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               bank_name:
   *                 type: string
   *               bank_ac_holder:
   *                 type: string
   *               bank_ac_no:
   *                 type: string
   *               bank_ifsc:
   *                 type: string
   *               bank_branch:
   *                 type: string
   *               bank_upi:
   *                 type: string
   *               qr_image:
   *                 type: string
   *               is_active:
   *                 type: boolean
   *     responses:
   *       '200':
   *         description: Company bank account updated successfully
   *       '404':
   *         description: Account not found
   */
  app.put('/company-bank/:id', {
    preHandler: [adminAuth, checkPermission('COMPANY_BANK_MANAGE')],
    schema: {
      description: 'Update company bank account',
      tags: ['Admin Company Bank'],
      summary: 'Update Company Bank Account',
      operationId: 'updateCompanyBankAccount',
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
          bank_name: { type: 'string', minLength: 1 },
          bank_ac_holder: { type: 'string', minLength: 1 },
          bank_ac_no: { type: 'string', minLength: 1 },
          bank_ifsc: { type: 'string', minLength: 1 },
          bank_branch: { type: 'string' },
          bank_upi: { type: 'string' },
          qr_image: { type: 'string' },
          is_active: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            bank_name: { type: 'string' },
            bank_ac_holder: { type: 'string' },
            bank_ac_no: { type: 'string' },
            bank_ifsc: { type: 'string' },
            bank_branch: { type: ['string', 'null'] },
            bank_upi: { type: ['string', 'null'] },
            qr_image: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const accountId = Number((req.params as any).id);
      const body = updateCompanyBankBody.parse(req.body);

      // Check if account exists
      const existing = await prisma.company_bank_accounts.findUnique({
        where: { id: accountId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'account_not_found' });
      }

      // Build update data (only include fields that are provided)
      const updateData: any = {
        updated_at: new Date(),
      };

      if (body.bank_name !== undefined) updateData.bank_name = body.bank_name;
      if (body.bank_ac_holder !== undefined) updateData.bank_ac_holder = body.bank_ac_holder;
      if (body.bank_ac_no !== undefined) updateData.bank_ac_no = body.bank_ac_no;
      if (body.bank_ifsc !== undefined) updateData.bank_ifsc = body.bank_ifsc;
      if (body.bank_branch !== undefined) updateData.bank_branch = body.bank_branch;
      if (body.bank_upi !== undefined) updateData.bank_upi = body.bank_upi;
      if (body.qr_image !== undefined) updateData.qr_image = body.qr_image;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const updated = await prisma.company_bank_accounts.update({
        where: { id: accountId },
        data: updateData,
      });

      return reply.send({
        id: updated.id,
        bank_name: updated.bank_name,
        bank_ac_holder: updated.bank_ac_holder,
        bank_ac_no: updated.bank_ac_no,
        bank_ifsc: updated.bank_ifsc,
        bank_branch: updated.bank_branch,
        bank_upi: updated.bank_upi,
        qr_image: updated.qr_image,
        is_active: updated.is_active,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', details: error.errors });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'account_not_found' });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/company-bank/{id}:
   *   delete:
   *     tags:
   *       - Admin Company Bank
   *     summary: Delete company bank account
   *     description: |
   *       Delete a company bank account permanently.
   *     operationId: deleteCompanyBankAccount
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Company bank account ID
   *     responses:
   *       '200':
   *         description: Company bank account deleted successfully
   *       '404':
   *         description: Account not found
   */
  app.delete('/company-bank/:id', {
    preHandler: [adminAuth, checkPermission('COMPANY_BANK_MANAGE')],
    schema: {
      description: 'Delete company bank account',
      tags: ['Admin Company Bank'],
      summary: 'Delete Company Bank Account',
      operationId: 'deleteCompanyBankAccount',
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
      const accountId = Number((req.params as any).id);

      // Check if account exists
      const existing = await prisma.company_bank_accounts.findUnique({
        where: { id: accountId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'account_not_found' });
      }

      await prisma.company_bank_accounts.delete({
        where: { id: accountId },
      });

      return reply.send({
        message: 'Company bank account deleted successfully',
        id: accountId,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'account_not_found' });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/company-bank/qr/upload:
   *   post:
   *     tags:
   *       - Admin Company Bank
   *     summary: Upload QR code image
   *     description: |
   *       Upload QR code image for company bank account to Bunny CDN.
   *       Returns CDN URL that can be used when creating or updating bank accounts.
   *     operationId: uploadCompanyBankQR
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
   *                 description: QR code image file (JPG, PNG, GIF, WebP, max 5MB)
   *     responses:
   *       '200':
   *         description: QR code image uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 qr_image_url:
   *                   type: string
   *                   format: uri
   *                   example: "https://mlm-cdn.b-cdn.net/company_bank_qr/company_bank_qr_1234567890.jpg"
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
  app.post('/company-bank/qr/upload', {
    preHandler: [adminAuth, checkPermission('COMPANY_BANK_MANAGE')],
    schema: {
      description: 'Upload QR code image for company bank account to Bunny CDN',
      tags: ['Admin Company Bank'],
      summary: 'Upload QR Code Image',
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            qr_image_url: { type: 'string' },
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
      const filename = `company_bank_qr_${timestamp}.${extension}`;

      // Upload to Bunny CDN with proper Content-Type
      const cdnUrl = await bunnyCDNService.uploadFile(
        fileBuffer,
        filename,
        'company_bank_qr',
        data.mimetype
      );

      return reply.send({
        qr_image_url: cdnUrl,
        uploaded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('QR code upload error:', error);
      return reply.code(500).send({
        message: 'Failed to upload QR code image',
      });
    }
  });
}

