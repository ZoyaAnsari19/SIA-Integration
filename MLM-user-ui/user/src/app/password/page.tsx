"use client";

import { useEffect, useMemo, useState } from "react";
import { H1, H3, Text } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { changePassword, changeTransactionPassword, sendPasswordChangeOtp } from "@/lib/api/auth";
import { getUserFriendlyError } from "@/lib/api/errors";
import { Loader2 } from "lucide-react";

type TabKey = "login" | "txn";

export default function Password() {
  const [tab, setTab] = useState<TabKey>("login");

  // Login password form state
  const [currentLogin, setCurrentLogin] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [confirmLogin, setConfirmLogin] = useState("");
  const [showCurrentLogin, setShowCurrentLogin] = useState(false);
  const [showNewLogin, setShowNewLogin] = useState(false);
  const [showConfirmLogin, setShowConfirmLogin] = useState(false);

  // TXN pin form state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  
  // Loading and error states
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  const [isLoadingTxn, setIsLoadingTxn] = useState(false);
  const [loginOtp, setLoginOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [txnError, setTxnError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [txnSuccess, setTxnSuccess] = useState(false);

  useEffect(() => {
    if (otpExpiry <= 0) return;
    const timer = setInterval(() => {
      setOtpExpiry((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpExpiry]);

  const loginStrength = useMemo(() => {
    let score = 0;
    if (/.{8,}/.test(newLogin)) score++;
    if (/[a-z]/.test(newLogin)) score++;
    if (/[A-Z]/.test(newLogin)) score++;
    if (/[0-9]/.test(newLogin)) score++;
    if (/[^A-Za-z0-9]/.test(newLogin)) score++;
    if (!newLogin) return -1; // hidden
    if (score < 2) return 0; // weak
    if (score === 2) return 1; // fair
    if (score === 3 || score === 4) return 2; // good
    return 3; // strong
  }, [newLogin]);

  const handleSendLoginOtp = async () => {
    setLoginError("");
    setIsSendingOtp(true);
    try {
      const result = await sendPasswordChangeOtp();
      setOtpSent(true);
      setOtpExpiry(600);
      setLoginOtp("");
      setLoginError("");
      if (result.email_masked) {
        setLoginSuccess(false);
      }
    } catch (error: any) {
      setLoginError(getUserFriendlyError(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const onSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginSuccess(false);

    if (!otpSent || !loginOtp || loginOtp.length !== 6) {
      setLoginError("Please request and enter the 6-digit email OTP.");
      return;
    }
    if (newLogin.length < 8) {
      setLoginError("Password must be at least 8 characters long.");
      return;
    }
    if (newLogin !== confirmLogin) {
      setLoginError("Passwords do not match.");
      return;
    }

    setIsLoadingLogin(true);
    try {
      await changePassword(currentLogin, newLogin, loginOtp);
      setLoginSuccess(true);
      setCurrentLogin("");
      setNewLogin("");
      setConfirmLogin("");
      setLoginOtp("");
      setOtpSent(false);
      setOtpExpiry(0);
      setTimeout(() => setLoginSuccess(false), 3000);
    } catch (error: any) {
      setLoginError(getUserFriendlyError(error));
    } finally {
      setIsLoadingLogin(false);
    }
  };

  const onSubmitTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxnError("");
    setTxnSuccess(false);
    
    const pinRegex = /^\d{4,6}$/;
    if (!pinRegex.test(newPin)) {
      setTxnError("PIN must be 4 to 6 digits only.");
      return;
    }
    if (newPin !== confirmPin) {
      setTxnError("PINs do not match.");
      return;
    }
    if (!currentPin) {
      setTxnError("Current PIN is required.");
      return;
    }
    
    setIsLoadingTxn(true);
    try {
      await changeTransactionPassword(currentPin, newPin);
      setTxnSuccess(true);
      setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
      setTimeout(() => setTxnSuccess(false), 3000);
    } catch (error: any) {
      const errorMessage = getUserFriendlyError(error);
      setTxnError(errorMessage);
    } finally {
      setIsLoadingTxn(false);
    }
  };

  const StrengthBar = () => (
    <div
      className="mt-2 h-2 w-full rounded bg-[var(--hover-bg)] overflow-hidden"
      style={{ display: loginStrength === -1 ? "none" : "block" }}
    >
      <div
        className={[
          "h-full transition-all",
          loginStrength === 0 ? "bg-red-500 w-1/4" : "",
          loginStrength === 1 ? "bg-amber-400 w-1/2" : "",
          loginStrength === 2 ? "bg-blue-600 w-3/4" : "",
          loginStrength === 3 ? "bg-emerald-600 w-full" : "",
        ].join(" ")}
      />
    </div>
  );

  return (
    <div className="max-w-[650px] mx-auto p-4 md:p-6">
      <H1 className="mb-6">Security Settings</H1>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--card-bg)]">
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as TabKey)}
            items={[
              { value: "login", label: "Update Login Password" },
              { value: "txn", label: "Update Transaction Password (PIN)" },
            ]}
          />
        </div>

        {/* Login Password Tab */}
        {tab === "login" && (
          <div className="p-6">
            <H3 className="text-blue-600 dark:text-blue-400 mb-4">
              Change Your Account Access Password
            </H3>
            <form className="grid gap-5" onSubmit={onSubmitLogin}>
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{loginError}</p>
                </div>
              )}
              {loginSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">Password updated successfully!</p>
                </div>
              )}
              <div>
                <label className="mb-2 block text-[15px] font-semibold text-[var(--text-strong)]">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentLogin ? "text" : "password"}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px]"
                    value={currentLogin}
                    onChange={(e) => setCurrentLogin(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowCurrentLogin((v) => !v)}
                  >
                    {showCurrentLogin ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-semibold text-[var(--text-strong)]">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewLogin ? "text" : "password"}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px]"
                    value={newLogin}
                    onChange={(e) => setNewLogin(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowNewLogin((v) => !v)}
                  >
                    {showNewLogin ? "🙈" : "👁️"}
                  </button>
                </div>
                <StrengthBar />
                <small className="text-xs text-[var(--text-muted)]">
                  Minimum 8 chars with upper, lower and number recommended.
                </small>
              </div>

              <div className="rounded-lg border border-[var(--border)] p-4 space-y-3 bg-[var(--sidebar-hover)]/30">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-[15px] font-semibold text-[var(--text-strong)]">
                    Email OTP Verification
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant={otpSent ? "secondary" : "primary"}
                    onClick={handleSendLoginOtp}
                    disabled={isSendingOtp || (otpSent && otpExpiry > 0)}
                    className="min-h-[36px]"
                  >
                    {isSendingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : otpSent && otpExpiry > 0 ? (
                      "OTP Sent"
                    ) : (
                      "Send OTP to Email"
                    )}
                  </Button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit OTP from your email"
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] text-center tracking-widest font-mono"
                  required
                />
                {otpExpiry > 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    OTP valid for {Math.floor(otpExpiry / 60)}:{(otpExpiry % 60).toString().padStart(2, "0")}
                  </p>
                )}
                {otpSent && otpExpiry === 0 && (
                  <button
                    type="button"
                    onClick={handleSendLoginOtp}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-semibold text-[var(--text-strong)]">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmLogin ? "text" : "password"}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px]"
                    value={confirmLogin}
                    onChange={(e) => setConfirmLogin(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowConfirmLogin((v) => !v)}
                  >
                    {showConfirmLogin ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <Button type="submit" className="min-h-[44px]" disabled={isLoadingLogin}>
                {isLoadingLogin ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Login Password"
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Transaction PIN Tab */}
        {tab === "txn" && (
          <div className="p-6">
            <H3 className="text-blue-600 dark:text-blue-400 mb-4">
              Change Your Withdrawal/Security PIN
            </H3>
            <form className="grid gap-5" onSubmit={onSubmitTxn}>
              {txnError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{txnError}</p>
                </div>
              )}
              {txnSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">Transaction PIN updated successfully!</p>
                </div>
              )}
              <div>
                <label className="mb-2 block text-[15px] font-semibold text-[var(--text-strong)]">
                  Current Transaction PIN
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPin ? "text" : "password"}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px]"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowCurrentPin((v) => !v)}
                  >
                    {showCurrentPin ? "🙈" : "👁️"}
                  </button>
                </div>
                <small className="text-xs text-[var(--text-muted)]">
                  Enter your current transaction PIN to authorize this change.
                </small>
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-semibold text-[var(--text-strong)]">
                  New Transaction PIN (4-6 Digits)
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]{4,6}"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px]"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(
                        e.target.value.replace(/[^0-9]/g, "").slice(0, 6),
                      )
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowNewPin((v) => !v)}
                  >
                    {showNewPin ? "🙈" : "👁️"}
                  </button>
                </div>
                <small className="text-xs text-[var(--text-muted)]">
                  PIN must be digits only.
                </small>
              </div>

              <div>
                <label className="mb-2 block text-[15px] font-semibold text-[var(--text-strong)]">
                  Confirm Transaction PIN
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]{4,6}"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px]"
                    value={confirmPin}
                    onChange={(e) =>
                      setConfirmPin(
                        e.target.value.replace(/[^0-9]/g, "").slice(0, 6),
                      )
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowConfirmPin((v) => !v)}
                  >
                    {showConfirmPin ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <Button type="submit" className="min-h-[44px]" disabled={isLoadingTxn}>
                {isLoadingTxn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Transaction Password"
                )}
              </Button>

              <div className="mt-4 text-center">
                <a
                  href="/forgot-transaction-pin"
                  className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Forgot Transaction PIN?
                </a>
              </div>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
