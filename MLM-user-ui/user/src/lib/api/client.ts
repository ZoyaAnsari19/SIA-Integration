/**
 * API Client - Axios instance with interceptors
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { parseApiError, getUserFriendlyError } from './errors';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4005/api/v1';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔗 API Base URL:', API_BASE_URL);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const errorMessage = getUserFriendlyError(error);
    return Promise.reject({
      ...error,
      userMessage: errorMessage,
    });
  },
);

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');

  try {
    const isProdDomain = window.location.hostname.endsWith('secureinfiniteassociation.com');
    const base = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';
    if (isProdDomain) {
      document.cookie = `${base}; Domain=.secureinfiniteassociation.com`;
    } else {
      document.cookie = base;
    }
  } catch {
    // Ignore cookie errors
  }
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
