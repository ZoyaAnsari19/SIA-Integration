"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { OtpCountdown } from "@/components/ui/OtpCountdown";
import {
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
} from "@/lib/api/auth";
import { getUserFriendlyError } from "@/lib/api/errors";

type Step = "email" | "verify" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await forgotPasswordSendOtp(email);
      setOtpExpiry(600);
      setStep("verify");
      setErrors({});
      if (result.email_masked) {
        setErrors({ info: `OTP sent to ${result.email_masked}` });
      }
    } catch (error: any) {
      setErrors({ general: getUserFriendlyError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      await forgotPasswordSendOtp(email);
      setOtpExpiry(600);
    } catch (error: any) {
      setErrors({ general: getUserFriendlyError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) {
      setErrors({ otp: "OTP is required" });
      return;
    }
    if (otp.length !== 6) {
      setErrors({ otp: "OTP must be 6 digits" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await forgotPasswordVerifyOtp(email, otp);
      setResetToken(response.resetToken);
      setStep("reset");
    } catch (error: any) {
      setErrors({ otp: getUserFriendlyError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!newPassword) {
      newErrors.newPassword = "Password is required";
    } else if (newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await forgotPasswordReset(email, resetToken, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      setErrors({ general: getUserFriendlyError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
      <div className="w-full max-w-md p-6 md:p-8 lg:p-12">
        <div className="mb-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32 md:w-40 md:h-40">
              <Image
                src="/SIA-png-logo.png"
                alt="Secure Infinite Association Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-purple-900 mb-2">
            Reset Password
          </h1>
          <p className="text-zinc-600 text-sm md:text-base">
            {step === "email" && "Enter your registered email to receive OTP"}
            {step === "verify" && "Enter the OTP sent to your email"}
            {step === "reset" && "Enter your new password"}
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-600">
                Password reset successfully! Redirecting to login...
              </p>
            </div>
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            <div>
              <Input
                label="Email Address"
                type="email"
                name="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    delete next.general;
                    return next;
                  });
                }}
                error={errors.email}
                required
                className="text-base"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-zinc-500">
                We&apos;ll send an OTP to this email address
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send OTP
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}
            {errors.info && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">{errors.info}</p>
              </div>
            )}

            <div>
              <Input
                label="Enter OTP"
                type="text"
                name="otp"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  if (value.length <= 6) {
                    setOtp(value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.otp;
                      return next;
                    });
                  }
                }}
                error={errors.otp}
                required
                className="text-base text-center text-2xl tracking-widest"
                disabled={isLoading}
                maxLength={6}
              />
              {otpExpiry > 0 && (
                <div className="mt-2">
                  <OtpCountdown
                    seconds={otpExpiry}
                    onExpire={() => setOtpExpiry(0)}
                    className="justify-center"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isLoading || otpExpiry > 0}
                className="text-sm text-purple-600 hover:text-purple-700 transition-colors disabled:text-zinc-400 disabled:cursor-not-allowed"
              >
                Resend OTP
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setOtpExpiry(0);
                    setErrors({});
                  }}
                  className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Change email
                </button>
              </div>
            </div>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? "text" : "password"}
                name="newPassword"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.newPassword;
                    return next;
                  });
                }}
                error={errors.newPassword}
                required
                className="text-base pr-12"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.confirmPassword;
                    return next;
                  });
                }}
                error={errors.confirmPassword}
                required
                className="text-base pr-12"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-9 text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-500">© 2025 Secure Infinite Association</p>
        </div>
      </div>
    </div>
  );
}
