import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { signToken, requireUser } from '../middleware/jwt';
import { FeeService } from '../modules/fees/feeService.js';
import { CommissionService } from '../modules/commissions/commission.service.js';

const registerBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  referrer_user_id: z.coerce.bigint().optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/users/login:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: User login - returns JWT token
   *     description: |
   *       Authenticate a user by email and return a JWT token for subsequent API requests.
   *       Currently, password authentication is not implemented - only email is required.
   *       The returned JWT token should be included in the Authorization header as "Bearer {token}"
   *       for protected endpoints.
   *     operationId: userLogin
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User email address
   *                 example: "user@example.com"
   *               password:
   *                 type: string
   *                 description: Password (currently ignored, no password in schema)
   *                 example: "password123"
   *     responses:
   *       '200':
   *         description: Login successful - JWT token returned
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: JWT token for authentication
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "9"
   *                     email:
   *                       type: string
   *                       nullable: true
   *                       example: "user@example.com"
   *                     name:
   *                       type: string
   *                       nullable: true
   *                       example: "Test User"
   *       '404':
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "user_not_found"
   *       '400':
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Validation error"
   */
  app.post('/login', {
    schema: {
      description: 'User login - returns JWT token',
      tags: ['Authentication'],
      summary: 'Login',
      consumes: ['application/json'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { 
            type: 'string', 
            format: 'email',
            description: 'User email address'
          },
          password: { 
            type: 'string',
            description: 'Password (currently ignored, no password in schema)'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { 
              type: 'string',
              description: 'JWT token for authentication'
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', nullable: true },
                name: { type: 'string', nullable: true }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({ 
      email: z.string().email().optional(),
      password: z.string().optional() // Ignored for now, no password in schema
    }).parse(req.body);
    
    const user = await prisma.users.findFirst({ where: { email: body.email } });
    if (!user) return reply.code(404).send({ error: 'user_not_found' });
    
    const token = signToken({ user_id: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id.toString(), email: user.email, name: user.name } });
  });

  /**
   * @openapi
   * /api/v1/users/register:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Register a new user
   *     description: |
   *       Create a new user account in the MLM system. This endpoint allows users to register
   *       with their name and optional email. If a referrer_user_id is provided, the new user
   *       will be linked to the referrer in the referral tree structure.
   *       
   *       **Important:**
   *       - The referrer_user_id must be a valid existing user ID
   *       - If referrer_user_id is provided, the referral tree (closure table) is automatically updated
   *       - No authentication is required for registration
   *     operationId: registerUser
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 description: User full name
   *                 example: "John Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User email address (optional)
   *                 example: "john@example.com"
   *               referrer_user_id:
   *                 type: string
   *                 description: Referrer user ID (optional) - ID of the user who referred this new user
   *                 example: "9"
   *     responses:
   *       '201':
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   description: Newly created user ID
   *                   example: "10"
   *                 name:
   *                   type: string
   *                   nullable: true
   *                   example: "John Doe"
   *                 email:
   *                   type: string
   *                   nullable: true
   *                   example: "john@example.com"
   *                 referrer_user_id:
   *                   type: string
   *                   nullable: true
   *                   description: ID of the user who referred this user (if provided)
   *                   example: "9"
   *       '400':
   *         description: Validation error or invalid referrer_user_id
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Validation error"
   *                 details:
   *                   type: array
   *                   items:
   *                     type: object
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
  app.post('/register', {
    schema: {
      description: 'Register a new user',
      tags: ['Authentication'],
      summary: 'Register User',
      body: {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            minLength: 1,
            description: 'User full name'
          },
          email: { 
            type: 'string',
            format: 'email',
            description: 'User email address (optional)'
          },
          referrer_user_id: { 
            type: 'string',
            description: 'Referrer user ID (optional)'
          }
        },
        required: ['name']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            referrer_user_id: { type: 'string', nullable: true }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = registerBody.parse(req.body);
    
    // New, race-condition-safe display_id generation with sequential numbering:
    // 1) Create user without display_id
    // 2) Find max display_id number and increment by 1 for sequential IDs
    // 3) Update same user with that display_id
    const DISPLAY_ID_BASE = 2000n;
    
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          name: body.name,
          email: body.email ?? null,
          referrer_user_id: body.referrer_user_id ?? null,
        },
      });

      // Get the maximum numeric part from existing display_ids starting with "SIA"
      // This ensures sequential IDs: SIA02000, SIA02001, SIA02002, etc.
      const maxDisplayIdResult = await tx.$queryRaw<Array<{ display_id: string | null }>>`
        SELECT display_id 
        FROM users 
        WHERE display_id LIKE 'SIA%' 
        ORDER BY display_id DESC 
        LIMIT 1
      `;

      let nextNumericPart: bigint;
      if (maxDisplayIdResult && maxDisplayIdResult.length > 0 && maxDisplayIdResult[0].display_id) {
        // Extract numeric part from existing display_id (e.g., "SIA03943" -> 3943)
        const numericStr = maxDisplayIdResult[0].display_id.replace('SIA', '');
        const maxNumeric = BigInt(numericStr);
        nextNumericPart = maxNumeric + 1n;
      } else {
        // If no existing SIA user, start from base
        nextNumericPart = DISPLAY_ID_BASE;
      }

      const displayId = `SIA${nextNumericPart.toString().padStart(5, '0')}`;

      const updated = await tx.users.update({
        where: { id: created.id },
        data: { display_id: displayId }
      });

      // closure table maintenance
      // 1) self path depth 0
      await tx.user_tree_paths.create({ data: { ancestor_id: created.id, descendant_id: created.id, depth: 0 } });

      // 2) inherit ancestors from referrer (if any) and add referrer as depth 1
      if (created.referrer_user_id) {
        // referrer as ancestor depth 1
        await tx.user_tree_paths.create({
          data: {
            ancestor_id: created.referrer_user_id,
            descendant_id: created.id,
            depth: 1,
          },
        });

        // all ancestors of referrer (except referrer itself) become ancestors of created with +1 depth
        const ancestors = await tx.user_tree_paths.findMany({
          where: { 
            descendant_id: created.referrer_user_id,
            NOT: { ancestor_id: created.referrer_user_id }  // exclude self-path of referrer
          },
        });
        for (const a of ancestors) {
          await tx.user_tree_paths.create({
            data: {
              ancestor_id: a.ancestor_id,
              descendant_id: created.id,
              depth: a.depth + 1,
            },
          });
        }
      }

      return updated;
    });
    // Convert BigInt to string for response
    const payload = { 
      id: user.id.toString(),
      display_id: user.display_id,
      name: user.name, 
      email: user.email, 
      referrer_user_id: user.referrer_user_id ? user.referrer_user_id.toString() : null 
    };
    return reply.code(201).send(payload);
  });

  /**
   * @openapi
   * /api/v1/users:
   *   get:
   *     tags:
   *       - Users
   *     summary: List all users with pagination
   *     description: |
   *       Retrieve a paginated list of all users. Supports filtering by KYC status and sorting.
   *       This endpoint is accessible to authenticated users.
   *     operationId: listUsers
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
   *       - in: query
   *         name: kyc_status
   *         schema:
   *           type: string
   *           enum: [pending, submitted, approved, rejected]
   *         description: Filter by KYC status
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [created_at, name, email]
   *           default: created_at
   *         description: Sort field
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *     responses:
   *       '200':
   *         description: List of users retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 50
   *                 page:
   *                   type: number
   *                   example: 1
   *                 limit:
   *                   type: number
   *                   example: 20
   *                 total_pages:
   *                   type: number
   *                   example: 3
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "7"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Test User"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "test@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "approved"
   *                       referrer_user_id:
   *                         type: string
   *                         nullable: true
   *                         example: "5"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T11:43:03.027Z"
   *       '401':
   *         description: Unauthorized
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'List all users with pagination, filtering, and sorting',
      tags: ['Users'],
      summary: 'List All Users',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          kyc_status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'rejected'] },
          sort: { type: 'string', enum: ['created_at', 'name', 'email'], default: 'created_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string' },
                  referrer_user_id: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const kycStatus = (req.query as any).kyc_status;
      const sort = (req.query as any).sort || 'created_at';
      const order = (req.query as any).order || 'desc';

      const where: any = {};
      if (kycStatus) {
        where.kyc_status = kycStatus;
      }

      const [users, total] = await Promise.all([
        prisma.users.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            kyc_status: true,
            referrer_user_id: true,
            created_at: true,
          },
          orderBy: { [sort]: order },
          skip: offset,
          take: limit,
        }),
        prisma.users.count({ where }),
      ]);

      return reply.send({
        count: users.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items: users.map(u => ({
          id: u.id.toString(),
          name: u.name,
          email: u.email,
          kyc_status: u.kyc_status,
          referrer_user_id: u.referrer_user_id ? u.referrer_user_id.toString() : null,
          created_at: u.created_at,
        })),
      });
    } catch (error) {
      console.error('Error listing users:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Specific routes must come before general /:id route
  /**
   * @openapi
   * /api/v1/users/levels:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get all levels with details
   *     description: |
   *       Retrieve all levels (0-9) with their official titles, descriptions, rewards,
   *       business requirements, and commission information.
   *     operationId: getAllLevels
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Levels retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 10
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 2
   *                       title:
   *                         type: string
   *                         example: "Company City Manager"
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                       business_requirement:
   *                         type: object
   *                         nullable: true
   *                       icon_url:
   *                         type: string
   *                         nullable: true
   *                       color:
   *                         type: string
   *                         nullable: true
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/levels', {
    preHandler: requireUser,
    schema: {
      description: 'Get all levels with details',
      tags: ['Users'],
      summary: 'Get All Levels',
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
                  level: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  reward: { type: 'string', nullable: true },
                  spot_commission_percent: { type: 'number', nullable: true },
                  monthly_royalty_percent: { type: 'number', nullable: true },
                  business_requirement: { type: 'object', nullable: true },
                  icon_url: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const levels = await prisma.levels.findMany({ 
        orderBy: { level: 'asc' } 
      });
      
      return reply.send({
        count: levels.length,
        items: levels.map(l => ({
          level: l.level,
          title: l.title,
          description: l.description,
          reward: l.reward,
          spot_commission_percent: l.spot_commission_percent ? Number(l.spot_commission_percent) : null,
          monthly_royalty_percent: l.monthly_royalty_percent ? Number(l.monthly_royalty_percent) : null,
          business_requirement: l.business_requirement,
          icon_url: l.icon_url,
          color: l.color,
          created_at: l.created_at,
          updated_at: l.updated_at,
        }))
      });
    } catch (error) {
      console.error('Error fetching levels:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================
  // COMMISSION ENDPOINTS (must be before /:id route)
  // ============================================

  /**
   * @openapi
   * /api/v1/users/{id}/commissions:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get user's commission history
   *     description: |
   *       Retrieve complete commission history for a user with pagination and filtering options.
   *       Returns all commission types (SELF, GLOBAL_HELPING, SPOT, MONTHLY) from ledger entries.
   *     operationId: getUserCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *         description: Filter by commission type
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter from this date
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter until this date
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [credited_at, amount]
   *           default: credited_at
   *         description: Sort field
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *     responses:
   *       '200':
   *         description: Commission history retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *                       level:
   *                         type: number
   *                         nullable: true
   *                         example: 1
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions', {
    preHandler: requireUser,
    schema: {
      description: 'Get user commission history with pagination and filters',
      tags: ['Commissions'],
      summary: 'Get Commission History',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'SPOT', 'MONTHLY'] },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          sort: { type: 'string', enum: ['credited_at', 'amount'], default: 'credited_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
                  commission_type: { type: 'string' },
                  amount: { type: 'number' },
                  source_user_id: { type: 'string' },
                  source_user_name: { type: ['string', 'null'] },
                  purchase_id: { type: ['string', 'null'] },
                  level: { type: ['number', 'null'] },
                  credited_at: { type: 'string', format: 'date-time' },
                  settled: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const commissionType = (req.query as any).commission_type;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const sort = (req.query as any).sort || 'credited_at';
      const order = (req.query as any).order || 'desc';

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { receiver_user_id: userId };
      if (commissionType) {
        where.commission_type = commissionType;
      }
      if (startDate || endDate) {
        where.credited_at = {};
        if (startDate) {
          where.credited_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.credited_at.lte = new Date(endDate);
        }
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where,
          orderBy: { [sort]: order },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where }),
      ]);

      // Get source user names and purchase details
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const purchaseIds = [...new Set(commissions.filter(c => c.purchase_id).map(c => c.purchase_id!.toString()))];

      const [sourceUsers] = await Promise.all([
        prisma.users.findMany({
          where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
          select: { id: true, name: true },
        }),
      ]);

      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = commissions.map(commission => {
        const metadata = commission.metadata as any;
        return {
          id: commission.id.toString(),
          commission_type: commission.commission_type,
          amount: Number(commission.amount),
          source_user_id: commission.source_user_id.toString(),
          source_user_name: userMap.get(commission.source_user_id.toString()) ?? null,
          purchase_id: commission.purchase_id ? commission.purchase_id.toString() : null,
          level: metadata?.level ?? null,
          credited_at: commission.credited_at,
          settled: commission.settled,
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
      console.error('Error getting commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/summary:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get commission summary by type
   *     description: |
   *       Retrieve a summary of all commissions grouped by type with total earnings.
   *       Includes totals for SELF, GLOBAL_HELPING, SPOT, and MONTHLY commissions.
   *       Also returns pending commission amount from pending_commissions table.
   *     operationId: getCommissionSummary
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Commission summary retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_earned:
   *                   type: number
   *                   example: 50000.00
   *                   description: Total earnings from all commission types
   *                 by_type:
   *                   type: object
   *                   properties:
   *                     SELF:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 15000.00
   *                         count:
   *                           type: number
   *                           example: 120
   *                     GLOBAL_HELPING:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 20000.00
   *                         count:
   *                           type: number
   *                           example: 365
   *                     SPOT:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 10000.00
   *                         count:
   *                           type: number
   *                           example: 25
   *                     MONTHLY:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 5000.00
   *                         count:
   *                           type: number
   *                           example: 60
   *                 pending_amount:
   *                   type: number
   *                   example: 2500.00
   *                   description: Total amount in pending commissions
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/summary', {
    preHandler: requireUser,
    schema: {
      description: 'Get commission summary by type',
      tags: ['Commissions'],
      summary: 'Get Commission Summary',
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
            total_earned: { type: 'number' },
            by_type: {
              type: 'object',
              properties: {
                SELF: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                GLOBAL_HELPING: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                SPOT: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
                MONTHLY: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    count: { type: 'number' },
                  },
                },
              },
            },
            pending_amount: { type: 'number' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get totals by commission type
      const [selfCommissions, globalCommissions, spotCommissions, monthlyCommissions, pendingCommissions] = await Promise.all([
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'SELF' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'SPOT' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId, commission_type: 'MONTHLY' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.pending_commissions.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
      ]);

      const totalEarned = 
        Number(selfCommissions._sum.amount || 0) +
        Number(globalCommissions._sum.amount || 0) +
        Number(spotCommissions._sum.amount || 0) +
        Number(monthlyCommissions._sum.amount || 0);

      return reply.send({
        total_earned: totalEarned,
        by_type: {
          SELF: {
            total: Number(selfCommissions._sum.amount || 0),
            count: selfCommissions._count.id,
          },
          GLOBAL_HELPING: {
            total: Number(globalCommissions._sum.amount || 0),
            count: globalCommissions._count.id,
          },
          SPOT: {
            total: Number(spotCommissions._sum.amount || 0),
            count: spotCommissions._count.id,
          },
          MONTHLY: {
            total: Number(monthlyCommissions._sum.amount || 0),
            count: monthlyCommissions._count.id,
          },
        },
        pending_amount: Number(pendingCommissions._sum.amount || 0),
      });
    } catch (error) {
      console.error('Error getting commission summary:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/self:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get SELF commissions only
   *     description: |
   *       Retrieve only SELF type commissions for the user with pagination.
   *       SELF commissions are earned when a user purchases a package themselves.
   *     operationId: getSelfCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         description: SELF commissions retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF]
   *                         example: "SELF"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/self', {
    preHandler: requireUser,
    schema: {
      description: 'Get SELF commissions only',
      tags: ['Commissions'],
      summary: 'Get SELF Commissions',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
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
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'SELF' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'SELF' } }),
      ]);

      const items = commissions.map(c => ({
        id: c.id.toString(),
        commission_type: c.commission_type,
        amount: Number(c.amount),
        credited_at: c.credited_at,
        settled: c.settled,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting SELF commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/global:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get GLOBAL_HELPING commissions only
   *     description: |
   *       Retrieve only GLOBAL_HELPING type commissions for the user with pagination.
   *       GLOBAL_HELPING commissions are earned from global helping pool.
   *     operationId: getGlobalCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         description: GLOBAL_HELPING commissions retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [GLOBAL_HELPING]
   *                         example: "GLOBAL_HELPING"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/global', {
    preHandler: requireUser,
    schema: {
      description: 'Get GLOBAL_HELPING commissions only',
      tags: ['Commissions'],
      summary: 'Get Global Commissions',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'GLOBAL_HELPING' } }),
      ]);

      const items = commissions.map(c => ({
        id: c.id.toString(),
        commission_type: c.commission_type,
        amount: Number(c.amount),
        credited_at: c.credited_at,
        settled: c.settled,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting GLOBAL commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/spot:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get SPOT commissions only
   *     description: |
   *       Retrieve only SPOT type commissions for the user with pagination.
   *       SPOT commissions are one-time commissions earned from downline purchases.
   *     operationId: getSpotCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         description: SPOT commissions retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SPOT]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/spot', {
    preHandler: requireUser,
    schema: {
      description: 'Get SPOT commissions only',
      tags: ['Commissions'],
      summary: 'Get Spot Commissions',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'SPOT' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'SPOT' } }),
      ]);

      // Get source user names
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = commissions.map(c => ({
        id: c.id.toString(),
        commission_type: c.commission_type,
        amount: Number(c.amount),
        source_user_id: c.source_user_id.toString(),
        source_user_name: userMap.get(c.source_user_id.toString()) ?? null,
        credited_at: c.credited_at,
        settled: c.settled,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting SPOT commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/monthly:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get MONTHLY commissions only
   *     description: |
   *       Retrieve only MONTHLY type commissions for the user with pagination.
   *       MONTHLY commissions are recurring commissions earned monthly from active downline members.
   *     operationId: getMonthlyCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         description: MONTHLY commissions retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [MONTHLY]
   *                         example: "MONTHLY"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       level:
   *                         type: number
   *                         nullable: true
   *                         example: 1
   *                         description: Commission level (1-9)
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/monthly', {
    preHandler: requireUser,
    schema: {
      description: 'Get MONTHLY commissions only',
      tags: ['Commissions'],
      summary: 'Get Monthly Commissions',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId, commission_type: 'MONTHLY' },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where: { receiver_user_id: userId, commission_type: 'MONTHLY' } }),
      ]);

      // Get source user names
      const sourceUserIds = [...new Set(commissions.map(c => c.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = commissions.map(c => {
        const metadata = c.metadata as any;
        return {
          id: c.id.toString(),
          commission_type: c.commission_type,
          amount: Number(c.amount),
          source_user_id: c.source_user_id.toString(),
          source_user_name: userMap.get(c.source_user_id.toString()) ?? null,
          level: metadata?.level ?? null,
          credited_at: c.credited_at,
          settled: c.settled,
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
      console.error('Error getting MONTHLY commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/by-date:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get commissions filtered by date range
   *     description: |
   *       Retrieve commissions within a specific date range.
   *       Both start_date and end_date are required parameters.
   *       Date format should be ISO 8601 (e.g., 2025-01-01T00:00:00Z).
   *     operationId: getCommissionsByDate
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: start_date
   *         required: true
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date in ISO 8601 format (e.g., 2025-01-01T00:00:00Z)
   *         example: "2025-01-01T00:00:00Z"
   *       - in: query
   *         name: end_date
   *         required: true
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date in ISO 8601 format (e.g., 2025-12-31T23:59:59Z)
   *         example: "2025-12-31T23:59:59Z"
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
   *         description: Commissions filtered by date range retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '400':
   *         description: Bad request - missing start_date or end_date
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "start_date and end_date are required"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/by-date', {
    preHandler: requireUser,
    schema: {
      description: 'Get commissions filtered by date range',
      tags: ['Commissions'],
      summary: 'Get Commissions By Date',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        required: ['start_date', 'end_date'],
        properties: {
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      if (!startDate || !endDate) {
        return reply.code(400).send({ error: 'start_date and end_date are required' });
      }

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const [commissions, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: {
            receiver_user_id: userId,
            credited_at: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          orderBy: { credited_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({
          where: {
            receiver_user_id: userId,
            credited_at: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        }),
      ]);

      const items = commissions.map(c => ({
        id: c.id.toString(),
        commission_type: c.commission_type,
        amount: Number(c.amount),
        credited_at: c.credited_at,
        settled: c.settled,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting commissions by date:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/by-level:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get commissions filtered by level
   *     description: |
   *       Retrieve commissions filtered by level (1-9). Level information is stored in metadata.
   *       The level parameter is required and must be between 1 and 9.
   *     operationId: getCommissionsByLevel
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: level
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 9
   *         description: Commission level (1-9)
   *         example: 1
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
   *         description: Commissions filtered by level retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       level:
   *                         type: number
   *                         nullable: true
   *                         example: 1
   *                         description: Commission level (1-9)
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '400':
   *         description: Bad request - missing or invalid level parameter
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "level parameter is required and must be between 1 and 9"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/by-level', {
    preHandler: requireUser,
    schema: {
      description: 'Get commissions filtered by level',
      tags: ['Commissions'],
      summary: 'Get Commissions By Level',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        required: ['level'],
        properties: {
          level: { type: 'number', minimum: 1, maximum: 9 },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const level = parseInt((req.query as any).level, 10);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;

      if (!level || level < 1 || level > 9) {
        return reply.code(400).send({ error: 'level parameter is required and must be between 1 and 9' });
      }

      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get all commissions and filter by level in metadata
      const allCommissions = await prisma.ledger_entries.findMany({
        where: { receiver_user_id: userId },
        orderBy: { credited_at: 'desc' },
      });

      // Filter by level from metadata
      const filteredCommissions = allCommissions.filter(c => {
        const metadata = c.metadata as any;
        return metadata?.level === level;
      });

      const total = filteredCommissions.length;
      const paginatedCommissions = filteredCommissions.slice(offset, offset + limit);

      // Get source user names
      const sourceUserIds = [...new Set(paginatedCommissions.map(c => c.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = paginatedCommissions.map(c => ({
        id: c.id.toString(),
        commission_type: c.commission_type,
        amount: Number(c.amount),
        source_user_id: c.source_user_id.toString(),
        source_user_name: userMap.get(c.source_user_id.toString()) ?? null,
        level: (c.metadata as any)?.level ?? null,
        credited_at: c.credited_at,
        settled: c.settled,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting commissions by level:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================
  // WALLET & TRANSACTIONS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /api/v1/users/{id}/wallet/transactions:
   *   get:
   *     tags:
   *       - Wallet
   *     summary: Get wallet transaction history
   *     description: |
   *       Retrieve complete wallet transaction history for a user with pagination.
   *       Returns all wallet transactions (credits) linked to ledger entries.
   *     operationId: getWalletTransactions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter from this date
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter until this date
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [created_at, amount]
   *           default: created_at
   *         description: Sort field
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *     responses:
   *       '200':
   *         description: Wallet transactions retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       ledger_entry_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *                       commission_type:
   *                         type: string
   *                         nullable: true
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/wallet/transactions', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet transaction history with pagination and filters',
      tags: ['Wallet'],
      summary: 'Get Wallet Transactions',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          sort: { type: 'string', enum: ['created_at', 'amount'], default: 'created_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          // Optional flag: when true, return only ADMIN_OPS wallet entries
          admin_ops_only: { type: 'boolean', default: false },
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
                  amount: { type: 'number' },
                  ledger_entry_id: { type: ['string', 'null'] },
                  commission_type: { type: ['string', 'null'] },
                  is_admin_ops: { type: 'boolean' },
                  reason: { type: ['string', 'null'] },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const sort = (req.query as any).sort || 'created_at';
      const order = (req.query as any).order || 'desc';
      const adminOpsOnly =
        (req.query as any).admin_ops_only === true ||
        (req.query as any).admin_ops_only === 'true';

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { receiver_user_id: userId };
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) {
          where.created_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.created_at.lte = new Date(endDate);
        }
      }

      // If only admin operations are requested, restrict to ADMIN_OPS and FEE_DEDUCTION ledger entries
      let transactions;
      let total;
      if (adminOpsOnly) {
        // Find all ADMIN_OPS and FEE_DEDUCTION ledger entries for this user
        const adminLedgerEntries = await prisma.ledger_entries.findMany({
          where: {
            receiver_user_id: userId,
            commission_type: { in: ['ADMIN_OPS', 'FEE_DEDUCTION'] },
          },
          select: { id: true },
        });

        const adminLedgerIds = adminLedgerEntries.map((le) => le.id);

        if (adminLedgerIds.length === 0) {
          transactions = [];
          total = 0;
        } else {
          const adminWhere: any = {
            ...where,
            ledger_entry_id: { in: adminLedgerIds },
          };

          [transactions, total] = await Promise.all([
            prisma.wallet_transactions.findMany({
              where: adminWhere,
              orderBy: { [sort]: order },
              skip: offset,
              take: limit,
            }),
            prisma.wallet_transactions.count({ where: adminWhere }),
          ]);
        }
      } else {
        [transactions, total] = await Promise.all([
          prisma.wallet_transactions.findMany({
            where,
            orderBy: { [sort]: order },
            skip: offset,
            take: limit,
          }),
          prisma.wallet_transactions.count({ where }),
        ]);
      }

      // Get ledger entry details for commission_type + admin_ops flag
      const ledgerEntryIds = transactions
        .filter(t => t.ledger_entry_id)
        .map(t => t.ledger_entry_id!.toString());
      
      let ledgerMap = new Map<
        string,
        { commission_type: string | null; is_admin_ops: boolean; reason: string | null; withdrawal_fee?: number }
      >();
      if (ledgerEntryIds.length > 0) {
        const ledgerEntries = await prisma.ledger_entries.findMany({
          where: { id: { in: ledgerEntryIds.map(id => BigInt(id)) } },
          select: { id: true, commission_type: true, amount: true, metadata: true },
        });
        ledgerMap = new Map(
          ledgerEntries.map(le => {
            const metadata = le.metadata as any;
            let reason = metadata?.reason ?? null;
            let withdrawalFee: number | undefined = undefined;
            
            // For withdrawals, show simple reason and extract fee
            if (le.commission_type === 'FEE_DEDUCTION' && metadata?.reason === 'WITHDRAWAL') {
              reason = 'WITHDRAWAL_PROCESSING Fee';
              // Extract withdrawal fee from metadata (if available)
              withdrawalFee = metadata?.withdrawal_fee ? Number(metadata.withdrawal_fee) : undefined;
            }
            // For FEE_DEDUCTION entries, extract reason from rule_code in metadata
            else if (le.commission_type === 'FEE_DEDUCTION' && !reason && metadata?.rule_code) {
              // Map rule_code to user-friendly reason
              const ruleCodeToReason: Record<string, string> = {
                'NAME_CHANGE': 'Name Change Fee',
                'TRANSACTION_PIN': 'Transaction Pin Reset Fee',
                'BOND_DOWNLOAD': 'Bond Agreement Download Fee',
                'ACCOUNT_CHANGE': 'Account Details Change Fee',
                'KYC_APPLY': 'KYC Submission Fee',
                'FUND_WITHDRAW': 'Withdrawal Fee',
                'ID_TRANSFER': 'ID Transfer Fee',
                'OTP_SEND': 'OTP Send Fee',
                'REPORT_DOWNLOAD': 'Report Download Fee',
                'WITHDRAWAL_PROCESSING': 'WITHDRAWAL_PROCESSING Fee',
              };
              reason = ruleCodeToReason[metadata.rule_code] || `${metadata.rule_code} Fee`;
            }
            
            // Determine if this is an admin operation
            // Withdrawal entries (reason='WITHDRAWAL') are NOT admin_ops - they are regular withdrawals
            // Withdrawal fees (rule_code='WITHDRAWAL_PROCESSING' but not reason='WITHDRAWAL') ARE admin_ops
            // Other FEE_DEDUCTION entries (KYC, name change, etc.) ARE admin_ops
            let isAdminOps = false;
            if (metadata?.admin_ops) {
              isAdminOps = true;
            } else if (le.commission_type === 'FEE_DEDUCTION') {
              // Withdrawal entries are NOT admin_ops
              if (metadata?.reason === 'WITHDRAWAL') {
                isAdminOps = false; // Main withdrawal amount - not admin op
              } else {
                // Other fee deductions (KYC, name change, etc.) ARE admin_ops
                isAdminOps = true;
              }
            }
            
            return [
              le.id.toString(),
              {
                commission_type: le.commission_type,
                is_admin_ops: isAdminOps,
                reason: reason,
                withdrawal_fee: withdrawalFee,
              },
            ];
          }),
        );
      }

      const items = transactions.map(transaction => {
        const ledgerInfo = transaction.ledger_entry_id
          ? ledgerMap.get(transaction.ledger_entry_id.toString())
          : undefined;

        // For withdrawal entries, show only the processing fee amount, not the full withdrawal amount
        let displayAmount = Number(transaction.amount);
        if (ledgerInfo?.withdrawal_fee !== undefined && ledgerInfo?.withdrawal_fee > 0) {
          // Show only the processing fee as negative amount
          displayAmount = -ledgerInfo.withdrawal_fee;
        }

        return {
          id: transaction.id.toString(),
          amount: displayAmount,
          ledger_entry_id: transaction.ledger_entry_id ? transaction.ledger_entry_id.toString() : null,
          commission_type: ledgerInfo?.commission_type ?? null,
          is_admin_ops: ledgerInfo?.is_admin_ops ?? false,
          reason: ledgerInfo?.reason ?? null,
          created_at: transaction.created_at,
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
      console.error('Error getting wallet transactions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/ledger:
   *   get:
   *     tags:
   *       - Wallet
   *     summary: Get complete ledger entries
   *     description: |
   *       Retrieve all ledger entries (immutable audit log) for a user with pagination and filters.
   *       Ledger entries track all commission credits, including settled and unsettled ones.
   *     operationId: getLedgerEntries
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *         description: Filter by commission type
   *       - in: query
   *         name: settled
   *         schema:
   *           type: boolean
   *         description: Filter by settled status
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter from this date
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter until this date
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [credited_at, amount]
   *           default: credited_at
   *         description: Sort field
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *     responses:
   *       '200':
   *         description: Ledger entries retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *                       level:
   *                         type: number
   *                         nullable: true
   *                         example: 1
   *                       credited_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       settled:
   *                         type: boolean
   *                         example: false
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/ledger', {
    preHandler: requireUser,
    schema: {
      description: 'Get complete ledger entries with pagination and filters',
      tags: ['Wallet'],
      summary: 'Get Ledger Entries',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'SPOT', 'MONTHLY'] },
          settled: { type: 'boolean' },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          sort: { type: 'string', enum: ['credited_at', 'amount'], default: 'credited_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
                  commission_type: { type: 'string' },
                  amount: { type: 'number' },
                  source_user_id: { type: 'string' },
                  source_user_name: { type: ['string', 'null'] },
                  purchase_id: { type: ['string', 'null'] },
                  level: { type: ['number', 'null'] },
                  credited_at: { type: 'string', format: 'date-time' },
                  settled: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const commissionType = (req.query as any).commission_type;
      const settled = (req.query as any).settled;
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      const sort = (req.query as any).sort || 'credited_at';
      const order = (req.query as any).order || 'desc';

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { receiver_user_id: userId };
      if (commissionType) {
        where.commission_type = commissionType;
      }
      if (settled !== undefined) {
        where.settled = settled === 'true' || settled === true;
      }
      if (startDate || endDate) {
        where.credited_at = {};
        if (startDate) {
          where.credited_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.credited_at.lte = new Date(endDate);
        }
      }

      const [ledgerEntries, total] = await Promise.all([
        prisma.ledger_entries.findMany({
          where,
          orderBy: { [sort]: order },
          skip: offset,
          take: limit,
        }),
        prisma.ledger_entries.count({ where }),
      ]);

      // Get source user names
      const sourceUserIds = [...new Set(ledgerEntries.map(le => le.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = ledgerEntries.map(entry => {
        const metadata = entry.metadata as any;
        return {
          id: entry.id.toString(),
          commission_type: entry.commission_type,
          amount: Number(entry.amount),
          source_user_id: entry.source_user_id.toString(),
          source_user_name: userMap.get(entry.source_user_id.toString()) ?? null,
          purchase_id: entry.purchase_id ? entry.purchase_id.toString() : null,
          level: metadata?.level ?? null,
          credited_at: entry.credited_at,
          settled: entry.settled,
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
      console.error('Error getting ledger entries:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/wallet/statement:
   *   get:
   *     tags:
   *       - Wallet
   *     summary: Get wallet statement (summary)
   *     description: |
   *       Retrieve a comprehensive wallet statement including current balance, total credits,
   *       transaction counts, and summary statistics.
   *     operationId: getWalletStatement
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Wallet statement retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "2"
   *                 current_balance:
   *                   type: number
   *                   example: 50000.00
   *                 total_credits:
   *                   type: number
   *                   example: 55000.00
   *                 total_transactions:
   *                   type: number
   *                   example: 150
   *                 first_transaction_date:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-01-01T00:00:00.000Z"
   *                 last_transaction_date:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-11-08T10:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/wallet/statement', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet statement (summary)',
      tags: ['Wallet'],
      summary: 'Get Wallet Statement',
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
            user_id: { type: 'string' },
            current_balance: { type: 'number' },
            total_credits: { type: 'number' },
            total_transactions: { type: 'number' },
            first_transaction_date: { type: ['string', 'null'], format: 'date-time' },
            last_transaction_date: { type: ['string', 'null'], format: 'date-time' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get wallet balance
      const balance = await prisma.user_balances.findUnique({ where: { user_id: userId } });

      // Get wallet transaction statistics
      const [transactionStats, firstTransaction, lastTransaction] = await Promise.all([
        prisma.wallet_transactions.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.wallet_transactions.findFirst({
          where: { receiver_user_id: userId },
          orderBy: { created_at: 'asc' },
          select: { created_at: true },
        }),
        prisma.wallet_transactions.findFirst({
          where: { receiver_user_id: userId },
          orderBy: { created_at: 'desc' },
          select: { created_at: true },
        }),
      ]);

      return reply.send({
        user_id: userId.toString(),
        current_balance: Number(balance?.balance || 0),
        total_credits: Number(transactionStats._sum.amount || 0),
        total_transactions: transactionStats._count.id,
        first_transaction_date: firstTransaction?.created_at ?? null,
        last_transaction_date: lastTransaction?.created_at ?? null,
      });
    } catch (error) {
      console.error('Error getting wallet statement:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/:id/wallet', { preHandler: requireUser }, async (req, reply) => {
    const id = BigInt((req.params as any).id);
    const balance = await prisma.user_balances.findUnique({ 
      where: { user_id: id },
      select: { balance: true, spot_balance: true, other_balance: true }
    });
    return reply.send({ 
      user_id: id.toString(), 
      balance: balance?.balance ?? 0,
      spot_balance: balance?.spot_balance ?? 0,
      other_balance: balance?.other_balance ?? 0
    });
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/pending:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get pending commissions
   *     description: |
   *       Retrieve all pending commissions for a user with pagination.
   *       Pending commissions are commissions that are waiting for eligibility requirements to be met.
   *     operationId: getPendingCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         name: level
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 9
   *         description: Filter by level
   *       - in: query
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *         description: Filter by commission type
   *     responses:
   *       '200':
   *         description: Pending commissions retrieved successfully
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
   *                         type: string
   *                         example: "1"
   *                       level:
   *                         type: number
   *                         example: 2
   *                       commission_type:
   *                         type: string
   *                         nullable: true
   *                         enum: [SELF, GLOBAL_HELPING, SPOT, MONTHLY]
   *                         example: "SPOT"
   *                       amount:
   *                         type: number
   *                         example: 125.00
   *                       source_user_id:
   *                         type: string
   *                         example: "5"
   *                       source_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Source User"
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/pending', {
    preHandler: requireUser,
    schema: {
      description: 'Get pending commissions with pagination and filters',
      tags: ['Commissions'],
      summary: 'Get Pending Commissions',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          level: { type: 'number', minimum: 1, maximum: 9 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'SPOT', 'MONTHLY'] },
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
                  level: { type: 'number' },
                  commission_type: { type: ['string', 'null'] },
                  amount: { type: 'number' },
                  source_user_id: { type: 'string' },
                  source_user_name: { type: ['string', 'null'] },
                  purchase_id: { type: ['string', 'null'] },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const level = (req.query as any).level;
      const commissionType = (req.query as any).commission_type;

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { receiver_user_id: userId };
      if (level) {
        where.level = parseInt(level, 10);
      }
      if (commissionType) {
        where.commission_type = commissionType;
      }

      const [pending, total] = await Promise.all([
        prisma.pending_commissions.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.pending_commissions.count({ where }),
      ]);

      // Get source user names
      const sourceUserIds = [...new Set(pending.map(p => p.source_user_id.toString()))];
      const sourceUsers = await prisma.users.findMany({
        where: { id: { in: sourceUserIds.map(id => BigInt(id)) } },
        select: { id: true, name: true },
      });
      const userMap = new Map(sourceUsers.map(u => [u.id.toString(), u.name]));

      const items = pending.map(p => ({
        id: p.id.toString(),
        level: p.level,
        commission_type: p.commission_type,
        amount: Number(p.amount),
        source_user_id: p.source_user_id.toString(),
        source_user_name: userMap.get(p.source_user_id.toString()) ?? null,
        purchase_id: p.purchase_id ? p.purchase_id.toString() : null,
        created_at: p.created_at,
      }));

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting pending commissions:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Keep old endpoint for backward compatibility
  app.get('/:id/pending', { preHandler: requireUser }, async (req, reply) => {
    const id = BigInt((req.params as any).id);
    const pending = await prisma.pending_commissions.findMany({ where: { receiver_user_id: id } });
    return reply.send({ count: pending.length, items: pending });
  });

  /**
   * @openapi
   * /api/v1/users/{id}/commissions/scheduled:
   *   get:
   *     tags:
   *       - Commissions
   *     summary: Get scheduled commissions
   *     description: |
   *       Retrieve all scheduled commissions for a user with pagination.
   *       Scheduled commissions are recurring commissions (daily/monthly) that are processed over time.
   *     operationId: getScheduledCommissions
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
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
   *         name: commission_type
   *         schema:
   *           type: string
   *           enum: [SELF, GLOBAL_HELPING, MONTHLY]
   *         description: Filter by commission type
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
   *                         type: string
   *                         example: "1"
   *                       commission_type:
   *                         type: string
   *                         enum: [SELF, GLOBAL_HELPING, MONTHLY]
   *                         example: "MONTHLY"
   *                       monthly_amount:
   *                         type: number
   *                         example: 1000.00
   *                       daily_amount:
   *                         type: number
   *                         example: 33.33
   *                       total_credited:
   *                         type: number
   *                         example: 5000.00
   *                       days_processed:
   *                         type: number
   *                         example: 15
   *                       start_date:
   *                         type: string
   *                         format: date
   *                         example: "2025-01-01"
   *                       end_date:
   *                         type: string
   *                         format: date
   *                         example: "2025-12-31"
   *                       source_user_id:
   *                         type: string
   *                         nullable: true
   *                         example: "5"
   *                       purchase_id:
   *                         type: string
   *                         nullable: true
   *                         example: "10"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/commissions/scheduled', {
    preHandler: requireUser,
    schema: {
      description: 'Get scheduled commissions with pagination and filters',
      tags: ['Commissions'],
      summary: 'Get Scheduled Commissions',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          commission_type: { type: 'string', enum: ['SELF', 'GLOBAL_HELPING', 'MONTHLY'] },
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
                  commission_type: { type: 'string' },
                  monthly_amount: { type: 'number' },
                  daily_amount: { type: 'number' },
                  total_credited: { type: 'number' },
                  days_processed: { type: 'number' },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  source_user_id: { type: ['string', 'null'] },
                  purchase_id: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const page = Math.max(1, parseInt((req.query as any).page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query as any).limit || '20', 10)));
      const offset = (page - 1) * limit;
      const commissionType = (req.query as any).commission_type;

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const where: any = { receiver_user_id: userId };
      if (commissionType) {
        where.commission_type = commissionType;
      }

      // NOTE: scheduled_commissions table removed (Dec 20, 2025)
      // All commissions are now processed dynamically
      // Return empty results for backward compatibility
      const scheduled: any[] = [];
      const total = 0;

      const items = scheduled.map(s => ({
        id: s.id.toString(),
        commission_type: s.commission_type,
        monthly_amount: Number(s.monthly_amount),
        daily_amount: Number(s.daily_amount),
        total_credited: Number(s.total_credited),
        days_processed: s.days_processed,
        start_date: s.start_date,
        end_date: s.end_date,
        source_user_id: s.source_user_id ? s.source_user_id.toString() : null,
        purchase_id: s.purchase_id ? s.purchase_id.toString() : null,
      }));

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
   * /api/v1/users/{id}/business-volume:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get business volume per leg
   *     description: |
   *       Retrieve business volume breakdown per leg (direct referral) for a user.
   *       Business volume includes user's own purchases plus team purchases for each leg.
   *     operationId: getBusinessVolume
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Business volume retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "2"
   *                 total_business_volume:
   *                   type: number
   *                   example: 50000.00
   *                   description: Total business volume (own + all legs)
   *                 direct_business:
   *                   type: number
   *                   example: 10000.00
   *                   description: User's own purchases
   *                 team_business:
   *                   type: number
   *                   example: 40000.00
   *                   description: Total team purchases
   *                 legs:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       leg_user_id:
   *                         type: string
   *                         example: "5"
   *                       leg_user_name:
   *                         type: string
   *                         nullable: true
   *                         example: "Leg User"
   *                       leg_business_volume:
   *                         type: number
   *                         example: 20000.00
   *                         description: Business volume from this leg (including leg's team)
   *                       direct_business:
   *                         type: number
   *                         example: 5000.00
   *                         description: Leg user's own purchases
   *                       team_business:
   *                         type: number
   *                         example: 15000.00
   *                         description: Leg's team purchases
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/business-volume', {
    preHandler: requireUser,
    schema: {
      description: 'Get business volume per leg',
      tags: ['Users'],
      summary: 'Get Business Volume',
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
            user_id: { type: 'string' },
            total_business_volume: { type: 'number' },
            direct_business: { type: 'number' },
            team_business: { type: 'number' },
            legs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  leg_user_id: { type: 'string' },
                  leg_user_name: { type: ['string', 'null'] },
                  leg_business_volume: { type: 'number' },
                  direct_business: { type: 'number' },
                  team_business: { type: 'number' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get direct business (user's own purchases)
      const directBusiness = await prisma.purchases.aggregate({
        where: {
          user_id: userId,
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Get direct referrals (legs)
      const directLegs = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: 1,
        },
      });

      // Calculate business volume per leg
      const legVolumes = await Promise.all(
        directLegs.map(async (leg) => {
          const legId = leg.descendant_id as unknown as bigint;

          // Get leg's team (all descendants of this leg)
          const legTeam = await prisma.user_tree_paths.findMany({
            where: { ancestor_id: legId },
          });
          const legTeamIds = [
            legId.toString(),
            ...legTeam.map((t) => t.descendant_id.toString()),
          ];

          // Calculate leg's direct business
          const legDirectBusiness = await prisma.purchases.aggregate({
            where: {
              user_id: legId,
              status: 'completed',
            },
            _sum: { amount: true },
          });

          // Calculate leg's team business
          let legTeamBusiness = 0;
          if (legTeamIds.length > 1) {
            const legTeamTotal = await prisma.purchases.aggregate({
              where: {
                user_id: { in: legTeamIds.slice(1).map((x) => BigInt(x)) },
                status: 'completed',
              },
              _sum: { amount: true },
            });
            legTeamBusiness = Number(legTeamTotal._sum.amount || 0);
          }

          const legDirect = Number(legDirectBusiness._sum.amount || 0);
          const legTotal = legDirect + legTeamBusiness;

          return {
            leg_user_id: legId.toString(),
            leg_business_volume: legTotal,
            direct_business: legDirect,
            team_business: legTeamBusiness,
          };
        })
      );

      // Get leg user names
      const legUserIds = legVolumes.map((l) => BigInt(l.leg_user_id));
      const legUsers = await prisma.users.findMany({
        where: { id: { in: legUserIds } },
        select: { id: true, name: true },
      });
      const legUserMap = new Map(legUsers.map((u) => [u.id.toString(), u.name]));

      const legs = legVolumes.map((leg) => ({
        ...leg,
        leg_user_name: legUserMap.get(leg.leg_user_id) ?? null,
      }));

      // Calculate total team business (sum of all leg volumes)
      const teamBusiness = legs.reduce((sum, leg) => sum + leg.leg_business_volume, 0);
      const direct = Number(directBusiness._sum.amount || 0);
      const total = direct + teamBusiness;

      return reply.send({
        user_id: userId.toString(),
        total_business_volume: total,
        direct_business: direct,
        team_business: teamBusiness,
        legs,
      });
    } catch (error) {
      console.error('Error getting business volume:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/eligibility/details:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get detailed eligibility information
   *     description: |
   *       Retrieve detailed eligibility information including business volume per leg,
   *       level requirements, and eligibility status for each level.
   *     operationId: getEligibilityDetails
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Eligibility details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "2"
   *                 eligibility_status:
   *                   type: object
   *                   additionalProperties:
   *                     type: boolean
   *                   example:
   *                     "1": true
   *                     "2": false
   *                     "3": false
   *                 leg_volumes:
   *                   type: object
   *                   additionalProperties:
   *                     type: number
   *                   example:
   *                     "5": 20000.00
   *                     "6": 15000.00
   *                 level_requirements:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 2
   *                       required_leg_count:
   *                         type: number
   *                         nullable: true
   *                         example: 2
   *                       required_leg_min_amount:
   *                         type: number
   *                         nullable: true
   *                         example: 10000.00
   *                       is_eligible:
   *                         type: boolean
   *                         example: true
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/eligibility/details', {
    preHandler: requireUser,
    schema: {
      description: 'Get detailed eligibility information',
      tags: ['Users'],
      summary: 'Get Eligibility Details',
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
            user_id: { type: 'string' },
            eligibility_status: {
              type: 'object',
              additionalProperties: { type: 'boolean' },
            },
            leg_volumes: {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
            level_requirements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  required_leg_count: { type: ['number', 'null'] },
                  required_leg_min_amount: { type: ['number', 'null'] },
                  is_eligible: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get eligibility status
      const eligibility = await prisma.level_eligibility.findUnique({
        where: { user_id: userId },
      });

      // Get direct referrals (legs)
      const directLegs = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: 1,
        },
      });

      // Calculate business volume per leg
      const legVolumes: Record<string, number> = {};
      for (const leg of directLegs) {
        const legId = leg.descendant_id as unknown as bigint;
        const legTeam = await prisma.user_tree_paths.findMany({
          where: { ancestor_id: legId },
        });
        const memberIds = [
          legId.toString(),
          ...legTeam.map((t) => t.descendant_id.toString()),
        ];

        const sum = await prisma.purchases.aggregate({
          _sum: { amount: true },
          where: {
            user_id: { in: memberIds.map((x) => BigInt(x)) },
            status: 'completed',
          },
        });
        legVolumes[legId.toString()] = Number(sum._sum.amount ?? 0);
      }

      // Get level requirements
      const levels = await prisma.levels.findMany({
        where: { level: { gte: 1, lte: 9 } },
        orderBy: { level: 'asc' },
      });

      const eligibilityStatus = (eligibility?.eligibility as Record<string, boolean>) || {};
      const levelRequirements = levels.map((levelData) => {
        const level = levelData.level;
        const businessReq = levelData.business_requirement as {
          required_leg_count?: number;
          required_leg_min_amount?: number;
        } | null;

        const requiredLegCount = businessReq?.required_leg_count ?? null;
        const requiredLegMinAmount = businessReq?.required_leg_min_amount ?? null;

        // Check if eligible
        const isEligible = eligibilityStatus[String(level)] ?? false;

        return {
          level,
          required_leg_count: requiredLegCount,
          required_leg_min_amount: requiredLegMinAmount
            ? Number(requiredLegMinAmount)
            : null,
          is_eligible: isEligible,
        };
      });

      return reply.send({
        user_id: userId.toString(),
        eligibility_status: eligibilityStatus,
        leg_volumes: legVolumes,
        level_requirements: levelRequirements,
      });
    } catch (error) {
      console.error('Error getting eligibility details:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/eligibility:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get user level eligibility with details
   *     description: |
   *       Retrieve user's eligibility status for all levels (0-9) with official titles,
   *       descriptions, rewards, and business requirements from the levels table.
   *     operationId: getUserEligibility
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Eligibility retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "1"
   *                 eligibility:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 2
   *                       title:
   *                         type: string
   *                         example: "Company City Manager"
   *                       description:
   *                         type: string
   *                         nullable: true
   *                         example: "Har 4 direct member ke niche se ₹3.75 Lakh ka business (total ₹15 Lakh)"
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                         example: "5G Mobile"
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 2.50
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                         example: 0.30
   *                       business_requirement:
   *                         type: object
   *                         nullable: true
   *                         properties:
   *                           required_leg_count:
   *                             type: number
   *                           required_leg_min_amount:
   *                             type: number
   *                           total_business:
   *                             type: number
   *                       eligible:
   *                         type: boolean
   *                         example: true
   *                       icon_url:
   *                         type: string
   *                         nullable: true
   *                       color:
   *                         type: string
   *                         nullable: true
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/:id/eligibility', {
    preHandler: requireUser,
    schema: {
      description: 'Get user level eligibility with details',
      tags: ['Users'],
      summary: 'Get User Eligibility',
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
            user_id: { type: 'string' },
            eligibility: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  reward: { type: 'string', nullable: true },
                  spot_commission_percent: { type: 'number', nullable: true },
                  monthly_royalty_percent: { type: 'number', nullable: true },
                  business_requirement: { type: 'object', nullable: true },
                  eligible: { type: 'boolean' },
                  icon_url: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
    const id = BigInt((req.params as any).id);
      
      // Fetch user eligibility and all levels
      const [elig, levels] = await Promise.all([
        prisma.level_eligibility.findUnique({ where: { user_id: id } }),
        prisma.levels.findMany({ orderBy: { level: 'asc' } })
      ]);
      
      const eligibility = elig?.eligibility ?? {};
      const levelsMap = new Map<number, any>(levels.map((l: any) => [l.level, l]));
      
      // Build response with level details (levels 0-9)
      // Level 0 is always eligible (direct referrer, no eligibility check needed)
      // Levels 1-9 require eligibility check
      const eligibilityWithDetails = [];
      
      for (let level = 0; level <= 9; level++) {
        const levelData = levelsMap.get(level);
        
        // Level 0 is always eligible (direct referrer, no eligibility check)
        // Levels 1-9 check eligibility from database
        const isEligible = level === 0 
          ? true  // Level 0 (direct referrer) is always eligible
          : Boolean(eligibility[String(level)]);
        
        eligibilityWithDetails.push({
          level,
          title: levelData?.title || `Level ${level}`,
          description: levelData?.description || null,
          reward: levelData?.reward || null,
          spot_commission_percent: levelData?.spot_commission_percent ? Number(levelData.spot_commission_percent) : null,
          monthly_royalty_percent: levelData?.monthly_royalty_percent ? Number(levelData.monthly_royalty_percent) : null,
          business_requirement: levelData?.business_requirement || null,
          eligible: isEligible,
          icon_url: levelData?.icon_url || null,
          color: levelData?.color || null,
        });
      }
      
      return reply.send({ 
        user_id: id.toString(), 
        eligibility: eligibilityWithDetails
      });
    } catch (error) {
      console.error('Error fetching eligibility:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get single user details
   *     description: |
   *       Retrieve detailed information about a specific user including KYC status,
   *       referrer information, and basic statistics.
   *     operationId: getUserDetails
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: User details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 name:
   *                   type: string
   *                   nullable: true
   *                   example: "Test User"
   *                 email:
   *                   type: string
   *                   nullable: true
   *                   example: "test@example.com"
   *                 kyc_status:
   *                   type: string
   *                   example: "approved"
   *                 kyc_verified_at:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-11-08T12:20:29.115Z"
   *                 referrer_user_id:
   *                   type: string
   *                   nullable: true
   *                   example: "5"
   *                 referrer_name:
   *                   type: string
   *                   nullable: true
   *                   example: "Referrer Name"
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-08T11:43:03.027Z"
   *                 stats:
   *                   type: object
   *                   properties:
   *                     direct_referrals:
   *                       type: number
   *                       example: 5
   *                     total_team_size:
   *                       type: number
   *                       example: 25
   *                     total_purchases:
   *                       type: number
   *                       example: 3
   *                     wallet_balance:
   *                       type: number
   *                       example: 5000
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/reports/dashboard', {
    preHandler: requireUser,
    schema: {
      description: 'Get user dashboard statistics',
      tags: ['Users'],
      summary: 'Get User Dashboard',
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
            user_id: { type: 'string' },
            wallet_balance: { type: 'number' },
            total_earnings: { type: 'number' },
            pending_commissions: { type: 'number' },
            total_commissions: { type: 'number' },
            commission_by_type: {
              type: 'object',
              properties: {
                SELF: { type: 'number' },
                GLOBAL_HELPING: { type: 'number' },
                SPOT: { type: 'number' },
                MONTHLY: { type: 'number' },
              },
            },
            team_stats: {
              type: 'object',
              properties: {
                direct_referrals: { type: 'number' },
                total_team_size: { type: 'number' },
                active_members: { type: 'number' },
                total_business_volume: { type: 'number' },
              },
            },
            purchase_stats: {
              type: 'object',
              properties: {
                total_purchases: { type: 'number' },
                total_spent: { type: 'number' },
                active_packages: { type: 'number' },
              },
            },
            recent_activity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  description: { type: 'string' },
                  amount: { type: ['number', 'null'] },
                  date: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get wallet balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
      });

      // Get commission statistics
      const [totalCommissions, commissionsByType, pendingCommissions] = await Promise.all([
        prisma.ledger_entries.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.ledger_entries.groupBy({
          by: ['commission_type'],
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
        prisma.pending_commissions.aggregate({
          where: { receiver_user_id: userId },
          _sum: { amount: true },
        }),
      ]);

      const commissionByTypeMap: Record<string, number> = {
        SELF: 0,
        GLOBAL_HELPING: 0,
        SPOT: 0,
        MONTHLY: 0,
      };
      commissionsByType.forEach((item) => {
        commissionByTypeMap[item.commission_type] = Number(item._sum.amount || 0);
      });

      // Get team statistics
      const [directReferrals, totalTeamSize, downlinePaths] = await Promise.all([
        prisma.user_tree_paths.count({
          where: { ancestor_id: userId, depth: 1 },
        }),
        prisma.user_tree_paths.count({
          where: { ancestor_id: userId, depth: { gt: 0 } },
        }),
        prisma.user_tree_paths.findMany({
          where: { ancestor_id: userId, depth: { gt: 0 } },
          select: { descendant_id: true },
        }),
      ]);

      const downlineIds = [...new Set(downlinePaths.map(p => p.descendant_id.toString()))];
      // Expiry is based on 2x income (self + global), NOT active_until date
      const allPurchases = await prisma.purchases.findMany({
        where: {
          user_id: { in: downlineIds.map(id => BigInt(id)) },
          status: 'completed',
        },
        select: { id: true, user_id: true },
      });
      
      // Check 2x for each purchase and count unique active members
      const activeMemberIds = new Set<string>();
      for (const purchase of allPurchases) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
        if (!isDoubleReached) {
          activeMemberIds.add(purchase.user_id.toString());
        }
      }
      const activeMembers = activeMemberIds.size;

      const teamBusinessVolume = await prisma.purchases.aggregate({
        where: {
          user_id: { in: downlineIds.map(id => BigInt(id)) },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Get purchase statistics
      const [totalPurchases, totalSpent, activePackages] = await Promise.all([
        prisma.purchases.count({
          where: { user_id: userId },
        }),
        prisma.purchases.aggregate({
          where: { user_id: userId, status: 'completed' },
          _sum: { amount: true },
        }),
        // Expiry is based on 2x income (self + global), NOT active_until date
        (async () => {
          const purchases = await prisma.purchases.findMany({
            where: { user_id: userId, status: 'completed' },
            select: { id: true },
          });
          let activeCount = 0;
          for (const p of purchases) {
            const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
            if (!isDoubleReached) activeCount++;
          }
          return activeCount;
        })(),
      ]);

      // Get recent activity (last 10 transactions and purchases)
      const [recentCommissions, recentPurchases] = await Promise.all([
        prisma.ledger_entries.findMany({
          where: { receiver_user_id: userId },
          orderBy: { credited_at: 'desc' },
          take: 5,
          select: { amount: true, commission_type: true, credited_at: true },
        }),
        prisma.purchases.findMany({
          where: { user_id: userId },
          orderBy: { purchased_at: 'desc' },
          take: 5,
          select: { amount: true, purchased_at: true },
        }),
      ]);

      const recentActivity = [
        ...recentCommissions.map(c => ({
          type: 'commission',
          description: `${c.commission_type} commission`,
          amount: Number(c.amount),
          date: c.credited_at,
        })),
        ...recentPurchases.map(p => ({
          type: 'purchase',
          description: 'Package purchase',
          amount: Number(p.amount),
          date: p.purchased_at,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      return reply.send({
        user_id: userId.toString(),
        wallet_balance: Number(balance?.balance || 0),
        total_earnings: Number(totalCommissions._sum.amount || 0),
        pending_commissions: Number(pendingCommissions._sum.amount || 0),
        total_commissions: totalCommissions._count.id,
        commission_by_type: commissionByTypeMap,
        team_stats: {
          direct_referrals: directReferrals,
          total_team_size: totalTeamSize,
          active_members: activeMembers,
          total_business_volume: Number(teamBusinessVolume._sum.amount || 0),
        },
        purchase_stats: {
          total_purchases: totalPurchases,
          total_spent: Number(totalSpent._sum.amount || 0),
          active_packages: activePackages,
        },
        recent_activity: recentActivity,
      });
    } catch (error) {
      console.error('Error getting user dashboard:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/:id/reports/team-performance', {
    preHandler: requireUser,
    schema: {
      description: 'Get team performance report',
      tags: ['Users'],
      summary: 'Get Team Performance',
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
            user_id: { type: 'string' },
            team_summary: {
              type: 'object',
              properties: {
                total_team_size: { type: 'number' },
                active_members: { type: 'number' },
                total_business_volume: { type: 'number' },
                direct_referrals: { type: 'number' },
              },
            },
            level_breakdown: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  count: { type: 'number' },
                  active_count: { type: 'number' },
                  business_volume: { type: 'number' },
                },
              },
            },
            top_performers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  user_name: { type: ['string', 'null'] },
                  business_volume: { type: 'number' },
                  direct_referrals: { type: 'number' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get downline paths
      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: userId,
          depth: { gt: 0, lte: 9 },
        },
      });

      const allMemberIds = [...new Set(downlinePaths.map(p => p.descendant_id.toString()))];
      // Expiry is based on 2x income (self + global), NOT active_until date
      const allPurchases = await prisma.purchases.findMany({
        where: {
          user_id: { in: allMemberIds.map(id => BigInt(id)) },
          status: 'completed',
        },
        select: { id: true, user_id: true },
      });
      const activeMemberIds = new Set<string>();
      for (const purchase of allPurchases) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
        if (!isDoubleReached) {
          activeMemberIds.add(purchase.user_id.toString());
        }
      }

      // Get direct referrals
      const directReferralIds = downlinePaths
        .filter(p => p.depth === 1)
        .map(p => p.descendant_id.toString());

      // Calculate business volume
      const businessVolume = await prisma.purchases.aggregate({
        where: {
          user_id: { in: allMemberIds.map(id => BigInt(id)) },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Level-wise breakdown
      const levelMap = new Map<number, bigint[]>();
      for (const path of downlinePaths) {
        const level = path.depth;
        const memberId = path.descendant_id as unknown as bigint;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(memberId);
      }

      const levelBreakdown: Record<string, any> = {};
      for (let level = 1; level <= 9; level++) {
        const memberIds = Array.from(new Set(levelMap.get(level) || []));
        if (memberIds.length === 0) continue;

        const levelActive = memberIds.filter(mid => activeMemberIds.has(mid.toString())).length;
        
        const levelVolume = await prisma.purchases.aggregate({
          where: {
            user_id: { in: memberIds },
            status: 'completed',
          },
          _sum: { amount: true },
        });

        levelBreakdown[String(level)] = {
          level,
          count: memberIds.length,
          active_count: levelActive,
          business_volume: levelVolume._sum.amount ? Number(levelVolume._sum.amount) : 0,
        };
      }

      // Get top performers (direct referrals with highest business volume)
      const topPerformerIds = directReferralIds.slice(0, 10).map(id => BigInt(id));
      const topPerformersData = await Promise.all(
        topPerformerIds.map(async (memberId) => {
          const [memberBusiness, memberReferrals] = await Promise.all([
            prisma.purchases.aggregate({
              where: { user_id: memberId, status: 'completed' },
              _sum: { amount: true },
            }),
            prisma.user_tree_paths.count({
              where: { ancestor_id: memberId, depth: 1 },
            }),
          ]);

          return {
            user_id: memberId.toString(),
            business_volume: Number(memberBusiness._sum.amount || 0),
            direct_referrals: memberReferrals,
          };
        })
      );

      // Get user names
      const performerUsers = await prisma.users.findMany({
        where: { id: { in: topPerformerIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(performerUsers.map(u => [u.id.toString(), u.name]));

      const topPerformers = topPerformersData
        .map(p => ({
          ...p,
          user_name: userMap.get(p.user_id) ?? null,
        }))
        .sort((a, b) => b.business_volume - a.business_volume)
        .slice(0, 10);

      return reply.send({
        user_id: userId.toString(),
        team_summary: {
          total_team_size: allMemberIds.length,
          active_members: activeMemberIds.size,
          total_business_volume: businessVolume._sum.amount ? Number(businessVolume._sum.amount) : 0,
          direct_referrals: directReferralIds.length,
        },
        level_breakdown: levelBreakdown,
        top_performers: topPerformers,
      });
    } catch (error) {
      console.error('Error getting team performance:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Get single user details with KYC status and basic info',
      tags: ['Users'],
      summary: 'Get User Details',
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
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            kyc_status: { type: 'string' },
            kyc_verified_at: { type: 'string', format: 'date-time', nullable: true },
            referrer_user_id: { type: 'string', nullable: true },
            referrer_name: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            stats: {
              type: 'object',
              properties: {
                direct_referrals: { type: 'number' },
                total_team_size: { type: 'number' },
                total_purchases: { type: 'number' },
                wallet_balance: { type: 'number' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      
      const user = await prisma.users.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          kyc_status: true,
          kyc_verified_at: true,
          referrer_user_id: true,
          created_at: true,
        },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get referrer name if exists
      let referrerName = null;
      if (user.referrer_user_id) {
        const referrer = await prisma.users.findUnique({
          where: { id: user.referrer_user_id },
          select: { name: true },
        });
        referrerName = referrer?.name ?? null;
      }

      // Get stats
      const [directReferrals, totalTeamSize, totalPurchases, wallet] = await Promise.all([
        prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: 1 } }),
        prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: { gt: 0, lte: 9 } } }),
        prisma.purchases.count({ where: { user_id: id } }),
        prisma.user_balances.findUnique({ where: { user_id: id }, select: { balance: true } }),
      ]);

      return reply.send({
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        kyc_status: user.kyc_status,
        kyc_verified_at: user.kyc_verified_at,
        referrer_user_id: user.referrer_user_id ? user.referrer_user_id.toString() : null,
        referrer_name: referrerName,
        created_at: user.created_at,
        stats: {
          direct_referrals: directReferrals,
          total_team_size: totalTeamSize,
          total_purchases: totalPurchases,
          wallet_balance: wallet ? Number(wallet.balance) : 0,
        },
      });
    } catch (error) {
      console.error('Error getting user details:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/referrals:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get user's direct referrals
   *     description: |
   *       Retrieve a list of all direct referrals (depth = 1) for a specific user.
   *       Direct referrals are users who were referred directly by this user.
   *     operationId: getUserReferrals
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Direct referrals retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 5
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "8"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Referred User"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "referred@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "pending"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T12:00:00.000Z"
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/referrals', {
    preHandler: requireUser,
    schema: {
      description: 'Get user direct referrals (depth=1)',
      tags: ['Users'],
      summary: 'Get Direct Referrals',
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
            count: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get direct referrals (depth = 1)
      const directReferrals = await prisma.user_tree_paths.findMany({
        where: { ancestor_id: id, depth: 1 },
        select: { descendant_id: true },
      });

      const referralIds = directReferrals.map(r => r.descendant_id as unknown as bigint);

      if (referralIds.length === 0) {
        return reply.send({ count: 0, items: [] });
      }

      const referrals = await prisma.users.findMany({
        where: { id: { in: referralIds } },
        select: {
          id: true,
          name: true,
          email: true,
          kyc_status: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      });

      return reply.send({
        count: referrals.length,
        items: referrals.map(u => ({
          id: u.id.toString(),
          name: u.name,
          email: u.email,
          kyc_status: u.kyc_status,
          created_at: u.created_at,
        })),
      });
    } catch (error) {
      console.error('Error getting referrals:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/downline:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get downline tree (9 levels)
   *     description: |
   *       Retrieve the complete downline tree for a user up to 9 levels deep.
   *       Returns level-wise breakdown of team members.
   *     operationId: getUserDownline
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: max_depth
   *         schema:
   *           type: integer
   *           default: 9
   *           minimum: 1
   *           maximum: 9
   *         description: Maximum depth to retrieve (1-9)
   *     responses:
   *       '200':
   *         description: Downline tree retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_team_size:
   *                   type: number
   *                   example: 25
   *                 levels:
   *                   type: object
   *                   additionalProperties:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 1
   *                       count:
   *                         type: number
   *                         example: 5
   *                       members:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             id:
   *                               type: string
   *                               example: "8"
   *                             name:
   *                               type: string
   *                               nullable: true
   *                             email:
   *                               type: string
   *                               nullable: true
   *                             kyc_status:
   *                               type: string
   *                             created_at:
   *                               type: string
   *                               format: date-time
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/downline', {
    preHandler: requireUser,
    schema: {
      description: 'Get downline tree (9 levels) with level-wise breakdown',
      tags: ['Users'],
      summary: 'Get Downline Tree',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          max_depth: { type: 'number', default: 9, minimum: 1, maximum: 9 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_team_size: { type: 'number' },
            levels: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  count: { type: 'number' },
                  members: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string', nullable: true },
                        email: { type: 'string', nullable: true },
                        kyc_status: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      const maxDepth = Math.min(9, Math.max(1, parseInt((req.query as any).max_depth || '9', 10)));
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get all downline members (depth 1 to maxDepth)
      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: id,
          depth: { gt: 0, lte: maxDepth },
        },
        orderBy: { depth: 'asc' },
      });

      if (downlinePaths.length === 0) {
        return reply.send({
          total_team_size: 0,
          levels: {},
        });
      }

      // Group by level
      const levelMap = new Map<number, bigint[]>();
      for (const path of downlinePaths) {
        const level = path.depth;
        const memberId = path.descendant_id as unknown as bigint;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(memberId);
      }

      // Get unique member IDs
      const allMemberIds = Array.from(new Set(downlinePaths.map(p => p.descendant_id as unknown as bigint)));
      
      // Fetch all members
      const members = await prisma.users.findMany({
        where: { id: { in: allMemberIds } },
        select: {
          id: true,
          name: true,
          email: true,
          kyc_status: true,
          created_at: true,
        },
      });

      const memberMap = new Map(members.map(m => [m.id.toString(), m]));

      // Build level-wise response
      const levels: Record<string, any> = {};
      for (let level = 1; level <= maxDepth; level++) {
        const memberIds = levelMap.get(level) || [];
        const uniqueMemberIds = Array.from(new Set(memberIds.map(id => id.toString())));
        
        levels[String(level)] = {
          level,
          count: uniqueMemberIds.length,
          members: uniqueMemberIds.map(mid => {
            const member = memberMap.get(mid);
            return member ? {
              id: member.id.toString(),
              name: member.name,
              email: member.email,
              kyc_status: member.kyc_status,
              created_at: member.created_at,
            } : null;
          }).filter(Boolean),
        };
      }

      return reply.send({
        total_team_size: allMemberIds.length,
        levels,
      });
    } catch (error) {
      console.error('Error getting downline:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/upline:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get upline chain
   *     description: |
   *       Retrieve the complete upline chain (referrer chain) for a user up to 9 levels.
   *       Returns all ancestors in the referral tree.
   *     operationId: getUserUpline
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: max_depth
   *         schema:
   *           type: integer
   *           default: 9
   *           minimum: 1
   *           maximum: 9
   *         description: Maximum depth to retrieve (1-9)
   *     responses:
   *       '200':
   *         description: Upline chain retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 3
   *                 chain:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 1
   *                       id:
   *                         type: string
   *                         example: "5"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Upline User"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                       kyc_status:
   *                         type: string
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/upline', {
    preHandler: requireUser,
    schema: {
      description: 'Get upline chain (up to 9 levels)',
      tags: ['Users'],
      summary: 'Get Upline Chain',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          max_depth: { type: 'number', default: 9, minimum: 1, maximum: 9 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            chain: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  id: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      const maxDepth = Math.min(9, Math.max(1, parseInt((req.query as any).max_depth || '9', 10)));
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get upline chain using existing utility
      const { getUplines } = await import('../utils/business.js');
      const uplines = await getUplines(id, maxDepth);

      if (uplines.length === 0) {
        return reply.send({ count: 0, chain: [] });
      }

      const uplineIds = uplines.map(u => u.ancestor_id);
      const uplineUsers = await prisma.users.findMany({
        where: { id: { in: uplineIds } },
        select: {
          id: true,
          name: true,
          email: true,
          kyc_status: true,
          created_at: true,
        },
      });

      const userMap = new Map(uplineUsers.map(u => [u.id.toString(), u]));

      const chain = uplines.map(upline => {
        const user = userMap.get(upline.ancestor_id.toString());
        return {
          level: upline.depth,
          id: upline.ancestor_id.toString(),
          name: user?.name ?? null,
          email: user?.email ?? null,
          kyc_status: user?.kyc_status ?? null,
          created_at: user?.created_at ?? null,
        };
      });

      return reply.send({
        count: chain.length,
        chain,
      });
    } catch (error) {
      console.error('Error getting upline:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/purchases:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get user's purchase history
   *     description: |
   *       Retrieve the complete purchase history for a user including package details,
   *       purchase dates, amounts, and active status.
   *     operationId: getUserPurchases
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [completed, active, expired]
   *         description: Filter by purchase status
   *     responses:
   *       '200':
   *         description: Purchase history retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 3
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "1"
   *                       package_id:
   *                         type: number
   *                         example: 1
   *                       package_name:
   *                         type: string
   *                         example: "Premium Package"
   *                       amount:
   *                         type: number
   *                         example: 10000
   *                       purchased_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       // active_until removed
   *                         type: string
   *                         format: date-time
   *                         example: "2026-11-08T10:00:00.000Z"
   *                       status:
   *                         type: string
   *                         example: "completed"
   *                       is_active:
   *                         type: boolean
   *                         example: true
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/purchases', {
    preHandler: requireUser,
    schema: {
      description: 'Get user purchase history with package details',
      tags: ['Users'],
      summary: 'Get Purchase History',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['completed', 'active', 'expired'] },
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
                  id: { type: 'string' },
                  package_id: { type: 'number' },
                  package_name: { type: 'string', nullable: true },
                  amount: { type: 'number' },
                  purchased_at: { type: 'string', format: 'date-time' },
                  // active_until removed - expiry is ONLY based on 2x income
                  status: { type: 'string' },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      const statusFilter = (req.query as any).status;
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Expiry is based on 2x income (self + global), NOT active_until date
      const where: any = { user_id: id };
      if (statusFilter) {
        where.status = statusFilter === 'active' || statusFilter === 'expired' ? 'completed' : statusFilter;
      }

      const purchases = await prisma.purchases.findMany({
        where,
        orderBy: { purchased_at: 'desc' },
        select: {
          id: true,
          package_id: true,
          amount: true,
          purchased_at: true,
          status: true,
          income: true, // Include income for 2x check
          // active_until removed - expiry is ONLY based on 2x income
        },
      });

      // Get package names
      const packageIds = Array.from(new Set(purchases.map(p => p.package_id)));
      const packages = await prisma.packages.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true },
      });
      const packageMap = new Map(packages.map(p => [p.id, p.name]));

      // Check 2x for each purchase (expiry is based on 2x, not active_until date)
      const items = await Promise.all(
        purchases.map(async (p) => {
          const isDoubleReached = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
          const isActive = p.status === 'completed' && !isDoubleReached;
          
          return {
            id: p.id.toString(),
            package_id: p.package_id,
            package_name: packageMap.get(p.package_id) ?? null,
            amount: Number(p.amount),
            purchased_at: p.purchased_at,
            // active_until removed - expiry is ONLY based on 2x income
            status: p.status,
            is_active: isActive,
          };
        })
      );

      // Filter by status if needed (after 2x check)
      let filteredItems = items;
      if (statusFilter === 'active') {
        filteredItems = items.filter(item => item.is_active);
      } else if (statusFilter === 'expired') {
        filteredItems = items.filter(item => !item.is_active && item.status === 'completed');
      }

      return reply.send({
        count: filteredItems.length,
        items: filteredItems,
      });
    } catch (error) {
      console.error('Error getting purchases:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/team-stats:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get team statistics
   *     description: |
   *       Retrieve comprehensive team statistics including team size, active members,
   *       business volume, and level-wise breakdown.
   *     operationId: getTeamStats
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Team statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_team_size:
   *                   type: number
   *                   example: 25
   *                 active_members:
   *                   type: number
   *                   example: 18
   *                 total_business_volume:
   *                   type: number
   *                   example: 250000
   *                 direct_referrals:
   *                   type: number
   *                   example: 5
   *                 level_breakdown:
   *                   type: object
   *                   additionalProperties:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                       count:
   *                         type: number
   *                       active_count:
   *                         type: number
   *                       business_volume:
   *                         type: number
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/team-stats', {
    preHandler: requireUser,
    schema: {
      description: 'Get team statistics (size, active members, volume)',
      tags: ['Users'],
      summary: 'Get Team Statistics',
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
            total_team_size: { type: 'number' },
            active_members: { type: 'number' },
            total_business_volume: { type: 'number' },
            direct_referrals: { type: 'number' },
            level_breakdown: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  count: { type: 'number' },
                  active_count: { type: 'number' },
                  business_volume: { type: 'number' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      
      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get all downline members (up to 9 levels)
      const downlinePaths = await prisma.user_tree_paths.findMany({
        where: {
          ancestor_id: id,
          depth: { gt: 0, lte: 9 },
        },
      });

      if (downlinePaths.length === 0) {
        return reply.send({
          total_team_size: 0,
          active_members: 0,
          total_business_volume: 0,
          direct_referrals: 0,
          level_breakdown: {},
        });
      }

      const allMemberIds = Array.from(new Set(downlinePaths.map(p => p.descendant_id as unknown as bigint)));
      const directReferralIds = Array.from(new Set(
        downlinePaths.filter(p => p.depth === 1).map(p => p.descendant_id as unknown as bigint)
      ));

      // Get active members (have active purchases) - expiry is based on 2x, not active_until date
      const now = new Date();
      const allPurchases = await prisma.purchases.findMany({
        where: {
          user_id: { in: allMemberIds },
          status: 'completed',
        },
        select: { id: true, user_id: true },
      });
      const activeMemberIds = new Set<string>();
      for (const purchase of allPurchases) {
        const isDoubleReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
        if (!isDoubleReached) {
          activeMemberIds.add(purchase.user_id.toString());
        }
      }

      // Get business volume (sum of all purchases)
      const businessVolume = await prisma.purchases.aggregate({
        where: {
          user_id: { in: allMemberIds },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      // Level-wise breakdown
      const levelMap = new Map<number, bigint[]>();
      for (const path of downlinePaths) {
        const level = path.depth;
        const memberId = path.descendant_id as unknown as bigint;
        if (!levelMap.has(level)) {
          levelMap.set(level, []);
        }
        levelMap.get(level)!.push(memberId);
      }

      const levelBreakdown: Record<string, any> = {};
      for (let level = 1; level <= 9; level++) {
        const memberIds = Array.from(new Set(levelMap.get(level) || []));
        if (memberIds.length === 0) continue;

        const levelActive = memberIds.filter(mid => activeMemberIds.has(mid.toString())).length;
        
        const levelVolume = await prisma.purchases.aggregate({
          where: {
            user_id: { in: memberIds },
            status: 'completed',
          },
          _sum: { amount: true },
        });

        levelBreakdown[String(level)] = {
          level,
          count: memberIds.length,
          active_count: levelActive,
          business_volume: levelVolume._sum.amount ? Number(levelVolume._sum.amount) : 0,
        };
      }

      return reply.send({
        total_team_size: allMemberIds.length,
        active_members: activeMemberIds.size,
        total_business_volume: businessVolume._sum.amount ? Number(businessVolume._sum.amount) : 0,
        direct_referrals: directReferralIds.length,
        level_breakdown: levelBreakdown,
      });
    } catch (error) {
      console.error('Error getting team stats:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}:
   *   put:
   *     tags:
   *       - Users
   *     summary: Update user profile
   *     description: |
   *       Update user profile information. Users can only update their own profile.
   *       Note: Referrer cannot be changed after registration.
   *     operationId: updateUserProfile
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 description: User full name
   *                 example: "Updated Name"
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User email address
   *                 example: "updated@example.com"
   *     responses:
   *       '200':
   *         description: User profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "7"
   *                 name:
   *                   type: string
   *                   example: "Updated Name"
   *                 email:
   *                   type: string
   *                   example: "updated@example.com"
   *                 message:
   *                   type: string
   *                   example: "Profile updated successfully"
   *       '403':
   *         description: Forbidden - User can only update their own profile
   *       '404':
   *         description: User not found
   *       '400':
   *         description: Validation error
   *       '401':
   *         description: Unauthorized
   */
  app.put('/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Update user profile (name, email)',
      tags: ['Users'],
      summary: 'Update User Profile',
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
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req.params as any).id);
      const authenticatedUser = (req as any).user;

      // Verify user can only update their own profile
      if (authenticatedUser.user_id !== id.toString()) {
        return reply.code(403).send({ error: 'Forbidden: You can only update your own profile' });
      }

      const body = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
      }).parse(req.body);

      // Users cannot set an email already used by another account (admin override only)
      if (body.email) {
        const existingUser = await prisma.users.findFirst({
          where: {
            email: body.email,
            NOT: { id },
          },
        });
        if (existingUser) {
          return reply.code(400).send({ error: 'Email already exists' });
        }
      }

      const updated = await prisma.users.update({
        where: { id },
        data: {
          name: body.name ?? undefined,
          email: body.email ?? undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return reply.send({
        id: updated.id.toString(),
        name: updated.name,
        email: updated.email,
        message: 'Profile updated successfully',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'User not found' });
      }
      console.error('Error updating user:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/levels:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get level-wise details and earnings
   *     description: |
   *       Retrieve detailed information about each level including earnings per level,
   *       commission breakdown, and level progression details.
   *     operationId: getUserLevels
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       '200':
   *         description: Level details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                 levels:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                       title:
   *                         type: string
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                       eligible:
   *                         type: boolean
   *                       earnings:
   *                         type: object
   *                         properties:
   *                           spot_commissions:
   *                             type: number
   *                           monthly_commissions:
   *                             type: number
   *                           total_earnings:
   *                             type: number
   *                           commission_count:
   *                             type: number
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/levels', {
    preHandler: requireUser,
    schema: {
      description: 'Get level-wise details and earnings',
      tags: ['Users'],
      summary: 'Get User Levels',
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
            user_id: { type: 'string' },
            levels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  reward: { type: ['string', 'null'] },
                  spot_commission_percent: { type: ['number', 'null'] },
                  monthly_royalty_percent: { type: ['number', 'null'] },
                  eligible: { type: 'boolean' },
                  earnings: {
                    type: 'object',
                    properties: {
                      spot_commissions: { type: 'number' },
                      monthly_commissions: { type: 'number' },
                      total_earnings: { type: 'number' },
                      commission_count: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get eligibility and levels
      const [elig, levels] = await Promise.all([
        prisma.level_eligibility.findUnique({ where: { user_id: userId } }),
        prisma.levels.findMany({ orderBy: { level: 'asc' } }),
      ]);

      const eligibility = elig?.eligibility ?? {};
      const levelsMap = new Map(levels.map(l => [l.level, l]));

      // Get commission earnings by level from metadata
      const allCommissions = await prisma.ledger_entries.findMany({
        where: {
          receiver_user_id: userId,
          commission_type: { in: ['SPOT', 'MONTHLY'] },
        },
        select: { amount: true, commission_type: true, metadata: true },
      });

      // Group earnings by level from metadata
      const levelEarnings: Record<number, { spot: number; monthly: number; count: number }> = {};
      for (let level = 0; level <= 9; level++) {
        levelEarnings[level] = { spot: 0, monthly: 0, count: 0 };
      }

      allCommissions.forEach((c: any) => {
        const metadata = c.metadata as any;
        const level = metadata?.level ? parseInt(metadata.level, 10) : null;
        if (level !== null && level >= 0 && level <= 9) {
          if (c.commission_type === 'SPOT') {
            levelEarnings[level].spot += Number(c.amount);
          } else if (c.commission_type === 'MONTHLY') {
            levelEarnings[level].monthly += Number(c.amount);
          }
          levelEarnings[level].count += 1;
        }
      });

      // Build response
      const levelsWithEarnings = [];
      for (let level = 0; level <= 9; level++) {
        const levelData = levelsMap.get(level);
        const earnings = levelEarnings[level];
        const isEligible = Boolean(eligibility[String(level)]);

        levelsWithEarnings.push({
          level,
          title: levelData?.title || `Level ${level}`,
          description: levelData?.description || null,
          reward: levelData?.reward || null,
          spot_commission_percent: levelData?.spot_commission_percent ? Number(levelData.spot_commission_percent) : null,
          monthly_royalty_percent: levelData?.monthly_royalty_percent ? Number(levelData.monthly_royalty_percent) : null,
          eligible: isEligible,
          earnings: {
            spot_commissions: earnings.spot,
            monthly_commissions: earnings.monthly,
            total_earnings: earnings.spot + earnings.monthly,
            commission_count: earnings.count,
          },
        });
      }

      return reply.send({
        user_id: userId.toString(),
        levels: levelsWithEarnings,
      });
    } catch (error) {
      console.error('Error getting user levels:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/wallet/balance-history:
   *   get:
   *     tags:
   *       - Wallet
   *     summary: Get wallet balance history over time
   *     description: |
   *       Retrieve wallet balance history for graphing/analytics.
   *       Returns balance snapshots over time based on wallet transactions.
   *     operationId: getWalletBalanceHistory
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *           minimum: 1
   *           maximum: 365
   *         description: Number of days to retrieve history
   *     responses:
   *       '200':
   *         description: Balance history retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                 current_balance:
   *                   type: number
   *                 history:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       date:
   *                         type: string
   *                         format: date
   *                       balance:
   *                         type: number
   *                       transactions_count:
   *                         type: number
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/:id/wallet/balance-history', {
    preHandler: requireUser,
    schema: {
      description: 'Get wallet balance history over time',
      tags: ['Wallet'],
      summary: 'Get Balance History',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', minimum: 1, maximum: 365, default: 30 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            current_balance: { type: 'number' },
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  balance: { type: 'number' },
                  transactions_count: { type: 'number' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const days = Math.min(365, Math.max(1, parseInt((req.query as any).days || '30', 10)));

      // Check if user exists
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get current balance
      const balance = await prisma.user_balances.findUnique({
        where: { user_id: userId },
      });

      // Get transactions within date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const transactions = await prisma.wallet_transactions.findMany({
        where: {
          receiver_user_id: userId,
          created_at: { gte: startDate },
        },
        orderBy: { created_at: 'asc' },
        select: { amount: true, created_at: true },
      });

      // Group by date and calculate running balance
      const dateMap = new Map<string, { transactions: number; total: number }>();
      let runningBalance = Number(balance?.balance || 0);

      // Start from current balance and work backwards
      for (let i = transactions.length - 1; i >= 0; i--) {
        const tx = transactions[i];
        const date = tx.created_at.toISOString().split('T')[0];
        if (!dateMap.has(date)) {
          dateMap.set(date, { transactions: 0, total: 0 });
        }
        const dayData = dateMap.get(date)!;
        dayData.transactions += 1;
        runningBalance -= Number(tx.amount); // Subtract to get balance at start of day
        dayData.total = runningBalance;
      }

      // Fill in missing dates with current balance
      const history = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayData = dateMap.get(dateStr);
        history.push({
          date: dateStr,
          balance: dayData ? dayData.total : (i === 0 ? Number(balance?.balance || 0) : null),
          transactions_count: dayData ? dayData.transactions : 0,
        });
      }

      return reply.send({
        user_id: userId.toString(),
        current_balance: Number(balance?.balance || 0),
        history: history.filter(h => h.balance !== null),
      });
    } catch (error) {
      console.error('Error getting balance history:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/transfer:
   *   post:
   *     tags:
   *       - Users
   *     summary: Transfer user ID (change referrer)
   *     description: |
   *       Transfer user's referrer to a new referrer user ID. This operation charges a fee from the user's wallet.
   *       Only the authenticated user can transfer their own referrer.
   *     operationId: transferUserId
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (must match authenticated user)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - new_referrer_user_id
   *             properties:
   *               new_referrer_user_id:
   *                 type: string
   *                 description: New referrer user ID
   *                 example: "5"
   *     responses:
   *       '200':
   *         description: User ID transferred successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "User ID transferred successfully"
   *                 user_id:
   *                   type: string
   *                   example: "10"
   *                 old_referrer_user_id:
   *                   type: string
   *                   nullable: true
   *                   example: "5"
   *                 new_referrer_user_id:
   *                   type: string
   *                   example: "7"
   *       '400':
   *         description: Validation error or insufficient balance
   *       '403':
   *         description: Forbidden - User can only transfer their own ID
   *       '404':
   *         description: User or new referrer not found
   *       '500':
   *         description: Internal server error
   */
  app.post('/:id/transfer', {
    preHandler: requireUser,
    schema: {
      description: 'Transfer user ID (change referrer)',
      tags: ['Users'],
      summary: 'Transfer User ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['new_referrer_user_id'],
        properties: {
          new_referrer_user_id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user_id: { type: 'string' },
            old_referrer_user_id: { type: 'string', nullable: true },
            new_referrer_user_id: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const authenticatedUser = (req as any).user;

      // Verify user can only transfer their own ID
      if (authenticatedUser.user_id !== userId.toString()) {
        return reply.code(403).send({ error: 'Forbidden: You can only transfer your own user ID' });
      }

      const body = z.object({
        new_referrer_user_id: z.coerce.bigint(),
      }).parse(req.body);

      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, referrer_user_id: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Check if new referrer exists
      const newReferrer = await prisma.users.findUnique({
        where: { id: body.new_referrer_user_id },
        select: { id: true },
      });

      if (!newReferrer) {
        return reply.code(404).send({ error: 'New referrer user not found' });
      }

      // Prevent self-referral
      if (body.new_referrer_user_id === userId) {
        return reply.code(400).send({ error: 'Cannot set yourself as referrer' });
      }

      // Check fee applicability for ID transfer
      const feeCheck = await FeeService.checkFeeApplicable(userId, 'ID_TRANSFER');
      if (!feeCheck.applicable && feeCheck.amount > 0) {
        return reply.code(400).send({
          error: 'INSUFFICIENT_BALANCE',
          message: feeCheck.message || 'Insufficient balance for ID transfer',
          required_amount: feeCheck.amount,
          available_balance: Number(
            (await prisma.user_balances.findUnique({ where: { user_id: userId } }))?.balance || 0
          ),
        });
      }

      // Deduct fee for ID transfer (if fee > 0)
      if (feeCheck.amount > 0) {
        try {
          await FeeService.deductFee(userId, 'ID_TRANSFER', body.new_referrer_user_id, 'id_transfer');
        } catch (error: any) {
          if (error.code === 'INSUFFICIENT_BALANCE') {
            return reply.code(400).send({
              error: 'INSUFFICIENT_BALANCE',
              message: error.message || 'Insufficient balance for ID transfer',
              required_amount: error.required,
              available_balance: error.available,
            });
          }
          throw error;
        }
      }

      // Update referrer in transaction
      const oldReferrerId = user.referrer_user_id;
      await prisma.$transaction(async (tx) => {
        // Update user's referrer
        await tx.users.update({
          where: { id: userId },
          data: { referrer_user_id: body.new_referrer_user_id },
        });

        // Rebuild closure table for this user and all descendants
        // 1. Delete all existing paths for this user (except self)
        await tx.user_tree_paths.deleteMany({
          where: {
            descendant_id: userId,
            NOT: { ancestor_id: userId },
          },
        });

        // 2. Add new referrer as depth 1
        await tx.user_tree_paths.create({
          data: {
            ancestor_id: body.new_referrer_user_id,
            descendant_id: userId,
            depth: 1,
          },
        });

        // 3. Add all ancestors of new referrer (with +1 depth)
        const newReferrerAncestors = await tx.user_tree_paths.findMany({
          where: {
            descendant_id: body.new_referrer_user_id,
            NOT: { ancestor_id: body.new_referrer_user_id },
          },
        });

        for (const ancestor of newReferrerAncestors) {
          await tx.user_tree_paths.create({
            data: {
              ancestor_id: ancestor.ancestor_id,
              descendant_id: userId,
              depth: ancestor.depth + 1,
            },
          });
        }

        // 4. Rebuild paths for all descendants of this user
        const descendants = await tx.user_tree_paths.findMany({
          where: {
            ancestor_id: userId,
            NOT: { descendant_id: userId },
          },
        });

        for (const desc of descendants) {
          // Delete old paths for this descendant
          await tx.user_tree_paths.deleteMany({
            where: {
              descendant_id: desc.descendant_id,
              NOT: { ancestor_id: desc.descendant_id },
            },
          });

          // Add self path
          await tx.user_tree_paths.create({
            data: {
              ancestor_id: desc.descendant_id,
              descendant_id: desc.descendant_id,
              depth: 0,
            },
          });

          // Add this user as depth 1
          await tx.user_tree_paths.create({
            data: {
              ancestor_id: userId,
              descendant_id: desc.descendant_id,
              depth: 1,
            },
          });

          // Add all ancestors of this user (with +1 depth)
          const userAncestors = await tx.user_tree_paths.findMany({
            where: {
              descendant_id: userId,
              NOT: { ancestor_id: userId },
            },
          });

          for (const anc of userAncestors) {
            await tx.user_tree_paths.create({
              data: {
                ancestor_id: anc.ancestor_id,
                descendant_id: desc.descendant_id,
                depth: anc.depth + 1,
              },
            });
          }
        }
      });

      return reply.send({
        success: true,
        message: 'User ID transferred successfully',
        user_id: userId.toString(),
        old_referrer_user_id: oldReferrerId ? oldReferrerId.toString() : null,
        new_referrer_user_id: body.new_referrer_user_id.toString(),
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'User not found' });
      }
      console.error('Error transferring user ID:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/bond/fee:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get bond download fee amount
   *     description: |
   *       Returns the fee amount for bond download without deducting it.
   *       Used to show fee to user before confirmation.
   *     operationId: getBondDownloadFee
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Fee amount retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 fee_amount:
   *                   type: number
   *                 rule_code:
   *                   type: string
   *                 rule_name:
   *                   type: string
   *       '400':
   *         description: Fee rule not found or inactive
   *       '401':
   *         description: Unauthorized
   */
  app.get('/bond/fee', {
    preHandler: requireUser,
    schema: {
      description: 'Get bond download fee amount',
      tags: ['Users'],
      summary: 'Get Bond Download Fee',
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);

      // Check if fee rule exists
      const ruleCheck = await FeeService.getFeeRule('BOND_DOWNLOAD', true);
      if (!ruleCheck) {
        return reply.code(400).send({
          error: 'FEE_RULE_NOT_FOUND',
          message: 'BOND_DOWNLOAD fee rule is not configured. Please contact administrator.',
        });
      }
      if (!ruleCheck.is_active) {
        return reply.code(400).send({
          error: 'FEE_RULE_INACTIVE',
          message: 'BOND_DOWNLOAD fee rule is currently inactive. Please contact administrator.',
        });
      }

      return reply.send({
        fee_amount: Number(ruleCheck.amount),
        rule_code: ruleCheck.rule_code,
        rule_name: ruleCheck.rule_name,
      });
    } catch (error: any) {
      console.error('Error getting bond download fee:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/bond/download:
   *   post:
   *     tags:
   *       - Users
   *     summary: Deduct fee and authorize bond download
   *     description: |
   *       Deducts fee from user wallet before allowing bond agreement download.
   *       Returns success if fee is deducted, or error if insufficient balance.
   *     operationId: authorizeBondDownload
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - bill_id
   *             properties:
   *               bill_id:
   *                 type: string
   *                 description: Bill/Purchase ID for the bond agreement
   *     responses:
   *       '200':
   *         description: Fee deducted successfully, bond download authorized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 fee_deducted:
   *                   type: number
   *                 transaction_id:
   *                   type: string
   *       '400':
   *         description: Insufficient balance or validation error
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.post('/bond/download', {
    preHandler: requireUser,
    schema: {
      description: 'Deduct fee and authorize bond download',
      tags: ['Users'],
      summary: 'Authorize Bond Download',
      body: {
        type: 'object',
        required: ['bill_id'],
        properties: {
          bill_id: { type: 'string' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        bill_id: z.string().min(1),
      }).parse(req.body);

      // First check if fee rule exists (including inactive ones)
      const ruleCheck = await FeeService.getFeeRule('BOND_DOWNLOAD', true);
      if (!ruleCheck) {
        return reply.code(400).send({
          error: 'FEE_RULE_NOT_FOUND',
          message: 'BOND_DOWNLOAD fee rule is not configured. Please contact administrator.',
        });
      }
      if (!ruleCheck.is_active) {
        return reply.code(400).send({
          error: 'FEE_RULE_INACTIVE',
          message: 'BOND_DOWNLOAD fee rule is currently inactive. Please contact administrator.',
        });
      }
      
      // Check fee applicability - Allow negative balance for bond download
      const feeCheck = await FeeService.checkFeeApplicable(userId, 'BOND_DOWNLOAD', true); // allowNegative = true
      
      // Only block if rule not found or inactive (not for insufficient balance)
      if (!feeCheck.applicable && feeCheck.message && feeCheck.message.includes('Fee rule not found')) {
        return reply.code(400).send({
          error: 'FEE_RULE_NOT_FOUND',
          message: feeCheck.message || 'BOND_DOWNLOAD fee rule is not configured. Please contact administrator.',
        });
      }
      
      // Ensure fee amount is greater than 0
      if (feeCheck.amount <= 0) {
        return reply.code(400).send({
          error: 'INVALID_FEE_AMOUNT',
          message: 'Fee amount must be greater than 0. Please contact administrator.',
        });
      }

      // --- New logic: fee is per user + per package, not per bill ---
      // Convert bill_id to BigInt so we can look up the purchase
      const billIdBigInt = BigInt(body.bill_id);

      // Find the current purchase to know which package this bill belongs to
      const currentPurchase = await prisma.purchases.findUnique({
        where: { id: billIdBigInt },
      });

      if (!currentPurchase || currentPurchase.user_id !== userId) {
        return reply.code(404).send({
          error: 'PURCHASE_NOT_FOUND',
          message: 'Purchase not found for this bill.',
        });
      }

      // Find all purchases for this user for the same package
      const samePackagePurchases = await prisma.purchases.findMany({
        where: {
          user_id: userId,
          package_id: currentPurchase.package_id,
        },
        select: { id: true },
      });

      const samePackagePurchaseIds = samePackagePurchases.map((p) => p.id);

      let existingFeeTransaction = null as Awaited<
        ReturnType<typeof prisma.fee_transactions.findFirst>
      >;

      if (samePackagePurchaseIds.length > 0) {
        // Check if fee has already been paid for ANY bill of this package for this user
        existingFeeTransaction = await prisma.fee_transactions.findFirst({
          where: {
            user_id: userId,
            rule_code: 'BOND_DOWNLOAD',
            reference_type: 'bond_download',
            reference_id: { in: samePackagePurchaseIds },
          },
        });
      }

      // If fee already paid for this package, return success without deducting again
      if (existingFeeTransaction) {
        return reply.send({
          success: true,
          message: 'Bond download authorized. Fee was already paid for this package.',
          fee_deducted: 0, // No new fee deducted
          transaction_id: existingFeeTransaction.id.toString(),
          already_paid: true,
        });
      }

      // Deduct fee - Allow negative balance for bond download
      let transactionId: bigint | null = null;
      try {
        const feeTransaction = await FeeService.deductFee(
          userId,
          'BOND_DOWNLOAD',
          billIdBigInt,
          'bond_download',
          true // allowNegative = true - Allow wallet to go negative
        );
        transactionId = feeTransaction.id as unknown as bigint;
      } catch (error: any) {
        if (error.code === 'INSUFFICIENT_BALANCE') {
          return reply.code(400).send({
            error: 'INSUFFICIENT_BALANCE',
            message: error.message || 'Insufficient balance for bond download',
            required_amount: error.required,
            available_balance: error.available,
          });
        }
        throw error;
      }

      return reply.send({
        success: true,
        message: 'Fee deducted successfully. You can now download the bond agreement.',
        fee_deducted: feeCheck.amount,
        transaction_id: transactionId?.toString(),
        already_paid: false,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error authorizing bond download:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
