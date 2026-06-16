import type {
  CompanyBankAccount,
  CompanyBankListResponse,
  CreateCompanyBankRequest,
  UpdateCompanyBankRequest,
} from "../api/companyBank";

export type {
  CompanyBankAccount,
  CompanyBankListResponse,
  CreateCompanyBankRequest,
  UpdateCompanyBankRequest,
};

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const DEMO_QR_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23fff'/%3E%3Crect x='10' y='10' width='30' height='30' fill='%23000'/%3E%3Crect x='80' y='10' width='30' height='30' fill='%23000'/%3E%3Crect x='10' y='80' width='30' height='30' fill='%23000'/%3E%3Crect x='45' y='45' width='30' height='30' fill='%23000'/%3E%3Ctext x='60' y='115' text-anchor='middle' font-size='10' fill='%23666'%3EDemo QR%3C/text%3E%3C/svg%3E";

let nextId = 3;

let mockAccounts: CompanyBankAccount[] = [
  {
    id: 1,
    bank_name: "Bank Of India",
    bank_ac_holder: "Secure Investment Academy",
    bank_ac_no: "964720110000600",
    bank_ifsc: "BKID0009647",
    bank_branch: "Wadsa",
    bank_upi: "secureinvestmentacademyinfo@okaxis",
    qr_image: DEMO_QR_SVG,
    is_active: true,
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-15T10:00:00.000Z",
  },
  {
    id: 2,
    bank_name: "HDFC Bank",
    bank_ac_holder: "Secure Investment Academy",
    bank_ac_no: "50200012345678",
    bank_ifsc: "HDFC0001234",
    bank_branch: "Nagpur Main",
    bank_upi: "sia.payments@hdfcbank",
    qr_image: null,
    is_active: false,
    created_at: "2025-09-10T09:00:00.000Z",
    updated_at: "2026-04-20T14:30:00.000Z",
  },
];

function filterAccounts(params?: { is_active?: boolean }): CompanyBankAccount[] {
  let items = [...mockAccounts];
  if (params?.is_active !== undefined) {
    items = items.filter((a) => a.is_active === params.is_active);
  }
  return items;
}

export async function getCompanyBankAccounts(params?: {
  is_active?: boolean;
}): Promise<CompanyBankListResponse> {
  await delay();
  const items = filterAccounts(params);
  return {
    count: items.length,
    items: structuredClone(items),
  };
}

export async function getCompanyBankAccountById(
  id: number,
): Promise<CompanyBankAccount> {
  await delay(150);
  const account = mockAccounts.find((a) => a.id === id);
  if (!account) throw new Error("Company bank account not found (demo)");
  return structuredClone(account);
}

export async function createCompanyBankAccount(
  data: CreateCompanyBankRequest,
): Promise<CompanyBankAccount> {
  await delay(400);
  const created: CompanyBankAccount = {
    id: nextId++,
    bank_name: data.bank_name.trim(),
    bank_ac_holder: data.bank_ac_holder.trim(),
    bank_ac_no: data.bank_ac_no.trim(),
    bank_ifsc: data.bank_ifsc.trim().toUpperCase(),
    bank_branch: data.bank_branch?.trim() || null,
    bank_upi: data.bank_upi?.trim() || null,
    qr_image: data.qr_image || null,
    is_active: data.is_active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockAccounts = [...mockAccounts, created];
  return structuredClone(created);
}

export async function updateCompanyBankAccount(
  id: number,
  data: UpdateCompanyBankRequest,
): Promise<CompanyBankAccount> {
  await delay(400);
  const index = mockAccounts.findIndex((a) => a.id === id);
  if (index < 0) throw new Error("Company bank account not found (demo)");

  mockAccounts[index] = {
    ...mockAccounts[index],
    ...data,
    bank_ifsc: data.bank_ifsc
      ? data.bank_ifsc.trim().toUpperCase()
      : mockAccounts[index].bank_ifsc,
    updated_at: new Date().toISOString(),
  };
  return structuredClone(mockAccounts[index]);
}

export async function deleteCompanyBankAccount(
  id: number,
): Promise<{ message: string; id: number }> {
  await delay(300);
  const index = mockAccounts.findIndex((a) => a.id === id);
  if (index < 0) throw new Error("Company bank account not found (demo)");
  mockAccounts = mockAccounts.filter((a) => a.id !== id);
  return { message: "Company bank account deleted (demo)", id };
}

export async function uploadCompanyBankQR(
  file: File,
): Promise<{ qr_image_url: string; uploaded_at: string }> {
  await delay(500);

  const qr_image_url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read QR image (demo)"));
    reader.readAsDataURL(file);
  });

  return {
    qr_image_url,
    uploaded_at: new Date().toISOString(),
  };
}
