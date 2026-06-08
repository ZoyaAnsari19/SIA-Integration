"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, CheckCircle2, Loader2, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { OtpCountdown } from "@/components/ui/OtpCountdown";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { Dialog } from "@/components/ui/Dialog";
import { useAppSelector } from "@/redux/hooks";
import { getUserProfile } from "@/lib/api/kyc";
import { sendEmailOTP, verifyEmailOTP, register, getSponsorDetails } from "@/lib/api/auth";
import { useRouter } from "next/navigation";

export default function NewJoinPage() {
  /**
   * TODO: MOCK DATA - Replace with actual API calls
   *
   * Fetch Sponsor Details Endpoint: GET /api/user/sponsor-details/:sponsorId
   * Method: GET
   * Headers: { Authorization: "Bearer <token>" }
   * Path Parameters:
   *   - sponsorId: string
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "SIA00364",
   *     "name": "Priyanka Tejram Gajbhiye",
   *     "username": "priyanka.gajbhiye"
   *   }
   * }
   *
   * Error Response (if sponsor not found):
   * {
   *   "success": false,
   *   "message": "Sponsor not found"
   * }
   *
   * Submit Registration Endpoint: POST /api/register/new-member
   * Method: POST
   * Headers: { Authorization: "Bearer <token>", "Content-Type": "application/json" }
   *
   * Request Body:
   * {
   *   "sponsorId": "SIA00364",
   *   "fullName": "New Member Name",
   *   "email": "newmember@example.com",
   *   "mobile": "9876543210",
   *   "password": "****",
   *   "otp": "123456"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Member registered successfully!",
   *   "data": {
   *     "userId": "SIAXXXXX",
   *     "name": "New Member Name",
   *     "email": "newmember@example.com",
   *     "mobile": "9876543210"
   *   }
   * }
   *
   * Send OTP Endpoint: POST /api/auth/send-otp
   * Method: POST
   * Headers: { "Content-Type": "application/json" }
   *
   * Request Body:
   * {
   *   "mobile": "9876543210"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "OTP sent successfully",
   *   "data": {
   *     "mobile": "9876543210",
   *     "otpExpiry": 300
   *   }
   * }
   */
  const { showToast, ToastComponent } = useToast();
  const user = useAppSelector((state) => state.auth.user);
  const router = useRouter();

  const [formData, setFormData] = useState({
    sponsorId: "",
    sponsorName: "",
    fullName: "",
    email: "",
    mobile: "",
    otp: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [registrationTimer, setRegistrationTimer] = useState(0); // 10 minutes timer after OTP verification
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSponsor, setIsLoadingSponsor] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");

  // Fetch logged-in user's profile to set sponsor ID and name
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const profile = await getUserProfile();
        const displayId = user?.display_id || profile?.id || user?.id || "";
        
        // Fetch sponsor details to get numeric ID and name
        if (displayId) {
          try {
            const sponsorDetails = await getSponsorDetails(displayId);
            setFormData((prev) => ({
              ...prev,
              sponsorId: displayId,
              sponsorName: sponsorDetails.name || user?.name || profile?.name || "",
            }));
          } catch (error) {
            // If sponsor lookup fails, use display_id and name from profile
            setFormData((prev) => ({
              ...prev,
              sponsorId: displayId,
              sponsorName: user?.name || profile?.name || "",
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
        // Fallback to user from Redux store
        const displayId = user?.display_id || user?.id || "";
        const userName = user?.name || "";
        setFormData((prev) => ({
          ...prev,
          sponsorId: displayId,
          sponsorName: userName,
        }));
      }
    };

    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    // Reset OTP verification if email changes
    if (name === "email" && otpVerified) {
      setOtpVerified(false);
      setOtpSent(false);
      setOtpExpiry(0);
      setRegistrationTimer(0);
      setEmailVerificationToken("");
      setFormData((prev) => ({ ...prev, otp: "" }));
    }
  };

  // Debounced sponsor lookup
  const fetchSponsorDetails = useCallback(async (sponsorId: string) => {
    if (!sponsorId || sponsorId.length < 3) {
      setFormData((prev) => ({ ...prev, sponsorName: "" }));
      return;
    }

    setIsLoadingSponsor(true);
    try {
      const sponsorDetails = await getSponsorDetails(sponsorId);
      setFormData((prev) => ({
        ...prev,
        sponsorName: sponsorDetails.name || "",
      }));
    } catch (error: any) {
      setFormData((prev) => ({ ...prev, sponsorName: "" }));
      const errorMsg = error?.response?.data?.error === 'sponsor_not_found' 
        ? "Sponsor not found" 
        : "Failed to fetch sponsor details";
      showToast(errorMsg, "error");
    } finally {
      setIsLoadingSponsor(false);
    }
  }, [showToast]);

  // Debounce sponsor lookup (only if sponsor ID is changed manually)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only fetch if sponsor ID is manually changed and different from logged-in user
      const currentUserDisplayId = user?.display_id || user?.id || "";
      if (formData.sponsorId && formData.sponsorId !== currentUserDisplayId) {
        fetchSponsorDetails(formData.sponsorId);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.sponsorId, fetchSponsorDetails, user]);

  // Registration timer countdown (10 minutes after OTP verification)
  useEffect(() => {
    if (registrationTimer > 0 && otpVerified) {
      const timer = setInterval(() => {
        setRegistrationTimer((prev) => {
          if (prev <= 1) {
            // Timer expired - show refresh dialog
            setShowRefreshDialog(true);
            setOtpVerified(false);
            setEmailVerificationToken("");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [registrationTimer, otpVerified]);

  // Handle refresh page
  const handleRefreshPage = () => {
    window.location.reload();
  };

  const handleGetOtp = async () => {
    if (!formData.email.trim()) {
      setErrors((prev) => ({ ...prev, email: "Email is required" }));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      return;
    }

    setIsSendingOtp(true);
    try {
      const result = await sendEmailOTP(formData.email);
      setOtpSent(true);
      setOtpExpiry(600); // 10 minutes
      setOtpVerified(false);
      setEmailVerificationToken("");
      setFormData((prev) => ({ ...prev, otp: "" }));
      const masked = result.email_masked || formData.email;
      showToast(`OTP sent to ${masked}`, "success");
    } catch (error: any) {
      const apiError = error?.response?.data;
      const errorMsg =
        apiError?.error === "email_already_exists"
          ? "This email is already registered. Please login or use a different email."
          : apiError?.message || error?.message || "Failed to send OTP. Please try again.";
      showToast(errorMsg, "error");
      setErrors((prev) => ({ ...prev, email: errorMsg }));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!formData.otp.trim()) {
      setErrors((prev) => ({ ...prev, otp: "Please enter OTP" }));
      return;
    }
    if (formData.otp.length !== 6) {
      setErrors((prev) => ({ ...prev, otp: "OTP must be 6 digits" }));
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const result = await verifyEmailOTP(formData.email, formData.otp);
      if (result.verified) {
        setOtpVerified(true);
        setEmailVerificationToken(result.verificationToken || "");
        setRegistrationTimer(600);
        showToast("Email verified successfully", "success");
      } else {
        setErrors((prev) => ({ ...prev, otp: "Invalid OTP" }));
        showToast("Invalid OTP. Please try again.", "error");
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error === 'otp_expired' 
        ? "OTP has expired. Please request a new one."
        : error?.response?.data?.error === 'invalid_otp'
        ? "Invalid OTP. Please try again."
        : error?.response?.data?.error === 'otp_not_found'
        ? "OTP not found. Please request a new one."
        : "OTP verification failed. Please try again.";
      setErrors((prev) => ({ ...prev, otp: errorMsg }));
      showToast(errorMsg, "error");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = () => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtpExpiry(0);
    setRegistrationTimer(0);
    setEmailVerificationToken("");
    setFormData((prev) => ({ ...prev, otp: "" }));
    handleGetOtp();
  };

  const handleOtpExpire = () => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtpExpiry(0);
    setEmailVerificationToken("");
    setFormData((prev) => ({ ...prev, otp: "" }));
    showToast("OTP expired. Please request a new one.", "warning");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full Name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = "Mobile number is required";
    } else if (formData.mobile.length !== 10) {
      newErrors.mobile = "Please enter a valid 10-digit mobile number";
    }
    if (!otpVerified) {
      newErrors.otp = "Please verify your email with OTP";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to first error
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get sponsor numeric ID from display_id
      let referrerUserId: string;
      try {
        const sponsorDetails = await getSponsorDetails(formData.sponsorId);
        referrerUserId = sponsorDetails.id;
      } catch (error) {
        showToast("Invalid sponsor ID. Please check and try again.", "error");
        setIsSubmitting(false);
        return;
      }

      // Register new user
      const result = await register({
        name: formData.fullName,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password,
        referrer_user_id: referrerUserId,
        email_verified_token: emailVerificationToken || undefined,
      });

      showToast(`Member registered successfully! User ID: ${result.display_id || result.id}`, "success", 30000);
      
      // Clear registration timer on successful registration
      setRegistrationTimer(0);
      
      // Reset form after success (keep sponsor ID and name as logged-in user)
      setTimeout(() => {
        const displayId = user?.display_id || user?.id || "";
        const userName = user?.name || "";
        setFormData({
          sponsorId: displayId,
          sponsorName: userName,
          fullName: "",
          email: "",
          mobile: "",
          otp: "",
          password: "",
          confirmPassword: "",
        });
        setOtpSent(false);
        setOtpVerified(false);
        setOtpExpiry(0);
        setEmailVerificationToken("");
        setErrors({});
      }, 2000);
    } catch (error: any) {
      console.error("Registration error:", error);
      const errorMsg = error?.response?.data?.error === 'email_already_exists'
        ? "Email already exists. Please use a different email."
        : error?.response?.data?.error === 'invalid_referrer_user_id'
        ? "Invalid sponsor ID. Please check and try again."
        : error?.response?.data?.error === 'referrer_no_active_package'
        ? error?.response?.data?.message || "Sponsor must have an active package to add referrals."
        : error?.response?.data?.message || error?.message || "Registration failed. Please try again.";
      showToast(errorMsg, "error");
      setErrors((prev) => ({ ...prev, submit: errorMsg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format timer as MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {ToastComponent}
      {/* Registration Timer Dialog */}
      <Dialog
        isOpen={showRefreshDialog}
        onClose={() => setShowRefreshDialog(false)}
        title="OTP Expired"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[var(--text-body)]">
            OTP expired kindly refresh page and try again.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRefreshDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleRefreshPage}
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Registration Timer Display */}
      {otpVerified && registrationTimer > 0 && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Complete registration within:</span>
            <span className="text-lg font-bold font-mono">{formatTimer(registrationTimer)}</span>
          </div>
        </div>
      )}

      <div className="max-w-[900px] mx-auto animate-in fade-in duration-500">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--brand-blue)]" />
              New Member Joining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Sponsor ID */}
              <div className="relative">
                <Input
                  label="Sponsor ID"
                  type="text"
                  name="sponsorId"
                  value={formData.sponsorId}
                  onChange={handleChange}
                  placeholder="Enter sponsor ID"
                  error={errors.sponsorId}
                  className="bg-[var(--sidebar-hover)] cursor-not-allowed"
                  readOnly
                />
                {isLoadingSponsor && (
                  <div className="absolute right-3 top-9">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                  </div>
                )}
              </div>

              {/* Sponsor Name */}
              <Input
                label="Sponsor Name"
                type="text"
                name="sponsorName"
                value={formData.sponsorName}
                readOnly
                className="bg-[var(--sidebar-hover)] cursor-not-allowed"
                placeholder={isLoadingSponsor ? "Loading..." : "Will be fetched automatically"}
              />

              {/* Full Name */}
              <Input
                label="Full Name"
                type="text"
                name="fullName"
                placeholder="Enter full name"
                value={formData.fullName}
                onChange={handleChange}
                error={errors.fullName}
                required
              />

              {/* Email with OTP */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--text-body)]">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={otpVerified}
                    className={`w-full px-4 py-2.5 pr-24 sm:pr-28 border rounded-lg transition-colors bg-[var(--card-bg)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[var(--sidebar-hover)] disabled:cursor-not-allowed ${
                      errors.email
                        ? "border-red-300 focus:ring-red-500"
                        : "border-[var(--border)] hover:border-[var(--hover-border)]"
                    }`}
                  />
                  <Button
                    type="button"
                    onClick={handleGetOtp}
                    disabled={otpSent || otpVerified || isSendingOtp}
                    variant={otpVerified ? "secondary" : "primary"}
                    size="sm"
                    className="absolute right-1 top-1 bottom-1 whitespace-nowrap text-xs"
                  >
                    {isSendingOtp ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Sending...
                      </>
                    ) : otpVerified ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </>
                    ) : otpSent ? (
                      "Sent!"
                    ) : (
                      "Get OTP"
                    )}
                  </Button>
                </div>
                {errors.email && (
                  <span className="text-sm text-red-600">{errors.email}</span>
                )}
              </div>

              {/* Mobile */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--text-body)]">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    value="+91"
                    readOnly
                    className="w-[70px] sm:w-[70px] px-3 py-2.5 text-center border border-[var(--border)] rounded-lg bg-[var(--sidebar-hover)] text-[var(--text-strong)] cursor-not-allowed transition-colors font-medium"
                  />
                  <input
                    type="tel"
                    name="mobile"
                    placeholder="Enter mobile number"
                    value={formData.mobile}
                    onChange={handleChange}
                    maxLength={10}
                    className={`flex-1 min-w-0 px-4 py-2.5 border rounded-lg transition-colors bg-[var(--card-bg)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.mobile
                        ? "border-red-300 focus:ring-red-500"
                        : "border-[var(--border)] hover:border-[var(--hover-border)]"
                    }`}
                  />
                </div>
                {errors.mobile && (
                  <span className="text-sm text-red-600">{errors.mobile}</span>
                )}
              </div>

              {/* OTP Input */}
              {otpSent && !otpVerified && (
                <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        label="Enter OTP"
                        type="text"
                        name="otp"
                        placeholder="Enter 6-digit OTP"
                        value={formData.otp}
                        onChange={handleChange}
                        error={errors.otp}
                        maxLength={6}
                        className="text-center text-xl tracking-widest font-mono"
                      />
                    </div>
                    <div className="flex items-end gap-2 sm:flex-col sm:items-stretch">
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpVerified}
                        variant={otpVerified ? "secondary" : "primary"}
                        size="lg"
                        className="whitespace-nowrap"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Verifying...
                          </>
                        ) : otpVerified ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Verified
                          </>
                        ) : (
                          "Verify OTP"
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <OtpCountdown
                      seconds={otpExpiry}
                      onExpire={handleOtpExpire}
                    />
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    label="Create Password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    required
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {formData.password && (
                  <PasswordStrength password={formData.password} />
                )}
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                  required
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-9 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  "Submit Registration"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
