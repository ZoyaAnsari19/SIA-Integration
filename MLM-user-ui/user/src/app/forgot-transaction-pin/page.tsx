"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2, CheckCircle2, Phone, Lock, Clock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { OtpCountdown } from "@/components/ui/OtpCountdown";
import {
  forgotTransactionPinSendOtp,
  forgotTransactionPinVerifyOtp,
  forgotTransactionPinReset,
} from "@/lib/api/auth";
import { getUserFriendlyError } from "@/lib/api/errors";

type Step = "mobile" | "verify" | "reset";

export default function ForgotTransactionPinPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0); // Cooldown in seconds (60 seconds = 1 minute)
  const [feeAmount, setFeeAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Countdown timer effect for OTP expiry
  useEffect(() => {
    if (otpTimeLeft > 0 && step === "verify") {
      const timer = setInterval(() => {
        setOtpTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpTimeLeft, step]);

  // Countdown timer effect for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0 && step === "verify") {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown, step]);

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mobile.trim()) {
      setErrors({ mobile: "Mobile number is required" });
      return;
    }

    const cleanMobile = mobile.replace(/^\+91/, "").replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      setErrors({ mobile: "Please enter a valid 10-digit mobile number" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await forgotTransactionPinSendOtp(cleanMobile);
      setMobile(cleanMobile);
      setFeeAmount(response.fee_amount || 0);
      setOtpSent(true);
      setOtpExpiry(300); // 5 minutes
      setOtpTimeLeft(300); // 5 minutes
      setResendCooldown(300); // 5 minutes cooldown before resend is allowed
      setStep("verify");
    } catch (error: any) {
      const errorMessage = getUserFriendlyError(error);
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await forgotTransactionPinSendOtp(mobile);
      setFeeAmount(response.fee_amount || 0);
      setOtpExpiry(300); // Reset to 5 minutes
      setOtpTimeLeft(300); // Reset to 5 minutes
      setResendCooldown(300); // Reset cooldown to 5 minutes
      setOtpSent(true);
      setErrors({});
    } catch (error: any) {
      const errorMessage = getUserFriendlyError(error);
      setErrors({ general: errorMessage });
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
      const response = await forgotTransactionPinVerifyOtp(mobile, otp);
      setResetToken(response.resetToken);
      setStep("reset");
    } catch (error: any) {
      const errorMessage = getUserFriendlyError(error);
      setErrors({ otp: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    const pinRegex = /^\d{4,6}$/;
    if (!newPin) {
      newErrors.newPin = "PIN is required";
    } else if (!pinRegex.test(newPin)) {
      newErrors.newPin = "PIN must be 4 to 6 digits only";
    }

    if (!confirmPin) {
      newErrors.confirmPin = "Please confirm your PIN";
    } else if (newPin !== confirmPin) {
      newErrors.confirmPin = "PINs do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await forgotTransactionPinReset(mobile, resetToken, newPin, confirmPin);
      setSuccess(true);
      // Redirect to password page after 2 seconds
      setTimeout(() => {
        router.push("/password");
      }, 2000);
    } catch (error: any) {
      const errorMessage = getUserFriendlyError(error);
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
      <div className="w-full max-w-md p-6 md:p-8 lg:p-12">
        {/* Logo and Header */}
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
            Reset Transaction PIN
          </h1>
          <p className="text-zinc-600 text-sm md:text-base">
            {step === "mobile" && "Enter your mobile number to receive OTP"}
            {step === "verify" && "Enter the OTP sent to your mobile number"}
            {step === "reset" && "Enter your new transaction PIN"}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-600">
                Transaction PIN reset successfully! Redirecting...
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Mobile Number */}
        {step === "mobile" && (
          <form onSubmit={handleMobileSubmit} className="space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            <div>
              <Input
                label="Mobile Number"
                type="tel"
                name="mobile"
                placeholder="Enter 10-digit mobile number"
                value={mobile}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  if (value.length <= 10) {
                    setMobile(value);
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.mobile;
                      return newErrors;
                    });
                  }
                }}
                error={errors.mobile}
                required
                className="text-base"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-zinc-500">
                We'll send an OTP to this mobile number
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
                  <Phone className="w-5 h-5 mr-2" />
                  Send OTP
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/password"
                className="flex items-center justify-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Password Settings
              </Link>
            </div>
          </form>
        )}

        {/* Step 2: Verify OTP */}
        {step === "verify" && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {feeAmount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> A fee of ₹{feeAmount.toFixed(2)} will be charged from your wallet after OTP verification.
                </p>
              </div>
            )}

            <div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-black dark:text-white" style={{ color: '#000000' }}>
                  Enter OTP
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <Input
                  type="text"
                  name="otp"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value.length <= 6) {
                      setOtp(value);
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.otp;
                        return newErrors;
                      });
                    }
                  }}
                  error={errors.otp}
                  required
                  className="text-base text-center text-2xl tracking-widest"
                  disabled={isLoading}
                  maxLength={6}
                />
              </div>
              {otpTimeLeft > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-center gap-1.5 text-sm">
                    <Clock className="w-3.5 h-3.5 text-black dark:text-white" style={{ color: '#000000' }} />
                    <span className="text-black dark:text-white font-bold" style={{ color: '#000000' }}>
                      Expires in <span className="font-bold text-black dark:text-white" style={{ color: '#000000', fontWeight: '700' }}>
                        {Math.floor(otpTimeLeft / 60)}:{String(otpTimeLeft % 60).padStart(2, "0")}
                      </span>
                    </span>
                  </div>
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
              {resendCooldown > 0 ? (
                <button
                  type="button"
                  disabled
                  className="text-sm text-gray-400 cursor-not-allowed font-medium"
                >
                  Resend OTP ({Math.floor(resendCooldown / 60)}:{String(resendCooldown % 60).padStart(2, "0")})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-sm text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Resend OTP
                </button>
              )}
              <div>
                <Link
                  href="/password"
                  className="flex items-center justify-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Password Settings
                </Link>
              </div>
            </div>
          </form>
        )}

        {/* Step 3: Reset PIN */}
        {step === "reset" && (
          <form onSubmit={handleResetPin} className="space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            <div className="relative">
              <div className="flex flex-col gap-1.5 mb-1.5">
                <label className="text-sm font-medium" style={{ color: '#111827' }}>
                  New Transaction PIN (4-6 Digits) <span className="text-red-500 ml-1">*</span>
                </label>
              </div>
              <Input
                type={showNewPin ? "text" : "password"}
                name="newPin"
                placeholder="Enter new PIN"
                value={newPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  setNewPin(value);
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.newPin;
                    return newErrors;
                  });
                }}
                error={errors.newPin}
                required
                className="text-base pr-12"
                disabled={isLoading}
                inputMode="numeric"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute right-3 top-0 text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label={showNewPin ? "Hide PIN" : "Show PIN"}
              >
                {showNewPin ? "🙈" : "👁️"}
              </button>
            </div>
            <p className="text-xs text-zinc-500 -mt-4">
              PIN must be 4 to 6 digits only
            </p>

            <div className="relative">
              <div className="flex flex-col gap-1.5 mb-1.5">
                <label className="text-sm font-medium" style={{ color: '#111827' }}>
                  Confirm Transaction PIN <span className="text-red-500 ml-1">*</span>
                </label>
              </div>
              <Input
                type={showConfirmPin ? "text" : "password"}
                name="confirmPin"
                placeholder="Confirm new PIN"
                value={confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  setConfirmPin(value);
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.confirmPin;
                    return newErrors;
                  });
                }}
                error={errors.confirmPin}
                required
                className="text-base pr-12"
                disabled={isLoading}
                inputMode="numeric"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute right-3 top-0 text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label={showConfirmPin ? "Hide PIN" : "Show PIN"}
              >
                {showConfirmPin ? "🙈" : "👁️"}
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
                  Resetting PIN...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Reset Transaction PIN
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/password"
                className="flex items-center justify-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Password Settings
              </Link>
            </div>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-500">© 2025 Secure Infinite Association</p>
        </div>
      </div>
    </div>
  );
}

