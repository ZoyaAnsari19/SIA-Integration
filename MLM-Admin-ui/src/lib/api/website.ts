// API utility for Website Settings management (Sliders and Website Notices)
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
      // Redirect to login if unauthorized
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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

// ==================== SLIDER TYPES & FUNCTIONS ====================

export interface Slider {
  id: number;
  title: string;
  image_url: string;
  link: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SliderListResponse {
  items: Slider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface GetSlidersParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
}

export interface CreateSliderRequest {
  title: string;
  image_url: string;
  link?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateSliderRequest {
  title?: string;
  image_url?: string;
  link?: string | null;
  display_order?: number;
  is_active?: boolean;
}

// Get all sliders with pagination
export async function getSliders(params?: GetSlidersParams): Promise<SliderListResponse> {
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

  const url = `${API_BASE_URL}/website/slider${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<SliderListResponse>(response);
}

// Get a single slider by ID
export async function getSliderById(id: number): Promise<Slider> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/slider/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<Slider>(response);
}

// Create a new slider
export async function createSlider(data: CreateSliderRequest): Promise<Slider> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/slider`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Slider>(response);
}

// Update an existing slider
export async function updateSlider(id: number, data: UpdateSliderRequest): Promise<Slider> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/slider/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Slider>(response);
}

// Delete a slider
export async function deleteSlider(id: number): Promise<{ message: string; id: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/slider/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string; id: number }>(response);
}

// Upload slider image
export async function uploadSliderImage(file: File): Promise<{ image_url: string; uploaded_at: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/website/slider/image/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser will set it with boundary
    },
    body: formData,
  });

  return handleResponse<{ image_url: string; uploaded_at: string }>(response);
}

// ==================== WEBSITE NOTICE TYPES & FUNCTIONS ====================

export interface WebsiteNotice {
  id: number;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebsiteNoticeListResponse {
  items: WebsiteNotice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface GetWebsiteNoticesParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
}

export interface CreateWebsiteNoticeRequest {
  title: string;
  content: string;
  is_active?: boolean;
}

export interface UpdateWebsiteNoticeRequest {
  title?: string;
  content?: string;
  is_active?: boolean;
}

// Get all website notices with pagination
export async function getWebsiteNotices(params?: GetWebsiteNoticesParams): Promise<WebsiteNoticeListResponse> {
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

  const url = `${API_BASE_URL}/website/notices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<WebsiteNoticeListResponse>(response);
}

// Get a single website notice by ID
export async function getWebsiteNoticeById(id: number): Promise<WebsiteNotice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/notices/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<WebsiteNotice>(response);
}

// Create a new website notice
export async function createWebsiteNotice(data: CreateWebsiteNoticeRequest): Promise<WebsiteNotice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<WebsiteNotice>(response);
}

// Update an existing website notice
export async function updateWebsiteNotice(id: number, data: UpdateWebsiteNoticeRequest): Promise<WebsiteNotice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/notices/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<WebsiteNotice>(response);
}

// Delete a website notice
export async function deleteWebsiteNotice(id: number): Promise<{ message: string; id: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/website/notices/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string; id: number }>(response);
}

