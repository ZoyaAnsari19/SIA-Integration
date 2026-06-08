/**
 * KYC API Service
 */

import { apiClient } from './client';
import type { KYCProfile, KYCDocumentUploadResponse, KYCSubmitRequest } from './types';

/**
 * User Profile Response
 */
export interface UserProfileResponse {
  id?: string;
  user_id?: string;
  name?: string | null;
  display_title?: string | null;
  email?: string | null;
  phone?: string | null;
  kyc_status?: string;
  kyc_verified_at?: string | null;
  kyc_fee_amount?: number;
  kyc_rejection_reason?: string | null;
  referrer_user_id?: string | null;
  referrer_name?: string | null;
  referrer_display_id?: string | null;
  personal?: {
    mobile?: string;
    email?: string;
  };
  address?: {
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
  };
  bank?: {
    accountHolderName?: string;
    accountNumber?: string;
    bankName?: string;
    branch?: string;
    ifscCode?: string;
    upiId?: string;
    nomineeContact?: string;
    nomineeName?: string;
    nomineeRelation?: string;
  };
  profile?: {
    phone?: string;
    profile_photo_url?: string | null;
    date_of_birth?: string | null;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
    bank_name?: string;
    bank_branch?: string;
    bank_ac_holder?: string;
    bank_upi?: string;
    pan_number?: string | null;
    aadhar_number?: string | null;
  };
}

/**
 * KYC Status Response
 */
export interface KYCStatusResponse {
  user_id: string;
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  kyc_verified_at?: string | null;
  documents: Array<{
    id: string;
    document_type: string;
    document_number?: string | null;
    status: string;
    rejection_reason?: string | null;
    submitted_at: string;
    verified_at?: string | null;
  }>;
}

/**
 * Get user profile
 * If userId is provided, uses /users/:id/profile, otherwise uses /profile for current user
 */
export async function getUserProfile(userId?: string): Promise<UserProfileResponse> {
  try {
    const endpoint = userId ? `/users/${userId}/profile` : `/profile`;
    const response = await apiClient.get<UserProfileResponse>(endpoint);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get KYC status
 * If userId is provided, uses /users/:id/kyc/status, otherwise uses /profile endpoint
 * Note: The /users/:id/kyc/status endpoint requires numeric user ID, not display_id
 */
export async function getKYCStatus(userId?: string): Promise<KYCStatusResponse> {
  try {
    // If userId is provided and is numeric, use the specific endpoint
    // Otherwise, get KYC status from profile endpoint
    if (userId && /^\d+$/.test(userId)) {
      const response = await apiClient.get<KYCStatusResponse>(`/users/${userId}/kyc/status`);
      return response.data;
    } else {
      // Use profile endpoint which returns KYC status for current user
      const profile = await getUserProfile();
      return {
        user_id: profile.id || profile.user_id || '',
        kyc_status: (profile.kyc_status as any) || 'pending',
        kyc_verified_at: profile.kyc_verified_at || null,
        documents: [], // Profile endpoint doesn't return documents, use empty array
      };
    }
  } catch (error: any) {
    throw error;
  }
}

/**
 * Upload KYC document image
 */
export async function uploadKYCDocument(
  file: File,
  documentType: 'aadhar' | 'pan' | 'passport' | 'driving_license' | 'bank_statement' | 'others',
  side: 'front' | 'back'
): Promise<KYCDocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Use query params instead of form fields (simpler, like profile photo)
  const response = await apiClient.post<KYCDocumentUploadResponse>(
    `/user/kyc/document?document_type=${documentType}&side=${side}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000,
    }
  );
  
  // Map image_url to url for consistency
  return {
    ...response.data,
    url: response.data.image_url || response.data.url,
  };
}

/**
 * Submit KYC
 * If userId is provided and is numeric, uses /users/:id/kyc/submit
 * Otherwise, gets the numeric user ID from the profile endpoint first
 */
export async function submitKYC(userId?: string, data?: KYCSubmitRequest): Promise<{
  success: boolean;
  message: string;
  user_id: string;
}> {
  try {
    let numericUserId = userId;
    
    // If userId is not provided or is not numeric (might be display_id), get it from profile
    if (!numericUserId || !/^\d+$/.test(numericUserId)) {
      const profile = await getUserProfile();
      numericUserId = profile.id || profile.user_id || '';
    }
    
    if (!numericUserId || !/^\d+$/.test(numericUserId)) {
      throw new Error('Unable to determine numeric user ID');
    }
    
    const response = await apiClient.post(`/users/${numericUserId}/kyc/submit`, data);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Check if KYC submission is allowed on current date
 * Blocked dates (no KYC submission): 1, 9, 10, 19, 20, 29, 30, 31
 * KYC is allowed on all other dates.
 */
export function isKYCSubmissionAllowed(): { allowed: boolean; message?: string } {
  const today = new Date();
  const day = today.getDate();

  const blockedDates = [1, 9, 10, 19, 20, 29, 30, 31];
  if (blockedDates.includes(day)) {
    return {
      allowed: false,
      message: `KYC submission is not allowed on dates 1, 9, 10, 19, 20, 29, 30 and 31 of each month. Today is ${day}. Please try again on another date.`,
    };
  }

  return { allowed: true };
}

/**
 * Send OTP for name change
 */
export async function sendNameChangeOTP(mobile: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanMobile = mobile.replace(/^\+91/, ''); // Remove +91 if present
    const response = await apiClient.post<{ success: boolean; message: string }>('/profile/name-change/send-otp', {
      mobile: cleanMobile,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Verify OTP for name change
 */
export async function verifyNameChangeOTP(mobile: string, otp: string): Promise<{ success: boolean; message: string; verificationToken: string }> {
  try {
    const response = await apiClient.post<{ success: boolean; message: string; verificationToken: string }>('/profile/name-change/verify-otp', {
      mobile: mobile.replace(/^\+91/, ''), // Remove +91 if present
      otp,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Check if account number already exists
 */
export async function checkAccountNumberExists(accountNumber: string): Promise<{
  exists: boolean;
  message: string;
}> {
  try {
    const response = await apiClient.get<{
      exists: boolean;
      message: string;
    }>('/profile/check-account-number', {
      params: { account_number: accountNumber },
    });
    return response.data;
  } catch (error: any) {
    console.error('Check account number error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update user profile (name, email, phone, address, and bank details)
 */
export async function updateProfile(data: {
  name?: string;
  email?: string;
  phone?: string;
  name_change_verification_token?: string; // Required for name changes
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  zipCode?: string;
  pincode?: string;
  accountHolderName?: string;
  accountNumber?: string;
  bankName?: string;
  branch?: string;
  ifscCode?: string;
  bank_ifsc?: string;
  upiId?: string;
  nomineeName?: string;
  nomineeContact?: string;
  nomineeRelation?: string;
}): Promise<{
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
}> {
  try {
    const response = await apiClient.put<{
      id: string;
      name: string;
      email: string;
      phone?: string;
      message: string;
    }>('/profile', data);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Upload profile photo
 */
export async function uploadProfilePhoto(file: File): Promise<{
  profile_photo_url: string;
  uploaded_at: string;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<{
      profile_photo_url: string;
      uploaded_at: string;
    }>('/user/profile/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

