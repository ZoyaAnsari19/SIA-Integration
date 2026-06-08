import type { Package, PackagePurchase, CompanyBankAccount } from "@/lib/api/types";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export const MOCK_PACKAGES: Package[] = [
  {
    id: 1,
    name: "Starter Package",
    price: 15000,
    min_amount: 15000,
    max_amount: 15000,
    self_monthly: 1500,
    self_roi_percent: 10,
    global_ids: 5,
    global_monthly_per_id: 100,
    recurring_rate_percent: 5,
    validity_months: 12,
    status: "active",
    course_id: 1,
  },
  {
    id: 2,
    name: "Growth Package",
    price: 30000,
    min_amount: 30000,
    max_amount: 30000,
    self_monthly: 3000,
    self_roi_percent: 10,
    global_ids: 10,
    global_monthly_per_id: 150,
    recurring_rate_percent: 7,
    validity_months: 12,
    status: "active",
    course_id: 2,
  },
  {
    id: 3,
    name: "Premium Package",
    price: 50000,
    min_amount: 50000,
    max_amount: 50000,
    self_monthly: 5000,
    self_roi_percent: 10,
    global_ids: 20,
    global_monthly_per_id: 200,
    recurring_rate_percent: 10,
    validity_months: 12,
    status: "active",
    course_id: 3,
  },
];

const MOCK_MY_PACKAGES: PackagePurchase[] = [
  {
    id: "pkg-purchase-1",
    package_id: 1,
    package_name: "Starter Package",
    amount: 15000,
    income: 8500,
    purchased_at: "2025-08-15T10:00:00.000Z",
    status: "active",
    is_active: true,
    is_renewal: false,
    global_ids_info: {
      package_cap: 5,
      used_ids: 3,
      remaining_ids: 2,
      is_cap_reached: false,
      new_ids_after_cap: null,
      cap_exceed_loss: null,
      total_global_users: 120,
      contributors_raw_in_window: 8,
      contributors_active_in_window: 6,
      inactive_global_contributors: 2,
    },
    renewal_countdown: {
      last_income_date: "2026-05-01T00:00:00.000Z",
      renewal_deadline: "2026-07-05T00:00:00.000Z",
      countdown: {
        days: 27,
        hours: 8,
        minutes: 30,
        seconds: 0,
        total_seconds: 2358600,
      },
      can_renew: true,
    },
  },
  {
    id: "pkg-purchase-2",
    package_id: 1,
    package_name: "Starter Package",
    amount: 15000,
    income: 30000,
    purchased_at: "2024-06-10T10:00:00.000Z",
    status: "completed",
    is_active: false,
    is_renewal: false,
    global_ids_info: {
      package_cap: 5,
      used_ids: 5,
      remaining_ids: 0,
      is_cap_reached: true,
      new_ids_after_cap: null,
      cap_exceed_loss: 500,
      total_global_users: 95,
    },
    renewal_countdown: {
      last_income_date: "2025-03-01T00:00:00.000Z",
      renewal_deadline: "2025-05-05T00:00:00.000Z",
      countdown: {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        total_seconds: 0,
      },
      can_renew: true,
    },
  },
];

export const MOCK_BANK: CompanyBankAccount = {
  id: 1,
  bank_name: "Bank Of India",
  bank_ac_holder: "Secure Investment Academy",
  bank_ac_no: "964720110000600",
  bank_ifsc: "BKID0009647",
  bank_branch: "Wadsa",
  bank_upi: "secureinvestmentacademyinfo@okaxis",
  qr_image: null,
};

export async function getPackages(): Promise<Package[]> {
  await delay();
  return structuredClone(MOCK_PACKAGES);
}

export async function getMyPackages(_params?: Record<string, unknown>): Promise<{ count: number; items: PackagePurchase[] }> {
  await delay();
  return {
    count: MOCK_MY_PACKAGES.length,
    items: structuredClone(MOCK_MY_PACKAGES),
  };
}

export async function getMyPackageById(id: string): Promise<PackagePurchase> {
  await delay(200);
  const pkg = MOCK_MY_PACKAGES.find((p) => p.id === id);
  if (!pkg) throw new Error("Package not found");
  return structuredClone(pkg);
}

export async function getActiveCompanyBankAccount(): Promise<CompanyBankAccount> {
  await delay(200);
  return structuredClone(MOCK_BANK);
}

export async function uploadPaymentProof(file: File) {
  await delay(500);
  return { url: URL.createObjectURL(file) };
}

export async function checkUtrExists(utr: string) {
  await delay(300);
  return {
    exists: utr === "DUPLICATE123",
    message: utr === "DUPLICATE123" ? "This UTR number already exists." : "",
  };
}

export async function submitManualDeposit(_data: Record<string, unknown>) {
  await delay(600);
  return { success: true, message: "Payment request submitted successfully (demo)" };
}

export async function checkReinvestmentAmount(amount: number) {
  await delay(300);
  if (amount < 15000) {
    throw new Error("Reinvestment amount must be at least ₹15,000 (demo)");
  }
  return {
    ok: true,
    min_amount: 15000,
    last_withdrawal_amount: 20000,
  };
}
