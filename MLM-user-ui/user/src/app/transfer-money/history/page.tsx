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
  ArrowUp,
  ArrowDown,
  Send,
  ArrowDownCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getTransferHistory } from "@/lib/mock/wallet";

type TransferType = "sent" | "received" | "all";
type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

interface TransferRecord {
  id: string;
  type: "sent" | "received";
  sender_id: string;
  sender_name: string | null;
  sender_display_id: string | null;
  receiver_id: string;
  receiver_name: string | null;
  receiver_display_id: string | null;
  amount: number;
  tax_amount: number;
  net_amount: number;
  remarks: string | null;
  created_at: string;
}

export default function TransferHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransferType>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // API state
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch transfer history from API
  const fetchTransferHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getTransferHistory({
        type: typeFilter === "all" ? undefined : typeFilter,
        page: currentPage,
        limit: itemsPerPage,
      });

      setTransferRecords(response.items);
      setTotalItems(response.total);
      setTotalPages(Math.ceil(response.total / itemsPerPage));
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load transfer history';
      setError(errorMessage);
      setTransferRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, typeFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchTransferHistory();
  }, [fetchTransferHistory]);

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
  const totalSent = useMemo(
    () =>
      transferRecords
        .filter((r) => r.type === "sent")
        .reduce((sum, r) => sum + r.amount + r.tax_amount, 0), // Total deducted (amount + tax)
    [transferRecords],
  );

  const totalReceived = useMemo(
    () =>
      transferRecords
        .filter((r) => r.type === "received")
        .reduce((sum, r) => sum + r.net_amount, 0),
    [transferRecords],
  );

  const totalTransfers = useMemo(() => transferRecords.length, [transferRecords]);

  // Filter and sort data (client-side filtering for period and search)
  const filteredData = useMemo(() => {
    let filtered = transferRecords.filter((item) => {
      const matchesPeriod = filterByPeriod(item.created_at, periodFilter);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.sender_name?.toLowerCase().includes(searchLower) ||
        item.receiver_name?.toLowerCase().includes(searchLower) ||
        item.sender_display_id?.toLowerCase().includes(searchLower) ||
        item.receiver_display_id?.toLowerCase().includes(searchLower) ||
        item.sender_id.toLowerCase().includes(searchLower) ||
        item.receiver_id.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower);

      return matchesPeriod && matchesSearch;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof TransferRecord];
        let bValue: any = b[sortConfig.key as keyof TransferRecord];

        if (sortConfig.key === "created_at") {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [transferRecords, searchQuery, periodFilter, sortConfig]);

  // Client-side pagination for filtered data
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

  const handleExportPDF = async () => {
    try {
      if (filteredData.length === 0) {
        alert("No data available to export");
        return;
      }

      // Import both modules
      const jsPDFModule = await import("jspdf");
      const autoTableModule =
        typeof window !== "undefined" ? await import("jspdf-autotable") : null;

      const jsPDF = jsPDFModule.default;

      // Get last one month data
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);

      const oneMonthData = filteredData.filter((item) => {
        const itemDate = new Date(item.created_at);
        return itemDate >= oneMonthAgo;
      });

      const exportData =
        oneMonthData.length > 0 ? oneMonthData : filteredData;

      // Create PDF instance
      const doc = new jsPDF();

      // Get autoTable function
      let autoTableFn: any = null;

      if (typeof (doc as any).autoTable === "function") {
        autoTableFn = (config: any) => (doc as any).autoTable(config);
      } else if (
        autoTableModule &&
        typeof (autoTableModule as any).default === "function"
      ) {
        autoTableFn = (config: any) =>
          (autoTableModule as any).default(doc, config);
      } else if (
        autoTableModule &&
        typeof (autoTableModule as any).autoTable === "function"
      ) {
        autoTableFn = (config: any) =>
          (autoTableModule as any).autoTable(doc, config);
      }

      if (!autoTableFn) {
        throw new Error(
          "autoTable plugin not loaded. Please refresh the page and try again.",
        );
      }

      // Title
      doc.setFontSize(18);
      doc.text("P2P Transfer History Report (Last 1 Month)", 14, 20);

      // Date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
      doc.text(`Total Records: ${exportData.length}`, 14, 36);
      doc.text(
        `Total Sent: ₹${formatCurrency(
          exportData
            .filter((r) => r.type === "sent")
            .reduce((sum, r) => sum + r.amount + r.tax_amount, 0), // Total deducted (amount + tax)
        )}`,
        14,
        42,
      );
      doc.text(
        `Total Received: ₹${formatCurrency(
          exportData
            .filter((r) => r.type === "received")
            .reduce((sum, r) => sum + r.net_amount, 0),
        )}`,
        14,
        48,
      );

      // Table data
      const tableData = exportData.map((r, index) => {
        const userDisplayId = r.type === "sent"
          ? (r.receiver_display_id || r.receiver_id)
          : (r.sender_display_id || r.sender_id);
        const userName = r.type === "sent"
          ? (r.receiver_name || userDisplayId)
          : (r.sender_name || userDisplayId);
        
        // For sent transactions: show total deducted (amount + tax)
        // For received transactions: show net amount (what receiver gets, which equals amount)
        const displayNetAmount = r.type === "sent" 
          ? r.amount + r.tax_amount  // Total deducted from sender
          : r.net_amount;  // Amount received (equals amount, no tax deduction)
        
        return [
          index + 1,
          r.type === "sent" ? "Sent" : "Received",
          userName,
          `₹${formatCurrency(r.amount)}`,
          `₹${formatCurrency(r.tax_amount)}`,
          `₹${formatCurrency(displayNetAmount)}`,
          formatDate(r.created_at),
          r.remarks || "-",
        ];
      });

      // Add table
      const tableConfig = {
        head: [
          [
            "Sr",
            "Type",
            "User",
            "Amount",
            "Tax",
            "Net Amount",
            "Date",
            "Remarks",
          ],
        ],
        body: tableData,
        startY: 55,
        styles: { fontSize: 8 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 55 },
      };

      autoTableFn(tableConfig);

      // Save PDF
      const fileName = `p2p-transfer-history-${new Date()
        .toISOString()
        .split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      alert(`Failed to export PDF: ${error?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 bg-[var(--content-bg)] min-h-screen transition-colors duration-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <H1>P2P Transfer History</H1>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Sent
              </p>
              <p className="text-xl font-bold text-blue-600">
                ₹{formatCurrency(totalSent)}
              </p>
            </div>
            <Send className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Received
              </p>
              <p className="text-xl font-bold text-emerald-600">
                ₹{formatCurrency(totalReceived)}
              </p>
            </div>
            <ArrowDownCircle className="w-8 h-8 text-emerald-500 opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Transfers
              </p>
              <p className="text-xl font-bold text-[var(--text-strong)]">
                {totalTransfers}
              </p>
            </div>
            <FileText className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] p-4 md:p-5 transition-colors duration-200">
          <div>
            <p className="text-xs md:text-[13px] text-[var(--text-muted)] font-semibold">
              View and manage all your P2P transfer transactions
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
              placeholder="Search by user name, ID, or transaction ID..."
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
                { value: "all", label: "All", icon: FileText },
                { value: "sent", label: "Sent", icon: Send },
                { value: "received", label: "Received", icon: ArrowDownCircle },
              ].map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setTypeFilter(filter.value as TransferType);
                      setCurrentPage(1);
                    }}
                    className={[
                      "px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors min-h-[44px] flex items-center gap-1",
                      typeFilter === filter.value
                        ? "bg-blue-600 text-white border border-blue-600"
                        : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)]",
                    ].join(" ")}
                  >
                    <Icon className="h-3 w-3" />
                    {filter.label}
                  </button>
                );
              })}
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
              Loading transfer history...
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 font-medium mb-2">
              Error loading transfer history
            </p>
            <p className="text-[var(--text-muted)] text-sm">{error}</p>
            <Button
              onClick={fetchTransferHistory}
              className="mt-4"
              variant="primary"
            >
              Retry
            </Button>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] font-medium">
              No transfer records found matching your criteria.
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
                    <TH>Type</TH>
                    <TH>User</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Amount (₹)
                        {sortConfig?.key === "amount" && (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </TH>
                    <TH>Tax (₹)</TH>
                    <TH>Net Amount (₹)</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
                      onClick={() => handleSort("created_at")}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortConfig?.key === "created_at" && (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </TH>
                    <TH>Remarks</TH>
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
                      <TD className="whitespace-nowrap">
                        {row.type === "sent" ? (
                          <Badge
                            tone="blue"
                            soft={false}
                            className="uppercase text-xs font-bold flex items-center gap-1 w-fit"
                          >
                            <Send className="h-3 w-3" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge
                            tone="green"
                            soft={false}
                            className="uppercase text-xs font-bold flex items-center gap-1 w-fit"
                          >
                            <ArrowDownCircle className="h-3 w-3" />
                            Received
                          </Badge>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-strong)]">
                            {row.type === "sent"
                              ? row.receiver_name || row.receiver_display_id || row.receiver_id
                              : row.sender_name || row.sender_display_id || row.sender_id}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {row.type === "sent" 
                              ? (row.receiver_display_id || row.receiver_id)
                              : (row.sender_display_id || row.sender_id)}
                          </span>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-[var(--text-strong)]">
                        ₹{formatCurrency(row.amount)}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                        ₹{formatCurrency(row.tax_amount)}
                      </TD>
                      <TD
                        className={`whitespace-nowrap font-semibold ${
                          row.type === "sent"
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {(() => {
                          // For sent: show total deducted (amount + tax)
                          // For received: show net amount (what receiver gets)
                          const displayNetAmount = row.type === "sent" 
                            ? row.amount + row.tax_amount  // Total deducted from sender
                            : row.net_amount;  // Amount received
                          return (
                            <>
                              {row.type === "sent" ? "-" : "+"}₹
                              {formatCurrency(displayNetAmount)}
                            </>
                          );
                        })()}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                        {formatDate(row.created_at)}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm max-w-xs truncate">
                        {row.remarks || "-"}
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
                    row.type === "sent"
                      ? "border-l-blue-500"
                      : "border-l-emerald-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {row.type === "sent" ? (
                        <Badge
                          tone="blue"
                          soft={false}
                          className="uppercase text-xs font-bold flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge
                          tone="green"
                          soft={false}
                          className="uppercase text-xs font-bold flex items-center gap-1"
                        >
                          <ArrowDownCircle className="h-3 w-3" />
                          Received
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatDate(row.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">User</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-[var(--text-strong)]">
                        {row.type === "sent"
                          ? row.receiver_name || row.receiver_display_id || row.receiver_id
                          : row.sender_name || row.sender_display_id || row.sender_id}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] block">
                        {row.type === "sent" 
                          ? (row.receiver_display_id || row.receiver_id)
                          : (row.sender_display_id || row.sender_id)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Amount
                    </span>
                    <span className="text-lg font-bold text-[var(--text-strong)]">
                      ₹{formatCurrency(row.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">Tax</span>
                    <span className="text-sm text-[var(--text-muted)]">
                      ₹{formatCurrency(row.tax_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Net Amount
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        row.type === "sent" ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {(() => {
                        // For sent: show total deducted (amount + tax)
                        // For received: show net amount (what receiver gets)
                        const displayNetAmount = row.type === "sent" 
                          ? row.amount + row.tax_amount  // Total deducted from sender
                          : row.net_amount;  // Amount received
                        return (
                          <>
                            {row.type === "sent" ? "-" : "+"}₹
                            {formatCurrency(displayNetAmount)}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  {row.remarks && (
                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                      <span className="text-xs text-[var(--text-muted)]">
                        Remarks:{" "}
                      </span>
                      <span className="text-xs text-[var(--text-body)]">
                        {row.remarks}
                      </span>
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
                    of {filteredData.length} transfers
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
                    Page {currentPage} of{" "}
                    {clientFilteredPages > 0 ? clientFilteredPages : 1}
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
    </div>
  );
}

