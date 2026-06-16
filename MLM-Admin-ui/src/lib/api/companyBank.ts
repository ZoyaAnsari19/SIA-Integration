// API utility for Company Bank management
// Base URL - can be configured via environment variable
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  // Ensure /admin is included for admin routes
  return envUrl.includes('/admin') ? envUrl : `${envUrl}/admin`;
};
const API_BASE_URL = getBaseUrl();

// API Response types
export interface CompanyBankAccount {
  id: number;
  bank_name: string;
  bank_ac_holder: string;
  bank_ac_no: string;
  bank_ifsc: string;
  bank_branch: string | null;
  bank_upi: string | null;
  qr_image: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyBankListResponse {
  count: number;
  items: CompanyBankAccount[];
}

export interface CreateCompanyBankRequest {
  bank_name: string;
  bank_ac_holder: string;
  bank_ac_no: string;
  bank_ifsc: string;
  bank_branch?: string;
  bank_upi?: string;
  qr_image?: string;
  is_active?: boolean;
}

export interface UpdateCompanyBankRequest {
  bank_name?: string;
  bank_ac_holder?: string;
  bank_ac_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  bank_upi?: string;
  qr_image?: string;
  is_active?: boolean;
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
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
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

// Get all company bank accounts
export async function getCompanyBankAccounts(params?: {
  is_active?: boolean;
}): Promise<CompanyBankListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) {
    queryParams.append('is_active', params.is_active.toString());
  }

  const url = `${API_BASE_URL}/company-bank${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<CompanyBankListResponse>(response);
}

// Get a single company bank account by ID
export async function getCompanyBankAccountById(id: number): Promise<CompanyBankAccount> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/company-bank/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<CompanyBankAccount>(response);
}

// Create a new company bank account
export async function createCompanyBankAccount(data: CreateCompanyBankRequest): Promise<CompanyBankAccount> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/company-bank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<CompanyBankAccount>(response);
}

// Update an existing company bank account
export async function updateCompanyBankAccount(id: number, data: UpdateCompanyBankRequest): Promise<CompanyBankAccount> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/company-bank/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<CompanyBankAccount>(response);
}

// Delete a company bank account
export async function deleteCompanyBankAccount(id: number): Promise<{ message: string; id: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/company-bank/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string; id: number }>(response);
}

// Upload QR code image
export async function uploadCompanyBankQR(file: File): Promise<{ qr_image_url: string; uploaded_at: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/company-bank/qr/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser will set it with boundary
    },
    body: formData,
  });

  return handleResponse<{ qr_image_url: string; uploaded_at: string }>(response);
}

