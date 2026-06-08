// API utility for Withdraw management
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
export interface PendingWithdrawItem {
  id: string;
  user_id: string;
  user_display_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_pan_number: string | null;
  user_phone: string | null;
  user_bank_name?: string | null;
  user_bank_branch?: string | null;
  user_bank_ac_holder?: string | null;
  user_bank_account_no?: string | null;
  user_bank_ifsc?: string | null;
  user_bank_upi?: string | null;
  user_address?: string | null;
  user_city?: string | null;
  user_state?: string | null;
  user_pincode?: string | null;
  user_aadhar_number?: string | null;
  withdraw_type: string;
  amount: number;
  payment_method: string;
  account_details: string;
  status: string;
  remarks: string | null;
  created_at: string;
}

export interface PendingWithdrawResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: PendingWithdrawItem[];
}

export interface GetPendingWithdrawParams {
  page?: number;
  limit?: number;
  withdraw_type?: 'spot' | 'wallet' | 'team_royalty';
  user_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
}

export interface ApproveWithdrawRequest {
  remarks?: string;
}

export interface ApproveWithdrawResponse {
  message: string;
  id: string;
  status: string;
}

export interface RejectWithdrawRequest {
  rejection_reason: string;
  remarks?: string;
}

export interface RejectWithdrawResponse {
  message: string;
  id: string;
  status: string;
}

export interface WithdrawRequestItem {
  id: string;
  user_id: string;
  user_display_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_pan_number: string | null;
  user_phone: string | null;
  withdraw_type: string;
  amount: number;
  payment_method: string;
  account_details: string;
  status: string;
  remarks: string | null;
  processed_at: string | null;
  processed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at?: string;
}

export interface WithdrawRequestsResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: WithdrawRequestItem[];
}

export interface GetAllWithdrawalsParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'processing' | 'cancelled';
  user_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  withdraw_type?: 'wallet' | 'spot';
}

export interface GetWithdrawalHistoryParams {
  page?: number;
  limit?: number;
  status?: 'approved' | 'rejected';
  withdraw_type?: 'spot' | 'wallet';
  user_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
}

export interface WalletTransferItem {
  id: string;
  from_user_id: string;
  from_user_display_id: string | null;
  from_user_name: string | null;
  from_user_email: string | null;
  to_user_id: string;
  to_user_display_id: string | null;
  to_user_name: string | null;
  to_user_email: string | null;
  amount: number;
  tax_amount: number;
  net_amount: number;
  status: string;
  remarks: string | null;
  created_at: string;
}

export interface WalletTransfersResponse {
  items: WalletTransferItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface GetWalletTransfersParams {
  from_user_id?: string;
  to_user_id?: string;
  from_user_name?: string;
  to_user_name?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
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

// Get pending withdrawals - GET /api/v1/admin/withdraw/pending
export async function getPendingWithdrawals(params?: GetPendingWithdrawParams): Promise<PendingWithdrawResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.withdraw_type) queryParams.append('withdraw_type', params.withdraw_type);
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.name) queryParams.append('name', params.name);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/withdraw/pending${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PendingWithdrawResponse>(response);
}

// Approve withdrawal - POST /api/v1/admin/withdraw/requests/:id/approve
export async function approveWithdrawal(requestId: string, data?: ApproveWithdrawRequest): Promise<ApproveWithdrawResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/withdraw/requests/${requestId}/approve`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data || {}),
  });

  return handleResponse<ApproveWithdrawResponse>(response);
}

// Reject withdrawal - POST /api/v1/admin/withdraw/requests/:id/reject
export async function rejectWithdrawal(requestId: string, data: RejectWithdrawRequest): Promise<RejectWithdrawResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/withdraw/requests/${requestId}/reject`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<RejectWithdrawResponse>(response);
}

// Get all withdrawal requests with filters - GET /api/v1/admin/withdraw/requests
export async function getAllWithdrawals(params?: GetAllWithdrawalsParams): Promise<WithdrawRequestsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.name) queryParams.append('name', params.name);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.withdraw_type) queryParams.append('withdraw_type', params.withdraw_type);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/withdraw/requests${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<WithdrawRequestsResponse>(response);
}

// Get withdrawal request details - GET /api/v1/admin/withdraw/requests/:id
export async function getWithdrawalDetails(requestId: string): Promise<WithdrawRequestItem> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/withdraw/requests/${requestId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<WithdrawRequestItem>(response);
}

// Get withdrawal history - GET /api/v1/admin/withdraw/history
export async function getWithdrawalHistory(params?: GetWithdrawalHistoryParams): Promise<WithdrawRequestsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.withdraw_type) queryParams.append('withdraw_type', params.withdraw_type);
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.name) queryParams.append('name', params.name);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/withdraw/history${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<WithdrawRequestsResponse>(response);
}

// Get wallet transfers - GET /api/v1/admin/wallet/transfers
export async function getWalletTransfers(params?: GetWalletTransfersParams): Promise<WalletTransfersResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.from_user_id) queryParams.append('from_user_id', params.from_user_id);
  if (params?.from_user_name) queryParams.append('from_user_name', params.from_user_name);
  if (params?.to_user_id) queryParams.append('to_user_id', params.to_user_id);
  if (params?.to_user_name) queryParams.append('to_user_name', params.to_user_name);
  if (params?.from_date) queryParams.append('from_date', params.from_date);
  if (params?.to_date) queryParams.append('to_date', params.to_date);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/wallet/transfers${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const raw = await handleResponse<any>(response);

  console.log('🔍 Raw API Response for wallet transfers:', {
    itemsCount: raw.items?.length,
    firstItem: raw.items?.[0],
    hasDisplayIds: raw.items?.[0]?.from_user_display_id || raw.items?.[0]?.to_user_display_id,
  });

  // Map API response to WalletTransferItem format
  const items: WalletTransferItem[] = (raw.items || []).map((item: any) => ({
    id: item.id,
    from_user_id: item.from_user_id,
    from_user_name: item.from_user_name,
    from_user_email: item.from_user_email,
    from_user_display_id: item.from_user_display_id || null, // Map display_id from API
    to_user_id: item.to_user_id,
    to_user_name: item.to_user_name,
    to_user_email: item.to_user_email,
    to_user_display_id: item.to_user_display_id || null, // Map display_id from API
    amount: item.amount,
    tax_amount: item.tax_amount,
    net_amount: item.net_amount,
    status: item.status,
    remarks: item.remarks,
    created_at: item.created_at,
  }));

  return {
    items,
    pagination: raw.pagination,
  };
}

