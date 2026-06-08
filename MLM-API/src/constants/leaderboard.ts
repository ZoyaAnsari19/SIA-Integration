/**
 * Leaderboard Badge Constants
 * Used for visual rewards in leaderboard section only
 * (Separate from level names/titles)
 */

export const LEADERBOARD_BADGES = {
  GOLD: {
    name: 'Gold',
    emoji: '🥇',
    rankRange: [1, 3], // Top 3
    description: 'Top 3 performers',
  },
  SILVER: {
    name: 'Silver',
    emoji: '🥈',
    rankRange: [4, 10], // Rank 4-10
    description: 'Top 4-10 performers',
  },
  BRONZE: {
    name: 'Bronze',
    emoji: '🥉',
    rankRange: [11, 20], // Rank 11-20
    description: 'Top 11-20 performers',
  },
} as const;

export type BadgeType = typeof LEADERBOARD_BADGES[keyof typeof LEADERBOARD_BADGES] | null;

/**
 * Get badge for a given rank
 * @param rank - The rank position (1-based)
 * @returns Badge object or null if no badge for this rank
 */
export function getBadgeForRank(rank: number): BadgeType {
  if (rank >= LEADERBOARD_BADGES.GOLD.rankRange[0] && rank <= LEADERBOARD_BADGES.GOLD.rankRange[1]) {
    return LEADERBOARD_BADGES.GOLD;
  }
  if (rank >= LEADERBOARD_BADGES.SILVER.rankRange[0] && rank <= LEADERBOARD_BADGES.SILVER.rankRange[1]) {
    return LEADERBOARD_BADGES.SILVER;
  }
  if (rank >= LEADERBOARD_BADGES.BRONZE.rankRange[0] && rank <= LEADERBOARD_BADGES.BRONZE.rankRange[1]) {
    return LEADERBOARD_BADGES.BRONZE;
  }
  return null;
}

