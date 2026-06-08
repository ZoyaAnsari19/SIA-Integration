import { getAuthToken } from './auth';

const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  
  // If URL already ends with /admin, return as is
  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  
  // Otherwise, append /admin
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

// API Response types
export interface WithdrawalTransferRules {
  id: number;
  admin_charges: number;
  min_withdraw: number;
  max_withdraw: number | null;
  spot_min_withdraw?: number;
  spot_team_withdraw_multiplier?: number; // e.g. 5 or 10 (Spot+Team Royalty limit = package value × this)
  min_transfer_amt: number;
  max_transfer_amt: number | null;
  transfer_amt_tax: number;
  withdrawal_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateWithdrawalTransferRulesRequest {
  admin_charges?: number;
  min_withdraw?: number;
  max_withdraw?: number | null;
  spot_min_withdraw?: number;
  spot_team_withdraw_multiplier?: number; // 1–100, default 10
  min_transfer_amt?: number;
  max_transfer_amt?: number | null;
  transfer_amt_tax?: number;
  withdrawal_enabled?: boolean;
  is_active?: boolean;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login if unauthorized
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized. Please login again.');
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get withdrawal and transfer rules
 */
export async function getWithdrawalTransferRules(): Promise<WithdrawalTransferRules> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/withdrawal-transfer-rules`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<WithdrawalTransferRules>(response);
}

/**
 * Update withdrawal and transfer rules
 */
export async function updateWithdrawalTransferRules(
  rules: UpdateWithdrawalTransferRulesRequest
): Promise<WithdrawalTransferRules> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/withdrawal-transfer-rules`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(rules),
  });

  return handleResponse<WithdrawalTransferRules>(response);
}

