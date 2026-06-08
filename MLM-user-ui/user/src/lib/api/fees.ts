/**
 * Fees API Service
 */

import { apiClient } from './client';

/**
 * Fee Rule
 */
export interface FeeRule {
  id: number;
  rule_code: string;
  rule_name: string;
  description: string;
  amount: number;
  applies_to: string;
}

/**
 * Fee Rules Response
 */
export interface FeeRulesResponse {
  count: number;
  items: FeeRule[];
}

/**
 * Get active fee rules
 */
export async function getActiveFeeRules(): Promise<FeeRulesResponse> {
  try {
    const response = await apiClient.get<FeeRulesResponse>('/fees/rules');
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get profile update fee amount (ACCOUNT_CHANGE)
 */
export async function getProfileUpdateFee(): Promise<number> {
  try {
    const rules = await getActiveFeeRules();
    const accountChangeRule = rules.items.find(rule => rule.rule_code === 'ACCOUNT_CHANGE');
    return accountChangeRule?.amount || 0;
  } catch (error: any) {
    console.error('Error fetching profile update fee:', error);
    return 0;
  }
}

/**
 * Get name change fee amount (NAME_CHANGE)
 */
export async function getNameChangeFee(): Promise<number> {
  try {
    const rules = await getActiveFeeRules();
    const nameChangeRule = rules.items.find(rule => rule.rule_code === 'NAME_CHANGE');
    return nameChangeRule?.amount || 0;
  } catch (error: any) {
    console.error('Error fetching name change fee:', error);
    return 0;
  }
}

