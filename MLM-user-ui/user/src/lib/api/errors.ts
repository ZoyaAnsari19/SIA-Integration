/**
 * API Error Handling Utilities
 */

import { ApiError } from './types';

export class ApiException extends Error {
  constructor(
    public status: number,
    public error: ApiError,
    message?: string
  ) {
    super(message || error.message || error.error || 'An error occurred');
    this.name = 'ApiException';
  }
}

/**
 * Parse API error from response
 */
export function parseApiError(error: any): string {
  if (error.response) {
    // Server responded with error status
    const data = error.response.data;
    if (data?.message) {
      return data.message;
    }
    if (data?.error) {
      return typeof data.error === 'string' ? data.error : 'An error occurred';
    }
    if (error.response.status === 401) {
      return 'Unauthorized. Please login again.';
    }
    if (error.response.status === 403) {
      return 'Access forbidden.';
    }
    if (error.response.status === 404) {
      return 'Resource not found.';
    }
    if (error.response.status === 500) {
      return 'Server error. Please try again later.';
    }
    return `Error ${error.response.status}: ${error.response.statusText}`;
  } else if (error.request) {
    // Request made but no response received
    return 'Network error. Please check your connection.';
  } else {
    // Error in request setup
    return error.message || 'An unexpected error occurred';
  }
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: any): string {
  const message = parseApiError(error);
  
  // Map common error codes to user-friendly messages
  const errorMap: Record<string, string> = {
    'user_not_found': 'User not found. Please check your credentials.',
    'invalid_credentials': 'Invalid credentials. Please try again.',
    'unauthorized': 'You are not authorized. Please login again.',
    'insufficient_balance': 'Insufficient balance in selected wallet.',
    'kyc_not_approved': 'KYC approval is required for this action.',
    'withdrawal_not_allowed': 'Withdrawal is not allowed on this date.',
    'kyc_submission_not_allowed': 'KYC submission is not allowed on this date.',
  };
  
  // Check for specific error messages first (name change, etc.) - these should not be replaced
  if (message.toLowerCase().includes('name change') || 
      message.toLowerCase().includes('for name change') ||
      message.toLowerCase().includes('required:') && message.toLowerCase().includes('available:')) {
    return message; // Return the specific error message as-is
  }
  
  // Check if error message matches any known error
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return message;
}

