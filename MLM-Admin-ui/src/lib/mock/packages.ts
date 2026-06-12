import type {
  Package,
  PackagesListResponse,
  GetPackagesParams,
  CreatePackageRequest,
  UpdatePackageRequest,
  DeletePackageResponse,
} from "../api/packages";

export type { Package, PackagesListResponse, GetPackagesParams };

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let nextId = 4;

let mockPackages: Package[] = [
  {
    id: 1,
    name: "Starter Package",
    price: 15000,
    min_amount: 15000,
    max_amount: 15000,
    self_monthly: 1500,
    self_roi_percent: 10,
    global_ids: 5,
    global_monthly_per_id: 100,
    recurring_rate_percent: 5,
    direct_spot_percent: 8,
    direct_monthly_royalty_percent: 5,
    validity_months: 12,
    validity_days: null,
    status: "active",
    course_id: 1,
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-15T10:30:00.000Z",
  },
  {
    id: 2,
    name: "Growth Package",
    price: 30000,
    min_amount: 30000,
    max_amount: 30000,
    self_monthly: 3000,
    self_roi_percent: 10,
    global_ids: 10,
    global_monthly_per_id: 150,
    recurring_rate_percent: 7,
    direct_spot_percent: 10,
    direct_monthly_royalty_percent: 7,
    validity_months: 12,
    validity_days: null,
    status: "active",
    course_id: 2,
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-18T14:20:00.000Z",
  },
  {
    id: 3,
    name: "Premium Package",
    price: 50000,
    min_amount: 50000,
    max_amount: 50000,
    self_monthly: 5000,
    self_roi_percent: 12,
    global_ids: 20,
    global_monthly_per_id: 200,
    recurring_rate_percent: 10,
    direct_spot_percent: 12,
    direct_monthly_royalty_percent: 10,
    validity_months: 12,
    validity_days: null,
    status: "active",
    course_id: 3,
    created_at: "2025-06-01T08:00:00.000Z",
    updated_at: "2026-05-20T09:45:00.000Z",
  },
];

function filterPackages(params?: GetPackagesParams): Package[] {
  let items = [...mockPackages];

  if (params?.status) {
    items = items.filter((p) => p.status === params.status);
  }

  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    items = items.filter((p) => p.name.toLowerCase().includes(q));
  }

  const sort = params?.sort || "price";
  const order = params?.order || "asc";
  items.sort((a, b) => {
    let cmp = 0;
    if (sort === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sort === "price") {
      cmp = a.price - b.price;
    } else if (sort === "created_at") {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sort === "updated_at") {
      cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    } else {
      cmp = a.id - b.id;
    }
    return order === "desc" ? -cmp : cmp;
  });

  return items;
}

export async function getPackages(
  params?: GetPackagesParams,
): Promise<PackagesListResponse> {
  await delay();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const filtered = filterPackages(params);
  const total = filtered.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    count: Math.min(limit, Math.max(0, total - start)),
    page,
    limit,
    total_pages,
    total,
    items: structuredClone(filtered.slice(start, start + limit)),
  };
}

export async function getPackageById(packageId: number): Promise<Package> {
  await delay(150);
  const pkg = mockPackages.find((p) => p.id === packageId);
  if (!pkg) throw new Error("Package not found (demo)");
  return structuredClone(pkg);
}

export async function createPackage(data: CreatePackageRequest): Promise<Package> {
  await delay(400);
  const created: Package = {
    id: nextId++,
    name: data.name,
    price: data.price,
    min_amount: data.min_amount ?? data.price,
    max_amount: data.max_amount ?? data.price,
    self_monthly: data.self_monthly ?? null,
    self_roi_percent: data.self_roi_percent ?? null,
    global_ids: data.global_ids ?? null,
    global_monthly_per_id: data.global_monthly_per_id ?? null,
    recurring_rate_percent: data.recurring_rate_percent ?? data.direct_monthly_royalty_percent ?? null,
    direct_spot_percent: data.direct_spot_percent ?? null,
    direct_monthly_royalty_percent: data.direct_monthly_royalty_percent ?? null,
    validity_months: data.validity_months ?? 12,
    validity_days: data.validity_days ?? null,
    status: data.status ?? "active",
    course_id: data.course_id ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockPackages = [...mockPackages, created];
  return structuredClone(created);
}

export async function updatePackage(
  packageId: number,
  data: UpdatePackageRequest,
): Promise<Package> {
  await delay(400);
  const index = mockPackages.findIndex((p) => p.id === packageId);
  if (index < 0) throw new Error("Package not found (demo)");

  mockPackages[index] = {
    ...mockPackages[index],
    ...data,
    updated_at: new Date().toISOString(),
  };
  return structuredClone(mockPackages[index]);
}

export async function deletePackage(packageId: number): Promise<DeletePackageResponse> {
  await delay(300);
  const index = mockPackages.findIndex((p) => p.id === packageId);
  if (index < 0) throw new Error("Package not found (demo)");
  mockPackages = mockPackages.filter((p) => p.id !== packageId);
  return { message: "Package deleted (demo)", id: packageId };
}
