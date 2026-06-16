// API utility for Fee Rules management
// Base URL - can be configured via environment variable
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  // Ensure /admin is included for admin routes
  return envUrl.includes('/admin') ? envUrl : `${envUrl}/admin`;
};
const API_BASE_URL = getBaseUrl();

// API Response types
export interface FeeRule {
  id: number;
  rule_code: string;
  rule_name: string;
  description?: string | null;
  amount: number;
  is_active: boolean;
  applies_to: string;
  created_at: string;
  updated_at: string;
}

export interface FeeRulesListResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: FeeRule[];
}

export interface CreateFeeRuleRequest {
  rule_code: string;
  rule_name: string;
  description?: string;
  amount: number;
  is_active?: boolean;
  applies_to?: string;
}

export interface UpdateFeeRuleRequest {
  rule_name?: string;
  description?: string;
  amount?: number;
  is_active?: boolean;
  applies_to?: string;
}

export interface FeeTransaction {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  rule_code: string;
  amount: number;
  transaction_type: string;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

export interface FeeTransactionsResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: FeeTransaction[];
}

export interface GetFeeTransactionsParams {
  page?: number;
  limit?: number;
  user_id?: string;
  rule_code?: string;
  start_date?: string;
  end_date?: string;
}

export interface GetUserFeeTransactionsParams {
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
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    let errorMessage = errorData.error || errorData.message || 'API request failed';
    
    if (errorData.error === 'unauthorized' || response.status === 401) {
      errorMessage = 'Unauthorized. Please login again.';
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (response.status === 0 || response.status >= 500) {
      errorMessage = 'Unable to connect to server. Please check if the API server is running.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Get all fee rules with pagination and filters
export async function getFeeRules(params?: {
  page?: number;
  limit?: number;
  is_active?: boolean;
}): Promise<FeeRulesListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());

  const url = `${API_BASE_URL}/fees/rules${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<FeeRulesListResponse>(response);
}

// Get a single fee rule by ID
export async function getFeeRuleById(id: number): Promise<FeeRule> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/fees/rules/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<FeeRule>(response);
}

// Create a new fee rule
export async function createFeeRule(data: CreateFeeRuleRequest): Promise<FeeRule> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/fees/rules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      rule_code: data.rule_code,
      rule_name: data.rule_name,
      description: data.description,
      amount: data.amount,
      is_active: data.is_active ?? true,
      applies_to: data.applies_to ?? 'all_users',
    }),
  });

  return handleResponse<FeeRule>(response);
}

// Update an existing fee rule
export async function updateFeeRule(id: number, data: UpdateFeeRuleRequest): Promise<FeeRule> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/fees/rules/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<FeeRule>(response);
}

// Delete a fee rule
export async function deleteFeeRule(id: number): Promise<{ message: string; id: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/fees/rules/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string; id: number }>(response);
}

// Get all fee transactions - GET /api/v1/admin/fees/transactions
export async function getFeeTransactions(params?: GetFeeTransactionsParams): Promise<FeeTransactionsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.rule_code) queryParams.append('rule_code', params.rule_code);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/fees/transactions${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<FeeTransactionsResponse>(response);
}

// Get user's fee transactions - GET /api/v1/admin/fees/transactions/:userId
export async function getUserFeeTransactions(userId: string, params?: GetUserFeeTransactionsParams): Promise<FeeTransactionsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/fees/transactions/${userId}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<FeeTransactionsResponse>(response);
}

