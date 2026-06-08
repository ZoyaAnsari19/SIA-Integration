// API utility for Purchases management
// Base URL - can be configured via environment variable
// Ensure admin endpoints always use /admin path
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
export interface Purchase {
  id: string;
  user_id: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  package_id: number;
  package?: {
    id: number;
    name: string;
    price: number;
  } | null;
  amount: number;
  status: string;
  purchased_at: string;
  // active_until removed - expiry is ONLY based on 2x income
}

export type GatewayFlowType = 'NEW_PURCHASE' | 'REINVESTMENT' | 'RENEWAL' | 'UPGRADE';

export interface GatewayPurchaseItem {
  id: string;
  user_id: string;
  user_display_id: string | null;
  user_name: string | null;
  package_id: number;
  package_name: string;
  amount: number;
  status: string;
  purchased_at: string;
  payment_type: string | null;
  is_renewal: boolean;
  previous_package_id: number | null;
  previous_purchase_id: string | null;
  flow_type: GatewayFlowType;
}

export interface GatewayPurchasesResponse {
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
  items: GatewayPurchaseItem[];
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
      errorMessage = 'Unauthorized. Please login again.';
    } else if (response.status === 404) {
      errorMessage = 'Purchase not found.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Get purchase by ID - GET /api/v1/admin/purchases/:id
export async function getPurchaseById(purchaseId: string): Promise<Purchase> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/purchases/${purchaseId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<Purchase>(response);
}

// Cache for purchase_id to package_id mapping
const purchaseIdCache = new Map<string, number | null>();

// Get package_id from purchase_id (with caching)
export async function getPackageIdFromPurchaseId(purchaseId: string | null | undefined): Promise<number | null> {
  if (!purchaseId) return null;
  
  // Check cache first
  if (purchaseIdCache.has(purchaseId)) {
    return purchaseIdCache.get(purchaseId) || null;
  }
  
  try {
    const purchase = await getPurchaseById(purchaseId);
    const packageId = purchase.package_id || null;
    // Cache the result
    purchaseIdCache.set(purchaseId, packageId);
    return packageId;
  } catch (error) {
    console.error(`Error fetching package_id for purchase_id ${purchaseId}:`, error);
    // Cache null to avoid repeated failed requests
    purchaseIdCache.set(purchaseId, null);
    return null;
  }
}

// Batch fetch package_ids for multiple purchase_ids
export async function getPackageIdsFromPurchaseIds(purchaseIds: (string | null | undefined)[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  const uniquePurchaseIds = [...new Set(purchaseIds.filter(id => id))] as string[];
  
  // Check cache first
  const uncachedIds: string[] = [];
  for (const id of uniquePurchaseIds) {
    if (purchaseIdCache.has(id)) {
      result.set(id, purchaseIdCache.get(id) || null);
    } else {
      uncachedIds.push(id);
    }
  }
  
  // Fetch uncached purchase_ids in parallel
  if (uncachedIds.length > 0) {
    const promises = uncachedIds.map(async (id) => {
      try {
        const purchase = await getPurchaseById(id);
        const packageId = purchase.package_id || null;
        purchaseIdCache.set(id, packageId);
        return { id, packageId };
      } catch (error) {
        console.error(`Error fetching package_id for purchase_id ${id}:`, error);
        purchaseIdCache.set(id, null);
        return { id, packageId: null };
      }
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ id, packageId }) => {
      result.set(id, packageId);
    });
  }
  
  return result;
}

export interface GetGatewayPurchasesParams {
  page?: number;
  limit?: number;
  user_id?: string;
  display_id?: string;
  status?: 'completed' | 'pending' | 'cancelled';
  start_date?: string;
  end_date?: string;
  flow_type?: GatewayFlowType;
}

// Get gateway purchases (ICICI) - GET /api/v1/admin/gateway-purchases
export async function getGatewayPurchases(
  params: GetGatewayPurchasesParams = {},
): Promise<GatewayPurchasesResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.user_id) query.set('user_id', params.user_id);
  if (params.display_id) query.set('display_id', params.display_id);
  if (params.status) query.set('status', params.status);
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.flow_type) query.set('flow_type', params.flow_type);

  const url = `${API_BASE_URL}/gateway-purchases${query.toString() ? `?${query.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<GatewayPurchasesResponse>(response);
}

/** Reconcile a pending gateway purchase (mark as paid and run commissions). */
export async function reconcileGatewayPurchase(params: {
  purchase_id?: string;
  display_id?: string;
  amount?: number;
  merchant_txn_no?: string;
  txn_id?: string;
  icici_txn_id?: string;
  icici_payment_id?: string;
}): Promise<{ success: boolean; purchase_id: string; message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }
  const url = `${API_BASE_URL}/gateway-purchases/reconcile`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  return handleResponse<{ success: boolean; purchase_id: string; message: string }>(response);
}

