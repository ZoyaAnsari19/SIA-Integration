/**
 * Admin Support / Ticket API
 *
 * - Admin runs on 3003, API on 3000 → default (http://localhost:3000/api/v1) is correct; no proxy needed.
 * - NEXT_PUBLIC_API_BASE_URL must point to the API server (3000), not the admin app (3003).
 * - If you run Admin on 3000 and API on 3006, set NEXT_PUBLIC_API_SERVER_ORIGIN=http://localhost:3006 for proxy.
 */
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  if (envUrl.endsWith('/admin')) return envUrl;
  if (envUrl.endsWith('/api/v1')) return `${envUrl}/admin`;
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = (data as { message?: string }).message || message;
    } catch {
      message = response.statusText || `HTTP ${response.status}`;
    }
    throw new Error(message);
  }
  return response.json();
}

export interface AdminTicketListItem {
  id: number;
  user_id: number;
  user: { id: number; display_id: string | null; name: string | null; email: string | null; phone: string | null };
  pre_question_id: number | null;
  pre_question: string | null;
  subject: string | null;
  status: string;
  assigned_to: number | null;
  assigned_to_user: { id: number; name: string | null; email: string | null } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_message: { text: string | null; sender_type: string; created_at: string } | null;
}

export interface AdminTicketsListResponse {
  items: AdminTicketListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminTicketThread {
  id: number;
  user_id: number;
  user: { id: number; display_id: string | null; name: string | null; email: string | null; phone: string | null };
  pre_question_id: number | null;
  pre_question: string | null;
  subject: string | null;
  status: string;
  assigned_to: number | null;
  assigned_to_user: { id: number; name: string | null; email: string | null } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  messages: Array<{
    id: number;
    sender_type: string;
    sender_user_id: number | null;
    message_text: string | null;
    attachment_urls: Array<{ url?: string; type?: string; filename?: string }> | null;
    created_at: string;
  }>;
}

export interface SupportSummary {
  open: number;
  in_progress: number;
  closed: number;
}

export function closeAdminTicket(id: string | number): Promise<{ ticket_id: number; status: string; closed_at: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/tickets/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // Send an explicit empty JSON body so Fastify's JSON parser is happy
    body: JSON.stringify({}),
  }).then((res) => handleResponse<{ ticket_id: number; status: string; closed_at: string }>(res));
}

export interface PreQuestion {
  id: number;
  question: string;
  category: string | null;
  sort_order: number;
  is_active?: boolean;
  fee_rule_code?: string | null;
}

export function getAdminTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
  assigned_to?: string;
  search_name?: string;
  search_id?: string;
   date_from?: string;
   date_to?: string;
}): Promise<AdminTicketsListResponse> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  const q = new URLSearchParams();
  if (params?.page) q.append('page', String(params.page));
  if (params?.limit) q.append('limit', String(params.limit));
  if (params?.status) q.append('status', params.status);
  if (params?.assigned_to) q.append('assigned_to', params.assigned_to);
  if (params?.search_name) q.append('search_name', params.search_name);
  if (params?.search_id) q.append('search_id', params.search_id);
  if (params?.date_from) q.append('date_from', params.date_from);
  if (params?.date_to) q.append('date_to', params.date_to);
  const url = `${API_BASE_URL}/support/tickets${q.toString() ? `?${q}` : ''}`;
  return fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }).then((res) => handleResponse<AdminTicketsListResponse>(res));
}

export function getAdminTicket(id: string | number): Promise<AdminTicketThread> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/tickets/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    const raw = await handleResponse<AdminTicketThread & { messages?: unknown }>(response);
    const messages = Array.isArray(raw?.messages) ? raw.messages : [];
    return { ...raw, messages } as AdminTicketThread;
  });
}

export function assignTicketToMe(id: string | number): Promise<{ ticket_id: number; assigned_to: number; status: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/tickets/${id}/assign`, {
    method: 'POST',
    // No JSON body is sent for this endpoint; avoid Content-Type: application/json
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handleResponse<{ ticket_id: number; assigned_to: number; status: string }>(res));
}

export function addAdminMessage(
  id: string | number,
  body: {
    message_text?: string | null;
    attachment_urls?: Array<{ url: string; type?: string; filename?: string }>;
  }
): Promise<{ message_id: number; created_at: string }> {
  // body.message_text can be null for attachment-only messages
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');

  const payload: {
    message_text: string | null;
    attachment_urls?: Array<{ url: string; type: string; filename: string }>;
  } = {
    message_text: body.message_text ?? null,
  };

  if (Array.isArray(body.attachment_urls) && body.attachment_urls.length > 0) {
    const valid = body.attachment_urls
      .filter((a) => a != null && typeof a.url === 'string' && String(a.url).trim() !== '')
      .map((a) => ({
        url: String(a.url).trim(),
        type: typeof a.type === 'string' && a.type ? a.type : 'voice',
        filename: typeof a.filename === 'string' && a.filename ? a.filename : 'attachment',
      }));
    if (valid.length > 0) {
      payload.attachment_urls = valid;
    }
  }

  const bodyStr = JSON.stringify(payload);
  return fetch(`${API_BASE_URL}/support/tickets/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: bodyStr,
  }).then((res) => handleResponse<{ message_id: number; created_at: string }>(res));
}

export function reassignTicket(
  id: string | number,
  body: { assigned_to: number }
): Promise<{ ticket_id: number; assigned_to: number }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/tickets/${id}/reassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((res) => handleResponse<{ ticket_id: number; assigned_to: number }>(res));
}

export function uploadAdminAttachment(
  ticketId: string | number,
  file: File
): Promise<{ url: string; type: string; filename: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  const uploadUrl = `${API_BASE_URL}/support/upload?ticket_id=${ticketId}`;
  const form = new FormData();
  form.append('file', file);
  return fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store',
  }).then(async (res) => {
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(JSON.parse(errText || '{}').message || res.statusText || 'Upload failed');
    }
    const rawText = await res.text();
    const data = rawText ? (JSON.parse(rawText) as { url?: string; type?: string; filename?: string; data?: { url?: string; type?: string; filename?: string } }) : {};
    const payload = data?.url ? data : (data?.data || {});
    return {
      url: payload.url ?? '',
      type: payload.type ?? '',
      filename: payload.filename ?? '',
    };
  });
}

export function getAdminPreQuestions(): Promise<{ items: PreQuestion[] }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/pre-questions`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).then(async (response) => {
    const raw = await handleResponse<{ items?: PreQuestion[]; data?: { items?: PreQuestion[] } }>(response);
    const items = Array.isArray(raw.items) ? raw.items : Array.isArray((raw as { data?: { items?: PreQuestion[] } }).data?.items) ? (raw as { data: { items: PreQuestion[] } }).data.items : [];
    return { items };
  });
}

export function createPreQuestion(body: {
  question: string;
  category?: string;
  sort_order?: number;
  fee_rule_code?: string | null;
}): Promise<PreQuestion & { created_at: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/pre-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((res) => handleResponse<PreQuestion & { created_at: string }>(res));
}

export function updatePreQuestion(
  id: number,
  body: { question?: string; category?: string; sort_order?: number; is_active?: boolean; fee_rule_code?: string | null }
): Promise<PreQuestion & { updated_at: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/pre-questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((res) => handleResponse<PreQuestion & { updated_at: string }>(res));
}

export function deletePreQuestion(id: number): Promise<{ deleted: boolean }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found. Please login.');
  return fetch(`${API_BASE_URL}/support/pre-questions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handleResponse<{ deleted: boolean }>(res));
}

export async function getSupportSummary(): Promise<SupportSummary> {
  // Derive summary from existing tickets API to avoid relying on a separate summary endpoint.
  // This works consistently in both local and production, and uses the same permissions/filtering.
  const [openRes, inProgressRes, closedRes] = await Promise.all([
    getAdminTickets({ status: 'open', page: 1, limit: 1 }),
    getAdminTickets({ status: 'in_progress', page: 1, limit: 1 }),
    getAdminTickets({ status: 'closed', page: 1, limit: 1 }),
  ]);

  return {
    open: openRes.total ?? 0,
    in_progress: inProgressRes.total ?? 0,
    closed: closedRes.total ?? 0,
  };
}
