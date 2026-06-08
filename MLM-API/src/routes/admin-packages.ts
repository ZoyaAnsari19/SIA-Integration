import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission, checkPermissionAny } from '../middleware/checkPermission.js';

const createPackageBody = z.object({
  name: z.string().min(1),
  price: z.coerce.number(),
  min_amount: z.coerce.number().optional().nullable(),
  max_amount: z.coerce.number().optional().nullable(),
  self_monthly: z.coerce.number().optional().nullable(),
  self_roi_percent: z.coerce.number().optional().nullable(),
  global_ids: z.coerce.number().optional().nullable(),
  global_monthly_per_id: z.coerce.number().optional().nullable(),
  recurring_rate_percent: z.coerce.number().optional().nullable(),
  direct_spot_percent: z.coerce.number().optional().nullable(),
  direct_monthly_royalty_percent: z.coerce.number().optional().nullable(),
  validity_months: z.coerce.number().default(12),
  validity_days: z.coerce.number().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
  course_id: z.coerce.number().optional().nullable(),
});

const updatePackageBody = z.object({
  name: z.string().min(1).optional(),
  price: z.coerce.number().optional(),
  min_amount: z.coerce.number().optional().nullable(),
  max_amount: z.coerce.number().optional().nullable(),
  self_monthly: z.coerce.number().optional().nullable(),
  self_roi_percent: z.coerce.number().optional().nullable(),
  global_ids: z.coerce.number().optional().nullable(),
  global_monthly_per_id: z.coerce.number().optional().nullable(),
  recurring_rate_percent: z.coerce.number().optional().nullable(),
  direct_spot_percent: z.coerce.number().optional().nullable(),
  direct_monthly_royalty_percent: z.coerce.number().optional().nullable(),
  validity_months: z.coerce.number().optional(),
  validity_days: z.coerce.number().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  course_id: z.coerce.number().optional().nullable(),
});

export async function adminPackagesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/packages:
   *   get:
   *     tags:
   *       - Admin Packages
   *     summary: List all packages (Admin view)
   *     description: |
   *       Retrieve a paginated list of all packages with filtering and sorting options.
   *       This endpoint provides admin-level access to all packages including inactive ones.
   *     operationId: listAllPackagesAdmin
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
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, inactive]
   *         description: Filter by package status
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search packages by name
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [id, name, price, created_at, updated_at]
   *           default: id
   *         description: Sort field
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
   *         description: Sort order
   *     responses:
   *       '200':
   *         description: List of packages retrieved successfully
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
   *                         type: number
   *                         example: 1
   *                       name:
   *                         type: string
   *                         example: "Premium Package"
   *                       price:
   *                         type: number
   *                         example: 2500.00
   *                       min_amount:
   *                         type: number
   *                         nullable: true
   *                         example: 1000.00
   *                       max_amount:
   *                         type: number
   *                         nullable: true
   *                         example: 5000.00
   *                       self_monthly:
   *                         type: number
   *                         nullable: true
   *                         example: 62.50
   *                       self_roi_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 2.50
   *                       global_ids:
   *                         type: number
   *                         nullable: true
   *                         example: 3
   *                       global_monthly_per_id:
   *                         type: number
   *                         nullable: true
   *                         example: 20.00
   *                       recurring_rate_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 0.5
   *                       validity_months:
   *                         type: number
   *                         example: 12
   *                       validity_days:
   *                         type: number
   *                         nullable: true
   *                         example: 730
   *                       status:
   *                         type: string
   *                         example: "active"
   *                       course_id:
   *                         type: number
   *                         nullable: true
   *                         example: 12345
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/packages', {
    preHandler: [adminAuth, checkPermissionAny(['PACKAGE_VIEW', 'USERS_VIEW'])],
    schema: {
      description: 'List all packages (Admin view with pagination and filtering)',
      tags: ['Admin Packages'],
      summary: 'List Packages',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['active', 'inactive'] },
          search: { type: 'string' },
          sort: { type: 'string', enum: ['id', 'name', 'price', 'created_at', 'updated_at'], default: 'id' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
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
                  id: { type: 'number' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                  min_amount: { type: ['number', 'null'] },
                  max_amount: { type: ['number', 'null'] },
                  self_monthly: { type: ['number', 'null'] },
                  self_roi_percent: { type: ['number', 'null'] },
                  global_ids: { type: ['number', 'null'] },
                  global_monthly_per_id: { type: ['number', 'null'] },
                  recurring_rate_percent: { type: ['number', 'null'] },
                  direct_spot_percent: { type: ['number', 'null'] },
                  direct_monthly_royalty_percent: { type: ['number', 'null'] },
                  validity_months: { type: 'number' },
                  validity_days: { type: ['number', 'null'] },
                  status: { type: 'string' },
                  course_id: { type: ['number', 'null'] },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const status = (req.query as any).status;
      const search = (req.query as any).search;
      const sort = (req.query as any).sort || 'id';
      const order = (req.query as any).order || 'asc';

      const where: any = {};
      if (status) {
        where.status = status;
      }
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [packages, total] = await Promise.all([
        prisma.packages.findMany({
          where,
          orderBy: { [sort]: order },
          skip: offset,
          take: limit,
        }),
        prisma.packages.count({ where }),
      ]);

      // Convert Decimal fields to numbers for JSON serialization
      const items = packages.map(pkg => {
        const pkgAny = pkg as any;
        return {
          id: pkg.id,
          name: pkg.name,
          price: Number(pkg.price),
          min_amount: pkg.min_amount ? Number(pkg.min_amount) : null,
          max_amount: pkg.max_amount ? Number(pkg.max_amount) : null,
          self_monthly: pkg.self_monthly ? Number(pkg.self_monthly) : null,
          self_roi_percent: pkg.self_roi_percent ? Number(pkg.self_roi_percent) : null,
          global_ids: pkg.global_ids,
          global_monthly_per_id: pkg.global_monthly_per_id ? Number(pkg.global_monthly_per_id) : null,
          recurring_rate_percent: pkg.recurring_rate_percent ? Number(pkg.recurring_rate_percent) : null,
          direct_spot_percent: pkgAny.direct_spot_percent ? Number(pkgAny.direct_spot_percent) : null,
          direct_monthly_royalty_percent: pkgAny.direct_monthly_royalty_percent ? Number(pkgAny.direct_monthly_royalty_percent) : null,
          validity_months: pkg.validity_months,
          validity_days: pkg.validity_days,
          status: pkg.status,
          course_id: pkg.course_id,
          created_at: pkg.created_at,
          updated_at: pkg.updated_at,
        };
      });

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: totalPages,
        total,
        items,
      });
    } catch (error) {
      console.error('Error listing packages:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/packages:
   *   post:
   *     tags:
   *       - Admin Packages
   *     summary: Create a new package
   *     description: |
   *       Create a new package with pricing and commission details.
   *       This endpoint is only accessible to administrators.
   *     operationId: createPackageAdmin
   *     security:
   *       - adminAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - price
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Premium Package"
   *               price:
   *                 type: number
   *                 example: 2500.00
   *               min_amount:
   *                 type: number
   *                 nullable: true
   *                 example: 1000.00
   *               max_amount:
   *                 type: number
   *                 nullable: true
   *                 example: 5000.00
   *               self_monthly:
   *                 type: number
   *                 nullable: true
   *                 example: 62.50
   *               self_roi_percent:
   *                 type: number
   *                 nullable: true
   *                 example: 2.50
   *               global_ids:
   *                 type: number
   *                 nullable: true
   *                 example: 3
   *               global_monthly_per_id:
   *                 type: number
   *                 nullable: true
   *                 example: 20.00
   *               recurring_rate_percent:
   *                 type: number
   *                 nullable: true
   *                 example: 0.5
   *               validity_months:
   *                 type: number
   *                 default: 12
   *                 example: 12
   *               validity_days:
   *                 type: number
   *                 nullable: true
   *                 example: 730
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *                 default: active
   *                 example: "active"
   *               course_id:
   *                 type: number
   *                 nullable: true
   *                 example: 12345
   *     responses:
   *       '201':
   *         description: Package created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: number
   *                   example: 9
   *                 name:
   *                   type: string
   *                   example: "Premium Package"
   *                 price:
   *                   type: number
   *                   example: 2500.00
   *                 min_amount:
   *                   type: number
   *                   nullable: true
   *                   example: 1000.00
   *                 max_amount:
   *                   type: number
   *                   nullable: true
   *                   example: 5000.00
   *                 self_monthly:
   *                   type: number
   *                   nullable: true
   *                   example: 62.50
   *                 self_roi_percent:
   *                   type: number
   *                   nullable: true
   *                   example: 2.50
   *                 global_ids:
   *                   type: number
   *                   nullable: true
   *                   example: 3
   *                 global_monthly_per_id:
   *                   type: number
   *                   nullable: true
   *                   example: 20.00
   *                 recurring_rate_percent:
   *                   type: number
   *                   nullable: true
   *                   example: 0.5
   *                 validity_months:
   *                   type: number
   *                   example: 12
   *                 validity_days:
   *                   type: number
   *                   nullable: true
   *                   example: 730
   *                 status:
   *                   type: string
   *                   enum: [active, inactive]
   *                   example: "active"
   *                 course_id:
   *                   type: number
   *                   nullable: true
   *                   example: 12345
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-10T13:26:29.484Z"
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-10T13:26:29.484Z"
   *       '401':
   *         description: Unauthorized
   *       '400':
   *         description: Validation error
   *       '500':
   *         description: Internal server error
   */
  app.post('/packages', {
    preHandler: [adminAuth, checkPermission('PACKAGE_MANAGE')],
    schema: {
      description: 'Create a new package (Admin only)',
      tags: ['Admin Packages'],
      summary: 'Create Package',
      body: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          min_amount: { type: 'number', nullable: true },
          max_amount: { type: 'number', nullable: true },
          self_monthly: { type: 'number', nullable: true },
          self_roi_percent: { type: 'number', nullable: true },
          global_ids: { type: 'number', nullable: true },
          global_monthly_per_id: { type: 'number', nullable: true },
          recurring_rate_percent: { type: 'number', nullable: true },
          validity_months: { type: 'number', default: 12 },
          validity_days: { type: 'number', nullable: true },
          status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
          course_id: { type: 'number', nullable: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            price: { type: 'number' },
            min_amount: { type: ['number', 'null'] },
            max_amount: { type: ['number', 'null'] },
            self_monthly: { type: ['number', 'null'] },
            self_roi_percent: { type: ['number', 'null'] },
            global_ids: { type: ['number', 'null'] },
            global_monthly_per_id: { type: ['number', 'null'] },
            recurring_rate_percent: { type: ['number', 'null'] },
            validity_months: { type: 'number' },
            validity_days: { type: ['number', 'null'] },
            status: { type: 'string' },
            course_id: { type: ['number', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const body = createPackageBody.parse(req.body);
      const row = await prisma.packages.create({
        data: {
          name: body.name,
          price: body.price,
          min_amount: body.min_amount ?? null,
          max_amount: body.max_amount ?? null,
          self_monthly: body.self_monthly ?? null,
          self_roi_percent: body.self_roi_percent ?? null,
          global_ids: body.global_ids ?? null,
          global_monthly_per_id: body.global_monthly_per_id ?? null,
          recurring_rate_percent: body.recurring_rate_percent ?? null,
          direct_spot_percent: body.direct_spot_percent ?? null,
          direct_monthly_royalty_percent: body.direct_monthly_royalty_percent ?? null,
          validity_months: body.validity_months,
          validity_days: body.validity_days ?? null,
          status: body.status,
          course_id: body.course_id ?? null,
        } as any,
      });
      
      // Convert Decimal fields to numbers for JSON serialization
      const response = {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        min_amount: row.min_amount ? Number(row.min_amount) : null,
        max_amount: row.max_amount ? Number(row.max_amount) : null,
        self_monthly: row.self_monthly ? Number(row.self_monthly) : null,
        self_roi_percent: row.self_roi_percent ? Number(row.self_roi_percent) : null,
        global_ids: row.global_ids,
          global_monthly_per_id: row.global_monthly_per_id ? Number(row.global_monthly_per_id) : null,
          recurring_rate_percent: row.recurring_rate_percent ? Number(row.recurring_rate_percent) : null,
          direct_spot_percent: (row as any).direct_spot_percent ? Number((row as any).direct_spot_percent) : null,
          direct_monthly_royalty_percent: (row as any).direct_monthly_royalty_percent ? Number((row as any).direct_monthly_royalty_percent) : null,
          validity_months: row.validity_months,
        validity_days: row.validity_days,
        status: row.status,
        course_id: row.course_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      
      return reply.code(201).send(response);
    } catch (error) {
      console.error('Error creating package:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/packages/{id}:
   *   get:
   *     tags:
   *       - Admin Packages
   *     summary: Get single package details
   *     description: |
   *       Retrieve detailed information about a specific package by ID.
   *       This endpoint is only accessible to administrators.
   *     operationId: getPackageById
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Package ID
   *         example: 1
   *     responses:
   *       '200':
   *         description: Package details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: number
   *                   example: 1
   *                 name:
   *                   type: string
   *                   example: "Premium Package"
   *                 price:
   *                   type: number
   *                   example: 2500.00
   *                 min_amount:
   *                   type: number
   *                   nullable: true
   *                   example: 1000.00
   *                 max_amount:
   *                   type: number
   *                   nullable: true
   *                   example: 5000.00
   *                 self_monthly:
   *                   type: number
   *                   nullable: true
   *                   example: 62.50
   *                 self_roi_percent:
   *                   type: number
   *                   nullable: true
   *                   example: 2.50
   *                 global_ids:
   *                   type: number
   *                   nullable: true
   *                   example: 3
   *                 global_monthly_per_id:
   *                   type: number
   *                   nullable: true
   *                   example: 20.00
   *                 recurring_rate_percent:
   *                   type: number
   *                   nullable: true
   *                   example: 0.5
   *                 validity_months:
   *                   type: number
   *                   example: 12
   *                 validity_days:
   *                   type: number
   *                   nullable: true
   *                   example: 730
   *                 status:
   *                   type: string
   *                   example: "active"
   *                 course_id:
   *                   type: number
   *                   nullable: true
   *                   example: 12345
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: Package not found
   *       '500':
   *         description: Internal server error
   */
  app.get('/packages/:id', {
    preHandler: [adminAuth, checkPermission('PACKAGE_VIEW')],
    schema: {
      description: 'Get single package details (Admin only)',
      tags: ['Admin Packages'],
      summary: 'Get Package',
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
            id: { type: 'number' },
            name: { type: 'string' },
            price: { type: 'number' },
            min_amount: { type: ['number', 'null'] },
            max_amount: { type: ['number', 'null'] },
            self_monthly: { type: ['number', 'null'] },
            self_roi_percent: { type: ['number', 'null'] },
            global_ids: { type: ['number', 'null'] },
            global_monthly_per_id: { type: ['number', 'null'] },
            recurring_rate_percent: { type: ['number', 'null'] },
            validity_months: { type: 'number' },
            validity_days: { type: ['number', 'null'] },
            status: { type: 'string' },
            course_id: { type: ['number', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const packageId = parseInt((req.params as any).id, 10);
      if (isNaN(packageId)) {
        return reply.code(400).send({ error: 'Invalid package ID' });
      }

      const packageData = await prisma.packages.findUnique({
        where: { id: packageId },
      });

      if (!packageData) {
        return reply.code(404).send({ error: 'Package not found' });
      }

      // Convert Decimal fields to numbers for JSON serialization
      const response = {
        id: packageData.id,
        name: packageData.name,
        price: Number(packageData.price),
        min_amount: packageData.min_amount ? Number(packageData.min_amount) : null,
        max_amount: packageData.max_amount ? Number(packageData.max_amount) : null,
        self_monthly: packageData.self_monthly ? Number(packageData.self_monthly) : null,
        self_roi_percent: packageData.self_roi_percent ? Number(packageData.self_roi_percent) : null,
        global_ids: packageData.global_ids,
        global_monthly_per_id: packageData.global_monthly_per_id ? Number(packageData.global_monthly_per_id) : null,
        recurring_rate_percent: packageData.recurring_rate_percent ? Number(packageData.recurring_rate_percent) : null,
        direct_spot_percent: (packageData as any).direct_spot_percent ? Number((packageData as any).direct_spot_percent) : null,
        direct_monthly_royalty_percent: (packageData as any).direct_monthly_royalty_percent ? Number((packageData as any).direct_monthly_royalty_percent) : null,
        validity_months: packageData.validity_months,
        validity_days: packageData.validity_days,
        status: packageData.status,
        course_id: packageData.course_id,
        created_at: packageData.created_at,
        updated_at: packageData.updated_at,
      };

      console.log('GET package response:', JSON.stringify(response, null, 2));
      return reply.send(response);
    } catch (error) {
      console.error('Error getting package:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/packages/{id}:
   *   put:
   *     tags:
   *       - Admin Packages
   *     summary: Update package details
   *     description: |
   *       Update package information including pricing, commission rates, validity, and status.
   *       Only provided fields will be updated. This endpoint is only accessible to administrators.
   *     operationId: updatePackage
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Package ID
   *         example: 1
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Premium Package Updated"
   *               price:
   *                 type: number
   *                 example: 3000.00
   *               min_amount:
   *                 type: number
   *                 nullable: true
   *                 example: 1500.00
   *               max_amount:
   *                 type: number
   *                 nullable: true
   *                 example: 6000.00
   *               self_monthly:
   *                 type: number
   *                 nullable: true
   *                 example: 75.00
   *               self_roi_percent:
   *                 type: number
   *                 nullable: true
   *                 example: 2.50
   *               global_ids:
   *                 type: number
   *                 nullable: true
   *                 example: 5
   *               global_monthly_per_id:
   *                 type: number
   *                 nullable: true
   *                 example: 25.00
   *               recurring_rate_percent:
   *                 type: number
   *                 nullable: true
   *                 example: 0.6
   *               validity_months:
   *                 type: number
   *                 example: 24
   *               validity_days:
   *                 type: number
   *                 nullable: true
   *                 example: 730
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *                 example: "active"
   *               course_id:
   *                 type: number
   *                 nullable: true
   *                 example: 12345
   *     responses:
   *       '200':
   *         description: Package updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: number
   *                   example: 1
   *                 name:
   *                   type: string
   *                   example: "Premium Package Updated"
   *                 price:
   *                   type: number
   *                   example: 3000.00
   *                 min_amount:
   *                   type: number
   *                   nullable: true
   *                   example: 1500.00
   *                 max_amount:
   *                   type: number
   *                   nullable: true
   *                   example: 6000.00
   *                 self_monthly:
   *                   type: number
   *                   nullable: true
   *                   example: 75.00
   *                 self_roi_percent:
   *                   type: number
   *                   nullable: true
   *                   example: 2.50
   *                 global_ids:
   *                   type: number
   *                   nullable: true
   *                   example: 5
   *                 global_monthly_per_id:
   *                   type: number
   *                   nullable: true
   *                   example: 25.00
   *                 recurring_rate_percent:
   *                   type: number
   *                   nullable: true
   *                   example: 0.6
   *                 validity_months:
   *                   type: number
   *                   example: 24
   *                 validity_days:
   *                   type: number
   *                   nullable: true
   *                   example: 730
   *                 status:
   *                   type: string
   *                   enum: [active, inactive]
   *                   example: "active"
   *                 course_id:
   *                   type: number
   *                   nullable: true
   *                   example: 12345
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-10T13:26:29.484Z"
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-10T14:04:04.265Z"
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: Package not found
   *       '500':
   *         description: Internal server error
   */
  app.put('/packages/:id', {
    preHandler: [adminAuth, checkPermission('PACKAGE_MANAGE')],
    schema: {
      description: 'Update package details (Admin only)',
      tags: ['Admin Packages'],
      summary: 'Update Package',
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
          name: { type: 'string' },
          price: { type: 'number' },
          min_amount: { type: 'number', nullable: true },
          max_amount: { type: 'number', nullable: true },
          self_monthly: { type: 'number', nullable: true },
          self_roi_percent: { type: 'number', nullable: true },
          global_ids: { type: 'number', nullable: true },
          global_monthly_per_id: { type: 'number', nullable: true },
          recurring_rate_percent: { type: 'number', nullable: true },
          validity_months: { type: 'number' },
          validity_days: { type: 'number', nullable: true },
          status: { type: 'string', enum: ['active', 'inactive'] },
          course_id: { type: 'number', nullable: true },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            price: { type: 'number' },
            min_amount: { type: ['number', 'null'] },
            max_amount: { type: ['number', 'null'] },
            self_monthly: { type: ['number', 'null'] },
            self_roi_percent: { type: ['number', 'null'] },
            global_ids: { type: ['number', 'null'] },
            global_monthly_per_id: { type: ['number', 'null'] },
            recurring_rate_percent: { type: ['number', 'null'] },
            validity_months: { type: 'number' },
            validity_days: { type: ['number', 'null'] },
            status: { type: 'string' },
            course_id: { type: ['number', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const packageId = parseInt((req.params as any).id, 10);
      if (isNaN(packageId)) {
        return reply.code(400).send({ error: 'Invalid package ID' });
      }

      // Check if package exists
      const existingPackage = await prisma.packages.findUnique({
        where: { id: packageId },
      });

      if (!existingPackage) {
        return reply.code(404).send({ error: 'Package not found' });
      }

      // Parse and validate request body
      const body = updatePackageBody.parse(req.body);

      // Build update data object (only include provided fields)
      const updateData: any = {
        updated_at: new Date(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.price !== undefined) updateData.price = body.price;
      if (body.min_amount !== undefined) updateData.min_amount = body.min_amount;
      if (body.max_amount !== undefined) updateData.max_amount = body.max_amount;
      if (body.self_monthly !== undefined) updateData.self_monthly = body.self_monthly;
      if (body.self_roi_percent !== undefined) updateData.self_roi_percent = body.self_roi_percent;
      if (body.global_ids !== undefined) updateData.global_ids = body.global_ids;
      if (body.global_monthly_per_id !== undefined) updateData.global_monthly_per_id = body.global_monthly_per_id;
      if (body.recurring_rate_percent !== undefined) updateData.recurring_rate_percent = body.recurring_rate_percent;
      if (body.direct_spot_percent !== undefined) updateData.direct_spot_percent = body.direct_spot_percent;
      if (body.direct_monthly_royalty_percent !== undefined) updateData.direct_monthly_royalty_percent = body.direct_monthly_royalty_percent;
      if (body.validity_months !== undefined) updateData.validity_months = body.validity_months;
      if (body.validity_days !== undefined) updateData.validity_days = body.validity_days;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.course_id !== undefined) updateData.course_id = body.course_id;

      const updatedPackage = await prisma.packages.update({
        where: { id: packageId },
        data: updateData,
      });

      // Convert Decimal fields to numbers for JSON serialization
      const response = {
        id: updatedPackage.id,
        name: updatedPackage.name,
        price: Number(updatedPackage.price),
        min_amount: updatedPackage.min_amount ? Number(updatedPackage.min_amount) : null,
        max_amount: updatedPackage.max_amount ? Number(updatedPackage.max_amount) : null,
        self_monthly: updatedPackage.self_monthly ? Number(updatedPackage.self_monthly) : null,
        self_roi_percent: updatedPackage.self_roi_percent ? Number(updatedPackage.self_roi_percent) : null,
        global_ids: updatedPackage.global_ids,
        global_monthly_per_id: updatedPackage.global_monthly_per_id ? Number(updatedPackage.global_monthly_per_id) : null,
        recurring_rate_percent: updatedPackage.recurring_rate_percent ? Number(updatedPackage.recurring_rate_percent) : null,
        direct_spot_percent: (updatedPackage as any).direct_spot_percent ? Number((updatedPackage as any).direct_spot_percent) : null,
        direct_monthly_royalty_percent: (updatedPackage as any).direct_monthly_royalty_percent ? Number((updatedPackage as any).direct_monthly_royalty_percent) : null,
        validity_months: updatedPackage.validity_months,
        validity_days: updatedPackage.validity_days,
        status: updatedPackage.status,
        course_id: updatedPackage.course_id,
        created_at: updatedPackage.created_at,
        updated_at: updatedPackage.updated_at,
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error updating package:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/packages/{id}:
   *   delete:
   *     tags:
   *       - Admin Packages
   *     summary: Delete a package
   *     description: |
   *       Delete a package by ID. This operation is permanent and cannot be undone.
   *       This endpoint is only accessible to administrators.
   *     operationId: deletePackage
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Package ID
   *         example: 1
   *     responses:
   *       '200':
   *         description: Package deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Package deleted successfully"
   *                 id:
   *                   type: number
   *                   example: 1
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: Package not found
   *       '500':
   *         description: Internal server error
   */
  app.delete('/packages/:id', {
    preHandler: [adminAuth, checkPermission('PACKAGE_MANAGE')],
    schema: {
      description: 'Delete a package (Admin only)',
      tags: ['Admin Packages'],
      summary: 'Delete Package',
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
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const packageId = parseInt((req.params as any).id, 10);
      if (isNaN(packageId)) {
        return reply.code(400).send({ error: 'Invalid package ID' });
      }

      // Check if package exists
      const existingPackage = await prisma.packages.findUnique({
        where: { id: packageId },
      });

      if (!existingPackage) {
        return reply.code(404).send({ error: 'Package not found' });
      }

      // Delete the package
      await prisma.packages.delete({
        where: { id: packageId },
      });

      return reply.send({
        message: 'Package deleted successfully',
        id: packageId,
      });
    } catch (error) {
      console.error('Error deleting package:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

