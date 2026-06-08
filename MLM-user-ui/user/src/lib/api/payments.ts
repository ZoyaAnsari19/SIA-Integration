import { apiClient } from './client';
import type { ApiResponse } from './types';

export interface IciciCreatePaymentRequest {
  courseId?: string;
  courseIds?: string[];
  packageId?: number;
  amount?: number;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  /** activation | renew | reinvestment | upgrade – for gateway same logic as manual + admin */
  request_type?: 'activation' | 'renew' | 'reinvestment' | 'upgrade';
  /** Required for renew/upgrade: expired purchase id */
  previous_purchase_id?: string;
}

export interface IciciCreatePaymentResponse extends ApiResponse {
  success: boolean;
  redirectURL?: string;
  merchantTxnNo?: string;
  purchaseId?: string;
  responseCode?: string;
}

/**
 * Create ICICI payment for course/package purchase.
 * For user "Buy More" flow we primarily send packageId and let backend resolve linked course.
 */
export async function createIciciPayment(
  data: IciciCreatePaymentRequest
): Promise<IciciCreatePaymentResponse> {
  const response = await apiClient.post<IciciCreatePaymentResponse>(
    '/payments/icici/create-payment',
    data
  );
  return response.data;
}

