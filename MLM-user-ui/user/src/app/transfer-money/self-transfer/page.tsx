"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  User,
  DollarSign,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getWalletBalance, getUserDetails, walletTransfer } from "@/lib/api/wallet";
import { getUserFriendlyError } from "@/lib/api/errors";

export default function SelfTransferPage() {
  const [formData, setFormData] = useState({
    toUserId: "",
    toUserName: "",
    amount: "",
    fromWallet: "other" as "spot" | "other",
    remarks: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingReceiver, setIsFetchingReceiver] = useState(false);
  const [receiverError, setReceiverError] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Wallet balance states
  const [walletBalance, setWalletBalance] = useState({
    balance: 0,
    spot_balance: 0,
    other_balance: 0,
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // Fetch wallet balance on mount
  useEffect(() => {
    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const balance = await getWalletBalance();
        // Calculate total balance as sum of spot_balance and other_balance
        // This ensures accuracy even if backend balance field is not updated correctly
        const calculatedBalance = (balance.spot_balance || 0) + (balance.other_balance || 0);
        setWalletBalance({
          balance: calculatedBalance,
          spot_balance: balance.spot_balance,
          other_balance: balance.other_balance,
        });
      } catch (err: any) {
        console.error('Failed to fetch wallet balance:', err);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, []);

  // Calculate available balance based on selected wallet
  const availableBalance = formData.fromWallet === 'spot' 
    ? walletBalance.spot_balance 
    : walletBalance.other_balance;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
    // Clear receiver error when ID changes
    if (name === "toUserId" && receiverError) {
      setReceiverError("");
    }
  };

  // Fetch receiver name with debounce
  const fetchReceiverName = useCallback(async (userId: string) => {
    if (!userId || userId.length < 3) {
      setFormData((prev) => ({ ...prev, toUserName: "" }));
      setReceiverError("");
      setIsFetchingReceiver(false);
      return;
    }

    setIsFetchingReceiver(true);
    setReceiverError("");
    
    try {
      const userDetails = await getUserDetails(userId);
      setFormData((prev) => ({ ...prev, toUserName: userDetails.name }));
      setReceiverError("");
    } catch (err: any) {
      const errorMessage = getUserFriendlyError(err);
      setFormData((prev) => ({ ...prev, toUserName: "" }));
      setReceiverError(errorMessage || "User not found. Please check the ID.");
    } finally {
      setIsFetchingReceiver(false);
    }
  }, []);

  // Auto-fetch receiver name when ID is entered
  useEffect(() => {
    if (formData.toUserId && formData.toUserId.length > 3) {
      const timer = setTimeout(() => {
        fetchReceiverName(formData.toUserId);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setFormData((prev) => ({ ...prev, toUserName: "" }));
      setReceiverError("");
      setIsFetchingReceiver(false);
    }
  }, [formData.toUserId, fetchReceiverName]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.toUserId.trim()) {
      newErrors.toUserId = "User ID is required";
    }
    if (!formData.toUserName.trim()) {
      newErrors.toUserId = "Please enter a valid User ID";
      if (!receiverError) {
        setReceiverError("User not found. Please check the ID.");
      }
    }
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

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await walletTransfer({
        to_user_id: formData.toUserId,
        amount: parseFloat(formData.amount),
        from_wallet: formData.fromWallet,
        remarks: formData.remarks || undefined,
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

      // Show success message
      setSuccessMessage(
        `Successfully transferred ₹${formData.amount} to ${formData.toUserName}`,
      );
      setShowSuccessToast(true);

      // Reset form
      setFormData({
        toUserId: "",
        toUserName: "",
        amount: "",
        fromWallet: "other",
        remarks: "",
      });
      setReceiverError("");

      // Auto-hide success toast after 5 seconds
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 5000);
    } catch (err: any) {
      const errorMessage = getUserFriendlyError(err);
      setErrors({ submit: errorMessage });
      console.error('Wallet transfer error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const transferAmount = parseFloat(formData.amount) || 0;
  const balanceAfter = availableBalance - transferAmount;

  return (
    <div className="max-w-[850px] mx-auto animate-in fade-in duration-500">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Wallet Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Available Balance Display */}
          <div className="bg-[var(--sidebar-hover)] rounded-lg p-4 mb-6 border border-[var(--border)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--card-bg)] rounded-lg border border-[var(--border)]">
                    <Wallet className="h-5 w-5 text-[var(--brand-blue)]" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-1">
                      Available Balance ({formData.fromWallet === 'spot' ? 'SPOT' : 'Main'})
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
                    <span className="text-[var(--text-muted)]">SPOT: </span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      ₹{walletBalance.spot_balance.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Main: </span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      ₹{walletBalance.other_balance.toFixed(2)}
                    </span>
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

          {showSuccessToast && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          {errors.submit && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* To User ID */}
            <div className="relative">
              <div className="absolute left-3 top-[38px] z-10">
                <User className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <Input
                label="To User ID"
                type="text"
                name="toUserId"
                placeholder="Enter user ID"
                value={formData.toUserId}
                onChange={handleChange}
                error={errors.toUserId}
                required
                className="pl-10"
              />
            </div>

            {/* To User Name */}
            <div className="relative">
              <div className="absolute left-3 top-[38px] z-10">
                {isFetchingReceiver ? (
                  <Loader2 className="h-5 w-5 text-[var(--brand-blue)] animate-spin" />
                ) : formData.toUserName ? (
                  <CheckCircle className="h-5 w-5 text-[var(--accent-green-text)]" />
                ) : (
                  <User className="h-5 w-5 text-[var(--text-muted)]" />
                )}
              </div>
              <Input
                label="To User Name"
                type="text"
                name="toUserName"
                placeholder={
                  isFetchingReceiver
                    ? "Fetching user details..."
                    : "User name will appear here"
                }
                value={formData.toUserName}
                readOnly
                className={`bg-[var(--sidebar-hover)] cursor-not-allowed pl-10 ${
                  isFetchingReceiver ? "opacity-60" : ""
                }`}
              />
              {receiverError && (
                <p className="text-sm text-[var(--accent-red-text)] mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {receiverError}
                </p>
              )}
            </div>

            {/* From Wallet Selector */}
            {/* Note: Backend API uses "other" as wallet type, but UI displays as "Main" */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-body)] mb-2">
                Transfer From Wallet <span className="text-red-500">*</span>
              </label>
              <select
                name="fromWallet"
                value={formData.fromWallet}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] rounded-lg text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors duration-200 hover:border-[var(--hover-border)]"
              >
                <option value="other">
                  Main Balance (₹{walletBalance.other_balance.toFixed(2)})
                </option>
                <option value="spot">
                  SPOT Balance (₹{walletBalance.spot_balance.toFixed(2)})
                </option>
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Note: Receiver will always receive the amount in their Main Balance wallet
              </p>
            </div>

            {/* Transfer Amount */}
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
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-body)] mb-2">
                Remarks (Optional)
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Add any remarks..."
                rows={3}
                className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors duration-200 hover:border-[var(--hover-border)] resize-none"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                "Transfer Money"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
