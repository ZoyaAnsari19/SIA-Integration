import type { WalletHistoryResponse } from "@/lib/api/wallet";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_WALLET_HISTORY: WalletHistoryResponse["items"] = [
  {
    id: "wt-1",
    amount: -100,
    ledger_entry_id: null,
    commission_type: "FEE_DEDUCTION",
    is_admin_ops: true,
    reason: "Profile update fee",
    created_at: "2026-05-28T09:15:00.000Z",
  },
  {
    id: "wt-2",
    amount: -50,
    ledger_entry_id: null,
    commission_type: "FEE_DEDUCTION",
    is_admin_ops: true,
    reason: "Name change fee",
    created_at: "2026-05-20T14:30:00.000Z",
  },
  {
    id: "wt-3",
    amount: 500,
    ledger_entry_id: "ledger-101",
    commission_type: "ADMIN_OPS",
    is_admin_ops: true,
    reason: "Admin credit adjustment",
    created_at: "2026-05-15T11:00:00.000Z",
  },
  {
    id: "wt-4",
    amount: -250,
    ledger_entry_id: null,
    commission_type: "FEE_DEDUCTION",
    is_admin_ops: true,
    reason: "KYC processing fee",
    created_at: "2026-05-10T16:45:00.000Z",
  },
  {
    id: "wt-5",
    amount: -75,
    ledger_entry_id: null,
    commission_type: "FEE_DEDUCTION",
    is_admin_ops: true,
    reason: "Withdrawal admin charges",
    created_at: "2026-05-05T08:20:00.000Z",
  },
  {
    id: "wt-6",
    amount: 1000,
    ledger_entry_id: "ledger-88",
    commission_type: "ADMIN_OPS",
    is_admin_ops: true,
    reason: "Bonus credit",
    created_at: "2026-04-28T13:10:00.000Z",
  },
  {
    id: "wt-7",
    amount: -150,
    ledger_entry_id: null,
    commission_type: "FEE_DEDUCTION",
    is_admin_ops: true,
    reason: "Bond download fee",
    created_at: "2026-04-22T10:05:00.000Z",
  },
  {
    id: "wt-8",
    amount: -200,
    ledger_entry_id: null,
    commission_type: "FEE_DEDUCTION",
    is_admin_ops: true,
    reason: "Invoice download fee",
    created_at: "2026-04-15T17:30:00.000Z",
  },
];

export type { WalletHistoryResponse };

export async function getWalletBalance(_userId?: string) {
  await delay(200);
  return {
    user_id: "1001",
    balance: 28500,
    spot_balance: 12000,
    other_balance: 8500,
    team_royalty_balance: 8000,
    spot_team_withdraw_limit: 150000,
    spot_team_withdraw_used: 45000,
    spot_team_withdraw_remaining: 105000,
    spot_team_withdraw_multiplier: 10,
    spot_locked_hold: 1500,
    available_spot_balance: 10500,
    main_locked_hold: 500,
    available_main_balance: 8000,
  };
}

export async function getWalletHistory(
  _userId: string,
  params?: {
    page?: number;
    limit?: number;
    sort?: "created_at" | "amount";
    order?: "asc" | "desc";
    admin_ops_only?: boolean;
  },
): Promise<WalletHistoryResponse> {
  await delay();

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const sort = params?.sort || "created_at";
  const order = params?.order || "desc";

  let items = [...MOCK_WALLET_HISTORY];

  if (params?.admin_ops_only) {
    items = items.filter(
      (item) =>
        item.is_admin_ops ||
        item.commission_type === "ADMIN_OPS" ||
        item.commission_type === "FEE_DEDUCTION",
    );
  }

  items.sort((a, b) => {
    if (sort === "amount") {
      return order === "asc" ? a.amount - b.amount : b.amount - a.amount;
    }
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return order === "asc" ? aTime - bTime : bTime - aTime;
  });

  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pagedItems = items.slice(start, start + limit);

  return {
    count: pagedItems.length,
    page,
    limit,
    total_pages,
    total,
    items: structuredClone(pagedItems),
  };
}
