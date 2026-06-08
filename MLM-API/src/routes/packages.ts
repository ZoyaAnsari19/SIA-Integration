import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';

export async function packagesRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/packages:
   *   get:
   *     tags:
   *       - Packages
   *     summary: List all packages
   *     description: |
   *       Retrieve a list of all available packages.
   *       This endpoint is public and does not require authentication.
   *       Packages are returned in ascending order by ID.
   *     operationId: listPackages
   *     responses:
   *       '200':
   *         description: List of packages retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: number
   *                     example: 1
   *                   name:
   *                     type: string
   *                     example: "Premium Package"
   *                   price:
   *                     type: number
   *                     example: 2500.00
   *                   min_amount:
   *                     type: number
   *                     nullable: true
   *                     example: 1000.00
   *                   max_amount:
   *                     type: number
   *                     nullable: true
   *                     example: 5000.00
   *                   self_monthly:
   *                     type: number
   *                     nullable: true
   *                     example: 62.50
   *                   self_roi_percent:
   *                     type: number
   *                     nullable: true
   *                     example: 2.50
   *                   global_ids:
   *                     type: number
   *                     nullable: true
   *                     example: 3
   *                   global_monthly_per_id:
   *                     type: number
   *                     nullable: true
   *                     example: 20.00
   *                   recurring_rate_percent:
   *                     type: number
   *                     nullable: true
   *                     example: 0.5
   *                   validity_months:
   *                     type: number
   *                     example: 12
   *                   validity_days:
   *                     type: number
   *                     nullable: true
   *                     example: 730
   *                   status:
   *                     type: string
   *                     enum: [active, inactive]
   *                     example: "active"
   *                   course_id:
   *                     type: number
   *                     nullable: true
   *                     example: 12345
   *                   created_at:
   *                     type: string
   *                     format: date-time
   *                     example: "2025-11-10T13:26:29.484Z"
   *                   updated_at:
   *                     type: string
   *                     format: date-time
   *                     example: "2025-11-10T14:04:04.265Z"
   *       '500':
   *         description: Internal server error
   */
  app.get('/', {
    schema: {
      description: 'List all packages',
      tags: ['Packages'],
      summary: 'List Packages',
      response: {
        200: {
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
  }, async (_req, reply) => {
    try {
      const rows = await prisma.packages.findMany({ orderBy: { id: 'asc' } });
      
      // Convert Decimal fields to numbers for JSON serialization
      const response = rows.map(row => ({
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
        validity_months: row.validity_months,
        validity_days: row.validity_days,
        status: row.status,
        course_id: row.course_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      
      return reply.send(response);
    } catch (error) {
      console.error('Error listing packages:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}


