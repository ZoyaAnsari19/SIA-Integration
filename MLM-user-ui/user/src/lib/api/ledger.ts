/**
 * Ledger/Income History API Service
 */

import { apiClient } from './client';
import type { LedgerEntry, PaginatedResponse } from './types';

/**
 * Income History Query Parameters
 */
export interface IncomeHistoryParams {
  page?: number;
  limit?: number;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
}

/**
 * Income History Response
 */
export interface IncomeHistoryResponse extends PaginatedResponse<LedgerEntry> {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  total_amount?: number; // Total sum of all commissions (all pages) - gross amount
  total_withdrawals?: number; // Total withdrawals from spot wallet
  net_amount?: number; // Net amount after withdrawals (total_amount - total_withdrawals)
  total_global_ids_used?: number; // Total global IDs used across all entries (for Global Help Income)
  items: LedgerEntry[];
}

/**
 * Get SELF commissions
 */
export async function getSelfIncome(params: IncomeHistoryParams = {}): Promise<IncomeHistoryResponse> {
  try {
    const response = await apiClient.get<IncomeHistoryResponse>('/income-history/self-income', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get SPOT commissions
 */
export async function getSpotIncome(params: IncomeHistoryParams = {}): Promise<IncomeHistoryResponse> {
  try {
    const response = await apiClient.get<IncomeHistoryResponse>('/income-history/spot-income', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get GLOBAL_HELPING commissions
 */
export async function getGlobalHelpIncome(params: IncomeHistoryParams = {}): Promise<IncomeHistoryResponse> {
  try {
    const response = await apiClient.get<IncomeHistoryResponse>('/income-history/global-help-income', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get MONTHLY commissions (Team Income)
 */
export async function getTeamIncome(params: IncomeHistoryParams = {}): Promise<IncomeHistoryResponse> {
  try {
    const response = await apiClient.get<IncomeHistoryResponse>('/income-history/team-income', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get direct referral monthly recurring commissions (MONTHLY with level=0)
 * These are recurring daily commissions from direct referrals
 */
export async function getDirectIncome(params: IncomeHistoryParams = {}): Promise<IncomeHistoryResponse> {
  try {
    const response = await apiClient.get<IncomeHistoryResponse>('/income-history/direct-income', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get complete ledger entries (all commission types)
 */
export async function getLedgerEntries(params: IncomeHistoryParams & {
  commission_type?: 'SELF' | 'SPOT' | 'GLOBAL_HELPING' | 'MONTHLY';
} = {}): Promise<IncomeHistoryResponse> {
  try {
    const response = await apiClient.get<IncomeHistoryResponse>('/payment-history/ledger', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.commission_type && { commission_type: params.commission_type }),
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Payment History Response
 */
export interface PaymentHistoryResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: Array<{
    id: string;
    transaction_id: string;
    utr: string;
    amount: number;
    payment_method: string;
    account_details: string;
    status: 'successful' | 'failed' | 'pending';
    payment_date: string;
    request_id: string | null;
    remarks: string | null;
  }>;
}

/**
 * Get payment history (purchase requests + purchases)
 */
export async function getPaymentHistory(params: {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  sort?: 'created_at' | 'amount';
  order?: 'asc' | 'desc';
} = {}): Promise<PaymentHistoryResponse> {
  try {
    const response = await apiClient.get<PaymentHistoryResponse>('/payment-history', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.start_date && { start_date: params.start_date }),
        ...(params.end_date && { end_date: params.end_date }),
        ...(params.sort && { sort: params.sort }),
        ...(params.order && { order: params.order }),
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

