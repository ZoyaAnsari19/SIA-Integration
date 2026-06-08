'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate mobile number (10 digits)
      if (!/^[0-9]{10}$/.test(mobile)) {
        setError('Please enter a valid 10-digit mobile number');
        setLoading(false);
        return;
      }

      console.log('Attempting login with:', { mobile, password: '***' });
      const result = await login(mobile, password);
      console.log('Login result:', result);
      if (result.success) {
        const redirectParam = searchParams.get('redirect');
        const redirectTo = redirectParam && redirectParam.startsWith('/')
          ? redirectParam
          : '/';
        router.push(redirectTo);
      } else {
        const errorMsg = result.error || 'Login failed. Please check your credentials.';
        setError(errorMsg);
        console.error('Login failed:', errorMsg);
    }
    } catch (err) {
      const errorMsg = err.message || 'An error occurred. Please try again.';
      setError(errorMsg);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>Login</h2>
      <p className="auth-card-subtitle">Provide your valid login credentials.</p>

      {error && (
        <div style={{ 
          padding: '12px', 
          marginBottom: '16px', 
          backgroundColor: '#fee', 
          color: '#c33', 
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="login-mobile">Mobile Number</label>
          <input
            id="login-mobile"
            type="tel"
            placeholder="Enter your 10-digit mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            required
            disabled={loading}
            maxLength={10}
            pattern="[0-9]{10}"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <button type="submit" className="auth-primary-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <a href="/forgot-password" className="auth-secondary-btn">
          Forgot password
        </a>
      </form>

      <p className="auth-switch-text">
        Do not have an account? <a href="/register">Sign up</a>
      </p>
    </div>
  );
}


