import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  // Accept numeric user_id (e.g. 280) or display_id (e.g. SIA00299)
  user_id: z.string().optional(),
});

export async function adminFlushHistoryRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/flush-history
   * List spot/team royalty flush history (10x rule). Optional filter by user_id.
   */
  app.get('/flush-history', {
    preHandler: [adminAuth],
    schema: {
      description: 'List flush history (when and how much spot/team_royalty was flushed per user)',
      tags: ['Admin Flush History'],
      summary: 'Get flush history',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          user_id: { type: 'string', description: 'Filter by user ID (numeric) or display_id (e.g. SIA00299)' },
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
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  display_id: { type: 'string' },
                  user_name: { type: 'string' },
                  flushed_at: { type: 'string', format: 'date-time' },
                  spot_amount_flushed: { type: 'number' },
                  team_royalty_amount_flushed: { type: 'number' },
                  trigger_commission_type: { type: 'string' },
                  current_spot_balance: { type: 'number' },
                  current_team_royalty_balance: { type: 'number' },
                },
              },
            },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const q = querySchema.parse(req.query);
      const skip = (q.page - 1) * q.limit;

      let filterUserId: bigint | undefined;
      if (q.user_id && q.user_id.trim()) {
        const raw = q.user_id.trim();
        if (/^\d+$/.test(raw)) {
          filterUserId = BigInt(raw);
        } else {
          const user = await prisma.users.findFirst({
            where: { display_id: { equals: raw, mode: 'insensitive' } },
            select: { id: true },
          });
          if (user) filterUserId = user.id;
          // If display_id not found, filterUserId stays undefined → no match (empty list)
        }
      }
      const where = filterUserId != null ? { user_id: filterUserId } : {};

      const [items, total] = await Promise.all([
        prisma.spot_team_flush_history.findMany({
          where,
          orderBy: { flushed_at: 'desc' },
          skip,
          take: q.limit,
        }),
        prisma.spot_team_flush_history.count({ where }),
      ]);

      const userIds = [...new Set(items.map((i) => i.user_id))];
      const [users, balances] = await Promise.all([
        userIds.length > 0
          ? prisma.users.findMany({
              where: { id: { in: userIds } },
              select: { id: true, display_id: true, name: true },
            })
          : [],
        userIds.length > 0
          ? prisma.user_balances.findMany({
              where: { user_id: { in: userIds } },
              select: { user_id: true, spot_balance: true, team_royalty_balance: true },
            })
          : [],
      ]);
      const userMap = new Map(users.map((u) => [u.id.toString(), u]));
      const balanceMap = new Map(balances.map((b) => [b.user_id.toString(), b]));

      const list = items.map((row) => {
        const u = userMap.get(row.user_id.toString());
        const bal = balanceMap.get(row.user_id.toString());
        return {
          id: row.id.toString(),
          user_id: row.user_id.toString(),
          display_id: u?.display_id ?? row.user_id.toString(),
          user_name: u?.name ?? '—',
          flushed_at: (row.flushed_at as Date).toISOString(),
          spot_amount_flushed: Number(row.spot_amount_flushed),
          team_royalty_amount_flushed: Number(row.team_royalty_amount_flushed),
          trigger_commission_type: row.trigger_commission_type,
          current_spot_balance: bal ? Number(bal.spot_balance ?? 0) : 0,
          current_team_royalty_balance: bal ? Number(bal.team_royalty_balance ?? 0) : 0,
        };
      });

      return reply.send({
        items: list,
        total,
        page: q.page,
        limit: q.limit,
      });
    },
  });
}
