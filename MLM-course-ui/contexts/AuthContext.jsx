'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../lib/api';
import api from '../lib/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize with token check - this is synchronous and prevents hydration issues
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const checkingRef = useRef(false);

  // Set mounted state on client side only
  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Prevent multiple simultaneous checks
    if (checkingRef.current) {
      return;
    }
    
    try {
      checkingRef.current = true;
      setLoading(true);
      
      // Synchronously check for token first
      const token = api.getToken();
      
      if (!token) {
        setUser(null);
        setLoading(false);
        checkingRef.current = false;
        return;
      }

      // Token exists - verify it with server
      try {
        const data = await authAPI.getMe();
        setUser(data.user);
      } catch (error) {
        // Only remove token if it's a 401 (unauthorized) error
        if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
          console.log('AuthContext: Token expired or invalid, removing token');
          api.removeToken();
          setUser(null);
        } else {
          // Network error - keep token but clear user
          console.warn('AuthContext: Error fetching user data:', error.message);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('AuthContext: Error in checkAuth:', error);
      setUser(null);
    } finally {
      setLoading(false);
      checkingRef.current = false;
    }
  };

  const login = async (email, password) => {
    try {
      console.log('AuthContext: Calling authAPI.login with:', { email });
      // Updated for unified MLM-API: use userId instead of email
      const data = await authAPI.login({ userId: email, password });
      console.log('AuthContext: Login API response:', data);
      if (data.token) {
        api.setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: 'No token received from server' };
      }
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (name, email, password, mobile, referrerUserId = 'SIA00001', verificationToken = null) => {
    try {
      const registerData = { 
        name, 
        email, 
        password, 
        mobile,
        referrer_user_id: referrerUserId 
      };
      
      if (verificationToken) {
        registerData.email_verified_token = verificationToken;
      }
      
      const data = await authAPI.register(registerData);
      // Do NOT auto-login on register; just confirm success
      return { success: true, user: data, message: 'Registration successful!' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    // Clear token and user state
    api.removeToken();
    setUser(null);
    setLoading(false); // Ensure loading is false
    checkingRef.current = false; // Reset checking flag
    
    // Force redirect to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const value = {
    user,
    loading: loading || !mounted, // Show loading until mounted on client
    login,
    register,
    logout,
    isAuthenticated: !!user && mounted, // Only authenticated if user exists AND mounted
    checkAuth,
  };

  // Don't render children until mounted (prevents hydration mismatch)
  if (!mounted) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

