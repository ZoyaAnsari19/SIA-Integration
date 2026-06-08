/**
 * Team API Service
 */

import { apiClient } from './client';

export interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  kyc_status: string | null;
  created_at: string;
  display_id?: string | null;
  has_active_package?: boolean;
  spot_amount?: number;
  pending_spot_amount?: number;
  last_month_royalty?: number;
  /** Total investment (sum of completed purchase amounts) for this member */
  total_investment?: number;
}

export interface TeamLevel {
  level: number;
  count: number;
  members: TeamMember[];
}

export interface TeamResponse {
  total_team_size: number;
  levels: Record<string, TeamLevel>;
  direct_referrals_count?: number;
  total_business_volume?: number;
  active_members_count?: number;
}

export interface TeamStatsResponse {
  total_team_size: number;
  active_members: number;
  total_business_volume: number;
  direct_referrals: number;
  level_breakdown: Record<
    string,
    {
      level: number;
      count: number;
      active_count: number;
      business_volume: number;
    }
  >;
}

export interface Referral {
  id: string;
  name: string | null;
  email: string | null;
  kyc_status: string | null;
  created_at: string;
}

export interface TeamTreeMember {
  id: string;
  display_id?: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  kyc_status: string | null;
  created_at: string;
  referrer_user_id?: string | null;
}

export interface TeamTreeLevel {
  level: number;
  count: number;
  members: TeamTreeMember[];
}

export interface TeamTreeResponse {
  upline: {
    id: string;
    display_id?: string | null;
    name: string;
    email: string;
    phone: string | null;
    depth: number;
    level: number;
    kyc_status: string | null;
  }[];
  downline: {
    total_team_size: number;
    levels: Record<string, TeamTreeLevel>;
  };
}

/**
 * Get team members (downline tree) with level-wise breakdown
 */
export async function getTeam(params?: {
  max_depth?: number;
}): Promise<TeamResponse> {
  try {
    const response = await apiClient.get<TeamResponse>('/team', {
      params: params || {},
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get aggregated team statistics (size, active members, business volume, direct refs)
 */
export async function getTeamStats(): Promise<TeamStatsResponse> {
  try {
    const response = await apiClient.get<TeamStatsResponse>('/team/stats');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get direct referrals for a user
 */
export async function getReferrals(userId: string): Promise<Referral[]> {
  try {
    const response = await apiClient.get<Referral[]>(`/users/${userId}/referrals`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get full team tree (upline + downline hierarchy)
 */
export async function getTeamTree(): Promise<TeamTreeResponse> {
  try {
    const response = await apiClient.get<TeamTreeResponse>('/team/tree');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

