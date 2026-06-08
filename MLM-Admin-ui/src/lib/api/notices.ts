// API utility for Notice Board management
// Base URL - can be configured via environment variable
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  // Ensure /admin is included for admin routes
  return envUrl.includes('/admin') ? envUrl : `${envUrl}/admin`;
};
const API_BASE_URL = getBaseUrl();

// API Response types
export interface Notice {
  id: number;
  title: string;
  content: string;
  link: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoticeListResponse {
  items: Notice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CreateNoticeRequest {
  title: string;
  content: string;
  link?: string | null;
  is_active?: boolean;
}

export interface UpdateNoticeRequest {
  title?: string;
  content?: string;
  link?: string | null;
  is_active?: boolean;
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
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    let errorMessage = errorData.error || errorData.message || 'API request failed';
    
    if (errorData.error === 'unauthorized' || response.status === 401) {
      errorMessage = 'Unauthorized. Please login again.';
    } else if (response.status === 400) {
      errorMessage = errorData.message || errorData.error || 'Bad Request. Please check your input.';
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (response.status === 0 || response.status >= 500) {
      errorMessage = 'Unable to connect to server. Please check if the API server is running.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Get all notices with pagination
export async function getNotices(params?: {
  page?: number;
  limit?: number;
  is_active?: boolean;
}): Promise<NoticeListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.is_active !== undefined) {
    queryParams.append('is_active', params.is_active.toString());
  }

  const url = `${API_BASE_URL}/notices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<NoticeListResponse>(response);
}

// Get a single notice by ID
export async function getNoticeById(id: number): Promise<Notice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<Notice>(response);
}

// Create a new notice
export async function createNotice(data: CreateNoticeRequest): Promise<Notice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Notice>(response);
}

// Update an existing notice
export async function updateNotice(id: number, data: UpdateNoticeRequest): Promise<Notice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Notice>(response);
}

// Delete a notice
export async function deleteNotice(id: number): Promise<{ message: string; id: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string; id: number }>(response);
}

