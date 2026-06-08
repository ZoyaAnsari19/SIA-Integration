import { prisma } from '../config/prisma.js';

/**
 * Counts distinct users who appear in the GLOBAL_HELPING "window":
 * completed first purchases (`is_renewal = false`) with `purchased_at` in
 * `(windowStartExclusive, windowEndInclusive]` and `user_id <> excludeUserId`.
 *
 * - rawDistinct: all such users (historical joiners).
 * - activeDistinct: only users whose *earliest* qualifying purchase in that window
 *   still has `income < 2 × amount` (package not expired on that purchase row).
 *
 * Used by daily GLOBAL_HELPING and package-status so UI matches payouts.
 */
export type GlobalContributorWindowCounts = {
  rawDistinct: number;
  activeDistinct: number;
};

export async function getGlobalContributorWindowCounts(
  excludeUserId: bigint,
  windowStartExclusive: Date,
  windowEndInclusive: Date,
): Promise<GlobalContributorWindowCounts> {
  const end = new Date(windowEndInclusive);
  end.setHours(23, 59, 59, 999);

  const rows = await prisma.$queryRaw<{ raw_distinct: number; active_distinct: number }[]>`
    WITH candidates AS (
      SELECT DISTINCT p.user_id
      FROM purchases p
      WHERE p.status = 'completed'
        AND p.is_renewal = false
        AND p.purchased_at > ${windowStartExclusive}
        AND p.purchased_at <= ${end}
        AND p.user_id <> ${excludeUserId}
    ),
    qualifying AS (
      SELECT DISTINCT ON (p.user_id) p.income, p.amount
      FROM purchases p
      INNER JOIN candidates c ON c.user_id = p.user_id
      WHERE p.status = 'completed'
        AND p.is_renewal = false
        AND p.purchased_at > ${windowStartExclusive}
        AND p.purchased_at <= ${end}
      ORDER BY p.user_id, p.purchased_at ASC
    )
    SELECT
      (SELECT COUNT(*)::int FROM candidates) AS raw_distinct,
      (
        SELECT COUNT(*)::int
        FROM qualifying
        WHERE COALESCE(qualifying.income, 0) < 2 * qualifying.amount
      ) AS active_distinct
  `;

  const row = rows[0];
  return {
    rawDistinct: Number(row?.raw_distinct ?? 0),
    activeDistinct: Number(row?.active_distinct ?? 0),
  };
}
