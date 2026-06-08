/**
 * Package Purchase API Service
 */

import { apiClient } from './client';
import type { Package, PackagePurchase, PurchaseRequest } from './types';

/**
 * Get all available packages
 */
export async function getPackages(): Promise<Package[]> {
  try {
    const response = await apiClient.get<Package[]>('/packages');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get user's package purchases
 */
export async function getMyPackages(params?: {
  status?: 'completed' | 'active' | 'expired';
}): Promise<{
  count: number;
  items: PackagePurchase[];
}> {
  try {
    const response = await apiClient.get<{
      count: number;
      items: PackagePurchase[];
    }>('/my-packages', {
      params: params || {},
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get package purchase details by ID
 */
export async function getMyPackageById(id: string): Promise<PackagePurchase> {
  try {
    const response = await apiClient.get<PackagePurchase>(`/my-packages/${id}`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Create purchase request (activation/reinvestment/renew)
 */
export async function createPurchaseRequest(
  data: PurchaseRequest
): Promise<{
  request: {
    id: string;
    user_id: string;
    package_id: number;
    request_type: 'activation' | 'renew' | 'reinvestment';
    status: string;
    amount: number;
    created_at: string;
  };
  message: string;
}> {
  try {
    const response = await apiClient.post<{
      request: {
        id: string;
        user_id: string;
        package_id: number;
        request_type: 'activation' | 'renew' | 'reinvestment';
        status: string;
        amount: number;
        created_at: string;
      };
      message: string;
    }>('/purchases', data);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Upload payment proof image
 * Uses dedicated payment proof upload endpoint (does NOT update profile photo)
 */
export async function uploadPaymentProof(
  file: File
): Promise<{ url: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<{ payment_proof_url: string; uploaded_at: string }>(
      '/deposit/payment-proof',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return { url: response.data.payment_proof_url };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Check if UTR number already exists
 */
export async function checkUtrExists(utrNumber: string): Promise<{
  exists: boolean;
  message: string;
}> {
  try {
    const response = await apiClient.get<{
      exists: boolean;
      message: string;
    }>('/deposit/check-utr', {
      params: { utr_number: utrNumber },
    });
    return response.data;
  } catch (error: any) {
    console.error('Check UTR error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Check reinvestment amount (e.g. 50% of largest active package if user never withdrew from Main).
 * Used before redirecting to payment gateway.
 */
export async function checkReinvestmentAmount(amount: number): Promise<{
  ok: boolean;
  min_amount: number;
  last_withdrawal_amount: number;
}> {
  try {
    const response = await apiClient.post<{
      ok: boolean;
      min_amount: number;
      last_withdrawal_amount: number;
      current_package_amount?: number;
    }>('/purchases/reinvestment/check', { amount });
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Submit manual deposit request
 */
export async function submitManualDeposit(data: {
  package_id: number;
  previous_package_id?: number; // For renewals: expired package's package_id
  previous_purchase_id?: string; // For renewals: exact expired purchase id
  request_type: 'activation' | 'renew' | 'reinvestment';
  amount: number;
  utr_number?: string;
  payment_proof_url: string;
  payment_type?: string;
  remarks?: string;
}): Promise<{
  id: string;
  user_id: string;
  package_id: number;
  request_type: string;
  amount: number;
  status: string;
  created_at: string;
  message?: string;
}> {
  try {
    const response = await apiClient.post<{
      id: string;
      user_id: string;
      package_id: number;
      request_type: string;
      amount: number;
      status: string;
      created_at: string;
      message?: string;
    }>('/deposit/manual', data);
    if (process.env.NODE_ENV === 'development') {
      console.log('Manual deposit response:', response.data);
    }
    return response.data;
  } catch (error: any) {
    console.error('Manual deposit error:', error.response?.data || error.message);
    throw error;
  }
}

