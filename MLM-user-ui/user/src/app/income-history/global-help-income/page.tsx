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
  Globe,
  Loader2,
  Info,
} from "lucide-react";
// jsPDF will be imported dynamically after jspdf-autotable is loaded
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { getGlobalHelpIncome, type IncomeHistoryResponse } from "@/lib/mock/income";

type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

function getInactiveGlobalContributors(row: {
  inactive_global_contributors?: number | null;
  metadata?: { inactive_global_contributors?: number | null; global_contributors_raw?: number; global_contributors_active?: number };
}): number | null {
  if (row.inactive_global_contributors != null) return row.inactive_global_contributors;
  const meta = row.metadata;
  if (!meta) return null;
  if (meta.inactive_global_contributors != null) return meta.inactive_global_contributors;
  const raw = meta.global_contributors_raw;
  const active = meta.global_contributors_active;
  if (raw != null && active != null) return Math.max(0, Number(raw) - Number(active));
  return null;
}

export default function GlobalHelpIncomePage() {
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
        const data = await getGlobalHelpIncome({
          page: currentPage,
          limit: itemsPerPage,
        });
        setIncomeData(data);
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to load income data';
        setError(errorMessage);
        console.error('Global help income fetch error:', err);
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

  // Get total global IDs used from API (calculated across all entries, not just current page)
  const totalGlobalIdsUsed = useMemo(() => {
    if (!incomeData) return 0;
    // Use API's total_global_ids_used if available (calculated from all entries)
    // Otherwise fallback to summing current page items (for backward compatibility)
    return (incomeData as any).total_global_ids_used ?? incomeData.items.reduce((sum, item) => {
      const usedIds = (item as any).used_ids ?? (item as any).metadata?.used_ids ?? 0;
      return sum + (usedIds || 0);
    }, 0);
  }, [incomeData]);

  // Calculate today's entry
  const todayEntry = useMemo(() => {
    if (!incomeData) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find today's entry
    const entry = incomeData.items.find((item) => {
      const itemDate = new Date(item.credited_at);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === today.getTime();
    });
    
    return entry || null;
  }, [incomeData]);

  // Calculate today's global IDs used
  const todayGlobalIdsUsed = useMemo(() => {
    return todayEntry ? (todayEntry.used_ids ?? (todayEntry as any).metadata?.used_ids ?? 0) : 0;
  }, [todayEntry]);

  const todayInactiveGlobal = useMemo(() => {
    return todayEntry ? getInactiveGlobalContributors(todayEntry as any) : null;
  }, [todayEntry]);

  // Calculate today's income
  const todayIncome = useMemo(() => {
    return todayEntry ? todayEntry.amount : 0;
  }, [todayEntry]);

  // Filter and sort data (client-side filtering for period and search)
  const filteredData = useMemo(() => {
    if (!incomeData) return [];
    
    let filtered = incomeData.items.filter((item) => {
      const matchesMember =
        !memberFilter ||
        item.id.toString().includes(memberFilter);

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
      doc.text("Global Help Income History Report (Last 1 Month)", 14, 20);

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
          (meta.package_id ? `Package #${meta.package_id}` : '-');

        const inactive = getInactiveGlobalContributors(r as any);
        return [
          index + 1,
          packageName,
          `₹${formatCurrency(r.amount)}`,
          String((r as any).used_ids ?? meta.used_ids ?? '-'),
          inactive !== null ? String(inactive) : '-',
          formatDate(r.credited_at),
        ];
      });

      // Add table
      const tableConfig = {
        head: [["Sr No", "Package", "Income Amount (₹)", "Global IDs Used", "Inactive", "Date"]],
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
      doc.save(
        `global-help-income-${new Date().toISOString().split("T")[0]}.pdf`,
      );
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string | Date): string => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) {
        return String(dateString);
      }
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateString);
    }
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
        <H1>Global Commission</H1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading global help income history...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
        <H1>Global Commission</H1>
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error loading global help income history</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-6 flex flex-col gap-7">
      <H1>Global Commission</H1>

      {/* Summary Statistics */}
      <div className="grid gap-5 md:grid-cols-4">
        <Card className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-body)] mb-1">
                Total Commission
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
              <p className="text-sm text-[var(--text-body)] mb-1">This Month</p>
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
              <p className="text-sm text-[var(--text-body)] mb-1">
                Total Records
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-strong)]">
                {incomeData?.total || 0}
              </h3>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Globe className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5 hover:shadow-md transition-shadow border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-green-800">
                  Today ({new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                </p>
                <div className="group relative">
                  <Info className="h-3 w-3 text-gray-400 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <p className="mb-1 font-semibold">Today's Entry:</p>
                    <p>Shows Global IDs used and income received for today's date.</p>
                    <p className="mt-1 text-gray-300">My Packages shows current count, this shows today's snapshot.</p>
                  </div>
                </div>
              </div>
              
              {todayEntry ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-600">Global IDs:</span>
                    <span className="text-lg font-bold text-green-700">
                      {todayGlobalIdsUsed}
                    </span>
                  </div>
                  {todayInactiveGlobal !== null && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-600">Inactive:</span>
                      <span className="text-sm font-bold text-red-600">
                        {todayInactiveGlobal}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-600">Income:</span>
                    <span className="text-lg font-bold text-green-700">
                      ₹{formatCurrency(todayIncome)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-xs text-gray-500 italic mb-1">
                    ⏳ Commission pending
                  </p>
                  <p className="text-xs text-gray-400">
                    Daily job: 5:35 AM IST
                  </p>
                </div>
              )}
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">
              Filter by Team Member
            </label>
            <input
              type="text"
              placeholder="Enter name or ID"
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
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

        {/* Simple explanation - visible without hover */}
        <div className="mb-5 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-[var(--text-body)]">
          <p className="font-medium text-[var(--text-strong)] mb-2">“Global IDs Used” column meaning:</p>
          <p className="mb-1.5"><strong>English:</strong> <strong>Global IDs Used</strong> = active IDs when this income was credited. <strong>Inactive</strong> = contributors in the window who had already reached 2× on that day (not counted in payout). Package card shows the current snapshot.</p>
          <p className="mb-1.5"><strong>हिंदी:</strong> <strong>Global IDs Used</strong> = credit के समय active IDs। <strong>Inactive</strong> = window में वे जिनकी पहली qualifying purchase 2× पर पहुँच चुकी थी। पैकेज कार्ड = अभी का snapshot।</p>
          <p className="mb-3"><strong>मराठी:</strong> <strong>Global IDs Used</strong> = क्रेडिट वेळी active IDs. <strong>Inactive</strong> = window मधले जे 2× झाले (payout मध्ये मोजले नाहीत). पॅकेज कार्ड = सध्याचा snapshot.</p>
          <p className="text-[var(--text-muted)] border-t border-blue-500/20 pt-2 mt-2">
            <strong>Common question:</strong> Package card = abhi; is table = us din jab income credit hui. Purani entries par Inactive &quot;-&quot; ho sakta hai (metadata mein save nahi tha).
          </p>
        </div>

        {paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">
              No commission records found
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
            <div className="w-full overflow-x-auto mb-5">
              <Table className="min-w-[720px]">
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
                    <TH>
                      <span
                        className="inline-flex items-center gap-1 cursor-help"
                        title={`Global IDs Used (as of credit date)\n\nEnglish: This is the number of Global IDs used as on the date when this income was credited. The total on your package card is the current count.\n\nहिंदी: यह उस तारीख के अनुसार इस्तेमाल हुए Global IDs की संख्या है जब यह इनकम क्रेडिट हुई। पैकेज कार्ड पर दिखने वाला टोटल अभी का काउंट है।\n\nमराठी: ही संख्या त्या तारखेनुसार वापरलेल्या Global IDs ची आहे जेव्हा ही इनकम क्रेडिट झाली. पॅकेज कार्डवरचा टोटल सध्याचा काउंट आहे.\n\nCommon question: "Jo package par Used dikh raha hai wahi yahan bhi hona chahiye?" — Package card = current total; this column = count as of the date this income was credited. They can differ; both are correct.`}
                      >
                        Global IDs Used
                        <Info className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      </span>
                    </TH>
                    <TH>
                      <span
                        className="inline-flex items-center gap-1 cursor-help"
                        title="Inactive global contributors at credit time (raw − active). Same meaning as Today inactive on package card, but for that credit date."
                      >
                        Inactive
                        <Info className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      </span>
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
                        {(() => {
                          const usedIds = (row as any).used_ids ?? (row as any).metadata?.used_ids ?? null;
                          return usedIds !== null ? usedIds : '-';
                        })()}
                      </TD>
                      <TD className="whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">
                        {(() => {
                          const inactive = getInactiveGlobalContributors(row as any);
                          return inactive !== null ? inactive : '-';
                        })()}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)] text-sm">
                        {formatDate(row.credited_at) || ''}
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
                  className="px-2 py-1.5 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  {incomeData ? Math.min(currentPage * itemsPerPage, incomeData.total) : 0}
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
