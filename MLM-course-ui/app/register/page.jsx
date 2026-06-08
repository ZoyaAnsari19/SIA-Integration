'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../lib/api';
import toast from 'react-hot-toast';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    mobile: '', // Changed from phone to mobile (10 digits required)
    referrerId: 'SIA00001', // Default referrer ID
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0); // Timer in seconds (5 minutes = 300 seconds)
  const [isReferrerFromUrl, setIsReferrerFromUrl] = useState(false); // Track if referrer ID came from URL
  const [referrerName, setReferrerName] = useState(null); // Referrer name fetched from API
  const [fetchingReferrerName, setFetchingReferrerName] = useState(false); // Loading state for fetching referrer name

  // Function to fetch referrer name (memoized with useCallback)
  const fetchReferrerName = useCallback(async (displayId) => {
    if (!displayId || displayId === 'SIA00001') {
      setReferrerName(null);
      return;
    }

    setFetchingReferrerName(true);
    try {
      const response = await authAPI.getReferrerName(displayId);
      console.log('Referrer API response:', response); // Debug log
      if (response && response.name) {
        setReferrerName(response.name);
      } else {
        setReferrerName(null);
      }
    } catch (error) {
      console.error('Error fetching referrer name:', error); // Debug log
      // If referrer not found or error, clear the name
      setReferrerName(null);
    } finally {
      setFetchingReferrerName(false);
    }
  }, []);

  // Auto-detect referral ID from URL parameter
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      // Auto-fill referrer ID from URL and mark it as non-editable
      const referrerId = refParam.trim().toUpperCase();
      setFormData((prev) => ({
        ...prev,
        referrerId, // Convert to uppercase for display_id format (e.g., SIA02047)
      }));
      setIsReferrerFromUrl(true); // Mark that referrer came from URL
      // Fetch referrer name for URL-based referrer immediately (no debounce)
      fetchReferrerName(referrerId);
    }
  }, [searchParams, fetchReferrerName]);

  // Fetch referrer name when referrer ID changes (debounced) - only for manual input
  useEffect(() => {
    // Skip if referrer came from URL (already handled in first useEffect)
    if (isReferrerFromUrl) {
      return;
    }

    const referrerId = formData.referrerId?.trim().toUpperCase();
    
    // Reset referrer name if referrer ID is empty or default
    if (!referrerId || referrerId === 'SIA00001') {
      setReferrerName(null);
      return;
    }

    // Debounce the API call for manual input
    const timeoutId = setTimeout(() => {
      fetchReferrerName(referrerId);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.referrerId, isReferrerFromUrl, fetchReferrerName]);

  // OTP Timer countdown
  useEffect(() => {
    let interval = null;
    if (otpSent && !otpVerified && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (otpTimer === 0 && otpSent && !otpVerified) {
      // Timer expired - show error but keep OTP field visible
      setError('OTP expired. Please request a new OTP.');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSent, otpVerified, otpTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Reset OTP verification if email changes
    if (name === 'email') {
      setOtpSent(false);
      setOtpVerified(false);
      setOtp('');
      setOtpTimer(0);
      setVerificationToken('');
    }
  };

  const handleSendOTP = async () => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setSendingOtp(true);
    setError('');
    try {
      const response = await authAPI.sendEmailOTP(formData.email);
      if (response.success) {
        setOtpSent(true);
        setOtpTimer(600); // 10 minutes
        setOtp('');
        const masked = response.email_masked || formData.email;
        toast.success(`OTP sent to ${masked}. Valid for 10 minutes.`);
      } else {
        setError(response.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || !/^\d{6}$/.test(otp)) {
      setError('OTP must be 6 digits');
      return;
    }

    setVerifyingOtp(true);
    setError('');
    try {
      const response = await authAPI.verifyEmailOTP(formData.email, otp);
      if (response.success && response.verified) {
        setOtpVerified(true);
        setOtpTimer(0);
        setVerificationToken(response.verificationToken || '');
        toast.success('Email verified successfully');
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate mobile number (10 digits)
      if (!formData.mobile || !/^\d{10}$/.test(formData.mobile)) {
        setError('Mobile number must be exactly 10 digits');
        setLoading(false);
        return;
      }

      if (!otpVerified) {
        setError('Please verify your email with OTP first');
        setLoading(false);
        return;
      }

      // Validate password match
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const name = `${formData.firstName} ${formData.lastName}`.trim();
      const result = await register(
        name, 
        formData.email, 
        formData.password, 
        formData.mobile,
        formData.referrerId,
        verificationToken // Pass verification token
      );

      if (result.success) {
        toast.success(`Registration successful! Your ID: ${result.user?.display_id || 'Assigned'}. Please log in to continue.`);
        router.push('/login');
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="container">
          <h1>Registration form</h1>
          <p className="auth-hero-subtitle">Sign up and start learning.</p>
        </div>
      </section>

      <section className="auth-section">
        <div className="container auth-single">
          <div className="auth-card">
            <h2>Register</h2>
            <p className="auth-card-subtitle">Sign up and start learning.</p>

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
              <div className="auth-field-grid">
                <div className="auth-field">
                  <label htmlFor="signup-first-name">First name</label>
                  <input
                    id="signup-first-name"
                    name="firstName"
                    type="text"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="signup-last-name">Last name</label>
                  <input
                    id="signup-last-name"
                    name="lastName"
                    type="text"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="signup-email">Email *</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading || otpVerified}
                    style={{ flex: 1 }}
                  />
                  {!otpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={sendingOtp || !formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) || loading || (otpSent && otpTimer > 0)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: (otpSent && otpTimer > 0) ? '#6b7280' : '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (sendingOtp || !formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) || (otpSent && otpTimer > 0)) ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        opacity: (sendingOtp || !formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) || (otpSent && otpTimer > 0)) ? 0.6 : 1
                      }}
                    >
                      {sendingOtp ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  )}
                </div>
                {otpSent && !otpVerified && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label htmlFor="signup-otp" style={{ display: 'block', fontSize: '14px' }}>Enter OTP *</label>
                      {otpTimer > 0 && (
                        <span style={{ fontSize: '12px', color: otpTimer < 60 ? '#ef4444' : '#666', fontWeight: '500' }}>
                          Time remaining: {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                      {otpTimer === 0 && otpSent && (
                        <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '500' }}>
                          OTP expired
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        id="signup-otp"
                        type="text"
                        placeholder="Enter 6 digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        pattern="\d{6}"
                        disabled={loading || verifyingOtp || otpTimer === 0}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          opacity: otpTimer === 0 ? 0.6 : 1
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        disabled={verifyingOtp || !otp || !/^\d{6}$/.test(otp) || loading || otpTimer === 0}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: otpTimer === 0 ? '#6b7280' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (verifyingOtp || !otp || !/^\d{6}$/.test(otp) || otpTimer === 0) ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          whiteSpace: 'nowrap',
                          opacity: (verifyingOtp || !otp || !/^\d{6}$/.test(otp) || otpTimer === 0) ? 0.6 : 1
                        }}
                      >
                        {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                  </div>
                )}
                {otpVerified && (
                  <div style={{ marginTop: '8px', color: '#10b981', fontSize: '14px', fontWeight: '500' }}>
                    ✓ Email verified
                  </div>
                )}
              </div>
              <div className="auth-field">
                <label htmlFor="signup-password">Password</label>
                <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  name="password"
                    type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  disabled={loading}
                    style={{ paddingRight: '40px', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#666'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="signup-confirm-password">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={6}
                    disabled={loading}
                    style={{ paddingRight: '40px', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#666'
                    }}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Passwords do not match
                  </small>
                )}
              </div>
              <div className="auth-field">
                <label htmlFor="signup-mobile">Mobile Number *</label>
                <input
                  id="signup-mobile"
                  name="mobile"
                  type="tel"
                  placeholder="Enter 10 digit mobile number"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  pattern="\d{10}"
                  maxLength={10}
                  disabled={loading}
                />
                <small style={{ color: '#666', fontSize: '12px' }}>10 digit mobile number required</small>
              </div>
              <div className="auth-field">
                <label htmlFor="signup-referrer">
                  {isReferrerFromUrl ? 'Referrer ID' : 'Referrer ID (Optional)'}
                </label>
                <input
                  id="signup-referrer"
                  name="referrerId"
                  type="text"
                  placeholder="Enter referrer ID (e.g., SIA02047) or leave as 'SIA00001'"
                  value={formData.referrerId}
                  onChange={handleChange}
                  disabled={loading || isReferrerFromUrl}
                  style={{
                    opacity: isReferrerFromUrl ? 0.7 : 1,
                    cursor: isReferrerFromUrl ? 'not-allowed' : 'text'
                  }}
                />
                <small style={{ color: '#666', fontSize: '12px' }}>
                  {isReferrerFromUrl 
                    ? `✓ Auto-filled from referral link: ${searchParams.get('ref')} (Cannot be changed)`
                    : "Enter referrer ID (e.g., SIA02047) or leave as 'SIA00001' for default"}
                </small>
                {/* Display referrer name if available */}
                {formData.referrerId && formData.referrerId.trim().toUpperCase() !== 'SIA00001' && (
                  <div style={{ marginTop: '8px' }}>
                    {fetchingReferrerName ? (
                      <small style={{ color: '#666', fontSize: '12px', fontStyle: 'italic' }}>
                        Loading referrer name...
                      </small>
                    ) : referrerName ? (
                      <small style={{ color: '#10b981', fontSize: '12px', fontWeight: '500', display: 'block' }}>
                        ✓ Referrer: <strong>{referrerName}</strong>
                      </small>
                    ) : formData.referrerId.trim().length > 0 && !fetchingReferrerName ? (
                      <small style={{ color: '#ef4444', fontSize: '12px' }}>
                        ⚠️ Referrer ID not found
                      </small>
                    ) : null}
                  </div>
                )}
              </div>
              <button type="submit" className="auth-primary-btn" disabled={loading}>
                {loading ? 'Signing up...' : 'Sign up'}
              </button>
            </form>

            <p className="auth-switch-text">
              Already have an account? <a href="/login">Login</a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="auth-page">
        <section className="auth-section">
          <div className="container auth-single">
            <div className="auth-card">
              <p>Loading...</p>
            </div>
          </div>
        </section>
      </main>
    }>
      <RegisterContent />
    </Suspense>
  );
}


