import type { Bill, BillsResponse, InvoiceDetails, BondFeeResponse, BondDownloadResponse } from "@/lib/api/bills";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_BILLS: Bill[] = [
  {
    id: "bill-001",
    package_name: "Starter Package",
    description: "Package activation - Starter",
    amount: 15000,
    status: "paid",
    payment_type: "UPI",
    is_manual: true,
    txn_id: "UTR1234567890",
    purchased_at: "2025-08-15T10:00:00.000Z",
    is_renewal: false,
    purchase_type: "activation",
  },
  {
    id: "bill-002",
    package_name: "Starter Package",
    description: "Package renewal - Starter",
    amount: 15000,
    status: "paid",
    payment_type: "Bank Transfer",
    is_manual: true,
    txn_id: "UTR9876543210",
    purchased_at: "2024-06-10T10:00:00.000Z",
    is_renewal: true,
    purchase_type: "renew",
  },
  {
    id: "bill-003",
    package_name: "Growth Package",
    description: "Reinvestment - Growth",
    amount: 30000,
    status: "paid",
    payment_type: "UPI",
    is_manual: false,
    txn_id: "UTR5555555555",
    purchased_at: "2026-01-20T14:30:00.000Z",
    is_renewal: false,
    purchase_type: "reinvestment",
  },
];

const MOCK_INVOICES: Record<string, InvoiceDetails> = {
  "bill-001": {
    id: "bill-001",
    invoice_number: "INV-2025-0815-001",
    package: { id: 1, name: "Starter Package", price: 15000 },
    user: { id: "1001", name: "Rahul Sharma", email: "rahul.sharma@example.com" },
    amount: 15000,
    status: "paid",
    payment_type: "UPI",
    txn_id: "UTR1234567890",
    payment_proof_url: null,
    purchased_at: "2025-08-15T10:00:00.000Z",
    breakdown: { package_price: 15000, tax: 0, total: 15000 },
  },
  "bill-002": {
    id: "bill-002",
    invoice_number: "INV-2024-0610-002",
    package: { id: 1, name: "Starter Package", price: 15000 },
    user: { id: "1001", name: "Rahul Sharma", email: "rahul.sharma@example.com" },
    amount: 15000,
    status: "paid",
    payment_type: "Bank Transfer",
    txn_id: "UTR9876543210",
    payment_proof_url: null,
    purchased_at: "2024-06-10T10:00:00.000Z",
    breakdown: { package_price: 15000, tax: 0, total: 15000 },
  },
  "bill-003": {
    id: "bill-003",
    invoice_number: "INV-2026-0120-003",
    package: { id: 2, name: "Growth Package", price: 30000 },
    user: { id: "1001", name: "Rahul Sharma", email: "rahul.sharma@example.com" },
    amount: 30000,
    status: "paid",
    payment_type: "UPI",
    txn_id: "UTR5555555555",
    payment_proof_url: null,
    purchased_at: "2026-01-20T14:30:00.000Z",
    breakdown: { package_price: 30000, tax: 0, total: 30000 },
  },
};

const paidBondBills = new Set<string>();

export type { Bill as ApiBill, InvoiceDetails };

export async function getBills(params?: {
  page?: number;
  limit?: number;
}): Promise<BillsResponse> {
  await delay();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const total = MOCK_BILLS.length;
  const start = (page - 1) * limit;

  return {
    count: MOCK_BILLS.length,
    page,
    total,
    items: structuredClone(MOCK_BILLS.slice(start, start + limit)),
  };
}

export async function getInvoiceDetails(id: string): Promise<InvoiceDetails> {
  await delay(200);
  const invoice = MOCK_INVOICES[id];
  if (!invoice) throw new Error("Invoice not found (demo)");
  return structuredClone(invoice);
}

export async function getBondDownloadFee(): Promise<BondFeeResponse> {
  await delay(150);
  return {
    fee_amount: 150,
    rule_code: "BOND_DOWNLOAD",
    rule_name: "Bond Download Fee",
  };
}

export async function authorizeBondDownload(billId: string): Promise<BondDownloadResponse> {
  await delay(400);
  if (paidBondBills.has(billId)) {
    return {
      success: true,
      message: "Bond download already authorized (demo)",
      fee_deducted: 0,
      transaction_id: `bond-txn-${billId}`,
      already_paid: true,
    };
  }
  paidBondBills.add(billId);
  return {
    success: true,
    message: "Bond download authorized (demo)",
    fee_deducted: 150,
    transaction_id: `bond-txn-${billId}`,
  };
}
