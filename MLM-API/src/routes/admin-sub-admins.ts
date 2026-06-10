import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { superAdminAuth } from '../middleware/superAdminAuth.js';

// Validation schemas
const createSubAdminBody = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  permissions: z.array(z.string()).optional().default([])
});

const updateSubAdminBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[0-9]{10}$/).optional(),
  password: z.string().min(6).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  permissions: z.array(z.string()).optional()
});

const updatePermissionsBody = z.object({
  permissions: z.array(z.string())
});

/** Swagger: admin JWT from /auth/admin/login (bearerAuth) or ADMIN_TOKEN (adminAuth) */
const adminRouteSecurity: Array<{ [key: string]: string[] }> = [
  { bearerAuth: [] },
  { adminAuth: [] },
];

export async function adminSubAdminsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/permissions:
   *   get:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Get all available permissions
   *     description: Retrieve list of all available permissions grouped by category
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: List of permissions retrieved successfully
   */
  app.get('/permissions', {
    preHandler: adminAuth,
    schema: {
      description: 'Get all available permissions',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      response: {
        200: {
          type: 'object',
          properties: {
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  label: { type: 'string' },
                  group: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const permissions = await prisma.admin_permissions_master.findMany({
        orderBy: [
          { group: 'asc' },
          { label: 'asc' }
        ],
        select: {
          key: true,
          label: true,
          group: true
        }
      });

      return reply.send({ permissions });
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      return reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch permissions' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/my-permissions:
   *   get:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Get current admin's permissions
   *     description: Retrieve list of permissions for the currently authenticated admin
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: Current admin's permissions retrieved successfully
   */
  app.get('/my-permissions', {
    preHandler: adminAuth,
    schema: {
      description: 'Get current admin\'s permissions',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      response: {
        200: {
          type: 'object',
          properties: {
            permissions: {
              type: 'array',
              items: { type: 'string' }
            },
            role: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const admin = (request as any).admin;
      
      // SUPER_ADMIN has all permissions
      if (admin.role === 'SUPER_ADMIN') {
        const allPermissions = await prisma.admin_permissions_master.findMany({
          select: { key: true }
        });
        return reply.send({
          permissions: allPermissions.map(p => p.key),
          role: 'SUPER_ADMIN'
        });
      }

      // SUB_ADMIN - get their permissions
      if (admin.role === 'SUB_ADMIN' && admin.user_id) {
        const userId = BigInt(admin.user_id);
        const userPermissions = await prisma.admin_user_permissions.findMany({
          where: { admin_user_id: userId },
          select: { permission_key: true }
        });

        return reply.send({
          permissions: userPermissions.map(p => p.permission_key),
          role: 'SUB_ADMIN'
        });
      }

      return reply.send({
        permissions: [],
        role: admin.role || 'unknown'
      });
    } catch (error: any) {
      console.error('Error fetching admin permissions:', error);
      return reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch permissions' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/sub-admins:
   *   get:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: List all sub-admins
   *     description: Retrieve paginated list of all sub-admin users
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, inactive]
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search by name or email
   *     responses:
   *       '200':
   *         description: List of sub-admins retrieved successfully
   */
  app.get('/sub-admins', {
    preHandler: adminAuth,
    schema: {
      description: 'List all sub-admins',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['active', 'inactive'] },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total_pages: { type: 'integer' },
            total: { type: 'integer' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  phone: { type: 'string', nullable: true },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  password: { type: 'string', nullable: true },
                  action_pin: { type: 'string', nullable: true },
                  permissions: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(['active', 'inactive']).optional(),
        search: z.string().optional()
      }).parse(request.query);

      const skip = (query.page - 1) * query.limit;

      // Build where clause
      const where: any = {
        role: 'SUB_ADMIN'
      };

      if (query.status) {
        where.status = query.status;
      }

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } }
        ];
      }

      // Get total count
      const total = await prisma.users.count({ where });

      // Get sub-admins with permissions
      const subAdmins = await prisma.users.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          password_plain: true, // Include password for admin view
          action_pin: true, // Include action PIN for admin view
          created_at: true,
          updated_at: true,
          admin_permissions: {
            select: {
              permission_key: true
            }
          }
        }
      });

      const items = subAdmins.map(subAdmin => ({
        id: subAdmin.id.toString(),
        name: subAdmin.name,
        email: subAdmin.email,
        phone: subAdmin.phone,
        role: subAdmin.role,
        status: subAdmin.status,
        password: subAdmin.password_plain || null, // Include password for admin view
        action_pin: subAdmin.action_pin || null, // Include action PIN for admin view
        permissions: subAdmin.admin_permissions.map(p => p.permission_key),
        created_at: subAdmin.created_at.toISOString(),
        updated_at: subAdmin.updated_at.toISOString()
      }));

      const total_pages = Math.ceil(total / query.limit);

      return reply.send({
        count: items.length,
        page: query.page,
        limit: query.limit,
        total_pages,
        total,
        items
      });
    } catch (error: any) {
      console.error('Error listing sub-admins:', error);
      return reply.code(500).send({ error: 'internal_error', message: 'Failed to list sub-admins' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/sub-admins:
   *   post:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Create a new sub-admin
   *     description: Create a new sub-admin user with specified permissions (SUPER_ADMIN only)
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
   *               - email
   *               - password
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *                 format: email
   *               phone:
   *                 type: string
   *               password:
   *                 type: string
   *                 minLength: 6
   *               permissions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       '201':
   *         description: Sub-admin created successfully
   *       '400':
   *         description: Validation error or email already exists
   *       '403':
   *         description: Forbidden - SUPER_ADMIN access required
   */
  app.post('/sub-admins', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Create a new sub-admin (SUPER_ADMIN only)',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', pattern: '^[0-9]{10}$' },
          password: { type: 'string', minLength: 6 },
          permissions: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string', nullable: true },
            role: { type: 'string' },
            permissions: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = createSubAdminBody.parse(request.body);

      // Duplicate email allowed for sub-admin (may match an existing user email, e.g. faizan@gmail.com)

      // Validate permissions exist
      if (body.permissions && body.permissions.length > 0) {
        const validPermissions = await prisma.admin_permissions_master.findMany({
          where: { key: { in: body.permissions } },
          select: { key: true }
        });

        const validKeys = validPermissions.map(p => p.key);
        const invalidKeys = body.permissions.filter(key => !validKeys.includes(key));

        if (invalidKeys.length > 0) {
          return reply.code(400).send({
            error: 'invalid_permissions',
            message: `Invalid permissions: ${invalidKeys.join(', ')}`
          });
        }
      }

      // Store password in plain text (matching existing system)
      const passwordPlain = body.password;

      // Create sub-admin with permissions in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.users.create({
          data: {
            name: body.name,
            email: body.email,
            phone: body.phone,
            password_hash: passwordPlain, // Store plain text (matching existing system)
            password_plain: passwordPlain, // Store plain text for admin view
            role: 'SUB_ADMIN',
            status: 'active'
          }
        });

        // Add permissions if provided
        if (body.permissions && body.permissions.length > 0) {
          await tx.admin_user_permissions.createMany({
            data: body.permissions.map(permissionKey => ({
              admin_user_id: user.id,
              permission_key: permissionKey
            }))
          });
        }

        // Fetch created user with permissions
        return await tx.users.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            admin_permissions: {
              select: {
                permission_key: true
              }
            }
          }
        });
      });

      return reply.code(201).send({
        id: result!.id.toString(),
        name: result!.name,
        email: result!.email,
        phone: result!.phone,
        role: result!.role,
        permissions: result!.admin_permissions.map(p => p.permission_key)
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'validation_error', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      console.error('Error creating sub-admin:', error);
      return reply.code(500).send({ 
        error: 'internal_error', 
        message: 'Failed to create sub-admin' 
      });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/sub-admins/{id}:
   *   get:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Get sub-admin by ID
   *     description: Retrieve details of a specific sub-admin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Sub-admin details retrieved successfully
   *       '404':
   *         description: Sub-admin not found
   */
  app.get('/sub-admins/:id', {
    preHandler: adminAuth,
    schema: {
      description: 'Get sub-admin by ID',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            role: { type: 'string' },
            status: { type: 'string' },
            password: { type: 'string', nullable: true },
            permissions: {
              type: 'array',
              items: { type: 'string' }
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string()
      }).parse(request.params);

      const userId = BigInt(params.id);

      const subAdmin = await prisma.users.findUnique({
        where: { 
          id: userId,
          role: 'SUB_ADMIN'
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          password_plain: true, // Include password for admin view
          created_at: true,
          updated_at: true,
          admin_permissions: {
            select: {
              permission_key: true
            }
          }
        }
      });

      if (!subAdmin) {
        return reply.code(404).send({ 
          error: 'not_found', 
          message: 'Sub-admin not found' 
        });
      }

      return reply.send({
        id: subAdmin.id.toString(),
        name: subAdmin.name,
        email: subAdmin.email,
        phone: subAdmin.phone,
        role: subAdmin.role,
        status: subAdmin.status,
        password: subAdmin.password_plain || null, // Include password for admin view
        permissions: subAdmin.admin_permissions.map(p => p.permission_key),
        created_at: subAdmin.created_at.toISOString(),
        updated_at: subAdmin.updated_at.toISOString()
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'validation_error', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      console.error('Error fetching sub-admin:', error);
      return reply.code(500).send({ 
        error: 'internal_error', 
        message: 'Failed to fetch sub-admin' 
      });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/sub-admins/{id}:
   *   put:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Update sub-admin
   *     description: Update sub-admin details (SUPER_ADMIN only)
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *                 format: email
   *               phone:
   *                 type: string
   *               password:
   *                 type: string
   *                 minLength: 6
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *               permissions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       '200':
   *         description: Sub-admin updated successfully
   *       '400':
   *         description: Validation error
   *       '403':
   *         description: Forbidden - SUPER_ADMIN access required
   *       '404':
   *         description: Sub-admin not found
   */
  app.put('/sub-admins/:id', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Update sub-admin (SUPER_ADMIN only)',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', pattern: '^[0-9]{10}$' },
          password: { type: 'string', minLength: 6 },
          status: { type: 'string', enum: ['active', 'inactive'] },
          permissions: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string', nullable: true },
            role: { type: 'string' },
            status: { type: 'string' },
            permissions: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string()
      }).parse(request.params);

      const body = updateSubAdminBody.parse(request.body);

      const userId = BigInt(params.id);

      // Check if sub-admin exists
      const existingSubAdmin = await prisma.users.findUnique({
        where: { 
          id: userId,
          role: 'SUB_ADMIN'
        }
      });

      if (!existingSubAdmin) {
        return reply.code(404).send({ 
          error: 'not_found', 
          message: 'Sub-admin not found' 
        });
      }

      // Duplicate email allowed on sub-admin update (may match another user or sub-admin)

      // Validate permissions if provided
      if (body.permissions) {
        const validPermissions = await prisma.admin_permissions_master.findMany({
          where: { key: { in: body.permissions } },
          select: { key: true }
        });

        const validKeys = validPermissions.map(p => p.key);
        const invalidKeys = body.permissions.filter(key => !validKeys.includes(key));

        if (invalidKeys.length > 0) {
          return reply.code(400).send({
            error: 'invalid_permissions',
            message: `Invalid permissions: ${invalidKeys.join(', ')}`
          });
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.status !== undefined) updateData.status = body.status;

      // Store password in plain text if provided (matching existing system)
      if (body.password) {
        updateData.password_hash = body.password; // Store plain text (matching existing system)
        updateData.password_plain = body.password; // Store plain text for admin view
      }

      // Update sub-admin and permissions in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update user
        const user = await tx.users.update({
          where: { id: userId },
          data: updateData
        });

        // Update permissions if provided
        if (body.permissions !== undefined) {
          // Delete existing permissions
          await tx.admin_user_permissions.deleteMany({
            where: { admin_user_id: userId }
          });

          // Add new permissions
          if (body.permissions.length > 0) {
            await tx.admin_user_permissions.createMany({
              data: body.permissions.map(permissionKey => ({
                admin_user_id: userId,
                permission_key: permissionKey
              }))
            });
          }
        }

        // Fetch updated user with permissions
        return await tx.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            admin_permissions: {
              select: {
                permission_key: true
              }
            }
          }
        });
      });

      return reply.send({
        id: result!.id.toString(),
        name: result!.name,
        email: result!.email,
        phone: result!.phone,
        role: result!.role,
        status: result!.status,
        permissions: result!.admin_permissions.map(p => p.permission_key)
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'validation_error', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      console.error('Error updating sub-admin:', error);
      return reply.code(500).send({ 
        error: 'internal_error', 
        message: 'Failed to update sub-admin' 
      });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/sub-admins/{id}/permissions:
   *   put:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Update sub-admin permissions
   *     description: Update permissions for a sub-admin (SUPER_ADMIN only)
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - permissions
   *             properties:
   *               permissions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       '200':
   *         description: Permissions updated successfully
   *       '400':
   *         description: Validation error
   *       '403':
   *         description: Forbidden - SUPER_ADMIN access required
   *       '404':
   *         description: Sub-admin not found
   */
  app.put('/sub-admins/:id/permissions', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Update sub-admin permissions (SUPER_ADMIN only)',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['permissions'],
        properties: {
          permissions: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            permissions: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string()
      }).parse(request.params);

      const body = updatePermissionsBody.parse(request.body);

      const userId = BigInt(params.id);

      // Check if sub-admin exists
      const existingSubAdmin = await prisma.users.findUnique({
        where: { 
          id: userId,
          role: 'SUB_ADMIN'
        }
      });

      if (!existingSubAdmin) {
        return reply.code(404).send({ 
          error: 'not_found', 
          message: 'Sub-admin not found' 
        });
      }

      // Validate permissions
      const validPermissions = await prisma.admin_permissions_master.findMany({
        where: { key: { in: body.permissions } },
        select: { key: true }
      });

      const validKeys = validPermissions.map(p => p.key);
      const invalidKeys = body.permissions.filter(key => !validKeys.includes(key));

      if (invalidKeys.length > 0) {
        return reply.code(400).send({
          error: 'invalid_permissions',
          message: `Invalid permissions: ${invalidKeys.join(', ')}`
        });
      }

      // Update permissions in transaction
      await prisma.$transaction(async (tx) => {
        // Delete existing permissions
        await tx.admin_user_permissions.deleteMany({
          where: { admin_user_id: userId }
        });

        // Add new permissions
        if (body.permissions.length > 0) {
          await tx.admin_user_permissions.createMany({
            data: body.permissions.map(permissionKey => ({
              admin_user_id: userId,
              permission_key: permissionKey
            }))
          });
        }
      });

      return reply.send({
        id: params.id,
        permissions: body.permissions
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'validation_error', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      console.error('Error updating permissions:', error);
      return reply.code(500).send({ 
        error: 'internal_error', 
        message: 'Failed to update permissions' 
      });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/sub-admins/{id}:
   *   delete:
   *     tags:
   *       - Admin Sub-Admins
   *     summary: Deactivate sub-admin
   *     description: Deactivate a sub-admin by setting status to inactive (SUPER_ADMIN only)
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Sub-admin deactivated successfully
   *       '403':
   *         description: Forbidden - SUPER_ADMIN access required
   *       '404':
   *         description: Sub-admin not found
   */
  app.delete('/sub-admins/:id', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Deactivate sub-admin (SUPER_ADMIN only)',
      tags: ['Admin Sub-Admins'],
      security: adminRouteSecurity,
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string()
      }).parse(request.params);

      const userId = BigInt(params.id);

      // Check if sub-admin exists
      const existingSubAdmin = await prisma.users.findUnique({
        where: { 
          id: userId,
          role: 'SUB_ADMIN'
        }
      });

      if (!existingSubAdmin) {
        return reply.code(404).send({ 
          error: 'not_found', 
          message: 'Sub-admin not found' 
        });
      }

      // Deactivate by setting status to inactive
      await prisma.users.update({
        where: { id: userId },
        data: { status: 'inactive' }
      });

      return reply.send({
        success: true,
        message: 'Sub-admin deactivated successfully'
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'validation_error', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      console.error('Error deactivating sub-admin:', error);
      return reply.code(500).send({ 
        error: 'internal_error', 
        message: 'Failed to deactivate sub-admin' 
      });
    }
  });
}

