// API utility for User Authentication
// Base URL - can be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// API Response types (matching MLM-API /api/v1/auth/login response structure)
export interface UserLoginResponse {
  token: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
}

export interface UserLoginRequest {
  userId: string;
  password: string;
}

// Admin login response type (matching MLM-API /api/v1/auth/admin/login response structure)
export interface AdminLoginResponse {
  token: string;
  admin: {
    role: string;
    authenticated: boolean;
  };
}

// API Error type
export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// Change password request/response types - matches /api/v1/profile/password
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  otp: string;
}

export interface ChangePasswordResponse {
  message: string;
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
    
    // User-friendly error messages
    if (errorData.error === 'user_not_found') {
      errorMessage = 'User not found. Please check your User ID or Email and try again.';
    } else if (errorData.error === 'invalid_credentials' || errorData.error === 'invalid_admin_token') {
      errorMessage = 'Invalid credentials. Please check your password and try again.';
    } else if (errorData.error === 'password_not_set') {
      errorMessage = 'Password not set for this account. Please contact administrator.';
    } else if (response.status === 404) {
      errorMessage = 'User not found. Please check your email address.';
    } else if (response.status === 401) {
      errorMessage = 'Invalid credentials. Please check your email and password.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (response.status === 0 || response.status >= 500) {
      errorMessage = 'Unable to connect to server. Please check if the API server is running.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Helper to get auth token from localStorage (with fallback to sessionStorage for backward compatibility)
// Using localStorage for cross-tab persistence (best practice for JWT tokens)
const getAuthTokenInternal = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Try localStorage first (for cross-tab persistence)
  const token = localStorage.getItem('auth_token');
  if (token) return token;
  // Fallback to sessionStorage for backward compatibility
  const sessionToken = sessionStorage.getItem('auth_token');
  if (sessionToken) {
    // Migrate to localStorage for future use
    localStorage.setItem('auth_token', sessionToken);
    return sessionToken;
  }
  return null;
};

// User login - matches /api/v1/auth/login endpoint
export async function userLogin(userId: string, password: string): Promise<UserLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, password }),
  });

  return handleResponse<UserLoginResponse>(response);
}

// Admin login - matches /api/v1/auth/admin/login endpoint
export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse<AdminLoginResponse>(response);
}

export async function sendPasswordChangeOtp(): Promise<{
  success: boolean;
  message: string;
  email_masked?: string;
}> {
  const token = getAuthTokenInternal();
  if (!token) {
    throw new Error('Authentication token not found. Please login again.');
  }

  const response = await fetch(`${API_BASE_URL}/profile/password/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ success: boolean; message: string; email_masked?: string }>(response);
}

// Change current user's password - matches /api/v1/profile/password
export async function changePassword(
  payload: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  const token = getAuthTokenInternal();
  if (!token) {
    throw new Error('Authentication token not found. Please login again.');
  }

  const response = await fetch(`${API_BASE_URL}/profile/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<ChangePasswordResponse>(response);
}

// Check if user is authenticated (using localStorage for cross-tab persistence)
// Supports both regular user and admin authentication
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for admin authentication (localStorage with sessionStorage fallback)
  const adminAuth = localStorage.getItem('admin_authenticated') === 'true' || 
                    sessionStorage.getItem('admin_authenticated') === 'true';
  // Check for regular user authentication (localStorage with sessionStorage fallback)
  const userAuth = localStorage.getItem('user_id') !== null || 
                    sessionStorage.getItem('user_id') !== null;
  // Check for auth token (common for both) - using centralized function
  const hasToken = getAuthTokenInternal() !== null;
  return (adminAuth || userAuth) && hasToken;
}

// Store user session info and token in localStorage (for cross-tab persistence)
// Also stores in sessionStorage for backward compatibility
export function storeUserSession(userId: string, userEmail: string | null, userName: string | null, token: string): void {
  if (typeof window !== 'undefined') {
    // Store in localStorage (primary - for cross-tab persistence)
    localStorage.setItem('user_id', userId);
    localStorage.setItem('auth_token', token);
    if (userEmail) localStorage.setItem('user_email', userEmail);
    if (userName) localStorage.setItem('user_name', userName);
    // Also store in sessionStorage for backward compatibility
    sessionStorage.setItem('user_id', userId);
    sessionStorage.setItem('auth_token', token);
    if (userEmail) sessionStorage.setItem('user_email', userEmail);
    if (userName) sessionStorage.setItem('user_name', userName);
  }
}

// Store admin session info and token in localStorage (for cross-tab persistence)
// Also stores in sessionStorage for backward compatibility
export function storeAdminSession(email: string, token: string): void {
  if (typeof window !== 'undefined') {
    // Store in localStorage (primary - for cross-tab persistence)
    localStorage.setItem('admin_email', email);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('admin_role', 'admin');
    localStorage.setItem('admin_authenticated', 'true');
    // Also store in sessionStorage for backward compatibility
    sessionStorage.setItem('admin_email', email);
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('admin_role', 'admin');
    sessionStorage.setItem('admin_authenticated', 'true');
  }
}

// Get auth token from localStorage (with sessionStorage fallback for backward compatibility)
// Exported for use in API calls - uses centralized logic for cross-tab persistence
export function getAuthToken(): string | null {
  return getAuthTokenInternal();
}

// Get user session info (from localStorage with sessionStorage fallback)
export function getUserSession(): { userId: string | null; email: string | null; name: string | null } {
  if (typeof window === 'undefined') {
    return { userId: null, email: null, name: null };
  }
  return {
    userId: localStorage.getItem('user_id') || sessionStorage.getItem('user_id'),
    email: localStorage.getItem('user_email') || sessionStorage.getItem('user_email'),
    name: localStorage.getItem('user_name') || sessionStorage.getItem('user_name'),
  };
}

// Remove user session (logout)
// Also removes admin session data from both localStorage and sessionStorage
export function removeUserSession(): void {
  if (typeof window !== 'undefined') {
    // Remove regular user session from localStorage
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    // Remove admin session from localStorage
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_authenticated');
    // Remove common auth token from localStorage
    localStorage.removeItem('auth_token');
    // Also remove from sessionStorage
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('user_name');
    sessionStorage.removeItem('admin_email');
    sessionStorage.removeItem('admin_role');
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('auth_token');
    // Clear any old/legacy tokens if they exist
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    localStorage.removeItem('auth');
  }
}

