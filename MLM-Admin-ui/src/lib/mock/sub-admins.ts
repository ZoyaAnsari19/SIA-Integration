import {
  PERMISSION_GROUPS,
  type Permission,
  type PermissionKey,
  type SubAdmin,
  type SubAdminsListResponse,
  type CreateSubAdminRequest,
  type UpdateSubAdminRequest,
} from "../api/sub-admins";

export type {
  AdminRole,
  Permission,
  PermissionKey,
  SubAdmin,
  SubAdminsListResponse,
  CreateSubAdminRequest,
  UpdateSubAdminRequest,
} from "../api/sub-admins";

export { PERMISSION_GROUPS };

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

let mockSubAdmins: SubAdmin[] = [
  {
    id: "sub-admin-001",
    name: "Priya Operations",
    email: "priya.ops@example.com",
    phone: "9876501234",
    role: "SUB_ADMIN",
    status: "active",
    password: null,
    action_pin: "1234",
    permissions: ["USERS_VIEW", "USERS_EDIT", "KYC_VIEW", "KYC_APPROVE", "WALLET_MANAGE"],
    created_at: "2025-11-01T08:00:00.000Z",
    updated_at: "2026-05-20T10:00:00.000Z",
  },
  {
    id: "sub-admin-002",
    name: "Amit Support",
    email: "amit.support@example.com",
    phone: "9876512345",
    role: "SUB_ADMIN",
    status: "active",
    password: null,
    action_pin: "5678",
    permissions: ["TICKET_VIEW", "TICKET_MANAGE", "WITHDRAW_VIEW", "LEDGER_VIEW"],
    created_at: "2025-12-15T09:30:00.000Z",
    updated_at: "2026-05-18T14:20:00.000Z",
  },
  {
    id: "sub-admin-003",
    name: "Inactive Demo Admin",
    email: "inactive@example.com",
    phone: "9876523456",
    role: "SUB_ADMIN",
    status: "inactive",
    password: null,
    action_pin: null,
    permissions: ["USERS_VIEW"],
    created_at: "2025-09-10T11:00:00.000Z",
    updated_at: "2026-04-01T16:00:00.000Z",
  },
];

function filterSubAdmins(params?: {
  search?: string;
  status?: "active" | "inactive";
}): SubAdmin[] {
  let items = [...mockSubAdmins];
  if (params?.status) {
    items = items.filter((a) => a.status === params.status);
  }
  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    items = items.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.includes(q),
    );
  }
  return items;
}

export async function getPermissions(): Promise<Permission[]> {
  await delay(100);
  return PERMISSION_GROUPS.flatMap((g) =>
    g.permissions.map((p) => ({ ...p, group: g.group })),
  );
}

export async function getMyPermissions(): Promise<{ permissions: string[]; role: string }> {
  await delay(100);
  return {
    role: "SUPER_ADMIN",
    permissions: ALL_PERMISSION_KEYS,
  };
}

export async function getSubAdmins(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive";
}): Promise<SubAdminsListResponse> {
  await delay();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const filtered = filterSubAdmins(params);
  const total = filtered.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    count: Math.min(limit, total - start),
    page,
    limit,
    total_pages,
    total,
    items: structuredClone(filtered.slice(start, start + limit)),
  };
}

export async function getSubAdminById(id: string): Promise<SubAdmin> {
  await delay(150);
  const admin = mockSubAdmins.find((a) => a.id === id);
  if (!admin) throw new Error("Sub-admin not found (demo)");
  return structuredClone(admin);
}

export async function createSubAdmin(payload: CreateSubAdminRequest): Promise<SubAdmin> {
  await delay(400);
  const created: SubAdmin = {
    id: `sub-admin-${Date.now()}`,
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    role: "SUB_ADMIN",
    status: "active",
    password: null,
    action_pin: null,
    permissions: payload.permissions || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockSubAdmins = [created, ...mockSubAdmins];
  return structuredClone(created);
}

export async function updateSubAdmin(
  id: string,
  payload: UpdateSubAdminRequest,
): Promise<SubAdmin> {
  await delay(400);
  const index = mockSubAdmins.findIndex((a) => a.id === id);
  if (index < 0) throw new Error("Sub-admin not found (demo)");

  mockSubAdmins[index] = {
    ...mockSubAdmins[index],
    ...payload,
    updated_at: new Date().toISOString(),
  };
  return structuredClone(mockSubAdmins[index]);
}

export async function updateSubAdminStatus(
  id: string,
  status: "active" | "inactive",
): Promise<void> {
  await delay(300);
  const index = mockSubAdmins.findIndex((a) => a.id === id);
  if (index < 0) throw new Error("Sub-admin not found (demo)");
  mockSubAdmins[index] = {
    ...mockSubAdmins[index],
    status,
    updated_at: new Date().toISOString(),
  };
}
