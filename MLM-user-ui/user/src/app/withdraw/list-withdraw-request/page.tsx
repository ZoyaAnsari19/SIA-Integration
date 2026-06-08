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
  Banknote,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { getWithdrawalRequests } from "@/lib/mock/withdrawal";

type WithdrawStatus = "pending" | "approved" | "rejected" | "processing";
type FilterStatus = "all" | WithdrawStatus;
type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

interface WithdrawRequest {
  id: string;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: WithdrawStatus;
  requestDate: string;
  processedDate?: string;
  remarks?: string;
  withdrawType?: string; // 'spot' or 'wallet' - tracks which wallet the withdrawal was from
}

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/withdraw/requests
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
 *         "id": "WR001",
 *         "amount": 5000.00,
 *         "paymentMethod": "Bank Transfer",
 *         "accountDetails": "****1234 - HDFC Bank",
 *         "status": "pending",
 *         "requestDate": "2025-01-15 10:30:00",
 *         "processedDate": null,
 *         "remarks": null
 *       }
 *     ],
 *     "pagination": {
 *       "currentPage": 1,
 *       "totalPages": 3,
 *       "totalItems": 25,
 *       "itemsPerPage": 10
 *     },
 *     "summary": {
 *       "totalPending": 6500.00,
 *       "totalApproved": 13500.00,
 *       "totalProcessing": 10000.00
 *     }
 *   }
 * }
 *
 * Cancel Request Endpoint: POST /api/withdraw/requests/:id/cancel
 * Method: POST
 * Headers: { Authorization: "Bearer <token>" }
 *
 * Request Body: {}
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Withdraw request cancelled successfully",
 *   "data": { "id": "WR001", "status": "cancelled" }
 * }
 */
const mockWithdrawRequests: WithdrawRequest[] = [
  {
    id: "WR001",
    amount: 5000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****1234 - HDFC Bank",
    status: "pending",
    requestDate: "2025-01-15 10:30:00",
  },
  {
    id: "WR002",
    amount: 3000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "approved",
    requestDate: "2025-01-14 14:20:00",
    processedDate: "2025-01-14 16:45:00",
  },
  {
    id: "WR003",
    amount: 7500.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****5678 - SBI Bank",
    status: "processing",
    requestDate: "2025-01-13 09:15:00",
  },
  {
    id: "WR004",
    amount: 2000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@phonepe",
    status: "rejected",
    requestDate: "2025-01-12 11:00:00",
    processedDate: "2025-01-12 15:30:00",
    remarks: "Insufficient balance",
  },
  {
    id: "WR005",
    amount: 4500.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****9012 - ICICI Bank",
    status: "approved",
    requestDate: "2025-01-11 08:45:00",
    processedDate: "2025-01-11 12:20:00",
  },
  {
    id: "WR006",
    amount: 1500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@googlepay",
    status: "pending",
    requestDate: "2025-01-10 16:30:00",
  },
  {
    id: "WR007",
    amount: 6000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****3456 - Axis Bank",
    status: "approved",
    requestDate: "2025-01-09 13:20:00",
    processedDate: "2025-01-09 17:10:00",
  },
  {
    id: "WR008",
    amount: 2500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "processing",
    requestDate: "2025-01-08 10:00:00",
  },
];

export default function ListWithdrawRequestPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [showPayFirstModal, setShowPayFirstModal] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<WithdrawRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // API states
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch withdrawal requests from API
  const fetchWithdrawalRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getWithdrawalRequests({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      // Map API response to UI format
      const mappedData: WithdrawRequest[] = response.items.map((item) => {
        // Parse account_details if it's a string
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
          status: item.status as WithdrawStatus,
          requestDate: item.created_at,
          processedDate: item.processed_at || undefined,
          remarks: item.rejection_reason || item.remarks || undefined,
          withdrawType: item.withdraw_type || 'wallet', // Track which wallet type this withdrawal is from
        };
      });

      setWithdrawRequests(mappedData);
      setTotalItems(response.total);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load withdrawal requests';
      setError(errorMessage);
      console.error('Failed to fetch withdrawal requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchWithdrawalRequests();
  }, [currentPage, itemsPerPage, statusFilter]);

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
      withdrawRequests
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.amount, 0),
    [withdrawRequests],
  );

  const totalApproved = useMemo(
    () =>
      withdrawRequests
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + r.amount, 0),
    [withdrawRequests],
  );

  const totalProcessing = useMemo(
    () =>
      withdrawRequests
        .filter((r) => r.status === "processing")
        .reduce((sum, r) => sum + r.amount, 0),
    [withdrawRequests],
  );

  // Client-side filtering and sorting (for period and search)
  const filteredData = useMemo(() => {
    let filtered = withdrawRequests.filter((item) => {
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
        let aValue: any = a[sortConfig.key as keyof WithdrawRequest];
        let bValue: any = b[sortConfig.key as keyof WithdrawRequest];

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
  }, [searchQuery, periodFilter, sortConfig, withdrawRequests]);

  // Use API paginated data directly (no need for client-side pagination)
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

  const getStatusBadge = (status: WithdrawStatus) => {
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

  const getStatusIcon = (status: WithdrawStatus) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "processing":
        return <AlertCircle className="w-4 h-4 text-(--brand-blue)" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const handleExportPDF = () => {
    // Get last one month data
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const oneMonthData = filteredData.filter((item) => {
      const itemDate = new Date(item.requestDate);
      return itemDate >= oneMonthAgo;
    });

    // Create PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Withdraw Request Report (Last 1 Month)", 14, 20);

    // Date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
    doc.text(`Total Records: ${oneMonthData.length}`, 14, 36);

    // Table data
    const tableData = oneMonthData.map((r, index) => [
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
    (doc as any).autoTable({
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
    });

    // Save PDF
    doc.save(`withdraw-requests-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleCancelRequest = (id: string) => {
    if (confirm("Are you sure you want to cancel this withdraw request?")) {
      alert(`Request ${id} cancelled successfully`);
    }
  };

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 bg-(--content-bg) min-h-screen transition-colors duration-200">
      <H1>List Withdraw Request</H1>

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
              <p className="text-xl font-bold text-(--brand-blue)">
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
              <p className="text-xl font-bold text-(--text-strong)">
                {totalItems}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-(--text-muted) opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-(--border) p-4 md:p-5 transition-colors duration-200">
          <div>
            <p className="text-xs md:text-[13px] text-(--text-muted) font-semibold">
              Manage and track your withdraw requests
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" size="md" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_auto] gap-3 p-4 md:p-5 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-muted)" />
            <input
              type="text"
              className="w-full pl-10 rounded-lg border border-(--border) bg-(--card-bg) text-(--text-body) px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px] transition-colors duration-200 focus:ring-blue-500 focus:ring-2"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-(--text-strong) transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

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
                    ? "bg-(--brand-blue) text-white border border-blue-600"
                    : "bg-(--card-bg) text-(--text-muted) border border-(--border) hover:bg-(--hover-bg)",
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
                    ? "bg-(--brand-blue) text-white border border-blue-600"
                    : "bg-(--card-bg) text-(--text-muted) border border-(--border) hover:bg-(--hover-bg)",
                ].join(" ")}
              >
                <Calendar className="h-3 w-3" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWithdrawalRequests}
            >
              Retry
            </Button>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="h-12 w-12 text-(--text-muted) mx-auto mb-4" />
            <p className="text-(--text-muted) font-medium">
              No withdraw requests found matching your criteria.
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
                    <TH>Request ID</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--hover-bg) transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Amount (₹)
                        {sortConfig?.key === "amount" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH>Payment Method</TH>
                    <TH>Account Details</TH>
                    <TH>Status</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--hover-bg) transition-colors"
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
                    <TR key={row.id} className="transition-all duration-200">
                      <TD className="whitespace-nowrap text-(--text-muted)">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TD>
                      <TD className="whitespace-nowrap font-medium text-(--brand-blue)">
                        {row.id}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-emerald-600">
                        ₹{formatCurrency(row.amount)}
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-body)">
                        {row.paymentMethod}
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-muted) text-sm">
                        {row.accountDetails}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          {getStatusBadge(row.status)}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-muted) text-sm">
                        {formatDate(row.requestDate)}
                      </TD>
                      <TD className="whitespace-nowrap text-(--text-muted) text-sm">
                        {row.processedDate
                          ? formatDate(row.processedDate)
                          : "-"}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedRequest(row);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 rounded hover:bg-(--hover-bg) text-(--text-muted) hover:text-[var(--hover-text)] transition-colors"
                            title="View Details"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {row.status === "pending" && (
                            <button
                              onClick={() => handleCancelRequest(row.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-(--text-muted) hover:text-red-600 transition-colors"
                              title="Cancel Request"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
                  className="p-4 border border-(--border) rounded-lg hover:bg-(--hover-bg) transition-colors duration-200 bg-(--card-bg)"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-(--text-muted)">
                        Request ID
                      </span>
                      <span className="text-sm font-semibold text-(--brand-blue)">
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
                    <span className="text-sm text-(--text-muted) break-words text-right">
                      {row.accountDetails}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">
                      Request Date
                    </span>
                    <span className="text-xs text-(--text-muted)">
                      {formatDate(row.requestDate)}
                    </span>
                  </div>
                  {row.processedDate && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-(--text-muted)">
                        Processed Date
                      </span>
                      <span className="text-xs text-(--text-muted)">
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
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent-blue-bg)] text-(--brand-blue) hover:bg-(--hover-bg) transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      View Details
                    </button>
                    {row.status === "pending" && (
                      <button
                        onClick={() => handleCancelRequest(row.id)}
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-5 border-t border-(--border) transition-colors duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-(--text-muted)">
                    Items per page:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-(--border) bg-(--card-bg) text-(--text-body) px-3 py-1.5 text-sm transition-colors duration-200"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-(--text-muted)">
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
                    className="p-2 rounded-lg border border-(--border) hover:bg-(--hover-bg) disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-(--card-bg)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-(--text-muted)">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-(--border) hover:bg-(--hover-bg) disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-(--card-bg)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <PayFirstModal
        isOpen={showPayFirstModal}
        onClose={() => setShowPayFirstModal(false)}
      />

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
                <p className="text-sm font-semibold text-(--text-strong)">
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
