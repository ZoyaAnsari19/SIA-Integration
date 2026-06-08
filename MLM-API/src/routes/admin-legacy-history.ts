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

type LegacyItemRow = {
  id: bigint;
  user_id: bigint | null;
  display_id: string;
  user_display_id: string | null;
  user_name: string | null;
  row_index: number;
  source_file: string;
  data: unknown;
  imported_at: Date;
  excel_user_id: string | null;
  excel_user_name: string | null;
  excel_request_type: string | null;
  excel_new_package: string | null;
  excel_utr_txn_id: string | null;
  excel_status: string | null;
  excel_renewal_added: string | null;
  excel_renewal_added_1: string | null;
  excel_clarification: string | null;
  excel_income_level: string | null;
  excel_income_amount: string | null;
  excel_from_id: string | null;
  excel_package_name: string | null;
  excel_investment_amount: string | null;
  excel_credited_date: string | null;
  excel_investment_type: string | null;
};

async function resolveFilterUserId(rawUserId?: string): Promise<bigint | undefined> {
  if (!rawUserId || !rawUserId.trim()) return undefined;
  const raw = rawUserId.trim();

  if (/^\d+$/.test(raw)) {
    return BigInt(raw);
  }

  const user = await prisma.users.findFirst({
    where: { display_id: { equals: raw, mode: 'insensitive' } },
    select: { id: true },
  });

  return user?.id ?? undefined;
}

async function getLegacyItems(tableName: 'legacy_activation_history' | 'legacy_spot_history', q: z.infer<typeof querySchema>) {
  const skip = (q.page - 1) * q.limit;
  const filterUserId = await resolveFilterUserId(q.user_id);
  const whereClause =
    filterUserId != null ? `WHERE t.user_id = ${filterUserId.toString()}` : '';

  const limit = q.limit;
  const offset = skip;

  const isSpot = tableName === 'legacy_spot_history';

  const selectExcelColumns = isSpot
    ? `
        -- Spot history (SPOT sheet)
        t.data->>'user_id'          AS excel_user_id,
        NULL::text                  AS excel_user_name,
        NULL::text                  AS excel_request_type,
        NULL::text                  AS excel_new_package,
        NULL::text                  AS excel_utr_txn_id,
        t.data->>'status'           AS excel_status,
        NULL::text                  AS excel_renewal_added,
        NULL::text                  AS excel_renewal_added_1,
        NULL::text                  AS excel_clarification,
        t.data->>'income_lvl'       AS excel_income_level,
        t.data->>'income_amount'    AS excel_income_amount,
        t.data->>'from_id'          AS excel_from_id,
        t.data->>'package_name'     AS excel_package_name,
        t.data->>'investment_amt'   AS excel_investment_amount,
        t.data->>'credited_date'    AS excel_credited_date,
        t.data->>'Investment type'  AS excel_investment_type
      `
    : `
        -- Activation history (Activation History sheet)
        t.data->>'User ID'          AS excel_user_id,
        t.data->>'User Name'        AS excel_user_name,
        t.data->>'Request Type'     AS excel_request_type,
        t.data->>'New Package'      AS excel_new_package,
        t.data->>'UTR / Txn ID'     AS excel_utr_txn_id,
        t.data->>'Status'           AS excel_status,
        t.data->>'Renewal Added'    AS excel_renewal_added,
        t.data->>'Renewal Added_1'  AS excel_renewal_added_1,
        t.data->>'Clarification'    AS excel_clarification,
        NULL::text                  AS excel_income_level,
        NULL::text                  AS excel_income_amount,
        NULL::text                  AS excel_from_id,
        NULL::text                  AS excel_package_name,
        NULL::text                  AS excel_investment_amount,
        NULL::text                  AS excel_credited_date,
        NULL::text                  AS excel_investment_type
      `;

  const rows = await prisma.$queryRawUnsafe<LegacyItemRow[]>(
    `
      SELECT
        t.id,
        t.user_id,
        t.display_id,
        u.display_id AS user_display_id,
        u.name AS user_name,
        t.row_index,
        t.source_file,
        t.data,
        t.imported_at,
        ${selectExcelColumns}
      FROM ${tableName} AS t
      LEFT JOIN users u ON u.id = t.user_id
      ${whereClause}
      ORDER BY t.imported_at DESC, t.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
  );

  const totalResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `
      SELECT COUNT(*)::bigint AS count
      FROM ${tableName} AS t
      ${whereClause}
    `,
  );

  const total = Number(totalResult[0]?.count ?? 0) || 0;

  const items = rows.map((row) => ({
    id: row.id.toString(),
    user_id: row.user_id != null ? row.user_id.toString() : null,
    display_id: row.user_display_id ?? row.display_id,
    user_name: row.user_name ?? '—',
    row_index: row.row_index,
    source_file: row.source_file,
    imported_at: row.imported_at.toISOString(),
    data: row.data,
    excel_user_id: row.excel_user_id,
    excel_user_name: row.excel_user_name,
    excel_request_type: row.excel_request_type,
    excel_new_package: row.excel_new_package,
    excel_utr_txn_id: row.excel_utr_txn_id,
    excel_status: row.excel_status,
    excel_renewal_added: row.excel_renewal_added,
    excel_renewal_added_1: row.excel_renewal_added_1,
    excel_clarification: row.excel_clarification,
    excel_income_level: row.excel_income_level,
    excel_income_amount: row.excel_income_amount,
    excel_from_id: row.excel_from_id,
    excel_package_name: row.excel_package_name,
    excel_investment_amount: row.excel_investment_amount,
    excel_credited_date: row.excel_credited_date,
    excel_investment_type: row.excel_investment_type,
  }));

  return {
    items,
    total,
    page: q.page,
    limit: q.limit,
  };
}

export async function adminLegacyHistoryRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/legacy/activation-history
   * List legacy activation history imported from old Excel.
   */
  app.get('/legacy/activation-history', {
    preHandler: [adminAuth],
    schema: {
      description: 'List legacy activation history (old system Excel import)',
      tags: ['Admin Legacy History'],
      summary: 'Get legacy activation history',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          user_id: {
            type: 'string',
            description: 'Filter by user ID (numeric) or display_id (e.g. SIA00299)',
          },
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
                  user_id: { type: 'string', nullable: true },
                  display_id: { type: 'string' },
                  user_name: { type: 'string' },
                  row_index: { type: 'number' },
                  source_file: { type: 'string' },
                  imported_at: { type: 'string', format: 'date-time' },
                  data: { type: 'object' },
                  excel_user_id: { type: ['string', 'null'] },
                  excel_user_name: { type: ['string', 'null'] },
                  excel_request_type: { type: ['string', 'null'] },
                  excel_new_package: { type: ['string', 'null'] },
                  excel_utr_txn_id: { type: ['string', 'null'] },
                  excel_status: { type: ['string', 'null'] },
                  excel_renewal_added: { type: ['string', 'null'] },
                  excel_renewal_added_1: { type: ['string', 'null'] },
                  excel_clarification: { type: ['string', 'null'] },
                  excel_income_level: { type: ['string', 'null'] },
                  excel_income_amount: { type: ['string', 'null'] },
                  excel_from_id: { type: ['string', 'null'] },
                  excel_package_name: { type: ['string', 'null'] },
                  excel_investment_amount: { type: ['string', 'null'] },
                  excel_credited_date: { type: ['string', 'null'] },
                  excel_investment_type: { type: ['string', 'null'] },
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
      const result = await getLegacyItems('legacy_activation_history', q);
      return reply.send(result);
    },
  });

  /**
   * GET /api/v1/admin/legacy/spot-history
   * List legacy spot history imported from old Excel.
   */
  app.get('/legacy/spot-history', {
    preHandler: [adminAuth],
    schema: {
      description: 'List legacy spot history (old system Excel import)',
      tags: ['Admin Legacy History'],
      summary: 'Get legacy spot history',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          user_id: {
            type: 'string',
            description: 'Filter by user ID (numeric) or display_id (e.g. SIA00299)',
          },
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
                  user_id: { type: 'string', nullable: true },
                  display_id: { type: 'string' },
                  user_name: { type: 'string' },
                  row_index: { type: 'number' },
                  source_file: { type: 'string' },
                  imported_at: { type: 'string', format: 'date-time' },
                  data: { type: 'object' },
                  excel_user_id: { type: ['string', 'null'] },
                  excel_user_name: { type: ['string', 'null'] },
                  excel_request_type: { type: ['string', 'null'] },
                  excel_new_package: { type: ['string', 'null'] },
                  excel_utr_txn_id: { type: ['string', 'null'] },
                  excel_status: { type: ['string', 'null'] },
                  excel_renewal_added: { type: ['string', 'null'] },
                  excel_renewal_added_1: { type: ['string', 'null'] },
                  excel_clarification: { type: ['string', 'null'] },
                  excel_income_level: { type: ['string', 'null'] },
                  excel_income_amount: { type: ['string', 'null'] },
                  excel_from_id: { type: ['string', 'null'] },
                  excel_package_name: { type: ['string', 'null'] },
                  excel_investment_amount: { type: ['string', 'null'] },
                  excel_credited_date: { type: ['string', 'null'] },
                  excel_investment_type: { type: ['string', 'null'] },
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
      const result = await getLegacyItems('legacy_spot_history', q);
      return reply.send(result);
    },
  });
}

