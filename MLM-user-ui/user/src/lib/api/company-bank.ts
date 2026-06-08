/**
 * Company Bank Account API Service
 */

import { apiClient } from './client';
import type { CompanyBankAccount } from './types';

/**
 * Get active company bank account details for deposits
 */
export async function getActiveCompanyBankAccount(): Promise<CompanyBankAccount> {
  try {
    const response = await apiClient.get<CompanyBankAccount>('/company-bank/active');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

