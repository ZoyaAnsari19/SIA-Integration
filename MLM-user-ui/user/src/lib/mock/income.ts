import type { IncomeHistoryResponse } from "@/lib/api/ledger";
import type { LedgerEntry } from "@/lib/api/types";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

type IncomeType = "self" | "spot" | "direct" | "team" | "global_help";

const COMMISSION_MAP: Record<IncomeType, LedgerEntry["commission_type"]> = {
  self: "SELF",
  spot: "SPOT",
  direct: "MONTHLY",
  team: "MONTHLY",
  global_help: "GLOBAL_HELPING",
};

function buildMockItems(type: IncomeType): LedgerEntry[] {
  const commission_type = COMMISSION_MAP[type];
  const baseAmounts = [2500, 1800, 3200, 1500, 2100, 2800, 1900, 3500, 2200, 1600, 2900, 2400];

  return baseAmounts.map((amount, index) => {
    const day = 28 - index;
    const credited_at = `2026-05-${String(Math.max(day, 1)).padStart(2, "0")}T10:30:00.000Z`;

    const entry: LedgerEntry = {
      id: `${type}-${index + 1}`,
      commission_type,
      amount,
      source_user_id: `user-${100 + index}`,
      source_user_name: ["Amit Kumar", "Priya Patel", "Vikram Singh", "Sneha Reddy"][index % 4],
      source_user_display_id: `SIA00${120 + index}`,
      purchase_id: `purchase-${index + 1}`,
      investment: 15000,
      package_name: index % 2 === 0 ? "Starter Package" : "Growth Package",
      package_price: index % 2 === 0 ? 15000 : 30000,
      level: type === "team" ? (index % 3) + 1 : type === "direct" ? 0 : index % 3,
      credited_at,
      settled: true,
      is_locked: type === "spot" && index < 2,
      hold_until: type === "spot" && index < 2 ? "2026-06-15" : null,
      used_ids: type === "global_help" ? 3 + (index % 4) : null,
      inactive_global_contributors: type === "global_help" ? index % 3 : null,
      metadata:
        type === "global_help"
          ? {
              global_contributors_raw: 8,
              global_contributors_active: 6,
              inactive_global_contributors: 2,
            }
          : type === "spot"
            ? { wallet_type: "spot_balance" as const }
            : { wallet_type: "other_balance" as const },
    };

    return entry;
  });
}

const MOCK_DATA: Record<IncomeType, LedgerEntry[]> = {
  self: buildMockItems("self"),
  spot: buildMockItems("spot"),
  direct: buildMockItems("direct"),
  team: buildMockItems("team"),
  global_help: buildMockItems("global_help"),
};

export type { IncomeHistoryResponse };

export async function getMockIncome(
  type: IncomeType,
  params: { page?: number; limit?: number } = {},
): Promise<IncomeHistoryResponse> {
  await delay();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const allItems = MOCK_DATA[type];
  const total = allItems.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const items = allItems.slice(start, start + limit);
  const total_amount = allItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    count: items.length,
    page,
    limit,
    total_pages,
    total,
    total_amount,
    total_withdrawals: type === "spot" ? 5000 : 0,
    net_amount: type === "spot" ? total_amount - 5000 : total_amount,
    total_global_ids_used:
      type === "global_help"
        ? allItems.reduce((sum, item) => sum + (item.used_ids || 0), 0)
        : undefined,
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages,
    },
  };
}

export const getSelfIncome = (params?: { page?: number; limit?: number }) =>
  getMockIncome("self", params);

export const getSpotIncome = (params?: { page?: number; limit?: number }) =>
  getMockIncome("spot", params);

export const getDirectIncome = (params?: { page?: number; limit?: number }) =>
  getMockIncome("direct", params);

export const getTeamIncome = (params?: { page?: number; limit?: number }) =>
  getMockIncome("team", params);

export const getGlobalHelpIncome = (params?: { page?: number; limit?: number }) =>
  getMockIncome("global_help", params);

const MOCK_PAYMENT_HISTORY = [
  {
    id: "pay-001",
    transaction_id: "TXN20260528001",
    utr: "UTR1234567890",
    amount: 15000,
    payment_method: "UPI",
    account_details: "secureinvestmentacademyinfo@okaxis",
    status: "successful" as const,
    payment_date: "2025-08-15T10:00:00.000Z",
    request_id: "req-001",
    remarks: "Starter Package activation",
  },
  {
    id: "pay-002",
    transaction_id: "TXN20240610002",
    utr: "UTR9876543210",
    amount: 15000,
    payment_method: "Bank Transfer",
    account_details: "Bank Of India - 964720110000600",
    status: "successful" as const,
    payment_date: "2024-06-10T10:00:00.000Z",
    request_id: "req-002",
    remarks: "Package renewal",
  },
  {
    id: "pay-003",
    transaction_id: "TXN20260120003",
    utr: "UTR5555555555",
    amount: 30000,
    payment_method: "UPI",
    account_details: "secureinvestmentacademyinfo@okaxis",
    status: "pending" as const,
    payment_date: "2026-01-20T14:30:00.000Z",
    request_id: "req-003",
    remarks: "Growth Package reinvestment",
  },
  {
    id: "pay-004",
    transaction_id: "TXN20250315004",
    utr: "UTR1112223334",
    amount: 15000,
    payment_method: "UPI",
    account_details: "secureinvestmentacademyinfo@okaxis",
    status: "failed" as const,
    payment_date: "2025-03-15T09:00:00.000Z",
    request_id: null,
    remarks: "Payment verification failed (demo)",
  },
];

export async function getPaymentHistory(params: {
  page?: number;
  limit?: number;
  sort?: "created_at" | "amount";
  order?: "asc" | "desc";
} = {}) {
  await delay();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const sort = params.sort || "created_at";
  const order = params.order || "desc";

  let items = [...MOCK_PAYMENT_HISTORY];
  items.sort((a, b) => {
    if (sort === "amount") {
      return order === "asc" ? a.amount - b.amount : b.amount - a.amount;
    }
    const aTime = new Date(a.payment_date).getTime();
    const bTime = new Date(b.payment_date).getTime();
    return order === "asc" ? aTime - bTime : bTime - aTime;
  });

  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    count: items.slice(start, start + limit).length,
    page,
    limit,
    total_pages,
    total,
    items: structuredClone(items.slice(start, start + limit)),
  };
}
