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

const MOCK_USERS: Record<string, {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  profile_photo_url?: string | null;
  kyc_status?: string | null;
  status: string;
  created_at: string;
  relationship: string;
  depth: number;
}> = {
  SIA00089: {
    id: "1002",
    name: "Priya Patel",
    email: "priya@example.com",
    phone: "9876501234",
    kyc_status: "approved",
    status: "active",
    created_at: "2025-01-10T08:00:00.000Z",
    relationship: "direct",
    depth: 1,
  },
  SIA00124: {
    id: "1003",
    name: "Amit Kumar",
    email: "amit@example.com",
    phone: "9876512345",
    kyc_status: "approved",
    status: "active",
    created_at: "2025-02-15T08:00:00.000Z",
    relationship: "team",
    depth: 2,
  },
  SIA00156: {
    id: "1004",
    name: "Sneha Reddy",
    email: "sneha@example.com",
    phone: "9876523456",
    kyc_status: "approved",
    status: "active",
    created_at: "2025-03-20T08:00:00.000Z",
    relationship: "team",
    depth: 2,
  },
};

const MOCK_TRANSFER_HISTORY = [
  {
    id: "tr-001",
    type: "sent" as const,
    sender_id: "1001",
    sender_name: "Rahul Sharma",
    sender_display_id: "SIA00057",
    receiver_id: "1002",
    receiver_name: "Priya Patel",
    receiver_display_id: "SIA00089",
    amount: 2000,
    tax_amount: 20,
    net_amount: 1980,
    remarks: "Team support (demo)",
    created_at: "2026-05-28T10:30:00.000Z",
  },
  {
    id: "tr-002",
    type: "received" as const,
    sender_id: "1003",
    sender_name: "Amit Kumar",
    sender_display_id: "SIA00124",
    receiver_id: "1001",
    receiver_name: "Rahul Sharma",
    receiver_display_id: "SIA00057",
    amount: 1500,
    tax_amount: 15,
    net_amount: 1485,
    remarks: null,
    created_at: "2026-05-25T14:15:00.000Z",
  },
  {
    id: "tr-003",
    type: "sent" as const,
    sender_id: "1001",
    sender_name: "Rahul Sharma",
    sender_display_id: "SIA00057",
    receiver_id: "1004",
    receiver_name: "Sneha Reddy",
    receiver_display_id: "SIA00156",
    amount: 500,
    tax_amount: 5,
    net_amount: 495,
    remarks: "P2P transfer (demo)",
    created_at: "2026-05-20T09:00:00.000Z",
  },
  {
    id: "tr-004",
    type: "received" as const,
    sender_id: "1002",
    sender_name: "Priya Patel",
    sender_display_id: "SIA00089",
    receiver_id: "1001",
    receiver_name: "Rahul Sharma",
    receiver_display_id: "SIA00057",
    amount: 3000,
    tax_amount: 30,
    net_amount: 2970,
    remarks: "Commission share",
    created_at: "2026-05-15T16:45:00.000Z",
  },
];

export async function getUserDetails(receiverId: string) {
  await delay(250);
  const key = receiverId.trim().toUpperCase();
  const user = MOCK_USERS[key] || MOCK_USERS[receiverId.trim()];
  if (!user) {
    throw new Error("User not found. Try SIA00089, SIA00124, or SIA00156 (demo)");
  }
  return structuredClone(user);
}

export async function getTransferRules() {
  await delay(150);
  return {
    transfer_amt_tax: 1,
    min_transfer_amt: 100,
    max_transfer_amt: 50000,
  };
}

export async function sendP2PTransferOTP() {
  await delay(400);
  return {
    success: true,
    message: "OTP sent to r***@example.com (demo)",
    email_masked: "r***@example.com",
  };
}

export async function p2pTransfer(data: {
  receiver_id: string;
  amount: number;
  from_wallet: "other";
  remarks?: string;
  transaction_password: string;
  otp: string;
}) {
  await delay(500);
  if (!data.otp || data.otp.length < 4) {
    throw new Error("Invalid OTP (demo: use any 6-digit OTP)");
  }
  if (data.amount < 100) {
    throw new Error("Minimum transfer amount is ₹100 (demo)");
  }
  const tax = Math.round(data.amount * 0.01 * 100) / 100;
  return {
    id: `p2p-${Date.now()}`,
    sender_id: "1001",
    receiver_id: data.receiver_id,
    amount: data.amount,
    tax_amount: tax,
    net_amount: data.amount - tax,
    status: "completed",
    created_at: new Date().toISOString(),
  };
}

export async function walletTransfer(data: {
  to_user_id: string;
  amount: number;
  from_wallet: "spot" | "other";
  remarks?: string;
}) {
  await delay(500);
  if (data.amount < 100) {
    throw new Error("Minimum transfer amount is ₹100 (demo)");
  }
  const tax = Math.round(data.amount * 0.01 * 100) / 100;
  return {
    id: `wt-${Date.now()}`,
    from_user_id: "1001",
    to_user_id: data.to_user_id,
    amount: data.amount,
    tax_amount: tax,
    net_amount: data.amount - tax,
    status: "completed",
    created_at: new Date().toISOString(),
  };
}

export async function getTransferHistory(params?: {
  type?: "sent" | "received" | "all";
  page?: number;
  limit?: number;
}) {
  await delay();
  let items = [...MOCK_TRANSFER_HISTORY];
  const type = params?.type || "all";
  if (type !== "all") {
    items = items.filter((item) => item.type === type);
  }
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    count: items.slice(start, start + limit).length,
    page,
    total,
    items: structuredClone(items.slice(start, start + limit)),
  };
}
