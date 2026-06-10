import type {
  ActivityLog,
  ActivityLogsQuery,
  ActivityLogsResponse,
} from "../api/activity-logs";

export type { ActivityLog, ActivityLogsQuery, ActivityLogsResponse };

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_LOGS: ActivityLog[] = [
  {
    id: "log-001",
    admin_user_id: "sub-admin-001",
    admin_name: "Priya Operations",
    admin_email: "priya.ops@example.com",
    action_type: "KYC_APPROVE",
    target_user_id: "1001",
    target_user_display_id: "SIA00057",
    target_entity_type: "user",
    target_entity_id: "1001",
    action_details: { kyc_status: "approved" },
    action_summary: "KYC approved for SIA00057",
    ip_address: "103.21.45.10",
    user_agent: "Mozilla/5.0 (demo)",
    status: "success",
    error_message: null,
    created_at: "2026-06-10T09:15:00.000Z",
  },
  {
    id: "log-002",
    admin_user_id: "sub-admin-001",
    admin_name: "Priya Operations",
    admin_email: "priya.ops@example.com",
    action_type: "WALLET_MANAGE",
    target_user_id: "1002",
    target_user_display_id: "SIA00089",
    target_entity_type: "wallet",
    target_entity_id: "wallet-1002",
    action_details: { amount: 500, type: "credit", wallet: "spot" },
    action_summary: "Credited ₹500 to spot wallet",
    ip_address: "103.21.45.10",
    user_agent: "Mozilla/5.0 (demo)",
    status: "success",
    error_message: null,
    created_at: "2026-06-09T14:30:00.000Z",
  },
  {
    id: "log-003",
    admin_user_id: "sub-admin-002",
    admin_name: "Amit Support",
    admin_email: "amit.support@example.com",
    action_type: "WITHDRAWAL_APPROVE",
    target_user_id: "1003",
    target_user_display_id: "SIA00124",
    target_entity_type: "withdrawal",
    target_entity_id: "wd-001",
    action_details: { amount: 5000 },
    action_summary: "Withdrawal approved",
    ip_address: "49.36.88.22",
    user_agent: "Mozilla/5.0 (demo)",
    status: "success",
    error_message: null,
    created_at: "2026-06-08T11:00:00.000Z",
  },
  {
    id: "log-004",
    admin_user_id: "sub-admin-002",
    admin_name: "Amit Support",
    admin_email: "amit.support@example.com",
    action_type: "PACKAGE_ASSIGN",
    target_user_id: "1004",
    target_user_display_id: "SIA00156",
    target_entity_type: "package",
    target_entity_id: "pkg-1",
    action_details: { package_name: "Starter Package" },
    action_summary: "Package assigned",
    ip_address: "49.36.88.22",
    user_agent: "Mozilla/5.0 (demo)",
    status: "success",
    error_message: null,
    created_at: "2026-06-07T16:45:00.000Z",
  },
  {
    id: "log-005",
    admin_user_id: "sub-admin-001",
    admin_name: "Priya Operations",
    admin_email: "priya.ops@example.com",
    action_type: "KYC_REJECT",
    target_user_id: "1005",
    target_user_display_id: "SIA00198",
    target_entity_type: "user",
    target_entity_id: "1005",
    action_details: { reason: "Document unclear" },
    action_summary: "KYC rejected",
    ip_address: "103.21.45.10",
    user_agent: "Mozilla/5.0 (demo)",
    status: "failed",
    error_message: "Validation failed",
    created_at: "2026-06-06T10:20:00.000Z",
  },
  {
    id: "log-006",
    admin_user_id: "sub-admin-002",
    admin_name: "Amit Support",
    admin_email: "amit.support@example.com",
    action_type: "USER_UPDATE",
    target_user_id: "1006",
    target_user_display_id: "SIA00234",
    target_entity_type: "user",
    target_entity_id: "1006",
    action_details: { field: "phone" },
    action_summary: "User profile updated",
    ip_address: "49.36.88.22",
    user_agent: "Mozilla/5.0 (demo)",
    status: "success",
    error_message: null,
    created_at: "2026-06-05T08:10:00.000Z",
  },
];

export async function getActivityLogs(
  query?: ActivityLogsQuery,
): Promise<ActivityLogsResponse> {
  await delay();

  let logs = [...MOCK_LOGS];

  if (query?.admin_user_id) {
    logs = logs.filter((l) => l.admin_user_id === query.admin_user_id);
  }
  if (query?.action_type) {
    logs = logs.filter((l) => l.action_type === query.action_type);
  }
  if (query?.status) {
    logs = logs.filter((l) => l.status === query.status);
  }
  if (query?.start_date) {
    const start = new Date(query.start_date).getTime();
    logs = logs.filter((l) => new Date(l.created_at).getTime() >= start);
  }
  if (query?.end_date) {
    const end = new Date(query.end_date).getTime();
    logs = logs.filter((l) => new Date(l.created_at).getTime() <= end);
  }

  const page = query?.page || 1;
  const limit = query?.limit || 20;
  const total = logs.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    logs: structuredClone(logs.slice(start, start + limit)),
    pagination: {
      page,
      limit,
      total,
      total_pages,
    },
  };
}
