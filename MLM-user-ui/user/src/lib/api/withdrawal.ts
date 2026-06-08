/**
 * Withdrawal API Service
 */

import { apiClient } from './client';
import type { WithdrawalRequest, WithdrawalRequestResponse, WithdrawRules } from './types';

/**
 * Get user's withdrawal requests
 */
export async function getWithdrawalRequests(params?: {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'processing' | 'cancelled';
  withdraw_type?: 'wallet' | 'spot' | 'team_royalty';
}): Promise<{
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: Array<{
    id: string;
    user_id: string;
    withdraw_type: string;
    amount: number;
    payment_method: string;
    account_details: any;
    status: string;
    remarks?: string | null;
    processed_at?: string | null;
    rejection_reason?: string | null;
    created_at: string;
    withdrawal_fee?: number; // Withdrawal processing fee (only for approved/processing)
  }>;
}> {
  try {
    const response = await apiClient.get<{
      count: number;
      page: number;
      limit: number;
      total_pages: number;
      total: number;
      items: Array<{
        id: string;
        user_id: string;
        withdraw_type: string;
        amount: number;
        payment_method: string;
        account_details: any;
        status: string;
        remarks?: string | null;
        processed_at?: string | null;
        rejection_reason?: string | null;
        created_at: string;
        withdrawal_fee?: number; // Withdrawal processing fee (only for approved/processing)
      }>;
    }>('/withdraw/requests', {
      params: params || {},
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get withdrawal request details by ID
 */
export async function getWithdrawalRequestById(id: string): Promise<{
  id: string;
  user_id: string;
  withdraw_type: string;
  amount: number;
  payment_method: string;
  account_details: any;
  status: string;
  remarks?: string | null;
  processed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}> {
  try {
    const response = await apiClient.get<{
      id: string;
      user_id: string;
      withdraw_type: string;
      amount: number;
      payment_method: string;
      account_details: any;
      status: string;
      remarks?: string | null;
      processed_at?: string | null;
      rejection_reason?: string | null;
      created_at: string;
    }>(`/withdraw/requests/${id}`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Create withdrawal request
 */
export async function createWithdrawalRequest(
  data: WithdrawalRequest
): Promise<WithdrawalRequestResponse> {
  try {
    const response = await apiClient.post<WithdrawalRequestResponse>(
      '/withdraw/requests',
      data
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get withdrawal rules (min/max limits and charges)
 */
export async function getWithdrawRules(): Promise<WithdrawRules> {
  try {
    const response = await apiClient.get<WithdrawRules>('/withdraw/rules');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Check if current time is within allowed withdrawal hours (10 AM to 5 PM IST)
 */
export function isWithdrawalTimeAllowed(): {
  allowed: boolean;
  message?: string;
} {
  // Get current time in IST
  // IST is UTC+5:30, so we need to convert UTC time to IST
  const now = new Date();
  
  // Get UTC time components
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Convert to IST (UTC+5:30)
  let istHours = utcHours + 5;
  let istMinutes = utcMinutes + 30;
  
  // Handle minute overflow (if minutes >= 60, add 1 hour)
  if (istMinutes >= 60) {
    istHours += 1;
    istMinutes -= 60;
  }
  
  // Handle hour overflow (if hours >= 24, subtract 24)
  if (istHours >= 24) {
    istHours -= 24;
  }
  
  const currentTimeMinutes = istHours * 60 + istMinutes;
  
  // 10 AM = 10 * 60 = 600 minutes
  // 5 PM = 17 * 60 = 1020 minutes (inclusive, so we check < 1020, meaning up to 16:59:59)
  const startTimeMinutes = 10 * 60; // 10:00 AM
  const endTimeMinutes = 17 * 60; // 5:00 PM (17:00) - exclusive, so 16:59:59 is last allowed
  
  if (currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes) {
    return { allowed: true };
  }
  
  const currentTimeStr = `${String(istHours).padStart(2, '0')}:${String(istMinutes).padStart(2, '0')}`;
  return {
    allowed: false,
    message: `Withdrawal is only allowed between 10:00 AM and 5:00 PM IST. Current time is ${currentTimeStr} IST.`
  };
}

/**
 * Check if withdrawal is allowed on current date
 * Must match backend:
 * - 10th & 20th: SPOT only
 * - 30th (28th Feb): SPOT + Main + Team Royalty
 */
export function isWithdrawalDateAllowed(): {
  allowed: boolean;
  allowedWallets: Array<'spot' | 'other' | 'team_royalty'>;
  message?: string;
} {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1; // 1-12
  const isFebruary = month === 2;

  // 10th & 20th: ONLY SPOT wallet allowed
  if (day === 10 || day === 20) {
    return { allowed: true, allowedWallets: ['spot'] };
  }

  // 30th (or 28th for February): All three wallets allowed
  if ((isFebruary && day === 28) || (!isFebruary && day === 30)) {
    return { allowed: true, allowedWallets: ['spot', 'other', 'team_royalty'] };
  }

  return {
    allowed: false,
    allowedWallets: [],
    message: `Withdrawal is only allowed on 10th, 20th and ${isFebruary ? '28th' : '30th'} of each month. Today is ${day}.`,
  };
}

