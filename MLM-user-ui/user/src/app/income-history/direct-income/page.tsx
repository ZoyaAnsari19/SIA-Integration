"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  TrendingUp,
  Calendar,
  FileText,
  Loader2,
  X,
} from "lucide-react";
// jsPDF will be imported dynamically after jspdf-autotable is loaded
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { SortableTableHeader } from "@/components/ui/SortableTableHeader";
import { getDirectIncome, type IncomeHistoryResponse } from "@/lib/mock/income";

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

export default function DirectIncomePage() {
  const [memberFilter, setMemberFilter] = useState("");
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
        const data = await getDirectIncome({
          page: currentPage,
          limit: itemsPerPage,
        });
        setIncomeData(data);
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to load income data';
        setError(errorMessage);
        console.error('Direct monthly recurring fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIncome();
  }, [currentPage, itemsPerPage]);

  // Income data from API (already fetched in useEffect)
  
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

  // Calculate statistics from API data
  const totalIncome = useMemo(() => {
    if (!incomeData) return 0;
    return incomeData.items.reduce((sum, item) => sum + item.amount, 0);
  }, [incomeData]);

  const thisMonthIncome = useMemo(() => {
    if (!incomeData) return 0;
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
    if (!incomeData) return [];
    
    let filtered = incomeData.items.filter((item) => {
      const usernameStr = item.source_user_name?.toLowerCase() || '';
      const idStr = item.id.toString();
      
      const matchesMember =
        !memberFilter ||
        usernameStr.includes(memberFilter.toLowerCase()) ||
        idStr.includes(memberFilter);

      const matchesPeriod = filterByPeriod(item.credited_at.toString(), periodFilter);

      return matchesMember && matchesPeriod;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === "amount") {
          aValue = a.amount;
          bValue = b.amount;
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        } else if (sortConfig.key === "investment") {
          aValue = a.investment || 0;
          bValue = b.investment || 0;
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        } else if (sortConfig.key === "member" || sortConfig.key === "username") {
          aValue = a.source_user_name || '';
          bValue = b.source_user_name || '';
        } else if (sortConfig.key === "date") {
          aValue = new Date(a.credited_at).getTime();
          bValue = new Date(b.credited_at).getTime();
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        } else {
          aValue = a[sortConfig.key as keyof typeof a];
          bValue = b[sortConfig.key as keyof typeof b];
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [incomeData, memberFilter, periodFilter, sortConfig]);

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
    setMemberFilter("");
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
      doc.text("Direct Monthly Recurring History Report (Last 1 Month)", 14, 20);

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
        const displayId = (r as any).source_user_display_id || formatDisplayId((r as any).source_user_id);
        const memberLabel = r.source_user_name
          ? displayId
            ? `${r.source_user_name} (${displayId})`
            : r.source_user_name
          : displayId || 'N/A';

        return [
          index + 1,
          memberLabel,
          r.package_name && r.package_price 
            ? `${r.package_name} (₹${formatCurrency(r.package_price)})`
            : r.investment 
              ? `₹${formatCurrency(r.investment)}`
              : 'N/A',
          `₹${formatCurrency(r.amount)}`,
          formatDate(r.credited_at),
        ];
      });

      // Add table
      const tableConfig = {
        head: [
          [
            "Sr No",
            "Team Member",
            "Investment (₹)",
            "Income Amount (₹)",
            "Date",
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
      
      autoTableFn(tableConfig);

      // Save PDF
      doc.save(`direct-monthly-recurring-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return typeof dateString === 'string' ? dateString : dateString.toString();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDisplayId = (id?: string | number | null) => {
    if (id === null || id === undefined) return null;
    const idStr = typeof id === "string" ? id : id.toString();
    if (!idStr) return null;

    return `SIA${idStr.padStart(5, "0")}`;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
        <H1>Direct Monthly Recurring</H1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading direct monthly recurring history...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
        <H1>Direct Monthly Recurring</H1>
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error loading direct monthly recurring history</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
      <H1>Direct Monthly Recurring</H1>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <StatCard
          label="Total Income"
          value={`₹${formatCurrency(totalIncome)}`}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          label="This Month"
          value={`₹${formatCurrency(thisMonthIncome)}`}
          icon={Calendar}
          iconColor="text-emerald-600"
          iconBgColor="bg-emerald-100"
        />
        <StatCard
          label="Total Records"
          value={incomeData?.total || 0}
          icon={FileText}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-100"
        />
      </div>

      {/* Filter Section */}
      <Card className="p-5">
        <FilterBar
          searchValue={memberFilter}
          onSearchChange={setMemberFilter}
          searchPlaceholder="Enter name, username, or ID"
          filters={[
            {
              key: "period",
              label: "Filter by Period",
              value: periodFilter,
              onChange: (value) => setPeriodFilter(value as PeriodFilter),
              options: [
                { value: "all", label: "All Time" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ],
            },
          ]}
          onClear={clearFilters}
        />
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-end items-center gap-2.5 pb-4 border-b border-(--border) mb-5">
          <Button variant="primary" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1.5" />
            Export PDF
          </Button>
        </div>

        {paginatedData.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No income records found"
            description="Try adjusting your filters or check back later."
            actionLabel="Clear Filters"
            onAction={clearFilters}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block w-full overflow-x-auto mb-5">
              <Table className="w-full">
                <THead>
                  <tr>
                    <TH>Sr No</TH>
                    <TH>Team Member</TH>
                    <SortableTableHeader
                      columnKey="investment"
                      label="Investment (₹)"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      columnKey="amount"
                      label="Income Amount (₹)"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      columnKey="date"
                      label="Date"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </tr>
                </THead>
                <tbody>
                  {paginatedData.map((row, index) => (
                    <TR
                      key={row.id}
                      className="hover:bg-(--sidebar-hover) transition-all duration-200"
                    >
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {(() => {
                          // Use actual display_id from API if available, otherwise generate from user ID
                          const displayId = (row as any).source_user_display_id 
                            || formatDisplayId((row as any).source_user_id);
                          if (row.source_user_name) {
                            return displayId
                              ? `${row.source_user_name} (${displayId})`
                              : row.source_user_name;
                          }
                          return displayId || "N/A";
                        })()}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-blue-600">
                        {row.package_name && row.package_price ? (
                          <div className="flex flex-col">
                            <span>{row.package_name}</span>
                            <span className="text-sm text-[var(--text-muted)]">₹{formatCurrency(row.package_price)}</span>
                          </div>
                        ) : row.investment ? (
                          `₹${formatCurrency(row.investment)}`
                        ) : (
                          'N/A'
                        )}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-emerald-600">
                        ₹{formatCurrency(row.amount)}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {formatDate(row.credited_at)}
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
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-(--text-muted)">Sr No</span>
                    <span className="text-sm font-semibold text-[var(--text-strong)]">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Team Member
                    </span>
                    <span className="text-sm text-[var(--text-body)] wrap-break-word text-right">
                      {(() => {
                        const displayId = (row as any).source_user_display_id 
                          || formatDisplayId((row as any).source_user_id);
                        if (row.source_user_name) {
                          return displayId
                            ? `${row.source_user_name} (${displayId})`
                            : row.source_user_name;
                        }
                        return displayId || "N/A";
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Investment
                    </span>
                    <span className="text-base font-semibold text-blue-600">
                      {row.package_name && row.package_price ? (
                        <div className="flex flex-col items-end">
                          <span>{row.package_name}</span>
                          <span className="text-sm text-[var(--text-muted)]">₹{formatCurrency(row.package_price)}</span>
                        </div>
                      ) : row.investment ? (
                        `₹${formatCurrency(row.investment)}`
                      ) : (
                        'N/A'
                      )}
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
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--text-muted)]">Date</span>
                    <span className="text-sm text-[var(--text-body)]">
                      {formatDate(row.credited_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={incomeData?.total || 0}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(value) => {
                setItemsPerPage(value);
                setCurrentPage(1);
              }}
            />
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
