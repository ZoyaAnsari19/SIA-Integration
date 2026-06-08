import type { LeaderboardItem, LeaderboardResponse, UserPosition } from "@/lib/api/leaderboard";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_LEADERBOARD: LeaderboardItem[] = [
  {
    rank: 1,
    user_id: "1001",
    display_id: "SIA00057",
    name: "Rahul Sharma",
    email: "rahul@example.com",
    kyc_status: "approved",
    display_title: "Diamond Leader",
    wallet_balance: 125000,
    total_commissions: 98000,
    direct_referrals: 24,
    total_team_size: 156,
    level: 3,
    level_name: "LEVEL 3",
    global_ids: 45,
  },
  {
    rank: 2,
    user_id: "1002",
    display_id: "SIA00089",
    name: "Priya Patel",
    email: "priya@example.com",
    kyc_status: "approved",
    display_title: "Gold Leader",
    wallet_balance: 98000,
    total_commissions: 76000,
    direct_referrals: 18,
    total_team_size: 112,
    level: 2,
    level_name: "LEVEL 2",
    global_ids: 32,
  },
  {
    rank: 3,
    user_id: "1003",
    display_id: "SIA00124",
    name: "Amit Kumar",
    email: "amit@example.com",
    kyc_status: "approved",
    display_title: "Silver Leader",
    wallet_balance: 76500,
    total_commissions: 62000,
    direct_referrals: 15,
    total_team_size: 89,
    level: 2,
    level_name: "LEVEL 2",
    global_ids: 28,
  },
  {
    rank: 4,
    user_id: "1004",
    display_id: "SIA00156",
    name: "Sneha Reddy",
    email: "sneha@example.com",
    kyc_status: "approved",
    wallet_balance: 54200,
    total_commissions: 48000,
    direct_referrals: 12,
    total_team_size: 67,
    level: 1,
    level_name: "LEVEL 1",
    global_ids: 20,
  },
  {
    rank: 5,
    user_id: "1005",
    display_id: "SIA00198",
    name: "Vikram Singh",
    email: "vikram@example.com",
    kyc_status: "approved",
    wallet_balance: 42100,
    total_commissions: 38500,
    direct_referrals: 10,
    total_team_size: 54,
    level: 1,
    level_name: "LEVEL 1",
    global_ids: 15,
  },
  {
    rank: 6,
    user_id: "1006",
    display_id: "SIA00234",
    name: "Anita Desai",
    email: "anita@example.com",
    kyc_status: "submitted",
    wallet_balance: 31800,
    total_commissions: 29000,
    direct_referrals: 8,
    total_team_size: 42,
    level: 1,
    level_name: "LEVEL 1",
    global_ids: 12,
  },
  {
    rank: 7,
    user_id: "1007",
    display_id: "SIA00267",
    name: "Rajesh Mehta",
    email: "rajesh@example.com",
    kyc_status: "approved",
    wallet_balance: 25600,
    total_commissions: 22000,
    direct_referrals: 7,
    total_team_size: 35,
    level: 0,
    level_name: "DIRECT",
    global_ids: 10,
  },
  {
    rank: 8,
    user_id: "1008",
    display_id: "SIA00301",
    name: "Kavita Joshi",
    email: "kavita@example.com",
    kyc_status: "approved",
    wallet_balance: 18900,
    total_commissions: 16500,
    direct_referrals: 5,
    total_team_size: 28,
    level: 0,
    level_name: "DIRECT",
    global_ids: 8,
  },
];

const MOCK_POSITION: UserPosition = {
  user_id: "1001",
  leaderboards: {
    top_earners: {
      rank: 4,
      total_participants: 250,
      value: 54200,
      total_commissions: 48000,
    },
    top_referrers: {
      rank: 6,
      total_participants: 250,
      value: 12,
      total_team_size: 67,
    },
    business_volume: {
      rank: 5,
      total_participants: 250,
      value: 850000,
      direct_business: 250000,
      team_business: 600000,
    },
  },
};

export type { LeaderboardItem };

export async function getTopEarners(_params?: {
  limit?: number;
  offset?: number;
  period?: "week" | "month" | "all";
  category?: "spot" | "monthly_royalty" | "all_income";
}): Promise<LeaderboardResponse> {
  await delay();
  return {
    count: MOCK_LEADERBOARD.length,
    total: MOCK_LEADERBOARD.length,
    items: structuredClone(MOCK_LEADERBOARD),
  };
}

export async function getMyPosition(_params?: {
  period?: "week" | "month" | "all";
}): Promise<UserPosition> {
  await delay();
  return structuredClone(MOCK_POSITION);
}
