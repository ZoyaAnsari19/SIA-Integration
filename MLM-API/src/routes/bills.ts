import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { prisma } from '../config/prisma.js';

export async function billsRoutes(app: FastifyInstance) {
  // GET /api/v1/bills - Get bills list (purchase history)
  app.get(
    '/bills',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Get bills list (purchase history)',
        tags: ['Bills'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              page: { type: 'number' },
              total: { type: 'number' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    package_name: { type: 'string' },
                    description: { type: 'string' },
                    amount: { type: 'number' },
                    status: { type: 'string' },
                    payment_type: { type: 'string' },
                    is_manual: { type: 'boolean' },
                    txn_id: { type: ['string', 'null'] },
                    purchased_at: { type: 'string', format: 'date-time' },
                    // active_until removed - expiry is ONLY based on 2x income
                    is_renewal: { type: 'boolean' },
                    purchase_type: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const {
          page = 1,
          limit = 20,
          start_date,
          end_date,
        } = request.query as {
          page?: number;
          limit?: number;
          start_date?: string;
          end_date?: string;
        };

        const skip = (page - 1) * limit;

        // Build where clause
        // Bills are generated only for successful payments (status='completed')
        // Include: activation, renew, reinvestment purchases
        const where: any = {
          user_id: userId,
          status: 'completed', // Only show completed purchases (successful payments)
          purchase_type: {
            in: ['DIRECT_PACKAGE', 'COURSE_PURCHASE', 'MANUAL_DEPOSIT'], // All purchase types that generate bills
          },
        };

        if (start_date || end_date) {
          where.purchased_at = {};
          if (start_date) {
            where.purchased_at.gte = new Date(start_date);
          }
          if (end_date) {
            where.purchased_at.lte = new Date(end_date);
          }
        }

        // Get total count
        const total = await prisma.purchases.count({ where });

        // Get purchases
        const purchases = await prisma.purchases.findMany({
          where,
          orderBy: { purchased_at: 'desc' },
          skip,
          take: limit,
        });

        // Get package details separately
        const packageIds = [...new Set(purchases.map(p => p.package_id))];
        const packages = await prisma.packages.findMany({
          where: { id: { in: packageIds } },
          select: {
            id: true,
            name: true,
            price: true,
          },
        });
        const packageMap = new Map(packages.map(p => [p.id, p]));

        const items = purchases
          .map((purchase) => {
            const pkg = packageMap.get(purchase.package_id);
            if (!pkg) {
              // Skip purchases with missing packages
              return null;
            }

            // Determine purchase type description
            let description = pkg.name;
            if (purchase.is_renewal) {
              description = `${pkg.name} (Renewal)`;
            } else if (purchase.purchase_type === 'COURSE_PURCHASE') {
              description = `${pkg.name} (Course Purchase)`;
            } else if (purchase.purchase_type === 'MANUAL_DEPOSIT') {
              description = `${pkg.name} (Investment)`;
            }

            return {
              id: purchase.id.toString(),
              package_name: pkg.name,
              description: description,
              amount: Number(purchase.amount || pkg.price),
              status: 'paid', // Bills are always paid (only generated after successful payment)
              payment_type: purchase.payment_type || (purchase.is_manual ? 'manual' : 'gateway'),
              is_manual: purchase.is_manual,
              txn_id: purchase.txn_id,
              purchased_at: purchase.purchased_at.toISOString(),
              // active_until removed - expiry is ONLY based on 2x income
              is_renewal: purchase.is_renewal || false,
              purchase_type: purchase.purchase_type,
            };
          })
          .filter((item) => item !== null) as Array<{
            id: string;
            package_name: string;
            description: string;
            amount: number;
            status: string;
            payment_type: string;
            is_manual: boolean;
            txn_id: string | null;
            purchased_at: string;
            // active_until removed - expiry is ONLY based on 2x income
            is_renewal: boolean;
            purchase_type: string;
          }>;

        return reply.send({
          count: items.length,
          page,
          total,
          items,
        });
      } catch (error) {
        console.error('Bills list error:', error);
        return reply.code(500).send({
          message: 'Failed to fetch bills',
        });
      }
    }
  );

  // GET /api/v1/invoices/:id - Get invoice details
  app.get(
    '/invoices/:id',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Get invoice details by purchase ID',
        tags: ['Bills'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              invoice_number: { type: 'string' },
              package: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                },
              },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
              amount: { type: 'number' },
              status: { type: 'string' },
              payment_type: { type: 'string' },
              txn_id: { type: ['string', 'null'] },
              payment_proof_url: { type: ['string', 'null'] },
              purchased_at: { type: 'string', format: 'date-time' },
              // active_until removed - expiry is ONLY based on 2x income
              breakdown: {
                type: 'object',
                properties: {
                  package_price: { type: 'number' },
                  tax: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const { id } = request.params as { id: string };

        const purchaseId = BigInt(id);

        // Get purchase with full details
        const purchase = await prisma.purchases.findFirst({
          where: {
            id: purchaseId,
            user_id: userId,
            status: 'completed', // Only show completed purchases (bills are only for successful payments)
          },
        });

        if (!purchase) {
          return reply.code(404).send({ message: 'Invoice not found' });
        }

        // Get package and user details separately
        const [pkg, user] = await Promise.all([
          prisma.packages.findUnique({
            where: { id: purchase.package_id },
            select: {
              id: true,
              name: true,
              price: true,
            },
          }),
          prisma.users.findUnique({
            where: { id: purchase.user_id },
            select: {
              id: true,
              name: true,
              email: true,
            },
          }),
        ]);

        if (!pkg || !user) {
          return reply.code(404).send({ message: 'Invoice details not found' });
        }

        const packagePrice = Number(pkg.price);
        const tax = 0; // No tax currently
        const total = packagePrice + tax;

        return reply.send({
          id: purchase.id.toString(),
          invoice_number: `INV-${new Date(purchase.purchased_at).getFullYear()}-${purchase.id
            .toString()
            .padStart(5, '0')}`,
          package: {
            id: pkg.id,
            name: pkg.name,
            price: packagePrice,
          },
          user: {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          },
          amount: total,
          status: purchase.status,
          payment_type: purchase.payment_type || 'manual',
          txn_id: purchase.txn_id,
          payment_proof_url: purchase.payment_proof_url,
          purchased_at: purchase.purchased_at.toISOString(),
          // active_until removed - expiry is ONLY based on 2x income
          breakdown: {
            package_price: packagePrice,
            tax,
            total,
          },
        });
      } catch (error) {
        console.error('Invoice details error:', error);
        return reply.code(500).send({
          message: 'Failed to fetch invoice details',
        });
      }
    }
  );
}

