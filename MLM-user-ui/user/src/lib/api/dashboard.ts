/**
 * Dashboard API Service
 */

import { apiClient } from './client';
import type { WalletBalance, DashboardStats, CommissionSummary } from './types';

/**
 * Dashboard Stats Response
 */
export interface DashboardStatsResponse {
  user_id: string;
  wallet_balance: number;
  total_earnings: number;
  pending_commissions: number;
  total_commissions: number;
  commission_by_type: {
    SELF: number;
    GLOBAL_HELPING: number;
    SPOT: number;
    MONTHLY: number;
  };
  // Total amount withdrawn from MAIN (other) wallet for this user
  main_wallet_withdrawals?: number;
  direct_referral_commission: number;
  global_helping_team: {
    current: number;
    total: number;
  };
  team_balance: number;
  team_stats: {
    direct_referrals: number;
    total_team_size: number;
    active_members: number;
    total_business_volume: number;
  };
  purchase_stats: {
    total_purchases: number;
    total_spent: number;
    active_packages: number;
  };
  recent_activity: Array<{
    type: string;
    description: string;
    amount: number | null;
    date: string;
  }>;
}

/**
 * Get wallet balance (with spot_balance and other_balance)
 */
export async function getWalletBalance(): Promise<WalletBalance> {
  try {
    const response = await apiClient.get<WalletBalance>('/dashboard/wallet');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  try {
    const response = await apiClient.get<DashboardStatsResponse>('/dashboard');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get commission summary
 * (Extracted from dashboard stats)
 */
export function getCommissionSummary(stats: DashboardStatsResponse): CommissionSummary {
  return {
    self: stats.commission_by_type.SELF || 0,
    spot: stats.commission_by_type.SPOT || 0,
    global_helping: stats.commission_by_type.GLOBAL_HELPING || 0,
    monthly: stats.commission_by_type.MONTHLY || 0,
    total: stats.total_commissions || 0,
  };
}

/**
 * Team Business Breakdown Response
 */
export interface TeamBusinessBreakdownResponse {
  levels: {
    [key: string]: Array<{
      category: string;
      spot_income: number;
      monthly_royalty: number;
    }>;
  };
}

/**
 * Get team business breakdown by level and month
 */
export async function getTeamBusinessBreakdown(months: number = 4): Promise<TeamBusinessBreakdownResponse> {
  try {
    const response = await apiClient.get<TeamBusinessBreakdownResponse>('/dashboard/team-business-breakdown', {
      params: { months },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Commission Trend Response
 */
export interface CommissionTrendResponse {
  days: number;
  data: Array<{
    date: string;
    commission: number;
  }>;
}

/**
 * Get commission trend for last N days
 */
export async function getCommissionTrend(days: number = 30): Promise<CommissionTrendResponse> {
  try {
    const response = await apiClient.get<CommissionTrendResponse>('/dashboard/commission-trend', {
      params: { days },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Royalty Trend Response
 */
export interface RoyaltyTrendResponse {
  data: Array<{
    month: string;
    royalty: number;
  }>;
}

/**
 * Get royalty trend for last 6 months
 */
export async function getRoyaltyTrend(): Promise<RoyaltyTrendResponse> {
  try {
    const response = await apiClient.get<RoyaltyTrendResponse>('/dashboard/royalty-trend');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Notice Response
 */
export interface NoticeItem {
  id: number;
  title: string;
  content: string;
  link: string | null;
  created_at: string;
}

export interface NoticesResponse {
  items: NoticeItem[];
}

/**
 * Get active notices for dashboard
 */
export async function getDashboardNotices(): Promise<NoticesResponse> {
  try {
    const response = await apiClient.get<NoticesResponse>('/dashboard/notices');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Banner Item
 */
export interface BannerItem {
  id: number;
  title: string;
  image_url: string;
  link: string | null;
  display_order: number;
}

export interface BannersResponse {
  items: BannerItem[];
}

/**
 * Get active banners for dashboard
 */
export async function getDashboardBanners(): Promise<BannersResponse> {
  try {
    const response = await apiClient.get<BannersResponse>('/dashboard/banners');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

