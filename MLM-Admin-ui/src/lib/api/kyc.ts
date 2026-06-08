// API utility for KYC management
// Base URL - can be configured via environment variable
// Ensure it always ends with /admin for admin routes
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  // Ensure /admin is included for admin routes
  return envUrl.includes('/admin') ? envUrl : `${envUrl}/admin`;
};
const API_BASE_URL = getBaseUrl();

// API Response types
export interface KYCDocument {
  id: string;
  document_type: string;
  document_number: string | null;
  front_image_url: string | null;
  back_image_url: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  verified_at: string | null;
  verified_by: string | null;
}

export interface UserDocumentsResponse {
  user: {
    user_id: string;
    name: string | null;
    email: string | null;
    kyc_status: string;
  };
  documents: KYCDocument[];
}

export interface ApproveKYCResponse {
  success: boolean;
  message: string;
  user_id: string;
}

export interface RejectKYCRequest {
  reason: string;
}

export interface RejectKYCResponse {
  success: boolean;
  message: string;
  user_id: string;
  reason: string | null;
}

export interface UpdateKYCStatusRequest {
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  rejection_reason?: string;
}

export interface UpdateKYCStatusResponse {
  user_id: string;
  kyc_status: string;
  kyc_verified_at: string | null;
  updated_at: string;
}

export interface UserProfile {
  phone: string | null;
  account_holder: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  pan_number: string | null;
  aadhar_number: string | null;
}

export interface ProfileItem {
  user_id: string;
  display_id: string | null;
  name: string | null;
  email: string | null;
  kyc_status: string;
  kyc_verified_at: string | null;
  created_at: string;
  submitted_at: string | null;
  profile: UserProfile | null;
}

export interface GetAllProfilesResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: ProfileItem[];
}

export interface GetAllProfilesParams {
  page?: number;
  limit?: number;
  user_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
}

export interface PendingKYCItem {
  user_id: string;
  name: string | null;
  email: string | null;
  kyc_status: string;
  submitted_at: string;
}

/** Response from GET /admin/kyc/pending - items match ProfileItem shape (with profile, display_id, etc.) */
export interface PendingKYCResponse {
  count: number;
  items: ProfileItem[];
}

/** Response from GET /admin/kyc/counts - stable counts for tab badges (no pagination fluctuation) */
export interface KYCCountsResponse {
  pending: number;
  approved: number;
  rejected: number;
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
    
    if (errorData.error === 'User not found') {
      errorMessage = 'User not found. Please check the user ID.';
    } else if (errorData.error === 'Invalid KYC status') {
      errorMessage = errorData.message || 'Invalid KYC status for this operation.';
    } else if (errorData.error === 'unauthorized' || response.status === 401) {
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

// Get user documents - GET /api/v1/admin/kyc/:user_id/documents
export async function getUserDocuments(userId: string): Promise<UserDocumentsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/kyc/${userId}/documents`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<UserDocumentsResponse>(response);
}

// Approve KYC - POST /api/v1/admin/kyc/:user_id/approve
export async function approveKYC(userId: string): Promise<ApproveKYCResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/kyc/${userId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  return handleResponse<ApproveKYCResponse>(response);
}

// Reject KYC - POST /api/v1/admin/kyc/:user_id/reject
export async function rejectKYC(userId: string, reason: string): Promise<RejectKYCResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/kyc/${userId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  return handleResponse<RejectKYCResponse>(response);
}

// Get all profiles - GET /api/v1/admin/profiles
export async function getAllProfiles(params?: GetAllProfilesParams): Promise<GetAllProfilesResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Build query string
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.name) queryParams.append('name', params.name);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/profiles${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<GetAllProfilesResponse>(response);
}

// Get pending KYC submissions - GET /api/v1/admin/kyc/pending
export async function getPendingKYCs(): Promise<PendingKYCResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/kyc/pending`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PendingKYCResponse>(response);
}

// Get KYC counts - GET /api/v1/admin/kyc/counts (stable counts for tab badges)
export async function getKYCCounts(): Promise<KYCCountsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }
  const response = await fetch(`${API_BASE_URL}/kyc/counts`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<KYCCountsResponse>(response);
}

// Update KYC status - PUT /api/v1/admin/kyc/:user_id/update
export async function updateKYCStatus(userId: string, data: UpdateKYCStatusRequest): Promise<UpdateKYCStatusResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/kyc/${userId}/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<UpdateKYCStatusResponse>(response);
}

