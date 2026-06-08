"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Search,
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
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
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
type WithdrawType = "all" | "regular" | "spot";

interface OverallWithdrawRequest {
  id: string;
  type: "regular" | "spot";
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: WithdrawStatus;
  requestDate: string;
  processedDate?: string;
  remarks?: string;
}

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/withdraw/overall
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 * Query Parameters (optional):
 *   - status: "all" | "pending" | "approved" | "rejected" | "processing"
 *   - type: "all" | "regular" | "spot"
 *   - period: "daily" | "weekly" | "monthly" | "all"
 *   - search: string
 *   - page: number
 *   - limit: number
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "requests": [...],
 *     "pagination": {...},
 *     "summary": {
 *       "totalPending": 6500.00,
 *       "totalApproved": 13500.00,
 *       "totalProcessing": 10000.00,
 *       "totalRejected": 2000.00,
 *       "totalAmount": 32000.00
 *     }
 *   }
 * }
 */
const mockOverallWithdrawRequests: OverallWithdrawRequest[] = [
  {
    id: "WR001",
    type: "regular",
    amount: 5000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****1234 - HDFC Bank",
    status: "pending",
    requestDate: "2025-01-15 10:30:00",
  },
  {
    id: "SW001",
    type: "spot",
    amount: 3000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "approved",
    requestDate: "2025-01-14 14:20:00",
    processedDate: "2025-01-14 16:45:00",
  },
  {
    id: "WR002",
    type: "regular",
    amount: 7500.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****5678 - SBI Bank",
    status: "processing",
    requestDate: "2025-01-13 09:15:00",
  },
  {
    id: "SW002",
    type: "spot",
    amount: 2000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@phonepe",
    status: "rejected",
    requestDate: "2025-01-12 11:00:00",
    processedDate: "2025-01-12 15:30:00",
    remarks: "Insufficient balance",
  },
  {
    id: "WR003",
    type: "regular",
    amount: 4500.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****9012 - ICICI Bank",
    status: "approved",
    requestDate: "2025-01-11 08:45:00",
    processedDate: "2025-01-11 12:20:00",
  },
  {
    id: "SW003",
    type: "spot",
    amount: 1500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@googlepay",
    status: "pending",
    requestDate: "2025-01-10 16:30:00",
  },
  {
    id: "WR004",
    type: "regular",
    amount: 6000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****3456 - Axis Bank",
    status: "approved",
    requestDate: "2025-01-09 13:20:00",
    processedDate: "2025-01-09 17:10:00",
  },
  {
    id: "SW004",
    type: "spot",
    amount: 2500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "processing",
    requestDate: "2025-01-08 10:00:00",
  },
];

export default function OverallWithdrawPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState<WithdrawType>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<OverallWithdrawRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // API states
  const [withdrawRequests, setWithdrawRequests] = useState<OverallWithdrawRequest[]>([]);
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
        withdraw_type: typeFilter === 'all' ? undefined : (typeFilter === 'spot' ? 'spot' : 'wallet'),
      });

      // Map API response to UI format
      const mappedData: OverallWithdrawRequest[] = response.items.map((item) => {
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
          type: item.withdraw_type === 'spot' ? 'spot' : 'regular',
          amount: item.amount,
          paymentMethod: item.payment_method,
          accountDetails: accountDetailsStr,
          status: item.status as WithdrawStatus,
          requestDate: item.created_at,
          processedDate: item.processed_at || undefined,
          remarks: item.rejection_reason || item.remarks || undefined,
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
  }, [currentPage, itemsPerPage, statusFilter, typeFilter]);

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

  const totalRejected = useMemo(
    () =>
      withdrawRequests
        .filter((r) => r.status === "rejected")
        .reduce((sum, r) => sum + r.amount, 0),
    [withdrawRequests],
  );

  const totalAmount = useMemo(
    () => withdrawRequests.reduce((sum, r) => sum + r.amount, 0),
    [withdrawRequests],
  );

  // Client-side filtering and sorting (for period and search)
  const filteredData = useMemo(() => {
    let filtered = withdrawRequests.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesPeriod = filterByPeriod(item.requestDate, periodFilter);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.id.toLowerCase().includes(searchLower) ||
        item.paymentMethod.toLowerCase().includes(searchLower) ||
        item.accountDetails.toLowerCase().includes(searchLower);

      return matchesStatus && matchesType && matchesPeriod && matchesSearch;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof OverallWithdrawRequest];
        let bValue: any = b[sortConfig.key as keyof OverallWithdrawRequest];

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

  const getTypeBadge = (type: "regular" | "spot") => {
    if (type === "spot") {
      return (
        <Badge
          tone="purple"
          soft={false}
          className="text-xs font-semibold uppercase"
        >
          Spot
        </Badge>
      );
    }
    return (
      <span className="inline-flex items-center font-semibold text-xs uppercase px-3 py-1 rounded-lg bg-white dark:bg-[var(--card-bg)] border border-[var(--brand-blue)] text-[var(--brand-blue)] transition-colors duration-200">
        Regular
      </span>
    );
  };

  const handleExportPDF = () => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const oneMonthData = filteredData.filter((item) => {
      const itemDate = new Date(item.requestDate);
      return itemDate >= oneMonthAgo;
    });

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Overall Withdraw Report (Last 1 Month)", 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
    doc.text(`Total Records: ${oneMonthData.length}`, 14, 36);

    const tableData = oneMonthData.map((r, index) => [
      index + 1,
      r.id,
      r.type.toUpperCase(),
      `₹${formatCurrency(r.amount)}`,
      r.paymentMethod,
      r.accountDetails,
      r.status.toUpperCase(),
      formatDate(r.requestDate),
      r.processedDate ? formatDate(r.processedDate) : "-",
    ]);

    (doc as any).autoTable({
      head: [
        [
          "Sr",
          "Request ID",
          "Type",
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

    doc.save(
      `overall-withdraw-${new Date().toISOString().split("T")[0]}.pdf`,
    );
  };

  const handleViewDetails = (request: OverallWithdrawRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 bg-[var(--content-bg)] min-h-screen transition-colors duration-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <H1>Overall Withdraw</H1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleExportPDF}
            className="min-h-[44px]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500 dark:border-l-amber-400 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Pending
              </p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                ₹{formatCurrency(totalPending)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-amber-500 dark:text-amber-400 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500 dark:border-l-blue-400 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Processing
              </p>
              <p className="text-xl font-bold text-[var(--brand-blue)]">
                ₹{formatCurrency(totalProcessing)}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-500 dark:text-blue-400 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500 dark:border-l-emerald-400 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Approved
              </p>
              <p className="text-xl font-bold text-[var(--accent-green-text)]">
                ₹{formatCurrency(totalApproved)}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500 dark:border-l-red-400 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Rejected
              </p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                ₹{formatCurrency(totalRejected)}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500 dark:text-red-400 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500 dark:border-l-purple-400 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Amount
              </p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                ₹{formatCurrency(totalAmount)}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500 dark:text-purple-400 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              className="w-full pl-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors"
              placeholder="Search by Request ID, Payment Method, Account..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[15px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as FilterStatus);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Type Filter */}
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[15px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as WithdrawType);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Types</option>
            <option value="regular">Regular</option>
            <option value="spot">Spot</option>
          </select>
        </div>

        {/* Period Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
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
                  ? "bg-[var(--brand-blue)] text-white border border-[var(--brand-blue)]"
                  : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)]",
              ].join(" ")}
            >
              <Calendar className="h-3 w-3" />
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card className="p-4 md:p-6 overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>
                <button
                  onClick={() => handleSort("id")}
                  className="flex items-center gap-1 hover:text-[var(--brand-blue)] transition-colors"
                >
                  Request ID
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TH>
              <TH>
                <button
                  onClick={() => handleSort("type")}
                  className="flex items-center gap-1 hover:text-[var(--brand-blue)] transition-colors"
                >
                  Type
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TH>
              <TH>
                <button
                  onClick={() => handleSort("amount")}
                  className="flex items-center gap-1 hover:text-[var(--brand-blue)] transition-colors"
                >
                  Amount
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TH>
              <TH>Payment Method</TH>
              <TH>Account Details</TH>
              <TH>
                <button
                  onClick={() => handleSort("status")}
                  className="flex items-center gap-1 hover:text-[var(--brand-blue)] transition-colors"
                >
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TH>
              <TH>
                <button
                  onClick={() => handleSort("requestDate")}
                  className="flex items-center gap-1 hover:text-[var(--brand-blue)] transition-colors"
                >
                  Request Date
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TH>
              <TH>Action</TH>
            </TR>
          </THead>
          <tbody>
            {isLoading ? (
              <TR>
                <TD colSpan={8} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)] mx-auto" />
                </TD>
              </TR>
            ) : error ? (
              <TR>
                <TD colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                    <p className="text-red-600 font-medium">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchWithdrawalRequests}
                    >
                      Retry
                    </Button>
                  </div>
                </TD>
              </TR>
            ) : paginatedData.length === 0 ? (
              <TR>
                <TD colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-12 w-12 text-[var(--text-muted)] opacity-50" />
                    <p className="text-[var(--text-muted)]">
                      No withdraw requests found
                    </p>
                  </div>
                </TD>
              </TR>
            ) : (
              paginatedData.map((request) => (
                <TR key={request.id}>
                  <TD>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {request.id}
                    </span>
                  </TD>
                  <TD>{getTypeBadge(request.type)}</TD>
                  <TD>
                    <span className="font-semibold text-[var(--text-strong)]">
                      ₹{formatCurrency(request.amount)}
                    </span>
                  </TD>
                  <TD className="text-[var(--text-body)]">
                    {request.paymentMethod}
                  </TD>
                  <TD className="text-[var(--text-body)]">
                    {request.accountDetails}
                  </TD>
                  <TD>{getStatusBadge(request.status)}</TD>
                  <TD className="text-[var(--text-body)] text-sm">
                    {formatDate(request.requestDate)}
                  </TD>
                  <TD>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                      className="min-h-[32px]"
                    >
                      View Details
                    </Button>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredData.length)} of{" "}
                {filteredData.length} results
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="min-h-[36px]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-[var(--text-body)] px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="min-h-[36px]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Details Modal */}
      <Dialog
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Withdraw Request Details"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Request ID
                </p>
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  {selectedRequest.id}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Type
                </p>
                <div>{getTypeBadge(selectedRequest.type)}</div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Amount
                </p>
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  ₹{formatCurrency(selectedRequest.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Status
                </p>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Payment Method
                </p>
                <p className="text-sm text-[var(--text-body)]">
                  {selectedRequest.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Account Details
                </p>
                <p className="text-sm text-[var(--text-body)]">
                  {selectedRequest.accountDetails}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Request Date
                </p>
                <p className="text-sm text-[var(--text-body)]">
                  {formatDate(selectedRequest.requestDate)}
                </p>
              </div>
              {selectedRequest.processedDate && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Processed Date
                  </p>
                  <p className="text-sm text-[var(--text-body)]">
                    {formatDate(selectedRequest.processedDate)}
                  </p>
                </div>
              )}
            </div>
            {selectedRequest.remarks && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Remarks
                </p>
                <p className="text-sm text-[var(--text-body)]">
                  {selectedRequest.remarks}
                </p>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

