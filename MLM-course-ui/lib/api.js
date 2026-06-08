/**
 * API endpoints - Centralized API calls
 */
import api from './apiClient';

// Auth endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  sendOTP: (mobile) => api.post('/auth/otp/send', { mobile }),
  verifyOTP: (mobile, otp) => api.post('/auth/otp/verify', { mobile, otp }),
  sendEmailOTP: (email) => api.post('/auth/email-otp/send', { email: email.trim() }),
  verifyEmailOTP: (email, otp) => api.post('/auth/email-otp/verify', { email: email.trim(), otp }),
  sendForgotPasswordOTP: (email) => api.post('/auth/forgot-password/send-otp', { email: email.trim() }),
  verifyForgotPasswordOTP: (email, otp) => api.post('/auth/forgot-password/verify-otp', { email: email.trim(), otp }),
  resetPassword: (email, resetToken, newPassword) => api.post('/auth/forgot-password/reset', { email: email.trim(), resetToken, newPassword }),
  getReferrerName: (displayId) => api.get(`/auth/referrer/${displayId}`),
};

// Courses endpoints
export const coursesAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/courses${queryString ? `?${queryString}` : ''}`);
  },
  getBySlug: (slug) => {
    // Always send auth token to check enrollment status
    return api.get(`/courses/${slug}`, { requireAuth: true });
  },
  getModules: (slug) => api.get(`/courses/${slug}/modules`),
  getMyCourses: () => api.get('/courses/my-courses'),
};

// Cart endpoints
export const cartAPI = {
  get: () => api.get('/cart'),
  addItem: (courseId, requestType) =>
    api.post('/cart/items', requestType ? { courseId, request_type: requestType } : { courseId }),
  removeItem: (courseId) => api.delete(`/cart/items/${courseId}`),
  clear: () => api.delete('/cart/clear'),
};

// Payments endpoints
export const paymentsAPI = {
  // ICICI payment methods
  icici: {
    createPayment: (data) => api.post('/payments/icici/create-payment', data),
  },
  // Legacy Razorpay methods (to be removed)
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
  testPurchase: (courseIds) => api.post('/payments/test-purchase', { courseIds }),
  getHistory: () => api.get('/payments/history'),
};

// Videos endpoints
export const videosAPI = {
  getById: (id) => api.get(`/videos/${id}`),
};

// Ratings endpoints
export const ratingsAPI = {
  submit: (data) => api.post('/ratings', data),
  getByCourse: (courseId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/ratings/course/${courseId}${queryString ? `?${queryString}` : ''}`);
  },
  getMyRating: (courseId) => api.get(`/ratings/course/${courseId}/my-rating`),
};

// Dashboard endpoints
export const dashboardAPI = {
  getNotices: () => api.get('/dashboard/notices', { requireAuth: true }),
};

export default {
  auth: authAPI,
  courses: coursesAPI,
  cart: cartAPI,
  payments: paymentsAPI,
  videos: videosAPI,
  ratings: ratingsAPI,
  dashboard: dashboardAPI,
};

