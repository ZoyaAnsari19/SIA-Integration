// API utility for Ledger Logs management
// Base URL - can be configured via environment variable
// Ensure admin endpoints always use /admin path
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  // If URL doesn't end with /admin, append it
  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  // If URL ends with /api/v1, append /admin
  if (envUrl.endsWith('/api/v1')) {
    return `${envUrl}/admin`;
  }
  // Otherwise, append /admin
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

// API Response types
export type LedgerCommissionType = 'SELF' | 'SPOT' | 'MONTHLY' | 'GLOBAL_HELPING' | 'FEE_DEDUCTION' | 'ADMIN_OPS';

export interface LedgerEntryItem {
  id: string;
  receiver_user_id: string;
  receiver_display_id: string | null;
  receiver_name: string | null;
  source_user_id: string;
  source_display_id: string | null;
  source_name: string | null;
  commission_type: LedgerCommissionType;
  amount: number;
  credited_at: string;
  settled: boolean;
  purchase_id?: string | null; // Will be added by backend
  metadata?: any; // Will be added by backend
}

export interface LedgerEntriesResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: LedgerEntryItem[];
}

export interface GetLedgerEntriesParams {
  page?: number;
  limit?: number;
  user_id?: string;
  name?: string;
  commission_type?: LedgerCommissionType;
  transfer_type?: string; // For P2P Transfer filter
  withdrawal_filter?: string; // For Withdrawal filter
  start_date?: string; // Date range filter - start date (YYYY-MM-DD)
  end_date?: string; // Date range filter - end date (YYYY-MM-DD)
}

// API Error type
export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      // If response is not JSON, use status text
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    // Map API error codes to user-friendly messages
    let errorMessage = errorData.error || errorData.message || 'API request failed';
    
    if (response.status === 401) {
      errorMessage = 'Unauthorized. Please login again.';
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Get ledger entries (audit log) - GET /api/v1/admin/audit-log
export async function getLedgerEntries(params?: GetLedgerEntriesParams): Promise<LedgerEntriesResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.name) queryParams.append('name', params.name);
  if (params?.commission_type) queryParams.append('commission_type', params.commission_type);
  if (params?.transfer_type) queryParams.append('transfer_type', params.transfer_type);
  if (params?.withdrawal_filter) queryParams.append('withdrawal_filter', params.withdrawal_filter);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/audit-log${queryString ? `?${queryString}` : ''}`;

  console.log('[Ledger API] Fetching ledger entries from:', url);
  console.log('[Ledger API] Params:', params);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('[Ledger API] Response status:', response.status, response.statusText);

  return handleResponse<LedgerEntriesResponse>(response);
}

// Commission breakdown response type
export interface CommissionBreakdownItem {
  commission_type: LedgerCommissionType;
  total_amount: number;
  count: number;
  percentage: number;
}

export interface CommissionBreakdownResponse {
  total_commissions: number;
  by_type: CommissionBreakdownItem[];
}

// Get commission breakdown - GET /api/v1/admin/reports/commission-breakdown
export async function getCommissionBreakdown(): Promise<CommissionBreakdownResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/reports/commission-breakdown`;

  console.log('[Ledger API] Fetching commission breakdown from:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('[Ledger API] Commission breakdown response status:', response.status, response.statusText);

  return handleResponse<CommissionBreakdownResponse>(response);
}

