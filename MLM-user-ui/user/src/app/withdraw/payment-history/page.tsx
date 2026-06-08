"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  CreditCard,
  Banknote,
} from "lucide-react";
// jsPDF will be imported dynamically after jspdf-autotable is loaded
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { InvoiceTemplate } from "@/components/invoice/InvoiceTemplate";
import { useAppSelector } from "@/redux/hooks";
import { Eye } from "lucide-react";
import { getPaymentHistory } from "@/lib/mock/income";

type PaymentStatus = "successful" | "failed" | "pending";
type FilterStatus = "all" | PaymentStatus;
type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

interface PaymentRecord {
  id: string;
  transactionId: string;
  utr: string;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: PaymentStatus;
  paymentDate: string;
  requestId?: string;
  remarks?: string;
}


/**
 * Helper function to map API response to PaymentRecord format
 */
function mapPaymentHistoryToPaymentRecord(item: {
  id: string;
  transaction_id: string;
  utr: string;
  amount: number;
  payment_method: string;
  account_details: string;
  status: 'successful' | 'failed' | 'pending';
  payment_date: string;
  request_id: string | null;
  remarks: string | null;
}): PaymentRecord {
  return {
    id: item.id,
    transactionId: item.transaction_id,
    utr: item.utr,
    amount: item.amount,
    paymentMethod: item.payment_method,
    accountDetails: item.account_details,
    status: item.status,
    paymentDate: item.payment_date,
    requestId: item.request_id || undefined,
    remarks: item.remarks || undefined,
  };
}

export default function PaymentHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [showPayFirstModal, setShowPayFirstModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<
    PaymentRecord | null
  >(null);
  const user = useAppSelector((state) => state.auth.user);

  // API state
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch payment history from API
  const fetchPaymentHistory = useCallback(async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Payment History] Fetching data from API...', { currentPage, itemsPerPage, statusFilter });
    }
    setIsLoading(true);
    setError(null);
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Payment History] Calling API with params:', { page: currentPage, limit: itemsPerPage });
      }
      const response = await getPaymentHistory({
        page: currentPage,
        limit: itemsPerPage,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[Payment History] API Response received:', { 
          total: response.total, 
          count: response.count, 
          itemsCount: response.items.length,
          items: response.items 
        });
      }

      // Filter by status if needed (client-side filtering)
      let filteredItems = response.items;
      if (statusFilter !== 'all') {
        filteredItems = response.items.filter(item => item.status === statusFilter);
      }

      // Map API response to PaymentRecord format
      const mappedRecords = filteredItems.map(mapPaymentHistoryToPaymentRecord);
      console.log('[Payment History] Mapped records:', mappedRecords);
      setPaymentRecords(mappedRecords);
      setTotalItems(response.total);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      console.error('[Payment History] ❌ Failed to fetch payment history:', err);
      console.error('[Payment History] Error details:', err?.response?.data || err?.message);
      const errorMessage = err?.message || 'Failed to load payment history';
      setError(errorMessage);
      setPaymentRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, statusFilter]);

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchPaymentHistory();
  }, [fetchPaymentHistory]);

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

  // Calculate statistics from fetched data
  const totalSuccessful = useMemo(
    () =>
      paymentRecords
        .filter((r) => r.status === "successful")
        .reduce((sum, r) => sum + r.amount, 0),
    [paymentRecords],
  );

  const totalPending = useMemo(
    () =>
      paymentRecords
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.amount, 0),
    [paymentRecords],
  );

  const totalFailed = useMemo(
    () =>
      paymentRecords
        .filter((r) => r.status === "failed")
        .reduce((sum, r) => sum + r.amount, 0),
    [paymentRecords],
  );

  const totalPayments = useMemo(() => paymentRecords.length, [paymentRecords]);

  // Filter and sort data (client-side filtering for period and search)
  const filteredData = useMemo(() => {
    let filtered = paymentRecords.filter((item) => {
      // Status is already filtered by API, but we keep it for consistency
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesPeriod = filterByPeriod(item.paymentDate, periodFilter);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.id.toLowerCase().includes(searchLower) ||
        item.transactionId.toLowerCase().includes(searchLower) ||
        item.utr.toLowerCase().includes(searchLower) ||
        item.paymentMethod.toLowerCase().includes(searchLower) ||
        item.accountDetails.toLowerCase().includes(searchLower) ||
        (item.requestId && item.requestId.toLowerCase().includes(searchLower));

      return matchesStatus && matchesPeriod && matchesSearch;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof PaymentRecord];
        let bValue: any = b[sortConfig.key as keyof PaymentRecord];

        if (sortConfig.key === "paymentDate") {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [paymentRecords, searchQuery, statusFilter, periodFilter, sortConfig]);

  // Client-side pagination for filtered data (after search/period filter)
  const clientFilteredPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

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

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "successful":
        return (
          <Badge
            tone="green"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Successful
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
      case "failed":
        return (
          <Badge
            tone="red"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Failed
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "successful":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "failed":
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

      // For jspdf-autotable v5 with jsPDF v3
      // Import both modules
      const jsPDFModule = await import("jspdf");
      const autoTableModule = typeof window !== "undefined" ? await import("jspdf-autotable") : null;
      
      const jsPDF = jsPDFModule.default;
      
      // Use all filtered data (or last one month if too many records)
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);

      const oneMonthData = filteredData.filter((item) => {
        const itemDate = new Date(item.paymentDate);
        return itemDate >= oneMonthAgo;
      });

      // Use one month data if available, otherwise use all filtered data
      const exportData = oneMonthData.length > 0 ? oneMonthData : filteredData;
      
      console.log('Export data length:', exportData.length);

      // Create PDF instance
      const doc = new jsPDF();
      
      // Get autoTable function - try different ways it might be exported
      let autoTableFn: any = null;
      
      // Method 1: Check if it's attached as a method
      if (typeof (doc as any).autoTable === "function") {
        autoTableFn = (config: any) => (doc as any).autoTable(config);
        console.log("Using autoTable as method on doc");
      } 
      // Method 2: Try default export
      else if (autoTableModule && typeof (autoTableModule as any).default === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).default(doc, config);
        console.log("Using autoTable as default export function");
      }
      // Method 3: Try named export
      else if (autoTableModule && typeof (autoTableModule as any).autoTable === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).autoTable(doc, config);
        console.log("Using autoTable as named export function");
      }
      
      if (!autoTableFn) {
        console.error("autoTable not available. Plugin module:", autoTableModule);
        console.error("doc object:", doc);
        throw new Error("autoTable plugin not loaded. Please refresh the page and try again.");
      }

      // Title
      doc.setFontSize(18);
      doc.text("Payment History Report (Last 1 Month)", 14, 20);

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
        r.transactionId,
        r.utr,
        `₹${formatCurrency(r.amount)}`,
        r.paymentMethod,
        r.accountDetails,
        r.status.toUpperCase(),
        formatDate(r.paymentDate),
        r.requestId || "-",
      ]);

      // Add table using the correct autoTable function
      const tableConfig = {
        head: [
          [
            "Sr",
            "Transaction ID",
            "UTR",
            "Amount",
            "Payment Method",
            "Account Details",
            "Status",
            "Payment Date",
            "Request ID",
          ],
        ],
        body: tableData,
        startY: 50,
        styles: { fontSize: 7 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 50 },
      };
      
      // Use autoTable function
      autoTableFn(tableConfig);

      // Save PDF
      const fileName = `payment-history-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      console.log('PDF exported successfully:', fileName);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error?.message || 'Unknown error'}`);
    }
  };


  const handleViewInvoice = (item: PaymentRecord) => {
    // Only show invoice for successful payments
    if (item.status === "successful") {
      setSelectedInvoice(item);
    }
  };

  const getInvoiceData = (item: PaymentRecord) => {
    const payment = item as PaymentRecord;
    return {
      id: payment.id,
      billNumber: payment.transactionId,
      invoiceDate: payment.paymentDate,
      dueDate: payment.paymentDate,
      paidDate: payment.paymentDate,
      status: "paid" as const,
      items: [
        {
          description: `Payment for ${payment.requestId || "Transaction"}`,
          amount: payment.amount,
        },
      ],
      totalAmount: payment.amount,
      paymentMethod: payment.paymentMethod,
      utr:
        payment.utr !== "N/A" && payment.utr !== "Pending..."
          ? payment.utr
          : undefined,
      billedTo: {
        name: user?.name || "Secure Investment Academy",
        email: user?.email || "secureinvestmentacademyinfo@gmail.com",
        phone: "02269621972",
        address: "Sample, Maharashtra",
      },
        payTo: {
          name: "SECURE ACADEMY",
          address:
            "Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207",
          website: "mysecureacademy.in",
        },
      };
  };


  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 bg-[var(--content-bg)] min-h-screen transition-colors duration-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <H1>Payment History</H1>
      </div>

      {/* Summary Statistics */}
      <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Successful
                  </p>
                  <p className="text-xl font-bold text-emerald-600">
                    ₹{formatCurrency(totalSuccessful)}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Pending
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    ₹{formatCurrency(totalPending)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Failed
                  </p>
                  <p className="text-xl font-bold text-red-600">
                    ₹{formatCurrency(totalFailed)}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Payments
                  </p>
                  <p className="text-xl font-bold text-[var(--text-strong)]">
                    {totalPayments}
                  </p>
                </div>
                <Banknote className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Filters and Controls */}
          <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] p-4 md:p-5 transition-colors duration-200">
              <div>
                <p className="text-xs md:text-[13px] text-[var(--text-muted)] font-semibold">
                  Track all your payment transactions and history
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  className="w-full pl-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-body)] px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px] transition-colors duration-200 focus:ring-blue-500 focus:ring-2"
                  placeholder="Search by Transaction ID, UTR, Payment Method, Account..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: "all", label: "All" },
                    { value: "successful", label: "Successful" },
                    { value: "pending", label: "Pending" },
                    { value: "failed", label: "Failed" },
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
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-[var(--text-muted)] font-medium">
                  Loading payment history...
                </p>
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 font-medium mb-2">Error loading payment history</p>
                <p className="text-[var(--text-muted)] text-sm">{error}</p>
                <Button
                  onClick={fetchPaymentHistory}
                  className="mt-4"
                  variant="primary"
                >
                  Retry
                </Button>
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCard className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-muted)] font-medium">
                  No payment records found matching your criteria.
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
                        <TH>Transaction ID</TH>
                        <TH>UTR</TH>
                        <TH
                          className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
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
                          className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
                          onClick={() => handleSort("paymentDate")}
                        >
                          <div className="flex items-center gap-1">
                            Payment Date
                            {sortConfig?.key === "paymentDate" && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </div>
                        </TH>
                        <TH>Request ID</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {paginatedData.map((row, index) => (
                        <TR
                          key={row.id}
                          className="transition-all duration-200"
                        >
                          <TD className="whitespace-nowrap text-[var(--text-muted)]">
                            {startIndex + index + 1}
                          </TD>
                          <TD className="whitespace-nowrap font-medium text-blue-600">
                            {row.transactionId}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm font-mono">
                            {row.utr}
                          </TD>
                          <TD className="whitespace-nowrap font-semibold text-emerald-600">
                            ₹{formatCurrency(row.amount)}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-body)]">
                            {row.paymentMethod}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                            {row.accountDetails}
                          </TD>
                          <TD className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(row.status)}
                              {getStatusBadge(row.status)}
                            </div>
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                            {formatDate(row.paymentDate)}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                            {row.requestId ? (
                              <span className="text-purple-600 font-medium">
                                {row.requestId}
                              </span>
                            ) : (
                              "-"
                            )}
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
                      className={`p-4 border-l-4 rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200 bg-[var(--card-bg)] border-[var(--border)] ${
                        row.status === "successful"
                          ? "border-l-emerald-500"
                          : row.status === "pending"
                            ? "border-l-amber-500"
                            : "border-l-red-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Transaction ID
                          </span>
                          <span className="text-sm font-semibold text-blue-600">
                            {row.transactionId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          {getStatusBadge(row.status)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Amount
                        </span>
                        <span className="text-lg font-bold text-emerald-600">
                          ₹{formatCurrency(row.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          UTR
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">
                          {row.utr}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Payment Method
                        </span>
                        <span className="text-sm text-[var(--text-body)]">
                          {row.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Account Details
                        </span>
                        <span className="text-sm text-[var(--text-muted)] break-words text-right">
                          {row.accountDetails}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Payment Date
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDate(row.paymentDate)}
                        </span>
                      </div>
                      {row.requestId && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Request ID
                          </span>
                          <span className="text-xs text-purple-600 font-medium">
                            {row.requestId}
                          </span>
                        </div>
                      )}
                      {row.remarks && (
                        <div className="mt-2 pt-2 border-t border-[var(--border)]">
                          <span className="text-xs text-[var(--text-muted)]">
                            Remarks:{" "}
                          </span>
                          <span className="text-xs text-red-600">
                            {row.remarks}
                          </span>
                        </div>
                      )}
                      {row.status === "successful" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                          <button
                            onClick={() => handleViewInvoice(row)}
                            className="flex-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View Invoice
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {clientFilteredPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-5 border-t border-[var(--border)] transition-colors duration-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">
                        Items per page:
                      </span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-body)] px-3 py-1.5 text-sm transition-colors duration-200"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">
                        Showing {startIndex + 1} to{" "}
                        {Math.min(
                          startIndex + itemsPerPage,
                          filteredData.length,
                        )}{" "}
                        of {filteredData.length} payments
                        {totalItems > filteredData.length && ` (${totalItems} total)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-[var(--card-bg)]"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-[var(--text-muted)]">
                        Page {currentPage} of {clientFilteredPages > 0 ? clientFilteredPages : 1}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(clientFilteredPages || 1, prev + 1),
                          )
                        }
                        disabled={currentPage >= (clientFilteredPages || 1)}
                        className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-[var(--card-bg)]"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>

      {/* Pay First Modal */}
      <PayFirstModal
        isOpen={showPayFirstModal}
        onClose={() => setShowPayFirstModal(false)}
      />

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-4xl">
            <div className="bg-white rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Action Buttons - Top Right */}
              <div className="sticky top-0 bg-white border-b border-[var(--border)] p-4 flex justify-end gap-2 rounded-t-lg z-10 shadow-sm">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    try {
                      // Import both modules
                      const jsPDFModule = await import("jspdf");
                      const autoTableModule = typeof window !== "undefined" ? await import("jspdf-autotable") : null;
                      
                      const jsPDF = jsPDFModule.default;
                      
                      // Create and download PDF
                      const invoiceData = getInvoiceData(selectedInvoice);
                      const doc = new jsPDF();
                      
                      // Get autoTable function - try different ways it might be exported
                      let autoTableFn: any = null;
                      
                      // Method 1: Check if it's attached as a method
                      if (typeof (doc as any).autoTable === "function") {
                        autoTableFn = (config: any) => (doc as any).autoTable(config);
                        console.log("Using autoTable as method on doc");
                      } 
                      // Method 2: Try default export
                      else if (autoTableModule && typeof (autoTableModule as any).default === "function") {
                        autoTableFn = (config: any) => (autoTableModule as any).default(doc, config);
                        console.log("Using autoTable as default export function");
                      }
                      // Method 3: Try named export
                      else if (autoTableModule && typeof (autoTableModule as any).autoTable === "function") {
                        autoTableFn = (config: any) => (autoTableModule as any).autoTable(doc, config);
                        console.log("Using autoTable as named export function");
                      }
                      
                      if (!autoTableFn) {
                        console.error("autoTable not available. Plugin module:", autoTableModule);
                        throw new Error("autoTable plugin not loaded. Please refresh the page and try again.");
                      }
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 14;
                    let yPos = margin;

                    // Logo and Header
                    doc.setFontSize(20);
                    doc.setTextColor(128, 0, 128);
                    doc.text("SECURE INVESTMENT ACADEMY", pageWidth / 2, yPos, {
                      align: "center",
                    });
                    yPos += 10;

                    // Invoice Title
                    doc.setFontSize(16);
                    doc.setTextColor(0, 0, 0);
                    doc.text("INVOICE", pageWidth / 2, yPos, {
                      align: "center",
                    });
                    yPos += 15;

                    // Invoice Number and Date
                    doc.setFontSize(10);
                    doc.text(
                      `Invoice #: ${invoiceData.billNumber}`,
                      margin,
                      yPos,
                    );
                    doc.text(
                      `Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 10;

                    // Billed To
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.text("Billed To:", margin, yPos);
                    yPos += 6;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.text(invoiceData.billedTo.name, margin, yPos);
                    yPos += 5;
                    doc.text(invoiceData.billedTo.email, margin, yPos);
                    yPos += 5;
                    doc.text(invoiceData.billedTo.phone, margin, yPos);
                    yPos += 5;
                    doc.text(invoiceData.billedTo.address, margin, yPos);
                    yPos += 10;

                    // Pay To
                    doc.setFont("helvetica", "bold");
                    doc.text("Pay To:", pageWidth - margin, yPos, {
                      align: "right",
                    });
                    yPos += 6;
                    doc.setFont("helvetica", "normal");
                    doc.text(invoiceData.payTo.name, pageWidth - margin, yPos, {
                      align: "right",
                    });
                    yPos += 5;
                    doc.text(
                      invoiceData.payTo.address,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 5;
                    doc.text(
                      invoiceData.payTo.website,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 15;

                    // Items Table
                    const tableData = invoiceData.items.map((item, index) => [
                      index + 1,
                      item.description,
                      `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    ]);

                    const invoiceTableConfig = {
                      head: [["Sr", "Description", "Amount"]],
                      body: tableData,
                      startY: yPos,
                      styles: { fontSize: 9 },
                      headStyles: {
                        fillColor: [128, 0, 128],
                        textColor: 255,
                        fontStyle: "bold",
                      },
                      alternateRowStyles: { fillColor: [245, 245, 245] },
                      margin: { left: margin, right: margin },
                    };
                    
                    // Use autoTable function
                    autoTableFn(invoiceTableConfig);

                    yPos = (doc as any).lastAutoTable.finalY + 10;

                    // Total
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.text(
                      `Total Amount: ₹${invoiceData.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 5;
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.text(`(0% tax)`, pageWidth - margin, yPos, {
                      align: "right",
                    });
                    yPos += 10;

                    // Thank You Message
                    yPos += 15;
                    doc.setFontSize(10);
                    doc.text(
                      "Thank You For Your Interest in Our Business,",
                      pageWidth / 2,
                      yPos,
                      { align: "center" },
                    );
                    yPos += 5;
                    doc.text(
                      `We have Received Rs. ${invoiceData.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/- as credit from You.`,
                      pageWidth / 2,
                      yPos,
                      { align: "center" },
                    );
                    yPos += 5;
                    doc.text(
                      "You are getting additionally access to our course.",
                      pageWidth / 2,
                      yPos,
                      { align: "center" },
                    );

                    doc.save(`invoice-${invoiceData.billNumber}.pdf`);
                    } catch (error: any) {
                      console.error('Error generating invoice PDF:', error);
                      alert(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedInvoice(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-120px)]">
                <InvoiceTemplate
                  invoice={getInvoiceData(selectedInvoice)}
                  onClose={() => setSelectedInvoice(null)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
