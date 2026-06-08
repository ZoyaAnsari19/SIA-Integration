// API utility for Income History
// Base URL - can be configured via environment variable
// Use ledger endpoints (audit-log) to fetch from ledger_entries table
import { getLedgerEntries, type LedgerCommissionType } from './ledger';
import { getPackageIdsFromPurchaseIds } from './purchases';
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  // If URL doesn't end with /admin, append it
  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  // If URL ends with /api/v1, append /admin
  if (envUrl.endsWith('/api/v1')) {
    return `${envUrl}/admin`;
  }
  // Otherwise, append /admin
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

// API Response types
export interface IncomeHistoryItem {
  id: string;
  commission_type: 'SELF' | 'SPOT' | 'MONTHLY' | 'GLOBAL_HELPING';
  amount: number;
  user_id?: string; // Receiver user ID (from admin endpoint)
  user_display_id?: string | null; // Display ID (e.g., SIA02047)
  user_name?: string | null; // Receiver user name (from admin endpoint)
  receiver_user_id?: string; // Alternative field name
  source_user_id?: string;
  source_user_display_id?: string | null; // Display ID for source user (e.g., SIA00153)
  source_user_name?: string | null;
  purchase_id?: string | null;
  package_id?: number | null; // Package ID (from admin endpoint for SELF)
  package_name?: string | null; // Package name (from admin endpoint)
  package_amount?: number | null; // Purchase amount for this package
  package_income?: number | null; // Total income earned for this package
  package_target_2x?: number | null; // Target amount for 2x
  package_progress_2x?: number | null; // Progress towards 2x (0-1)
  activation_req_id?: string | null; // Activation request ID (from admin endpoint)
  investment?: number | null;
  // For SPOT commissions: whether the underlying purchase was first-time activation or reinvestment
  // Values come from API as 'activation' | 'reinvestment'
  investment_type?: string | null;
  level?: number | null;
  credited_at: string;
  settled: boolean;
  status?: string | null; // Status from API: 'credited' or 'pending'
}

export interface IncomeHistoryResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: IncomeHistoryItem[];
}

export interface GetIncomeHistoryParams {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
}

// API Error type
export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    let errorMessage = errorData.error || errorData.message || 'API request failed';
    
    if (response.status === 401) {
      // Redirect to login on unauthorized
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized. Please login again.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

// Get Self Income - Using /api/v1/admin/commissions (SELF) so we get package_name directly
export async function getSelfIncome(
  params?: GetIncomeHistoryParams & { user_id?: string; package_id?: number },
): Promise<IncomeHistoryResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.user_id) searchParams.append('user_id', params.user_id);
  if (params?.package_id) searchParams.append('package_id', params.package_id.toString());
  // Only add date params if they exist and are not empty
  if (params?.start_date && params.start_date.trim() !== '') {
    searchParams.append('start_date', params.start_date);
  }
  if (params?.end_date && params.end_date.trim() !== '') {
    searchParams.append('end_date', params.end_date);
  }
  searchParams.append('commission_type', 'SELF');

  const url = `${API_BASE_URL}/commissions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  console.log('🔍 Fetching Self Income from admin/commissions:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  let raw: any;
  try {
    raw = await handleResponse<any>(response);
  } catch (error) {
    console.error('❌ Error parsing Self Income response:', error);
    throw error;
  }

  // Validate response structure
  if (!raw || typeof raw !== 'object') {
    console.error('❌ Invalid Self Income response structure:', raw);
    return {
      count: 0,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total_pages: 0,
      total: 0,
      items: [],
    };
  }

  console.log('✅ Self Income Response from admin/commissions:', {
    count: raw.count,
    total: raw.total,
    total_pages: raw.total_pages,
    itemsCount: raw.items?.length,
    firstItem: raw.items?.[0],
    url: url,
    hasItems: !!raw.items,
    itemsIsArray: Array.isArray(raw.items)
  });

  const items: IncomeHistoryItem[] = (raw.items || []).map((item: any) => {
    const packageAmount: number | null =
      item.package_amount != null ? Number(item.package_amount) : null;
    const packageIncome: number | null =
      item.package_income != null ? Number(item.package_income) : null;
    const target2x: number | null =
      item.package_target_2x != null
        ? Number(item.package_target_2x)
        : packageAmount != null
        ? packageAmount * 2
        : null;
    const progress2x: number | null =
      item.package_progress_2x != null
        ? Number(item.package_progress_2x)
        : target2x && packageIncome != null && target2x > 0
        ? Math.min(1, packageIncome / target2x)
        : null;

    // Ensure amount is properly converted to number
    const amount = Number(item.income_amount ?? item.amount ?? 0);

    return {
      id: item.id,
      commission_type: 'SELF',
      amount: isNaN(amount) ? 0 : amount,
      user_id: item.user_id?.toString(),
      user_display_id: item.user_display_id ?? null,
      receiver_user_id: item.user_id?.toString(),
      source_user_id: undefined,
      source_user_name: item.user_name ?? null,
      purchase_id: null,
      package_id: item.package_id ?? null,
      package_name: item.package_name ?? null,
      package_amount: packageAmount,
      package_income: packageIncome,
      package_target_2x: target2x,
      package_progress_2x: progress2x,
      activation_req_id: item.activation_req_id ?? null,
      investment: null,
      level: null,
      credited_at: item.created_at,
      settled: true,
    };
  });

  return {
    count: raw.count ?? items.length,
    page: raw.page ?? params?.page ?? 1,
    limit: raw.limit ?? params?.limit ?? 20,
    total_pages: raw.total_pages ?? 0,
    total: raw.total ?? items.length,
    items,
  };
}

// Get Direct Income - Using /api/v1/admin/commissions (SPOT with depth=1) to match user-side logic
// Direct Income = SPOT commissions from direct referrals (depth = 1)
export async function getDirectIncome(
  params?: GetIncomeHistoryParams & { user_id?: string; package_id?: number },
): Promise<IncomeHistoryResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.user_id) searchParams.append('user_id', params.user_id);
  if (params?.package_id) searchParams.append('package_id', params.package_id.toString());
  // Only add date params if they exist and are not empty
  if (params?.start_date && params.start_date.trim() !== '') {
    searchParams.append('start_date', params.start_date);
  }
  if (params?.end_date && params.end_date.trim() !== '') {
    searchParams.append('end_date', params.end_date);
  }
  searchParams.append('commission_type', 'SPOT');
  // For Direct Income page we only want actually credited SPOT commissions,
  // not pending/scheduled ones (those are shown separately in Spot Commission report).
  // Backend: status=credited -> only ledger_entries, no pending_commissions.
  searchParams.append('status', 'credited');

  const url = `${API_BASE_URL}/commissions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  console.log('🔍 Fetching Direct Income from admin/commissions (SPOT):', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  let raw: any;
  try {
    raw = await handleResponse<any>(response);
  } catch (error) {
    console.error('❌ Error parsing Direct Income response:', error);
    throw error;
  }

  // Validate response structure
  if (!raw || typeof raw !== 'object') {
    console.error('❌ Invalid Direct Income response structure:', raw);
    return {
      count: 0,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total_pages: 0,
      total: 0,
      items: [],
    };
  }

  console.log('✅ Direct Income Response from admin/commissions:', {
    count: raw.count,
    total: raw.total,
    total_pages: raw.total_pages,
    itemsCount: raw.items?.length,
    firstItem: raw.items?.[0],
    url: url,
    hasItems: !!raw.items,
    itemsIsArray: Array.isArray(raw.items)
  });

  // Debug: Log first few items to see their structure
  if (raw.items && raw.items.length > 0) {
    console.log('🔍 First 3 Direct Income items (before filter):', raw.items.slice(0, 3).map((item: any) => ({
      id: item.id,
      income_lvl: item.income_lvl,
      level: item.level,
      from_id: item.from_id,
      user_id: item.user_id,
    })));
  }

  const items: IncomeHistoryItem[] = (raw.items || [])
    .filter((item: any) => {
      // Filter for direct referrals only (depth = 1)
      // SPOT commissions with income_lvl = 0 are direct income (depth 1 in tree)
      const level = item.income_lvl ?? item.level ?? null;
      // Direct income = business level 0 (depth 1 in tree, meaning direct referral)
      return level === 0;
    })
    .map((item: any) => {
      // For SPOT: user_id is receiver, from_id is source_user_id (the direct referral who made purchase)
      // Ensure amount is properly converted to number
      const amount = Number(item.income_amount ?? item.amount ?? 0);
      
      return {
        id: item.id,
        commission_type: 'SPOT',
        amount: isNaN(amount) ? 0 : amount,
        user_id: item.user_id?.toString(), // Receiver (who got the income)
        user_display_id: item.user_display_id ?? null,
        user_name: item.user_name ?? null, // Receiver name from API
        receiver_user_id: item.user_id?.toString(),
        source_user_id: item.from_id?.toString() || null, // Source (direct referral who made purchase)
        source_user_display_id: item.from_display_id ?? null,
        source_user_name: item.from_name ?? null,
        purchase_id: item.purchase_id?.toString() || null,
        package_id: item.package_id ?? null,
        package_name: item.package_name ?? null,
        package_amount: item.investment_amt ?? null,
        package_income: null,
        package_target_2x: null,
        package_progress_2x: null,
        activation_req_id: item.activation_req_id ?? null,
        investment: item.investment_amt ?? null,
        level: item.income_lvl ?? item.level ?? null, // Level/depth between receiver and source
        credited_at: item.created_at,
        settled: item.settled ?? true,
      };
    });

  return {
    count: items.length,
    page: raw.page ?? params?.page ?? 1,
    limit: raw.limit ?? params?.limit ?? 20,
    total_pages: Math.ceil((raw.total ?? items.length) / (raw.limit ?? params?.limit ?? 20)),
    total: raw.total ?? items.length,
    items,
  };
}

// Get Team Income (MONTHLY) - Using /api/v1/admin/commissions endpoint
export async function getTeamIncome(
  params?: GetIncomeHistoryParams & { user_id?: string; package_id?: number },
): Promise<IncomeHistoryResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.user_id) searchParams.append('user_id', params.user_id);
  if (params?.package_id) searchParams.append('package_id', params.package_id.toString());
  // Only add date params if they exist and are not empty
  if (params?.start_date && params.start_date.trim() !== '') {
    searchParams.append('start_date', params.start_date);
  }
  if (params?.end_date && params.end_date.trim() !== '') {
    searchParams.append('end_date', params.end_date);
  }
  searchParams.append('commission_type', 'MONTHLY');

  const url = `${API_BASE_URL}/commissions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  console.log('🔍 Fetching Team Income from admin/commissions (MONTHLY):', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  let raw = await handleResponse<any>(response);
  
  // Validate response structure
  if (!raw || typeof raw !== 'object') {
    console.error('❌ Invalid Team Income response structure:', raw);
    return {
      count: 0,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total_pages: 0,
      total: 0,
      items: [],
    };
  }

  console.log('✅ Team Income Response from admin/commissions:', {
    count: raw.count,
    total: raw.total,
    total_pages: raw.total_pages,
    itemsCount: raw.items?.length,
    firstItem: raw.items?.[0],
    url: url,
    hasItems: !!raw.items,
    itemsIsArray: Array.isArray(raw.items)
  });

  const items: IncomeHistoryItem[] = (raw.items || []).map((item: any) => {
    // Get level/depth from API response (income_lvl is the depth between receiver and source)
    const level = item.income_lvl ?? item.level ?? null;
    
    // Ensure amount is properly converted to number
    const amount = Number(item.income_amount ?? item.amount ?? 0);

    return {
      id: item.id,
      commission_type: 'MONTHLY',
      amount: isNaN(amount) ? 0 : amount,
      user_id: item.user_id?.toString(), // Receiver (who got the income)
      user_display_id: item.user_display_id ?? null,
      user_name: item.user_name ?? null, // Receiver user name
      receiver_user_id: item.user_id?.toString(),
      source_user_id: item.members?.toString() || item.source_user_id?.toString() || null, // Source (team member)
      source_user_display_id: item.from_display_id ?? null,
      source_user_name: item.from_name ?? null,
      purchase_id: item.purchase_id?.toString() || null,
      package_id: item.package_id ?? null,
      package_name: item.package_name ?? null,
      package_amount: item.investment_amt ?? null,
      package_income: null,
      package_target_2x: null,
      package_progress_2x: null,
      activation_req_id: item.activation_req_id ?? null,
      investment: item.investment_amt ?? null,
      level: level, // Level/depth between receiver and source (from income_lvl)
      credited_at: item.created_at,
      settled: item.settled ?? true,
    };
  });

  return {
    count: items.length,
    page: raw.page ?? params?.page ?? 1,
    limit: raw.limit ?? params?.limit ?? 20,
    total_pages: Math.ceil((raw.total ?? items.length) / (raw.limit ?? params?.limit ?? 20)),
    total: raw.total ?? items.length,
    items,
  };
}

// Get Spot Income - Using /admin/commissions endpoint (same as Direct Income)
export async function getSpotIncome(
  params?: GetIncomeHistoryParams & { user_id?: string; source_user_id?: string; status?: string },
): Promise<IncomeHistoryResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.source_user_id) queryParams.append('source_user_id', params.source_user_id);
  // Only add date params if they exist and are not empty
  if (params?.start_date && params.start_date.trim() !== '') {
    queryParams.append('start_date', params.start_date);
  }
  if (params?.end_date && params.end_date.trim() !== '') {
    queryParams.append('end_date', params.end_date);
  }
  if (params?.status) queryParams.append('status', params.status);
  queryParams.append('commission_type', 'SPOT'); // Filter by SPOT commission type

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/commissions${queryString ? `?${queryString}` : ''}`;

  console.log('[Income History API] Fetching SPOT commissions from:', url);
  console.log('[Income History API] Params:', params);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  let raw: any;
  try {
    raw = await handleResponse<any>(response);
  } catch (error) {
    console.error('❌ Error parsing Spot Income response:', error);
    throw error;
  }

  // Validate response structure
  if (!raw || typeof raw !== 'object') {
    console.error('❌ Invalid Spot Income response structure:', raw);
    return {
      count: 0,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total_pages: 0,
      total: 0,
      items: [],
    };
  }

  console.log('[Income History API] SPOT commissions response:', {
    count: raw.count,
    total: raw.total,
    itemsCount: raw.items?.length,
    firstItem: raw.items?.[0],
    url: url,
    hasItems: !!raw.items,
    itemsIsArray: Array.isArray(raw.items)
  });

  // Map ledger entries to IncomeHistoryItem format
  const items: IncomeHistoryItem[] = (raw.items || []).map((item: any) => {
    // Check if item is from pending_commissions (has created_at but no credited_at)
    const isSettled = item.settled !== false && item.credited_at !== undefined;
    const level = item.income_lvl ?? item.level ?? null;

    // Ensure amount is properly converted to number
    const amount = Number(item.income_amount ?? item.amount ?? 0);

    return {
      id: item.id,
      commission_type: 'SPOT',
      amount: isNaN(amount) ? 0 : amount,
      user_id: item.user_id?.toString(),
      user_display_id: item.user_display_id ?? null,
      user_name: item.user_name ?? null, // Receiver user name
      receiver_user_id: item.user_id?.toString(),
      source_user_id: item.from_id?.toString() || null,
      source_user_display_id: item.from_display_id ?? null,
      source_user_name: item.from_name ?? null,
      purchase_id: item.purchase_id?.toString() || null,
      package_id: item.package_id ?? null,
      package_name: item.package_name ?? null,
      package_amount: item.investment_amt ?? null,
      package_income: null,
      package_target_2x: null,
      package_progress_2x: null,
      activation_req_id: item.activation_req_id ?? null,
      investment: item.investment_amt ?? null,
      investment_type: item.investment_type ?? null,
      level: level, // Level/depth between receiver and source (from income_lvl)
      credited_at: item.created_at,
      settled: isSettled,
      status: item.status ?? (isSettled ? 'credited' : 'pending'), // Status: 'credited' if settled, 'pending' otherwise
    };
  });

  return {
    count: items.length,
    page: raw.page ?? params?.page ?? 1,
    limit: raw.limit ?? params?.limit ?? 20,
    total_pages: Math.ceil((raw.total ?? items.length) / (raw.limit ?? params?.limit ?? 20)),
    total: raw.total ?? items.length,
    items,
  };
}

// Get Global Income (GLOBAL_HELPING) - Using /api/v1/admin/commissions endpoint
export async function getGlobalIncome(
  params?: GetIncomeHistoryParams & { user_id?: string; package_id?: number },
): Promise<IncomeHistoryResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.user_id) searchParams.append('user_id', params.user_id);
  if (params?.package_id) searchParams.append('package_id', params.package_id.toString());
  // Only add date params if they exist and are not empty
  if (params?.start_date && params.start_date.trim() !== '') {
    searchParams.append('start_date', params.start_date);
  }
  if (params?.end_date && params.end_date.trim() !== '') {
    searchParams.append('end_date', params.end_date);
  }
  searchParams.append('commission_type', 'GLOBAL_HELPING');

  const url = `${API_BASE_URL}/commissions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  console.log('🔍 Fetching Global Income from admin/commissions (GLOBAL_HELPING):', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  let raw: any;
  try {
    raw = await handleResponse<any>(response);
  } catch (error) {
    console.error('❌ Error parsing Global Income response:', error);
    throw error;
  }

  // Validate response structure
  if (!raw || typeof raw !== 'object') {
    console.error('❌ Invalid Global Income response structure:', raw);
    return {
      count: 0,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total_pages: 0,
      total: 0,
      items: [],
    };
  }

  console.log('✅ Global Income Response from admin/commissions:', {
    count: raw.count,
    total: raw.total,
    total_pages: raw.total_pages,
    itemsCount: raw.items?.length,
    firstItem: raw.items?.[0],
    url: url,
    hasItems: !!raw.items,
    itemsIsArray: Array.isArray(raw.items)
  });

  const items: IncomeHistoryItem[] = (raw.items || []).map((item: any) => {
    // Ensure amount is properly converted to number
    const amount = Number(item.income_amount ?? item.amount ?? 0);

    return {
      id: item.id,
      commission_type: 'GLOBAL_HELPING',
      amount: isNaN(amount) ? 0 : amount,
      user_id: item.user_id?.toString(),
      user_display_id: item.user_display_id ?? null,
      receiver_user_id: item.user_id?.toString(),
      source_user_id: item.from_id?.toString() || null,
      source_user_display_id: item.from_display_id ?? null,
      source_user_name: item.from_name ?? null,
      purchase_id: item.purchase_id?.toString() || null,
      package_id: item.package_id ?? null,
      package_name: item.package_name ?? null,
      package_amount: item.investment_amt ?? null,
      package_income: null,
      package_target_2x: null,
      package_progress_2x: null,
      activation_req_id: item.activation_req_id ?? null,
      investment: item.investment_amt ?? null,
      level: item.income_lvl ?? item.level ?? null,
      credited_at: item.created_at,
      settled: item.settled ?? true,
    };
  });

  return {
    count: raw.count ?? items.length,
    page: raw.page ?? params?.page ?? 1,
    limit: raw.limit ?? params?.limit ?? 20,
    total_pages: raw.total_pages ?? 0,
    total: raw.total ?? items.length,
    items,
  };
}
