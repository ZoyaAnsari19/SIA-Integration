'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '../../lib/api';
import { toast } from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpTimer]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.sendForgotPasswordOTP(email);
      if (response.success) {
        const masked = response.email_masked || email;
        toast.success(`OTP sent to ${masked}`);
        setOtpTimer(600);
        setStep(2);
      } else {
        setError(response.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^[0-9]{6}$/.test(otp)) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyForgotPasswordOTP(email, otp);
      if (response.success && response.resetToken) {
        setResetToken(response.resetToken);
        toast.success('OTP verified successfully');
        setStep(3);
      } else {
        setError(response.error || 'Invalid or expired OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.resetPassword(email, resetToken, newPassword);
      if (response.success) {
        toast.success('Password reset successfully! Please login with your new password.');
        router.push('/login');
      } else {
        setError(response.error || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="container">
          <h1>Forgot password</h1>
          <p className="auth-hero-subtitle">
            {step === 1 && 'Provide your registered email to receive an OTP for password reset.'}
            {step === 2 && 'Enter the OTP sent to your email.'}
            {step === 3 && 'Enter your new password.'}
          </p>
        </div>
      </section>

      <section className="auth-section">
        <div className="container auth-single">
          <div className="auth-card">
            {step === 1 && (
              <>
                <h2>Reset your password</h2>
                <p className="auth-card-subtitle">Enter the email linked to your account.</p>

                {error && (
                  <div style={{
                    padding: '12px',
                    marginBottom: '16px',
                    backgroundColor: '#fee',
                    color: '#c33',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}>
                    {error}
                  </div>
                )}

                <form className="auth-form" onSubmit={handleSendOTP}>
                  <div className="auth-field">
                    <label htmlFor="forgot-email">Email Address</label>
                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your registered email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <button type="submit" className="auth-primary-btn" disabled={loading}>
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <h2>Verify OTP</h2>
                <p className="auth-card-subtitle">Enter the 6-digit OTP sent to your email</p>

                {error && (
                  <div style={{
                    padding: '12px',
                    marginBottom: '16px',
                    backgroundColor: '#fee',
                    color: '#c33',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}>
                    {error}
                  </div>
                )}

                <form className="auth-form" onSubmit={handleVerifyOTP}>
                  <div className="auth-field">
                    <label htmlFor="forgot-otp">OTP</label>
                    <input
                      id="forgot-otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={loading || otpTimer === 0}
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                    {otpTimer > 0 && (
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                        Time remaining: {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                      </small>
                    )}
                  </div>
                  <button type="submit" className="auth-primary-btn" disabled={loading || otpTimer === 0}>
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    className="auth-secondary-btn"
                    onClick={() => {
                      setStep(1);
                      setOtp('');
                      setOtpTimer(0);
                      setError('');
                    }}
                    disabled={loading}
                  >
                    Change Email
                  </button>
                </form>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Set New Password</h2>
                <p className="auth-card-subtitle">Enter your new password</p>

                {error && (
                  <div style={{
                    padding: '12px',
                    marginBottom: '16px',
                    backgroundColor: '#fee',
                    color: '#c33',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}>
                    {error}
                  </div>
                )}

                <form className="auth-form" onSubmit={handleResetPassword}>
                  <div className="auth-field">
                    <label htmlFor="new-password">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="confirm-password">Confirm Password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                    />
                  </div>
                  <button type="submit" className="auth-primary-btn" disabled={loading}>
                    {loading ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                </form>
              </>
            )}

            <p className="auth-switch-text">
              Want to go back? <a href="/login">Login</a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
