/**
 * Bills API Service
 */

import { apiClient } from './client';

export interface Bill {
  id: string;
  package_name: string;
  description: string;
  amount: number;
  status: string; // Always "paid" for bills
  payment_type: string;
  is_manual: boolean;
  txn_id: string | null;
  purchased_at: string;
  // active_until removed - expiry is ONLY based on 2x income
  is_renewal: boolean;
  purchase_type: string;
}

export interface BillsResponse {
  count: number;
  page: number;
  total: number;
  items: Bill[];
}

export interface InvoiceDetails {
  id: string;
  invoice_number: string;
  package: {
    id: number;
    name: string;
    price: number;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  amount: number;
  status: string;
  payment_type: string;
  txn_id: string | null;
  payment_proof_url: string | null;
  purchased_at: string;
  // active_until removed - expiry is ONLY based on 2x income
  breakdown: {
    package_price: number;
    tax: number;
    total: number;
  };
}

/**
 * Get user's bills (completed purchases)
 */
export async function getBills(params?: {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
}): Promise<BillsResponse> {
  try {
    const response = await apiClient.get<BillsResponse>('/bills', {
      params: params || {},
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get invoice details by purchase ID
 */
export async function getInvoiceDetails(id: string): Promise<InvoiceDetails> {
  try {
    const response = await apiClient.get<InvoiceDetails>(`/invoices/${id}`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get bond download fee amount (without deducting)
 */
export interface BondFeeResponse {
  fee_amount: number;
  rule_code: string;
  rule_name: string;
}

export async function getBondDownloadFee(): Promise<BondFeeResponse> {
  try {
    const response = await apiClient.get<BondFeeResponse>('/users/bond/fee');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Authorize bond download by deducting fee
 */
export interface BondDownloadResponse {
  success: boolean;
  message: string;
  fee_deducted: number;
  transaction_id: string;
  already_paid?: boolean; // True if fee was already paid for this bill
}

export async function authorizeBondDownload(billId: string): Promise<BondDownloadResponse> {
  try {
    const response = await apiClient.post<BondDownloadResponse>('/users/bond/download', {
      bill_id: billId,
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

