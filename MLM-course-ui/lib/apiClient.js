/**
 * API Client - Centralized fetch wrapper with JWT token management
 */

// Updated to use unified MLM-API (merged from MLM-course-API)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.secureinfiniteassociation.com/api/v1';

/**
 * Helper: read cookie by name
 */
function getCookie(name) {
  if (typeof window === 'undefined' || !document.cookie) return null;
  const value = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  if (!value) return null;
  return decodeURIComponent(value.split('=')[1] || '');
}

/**
 * Get JWT token from localStorage or shared auth cookie
 */
function getToken() {
  if (typeof window === 'undefined') return null;

  // Primary source: local storage for this app
  const existing = localStorage.getItem('sia_token');
  if (existing) return existing;

  // Fallback: shared auth cookie set by dashboard app
  const cookieToken = getCookie('auth_token');
  if (cookieToken) {
    // Sync into this app's storage so future calls don't re-parse cookies
    localStorage.setItem('sia_token', cookieToken);
    return cookieToken;
  }

  return null;
}

/**
 * Set JWT token in localStorage + shared auth cookie
 */
function setToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('sia_token', token);
  } else {
    localStorage.removeItem('sia_token');
  }

  // Mirror to shared cookie so login from course app also works across subdomains
  try {
    const isProdDomain = window.location.hostname.endsWith('secureinfiniteassociation.com');
    const cookieParts = [
      `auth_token=${encodeURIComponent(token || '')}`,
      'Path=/',
      'SameSite=Lax',
      'Secure',
    ];
    if (token) {
      cookieParts.push('Max-Age=604800'); // 7 days
    } else {
      cookieParts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
    if (isProdDomain) {
      cookieParts.push('Domain=.secureinfiniteassociation.com');
    }
    document.cookie = cookieParts.join('; ');
  } catch {
    // Ignore cookie errors
  }
}

/**
 * Remove token from localStorage and shared cookie
 */
function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sia_token');

  // Clear shared auth cookie so logout from app also logs out dashboard
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

/**
 * Make API request with automatic token injection
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  
  // If requireAuth is true, always send token (even if endpoint is public)
  const requireAuth = options.requireAuth || false;
  const shouldSendToken = token && (requireAuth || options.headers?.Authorization);

  // Determine if we have a body to send
  const hasBody = options.body !== undefined && options.body !== null;
  
  const config = {
    ...options,
    headers: {
      // Only set Content-Type if we have a body
      ...(hasBody && { 'Content-Type': 'application/json' }),
      // Always send token if available (for optional auth endpoints like course detail)
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };
  
  // Remove requireAuth from config (not a fetch option)
  if (config.requireAuth !== undefined) {
    delete config.requireAuth;
  }

  // Add body if provided
  if (hasBody && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  } else if (hasBody) {
    config.body = options.body;
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    // Handle 401 - Unauthorized
    if (response.status === 401) {
      removeToken();
      if (typeof window !== 'undefined') {
        const { toast } = await import('react-hot-toast');
        toast.error('Session expired. Please login again.');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized - Please login again');
    }

    // Handle errors
    if (!response.ok) {
      // Prefer human-friendly message from backend if present, otherwise fall back to error code.
      const errorMessage = (data && (data.message || data.error)) || `API Error: ${response.status}`;
      // Don't show toast for 404 errors (course not found) - let the page handle it
      if (typeof window !== 'undefined' && response.status !== 404) {
        const { toast } = await import('react-hot-toast');
        toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    // Don't show toast for network errors if it's a 404 or if we already showed a toast
    // Only show toast for unexpected errors
    if (error.message && typeof window !== 'undefined' && 
        !error.message.includes('Unauthorized') && 
        !error.message.includes('Course not found') &&
        !error.message.includes('404')) {
      const { toast } = await import('react-hot-toast');
      toast.error(error.message);
    }
    throw error;
  }
}

/**
 * API Client methods
 */
export const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  setToken,
  getToken,
  removeToken,
};

export default api;

