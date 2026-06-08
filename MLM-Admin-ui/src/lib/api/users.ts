// API utility for Users management
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
export interface User {
  id: string;
  display_id: string | null;
  name: string | null;
  display_title?: string | null;
  display_title_icon_url?: string | null;
  email: string | null;
  password: string | null; // Plain text password for admin view
  transaction_pin: string | null; // Transaction PIN for admin view
  phone: string | null;
  total_investment: number;
  active_investment?: number;
  total_active_packages: number;
  kyc_status: string;
  status: string;
  referrer_user_id: string | null;
  referrer_display_id: string | null;
  wallet_balance: number; // Total balance (for backward compatibility)
  other_balance?: number; // Main Wallet (other_balance)
  spot_balance?: number; // Spot Wallet
  team_royalty_balance?: number; // Team Royalty Wallet
  direct_referrals: number;
  total_team_size: number;
  total_purchases: number;
  total_business_volume?: number;
  latest_package_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsersListResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: User[];
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  id?: string;
  user_id?: string;
  name?: string;
  display_id?: string;
  referrer_user_id?: string;
  start_date?: string;
  end_date?: string;
  package_id?: number;
  has_active_package?: 'true' | 'false';
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
  status?: 'active' | 'inactive';
  sort?: 'created_at' | 'name' | 'email' | 'updated_at' | 'direct_referrals' | 'total_business_volume';
  order?: 'asc' | 'desc';
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

// Get all users - GET /api/v1/admin/users
export async function getUsers(params?: GetUsersParams): Promise<UsersListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Build query string
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.id) queryParams.append('id', params.id);
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.name) queryParams.append('name', params.name);
  if (params?.display_id) queryParams.append('display_id', params.display_id);
  if (params?.referrer_user_id) queryParams.append('referrer_user_id', params.referrer_user_id);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.package_id != null) queryParams.append('package_id', params.package_id.toString());
  if (params?.has_active_package) queryParams.append('has_active_package', params.has_active_package);
  if (params?.kyc_status) queryParams.append('kyc_status', params.kyc_status);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.order) queryParams.append('order', params.order);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/users${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<UsersListResponse>(response);
}

// Get single user by ID - GET /api/v1/admin/users/:id
export interface UserDetails {
  id: string;
  display_id: string | null;
  name: string | null;
  display_title?: string | null;
  display_title_icon_url?: string | null;
  email: string | null;
  password?: string | null; // Plain text password for admin view
  transaction_pin?: string | null; // Transaction PIN for admin view
  phone: string | null;
  total_investment: number;
  active_investment?: number;
  total_active_packages: number;
  kyc_status: string;
  status: string;
  referrer_user_id: string | null;
  referrer_display_id: string | null;
  wallet_balance: number;
  direct_referrals: number;
  total_team_size: number;
  total_purchases: number;
  created_at: string;
  updated_at: string;
  referrer_name?: string | null;
  total_commissions?: number;
  total_business_volume?: number;
  is_active?: boolean;
  latest_package_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  date_of_birth?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  pan_number?: string | null;
  aadhar_number?: string | null;
  profile_photo_url?: string | null;
  withdrawal_blocked?: boolean;
}

export async function getUserById(userId: string): Promise<UserDetails> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<UserDetails>(response);
}

// Get user eligibility and levels - GET /api/v1/admin/users/:id/eligibility
export interface LevelEligibility {
  level: number;
  title: string;
  description: string | null;
  reward: string | null;
  spot_commission_percent: number | null;
  monthly_royalty_percent: number | null;
  business_requirement: any | null;
  eligible: boolean;
  icon_url: string | null;
  color: string | null;
}

export interface UserEligibilityResponse {
  user_id: string;
  user_name: string | null;
  eligibility: LevelEligibility[];
}

export async function getUserEligibility(userId: string): Promise<UserEligibilityResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/users/${userId}/eligibility`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<UserEligibilityResponse>(response);
}

// Get team business volume with date filters - GET /api/v1/admin/users/:id/team-business
export interface TeamBusinessVolumeParams {
  start_date?: string;
  end_date?: string;
}

export interface TeamBusinessVolumeResponse {
  user_id: string;
  direct_business: number;
  team_business: number;
  total_business_volume: number;
}

export async function getTeamBusinessVolume(
  userId: string,
  params?: TeamBusinessVolumeParams
): Promise<TeamBusinessVolumeResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/users/${userId}/team-business${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<TeamBusinessVolumeResponse>(response);
}

// Get business volume with legs breakdown and date filters - GET /api/v1/admin/users/:id/business-volume
export interface BusinessVolumeLeg {
  leg_user_id: string;
  leg_user_name: string | null;
  leg_user_display_id?: string | null;
  leg_business_volume: number;
  direct_business: number;
  team_business: number;
}

export interface PurchaseDetail {
  id: string;
  amount: number;
  purchased_at: string;
}

export interface BusinessVolumeResponse {
  user_id: string;
  direct_business: number;
  team_business: number;
  total_business_volume: number;
  legs: BusinessVolumeLeg[];
  purchase_details?: PurchaseDetail[];
}

export async function getBusinessVolumeWithLegs(
  userId: string,
  params?: TeamBusinessVolumeParams
): Promise<BusinessVolumeResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/users/${userId}/business-volume${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<BusinessVolumeResponse>(response);
}

// Update user - PUT /api/v1/admin/users/:id
export interface UpdateUserRequest {
  name?: string;
  display_title?: string | null;
  display_title_icon_url?: string | null;
  email?: string;
  phone?: string | null;
  referrer_user_id?: string | null;
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
  transaction_pin?: string;
  withdrawal_blocked?: boolean;
}

export interface UpdateUserResponse {
  id: string;
  name: string | null;
  display_title: string | null;
  display_title_icon_url: string | null;
  email: string | null;
  kyc_status: string;
  status: string;
  referrer_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Upload display title icon (PNG) for a user. Returns new icon URL. */
export async function uploadDisplayTitleIcon(userId: string, file: File): Promise<{ display_title_icon_url: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/users/${userId}/display-title-icon`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse<{ display_title_icon_url: string }>(response);
}

export async function updateUser(userId: string, data: UpdateUserRequest): Promise<UpdateUserResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/users/${userId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<UpdateUserResponse>(response);
}

// Delete/Deactivate user - DELETE /api/v1/admin/users/:id
export interface DeleteUserResponse {
  message: string;
  id: string;
  status: string;
}

export async function deleteUser(userId: string): Promise<DeleteUserResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/users/${userId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<DeleteUserResponse>(response);
}

// Activate user - POST /api/v1/admin/users/:id/activate
export interface ActivateUserResponse {
  message: string;
  id: string;
  status: string;
}

export async function activateUser(userId: string): Promise<ActivateUserResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/users/${userId}/activate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  return handleResponse<ActivateUserResponse>(response);
}

// Deactivate user - POST /api/v1/admin/users/:id/deactivate
export interface DeactivateUserResponse {
  message: string;
  id: string;
  status: string;
}

export async function deactivateUser(userId: string): Promise<DeactivateUserResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/users/${userId}/deactivate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  return handleResponse<DeactivateUserResponse>(response);
}

// Get user active courses/packages - GET /api/v1/users/:id/purchases?status=active
export interface GlobalIdsInfo {
  package_cap: number;
  used_ids: number;
  remaining_ids: number;
  is_cap_reached: boolean;
  new_ids_after_cap: number | null;
  cap_exceed_loss: number | null;
  total_global_users: number;
  contributors_raw_in_window?: number;
  contributors_active_in_window?: number;
  inactive_global_contributors?: number;
}

export interface UserPurchase {
  id: string;
  package_id: number;
  package_name: string | null;
  amount: number;
  income: number;
  purchased_at: string;
  // active_until removed - expiry is ONLY based on 2x income
  status: string;
  is_active: boolean;
  is_renewal: boolean;
  previous_package_id: number | null;
  global_ids_info?: GlobalIdsInfo | null;
}

export interface UserPurchasesResponse {
  count: number;
  items: UserPurchase[];
}

export async function getUserActiveCourses(userId: string): Promise<UserPurchasesResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Use admin purchases endpoint with user_id filter
  // Fetch all pages to get all purchases, then filter for active ones
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const limit = 100;
  let page = 1;
  let allItems: any[] = [];
  let totalPages = 1;

  try {
    // Fetch all pages
    do {
      const url = `${baseUrl}/admin/purchases/by-user?user_id=${userId}&page=${page}&limit=${limit}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await handleResponse<{ count: number; items: any[]; total?: number; total_pages?: number }>(response);
      
      allItems = [...allItems, ...(data.items || [])];
      totalPages = data.total_pages || 1;
      page++;
    } while (page <= totalPages);

    // Filter for active purchases (use is_active from API which is based on 2x check)
    const activeItems = allItems.filter(item => {
      // API now returns is_active based on 2x check, so use that
      return item.is_active === true && item.status === 'completed';
    });

    return {
      count: activeItems.length,
      items: activeItems.map(item => ({
        id: item.id,
        package_id: item.package_id,
        package_name: item.package_name,
        amount: item.amount,
        income: item.income || 0,
        purchased_at: item.purchased_at,
        // active_until removed - expiry is ONLY based on 2x income
        status: item.status,
        is_active: true,
        is_renewal: item.is_renewal || false,
        previous_package_id: item.previous_package_id || null,
        global_ids_info: item.global_ids_info || null,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching user active courses:', error);
    throw error;
  }
}

// Manual Credit Wallet - POST /api/v1/admin/commissions/manual-credit
export interface ManualCreditRequest {
  user_id: string;
  amount: number;
  commission_type: 'SELF' | 'GLOBAL_HELPING' | 'SPOT' | 'MONTHLY';
  source_user_id?: string | null;
  purchase_id?: string | null;
  reason?: string | null;
}

export interface ManualCreditResponse {
  success: boolean;
  message: string;
  ledger_entry_id: string;
  wallet_transaction_id: string | null;
  new_balance: number;
}

export async function manualCreditWallet(data: ManualCreditRequest): Promise<ManualCreditResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Use /admin/commissions/manual-credit endpoint
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const url = `${baseUrl}/admin/commissions/manual-credit`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<ManualCreditResponse>(response);
}

// Manual Debit Wallet - POST /api/v1/admin/commissions/manual-debit
export interface ManualDebitRequest {
  user_id: string;
  amount: number;
  reason?: string | null;
}

export interface ManualDebitResponse {
  success: boolean;
  message: string;
  ledger_entry_id: string;
  wallet_transaction_id: string;
  new_balance: number;
}

export async function manualDebitWallet(data: ManualDebitRequest): Promise<ManualDebitResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Use /admin/commissions/manual-debit endpoint
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const url = `${baseUrl}/admin/commissions/manual-debit`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<ManualDebitResponse>(response);
}

// Manage Wallet - POST /api/v1/admin/commissions/wallet/manage
export interface ManageWalletRequest {
  user_id: string;
  main_wallet_amount: number;
  spot_wallet_amount: number;
  team_royalty_wallet_amount?: number;
  reason?: string | null;
}

export interface ManageWalletResponse {
  success: boolean;
  message: string;
  ledger_entry_ids: string[];
  new_main_balance: number;
  new_spot_balance: number;
  new_team_royalty_balance?: number;
}

export async function manageWallet(data: ManageWalletRequest): Promise<ManageWalletResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Use /admin/wallet/manage endpoint
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const url = `${baseUrl}/admin/wallet/manage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<ManageWalletResponse>(response);
}
