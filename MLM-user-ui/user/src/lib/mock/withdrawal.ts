import type { WithdrawalRequest, WithdrawalRequestResponse, WithdrawRules } from "@/lib/api/types";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

type WithdrawalItem = {
  id: string;
  user_id: string;
  withdraw_type: string;
  amount: number;
  payment_method: string;
  account_details: string;
  status: string;
  remarks?: string | null;
  processed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  withdrawal_fee?: number;
};

let mockWithdrawalRequests: WithdrawalItem[] = [
  {
    id: "wd-001",
    user_id: "1001",
    withdraw_type: "spot",
    amount: 5000,
    payment_method: "upi",
    account_details: JSON.stringify({ upi_id: "rahul@upi", payment_method: "upi" }),
    status: "approved",
    processed_at: "2026-05-20T11:30:00.000Z",
    created_at: "2026-05-20T10:00:00.000Z",
    withdrawal_fee: 50,
  },
  {
    id: "wd-002",
    user_id: "1001",
    withdraw_type: "wallet",
    amount: 8000,
    payment_method: "bank",
    account_details: JSON.stringify({
      account_number: "123456789012",
      ifsc: "SBIN0001234",
      payment_method: "bank",
    }),
    status: "pending",
    created_at: "2026-05-25T09:15:00.000Z",
  },
  {
    id: "wd-003",
    user_id: "1001",
    withdraw_type: "spot",
    amount: 3000,
    payment_method: "upi",
    account_details: JSON.stringify({ upi_id: "rahul@paytm", payment_method: "upi" }),
    status: "processing",
    created_at: "2026-05-26T14:20:00.000Z",
    withdrawal_fee: 30,
  },
  {
    id: "wd-004",
    user_id: "1001",
    withdraw_type: "team_royalty",
    amount: 2500,
    payment_method: "bank",
    account_details: JSON.stringify({
      account_number: "123456789012",
      ifsc: "SBIN0001234",
      payment_method: "bank",
    }),
    status: "rejected",
    rejection_reason: "Insufficient team royalty balance (demo)",
    created_at: "2026-05-18T16:45:00.000Z",
  },
  {
    id: "wd-005",
    user_id: "1001",
    withdraw_type: "spot",
    amount: 4500,
    payment_method: "upi",
    account_details: JSON.stringify({ upi_id: "rahul@phonepe", payment_method: "upi" }),
    status: "approved",
    processed_at: "2026-05-10T12:00:00.000Z",
    created_at: "2026-05-10T10:30:00.000Z",
    withdrawal_fee: 45,
  },
];

const MOCK_RULES: WithdrawRules = {
  min_withdraw: 500,
  max_withdraw: 50000,
  spot_min_withdraw: 500,
  admin_charges: 10,
  withdrawal_enabled: true,
};

export async function getWithdrawalRequests(params?: {
  page?: number;
  limit?: number;
  status?: "pending" | "approved" | "rejected" | "processing" | "cancelled";
  withdraw_type?: "wallet" | "spot" | "team_royalty";
}) {
  await delay();

  let items = [...mockWithdrawalRequests];

  if (params?.status) {
    items = items.filter((item) => item.status === params.status);
  }
  if (params?.withdraw_type) {
    items = items.filter((item) => item.withdraw_type === params.withdraw_type);
  }

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    count: Math.min(limit, total - start),
    page,
    limit,
    total_pages,
    total,
    items: structuredClone(items.slice(start, start + limit)),
  };
}

export async function createWithdrawalRequest(
  data: WithdrawalRequest,
): Promise<WithdrawalRequestResponse> {
  await delay(500);

  const newItem: WithdrawalItem = {
    id: `wd-${Date.now()}`,
    user_id: "1001",
    withdraw_type: data.withdraw_type || "spot",
    amount: data.amount,
    payment_method: data.payment_method,
    account_details: data.account_details,
    status: "pending",
    remarks: data.remarks || null,
    created_at: new Date().toISOString(),
  };

  mockWithdrawalRequests = [newItem, ...mockWithdrawalRequests];

  return {
    id: newItem.id,
    user_id: newItem.user_id,
    withdraw_type: newItem.withdraw_type,
    amount: newItem.amount,
    payment_method: newItem.payment_method,
    account_details: newItem.account_details,
    status: "pending",
    available_balances: { spot: 12000, other: 8500, total: 20500 },
    allowed_wallets: ["spot", "other"],
    created_at: newItem.created_at,
  };
}

export async function getWithdrawRules(): Promise<WithdrawRules> {
  await delay(150);
  return structuredClone(MOCK_RULES);
}

/** Demo mode: always allow withdrawal time */
export function isWithdrawalTimeAllowed(): { allowed: boolean; message?: string } {
  return { allowed: true };
}

/** Demo mode: all wallet types allowed on any date */
export function isWithdrawalDateAllowed(): {
  allowed: boolean;
  allowedWallets: Array<"spot" | "other" | "team_royalty">;
  message?: string;
} {
  return {
    allowed: true,
    allowedWallets: ["spot", "other", "team_royalty"],
  };
}
