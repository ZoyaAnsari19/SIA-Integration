"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Wallet,
  User,
  DollarSign,
  Lock,
  CheckCircle,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { getWalletBalance, getUserDetails, p2pTransfer, getTransferRules, sendP2PTransferOTP } from "@/lib/mock/wallet";
import { OtpCountdown } from "@/components/ui/OtpCountdown";

export default function P2PTransferPage() {
  const [formData, setFormData] = useState({
    receiverId: "",
    receiverName: "",
    amount: "",
    transactionPassword: "",
    fromWallet: "other" as "other", // P2P transfers only allowed from Main wallet
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isFetchingReceiver, setIsFetchingReceiver] = useState(false);
  const [receiverError, setReceiverError] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [transferOtp, setTransferOtp] = useState("");
  const [otpMaskedEmail, setOtpMaskedEmail] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpError, setOtpError] = useState("");
  
  // Wallet balance states
  const [walletBalance, setWalletBalance] = useState({
    balance: 0,
    spot_balance: 0,
    other_balance: 0,
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // Transfer rules state
  const [transferRules, setTransferRules] = useState({
    transfer_amt_tax: 0,
    min_transfer_amt: 10,
    max_transfer_amt: null as number | null,
  });
  const [isLoadingRules, setIsLoadingRules] = useState(true);

  // Fetch wallet balance and transfer rules on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingBalance(true);
      setIsLoadingRules(true);
      try {
        const [balance, rules] = await Promise.all([
          getWalletBalance(),
          getTransferRules(),
        ]);
        // Calculate total balance as sum of spot_balance and other_balance
        // This ensures accuracy even if backend balance field is not updated correctly
        const calculatedBalance = (balance.spot_balance || 0) + (balance.other_balance || 0);
        setWalletBalance({
          balance: calculatedBalance,
          spot_balance: balance.spot_balance,
          other_balance: balance.other_balance,
        });
        setTransferRules(rules);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoadingBalance(false);
        setIsLoadingRules(false);
      }
    };

    fetchData();
  }, []);

  // P2P transfers only allowed from Main wallet (other)
  const availableBalance = walletBalance.other_balance;

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
    // Clear submit error when any field changes
    if (errors.submit) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.submit;
        return newErrors;
      });
    }
    // Clear receiver error when ID changes
    if (name === "receiverId") {
      setReceiverError("");
      // Clear receiver name when ID changes
      setFormData((prev) => ({ ...prev, receiverName: "" }));
    }
  };

  /**
   * TODO: MOCK DATA - Replace with actual API call
   *
   * Endpoint: GET /api/user/details/:receiverId
   * Method: GET
   * Headers: { Authorization: "Bearer <token>" }
   * Path Parameters:
   *   - receiverId: string (user ID to fetch details for)
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "SIAXXXXX",
   *     "name": "Rahul Sharma",
   *     "username": "rahul.sharma"
   *   }
   * }
   *
   * Error Response (if user not found):
   * {
   *   "success": false,
   *   "message": "User not found"
   * }
   */
  // Fetch receiver name with debounce and loading state
  const fetchReceiverName = useCallback(async (receiverId: string) => {
    if (!receiverId || receiverId.length < 3) {
      setFormData((prev) => ({ ...prev, receiverName: "" }));
      setReceiverError("");
      setIsFetchingReceiver(false);
      // Clear receiver ID error when field is cleared
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.receiverId;
        return newErrors;
      });
      return;
    }

    setIsFetchingReceiver(true);
    setReceiverError("");
    // Clear receiver ID error when fetching starts
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.receiverId;
      return newErrors;
    });
    
    try {
      const userDetails = await getUserDetails(receiverId);
      setFormData((prev) => ({ ...prev, receiverName: userDetails.name || "" }));
      setReceiverError("");
      // Clear any receiver ID errors on success
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.receiverId;
        return newErrors;
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Request failed';
      setFormData((prev) => ({ ...prev, receiverName: "" }));
      const finalError = errorMessage || "Receiver not found. Please check the ID.";
      setReceiverError(finalError);
      // Set receiver ID error
      setErrors((prev) => ({
        ...prev,
        receiverId: finalError,
      }));
    } finally {
      setIsFetchingReceiver(false);
    }
  }, []);

  // Auto-fetch receiver name when ID is entered (with debounce)
  useEffect(() => {
    if (formData.receiverId && formData.receiverId.length > 3) {
      const timer = setTimeout(() => {
        fetchReceiverName(formData.receiverId);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setFormData((prev) => ({ ...prev, receiverName: "" }));
      setReceiverError("");
      setIsFetchingReceiver(false);
    }
  }, [formData.receiverId, fetchReceiverName]);

  const handleQuickAmount = (amount: string) => {
    setFormData((prev) => ({ ...prev, amount }));
    if (errors.amount) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.amount;
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate Receiver ID
    if (!formData.receiverId.trim()) {
      newErrors.receiverId = "Receiver ID is required";
    } else if (isFetchingReceiver) {
      // Don't validate if still fetching
      newErrors.receiverId = "Please wait while we verify the receiver ID";
    } else if (receiverError) {
      // If there's a receiver error, show it
      newErrors.receiverId = receiverError;
    } else if (!formData.receiverName.trim()) {
      // If no receiver name after API call, show error
      newErrors.receiverId = "Please enter a valid Receiver ID";
    }

    // Validate Amount
    if (!formData.amount.trim()) {
      newErrors.amount = "Transfer amount is required";
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = "Please enter a valid amount";
      } else if (amount > availableBalance) {
        newErrors.amount = `Insufficient ${formData.fromWallet} balance. Available: ₹${availableBalance.toFixed(2)}`;
      } else if (amount < 1) {
        newErrors.amount = "Minimum transfer amount is ₹1";
      }
    }

    // Validate Transaction Password
    if (!formData.transactionPassword.trim()) {
      newErrors.transactionPassword = "Transaction password is required";
    } else {
      const pinRegex = /^\d{4,6}$/;
      if (!pinRegex.test(formData.transactionPassword)) {
        newErrors.transactionPassword = "Transaction password must be 4-6 digits";
      }
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If receiver ID is entered but name is not fetched yet, wait for it
    if (formData.receiverId.trim() && !formData.receiverName.trim() && !isFetchingReceiver && !receiverError) {
      // Try to fetch receiver name one more time
      await fetchReceiverName(formData.receiverId);
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setTransferOtp("");
    setOtpError("");
    setOtpExpired(false);
    setShowConfirmDialog(true);
  };

  const requestP2PTransferOtp = useCallback(async () => {
    setOtpSending(true);
    setOtpError("");
    try {
      const result = await sendP2PTransferOTP();
      setOtpSent(true);
      setOtpExpired(false);
      setOtpMaskedEmail(result.email_masked || "your registered email");
    } catch (err: any) {
      const errorMessage = err?.message || 'Request failed';
      setOtpError(errorMessage || "Failed to send OTP email. Please try again.");
      setOtpSent(false);
    } finally {
      setOtpSending(false);
    }
  }, []);

  useEffect(() => {
    if (showConfirmDialog) {
      requestP2PTransferOtp();
    } else {
      setTransferOtp("");
      setOtpSent(false);
      setOtpExpired(false);
      setOtpError("");
      setOtpMaskedEmail("");
    }
  }, [showConfirmDialog, requestP2PTransferOtp]);

  const handleConfirmTransfer = async () => {
    if (!transferOtp.trim() || !/^\d{6}$/.test(transferOtp.trim())) {
      setOtpError("Please enter the 6-digit OTP sent to your email");
      return;
    }
    if (otpExpired) {
      setOtpError("OTP expired. Please resend OTP.");
      return;
    }
    if (!otpSent) {
      setOtpError("Please wait for OTP email or resend OTP.");
      return;
    }

    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      const result = await p2pTransfer({
        receiver_id: formData.receiverId,
        amount: parseFloat(formData.amount),
        from_wallet: formData.fromWallet,
        remarks: undefined,
        transaction_password: formData.transactionPassword,
        otp: transferOtp.trim(),
      });

      // Refresh wallet balance
      const balance = await getWalletBalance();
      // Calculate total balance as sum of spot_balance and other_balance
      const calculatedBalance = (balance.spot_balance || 0) + (balance.other_balance || 0);
      setWalletBalance({
        balance: calculatedBalance,
        spot_balance: balance.spot_balance,
        other_balance: balance.other_balance,
      });

      // Show success toast
      setSuccessMessage(
        `Successfully transferred ₹${formData.amount} to ${formData.receiverName}`,
      );
      setShowSuccessToast(true);

      // Reset form
      setFormData({
        receiverId: "",
        receiverName: "",
        amount: "",
        transactionPassword: "",
        fromWallet: "other",
      });
      setErrors({});
      setReceiverError("");
      setShowPassword(false);
      setTransferOtp("");
      setOtpSent(false);
      setOtpExpired(false);
      setOtpMaskedEmail("");

      setTimeout(() => {
        setShowSuccessToast(false);
      }, 5000);
    } catch (err: any) {
      const errorMessage = err?.message || 'Request failed';
      setErrors({ submit: errorMessage || "Failed to process transfer. Please try again." });
      console.error("P2P transfer error:", err);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const transferAmount = parseFloat(formData.amount) || 0;
  // Calculate tax amount (tax is deducted from sender, receiver gets full amount)
  const taxAmount = transferAmount > 0 && transferRules.transfer_amt_tax > 0
    ? (transferAmount * transferRules.transfer_amt_tax) / 100
    : 0;
  const totalDeducted = transferAmount + taxAmount; // Total deducted from sender (amount + tax)
  const balanceAfter = availableBalance - totalDeducted;

  return (
    <>
      <div className="max-w-[850px] mx-auto animate-in fade-in duration-500">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Transfer Money</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Enhanced Available Balance Display */}
            <div className="bg-[var(--sidebar-hover)] rounded-lg p-4 mb-6 border border-[var(--border)]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
                      <Wallet className="h-5 w-5 text-[var(--brand-blue)]" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-muted)] mb-1">
                        Available Balance (Main)
                      </p>
                      <p className="text-2xl font-bold text-[var(--text-strong)]">
                        {isLoadingBalance ? (
                          <Loader2 className="h-6 w-6 animate-spin inline" />
                        ) : (
                          `₹${availableBalance.toFixed(2)}`
                        )}
                      </p>
                    </div>
                  </div>
                  {formData.amount && transferAmount > 0 && (
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-[var(--text-muted)] mb-1">
                        Balance After Transfer
                      </p>
                      <p
                        className={`text-xl font-semibold ${
                          balanceAfter >= 0
                            ? "text-[var(--accent-green-text)]"
                            : "text-[var(--accent-red-text)]"
                        }`}
                      >
                        ₹{balanceAfter.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {/* Wallet Breakdown */}
                {!isLoadingBalance && (
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">Main: </span>
                      <span className="font-semibold text-[var(--text-strong)]">
                        ₹{walletBalance.other_balance.toFixed(2)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] ml-2">(P2P Transfer Wallet)</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Total: </span>
                      <span className="font-semibold text-[var(--text-strong)]">
                        ₹{walletBalance.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* General Error Message */}
              {errors.submit && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {errors.submit}
                  </p>
                </div>
              )}

              {/* Receiver ID with Icon */}
              <div className="relative">
                <div className="absolute left-3 top-[38px] z-10">
                  <User className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <Input
                  label="Receiver ID"
                  type="text"
                  name="receiverId"
                  placeholder="Enter receiver id"
                  value={formData.receiverId}
                  onChange={handleChange}
                  error={errors.receiverId}
                  required
                  className="pl-10"
                  aria-label="Receiver ID"
                  aria-describedby={errors.receiverId ? "receiverId-error" : undefined}
                />
              </div>

              {/* Receiver Name with Loading State */}
              <div className="relative">
                <div className="absolute left-3 top-[38px] z-10">
                  {isFetchingReceiver ? (
                    <Loader2 className="h-5 w-5 text-[var(--brand-blue)] animate-spin" />
                  ) : formData.receiverName ? (
                    <CheckCircle className="h-5 w-5 text-[var(--accent-green-text)]" />
                  ) : (
                    <User className="h-5 w-5 text-[var(--text-muted)]" />
                  )}
                </div>
                <Input
                  label="Receiver Name"
                  type="text"
                  name="receiverName"
                  placeholder={
                    isFetchingReceiver
                      ? "Fetching receiver details..."
                      : "Receiver name will appear here"
                  }
                  value={formData.receiverName}
                  readOnly
                  className={`bg-[var(--sidebar-hover)] cursor-not-allowed pl-10 ${
                    isFetchingReceiver ? "opacity-60" : ""
                  }`}
                  aria-label="Receiver Name"
                  aria-busy={isFetchingReceiver}
                />
                {receiverError && (
                  <p
                    id="receiverName-error"
                    className="text-sm text-[var(--accent-red-text)] mt-1 flex items-center gap-1"
                    role="alert"
                  >
                    <AlertCircle className="h-4 w-4" />
                    {receiverError}
                  </p>
                )}
              </div>

              {/* From Wallet Selector - P2P transfers only allowed from Main wallet */}
              {/* Note: Backend API uses "other" as wallet type, but UI displays as "Main" */}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-body)] mb-2">
                  Transfer From Wallet <span className="text-red-500">*</span>
                </label>
                <div className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] rounded-lg text-base min-h-[44px] flex items-center">
                  <span className="text-[var(--text-strong)]">
                    Main Balance (₹{walletBalance.other_balance.toFixed(2)})
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Note: P2P transfers are only allowed from Main wallet to Main wallet. SPOT wallet transfers are not permitted.
                </p>
              </div>

              {/* Transfer Amount with Icon and Quick Buttons */}
              <div>
                <div className="relative">
                  <div className="absolute left-3 top-[38px] z-10">
                    <DollarSign className="h-5 w-5 text-[var(--text-muted)]" />
                  </div>
                  <Input
                    label="Transfer Amount"
                    type="number"
                    name="amount"
                    placeholder="Enter amount"
                    value={formData.amount}
                    onChange={handleChange}
                    error={errors.amount}
                    min="1"
                    step="0.01"
                    required
                    className="pl-10"
                    aria-label="Transfer Amount"
                    aria-describedby={errors.amount ? "amount-error" : undefined}
                  />
                </div>
                {/* Tax Information Note */}
                {!isLoadingRules && transferRules.transfer_amt_tax > 0 && formData.amount && parseFloat(formData.amount) > 0 && (
                  <div className="mt-3 p-3 bg-[var(--accent-blue-bg)] border border-[var(--accent-blue-border)] rounded-lg">
                    <p className="text-sm text-[var(--accent-blue-text)]">
                      <span className="font-semibold">{transferRules.transfer_amt_tax}%</span> transfer tax is applied.
                      {(() => {
                        const amount = parseFloat(formData.amount);
                        const taxAmount = (amount * transferRules.transfer_amt_tax) / 100;
                        const totalDeducted = amount + taxAmount;
                        return (
                          <>
                            <br />
                            <span className="font-semibold">₹{taxAmount.toFixed(2)}</span> will be deducted as tax.
                            <br />
                            <span className="text-xs opacity-90">
                              Total deducted from your wallet: <span className="font-semibold">₹{totalDeducted.toFixed(2)}</span> (₹{amount.toFixed(2)} + ₹{taxAmount.toFixed(2)} tax)
                            </span>
                          </>
                        );
                      })()}
                    </p>
                  </div>
                )}
                {/* Quick Amount Buttons */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleQuickAmount(availableBalance.toFixed(2))
                    }
                    className="text-xs"
                    aria-label="Use maximum balance"
                  >
                    Max
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleQuickAmount((availableBalance / 2).toFixed(2))
                    }
                    className="text-xs"
                    aria-label="Use half of balance"
                  >
                    Half
                  </Button>
                  {[100, 500, 1000, 5000].map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAmount(amt.toString())}
                      className="text-xs"
                      aria-label={`Transfer ₹${amt}`}
                    >
                      ₹{amt}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Transaction Password with Icon */}
              <div className="relative">
                <div className="absolute left-3 top-[38px] z-10">
                  <Lock className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <Input
                  label="Transaction Password"
                  type={showPassword ? "text" : "password"}
                  name="transactionPassword"
                  placeholder="Enter transaction password"
                  value={formData.transactionPassword}
                  onChange={handleChange}
                  error={errors.transactionPassword}
                  required
                  className="pl-10 pr-12"
                  aria-label="Transaction Password"
                  aria-describedby={
                    errors.transactionPassword
                      ? "transactionPassword-error"
                      : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors p-1 rounded hover:bg-[var(--hover-bg)]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Transfer Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-6 bg-[#2c3e50] hover:bg-[#1a252f] text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                disabled={isSubmitting || isFetchingReceiver}
                aria-label="Submit transfer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Transfer Now"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Confirm Transfer"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-[var(--accent-amber-bg)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[var(--accent-amber-text)] mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-[var(--accent-amber-text)]">
                Please review the transaction details before confirming. This
                action cannot be undone.
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-[var(--sidebar-hover)] rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Receiver ID:</span>
              <span className="font-semibold text-[var(--text-strong)]">
                {formData.receiverId}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Receiver Name:</span>
              <span className="font-semibold text-[var(--text-strong)]">
                {formData.receiverName}
              </span>
            </div>
            <div className="border-t border-[var(--border)] pt-3 mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[var(--text-muted)]">Transfer Amount:</span>
                <span className="font-bold text-lg text-[var(--text-strong)]">
                  ₹{transferAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)]">
                  Current Balance:
                </span>
                <span className="text-[var(--text-body)]">
                  ₹{availableBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-[var(--text-muted)]">
                  Balance After Transfer:
                </span>
                <span
                  className={`font-semibold ${
                    balanceAfter >= 0
                      ? "text-[var(--accent-green-text)]"
                      : "text-[var(--accent-red-text)]"
                  }`}
                >
                  ₹{balanceAfter.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--text-strong)]">Email OTP Verification</p>
            <p className="text-xs text-[var(--text-muted)]">
              {otpSending
                ? "Sending OTP to your registered email..."
                : otpMaskedEmail
                  ? `Enter the 6-digit OTP sent to ${otpMaskedEmail}`
                  : "OTP will be sent to your registered email"}
            </p>
            {otpError && (
              <p className="text-sm text-[var(--accent-red-text)] flex items-center gap-1" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {otpError}
              </p>
            )}
            <Input
              label="Email OTP"
              type="text"
              name="transferOtp"
              placeholder="Enter 6-digit OTP"
              value={transferOtp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setTransferOtp(value);
                if (otpError) setOtpError("");
              }}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={otpSending || !otpSent || otpExpired}
            />
            <div className="flex items-center justify-between gap-2">
              {otpSent && !otpExpired ? (
                <OtpCountdown
                  seconds={600}
                  onExpire={() => setOtpExpired(true)}
                />
              ) : (
                <span className="text-xs text-[var(--text-muted)]">
                  {otpExpired ? "OTP expired" : ""}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestP2PTransferOtp}
                disabled={otpSending}
              >
                {otpSending ? "Sending..." : "Resend OTP"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1"
              aria-label="Cancel transfer"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmTransfer}
              className="flex-1 bg-[#2c3e50] hover:bg-[#1a252f] text-white"
              disabled={otpSending || !otpSent || otpExpired || transferOtp.length !== 6}
              aria-label="Confirm and proceed with transfer"
            >
              Confirm & Transfer
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-md w-full sm:w-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
          role="alert"
          aria-live="polite"
        >
          <Card className="bg-[var(--accent-green-bg)] border-[var(--border)] shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-[var(--card-bg)] rounded-full shrink-0 border border-[var(--border)]">
                  <CheckCircle className="h-5 w-5 text-[var(--accent-green-text)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--accent-green-text)] mb-1">
                    Transfer Successful
                  </p>
                  <p className="text-sm text-[var(--text-body)]">
                    {successMessage}
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccessToast(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

