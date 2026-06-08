"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Wallet,
  ArrowUp,
  ArrowDown,
  Download,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableTableHeader } from "@/components/ui/SortableTableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { EnhancedStatCard } from "@/components/ui/EnhancedStatCard";
import { getTransferHistory } from "@/lib/api/wallet";
import { getUserFriendlyError } from "@/lib/api/errors";

type TransferRecord = {
  id: string;
  giverId: string;
  giverName: string;
  requestAmount: number;
  charges: number;
  receiveAmount: number;
  receiverId: string;
  receiverName: string;
  wallet: string;
  date: string;
  type: 'sent' | 'received';
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

export default function FundTransferDataPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [typeFilter, setTypeFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // API data states
  const [transferData, setTransferData] = useState<TransferRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Fetch transfer history from API
  const fetchTransferHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getTransferHistory({
        type: typeFilter === 'all' ? undefined : typeFilter,
        page: currentPage,
        limit: itemsPerPage,
      });

      // Map API response to UI format
      const mappedData: TransferRecord[] = response.items.map((item, index) => ({
        id: item.id,
        giverId: item.type === 'sent' ? item.sender_id : item.receiver_id,
        giverName: item.type === 'sent' ? (item.sender_name || 'N/A') : (item.receiver_name || 'N/A'),
        requestAmount: item.amount,
        charges: item.tax_amount,
        receiveAmount: item.net_amount,
        receiverId: item.type === 'sent' ? item.receiver_id : item.sender_id,
        receiverName: item.type === 'sent' ? (item.receiver_name || 'N/A') : (item.sender_name || 'N/A'),
        wallet: 'other_balance -> other_balance', // Receiver always gets in other_balance
        date: item.created_at,
        type: item.type,
      }));

      setTransferData(mappedData);
      setTotalItems(response.total);
    } catch (err: any) {
      const errorMessage = getUserFriendlyError(err);
      setError(errorMessage);
      console.error('Failed to fetch transfer history:', err);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchTransferHistory();
  }, [currentPage, itemsPerPage, typeFilter]);


  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Client-side search filter (since API doesn't support search)
  const filteredData = useMemo(() => {
    let filtered = transferData;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toUpperCase();
      filtered = filtered.filter((record) => {
        const giverInfo = `${record.giverId} - ${record.giverName}`.toUpperCase();
        const receiverInfo = `${record.receiverId} - ${record.receiverName}`.toUpperCase();
        return (
          giverInfo.includes(query) ||
          receiverInfo.includes(query)
        );
      });
    }

    return filtered;
  }, [searchQuery, transferData]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "giverId":
          aValue = a.giverId;
          bValue = b.giverId;
          break;
        case "requestAmount":
          aValue = a.requestAmount;
          bValue = b.requestAmount;
          break;
        case "charges":
          aValue = a.charges;
          bValue = b.charges;
          break;
        case "receiveAmount":
          aValue = a.receiveAmount;
          bValue = b.receiveAmount;
          break;
        case "receiverId":
          aValue = a.receiverId;
          bValue = b.receiverId;
          break;
        case "wallet":
          aValue = a.wallet;
          bValue = b.wallet;
          break;
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Use API paginated data directly (no need for client-side pagination)
  const paginatedData = sortedData;

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    return {
      totalTransfers: filteredData.length,
      totalSent: filteredData.reduce((sum, r) => sum + r.requestAmount, 0),
      totalCharges: filteredData.reduce((sum, r) => sum + r.charges, 0),
      totalReceived: filteredData.reduce((sum, r) => sum + r.receiveAmount, 0),
    };
  }, [filteredData]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page when sorting
  };

  const handleExport = () => {
    const headers = [
      "Sl No",
      "Giver ID",
      "Request Amount",
      "Charges",
      "Receive Amount",
      "Receiver ID",
      "Wallet",
      "Date",
    ];

    const csvContent = [
      headers.join(","),
      ...filteredData.map((record) =>
        [
          record.id,
          `"${record.giverId} - ${record.giverName}"`,
          record.requestAmount.toFixed(2),
          record.charges.toFixed(2),
          record.receiveAmount.toFixed(2),
          `"${record.receiverId} - ${record.receiverName}"`,
          `"${record.wallet}"`,
          `"${record.date}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fund-transfer-history-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefresh = () => {
    fetchTransferHistory();
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EnhancedStatCard
          label="Total Transfers"
          value={summaryStats.totalTransfers.toString()}
          icon={FileText}
          accent="blue"
        />
        <EnhancedStatCard
          label="Total Sent"
          value={formatCurrency(summaryStats.totalSent)}
          icon={ArrowUp}
          accent="green"
        />
        <EnhancedStatCard
          label="Total Charges"
          value={formatCurrency(summaryStats.totalCharges)}
          icon={AlertCircle}
          accent="amber"
        />
        <EnhancedStatCard
          label="Total Received"
          value={formatCurrency(summaryStats.totalReceived)}
          icon={ArrowDown}
          accent="blue"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Fund transfer history</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  aria-label="Refresh data"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  aria-label="Export to CSV"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-auto sm:min-w-[250px]">
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search ID or Wallet..."
                  containerClassName="w-full"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as 'all' | 'sent' | 'received');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card-bg)] text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-all"
                aria-label="Filter by transfer type"
              >
                <option value="all">All Transfers</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isInitialLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
            </div>
          ) : error ? (
            <div className="p-12">
              <EmptyState
                icon={AlertCircle}
                title="Error loading data"
                description={error}
                actionLabel="Retry"
                onAction={handleRefresh}
              />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={FileText}
                title="No records found"
                description="No records found matching your search."
                actionLabel="Clear Search"
                onAction={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                }}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <THead>
                    <tr>
                      <SortableTableHeader
                        columnKey="id"
                        label="Sl No"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        columnKey="giverId"
                        label="Giver ID"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        columnKey="requestAmount"
                        label="Request Amount"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        columnKey="charges"
                        label="Charges"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        columnKey="receiveAmount"
                        label="Receive Amount"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        columnKey="receiverId"
                        label="Receiver ID"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        columnKey="wallet"
                        label="Wallet"
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
                    {paginatedData.map((record) => {
                      const formattedDate = formatDate(record.date);
                      return (
                        <TR key={record.id}>
                          <TD className="text-[var(--text-body)]">
                            {record.id}
                          </TD>
                          <TD className="text-[var(--text-body)]">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {record.giverId}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {record.giverName}
                              </span>
                              {record.type === 'sent' && (
                                <span className="text-xs text-blue-600 font-medium mt-1">
                                  (You sent)
                                </span>
                              )}
                            </div>
                          </TD>
                          <TD className="font-semibold text-[var(--text-strong)]">
                            ₹{record.requestAmount.toFixed(2)}
                          </TD>
                          <TD>
                            {record.charges > 0 ? (
                              <span className="text-[var(--accent-red-text)] font-semibold">
                                ₹{record.charges.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </TD>
                          <TD className="font-semibold text-[var(--text-strong)]">
                            ₹{record.receiveAmount.toFixed(2)}
                          </TD>
                          <TD className="text-[var(--text-body)]">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {record.receiverId}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {record.receiverName}
                              </span>
                              {record.type === 'received' && (
                                <span className="text-xs text-green-600 font-medium mt-1">
                                  (You received)
                                </span>
                              )}
                            </div>
                          </TD>
                          <TD>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium font-mono bg-[var(--accent-blue-bg)] text-[var(--accent-blue-text)]"
                            >
                              <Wallet className="h-3 w-3" />
                              {/* Note: Backend API uses "other" wallet type, but UI displays as "Main" */}
                              {record.type === 'sent' ? 'Main → Main' : 'Main ← Main'}
                            </span>
                          </TD>
                          <TD className="text-[var(--text-body)]">
                            <div className="flex flex-col">
                              <span className="whitespace-nowrap">
                                {formattedDate.date}
                              </span>
                              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                                {formattedDate.time}
                              </span>
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              {totalPages > 0 && (
                <div className="px-5 pb-5">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(newItemsPerPage) => {
                      setItemsPerPage(newItemsPerPage);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
