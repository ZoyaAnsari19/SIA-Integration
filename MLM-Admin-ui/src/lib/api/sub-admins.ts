// API utility for Sub-Admin management
// For now, using mock data to show UI structure
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

// Types
export type AdminRole = 'SUPER_ADMIN' | 'SUB_ADMIN';

// Permission keys - dynamically fetched from API, but we list known ones for type safety
export type PermissionKey =
  | 'USERS_VIEW'
  | 'USERS_EDIT'
  | 'KYC_VIEW'
  | 'KYC_APPROVE'
  | 'WITHDRAW_VIEW'
  | 'WITHDRAW_APPROVE'
  | 'WITHDRAW_RULES_MANAGE'
  | 'PACKAGE_VIEW'
  | 'PACKAGE_MANAGE'
  | 'PACKAGE_ASSIGN'
  | 'DISPLAY_TITLE_MANAGE'
  | 'WALLET_MANAGE'
  | 'INCOME_REPORT_VIEW'
  | 'LEDGER_VIEW'
  | 'NOTICE_MANAGE'
  | 'ADMIN_MANAGE'
  | 'FEE_RULES_MANAGE'
  | 'COMPANY_BANK_MANAGE'
  | 'P2P_VIEW'
  | 'P2P_MANAGE'
  | 'TRANSACTION_RULES_MANAGE'
  | 'LEVELS_VIEW'
  | 'LEVELS_MANAGE'
  | 'COURSE_VIEW'
  | 'COURSE_MANAGE'
  | 'ACTIVATION_REQUEST_VIEW'
  | 'ACTIVATION_REQUEST_APPROVE'
  | 'WEBSITE_SETTINGS_MANAGE'
  | 'TICKET_VIEW'
  | 'TICKET_MANAGE'
  | 'ECOSYSTEM_VIEW';

export interface Permission {
  key: PermissionKey;
  label: string;
  group: string;
}

export interface SubAdmin {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: AdminRole;
  status: 'active' | 'inactive';
  password: string | null;
  action_pin: string | null; // Action PIN for critical actions
  permissions: PermissionKey[];
  created_at: string;
  updated_at: string;
}

export interface SubAdminsListResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: SubAdmin[];
}

export interface CreateSubAdminRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
  permissions?: PermissionKey[];
}

export interface UpdateSubAdminRequest {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  permissions?: PermissionKey[];
  status?: 'active' | 'inactive';
}

// Permission groups will be fetched from API, but we keep this as fallback
export const PERMISSION_GROUPS = [
  {
    group: 'Users & KYC',
    permissions: [
      { key: 'USERS_VIEW' as PermissionKey, label: 'View Users' },
      { key: 'USERS_EDIT' as PermissionKey, label: 'Edit Users' },
      { key: 'KYC_VIEW' as PermissionKey, label: 'View KYC' },
      { key: 'KYC_APPROVE' as PermissionKey, label: 'Approve/Reject KYC' },
      { key: 'WALLET_MANAGE' as PermissionKey, label: 'Manage User Wallets' },
      { key: 'DISPLAY_TITLE_MANAGE' as PermissionKey, label: 'Manage Display Title' },
    ],
  },
  {
    group: 'Withdrawals',
    permissions: [
      { key: 'WITHDRAW_VIEW' as PermissionKey, label: 'View Withdrawals' },
      { key: 'WITHDRAW_APPROVE' as PermissionKey, label: 'Approve/Reject Withdrawals' },
      { key: 'WITHDRAW_RULES_MANAGE' as PermissionKey, label: 'Manage Withdrawal Rules' },
    ],
  },
  {
    group: 'Packages',
    permissions: [
      { key: 'PACKAGE_VIEW' as PermissionKey, label: 'View Packages' },
      { key: 'PACKAGE_MANAGE' as PermissionKey, label: 'Manage Packages' },
      { key: 'PACKAGE_ASSIGN' as PermissionKey, label: 'Assign Packages to Users' },
    ],
  },
  {
    group: 'Dashboard',
    permissions: [
      { key: 'ECOSYSTEM_VIEW' as PermissionKey, label: 'View Ecosystem Cards' },
    ],
  },
  {
    group: 'Reports',
    permissions: [
      { key: 'INCOME_REPORT_VIEW' as PermissionKey, label: 'View Income Reports' },
      { key: 'LEDGER_VIEW' as PermissionKey, label: 'View Ledger Logs' },
    ],
  },
  {
    group: 'Settings',
    permissions: [
      { key: 'NOTICE_MANAGE' as PermissionKey, label: 'Manage Notices' },
      { key: 'ADMIN_MANAGE' as PermissionKey, label: 'Manage Admins' },
      { key: 'FEE_RULES_MANAGE' as PermissionKey, label: 'Manage Fee Rules' },
      { key: 'COMPANY_BANK_MANAGE' as PermissionKey, label: 'Manage Company Bank' },
    ],
  },
  {
    group: 'Support',
    permissions: [
      { key: 'TICKET_VIEW' as PermissionKey, label: 'View Support Tickets' },
      { key: 'TICKET_MANAGE' as PermissionKey, label: 'Manage Support Tickets (Assign & Reply)' },
    ],
  },
];

// Get permissions from API
export async function getPermissions(): Promise<Permission[]> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/permissions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await handleResponse<{ permissions: Permission[] }>(response);
  return data.permissions;
}

// Get current admin's permissions and role
export async function getMyPermissions(): Promise<{ permissions: string[]; role: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/my-permissions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await handleResponse<{ permissions: string[]; role: string }>(response);
  return data;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Get list of sub-admins
export async function getSubAdmins(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive';
}): Promise<SubAdminsListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.status) queryParams.append('status', params.status);

  const response = await fetch(`${API_BASE_URL}/sub-admins?${queryParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<SubAdminsListResponse>(response);
}

// Get sub-admin by ID
export async function getSubAdminById(id: string): Promise<SubAdmin> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/sub-admins/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<SubAdmin>(response);
}

// Create sub-admin
export async function createSubAdmin(payload: CreateSubAdminRequest): Promise<SubAdmin> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/sub-admins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<SubAdmin>(response);
}

// Update sub-admin
export async function updateSubAdmin(
  id: string,
  payload: UpdateSubAdminRequest
): Promise<SubAdmin> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/sub-admins/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<SubAdmin>(response);
}

// Update sub-admin status (deactivate)
export async function updateSubAdminStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  if (status === 'inactive') {
    // Use DELETE endpoint to deactivate
    const response = await fetch(`${API_BASE_URL}/sub-admins/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    await handleResponse<{ success: boolean; message: string }>(response);
  } else {
    // Use PUT endpoint to activate
    await updateSubAdmin(id, { status });
  }
}

