"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, Eye, EyeOff, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { login as loginApi, setTransactionPassword as setTransactionPasswordAPI } from "@/lib/api/auth";
import { getUserFriendlyError } from "@/lib/api/errors";
import { useAppDispatch } from "@/redux/hooks";
import { setUser } from "@/redux/features/auth/authSlice";
import { getMyPackages } from "@/lib/api/packages";
import { checkPackageAlerts, getPackageAlertMessage } from "@/lib/utils/packageAlerts";
import { AlertCircle } from "lucide-react";
import { SIAPolicyAgreementModal } from "@/components/auth/SIAPolicyAgreementModal";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState({
    userId: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ userId?: string; password?: string; general?: string }>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showTransactionPasswordModal, setShowTransactionPasswordModal] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState({
    pin: "",
    confirmPin: "",
  });
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showPackageAlert, setShowPackageAlert] = useState(false);
  const [packageAlertMessage, setPackageAlertMessage] = useState("");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [pendingAfterPolicy, setPendingAfterPolicy] = useState<"transaction_password" | "dashboard" | null>(null);

  // Prevent navigation when transaction password or policy modal is open (mandatory steps)
  useEffect(() => {
    if (showTransactionPasswordModal || showPolicyModal) {
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      };
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showTransactionPasswordModal, showPolicyModal]);

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: { userId?: string; password?: string } = {};
    if (!formData.userId.trim()) {
      newErrors.userId = "User ID is required";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await loginApi({
        userId: formData.userId.trim(),
        password: formData.password,
      });

      dispatch(setUser({ user: response.user, token: response.token }));

      const needsTransactionPassword = !response.user.has_transaction_password;
      setPendingAfterPolicy(needsTransactionPassword ? "transaction_password" : "dashboard");
      setShowPolicyModal(true);
    } catch (error: any) {
      const errorMessage =
        error?.userMessage || getUserFriendlyError(error) || "Login failed. Please try again.";
      setErrors({
        general: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolicyAgree = async () => {
    setShowPolicyModal(false);
    const action = pendingAfterPolicy;
    setPendingAfterPolicy(null);

    if (action === "transaction_password") {
      setShowTransactionPasswordModal(true);
      return;
    }

    if (action === "dashboard") {
      try {
        const packagesData = await getMyPackages();
        const alert = checkPackageAlerts(packagesData.items);
        if (alert.hasExpired || alert.hasHighProgress) {
          setPackageAlertMessage(getPackageAlertMessage(alert));
          setShowPackageAlert(true);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Error checking packages:", err);
        router.push("/dashboard");
      }
    }
  };

  const handleSetTransactionPassword = async () => {
    if (!transactionPassword.pin || !transactionPassword.confirmPin) {
      setPasswordError("Please enter both PIN and confirm PIN");
      return;
    }

    if (transactionPassword.pin.length < 4 || transactionPassword.pin.length > 6) {
      setPasswordError("PIN must be 4-6 digits");
      return;
    }

    if (transactionPassword.pin !== transactionPassword.confirmPin) {
      setPasswordError("PIN and confirm PIN do not match");
      return;
    }

    setIsSettingPassword(true);
    setPasswordError("");

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Calling setTransactionPassword API...');
      }
      await setTransactionPasswordAPI(transactionPassword.pin, transactionPassword.confirmPin);
      if (process.env.NODE_ENV === 'development') {
        console.log('Transaction password API call succeeded');
      }
      
      // Wait a bit to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update Redux store to mark transaction password as set
      const currentUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
      const updatedUser = { ...currentUser, has_transaction_password: true };
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Updating Redux with has_transaction_password: true');
      }
      
      dispatch(setUser({ user: updatedUser }));
      
      // Also update localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      }
      
      // Reset state before closing
      setTransactionPassword({ pin: "", confirmPin: "" });
      setPasswordError("");
      setShowTransactionPasswordModal(false);
      
      console.log('Redirecting to dashboard...');
      router.push("/dashboard");
    } catch (error: any) {
      console.error('Error setting transaction password:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      const errorMessage =
        error?.userMessage || getUserFriendlyError(error) || "Failed to set transaction password";
      setPasswordError(errorMessage);
    } finally {
      setIsSettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Login Form */}
      <div className="w-full max-w-md p-6 md:p-8 lg:p-12">
        {/* Logo and Welcome Section */}
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
          <h1 
            className="text-3xl md:text-4xl font-bold mb-2 leading-tight"
            style={{ color: '#581c87' }}
          >
            Welcome to Member Portal !
          </h1>
          <p className="text-zinc-600 text-sm md:text-base mt-2">
            Enter your credentials to access your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: '#111827' }}>
              User ID <span className="text-red-500 ml-1">*</span>
            </label>
          <Input
            type="text"
            name="userId"
            placeholder="Enter user id or email"
            value={formData.userId}
            onChange={handleChange}
            error={errors.userId}
            required
            className="text-base"
            disabled={isLoading}
          />
          </div>

          <div className="relative">
            <div className="flex flex-col gap-1.5 mb-1.5">
              <label className="text-sm font-medium" style={{ color: '#111827' }}>
                Password <span className="text-red-500 ml-1">*</span>
              </label>
            </div>
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              className="text-base pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-zinc-500 hover:text-zinc-700 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
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
                Logging in...
              </>
            ) : (
              "Log In"
            )}
          </Button>

          <div className="flex items-center justify-center pt-1">
            <Link
              href="/forgot-password"
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Forgot your password?
            </Link>
          </div>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-500">© 2025 Secure Infinite Association</p>
        </div>
      </div>

      {/* SIA Policy Agreement - Must agree after login before proceeding */}
      <SIAPolicyAgreementModal
        isOpen={showPolicyModal}
        onAgree={handlePolicyAgree}
      />

      {/* Transaction Password Setup Modal - Non-closable, user must set password to proceed */}
      {showTransactionPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Set Transaction Password
              </h2>
              {/* Close button removed - password is mandatory */}
            </div>
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                ⚠️ Transaction password is mandatory. You must set a password to continue.
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Transaction password is required for withdrawal requests. Please set a 4-6 digit PIN.
            </p>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{passwordError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                  Transaction PIN <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    placeholder="Enter 4-6 digit PIN"
                    value={transactionPassword.pin || ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 6) {
                        setTransactionPassword({ ...transactionPassword, pin: value });
                        setPasswordError("");
                      }
                    }}
                    maxLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                  Confirm PIN <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPin ? "text" : "password"}
                    placeholder="Confirm 4-6 digit PIN"
                    value={transactionPassword.confirmPin || ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 6) {
                        setTransactionPassword({ ...transactionPassword, confirmPin: value });
                        setPasswordError("");
                      }
                    }}
                    maxLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleSetTransactionPassword}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSettingPassword || !transactionPassword.pin || !transactionPassword.confirmPin}
              >
                {isSettingPassword ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  "Set Transaction Password"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Package Alert Modal */}
      <Dialog
        isOpen={showPackageAlert}
        onClose={() => {
          setShowPackageAlert(false);
          router.push("/dashboard");
        }}
        title="Package Renewal Alert"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {packageAlertMessage}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowPackageAlert(false);
                router.push("/dashboard");
              }}
            >
              Go to Dashboard
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setShowPackageAlert(false);
                router.push("/my-course");
              }}
            >
              Go to My Packages
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
