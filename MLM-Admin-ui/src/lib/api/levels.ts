// API utility for Levels management
// Base URL - can be configured via environment variable
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  return envUrl.includes('/admin') ? envUrl : `${envUrl}/admin`;
};
const API_BASE_URL = getBaseUrl();

// Business Requirement type
export interface BusinessRequirement {
  required_leg_count?: number | null;
  required_leg_min_amount?: number | null;
  total_business?: number | null;
  description?: string | null; // API returns this field but we don't use it in UI
}

// API Response types
export interface Level {
  level: number;
  title: string;
  description?: string | null;
  reward?: string | null;
  spot_commission_percent?: number | null;
  monthly_royalty_percent?: number | null;
  business_requirement?: BusinessRequirement | null;
  icon_url?: string | null;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LevelsListResponse {
  count: number;
  items: Level[];
}

export interface UpdateLevelRequest {
  title?: string;
  description?: string | null;
  reward?: string | null;
  spot_commission_percent?: number | null;
  monthly_royalty_percent?: number | null;
  business_requirement?: BusinessRequirement | null;
  icon_url?: string | null;
  color?: string | null;
}

// API Error type
export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
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
    
    if (errorData.error === 'unauthorized' || response.status === 401) {
      errorMessage = 'Unauthorized. Please login again.';
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

// Get all levels
export async function getLevels(): Promise<LevelsListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/levels`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<LevelsListResponse>(response);
}

// Update an existing level
export async function updateLevel(level: number, data: UpdateLevelRequest): Promise<Level> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/levels/${level}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Level>(response);
}

// Get level details with commission rules - GET /api/v1/admin/levels/:level
export async function getLevelDetails(level: number): Promise<Level> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/levels/${level}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<Level>(response);
}

