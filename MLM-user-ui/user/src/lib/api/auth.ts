/**
 * Auth API Service
 */

import { apiClient } from './client';
import { setAuthToken, removeAuthToken } from './client';
import type { LoginRequest, LoginResponse, User } from './types';

/**
 * Login user
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    
    // Store token
    if (response.data.token) {
      setAuthToken(response.data.token);
    }
    
    // Store user data in localStorage
    if (typeof window !== 'undefined' && response.data.user) {
      localStorage.setItem('auth_user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User> {
  try {
    const response = await apiClient.get<{ user: User }>('/auth/me');
    return response.data.user;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Logout user
 */
export function logout(): void {
  removeAuthToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_user');
  }
}

/**
 * Get stored user from localStorage
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('auth_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Send registration OTP to email
 */
export async function sendEmailOTP(email: string): Promise<{
  success: boolean;
  message: string;
  email_masked?: string;
  dev_otp?: string;
}> {
  try {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      email_masked?: string;
      dev_otp?: string;
    }>('/auth/email-otp/send', { email: email.trim() });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Verify registration email OTP
 */
export async function verifyEmailOTP(
  email: string,
  otp: string,
): Promise<{ success: boolean; message: string; verified: boolean; verificationToken?: string }> {
  try {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      verified: boolean;
      verificationToken?: string;
    }>('/auth/email-otp/verify', { email: email.trim(), otp });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Send OTP to mobile number (legacy — registration uses email OTP)
 */
export async function sendOTP(mobile: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanMobile = mobile.replace(/^\+91/, ''); // Remove +91 if present
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] Calling /auth/otp/send with mobile: ${cleanMobile}`);
    }
    const response = await apiClient.post<{ success: boolean; message: string }>('/auth/otp/send', {
      mobile: cleanMobile,
    });
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] OTP send response:`, response.data);
    }
    return response.data;
  } catch (error: any) {
    console.error(`[API] OTP send error:`, error?.response?.data || error?.message);
    throw error;
  }
}

/**
 * Verify OTP
 */
export async function verifyOTP(mobile: string, otp: string): Promise<{ success: boolean; message: string; verified: boolean }> {
  try {
    const response = await apiClient.post<{ success: boolean; message: string; verified: boolean }>('/auth/otp/verify', {
      mobile: mobile.replace(/^\+91/, ''), // Remove +91 if present
      otp,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Register new user
 */
export interface RegisterRequest {
  name: string;
  email: string;
  mobile: string;
  password: string;
  referrer_user_id: string; // Numeric user ID (not display_id)
  email_verified_token?: string;
}

export interface RegisterResponse {
  id: string;
  display_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  referrer_user_id: string | null;
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  try {
    const payload: Record<string, string> = {
      name: data.name,
      email: data.email,
      mobile: data.mobile.replace(/^\+91/, ''),
      password: data.password,
      referrer_user_id: data.referrer_user_id,
    };
    if (data.email_verified_token) {
      payload.email_verified_token = data.email_verified_token;
    }
    const response = await apiClient.post<RegisterResponse>('/auth/register', payload);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get sponsor details by display_id or numeric ID
 */
export async function getSponsorDetails(sponsorId: string): Promise<{ id: string; name: string | null; display_id?: string | null }> {
  try {
    const response = await apiClient.get<{ id: string; name: string | null; display_id?: string | null }>(`/auth/sponsor/${sponsorId}`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Forgot Password - Send email OTP
 */
export async function forgotPasswordSendOtp(email: string): Promise<{
  success: boolean;
  message: string;
  email_masked?: string;
}> {
  const response = await apiClient.post<{ success: boolean; message: string; email_masked?: string }>(
    '/auth/forgot-password/send-otp',
    { email: email.trim() },
  );
  return response.data;
}

/**
 * Forgot Password - Verify email OTP
 */
export async function forgotPasswordVerifyOtp(
  email: string,
  otp: string,
): Promise<{ success: boolean; message: string; resetToken: string }> {
  const response = await apiClient.post<{ success: boolean; message: string; resetToken: string }>(
    '/auth/forgot-password/verify-otp',
    { email: email.trim(), otp },
  );
  return response.data;
}

/**
 * Forgot Password - Reset Password
 */
export async function forgotPasswordReset(
  email: string,
  resetToken: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password/reset', {
    email: email.trim(),
    resetToken,
    newPassword,
  });
  return response.data;
}

/**
 * Change Password - Send email OTP (logged-in user)
 */
export async function sendPasswordChangeOtp(): Promise<{
  success: boolean;
  message: string;
  email_masked?: string;
}> {
  const response = await apiClient.post<{ success: boolean; message: string; email_masked?: string }>(
    '/profile/password/send-otp',
  );
  return response.data;
}

/**
 * Set Transaction Password (first time)
 */
export async function setTransactionPassword(pin: string, confirmPin: string): Promise<void> {
  const response = await apiClient.post('/profile/transaction-pin/set', {
    pin,
    confirm_pin: confirmPin,
  });
  
  // If status is 200/201, consider it successful regardless of response data
  if (response.status === 200 || response.status === 201) {
    return;
  }
  
  // If we get here, something unexpected happened
  throw new Error('Failed to set transaction password');
}

/**
 * Change Login Password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  otp: string,
): Promise<{ message: string }> {
  const response = await apiClient.put<{ message: string }>('/profile/password', {
    current_password: currentPassword,
    new_password: newPassword,
    otp,
  });
  return response.data;
}

/**
 * Change Transaction Password
 */
export async function changeTransactionPassword(currentPin: string, newPin: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.put<{ message: string }>('/profile/transaction-pin', {
      current_pin: currentPin,
      new_pin: newPin,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Forgot Transaction PIN - Send OTP
 */
export async function forgotTransactionPinSendOtp(mobile: string): Promise<{ success: boolean; message: string; fee_amount: number }> {
  try {
    const cleanMobile = mobile.replace(/^\+91/, ''); // Remove +91 if present
    const response = await apiClient.post<{ success: boolean; message: string; fee_amount: number }>('/profile/forgot-transaction-pin/send-otp', {
      mobile: cleanMobile,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Forgot Transaction PIN - Verify OTP
 */
export async function forgotTransactionPinVerifyOtp(mobile: string, otp: string): Promise<{ success: boolean; message: string; resetToken: string }> {
  try {
    const response = await apiClient.post<{ success: boolean; message: string; resetToken: string }>('/profile/forgot-transaction-pin/verify-otp', {
      mobile: mobile.replace(/^\+91/, ''), // Remove +91 if present
      otp,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Forgot Transaction PIN - Reset PIN
 */
export async function forgotTransactionPinReset(mobile: string, resetToken: string, newPin: string, confirmPin: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.post<{ success: boolean; message: string }>('/profile/forgot-transaction-pin/reset', {
      mobile: mobile.replace(/^\+91/, ''), // Remove +91 if present
      resetToken,
      newPin,
      confirmPin,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

