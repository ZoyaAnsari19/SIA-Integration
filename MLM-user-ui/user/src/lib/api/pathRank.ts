import { apiClient } from './client';

export interface PathRankLevel {
  level: number;
  title: string;
  description: string | null;
  reward: string | null;
  spot_commission_percent: number | null;
  monthly_royalty_percent: number | null;
  eligible: boolean;
  earnings: {
    spot_commissions: number;
    monthly_commissions: number;
    total_earnings: number;
    commission_count: number;
  };
}

export interface PathRankResponse {
  user_id: string;
  levels: PathRankLevel[];
}

export interface LevelRequirement {
  level: number;
  required_leg_count: number | null;
  required_leg_min_amount: number | null;
  is_eligible: boolean;
}

export interface LegDetail {
  leg_user_id: string;
  leg_business_volume: number;
  leg_user_name: string | null;
}

export interface PathRankEligibilityResponse {
  user_id: string;
  eligibility_status: Record<string, boolean>;
  leg_volumes: Record<string, number>;
  leg_details: LegDetail[];
  level_requirements: LevelRequirement[];
}

/**
 * Get path rank details with earnings for all levels
 */
export async function getPathRank(): Promise<PathRankResponse> {
  try {
    const response = await apiClient.get<PathRankResponse>('/path-rank');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get detailed eligibility information
 */
export async function getPathRankEligibility(): Promise<PathRankEligibilityResponse> {
  try {
    const response = await apiClient.get<PathRankEligibilityResponse>('/path-rank/eligibility');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

