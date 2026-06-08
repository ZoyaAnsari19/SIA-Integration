import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000/api/v1';

  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  if (envUrl.endsWith('/api/v1')) {
    return `${envUrl}/admin`;
  }
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

export interface LegacyHistoryItem {
  id: string;
  user_id: string | null;
  display_id: string;
  user_name: string;
  row_index: number;
  source_file: string;
  imported_at: string;
  data: Record<string, unknown>;
  // Flattened Excel-like fields (optional, for easier rendering)
  excel_user_id?: string | null;
  excel_user_name?: string | null;
  excel_request_type?: string | null;
  excel_new_package?: string | null;
  excel_utr_txn_id?: string | null;
  excel_status?: string | null;
  excel_renewal_added?: string | null;
  excel_renewal_added_1?: string | null;
  excel_clarification?: string | null;
  excel_income_level?: string | null;
  excel_income_amount?: string | null;
  excel_from_id?: string | null;
  excel_package_name?: string | null;
  excel_investment_amount?: string | null;
  excel_credited_date?: string | null;
  excel_investment_type?: string | null;
}

export interface LegacyHistoryResponse {
  items: LegacyHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface LegacyHistoryParams {
  page?: number;
  limit?: number;
  user_id?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      if (typeof data?.message === 'string') message = data.message;
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  return response.json();
}

function buildQuery(params?: LegacyHistoryParams): string {
  const search = new URLSearchParams();
  if (params?.page) search.append('page', params.page.toString());
  if (params?.limit) search.append('limit', params.limit.toString());
  if (params?.user_id) search.append('user_id', params.user_id);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function getLegacyActivationHistory(
  params?: LegacyHistoryParams,
): Promise<LegacyHistoryResponse> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');

  const url = `${API_BASE_URL}/legacy/activation-history${buildQuery(params)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<LegacyHistoryResponse>(res);
}

export async function getLegacySpotHistory(
  params?: LegacyHistoryParams,
): Promise<LegacyHistoryResponse> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');

  const url = `${API_BASE_URL}/legacy/spot-history${buildQuery(params)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<LegacyHistoryResponse>(res);
}

