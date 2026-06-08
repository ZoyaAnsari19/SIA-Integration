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
  Users,
  Loader2,
} from "lucide-react";
// jsPDF will be imported dynamically after jspdf-autotable is loaded
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { getTeamIncome, type IncomeHistoryResponse } from "@/lib/mock/income";

type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

export default function TeamIncomePage() {
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
        const data = await getTeamIncome({
          page: currentPage,
          limit: itemsPerPage,
        });
        setIncomeData(data);
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to load income data';
        setError(errorMessage);
        console.error('Team income fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIncome();
  }, [currentPage, itemsPerPage]);

  /**
   * TODO: MOCK DATA - Replace with actual API call
   *
   * Endpoint: GET /api/income/team-income
   * Method: GET
   * Headers: { Authorization: "Bearer <token>" }
   * Query Parameters (optional):
   *   - member: string (name or ID)
   *   - period: "daily" | "weekly" | "monthly" | "all"
   *   - page: number
   *   - limit: number
   *   - sortBy: "amount" | "member" | "level" | "date"
   *   - sortOrder: "asc" | "desc"
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "income": [
   *       {
   *         "id": 1,
   *         "member": "Anjali S.",
   *         "amount": 0.56,
   *         "date": "2025-01-01 04:00:01",
   *         "level": "Direct"
   *       }
   *     ],
   *     "pagination": {
   *       "currentPage": 1,
   *       "totalPages": 1,
   *       "totalItems": 15,
   *       "itemsPerPage": 10
   *     },
   *     "summary": {
   *       "totalIncome": 8.40,
   *       "thisMonthIncome": 8.40,
   *       "totalRecords": 15
   *     }
   *   }
   * }
   *
   * Fields available in UI:
   * - id: number
   * - member: string (team member name)
   * - amount: number (income amount)
   * - date: string (date and time)
   * - level: string (Direct, Level 1, Level 2, Level 3)
   */
  // Income data from API (already fetched in useEffect)
  
  // Helper function to filter by period

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
        } else if (sortConfig.key === "username" || sortConfig.key === "member") {
          aValue = a.source_user_name || '';
          bValue = b.source_user_name || '';
        } else if (sortConfig.key === "level") {
          aValue = a.level?.toString() || '';
          bValue = b.level?.toString() || '';
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
      doc.text("Team Income History Report (Last 1 Month)", 14, 20);

      // Date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
      doc.text(`Total Records: ${oneMonthData.length}`, 14, 36);
      doc.text(
        `Total Income: ₹${formatCurrency(oneMonthData.reduce((sum, item) => sum + item.amount, 0))}`,
        14,
        42,
      );

      // Table data
      const tableData = oneMonthData.map((r, index) => {

        // Use actual display_id from API if available, otherwise generate from user ID
        const displayId = (r as any).source_user_display_id 
          || formatDisplayId((r as any).source_user_id);
        const memberLabel = r.source_user_name
          ? displayId
            ? `${r.source_user_name} (${displayId})`
            : r.source_user_name
          : displayId || 'N/A';

        const packageInfo = (r as any).package_name 
          ? `${(r as any).package_name} (₹${formatCurrency((r as any).package_price || (r as any).investment || 0)})`
          : (r as any).investment 
            ? `₹${formatCurrency((r as any).investment)}`
            : 'N/A';
        const investmentType = (r as any).is_reinvestment !== undefined
          ? ((r as any).is_reinvestment ? 'Reinvestment' : 'Investment')
          : '';

        return [
          index + 1,
          memberLabel,
          getLevelDisplay(r.level),
          `₹${formatCurrency(r.amount)}`,
          `${packageInfo}${investmentType ? `\n${investmentType}` : ''}`,
          formatDate(r.credited_at),
        ];
      });

      // Add table
      const tableConfig = {
        head: [
          [
            "Sr No",
            "Team Member",
            "Level",
            "Income Amount (₹)",
            "Investment",
            "Date",
          ],
        ],
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
      doc.save(`team-income-${new Date().toISOString().split("T")[0]}.pdf`);
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
        hour: "2-digit",
        minute: "2-digit",
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

  const getLevelBadgeColor = (level: string | number | null | undefined) => {
    if (!level) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    const levelStr = String(level).toLowerCase();
    if (levelStr.includes("direct")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (levelStr.includes("1")) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (levelStr.includes("2")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (levelStr.includes("3")) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  const getLevelDisplay = (level: number | string | null | undefined) => {
    if (level === null || level === undefined) return "N/A";
    if (typeof level === "number") {
      if (level === 0) return "Direct";
      return `Level ${level}`;
    }
    const levelStr = String(level);
    if (levelStr.toLowerCase().includes("direct")) return "Direct";
    return levelStr;
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
      <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
        <H1>Team Income History</H1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading team income history...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
        <H1>Team Income History</H1>
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error loading team income history</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
      <H1>Team Income History</H1>

      {/* Summary Statistics */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-(--text-body) mb-1">Total Income</p>
              <h3 className="text-2xl font-bold text-(--text-strong)">
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
              <p className="text-sm text-(--text-body) mb-1">This Month</p>
              <h3 className="text-2xl font-bold text-(--text-strong)">
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
              <p className="text-sm text-(--text-body) mb-1">Total Records</p>
              <h3 className="text-2xl font-bold text-(--text-strong)">
                {filteredData.length}
              </h3>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-(--text-body) mb-1.5">
              Filter by Team Member
            </label>
            <input
              type="text"
              placeholder="Enter name or ID"
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full px-3 py-2 border border-(--border) rounded-lg text-sm bg-(--card-bg) text-(--text-strong) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-(--text-body) mb-1.5">
              Filter by Period
            </label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="w-full px-3 py-2 border border-(--border) rounded-lg text-sm bg-(--card-bg) text-(--text-strong) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
        <div className="flex justify-end items-center gap-2.5 pb-4 border-b border-(--border) mb-5">
          <Button variant="primary" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1.5" />
            Export PDF
          </Button>
        </div>

        {paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-(--text-muted) mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-(--text-strong) mb-2">
              No income records found
            </h3>
            <p className="text-sm text-(--text-body) mb-4">
              Try adjusting your filters or check back later.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1.5" />
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto mb-5">
              <Table className="min-w-[520px]">
                <THead>
                  <tr>
                    <TH>Sr No</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--sidebar-hover) transition-colors"
                      onClick={() => handleSort("member")}
                    >
                      <div className="flex items-center gap-1">
                        Team Member
                        {sortConfig?.key === "member" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--sidebar-hover) transition-colors"
                      onClick={() => handleSort("level")}
                    >
                      <div className="flex items-center gap-1">
                        Level
                        {sortConfig?.key === "level" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--sidebar-hover) transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Income Amount (₹)
                        {sortConfig?.key === "amount" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH>
                      <div className="flex items-center gap-1">
                        Investment
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-(--sidebar-hover) transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortConfig?.key === "date" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                  </tr>
                </THead>
                <tbody>
                  {paginatedData.map((row, index) => {
                    const originalIndex = filteredData.findIndex(
                      (item) => item.id === row.id,
                    );
                    const cumulativeTotal = filteredData
                      .slice(0, originalIndex + 1)
                      .reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <TR
                        key={row.id}
                        className="hover:bg-[var(--sidebar-hover)] transition-all duration-200"
                      >
                        <TD className="whitespace-nowrap text-[var(--text-body)]">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </TD>
                        <TD className="whitespace-nowrap font-medium">
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
                        <TD className="whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getLevelBadgeColor(row.level)}`}
                          >
                            {getLevelDisplay(row.level)}
                          </span>
                        </TD>
                        <TD className="whitespace-nowrap font-semibold text-emerald-600">
                          ₹{formatCurrency(row.amount)}
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {((row as any).package_name || (row as any).investment) ? (
                              <>
                                <div className="text-sm font-medium text-[var(--text-strong)]">
                                  {(row as any).package_name 
                                    ? `${(row as any).package_name} (₹${formatCurrency((row as any).package_price || (row as any).investment || 0)})`
                                    : `₹${formatCurrency((row as any).investment || 0)}`}
                                </div>
                                {(row as any).is_reinvestment !== undefined && (
                                  <div>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      (row as any).is_reinvestment
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {(row as any).is_reinvestment ? 'Reinvestment' : 'Investment'}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-[var(--text-muted)] text-sm">N/A</span>
                            )}
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap text-[var(--text-body)] text-sm">
                          {formatDate(row.credited_at)}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap justify-between items-center pt-5 border-t border-(--border) gap-4">
              <div className="flex items-center gap-2 text-sm text-(--text-body)">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1.5 border border-(--border) rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>entries</span>
              </div>
              <div className="text-sm text-(--text-body)">
                Showing{" "}
                <span className="font-semibold text-(--text-strong)">
                  {incomeData ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-(--text-strong)">
                  {incomeData ? Math.min(currentPage * itemsPerPage, incomeData.total) : 0}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-(--text-strong)">
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
