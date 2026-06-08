// API utility for Commissions management
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
export type CommissionType = 'SELF' | 'SPOT' | 'MONTHLY' | 'GLOBAL_HELPING';

// Base commission fields (common to all types)
export interface BaseCommission {
  id: string;
  user_id: string;
  user_name: string | null;
  commission_type: CommissionType;
  income_amount: number;
  created_at: string;
}

// SELF Commission
export interface SelfCommission extends BaseCommission {
  commission_type: 'SELF';
  package_id: number | null;
  package_name: string | null;
  activation_req_id: string | null;
}

// SPOT Commission
export interface SpotCommission extends BaseCommission {
  commission_type: 'SPOT';
  income_lvl: number;
  from_id: string | null;
  from_name: string | null;
  investment_amt: number | null;
  investment_type: 'activation' | 'reinvestment' | null;
  spot_added: boolean;
  activation_req_id: string | null;
}

// MONTHLY Commission
export interface MonthlyCommission extends BaseCommission {
  commission_type: 'MONTHLY';
  members: string | null; // Source user ID
  activation_req_id: string | null;
}

// GLOBAL_HELPING Commission
export interface GlobalHelpingCommission extends BaseCommission {
  commission_type: 'GLOBAL_HELPING';
  direct: boolean;
  package_id: number | null;
  package_name: string | null;
  members: string | null; // Source user ID
}

// Union type for all commission types
export type Commission = SelfCommission | SpotCommission | MonthlyCommission | GlobalHelpingCommission;

export interface CommissionsListResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: Commission[];
}

export interface GetCommissionsParams {
  page?: number;
  limit?: number;
  user_id?: string;
  commission_type?: CommissionType;
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
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

// Get all commissions - GET /api/v1/admin/commissions
export async function getCommissions(params?: GetCommissionsParams): Promise<CommissionsListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Build query string
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.commission_type) queryParams.append('commission_type', params.commission_type);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/commissions${queryString ? `?${queryString}` : ''}`;

  console.log('🔍 Fetching commissions:');
  console.log('  - API_BASE_URL:', API_BASE_URL);
  console.log('  - Full URL:', url);
  console.log('  - Params:', params);
  console.log('  - Token present:', !!token);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('📡 API Response Status:', response.status, response.statusText);
  
  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      
      // Try to parse as JSON for better error message
      try {
        const errorJson = JSON.parse(errorText);
        console.error('❌ Parsed Error:', errorJson);
      } catch {
        // Not JSON, use text as is
      }
    } catch (e) {
      console.error('❌ Could not read error response');
    }
    
    // For 404, provide helpful message
    if (response.status === 404) {
      console.error('💡 404 Error - Possible causes:');
      console.error('  1. API server needs restart');
      console.error('  2. Route not registered properly');
      console.error('  3. Check Swagger UI: http://localhost:3000/docs');
      console.error('  4. Expected endpoint: GET /api/v1/admin/commissions');
    }
  }

  return handleResponse<CommissionsListResponse>(response);
}

// Get user-specific commissions - GET /api/v1/admin/users/:id/commissions
export async function getUserCommissions(
  userId: string,
  params?: Omit<GetCommissionsParams, 'user_id'>
): Promise<CommissionsListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Build query string
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.commission_type) queryParams.append('commission_type', params.commission_type);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/users/${userId}/commissions${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<CommissionsListResponse>(response);
}

