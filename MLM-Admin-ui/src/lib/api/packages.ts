// API utility for Packages management
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
export interface Package {
  id: number;
  name: string;
  price: number;
  min_amount: number | null;
  max_amount: number | null;
  self_monthly: number | null;
  self_roi_percent: number | null;
  global_ids: number | null;
  global_monthly_per_id: number | null;
  recurring_rate_percent: number | null;
  direct_spot_percent: number | null;
  direct_monthly_royalty_percent: number | null;
  validity_months: number;
  validity_days: number | null;
  status: 'active' | 'inactive';
  course_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PackagesListResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: Package[];
}

export interface GetPackagesParams {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive';
  search?: string;
  sort?: 'id' | 'name' | 'price' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

export interface CreatePackageRequest {
  name: string;
  price: number;
  min_amount?: number | null;
  max_amount?: number | null;
  self_monthly?: number | null;
  self_roi_percent?: number | null;
  global_ids?: number | null;
  global_monthly_per_id?: number | null;
  recurring_rate_percent?: number | null;
  direct_spot_percent?: number | null;
  direct_monthly_royalty_percent?: number | null;
  validity_months?: number;
  validity_days?: number | null;
  status?: 'active' | 'inactive';
  course_id?: number | null;
}

export interface UpdatePackageRequest {
  name?: string;
  price?: number;
  min_amount?: number | null;
  max_amount?: number | null;
  self_monthly?: number | null;
  self_roi_percent?: number | null;
  global_ids?: number | null;
  global_monthly_per_id?: number | null;
  recurring_rate_percent?: number | null;
  direct_spot_percent?: number | null;
  direct_monthly_royalty_percent?: number | null;
  validity_months?: number;
  validity_days?: number | null;
  status?: 'active' | 'inactive';
  course_id?: number | null;
}

export interface DeletePackageResponse {
  message: string;
  id: number;
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

// Get all packages - GET /api/v1/admin/packages
export async function getPackages(params?: GetPackagesParams): Promise<PackagesListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.order) queryParams.append('order', params.order);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/packages${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PackagesListResponse>(response);
}

// Get single package by ID - GET /api/v1/admin/packages/:id
export async function getPackageById(packageId: number): Promise<Package> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/packages/${packageId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<Package>(response);
}

// Create package - POST /api/v1/admin/packages
export async function createPackage(data: CreatePackageRequest): Promise<Package> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/packages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Package>(response);
}

// Update package - PUT /api/v1/admin/packages/:id
export async function updatePackage(packageId: number, data: UpdatePackageRequest): Promise<Package> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/packages/${packageId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Package>(response);
}

// Delete package - DELETE /api/v1/admin/packages/:id
export async function deletePackage(packageId: number): Promise<DeletePackageResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/packages/${packageId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<DeletePackageResponse>(response);
}

// Assign package to user - POST /api/v1/admin/users/:userId/assign-package
export interface AssignPackageRequest {
  package_id: number;
  used_ids?: number;
  income?: number;
}

export interface AssignPackageResponse {
  success: boolean;
  message: string;
  purchase_id: string;
}

export async function assignPackageToUser(
  userId: string,
  data: AssignPackageRequest
): Promise<AssignPackageResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // Use base URL without /admin suffix since we need /admin/users/:id/assign-package
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const url = `${baseUrl}/admin/users/${userId}/assign-package`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to assign package' }));
    throw new Error(error.message || error.error || 'Failed to assign package');
  }

  return handleResponse<AssignPackageResponse>(response);
}

// Get admin-assigned packages - GET /api/v1/admin/purchases/admin-assigned
export interface AdminAssignedPackage {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_display_id: string | null;
  package_id: number;
  package_name: string;
  amount: number;
  income: number;
  status: string;
  purchased_at: string;
  is_manual: boolean;
  payment_type: string | null;
  effective_global_ids: number | null;
  txn_id: string | null;
  is_renewal: boolean;
  previous_package_id: number | null;
  assigned_by: {
    id: string;
    name: string | null;
    email: string | null;
    display_id: string | null;
  } | null;
}

export interface AdminAssignedPackagesResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: AdminAssignedPackage[];
}

export interface AdminAssignedPackagesQuery {
  page?: number;
  limit?: number;
  user_id?: string;
  admin_user_id?: string;
  package_id?: number;
  start_date?: string;
  end_date?: string;
}

export async function getAdminAssignedPackages(
  query?: AdminAssignedPackagesQuery
): Promise<AdminAssignedPackagesResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const params = new URLSearchParams();
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.user_id) params.append('user_id', query.user_id);
  if (query?.admin_user_id) params.append('admin_user_id', query.admin_user_id);
  if (query?.package_id) params.append('package_id', query.package_id.toString());
  if (query?.start_date) params.append('start_date', query.start_date);
  if (query?.end_date) params.append('end_date', query.end_date);

  const url = `${API_BASE_URL}/purchases/admin-assigned${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<AdminAssignedPackagesResponse>(response);
}
