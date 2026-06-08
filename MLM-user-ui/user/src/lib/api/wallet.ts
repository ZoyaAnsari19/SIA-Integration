/**
 * Wallet Transfer API Service
 */

import { apiClient } from './client';
import type { P2PTransferRequest, WalletTransferRequest } from './types';

/**
 * Get user wallet balance (includes spot_balance, other_balance, team_royalty_balance)
 */
export async function getWalletBalance(userId?: string): Promise<{
  user_id: string;
  balance: number;
  spot_balance: number;
  other_balance: number;
  team_royalty_balance?: number;
  spot_team_withdraw_limit?: number;
  spot_team_withdraw_used?: number;
  spot_team_withdraw_remaining?: number;
  spot_team_withdraw_multiplier?: number;
}> {
  try {
    const endpoint = userId ? `/users/${userId}/wallet` : '/dashboard/wallet';
    const response = await apiClient.get<{
      user_id: string;
      balance: number;
      spot_balance: number;
      other_balance: number;
      team_royalty_balance?: number;
      spot_team_withdraw_limit?: number;
      spot_team_withdraw_used?: number;
      spot_team_withdraw_remaining?: number;
      spot_team_withdraw_multiplier?: number;
    }>(endpoint);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get user details by ID (for team members only)
 */
export async function getUserDetails(receiverId: string): Promise<{
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  profile_photo_url?: string | null;
  kyc_status?: string | null;
  status: string;
  created_at: string;
  relationship: string;
  depth: number;
}> {
  try {
    const response = await apiClient.get<{
      id: string;
      name: string;
      email?: string;
      phone?: string | null;
      profile_photo_url?: string | null;
      kyc_status?: string | null;
      status: string;
      created_at: string;
      relationship: string;
      depth: number;
    }>(`/user/details/${receiverId}`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * P2P Transfer - Transfer money to another user
 */
export async function p2pTransfer(
  data: P2PTransferRequest
): Promise<{
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  tax_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
}> {
  try {
    const response = await apiClient.post<{
      id: string;
      sender_id: string;
      receiver_id: string;
      amount: number;
      tax_amount: number;
      net_amount: number;
      status: string;
      created_at: string;
    }>('/transfer/p2p', data);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Send OTP for P2P Transfer
 */
export async function sendP2PTransferOTP(): Promise<{
  success: boolean;
  message: string;
  email_masked?: string;
}> {
  try {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      email_masked?: string;
    }>('/transfer/p2p/send-otp', {});
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Wallet Transfer - Transfer money to another user's wallet
 */
export async function walletTransfer(
  data: WalletTransferRequest
): Promise<{
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  tax_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
}> {
  try {
    const response = await apiClient.post<{
      id: string;
      from_user_id: string;
      to_user_id: string;
      amount: number;
      tax_amount: number;
      net_amount: number;
      status: string;
      created_at: string;
    }>('/wallet/transfer', data);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get transfer rules (tax percentage, min/max amounts)
 */
export async function getTransferRules(): Promise<{
  transfer_amt_tax: number;
  min_transfer_amt: number;
  max_transfer_amt: number | null;
}> {
  try {
    const response = await apiClient.get<{
      transfer_amt_tax: number;
      min_transfer_amt: number;
      max_transfer_amt: number | null;
    }>('/transfer/rules');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get transfer history (P2P transfers)
 */
export async function getTransferHistory(params?: {
  type?: 'sent' | 'received' | 'all';
  page?: number;
  limit?: number;
}): Promise<{
  count: number;
  page: number;
  total: number;
  items: Array<{
    id: string;
    type: 'sent' | 'received';
    sender_id: string;
    sender_name: string | null;
    sender_display_id: string | null;
    receiver_id: string;
    receiver_name: string | null;
    receiver_display_id: string | null;
    amount: number;
    tax_amount: number;
    net_amount: number;
    remarks: string | null;
    created_at: string;
  }>;
}> {
  try {
    const response = await apiClient.get<{
      count: number;
      page: number;
      total: number;
      items: Array<{
        id: string;
        type: 'sent' | 'received';
        sender_id: string;
        sender_name: string | null;
        sender_display_id: string | null;
        receiver_id: string;
        receiver_name: string | null;
        receiver_display_id: string | null;
        amount: number;
        tax_amount: number;
        net_amount: number;
        remarks: string | null;
        created_at: string;
      }>;
    }>('/transfer/history', {
      params: params || {},
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get wallet history (wallet_transactions) for a user
 */
export interface WalletHistoryResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: Array<{
    id: string;
    amount: number;
    ledger_entry_id: string | null;
    commission_type: string | null;
    is_admin_ops: boolean;
    reason: string | null;
    created_at: string;
  }>;
}

export async function getWalletHistory(
  userId: string,
  params?: {
    page?: number;
    limit?: number;
    sort?: 'created_at' | 'amount';
    order?: 'asc' | 'desc';
    start_date?: string;
    end_date?: string;
    admin_ops_only?: boolean;
  },
): Promise<WalletHistoryResponse> {
  try {
    const response = await apiClient.get<WalletHistoryResponse>(`/users/${userId}/wallet/transactions`, {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 20,
        sort: params?.sort || 'created_at',
        order: params?.order || 'desc',
        ...(params?.start_date && { start_date: params.start_date }),
        ...(params?.end_date && { end_date: params.end_date }),
        ...(params?.admin_ops_only && { admin_ops_only: params.admin_ops_only }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

