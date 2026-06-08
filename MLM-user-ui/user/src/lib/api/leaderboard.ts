/**
 * Leaderboard API Service
 */

import { apiClient } from './client';

export interface LeaderboardItem {
  rank: number;
  user_id: string;
  display_id?: string | null;
  name: string | null;
  email: string | null;
  kyc_status: string | null;
  display_title?: string | null;
  display_title_icon_url?: string | null;
  badge?: {
    name: string;
    emoji: string;
    description: string;
  } | null;
  // For top-earners
  wallet_balance?: number;
  total_commissions?: number;
  // For top-referrers
  direct_referrals?: number;
  total_team_size?: number;
  // For business-volume
  total_business_volume?: number;
  direct_business?: number;
  team_business?: number;
  // Additional fields
  profile_photo_url?: string | null;
  level?: number; // Highest eligible level (0-9)
  level_name?: string; // Level display name (e.g., "LEVEL 1", "DIRECT")
  global_ids?: number; // Total global IDs from packages
}

export interface LeaderboardResponse {
  count: number;
  total: number;
  items: LeaderboardItem[];
}

export interface UserPosition {
  user_id: string;
  leaderboards: {
    top_earners?: {
      rank: number | null;
      total_participants: number;
      value: number;
      total_commissions: number;
    };
    top_referrers?: {
      rank: number | null;
      total_participants: number;
      value: number;
      total_team_size: number;
    };
    business_volume?: {
      rank: number | null;
      total_participants: number;
      value: number;
      direct_business: number;
      team_business: number;
    };
  };
}

/**
 * Get top earners by wallet balance
 */
export async function getTopEarners(params?: {
  limit?: number;
  offset?: number;
  period?: 'week' | 'month' | 'all';
  category?: 'spot' | 'monthly_royalty' | 'all_income';
}): Promise<LeaderboardResponse> {
  try {
    const response = await apiClient.get<LeaderboardResponse>(
      '/leaderboard/top-earners',
      {
        params: params || {},
      }
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get top referrers by number of direct referrals
 */
export async function getTopReferrers(params?: {
  limit?: number;
  offset?: number;
}): Promise<LeaderboardResponse> {
  try {
    const response = await apiClient.get<LeaderboardResponse>(
      '/leaderboard/top-referrers',
      {
        params: params || {},
      }
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get top users by business volume
 */
export async function getTopBusinessVolume(params?: {
  limit?: number;
  offset?: number;
}): Promise<LeaderboardResponse> {
  try {
    const response = await apiClient.get<LeaderboardResponse>(
      '/leaderboard/business-volume',
      {
        params: params || {},
      }
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get current user's position in all leaderboards
 */
export async function getMyPosition(params?: {
  period?: 'week' | 'month' | 'all';
}): Promise<UserPosition> {
  try {
    const response = await apiClient.get<UserPosition>(
      '/leaderboard/my-position',
      {
        params: params || {},
      }
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

