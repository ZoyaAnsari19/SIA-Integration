// API utility for Admin Action PIN management
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

export interface PinStatus {
  success: boolean;
  has_pin: boolean;
  requires_pin: boolean;
  is_locked: boolean;
  locked_until: string | null;
  pin_set_at: string | null;
}

export interface PinInfo {
  success: boolean;
  sub_admin_id: string;
  sub_admin_name: string | null;
  sub_admin_email: string | null;
  has_pin: boolean;
  pin_value: string | null; // Actual PIN value (visible to admin)
  is_locked: boolean;
  locked_until: string | null;
  failed_attempts: number;
  pin_set_at: string | null;
  pin_set_by_name: string | null;
}

export interface VerifyPinResponse {
  success: boolean;
  message: string;
  verified: boolean;
  remaining_attempts?: number;
  locked_until?: string | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
  }
  return data;
}

/**
 * Check if current admin has PIN set and if they need it
 */
export async function getPinStatus(): Promise<PinStatus> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/pin/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PinStatus>(response);
}

/**
 * Verify PIN before performing critical action
 */
export async function verifyPin(pin: string): Promise<VerifyPinResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/pin/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pin }),
  });

  return handleResponse<VerifyPinResponse>(response);
}

/**
 * Set PIN for a sub-admin (Super Admin only)
 */
export async function setSubAdminPin(subAdminId: string, pin: string): Promise<{ success: boolean; message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/pin/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sub_admin_id: subAdminId, pin }),
  });

  return handleResponse<{ success: boolean; message: string }>(response);
}

/**
 * Reset PIN for a sub-admin (Super Admin only)
 */
export async function resetSubAdminPin(subAdminId: string, newPin: string): Promise<{ success: boolean; message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/pin/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sub_admin_id: subAdminId, new_pin: newPin }),
  });

  return handleResponse<{ success: boolean; message: string }>(response);
}

/**
 * Get PIN info for a sub-admin (Super Admin only)
 */
export async function getSubAdminPinInfo(subAdminId: string): Promise<PinInfo> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/pin/info/${subAdminId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PinInfo>(response);
}

/**
 * Unlock PIN for a sub-admin (Super Admin only)
 */
export async function unlockSubAdminPin(subAdminId: string): Promise<{ success: boolean; message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/pin/unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sub_admin_id: subAdminId }),
  });

  return handleResponse<{ success: boolean; message: string }>(response);
}
