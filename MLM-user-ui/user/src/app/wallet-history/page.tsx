"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/redux/hooks";
import { getWalletHistory } from "@/lib/mock/wallet";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Loader2, ArrowUpDown } from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletHistoryPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortKey, setSortKey] = useState<"created_at" | "amount">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<{
    count: number;
    page: number;
    limit: number;
    total_pages: number;
    total: number;
    items: {
      id: string;
      amount: number;
      ledger_entry_id: string | null;
      commission_type: string | null;
      is_admin_ops: boolean;
      reason: string | null;
      created_at: string;
    }[];
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getWalletHistory(
          user?.id || "demo-user",
          {
            page,
            limit,
            sort: sortKey,
            order: sortOrder,
            // Sirf admin operations lane ke liye backend ko flag de rahe hain
            admin_ops_only: true,
          },
        );
        setData(res);
      } catch (err: any) {
        console.error("Wallet history fetch error:", err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load wallet history. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id, page, limit, sortKey, sortOrder]);

  // Admin Operations aur Fee Deductions dikhayenge:
  // Backend already admin_ops_only=true se filter kar raha hai (ADMIN_OPS + FEE_DEDUCTION),
  // yahan bas direct items use kar sakte hain (defensive check ke saath).
  const rows = useMemo(() => {
    const items = data?.items || [];
    if (!items.length) return [];
    // Safety: agar kabhi non-admin/fee entries aa bhi jayein, to filter kar denge.
    return items.filter(
      (item) =>
        item.is_admin_ops ||
        (item.commission_type &&
          (item.commission_type.toUpperCase() === "ADMIN_OPS" ||
           item.commission_type.toUpperCase() === "FEE_DEDUCTION")),
    );
  }, [data]);

  const toggleSort = (key: "created_at" | "amount") => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  if (isLoading && !data) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
        <H1>Wallet History</H1>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-[var(--text-muted)] text-sm">
              Loading wallet history...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
        <H1>Wallet History</H1>
        <Card className="p-4 text-sm text-red-600 bg-red-50 border-red-200">
          {error}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 bg-[var(--content-bg)] min-h-screen transition-colors duration-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <H1>Wallet History</H1>
      </div>

      <Card className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <p className="text-xs md:text-[13px] text-[var(--text-muted)] font-semibold">
              Yahan aapko wallet se related saare credit / debit dikhenge, including
              admin operations (manual cut / add) aur fee deductions (name change, transaction pin, etc.).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--sidebar-hover)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">
                  Reason
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] cursor-pointer select-none"
                  onClick={() => toggleSort("amount")}
                >
                  <span className="inline-flex items-center gap-1">
                    Amount
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] cursor-pointer select-none"
                  onClick={() => toggleSort("created_at")}
                >
                  <span className="inline-flex items-center gap-1">
                    Date &amp; Time
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-[var(--text-muted)]"
                  >
                    No wallet history found.
                  </td>
                </tr>
              ) : (
                rows.map((tx, index) => {
                  const isCredit = tx.amount > 0;
                  // Determine type label based on commission_type
                  const typeLabel = tx.commission_type === 'FEE_DEDUCTION' 
                    ? 'Fee Deduction' 
                    : 'Admin Operations';

                  return (
                    <tr
                      key={tx.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--sidebar-hover)] transition-colors"
                    >
                      <td className="px-4 py-2 text-xs text-[var(--text-body)] whitespace-nowrap">
                        {(page - 1) * limit + index + 1}
                      </td>
                      <td className="px-4 py-2 text-xs text-[var(--text-body)] whitespace-nowrap">
                        {typeLabel}
                      </td>
                      <td className="px-4 py-2 text-xs text-[var(--text-body)] whitespace-pre-line max-w-xl">
                        {tx.reason || "-"}
                      </td>
                      <td
                        className={`px-4 py-2 text-xs font-semibold whitespace-nowrap ${
                          isCredit ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {isCredit ? "+" : "-"}₹{formatCurrency(Math.abs(tx.amount))}
                      </td>
                      <td className="px-4 py-2 text-xs text-[var(--text-body)] whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-[var(--text-muted)]">
            <span>
              Page {data.page} of {data.total_pages} (Total {data.total} records)
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded border border-[var(--border)] disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="px-3 py-1 rounded border border-[var(--border)] disabled:opacity-50"
                disabled={page >= (data.total_pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}


