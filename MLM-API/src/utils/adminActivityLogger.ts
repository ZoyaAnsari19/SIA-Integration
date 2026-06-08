import { prisma } from '../config/prisma.js';
import { FastifyRequest } from 'fastify';

export type AdminActionType =
  | 'KYC_APPROVE'
  | 'KYC_REJECT'
  | 'PACKAGE_ASSIGN'
  | 'WALLET_CREDIT'
  | 'WALLET_DEBIT'
  | 'WALLET_MANAGE'
  | 'WITHDRAWAL_APPROVE'
  | 'WITHDRAWAL_REJECT'
  | 'USER_BLOCK'
  | 'USER_UNBLOCK'
  | 'USER_DELETE'
  | 'USER_UPDATE'
  | 'ACTIVATION_APPROVE'
  | 'ACTIVATION_REJECT'
  | 'COMMISSION_MANUAL_CREDIT'
  | 'COMMISSION_MANUAL_DEBIT'
  | 'GATEWAY_RECONCILE';

export interface LogAdminActivityParams {
  adminUserId: bigint;
  actionType: AdminActionType;
  targetUserId?: bigint | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  actionDetails?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: 'success' | 'failed' | 'error';
  errorMessage?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Generate a human-readable summary from action details
 */
function generateActionSummary(actionType: AdminActionType, actionDetails: Record<string, any> | null | undefined): string | null {
  if (!actionDetails || typeof actionDetails !== 'object') {
    return null;
  }

  const parts: string[] = [];

  switch (actionType) {
    case 'WALLET_MANAGE':
      if (actionDetails.main_wallet_amount !== undefined && actionDetails.main_wallet_amount !== null) {
        const mainAmount = Number(actionDetails.main_wallet_amount);
        if (mainAmount !== 0) {
          const sign = mainAmount >= 0 ? '+' : '';
          parts.push(`Main: ${sign}₹${Math.abs(mainAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        }
      }
      if (actionDetails.spot_wallet_amount !== undefined && actionDetails.spot_wallet_amount !== null) {
        const spotAmount = Number(actionDetails.spot_wallet_amount);
        if (spotAmount !== 0) {
          const sign = spotAmount >= 0 ? '+' : '';
          parts.push(`Spot: ${sign}₹${Math.abs(spotAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        }
      }
      if (actionDetails.reason) {
        parts.push(`Reason: ${actionDetails.reason}`);
      }
      break;

    case 'PACKAGE_ASSIGN':
      if (actionDetails.package_name) {
        parts.push(`Package: ${actionDetails.package_name}`);
      }
      if (actionDetails.package_price !== undefined) {
        parts.push(`Amount: ₹${Number(actionDetails.package_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
      break;

    case 'KYC_APPROVE':
    case 'KYC_REJECT':
      if (actionDetails.user_display_id) {
        parts.push(`User: ${actionDetails.user_display_id}`);
      }
      if (actionDetails.rejection_reason) {
        parts.push(`Reason: ${actionDetails.rejection_reason}`);
      }
      break;

    case 'WITHDRAWAL_APPROVE':
    case 'WITHDRAWAL_REJECT':
      if (actionDetails.withdrawal_amount !== undefined) {
        parts.push(`Amount: ₹${Number(actionDetails.withdrawal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
      if (actionDetails.rejection_reason) {
        parts.push(`Reason: ${actionDetails.rejection_reason}`);
      }
      break;

    case 'ACTIVATION_APPROVE':
    case 'ACTIVATION_REJECT':
      if (actionDetails.package_name) {
        parts.push(`Package: ${actionDetails.package_name}`);
      }
      if (actionDetails.package_price !== undefined) {
        parts.push(`Amount: ₹${Number(actionDetails.package_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
      if (actionDetails.rejection_reason) {
        parts.push(`Reason: ${actionDetails.rejection_reason}`);
      }
      break;

    case 'USER_BLOCK':
    case 'USER_UNBLOCK':
      if (actionDetails.user_display_id) {
        parts.push(`User: ${actionDetails.user_display_id}`);
      }
      if (actionDetails.old_status && actionDetails.new_status) {
        parts.push(`Status: ${actionDetails.old_status} → ${actionDetails.new_status}`);
      }
      break;

    case 'GATEWAY_RECONCILE':
      if (actionDetails.user_display_id) {
        parts.push(`User: ${actionDetails.user_display_id}`);
      }
      if (actionDetails.amount !== undefined) {
        parts.push(`Amount: ₹${Number(actionDetails.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }
      if (actionDetails.purchase_id) {
        parts.push(`Purchase: ${actionDetails.purchase_id}`);
      }
      break;

    default:
      // Generic fallback
      if (actionDetails.user_display_id) {
        parts.push(`User: ${actionDetails.user_display_id}`);
      }
      if (actionDetails.reason) {
        parts.push(`Reason: ${actionDetails.reason}`);
      }
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

/**
 * Log admin activity asynchronously (non-blocking)
 * This function should not throw errors - it's fire-and-forget
 */
export async function logAdminActivity(params: LogAdminActivityParams): Promise<void> {
  try {
    // Generate human-readable summary from action details
    const actionSummary = generateActionSummary(params.actionType, params.actionDetails);

    await prisma.admin_activity_logs.create({
      data: {
        admin_user_id: params.adminUserId,
        action_type: params.actionType,
        target_user_id: params.targetUserId || null,
        target_entity_type: params.targetEntityType || null,
        target_entity_id: params.targetEntityId || null,
        action_details: params.actionDetails || null,
        action_summary: actionSummary,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        status: params.status || 'success',
        error_message: params.errorMessage || null,
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    // Log error but don't throw - activity logging should never break the main flow
    console.error('Failed to log admin activity:', error);
    console.error('Activity params:', JSON.stringify(params, null, 2));
  }
}

/**
 * Helper to extract IP address and user agent from request
 */
export function getRequestInfo(req: FastifyRequest): { ipAddress: string | null; userAgent: string | null } {
  // Get IP address (check various headers for proxy/load balancer)
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.socket.remoteAddress ||
    null;

  // Get user agent
  const userAgent = (req.headers['user-agent'] as string) || null;

  return { ipAddress, userAgent };
}
