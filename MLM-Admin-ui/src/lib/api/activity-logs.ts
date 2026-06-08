// API utility for Admin Activity Logs
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

export interface ActivityLog {
  id: string;
  admin_user_id: string;
  admin_name: string | null;
  admin_email: string | null;
  action_type: string;
  target_user_id: string | null;
  target_user_display_id: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  action_details: Record<string, any>;
  action_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failed' | 'error';
  error_message: string | null;
  created_at: string;
}

export interface ActivityLogsResponse {
  logs: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ActivityLogsQuery {
  page?: number;
  limit?: number;
  admin_user_id?: string;
  action_type?: string;
  target_user_id?: string;
  status?: 'success' | 'failed' | 'error';
  start_date?: string;
  end_date?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function getActivityLogs(query?: ActivityLogsQuery): Promise<ActivityLogsResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const params = new URLSearchParams();
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.admin_user_id) params.append('admin_user_id', query.admin_user_id);
  if (query?.action_type) params.append('action_type', query.action_type);
  if (query?.target_user_id) params.append('target_user_id', query.target_user_id);
  if (query?.status) params.append('status', query.status);
  if (query?.start_date) params.append('start_date', query.start_date);
  if (query?.end_date) params.append('end_date', query.end_date);

  const url = `${API_BASE_URL}/activity-logs${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<ActivityLogsResponse>(response);
}
