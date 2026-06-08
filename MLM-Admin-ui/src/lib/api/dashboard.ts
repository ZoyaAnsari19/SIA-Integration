// API utility for Dashboard
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  if (envUrl.endsWith('/api/v1')) {
    return `${envUrl}/admin`;
  }
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

// API Response types - matching backend response
export interface DashboardResponse {
  total_system_amount: number;
  sms_wallet_balance: number;
  sms_left: number;
  total_users: number;
  activation_pending_count: number;
  // Additional fields that will be fetched from other endpoints
  package_activated?: number;
  total_deposit_from_all_users?: number;
  monthly_business?: number;
  monthly_new_purchase_manual?: number;
  monthly_upgrade?: number;
  monthly_renewal?: number;
  monthly_reinvestment?: number;
  total_self_income_given?: number;
  total_royalty_given?: number;
  total_spot?: number;
  total_withdrawal?: number;
  pending_withdrawal_amount?: number;
  total_main_wallet?: number;
  total_spot_wallet?: number;
  pending_kyc_count?: number;
  kyc_approved_today?: number;
  users_with_active_package?: number;
  users_with_no_active_package?: number;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    let errorMessage = errorData.error || errorData.message || 'API request failed';
    
    if (response.status === 401) {
      errorMessage = 'Unauthorized. Please login again.';
      // Redirect to login if unauthorized
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Get dashboard statistics - GET /api/v1/admin/dashboard
export async function getDashboard(params?: { start_date?: string; end_date?: string }): Promise<DashboardResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Build URL with query parameters if provided
  let url = `${API_BASE_URL}/dashboard`;
  if (params?.start_date || params?.end_date) {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    url += `?${queryParams.toString()}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const rawResponse = await handleResponse<any>(response);

  // Handle different response structures
  // New structure: {users: {...}, kyc: {...}, revenue: {...}, commissions: {...}, ...}
  // Old structure: {total_system_amount: ..., sms_wallet_balance: ..., ...}
  
  let dashboardData: {
    total_system_amount: number;
    sms_wallet_balance: number;
    sms_left: number;
    total_users: number;
    activation_pending_count: number;
  };
  
  // Try to extract activation_pending_count from any possible location in response
  let pendingActivation = 0;
  
  // Priority 1: Direct field (standard dashboard response)
  if (rawResponse.activation_pending_count !== undefined) {
    pendingActivation = Number(rawResponse.activation_pending_count) || 0;
  }
  // Priority 2: Check nested structures
  else if (rawResponse.purchases?.pending !== undefined) {
    pendingActivation = Number(rawResponse.purchases.pending) || 0;
  }
  else if (rawResponse.phases?.pending !== undefined) {
    pendingActivation = Number(rawResponse.phases.pending) || 0;
  }
  // Priority 3: Count from recent_activity array
  else if (rawResponse.recent_activity && Array.isArray(rawResponse.recent_activity)) {
    pendingActivation = rawResponse.recent_activity.filter((item: any) => 
      item.type === 'activation' && item.status === 'pending'
    ).length;
  }
  
  // Extract total_system_amount
  let totalSystemAmount = 0;
  if (rawResponse.total_system_amount !== undefined) {
    totalSystemAmount = Number(rawResponse.total_system_amount) || 0;
  } else if (rawResponse.commissions?.pending !== undefined) {
    totalSystemAmount = Number(rawResponse.commissions.pending) || 0;
  }
  
  dashboardData = {
    total_system_amount: totalSystemAmount,
    sms_wallet_balance: Number(rawResponse.sms_wallet_balance) || 0,
    sms_left: Number(rawResponse.sms_left) || 0,
    total_users: Number(rawResponse.total_users) || 0,
    activation_pending_count: pendingActivation,
  };

  // The dashboard API now returns all required fields directly
  // Extract the new fields from the response
  return {
    ...dashboardData,
    package_activated: Number(rawResponse.package_activated) || 0,
    total_deposit_from_all_users: Number(rawResponse.total_deposit_from_all_users) || 0,
    monthly_business: Number(rawResponse.monthly_business) || 0,
    monthly_new_purchase_manual: Number(rawResponse.monthly_new_purchase_manual) || 0,
    monthly_upgrade: Number(rawResponse.monthly_upgrade) || 0,
    monthly_renewal: Number(rawResponse.monthly_renewal) || 0,
    monthly_reinvestment: Number(rawResponse.monthly_reinvestment) || 0,
    total_self_income_given: Number(rawResponse.total_self_income_given) || 0,
    total_royalty_given: Number(rawResponse.total_royalty_given) || 0,
    total_spot: Number(rawResponse.total_spot) || 0,
    total_withdrawal: Number(rawResponse.total_withdrawal) || 0,
    pending_withdrawal_amount: Number(rawResponse.pending_withdrawal_amount) || 0,
    total_main_wallet: Number(rawResponse.total_main_wallet) || 0,
    total_spot_wallet: Number(rawResponse.total_spot_wallet) || 0,
    pending_kyc_count: Number(rawResponse.pending_kyc_count) || 0,
    kyc_approved_today: Number(rawResponse.kyc_approved_today) || 0,
  };
}

