"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Calendar,
  FileText,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
// jsPDF will be imported dynamically after jspdf-autotable is loaded
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { getSelfIncome, type IncomeHistoryResponse } from "@/lib/mock/income";

type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

export default function SelfIncomePage() {
  const [srNoFilter, setSrNoFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [showPayFirstModal, setShowPayFirstModal] = useState(false);
  
  // API Data States
  const [incomeData, setIncomeData] = useState<IncomeHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch income data
  useEffect(() => {
    const fetchIncome = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getSelfIncome({
          page: currentPage,
          limit: itemsPerPage,
        });
        setIncomeData(data);
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to load income data';
        setError(errorMessage);
        console.error('Self income fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIncome();
  }, [currentPage, itemsPerPage]);

  // Old mock data removed - now using API data

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
  const totalIncome = useMemo(
    () => incomeData?.items?.reduce((sum, item) => sum + item.amount, 0) || 0,
    [incomeData],
  );

  const thisMonthIncome = useMemo(() => {
    if (!incomeData?.items) return 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return incomeData.items
      .filter((item) => {
        const itemDate = new Date(item.credited_at);
        return (
          itemDate.getMonth() === currentMonth &&
          itemDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, item) => sum + item.amount, 0);
  }, [incomeData]);

  // Filter and sort data (client-side filtering for period and search)
  const filteredData = useMemo(() => {
    if (!incomeData?.items) return [];
    
    let filtered = incomeData.items.filter((item) => {
      const matchesSrNo =
        !srNoFilter || item.id.toString().includes(srNoFilter);
      const matchesPeriod = filterByPeriod(item.credited_at.toString(), periodFilter);
      return matchesSrNo && matchesPeriod;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a] || 0;
        const bValue = b[sortConfig.key as keyof typeof b] || 0;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [incomeData, srNoFilter, periodFilter, sortConfig]);

  // Use API pagination, but also support client-side filtering
  const totalPages = incomeData ? incomeData.total_pages : 0;
  const paginatedData = filteredData; // Show filtered results

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSrNoFilter("");
    setPeriodFilter("all");
    setCurrentPage(1);
    setSortConfig(null);
  };

  const handleExportPDF = async () => {
    try {
      // Import both modules
      const jsPDFModule = await import("jspdf");
      const autoTableModule = typeof window !== "undefined" ? await import("jspdf-autotable") : null;
      
      const jsPDF = jsPDFModule.default;

      // Get last one month data
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);

      const oneMonthData = filteredData.filter((item) => {
        const itemDate = new Date(item.credited_at);
        return itemDate >= oneMonthAgo;
      });

      const exportData = oneMonthData.length > 0 ? oneMonthData : filteredData;

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
      doc.text("Self Income History Report (Last 1 Month)", 14, 20);

      // Date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
      doc.text(`Total Records: ${exportData.length}`, 14, 36);
      doc.text(
        `Total Income: ₹${formatCurrency(exportData.reduce((sum, item) => sum + item.amount, 0))}`,
        14,
        42,
      );

      // Table data
      const tableData = exportData.map((r, index) => {
        const meta: any = (r as any).metadata || {};
        const packageName =
          meta.package_name ||
          (meta.package_id ? `Package #${meta.package_id}` : "-");

        return [
          index + 1,
          packageName,
          `₹${formatCurrency(r.amount)}`,
          formatDate(r.credited_at),
        ];
      });

      // Add table
      const tableConfig = {
        head: [["Sr No", "Package", "Income Amount (₹)", "Date"]],
        body: tableData,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 50 },
      };
      
      autoTableFn(tableConfig);

      // Save PDF
      doc.save(`self-income-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
        <H1>Self Income History</H1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading income history...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
        <H1>Self Income History</H1>
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error loading income history</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
      <H1>Self Income History</H1>

      {/* Summary Statistics */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">
                Total Income
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-strong)]">
                ₹{formatCurrency(totalIncome)}
              </h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">
                This Month
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-strong)]">
                ₹{formatCurrency(thisMonthIncome)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Calendar className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">
                Total Records
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-strong)]">
                {incomeData?.total || 0}
              </h3>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <FileText className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">
              Filter by Sr No
            </label>
            <input
              type="text"
              placeholder="Enter Sr No (e.g., 1)"
              value={srNoFilter}
              onChange={(e) => setSrNoFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card-bg)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">
              Filter by Period
            </label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card-bg)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="all">All Time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={applyFilters}>
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-end items-center gap-2.5 pb-4 border-b border-[var(--border)] mb-5">
          <Button variant="primary" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1.5" />
            Export PDF
          </Button>
        </div>

        {paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">
              No income records found
            </h3>
            <p className="text-sm text-[var(--text-body)] mb-4">
              Try adjusting your filters or check back later.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1.5" />
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block w-full overflow-x-auto mb-5">
              <Table className="w-full">
                <THead>
                  <tr>
                    <TH>Sr No</TH>
                    <TH>Package</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-[var(--sidebar-hover)] transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Income Amount (₹)
                        {sortConfig?.key === "amount" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-[var(--sidebar-hover)] transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortConfig?.key === "date" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {paginatedData.map((row, index) => (
                    <TR
                      key={row.id}
                      className="hover:bg-[var(--sidebar-hover)] transition-all duration-200"
                    >
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {(() => {
                          const meta: any = (row as any).metadata || {};
                          return (
                            meta.package_name ||
                            (meta.package_id ? `Package #${meta.package_id}` : "-")
                          );
                        })()}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-emerald-600">
                        ₹{formatCurrency(row.amount)}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {formatDate(row.credited_at)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {row.is_locked && row.hold_until ? (
                          <span className="text-amber-600 dark:text-amber-400 text-sm" title={`Locked until ${row.hold_until}`}>
                            Hold until {formatDate(row.hold_until)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm">Withdrawable</span>
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
                  className="p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors duration-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Sr No
                    </span>
                    <span className="text-sm font-semibold text-[var(--text-strong)]">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Income Amount
                    </span>
                    <span className="text-base font-semibold text-emerald-600">
                      ₹{formatCurrency(row.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Date
                    </span>
                    <span className="text-sm text-[var(--text-body)]">
                      {formatDate(row.credited_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--text-muted)]">Status</span>
                    <span className="text-sm">
                      {row.is_locked && row.hold_until ? (
                        <span className="text-amber-600 dark:text-amber-400">Hold until {formatDate(row.hold_until)}</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Withdrawable</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap justify-between items-center pt-5 border-t border-[var(--border)] gap-4">
              <div className="flex items-center gap-2 text-sm text-[var(--text-body)]">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--card-bg)] text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>entries</span>
              </div>
              <div className="text-sm text-[var(--text-body)]">
                Showing{" "}
                <span className="font-semibold text-[var(--text-strong)]">
                  {incomeData ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[var(--text-strong)]">
                  {incomeData ? Math.min((currentPage - 1) * itemsPerPage + filteredData.length, incomeData.total) : 0}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[var(--text-strong)]">
                  {incomeData?.total || 0}
                </span>{" "}
                records
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={
                          currentPage === pageNum ? "primary" : "outline"
                        }
                        size="sm"
                        className="min-w-[36px]"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Pay First Modal */}
      <PayFirstModal
        isOpen={showPayFirstModal}
        onClose={() => setShowPayFirstModal(false)}
      />
    </div>
  );
}
