// API utilities for Admin Purchase / Renewal Requests
// These map to MLM-API endpoints under /api/v1/admin/activation/requests
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

export type PurchaseRequestStatus = 'pending' | 'approved' | 'rejected';
export type PurchaseRequestType = 'activation' | 'renew' | 'reinvestment';

export interface PreviousPurchase {
  id: string;
  package_id: number;
  package_name: string;
  package_price: number;
  purchased_at: string;
  // active_until removed - expiry is ONLY based on 2x income
  amount: number;
  status: string;
  is_2x_reached: boolean;
}

export interface PurchaseRequestItem {
  id: string;
  user_id: string;
  user_display_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  package_id: number;
  previous_package_id: number | null; // For renewals: expired package's package_id
  package_name: string | null;
  package_price: number | null;
  request_type: PurchaseRequestType;
  amount: number;
  status: PurchaseRequestStatus;
  txn_id: string | null;
  payment_proof_url: string | null;
  payment_type: string | null;
  remarks: string | null;
  rejection_reason: string | null;
  processed_at: string | null;
  processed_by: string | null;
  previous_purchases: PreviousPurchase[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestListResponse {
  items: PurchaseRequestItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface GetPurchaseRequestsParams {
  status?: PurchaseRequestStatus;
  request_type?: PurchaseRequestType;
  user_id?: string;
  display_id?: string;
  name?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

export interface RevertPurchaseResponse {
  message: string;
  summary?: {
    affected_users_count: number;
    total_spot_amount: number;
    total_other_amount: number;
    total_amount: number;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError | null = null;
    let errorMessage = 'API request failed';
    
    try {
      const text = await response.text();
      if (text) {
        try {
          errorData = JSON.parse(text);
          // Prefer message over error field, as it's usually more descriptive
          if (errorData) {
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch {
          // If JSON parsing fails, use the text as error message
          errorMessage = text.trim() || errorMessage;
        }
      }
    } catch {
      // If we can't parse the response, use status text
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    // Only override with generic messages if we don't have a specific error from API
    const hasApiError = errorData && (errorData.message || errorData.error);
    if (!hasApiError) {
      if (response.status === 401) {
        errorMessage = 'Unauthorized. Please login again.';
      } else if (response.status === 404) {
        errorMessage = 'Resource not found.';
      } else if (response.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

// List purchase requests (used for renewal listing)
export async function getPurchaseRequests(
  params: GetPurchaseRequestsParams,
): Promise<PurchaseRequestListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const searchParams = new URLSearchParams();
  if (params.status) searchParams.append('status', params.status);
  if (params.request_type) searchParams.append('request_type', params.request_type);
  if (params.user_id) searchParams.append('user_id', params.user_id);
  if (params.display_id) searchParams.append('display_id', params.display_id);
  if (params.name) searchParams.append('name', params.name);
  if (params.from_date) searchParams.append('from_date', params.from_date);
  if (params.to_date) searchParams.append('to_date', params.to_date);
  if (params.page) searchParams.append('page', String(params.page));
  if (params.limit) searchParams.append('limit', String(params.limit));

  const qs = searchParams.toString();
  const url = `${API_BASE_URL}/activation/requests${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PurchaseRequestListResponse>(response);
}

// Approve purchase / renewal request
export async function approvePurchaseRequest(id: string): Promise<{ message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/activation/requests/${id}/approve`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}), // Send empty JSON object as body
  });

  return handleResponse<{ message: string }>(response);
}

// Reject purchase / renewal request
export async function rejectPurchaseRequest(
  id: string,
  rejectionReason: string,
): Promise<{ message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/activation/requests/${id}/reject`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rejection_reason: rejectionReason }),
  });

  return handleResponse<{ message: string }>(response);
}

// Get single purchase / renewal request details
export async function getPurchaseRequestDetails(id: string): Promise<PurchaseRequestItem> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/activation/requests/${id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PurchaseRequestItem>(response);
}

/**
 * Revert an already approved purchase request.
 *
 * NOTE: Backend implementation is expected to:
 * - Find the underlying purchase created from this request
 * - Reverse all related commissions / wallet entries
 * - Mark the request as rejected with the provided reason
 */
export async function revertApprovedPurchaseRequest(
  id: string,
  reason: string,
  force: boolean = false,
): Promise<RevertPurchaseResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // This endpoint will be implemented on the backend.
  // Shape is designed so that later we can easily plug in the API.
  const url = `${API_BASE_URL}/purchases/revert-from-request/${id}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reason,
      force,
    }),
  });

  return handleResponse<RevertPurchaseResponse>(response);
}


