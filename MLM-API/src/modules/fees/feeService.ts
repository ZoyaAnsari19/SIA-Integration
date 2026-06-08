import { prisma } from '../../config/prisma.js';
import { deductFromWallet } from '../../utils/wallet.js';
import { newIdempotencyKey } from '../../utils/idempotency.js';

// Fees that must ALWAYS be deducted from SPOT wallet only
const SPOT_ONLY_FEE_CODES = new Set<string>([
  'KYC_SUBMISSION',
]);

// Fees that must ALWAYS be deducted from MAIN/OTHER wallet only
// IMPORTANT: These fees should NEVER touch spot_balance. If main wallet
// does not have enough balance and negative is not allowed for this
// operation, the fee should fail with INSUFFICIENT_BALANCE.
const MAIN_ONLY_FEE_CODES = new Set<string>([
  'NAME_CHANGE',
  'NUMBER_CHANGE',
  'EMAIL_CHANGE',
  'SUPPORT_TICKET',
  'GENERAL_PROBLEM',
  'COMMISSION_ISSUE',
  'COMMISSION_ANALYSIS',
  'NAME_CORRECTION_MINOR',
  'EMAIL_CORRECTION',
  'MOBILE_CORRECTION_MINOR',
  'FULL_NAME_CHANGE',
  'FULL_MOBILE_CHANGE',
  'INFORMATION_PROBLEM',
  'CHEQUE_RETURN_ISSUE',
  'REPORT_DOWNLOAD',
  'BOND_DOWNLOAD',
  'ACCOUNT_CHANGE',
  'KYC_APPLY',
  'FUND_WITHDRAW',
  'ID_TRANSFER',
  'OTP_SEND',
  'TRANSACTION_PIN_FORGOT',
]);

export class FeeService {
  /**
   * Get fee rule by code
   */
  static async getFeeRule(ruleCode: string, includeInactive: boolean = false) {
    if (includeInactive) {
      return prisma.fee_rules.findUnique({
        where: { rule_code: ruleCode },
      });
    }
    return prisma.fee_rules.findUnique({
      where: { rule_code: ruleCode, is_active: true },
    });
  }

  /**
   * Check if fee is applicable for user
   * Returns applicable status, amount, and message
   * @param allowNegative - Allow wallet to go negative (for KYC, etc.)
   */
  static async checkFeeApplicable(
    userId: bigint,
    ruleCode: string,
    allowNegative: boolean = false
  ): Promise<{
    applicable: boolean;
    amount: number;
    message?: string;
  }> {
    const rule = await this.getFeeRule(ruleCode);
    if (!rule) {
      return {
        applicable: false,
        amount: 0,
        message: 'Fee rule not found or inactive',
      };
    }

    // Check balances (per-wallet)
    const balance = await prisma.user_balances.findUnique({
      where: { user_id: userId },
    });
    const spotBalance = Number((balance as any)?.spot_balance || 0);
    const otherBalance = Number((balance as any)?.other_balance || 0);
    const feeAmount = Number(rule.amount);

    // Allow negative balance for specific operations (KYC, etc.)
    // User will recover from commissions later
    if (allowNegative) {
      return { applicable: true, amount: feeAmount };
    }

    // Wallet-specific balance checks based on fee rule type
    // Rule:
    // - SPOT_ONLY_FEE_CODES  -> check SPOT wallet only
    // - All other fees (including MAIN_ONLY_FEE_CODES and new rules)
    //   -> check MAIN/OTHER wallet only
    if (SPOT_ONLY_FEE_CODES.has(ruleCode)) {
      // Fee must come from SPOT wallet only
      if (spotBalance < feeAmount) {
        return {
          applicable: false,
          amount: feeAmount,
          message: `Insufficient SPOT balance. Required: ₹${feeAmount.toFixed(
            2
          )}, Available SPOT: ₹${spotBalance.toFixed(2)}`,
        };
      }
    } else {
      // All non-SPOT fees must come from MAIN/OTHER wallet only
      if (otherBalance < feeAmount) {
        return {
          applicable: false,
          amount: feeAmount,
          message: `Insufficient Main wallet balance. Required: ₹${feeAmount.toFixed(
            2
          )}, Available Main wallet: ₹${otherBalance.toFixed(2)}`,
        };
      }
    }

    return { applicable: true, amount: feeAmount };
  }

  /**
   * Deduct fee from user wallet
   * Throws error if insufficient balance or rule not found
   * @param allowNegative - Allow wallet to go negative (for KYC, etc.)
   */
  static async deductFee(
    userId: bigint,
    ruleCode: string,
    referenceId?: bigint | null,
    referenceType?: string,
    allowNegative: boolean = false
  ) {
    const rule = await this.getFeeRule(ruleCode);
    if (!rule) {
      throw new Error('Fee rule not found or inactive');
    }

    const check = await this.checkFeeApplicable(userId, ruleCode, allowNegative);
    if (!check.applicable) {
      const error: any = new Error(check.message || 'Fee not applicable');
      error.code = 'INSUFFICIENT_BALANCE';
      error.required = check.amount;
      error.available = Number(
        (await prisma.user_balances.findUnique({ where: { user_id: userId } }))?.balance || 0
      );
      throw error;
    }

    const idempotencyKey = newIdempotencyKey(`fee:${ruleCode}:${userId}:${Date.now()}`);

    return deductFromWallet({
      userId,
      amount: check.amount,
      reason: ruleCode,
      referenceId,
      referenceType,
      idempotencyKey,
      allowNegative, // Pass through the allowNegative flag
    });
  }

  /**
   * Get fee transaction history for user
   */
  static async getFeeHistory(userId: bigint, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.fee_transactions.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.fee_transactions.count({ where: { user_id: userId } }),
    ]);

    return {
      count: transactions.length,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      total,
      items: transactions.map((t) => ({
        id: t.id.toString(),
        rule_code: t.rule_code,
        amount: Number(t.amount),
        transaction_type: t.transaction_type,
        reference_id: t.reference_id?.toString(),
        reference_type: t.reference_type,
        description: t.description,
        created_at: t.created_at,
      })),
    };
  }

  /**
   * Get all active fee rules (for user info)
   */
  static async getActiveFeeRules() {
    return prisma.fee_rules.findMany({
      where: { is_active: true },
      orderBy: { rule_code: 'asc' },
    });
  }
}

