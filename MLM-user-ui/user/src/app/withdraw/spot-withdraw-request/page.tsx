"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  ArrowUpDown,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Bolt,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
// jsPDF will be imported dynamically after jspdf-autotable is loaded
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { getWithdrawalRequests, createWithdrawalRequest, isWithdrawalDateAllowed, isWithdrawalTimeAllowed, getWithdrawRules } from "@/lib/mock/withdrawal";
import { getWalletBalance } from "@/lib/mock/wallet";
import { getUserProfile } from "@/lib/mock/profile";

type SpotWithdrawStatus = "pending" | "approved" | "rejected" | "processing";
type FilterStatus = "all" | SpotWithdrawStatus;
type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

interface SpotWithdrawRequest {
  id: string;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: SpotWithdrawStatus;
  requestDate: string;
  processedDate?: string;
  remarks?: string;
  withdrawalFee?: number; // Withdrawal processing fee (only for approved/processing)
  withdrawType?: string; // 'spot' or 'wallet' - tracks which wallet the withdrawal was from
}

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/withdraw/spot-requests
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 * Query Parameters (optional):
 *   - status: "all" | "pending" | "approved" | "rejected" | "processing"
 *   - period: "daily" | "weekly" | "monthly" | "all"
 *   - search: string
 *   - page: number
 *   - limit: number
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "requests": [
 *       {
 *         "id": "SWR001",
 *         "amount": 2000.00,
 *         "paymentMethod": "UPI",
 *         "accountDetails": "moin.shaikh@paytm",
 *         "status": "approved",
 *         "requestDate": "2025-01-15 10:30:00",
 *         "processedDate": "2025-01-15 10:35:00",
 *         "remarks": null
 *       }
 *     ],
 *     "pagination": {
 *       "currentPage": 1,
 *       "totalPages": 1,
 *       "totalItems": 8,
 *       "itemsPerPage": 10
 *     },
 *     "summary": {
 *       "totalPending": 1200.00,
 *       "totalApproved": 7800.00,
 *       "totalProcessing": 3800.00
 *     }
 *   }
 * }
 *
 * Create Spot Withdraw Request Endpoint: POST /api/withdraw/spot-requests
 * Method: POST
 * Headers: { Authorization: "Bearer <token>", "Content-Type": "application/json" }
 *
 * Request Body:
 * {
 *   "amount": 2000.00,
 *   "paymentMethod": "UPI",
 *   "accountDetails": "moin.shaikh@paytm"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Spot withdraw request submitted successfully",
 *   "data": {
 *     "id": "SWR009",
 *     "amount": 2000.00,
 *     "status": "pending",
 *     "requestDate": "2025-01-16 10:30:00"
 *   }
 * }
 */
const mockSpotWithdrawRequests: SpotWithdrawRequest[] = [
  {
    id: "SWR001",
    amount: 2000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "approved",
    requestDate: "2025-01-15 10:30:00",
    processedDate: "2025-01-15 10:35:00",
  },
  {
    id: "SWR002",
    amount: 1500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@phonepe",
    status: "approved",
    requestDate: "2025-01-14 14:20:00",
    processedDate: "2025-01-14 14:25:00",
  },
  {
    id: "SWR003",
    amount: 3000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****1234 - HDFC Bank",
    status: "processing",
    requestDate: "2025-01-13 09:15:00",
  },
  {
    id: "SWR004",
    amount: 1000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@googlepay",
    status: "rejected",
    requestDate: "2025-01-12 11:00:00",
    processedDate: "2025-01-12 11:05:00",
    remarks: "Insufficient balance",
  },
  {
    id: "SWR005",
    amount: 2500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "approved",
    requestDate: "2025-01-11 08:45:00",
    processedDate: "2025-01-11 08:50:00",
  },
  {
    id: "SWR006",
    amount: 1200.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@phonepe",
    status: "pending",
    requestDate: "2025-01-10 16:30:00",
  },
  {
    id: "SWR007",
    amount: 1800.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****5678 - SBI Bank",
    status: "approved",
    requestDate: "2025-01-09 13:20:00",
    processedDate: "2025-01-09 13:25:00",
  },
  {
    id: "SWR008",
    amount: 800.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@googlepay",
    status: "processing",
    requestDate: "2025-01-08 10:00:00",
  },
];

export default function WithdrawRequestPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [showPayFirstModal, setShowPayFirstModal] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<SpotWithdrawRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [newRequest, setNewRequest] = useState({
    amount: "",
    paymentMethod: "UPI",
    accountDetails: "",
    ifsc: "",
    walletType: "spot" as "spot" | "other" | "team_royalty",
    transactionPassword: "",
  });
  const [showTransactionPassword, setShowTransactionPassword] = useState(false);
  
  // API states
  const [spotWithdrawRequests, setSpotWithdrawRequests] = useState<SpotWithdrawRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState({
    spot_balance: 0,
    other_balance: 0,
    team_royalty_balance: 0,
    balance: 0,
    main_locked_hold: 0,
    available_main_balance: 0,
    spot_team_withdraw_limit: 0,
    spot_team_withdraw_used: 0,
    spot_team_withdraw_remaining: 0,
    spot_team_withdraw_multiplier: 10,
  });
  const [withdrawRules, setWithdrawRules] = useState<{
    min_withdraw: number;
    max_withdraw: number | null;
    spot_min_withdraw: number;
    admin_charges: number;
    withdrawal_enabled: boolean;
  } | null>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const searchParams = useSearchParams();

  // Fetch spot withdrawal requests from API
  const fetchSpotWithdrawalRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getWithdrawalRequests({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
        // Remove withdraw_type filter to show all withdrawal types (spot and wallet)
      });

      // Map API response to UI format
      const mappedData: SpotWithdrawRequest[] = response.items.map((item) => {
        let accountDetailsStr = '';
        if (typeof item.account_details === 'string') {
          try {
            const parsed = JSON.parse(item.account_details);
            accountDetailsStr = parsed.account_number || parsed.upi_id || item.account_details;
          } catch {
            accountDetailsStr = item.account_details;
          }
        } else if (item.account_details) {
          accountDetailsStr = item.account_details.account_number || item.account_details.upi_id || JSON.stringify(item.account_details);
        }

        return {
          id: item.id,
          amount: item.amount,
          paymentMethod: item.payment_method,
          accountDetails: accountDetailsStr,
          status: item.status as SpotWithdrawStatus,
          requestDate: item.created_at,
          processedDate: item.processed_at || undefined,
          remarks: item.rejection_reason || item.remarks || undefined,
          withdrawalFee: (item as any).withdrawal_fee || 0, // Withdrawal processing fee from API
          withdrawType: item.withdraw_type || 'spot', // Track which wallet type this withdrawal is from
        };
      });

      setSpotWithdrawRequests(mappedData);
      setTotalItems(response.total);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load withdrawal requests';
      setError(errorMessage);
      console.error('Failed to fetch spot withdrawal requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch wallet balance (includes 10× limit for Spot/Team Royalty)
  const fetchWalletBalance = async () => {
    try {
      const balance = await getWalletBalance();
      const teamRoyalty = balance.team_royalty_balance ?? 0;
      const calculatedBalance =
        (balance.spot_balance || 0) + (balance.other_balance || 0) + teamRoyalty;
      setWalletBalance({
        spot_balance: balance.spot_balance,
        other_balance: balance.other_balance,
        team_royalty_balance: teamRoyalty,
        balance: calculatedBalance,
        main_locked_hold: (balance as any).main_locked_hold ?? 0,
        available_main_balance: (balance as any).available_main_balance ?? balance.other_balance ?? 0,
        spot_team_withdraw_limit: balance.spot_team_withdraw_limit ?? 0,
        spot_team_withdraw_used: balance.spot_team_withdraw_used ?? 0,
        spot_team_withdraw_remaining: balance.spot_team_withdraw_remaining ?? 0,
        spot_team_withdraw_multiplier: balance.spot_team_withdraw_multiplier ?? 10,
      });
    } catch (err: any) {
      console.error('Failed to fetch wallet balance:', err);
    }
  };

  // Fetch withdrawal rules (min/max limits)
  const fetchWithdrawRules = async () => {
    try {
      const rules = await getWithdrawRules();
      console.log('Withdrawal rules fetched:', rules);
      console.log('withdrawal_enabled value:', rules?.withdrawal_enabled);
      setWithdrawRules(rules);
    } catch (err: any) {
      console.error('Failed to fetch withdraw rules:', err);
    }
  };

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchSpotWithdrawalRequests();
    fetchWalletBalance();
    fetchWithdrawRules();
  }, [currentPage, itemsPerPage, statusFilter]);

  // Open modal automatically when ?new=1 is present (e.g., from topbar button)
  useEffect(() => {
    const shouldOpen = searchParams?.get("new") === "1";
    if (shouldOpen) {
      setShowNewRequestModal(true);
    }
  }, [searchParams]);

  // Fetch user profile and check KYC when modal opens
  useEffect(() => {
    if (showNewRequestModal) {
      const fetchProfileAndCheckKYC = async () => {
        setIsLoadingProfile(true);
        setKycError(null);
        // Refresh withdrawal rules when modal opens to get latest status
        // Force refresh by calling fetchWithdrawRules first
        await fetchWithdrawRules();
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const profile = await getUserProfile();
          setKycStatus(profile.kyc_status || null);
          setUserProfile(profile.profile || null);

          // Check KYC status
          if (!profile.kyc_status || profile.kyc_status !== 'approved') {
            if (profile.kyc_status === 'rejected') {
              setKycError('KYC is rejected. Please complete KYC verification to withdraw funds.');
            } else if (profile.kyc_status === 'submitted') {
              setKycError('KYC is submitted but not approved yet. Please wait for approval to withdraw funds.');
            } else {
              setKycError('KYC verification is required. Please complete KYC to withdraw funds.');
            }
          } else {
            // KYC approved - pre-fill bank/UPI details
            if (profile.profile) {
              const hasUPI = profile.profile.bank_upi;
              const hasBank = profile.profile.bank_account_no && profile.profile.bank_ifsc;
              
              if (hasUPI || hasBank) {
                // Pre-fill payment method and details - prefer UPI if both available
                if (hasUPI) {
                  setNewRequest(prev => ({
                    ...prev,
                    paymentMethod: "UPI",
                    accountDetails: profile.profile?.bank_upi || "",
                    ifsc: "",
                  }));
                } else if (hasBank) {
                  setNewRequest(prev => ({
                    ...prev,
                    paymentMethod: "Bank Transfer",
                    accountDetails: profile.profile?.bank_account_no || "",
                    ifsc: profile.profile?.bank_ifsc || "",
                  }));
                }
              }
            }
          }
        } catch (err: any) {
          console.error('Failed to fetch profile:', err);
          setKycError('Failed to verify KYC status. Please try again.');
        } finally {
          setIsLoadingProfile(false);
        }
      };

      fetchProfileAndCheckKYC();
    } else {
      // Reset when modal closes
      setKycStatus(null);
      setKycError(null);
      setUserProfile(null);
      setNewRequest({
        amount: "",
        paymentMethod: "UPI",
        accountDetails: "",
        ifsc: "",
        walletType: "spot",
        transactionPassword: "",
      });
    }
  }, [showNewRequestModal]);

  // Update account details when payment method changes (if KYC approved)
  useEffect(() => {
    if (kycStatus === 'approved' && userProfile && showNewRequestModal && !isLoadingProfile) {
      if (newRequest.paymentMethod === "UPI") {
        if (userProfile.bank_upi) {
          setNewRequest(prev => ({
            ...prev,
            accountDetails: userProfile.bank_upi,
            ifsc: "",
          }));
        }
      } else if (newRequest.paymentMethod === "Bank Transfer") {
        if (userProfile.bank_account_no) {
          setNewRequest(prev => ({
            ...prev,
            accountDetails: userProfile.bank_account_no,
            ifsc: userProfile.bank_ifsc || "",
          }));
        }
      }
    }
  }, [newRequest.paymentMethod, kycStatus, userProfile, showNewRequestModal, isLoadingProfile]);

  // Helper function to filter by period
  const filterByPeriod = (
    dateString: string,
    period: PeriodFilter,
  ): boolean => {
    if (period === "all") return true;

    const itemDate = new Date(dateString);
    const now = new Date();

    if (period === "daily") {
      return (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }

    if (period === "weekly") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return itemDate >= weekStart && itemDate <= weekEnd;
    }

    if (period === "monthly") {
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  };

  // Calculate statistics
  const totalPending = useMemo(
    () =>
      spotWithdrawRequests
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.amount, 0),
    [spotWithdrawRequests],
  );

  const totalApproved = useMemo(
    () =>
      spotWithdrawRequests
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + r.amount, 0),
    [spotWithdrawRequests],
  );

  const totalProcessing = useMemo(
    () =>
      spotWithdrawRequests
        .filter((r) => r.status === "processing")
        .reduce((sum, r) => sum + r.amount, 0),
    [spotWithdrawRequests],
  );

  // Client-side filtering and sorting (for period and search)
  const filteredData = useMemo(() => {
    let filtered = spotWithdrawRequests.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesPeriod = filterByPeriod(item.requestDate, periodFilter);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.id.toLowerCase().includes(searchLower) ||
        item.paymentMethod.toLowerCase().includes(searchLower) ||
        item.accountDetails.toLowerCase().includes(searchLower);

      return matchesStatus && matchesPeriod && matchesSearch;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof SpotWithdrawRequest];
        let bValue: any = b[sortConfig.key as keyof SpotWithdrawRequest];

        if (
          sortConfig.key === "requestDate" ||
          sortConfig.key === "processedDate"
        ) {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [searchQuery, periodFilter, sortConfig, spotWithdrawRequests]);

  // Use API paginated data directly
  const paginatedData = filteredData;

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: SpotWithdrawStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge
            tone="green"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge
            tone="amber"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge
            tone="blue"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Processing
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            tone="red"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Rejected
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: SpotWithdrawStatus) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "processing":
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const handleExportPDF = async () => {
    try {
      console.log('Export PDF clicked, filteredData length:', filteredData.length);
      
      if (filteredData.length === 0) {
        alert('No data available to export');
        return;
      }

      // Import both modules
      const jsPDFModule = await import("jspdf");
      const autoTableModule = typeof window !== "undefined" ? await import("jspdf-autotable") : null;
      
      const jsPDF = jsPDFModule.default;

      // Use all filtered data (or last one month if too many records)
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);

      const oneMonthData = filteredData.filter((item) => {
        const itemDate = new Date(item.requestDate);
        return itemDate >= oneMonthAgo;
      });

      // Use one month data if available, otherwise use all filtered data
      const exportData = oneMonthData.length > 0 ? oneMonthData : filteredData;
      
      console.log('Export data length:', exportData.length);

      // Create PDF
      const doc = new jsPDF();

      // Get autoTable function - try different ways it might be exported
      let autoTableFn: any = null;
      
      if (typeof (doc as any).autoTable === "function") {
        autoTableFn = (config: any) => (doc as any).autoTable(config);
      } else if (autoTableModule && typeof (autoTableModule as any).default === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).default(doc, config);
      } else if (autoTableModule && typeof (autoTableModule as any).autoTable === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).autoTable(doc, config);
      }
      
      if (!autoTableFn) {
        throw new Error("autoTable plugin not loaded. Please refresh the page and try again.");
      }

      // Title
      doc.setFontSize(18);
      doc.text("Spot Withdraw Request Report (Last 1 Month)", 14, 20);

      // Date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
      doc.text(`Total Records: ${exportData.length}`, 14, 36);
      doc.text(
        `Total Amount: ₹${formatCurrency(exportData.reduce((sum, item) => sum + item.amount, 0))}`,
        14,
        42,
      );

      // Table data
      const tableData = exportData.map((r, index) => [
        index + 1,
        r.id,
        `₹${formatCurrency(r.amount)}`,
        r.paymentMethod,
        r.accountDetails,
        r.status.toUpperCase(),
        formatDate(r.requestDate),
        r.processedDate ? formatDate(r.processedDate) : "-",
      ]);

      // Add table
      const tableConfig = {
        head: [
          [
            "Sr",
            "Request ID",
            "Amount",
            "Payment Method",
            "Account Details",
            "Status",
            "Request Date",
            "Processed Date",
          ],
        ],
        body: tableData,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 45 },
      };
      
      autoTableFn(tableConfig);

      // Save PDF
      const fileName = `spot-withdraw-requests-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      console.log('PDF exported successfully:', fileName);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error?.message || 'Unknown error'}`);
    }
  };


  const handleSubmitNewRequest = async () => {
    if (!newRequest.amount || !newRequest.accountDetails || !newRequest.transactionPassword) {
      setSubmitError("Please fill all required fields including transaction password");
      return;
    }

    const amount = parseFloat(newRequest.amount);
    if (isNaN(amount) || amount <= 0) {
      setSubmitError("Please enter a valid amount");
      return;
    }

    // Validate against minimum withdrawal rules (client-side)
    const currentMin =
      newRequest.walletType === "spot" || newRequest.walletType === "team_royalty"
        ? withdrawRules?.spot_min_withdraw ?? withdrawRules?.min_withdraw ?? 100
        : withdrawRules?.min_withdraw ?? 100;
    if (amount < currentMin) {
      setSubmitError(
        `Minimum withdrawal amount is ₹${currentMin.toFixed(
          2,
        )}. You entered ₹${amount.toFixed(2)}`,
      );
      return;
    }

    // Check time restrictions (10 AM to 5 PM IST) - applies regardless of withdrawal_enabled status
    // Check time restrictions only if withdrawal is date-based (not enabled for any date)
    // If admin has enabled withdrawals for any date, skip time restrictions
    if (!withdrawRules?.withdrawal_enabled) {
      const timeCheck = isWithdrawalTimeAllowed();
      if (!timeCheck.allowed) {
        setSubmitError(
          timeCheck.message || "Withdrawal is only allowed between 10:00 AM and 5:00 PM IST."
        );
        return;
      }
    }

    // Check date restrictions only if withdrawal is not enabled by admin
    // If admin has enabled withdrawals, skip date restrictions
    const selectedWallet = newRequest.walletType;
    if (!withdrawRules?.withdrawal_enabled) {
      const dateCheck = isWithdrawalDateAllowed();
      const walletKey =
        selectedWallet === "spot"
          ? "spot"
          : selectedWallet === "team_royalty"
            ? "team_royalty"
            : "other";

      if (!dateCheck.allowed || !dateCheck.allowedWallets.includes(walletKey as "spot" | "other" | "team_royalty")) {
        if (walletKey === "spot") {
          setSubmitError(
            dateCheck.message ||
              "SPOT withdrawals are only allowed on 10th, 20th and 30th of each month (28th in February).",
          );
        } else if (walletKey === "team_royalty") {
          setSubmitError(
            dateCheck.message ||
              "Team Royalty withdrawals are only allowed on 30th of each month (28th in February).",
          );
        } else {
          setSubmitError(
            dateCheck.message ||
              "Main balance withdrawals are only allowed on 30th of each month (28th in February).",
          );
        }
        return;
      }
    }

    // Check balance for selected wallet; for Main use available_main_balance (excludes reinvestment lock); for Spot/Team Royalty cap by 10× limit
    const rawBalance =
      selectedWallet === "spot"
        ? walletBalance.spot_balance
        : selectedWallet === "team_royalty"
          ? walletBalance.team_royalty_balance
          : walletBalance.available_main_balance ?? walletBalance.other_balance;
    const limitRemaining =
      selectedWallet === "spot" || selectedWallet === "team_royalty"
        ? (walletBalance.spot_team_withdraw_remaining ?? 0)
        : Infinity;
    const availableBalance = Math.min(rawBalance, limitRemaining);

    if (amount > availableBalance) {
      const walletLabel =
        selectedWallet === "spot" ? "SPOT" : selectedWallet === "team_royalty" ? "Team Royalty" : "Main";
      const limitMsg =
        limitRemaining < rawBalance && limitRemaining < Infinity
          ? ` (${walletBalance.spot_team_withdraw_multiplier ?? 10}× limit remaining: ₹${limitRemaining.toFixed(2)})`
          : "";
      setSubmitError(
        `Insufficient ${walletLabel} balance. Available: ₹${availableBalance.toFixed(2)}${limitMsg}`,
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Prepare account details as JSON string
      const accountDetailsJson = JSON.stringify(
        newRequest.paymentMethod === "UPI"
          ? {
              upi_id: newRequest.accountDetails,
              payment_method: "upi",
            }
          : {
            account_number: newRequest.accountDetails,
            ifsc: newRequest.ifsc,
            payment_method: "bank",
          },
      );

      const withdrawType =
        newRequest.walletType === "spot"
          ? "spot"
          : newRequest.walletType === "team_royalty"
            ? "team_royalty"
            : "wallet";
      await createWithdrawalRequest({
        amount: amount,
        payment_method:
          newRequest.paymentMethod.toLowerCase() === "upi" ? "upi" : "bank",
        account_details: accountDetailsJson,
        withdraw_type: withdrawType,
        remarks: undefined,
        transaction_password: newRequest.transactionPassword,
      });

      // Refresh data
      await fetchSpotWithdrawalRequests();
      await fetchWalletBalance();

      // Close modal and reset form
      setShowNewRequestModal(false);
      setNewRequest({
        amount: "",
        paymentMethod: "UPI",
        accountDetails: "",
        ifsc: "",
        walletType: "spot",
        transactionPassword: "",
      });
      setSubmitError(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to submit withdrawal request';
      setSubmitError(errorMessage);
      console.error('Failed to create spot withdrawal request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Handle opening withdrawal modal (always allow opening, show notice inside modal)
  const handleOpenWithdrawModal = () => {
    setShowNewRequestModal(true);
  };

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <H1>Withdraw Request</H1>
        <Button
          variant="primary"
          size="md"
          onClick={handleOpenWithdrawModal}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Withdraw Request
        </Button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-(--text-muted) font-semibold mb-1">
                Total Pending
              </p>
              <p className="text-xl font-bold text-amber-600">
                ₹{formatCurrency(totalPending)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-amber-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-(--text-muted) font-semibold mb-1">
                Total Processing
              </p>
              <p className="text-xl font-bold text-blue-600">
                ₹{formatCurrency(totalProcessing)}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-(--text-muted) font-semibold mb-1">
                Total Approved
              </p>
              <p className="text-xl font-bold text-emerald-600">
                ₹{formatCurrency(totalApproved)}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-(--text-muted) font-semibold mb-1">
                Total Requests
              </p>
              <p className="text-xl font-bold text-(--text-body)">
                {totalItems}
              </p>
            </div>
            <Bolt className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-(--border) p-4 md:p-5">
          <div>
            <p className="text-xs md:text-[13px] text-(--text-muted) font-semibold">
              Manage and track your spot withdraw requests
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" size="md" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 md:p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-muted)" />
            <input
              type="text"
              className="w-full pl-10 rounded-lg border border-(--border) px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px]"
              placeholder="Search by Request ID, Payment Method, Account..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-(--text-body)"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "processing", label: "Processing" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => {
                    setStatusFilter(filter.value as FilterStatus);
                    setCurrentPage(1);
                  }}
                  className={[
                    "px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors min-h-[44px]",
                    statusFilter === filter.value
                      ? "bg-blue-600 text-white border border-blue-600"
                      : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)]",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "All Time" },
                { value: "daily", label: "Today" },
                { value: "weekly", label: "This Week" },
                { value: "monthly", label: "This Month" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => {
                    setPeriodFilter(filter.value as PeriodFilter);
                    setCurrentPage(1);
                  }}
                  className={[
                    "px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors min-h-[44px] flex items-center gap-1",
                    periodFilter === filter.value
                      ? "bg-blue-600 text-white border border-blue-600"
                      : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)]",
                  ].join(" ")}
                >
                  <Calendar className="h-3 w-3" />
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        {paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <Bolt className="h-12 w-12 text-(--text-muted) mx-auto mb-4" />
            <p className="text-(--text-muted) font-medium">
              No spot withdraw requests found matching your criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block w-full overflow-x-auto mb-5">
              <Table className="w-full">
                <THead>
                  <tr>
                    <TH>Sr No</TH>
                    <TH>Actions</TH>
                    <TH>Request ID</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--sidebar-hover) transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Amount (₹)
                        {sortConfig?.key === "amount" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH>TDS (10%)</TH>
                    <TH>Payout Amount (₹)</TH>
                    <TH>Payment Method</TH>
                    <TH>Account Details</TH>
                    <TH>Status</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--sidebar-hover) transition-colors"
                      onClick={() => handleSort("requestDate")}
                    >
                      <div className="flex items-center gap-1">
                        Request Date
                        {sortConfig?.key === "requestDate" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH>Processed Date</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {paginatedData.map((row, index) => (
                    <TR
                      key={row.id}
                      className="hover:bg-(--sidebar-hover) transition-all duration-200"
                    >
                      <TD className="whitespace-nowrap text-(--text-body)">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedRequest(row);
                            setShowDetailsModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-(--sidebar-hover) text-(--text-muted) hover:text-[var(--hover-text)] transition-colors"
                          title="View Details"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </TD>
                      <TD className="whitespace-nowrap font-medium text-purple-600">
                        {row.id}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-emerald-600">
                        ₹{formatCurrency(row.amount)}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-orange-600">
                        ₹{formatCurrency(row.amount * 0.1)}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-blue-600">
                        ₹{formatCurrency(row.amount * 0.9)}
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-body)">
                        {row.paymentMethod}
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-body) text-sm">
                        {row.accountDetails}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          {getStatusBadge(row.status)}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-body) text-sm">
                        {formatDate(row.requestDate)}
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-body) text-sm">
                        {row.processedDate
                          ? formatDate(row.processedDate)
                          : "-"}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden mb-5 space-y-3">
              {paginatedData.map((row, index) => (
                <div
                  key={row.id}
                  className="p-4 border border-(--border) rounded-lg hover:bg-(--sidebar-hover) transition-colors duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-(--text-muted)">
                        Request ID
                      </span>
                      <span className="text-sm font-semibold text-purple-600">
                        {row.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(row.status)}
                      {getStatusBadge(row.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">Amount</span>
                    <span className="text-lg font-bold text-emerald-600">
                      ₹{formatCurrency(row.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">TDS (10%)</span>
                    <span className="text-sm font-semibold text-orange-600">
                      ₹{formatCurrency(row.amount * 0.1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">Payout Amount</span>
                    <span className="text-sm font-semibold text-blue-600">
                      ₹{formatCurrency(row.amount * 0.9)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">
                      Payment Method
                    </span>
                    <span className="text-sm text-(--text-body)">
                      {row.paymentMethod}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">
                      Account Details
                    </span>
                    <span className="text-sm text-(--text-body) break-words text-right">
                      {row.accountDetails}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">
                      Request Date
                    </span>
                    <span className="text-xs text-(--text-body)">
                      {formatDate(row.requestDate)}
                    </span>
                  </div>
                  {row.processedDate && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-(--text-muted)">
                        Processed Date
                      </span>
                      <span className="text-xs text-(--text-body)">
                        {formatDate(row.processedDate)}
                      </span>
                    </div>
                  )}
                  {row.remarks && (
                    <div className="mt-2 pt-2 border-t border-(--border)">
                      <span className="text-xs text-(--text-muted)">
                        Remarks:{" "}
                      </span>
                      <span className="text-xs text-red-600">
                        {row.remarks}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-(--border)">
                    <button
                      onClick={() => {
                        setSelectedRequest(row);
                        setShowDetailsModal(true);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-5 border-t border-(--border)">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-(--text-body)">
                    Items per page:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-(--border) px-3 py-1.5 text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-(--text-body)">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, filteredData.length)}{" "}
                    of {filteredData.length} requests
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-(--border) hover:bg-(--sidebar-hover) disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-(--text-body)">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-(--border) hover:bg-(--sidebar-hover) disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Pay First Modal */}
      <PayFirstModal
        isOpen={showPayFirstModal}
        onClose={() => setShowPayFirstModal(false)}
      />

      {/* New Spot Withdraw Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <Card
            className="max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
            padding="lg"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-(--border)">
              <div className="flex items-center gap-2">
                <Bolt className="h-5 w-5 text-purple-600" />
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold text-[var(--text-strong)]">
                    New Withdraw Request
                  </h2>
                  <span className="text-xs text-(--text-muted)">
                    Today is {todayLabel}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="p-1.5 rounded-lg hover:bg-(--sidebar-hover) transition-colors text-(--text-muted) hover:text-[var(--text-strong)]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Selected wallet summary */}
              <div className="rounded-xl border border-blue-500/40 bg-gradient-to-br from-blue-900/40 via-blue-900/10 to-blue-500/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-wide">
                      {newRequest.walletType === "spot"
                        ? "SPOT Wallet"
                        : newRequest.walletType === "team_royalty"
                          ? "Team Royalty Wallet"
                          : "Main Wallet"}
                    </p>
                    <p className="text-xs text-blue-100">
                      {(() => {
                        const baseMin =
                          newRequest.walletType === "spot" || newRequest.walletType === "team_royalty"
                            ? withdrawRules?.spot_min_withdraw ?? withdrawRules?.min_withdraw ?? 100
                            : withdrawRules?.min_withdraw ?? 100;
                        return `Minimum withdrawal amount is ₹${baseMin.toFixed(2)}`;
                      })()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-blue-100">Available</p>
                    <p className="text-lg font-bold text-white">
                      ₹
                      {(() => {
                        const raw =
                          newRequest.walletType === "spot"
                            ? walletBalance.spot_balance
                            : newRequest.walletType === "team_royalty"
                              ? walletBalance.team_royalty_balance
                              : walletBalance.available_main_balance ?? walletBalance.other_balance;
                        const cap =
                          newRequest.walletType === "spot" || newRequest.walletType === "team_royalty"
                            ? walletBalance.spot_team_withdraw_remaining ?? Infinity
                            : Infinity;
                        return Math.min(raw, cap).toFixed(2);
                      })()}
                    </p>
                    {newRequest.walletType === "other" && (walletBalance.main_locked_hold ?? 0) > 0 && (
                      <p className="text-[10px] text-amber-200 mt-1">
                        Reinvestment SELF + Global 90-day lock: ₹{(walletBalance.main_locked_hold ?? 0).toFixed(2)} locked. You can withdraw only the unlocked amount shown above.
                      </p>
                    )}
                    {(newRequest.walletType === "spot" || newRequest.walletType === "team_royalty") &&
                      typeof walletBalance.spot_team_withdraw_limit === "number" &&
                      walletBalance.spot_team_withdraw_limit > 0 && (
                      <>
                        <p className="text-[10px] text-blue-200 mt-0.5">
                          {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× limit: ₹{(walletBalance.spot_team_withdraw_remaining ?? 0).toFixed(2)} of ₹{(walletBalance.spot_team_withdraw_limit ?? 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-blue-200 mt-0.5">
                          Note: SPOT aur Team Royalty wallets se milakar aap sirf apne package investment ka {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× tak hi total withdrawal kar sakte hain.
                        </p>
                        {(walletBalance.spot_team_withdraw_remaining ?? 0) > 0 ? (
                          <p className="text-[10px] text-blue-200 mt-0.5">
                            Abhi aap Spot + Team Royalty wallets se maximum ₹{(walletBalance.spot_team_withdraw_remaining ?? 0).toFixed(2)} hi withdraw kar sakte hain.
                          </p>
                        ) : (
                          <div className="mt-1 p-1.5 bg-red-500/20 border border-red-400/40 rounded text-[10px] text-red-100">
                            <p className="font-semibold mb-0.5">⚠️ {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× Limit Exhausted</p>
                            <p className="mb-0.5">
                              Aapne apna {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× withdrawal limit poora use kar liya hai. Ab Spot aur Team Royalty wallets se aur withdraw nahi kar sakte.
                            </p>
                            <p className="mb-0.5">
                              <strong>Important:</strong> Agar aap 15 din ke andar naya package buy ya upgrade nahi karte, to:
                            </p>
                            <ul className="list-disc list-inside ml-1 space-y-0.5 text-[9px]">
                              <li>15 din ke andar jo Spot/Team Royalty income aayi hai, wo zero (flush) ho jayegi</li>
                              <li>Uske baad jab tak upgrade nahi karte, tab tak ki saari Spot/Team Royalty income bhi flush hoti rahegi</li>
                              <li>Sirf naya package/upgrade ke baad hi naya {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× cycle start hoga</li>
                            </ul>
                            <p className="mt-0.5 font-semibold">
                              Naya package buy ya upgrade karein taake Spot/Team Royalty income jama ho sake.
                            </p>
                          </div>
                        )}
                        {(walletBalance.spot_team_withdraw_remaining ?? 0) > 0 && (walletBalance.spot_team_withdraw_remaining ?? 0) < 1000 && (
                          <div className="mt-1 p-1.5 bg-amber-500/20 border border-amber-400/40 rounded text-[10px] text-amber-100">
                            <p className="font-semibold mb-0.5">⚠️ Limit Almost Exhausted</p>
                            <p className="mb-0.5">
                              Aapka {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× withdrawal limit khatam hone wala hai. Limit poora use hone ke baad:
                            </p>
                            <ul className="list-disc list-inside ml-1 space-y-0.5 text-[9px]">
                              <li>Spot/Team Royalty se aur withdraw nahi kar sakte</li>
                              <li>15 din ke baad aane wali saari nayi Spot/Team Royalty income wallet balance mei add nahi hogi (flush mode), jab tak upgrade nahi karte</li>
                              <li>Jo us waqt tak Spot/Team Royalty wallet mei pada hai, wo safe rahega lekin withdraw sirf upgrade ke baad hi possible hoga</li>
                            </ul>
                            <p className="mt-0.5">
                              <strong>Recommendation:</strong> Package upgrade karein taake naya {(walletBalance.spot_team_withdraw_multiplier ?? 10)}× cycle start ho.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {(newRequest.walletType === "spot" || newRequest.walletType === "team_royalty") &&
                      (walletBalance.spot_team_withdraw_limit ?? 0) === 0 && (
                      <div className="mt-1 p-1.5 bg-amber-500/20 border border-amber-400/40 rounded text-[10px] text-amber-100">
                        <p className="font-semibold mb-0.5">⚠️ Spot/Team Royalty withdraw ke liye active package zaroori</p>
                        <p className="mb-0.5">
                          Aapka package expire ho chuka hai, isliye ab Spot/Team Royalty se withdraw nahi ho sakta. <strong>My Packages</strong> se package renew karein — renew ke baad naya 10× cycle start hoga aur aap in wallets se withdraw kar paayenge.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Wallet selection */}
              <div>
                <label className="block text-sm font-medium text-(--text-body) mb-1.5">
                  Withdraw From Wallet <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRequest.walletType}
                  onChange={(e) => {
                    const value = e.target.value as "spot" | "other" | "team_royalty";
                    setNewRequest({ ...newRequest, walletType: value });
                    setSubmitError(null);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-(--border) bg-(--card-bg) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="spot">SPOT Wallet</option>
                  <option value="team_royalty">Team Royalty Wallet</option>
                  <option value="other">Main Wallet</option>
                </select>
              </div>

              {/* Time Restriction Notice - Only show if withdrawal is date-based (not enabled for any date) */}
              {(() => {
                // If withdrawal is enabled for any date, skip time restriction notice
                if (withdrawRules?.withdrawal_enabled) {
                  return null;
                }
                
                const currentTimeCheck = isWithdrawalTimeAllowed();
                return (
                  <div className={`border rounded-lg p-3 ${currentTimeCheck.allowed ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-2">
                      {currentTimeCheck.allowed ? (
                        <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <p className={`text-xs ${currentTimeCheck.allowed ? 'text-blue-800' : 'text-red-800'}`}>
                        {currentTimeCheck.message || "Withdrawal is only allowed between 10:00 AM and 5:00 PM IST."}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Withdrawal Status Messages - Show date/withdrawal enabled status */}
              {(() => {
                // Debug: Log current state
                if (typeof window !== 'undefined') {
                  console.log('Rendering withdrawal status - withdrawRules:', withdrawRules);
                  console.log('withdrawal_enabled:', withdrawRules?.withdrawal_enabled);
                }
                
                // If withdrawals are enabled (any date), show success message
                if (withdrawRules?.withdrawal_enabled) {
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-emerald-800">
                          Withdrawals are enabled. You can withdraw from your {newRequest.walletType === "spot" ? "SPOT" : newRequest.walletType === "team_royalty" ? "Team Royalty" : "Main"} wallet.
                        </p>
                      </div>
                    </div>
                  );
                }

                // If withdrawals are date-based, check if current date is allowed
                if (withdrawRules && !withdrawRules.withdrawal_enabled) {
                  const dateCheck = isWithdrawalDateAllowed();
                  const walletKey =
                    newRequest.walletType === "spot"
                      ? "spot"
                      : newRequest.walletType === "team_royalty"
                        ? "team_royalty"
                        : "other";
                  
                  // If current date is NOT allowed for selected wallet, show warning
                  if (!dateCheck.allowed || !dateCheck.allowedWallets.includes(walletKey as "spot" | "other" | "team_royalty")) {
                    return (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-800">
                            {walletKey === "spot"
                              ? "SPOT withdrawals are only allowed on 10th, 20th and 30th of each month (28th in February)."
                              : walletKey === "team_royalty"
                                ? "Team Royalty withdrawals are only allowed on 30th of each month (28th in February)."
                                : "Main balance withdrawals are only allowed on 30th of each month (28th in February)."}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  
                  // If current date IS allowed, show helpful message
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-emerald-800">
                          {walletKey === "spot"
                            ? "You can withdraw from SPOT wallet today. Allowed dates: 10th, 20th and 30th of each month (28th in February)."
                            : walletKey === "team_royalty"
                              ? "You can withdraw from Team Royalty wallet today. Allowed dates: 10th, 20th and 30th of each month (28th in February)."
                              : "You can withdraw from Main wallet today. Allowed dates: 30th of each month (28th in February)."}
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {isLoadingProfile && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">Verifying KYC status...</p>
                </div>
              )}

              {kycError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-800">{kycError}</p>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-800">{submitError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-(--text-body) mb-1.5">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount"
                  value={newRequest.amount}
                  onChange={(e) => {
                    setNewRequest({ ...newRequest, amount: e.target.value });
                    setSubmitError(null);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-(--border) text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
                {newRequest.amount && (() => {
                  const amount = parseFloat(newRequest.amount);
                  const raw =
                    newRequest.walletType === "spot"
                      ? walletBalance.spot_balance
                      : newRequest.walletType === "team_royalty"
                        ? walletBalance.team_royalty_balance
                        : walletBalance.available_main_balance ?? walletBalance.other_balance;
                  const cap =
                    newRequest.walletType === "spot" || newRequest.walletType === "team_royalty"
                      ? walletBalance.spot_team_withdraw_remaining ?? Infinity
                      : Infinity;
                  const available = Math.min(raw, cap);
                  return amount > available;
                })() && (
                  <p className="text-xs text-red-600 mt-1">
                    Amount exceeds available{" "}
                    {newRequest.walletType === "spot" ? "SPOT" : newRequest.walletType === "team_royalty" ? "Team Royalty" : "Main"} balance
                    {(newRequest.walletType === "spot" || newRequest.walletType === "team_royalty") &&
                      (walletBalance.spot_team_withdraw_remaining ?? 0) <
                        (newRequest.walletType === "spot" ? walletBalance.spot_balance : walletBalance.team_royalty_balance)
                      ? ` (capped by ${walletBalance.spot_team_withdraw_multiplier ?? 10}× limit)`
                      : ""}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text-body) mb-1.5">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRequest.paymentMethod}
                  onChange={(e) => {
                    setNewRequest({
                      ...newRequest,
                      paymentMethod: e.target.value,
                      // Account details will be updated by useEffect
                    });
                  }}
                  disabled={isLoadingProfile || !!kycError}
                  className="w-full px-4 py-3 rounded-lg border border-(--border) text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
                {kycStatus === 'approved' && (
                  <p className="text-xs text-gray-600 mt-1">
                    You can select payment method, but account details will be from your KYC.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text-body) mb-1.5">
                  {newRequest.paymentMethod === "UPI"
                    ? "UPI ID"
                    : "Account Number"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    newRequest.paymentMethod === "UPI"
                      ? "Enter UPI ID (e.g., moin.shaikh@paytm)"
                      : "Enter bank account number"
                  }
                  value={newRequest.accountDetails}
                  onChange={(e) =>
                    setNewRequest({
                      ...newRequest,
                      accountDetails: e.target.value,
                    })
                  }
                  disabled={kycStatus === 'approved' || isLoadingProfile || !!kycError}
                  className="w-full px-4 py-3 rounded-lg border border-(--border) text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-900 disabled:opacity-100"
                  readOnly={kycStatus === 'approved'}
                  style={kycStatus === 'approved' ? { color: '#111827' } : {}}
                />
                {kycStatus === 'approved' && (
                  <p className="text-xs text-gray-600 mt-1">
                    This field is pre-filled from your KYC details and cannot be edited.
                  </p>
                )}
              </div>

              {newRequest.paymentMethod === "Bank Transfer" && (
                <div>
                  <label className="block text-sm font-medium text-(--text-body) mb-1.5">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter IFSC code (e.g., HDFC0001234)"
                    value={newRequest.ifsc}
                    onChange={(e) =>
                      setNewRequest({
                        ...newRequest,
                        ifsc: e.target.value.toUpperCase(),
                      })
                    }
                    disabled={kycStatus === 'approved' || isLoadingProfile || !!kycError}
                    className="w-full px-4 py-3 rounded-lg border border-(--border) text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-900 disabled:opacity-100"
                    readOnly={kycStatus === 'approved'}
                    style={kycStatus === 'approved' ? { color: '#111827' } : {}}
                  />
                  {kycStatus === 'approved' && (
                    <p className="text-xs text-gray-600 mt-1">
                      This field is pre-filled from your KYC details and cannot be edited.
                    </p>
                  )}
                </div>
              )}

              {/* Transaction Password */}
              <div>
                <label className="block text-sm font-medium text-(--text-body) mb-1.5">
                  Transaction Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showTransactionPassword ? "text" : "password"}
                    placeholder="Enter transaction password"
                    value={newRequest.transactionPassword}
                    onChange={(e) =>
                      setNewRequest({
                        ...newRequest,
                        transactionPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-(--border) text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTransactionPassword(!showTransactionPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showTransactionPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Enter your transaction password to confirm withdrawal
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px]"
                  onClick={() => {
                    setShowNewRequestModal(false);
                    setNewRequest({
                      amount: "",
                      paymentMethod: "UPI",
                      accountDetails: "",
                      ifsc: "",
                      walletType: "spot",
                      transactionPassword: "",
                    });
                    setSubmitError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 min-h-[44px]"
                  onClick={handleSubmitNewRequest}
                  disabled={(() => {
                    if (isSubmitting || isLoadingProfile) return true;
                    if (kycStatus !== 'approved' || kycError) return true;
                    
                    // If withdrawal is enabled by admin (any date), skip both time and date restrictions
                    if (withdrawRules?.withdrawal_enabled) return false;
                    
                    // If withdrawal is NOT enabled by admin, apply time restrictions first
                    const timeCheck = isWithdrawalTimeAllowed();
                    if (!timeCheck.allowed) return true;
                    
                    // Then apply date restrictions
                    if (withdrawRules && !withdrawRules.withdrawal_enabled) {
                      const dateCheck = isWithdrawalDateAllowed();
                      const walletKey =
                        newRequest.walletType === "spot"
                          ? "spot"
                          : newRequest.walletType === "team_royalty"
                            ? "team_royalty"
                            : "other";
                      return (
                        !dateCheck.allowed ||
                        !dateCheck.allowedWallets.includes(
                          walletKey as "spot" | "other" | "team_royalty",
                        )
                      );
                    }
                    // If rules not loaded yet, check both time and date restrictions as fallback
                    const timeCheckFallback = isWithdrawalTimeAllowed();
                    if (!timeCheckFallback.allowed) return true;
                    
                    const dateCheck = isWithdrawalDateAllowed();
                    const walletKey =
                      newRequest.walletType === "spot"
                        ? "spot"
                        : newRequest.walletType === "team_royalty"
                          ? "team_royalty"
                          : "other";
                    return (
                      !dateCheck.allowed ||
                      !dateCheck.allowedWallets.includes(
                        walletKey as "spot" | "other" | "team_royalty",
                      )
                    );
                  })()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Bolt className="h-4 w-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Details Modal */}
      <Dialog
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedRequest(null);
        }}
        title={`${selectedRequest?.withdrawType === 'spot' ? 'SPOT' : selectedRequest?.withdrawType === 'team_royalty' ? 'Team Royalty' : 'Main'} Wallet Withdraw Request Details`}
      >
        {selectedRequest && (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-(--text-muted) mb-1">Wallet Type</p>
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  {selectedRequest.withdrawType === 'spot' ? 'SPOT Wallet' : selectedRequest.withdrawType === 'team_royalty' ? 'Team Royalty Wallet' : 'Main Wallet'}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">Request ID</p>
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  {selectedRequest.id}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">Amount</p>
                <p className="text-sm font-semibold text-emerald-600">
                  ₹{formatCurrency(selectedRequest.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">TDS (10%)</p>
                <p className="text-sm font-semibold text-orange-600">
                  ₹{formatCurrency(selectedRequest.amount * 0.1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">Payout Amount</p>
                <p className="text-sm font-semibold text-blue-600">
                  ₹{formatCurrency(selectedRequest.amount * 0.9)}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">
                  Payment Method
                </p>
                <p className="text-sm font-medium text-(--text-body)">
                  {selectedRequest.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">Status</p>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">
                  Account Details
                </p>
                <p className="text-sm font-medium text-(--text-body) break-words">
                  {selectedRequest.accountDetails}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text-muted) mb-1">Request Date</p>
                <p className="text-sm font-medium text-(--text-body)">
                  {formatDate(selectedRequest.requestDate)}
                </p>
              </div>
              {selectedRequest.processedDate && (
                <div>
                  <p className="text-xs text-(--text-muted) mb-1">
                    Processed Date
                  </p>
                  <p className="text-sm font-medium text-(--text-body)">
                    {formatDate(selectedRequest.processedDate)}
                  </p>
                </div>
              )}
              {selectedRequest.remarks && (
                <div className="col-span-2">
                  <p className="text-xs text-(--text-muted) mb-1">Remarks</p>
                  <p className="text-sm font-medium text-red-600 bg-red-50 p-2 rounded">
                    {selectedRequest.remarks}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
