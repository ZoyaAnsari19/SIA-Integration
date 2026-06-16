import type {
  FeeRule,
  FeeRulesListResponse,
  CreateFeeRuleRequest,
  UpdateFeeRuleRequest,
} from "../api/feeRules";

export type { FeeRule, FeeRulesListResponse, CreateFeeRuleRequest, UpdateFeeRuleRequest };

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let nextId = 9;

let mockFeeRules: FeeRule[] = [
  {
    id: 1,
    rule_code: "KYC_SUBMISSION",
    rule_name: "KYC Submission Fee",
    description: "Fee charged when user submits KYC documents",
    amount: 25,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-10T10:00:00.000Z",
  },
  {
    id: 2,
    rule_code: "BOND_DOWNLOAD",
    rule_name: "Bond Agreement Download Fee",
    description: "Fee charged when user downloads bond agreement",
    amount: 10,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-12T11:30:00.000Z",
  },
  {
    id: 3,
    rule_code: "WITHDRAWAL_PROCESSING",
    rule_name: "Withdrawal Processing Fee",
    description: "Fee charged on withdrawal requests",
    amount: 50,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-15T09:00:00.000Z",
  },
  {
    id: 4,
    rule_code: "SUPPORT_TICKET",
    rule_name: "Support Ticket Fee",
    description: "Fee for additional support tickets",
    amount: 30,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-07-01T08:00:00.000Z",
    updated_at: "2026-05-18T14:00:00.000Z",
  },
  {
    id: 5,
    rule_code: "GENERAL_PROBLEM",
    rule_name: "General Problem",
    description: "Support topic: General Problem",
    amount: 30,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-07-01T08:00:00.000Z",
    updated_at: "2026-05-20T16:00:00.000Z",
  },
  {
    id: 6,
    rule_code: "COMMISSION_ISSUE",
    rule_name: "Commission Issue",
    description: "Support topic: Commission Issue",
    amount: 30,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-07-01T08:00:00.000Z",
    updated_at: "2026-05-22T10:00:00.000Z",
  },
  {
    id: 7,
    rule_code: "OTP_SEND",
    rule_name: "OTP Send Fee",
    description: "Fee charged when OTP is sent",
    amount: 5,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-08-01T08:00:00.000Z",
    updated_at: "2026-05-25T12:00:00.000Z",
  },
  {
    id: 8,
    rule_code: "TRANSACTION_PIN_FORGOT",
    rule_name: "Transaction PIN Forgot Fee",
    description: "Fee charged when user resets transaction PIN",
    amount: 21,
    is_active: true,
    applies_to: "all_users",
    created_at: "2025-09-01T08:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
  },
];

function filterRules(params?: { is_active?: boolean }): FeeRule[] {
  let items = [...mockFeeRules];
  if (params?.is_active !== undefined) {
    items = items.filter((r) => r.is_active === params.is_active);
  }
  return items;
}

export async function getFeeRules(params?: {
  page?: number;
  limit?: number;
  is_active?: boolean;
}): Promise<FeeRulesListResponse> {
  await delay();
  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const filtered = filterRules(params);
  const total = filtered.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    count: Math.min(limit, Math.max(0, total - start)),
    page,
    limit,
    total_pages,
    total,
    items: structuredClone(filtered.slice(start, start + limit)),
  };
}

export async function getFeeRuleById(id: number): Promise<FeeRule> {
  await delay(150);
  const rule = mockFeeRules.find((r) => r.id === id);
  if (!rule) throw new Error("Fee rule not found (demo)");
  return structuredClone(rule);
}

export async function createFeeRule(data: CreateFeeRuleRequest): Promise<FeeRule> {
  await delay(400);
  const code = data.rule_code.trim().toUpperCase();
  if (mockFeeRules.some((r) => r.rule_code.toUpperCase() === code)) {
    throw new Error(`Fee rule with code "${data.rule_code}" already exists`);
  }

  const created: FeeRule = {
    id: nextId++,
    rule_code: data.rule_code.trim(),
    rule_name: data.rule_name.trim(),
    description: data.description?.trim() || null,
    amount: data.amount,
    is_active: data.is_active ?? true,
    applies_to: data.applies_to ?? "all_users",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockFeeRules = [...mockFeeRules, created];
  return structuredClone(created);
}

export async function updateFeeRule(
  id: number,
  data: UpdateFeeRuleRequest,
): Promise<FeeRule> {
  await delay(400);
  const index = mockFeeRules.findIndex((r) => r.id === id);
  if (index < 0) throw new Error("Fee rule not found (demo)");

  mockFeeRules[index] = {
    ...mockFeeRules[index],
    ...data,
    updated_at: new Date().toISOString(),
  };
  return structuredClone(mockFeeRules[index]);
}

export async function deleteFeeRule(
  id: number,
): Promise<{ message: string; id: number }> {
  await delay(300);
  const index = mockFeeRules.findIndex((r) => r.id === id);
  if (index < 0) throw new Error("Fee rule not found (demo)");
  mockFeeRules = mockFeeRules.filter((r) => r.id !== id);
  return { message: "Fee rule deleted (demo)", id };
}
