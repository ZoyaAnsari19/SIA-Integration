/**
 * Support / Ticket API
 */

import { apiClient } from './client';

export interface PreQuestion {
  id: number;
  question: string;
  category: string | null;
  sort_order: number;
  fee_rule_code?: string | null;
  /** Fee amount in ₹ when this topic is selected (null if no topic fee). */
  fee_amount?: number | null;
}

export interface SupportTicketListItem {
  id: number;
  pre_question_id: number | null;
  pre_question: string | null;
  subject: string | null;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  last_message: { text: string | null; created_at: string } | null;
}

export interface SupportTicketThread {
  id: number;
  pre_question_id: number | null;
  pre_question: string | null;
  subject: string | null;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  messages: Array<{
    id: number;
    sender_type: 'user' | 'admin';
    sender_user_id: number | null;
    message_text: string | null;
    attachment_urls: Array<{ url: string; type?: string; filename?: string }> | null;
    created_at: string;
  }>;
}

export interface TicketsListResponse {
  items: SupportTicketListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Shape returned by backend /api/v1/support/tickets
interface SupportTicketApiItem {
  id: number | null;
  pre_question_id: number | null;
  pre_question: string | null;
  subject: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_message:
    | {
        text: string | null;
        created_at: string | null;
      }
    | null;
}

export function getPreQuestions(): Promise<{
  items: PreQuestion[];
  /** Amount in ₹ for 2nd+ general tickets (SUPPORT_TICKET rule). Null if not set. */
  general_support_fee_amount?: number | null;
}> {
  return apiClient.get('/support/pre-questions').then((r) => r.data);
}

export function createTicket(body: {
  pre_question_id?: number;
  message_text: string;
  subject?: string;
  attachment_urls?: Array<{ url: string; type?: string; filename?: string }>;
}): Promise<{ ticket_id: number; status: string; created_at: string }> {
  return apiClient.post('/support/tickets', body).then((r) => r.data);
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function safeStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return String(v);
}
function normalizeTicketItem(t: Record<string, unknown>, _index: number): SupportTicketListItem {
  const nested = (t['ticket'] != null && typeof t['ticket'] === 'object' && !Array.isArray(t['ticket'])
    ? t['ticket']
    : t['data'] != null && typeof t['data'] === 'object' && !Array.isArray(t['data'])
      ? t['data']
      : t) as Record<string, unknown>;
  const id = safeNum(nested['id'] ?? nested['Id'] ?? nested['ID'] ?? nested['ticket_id'] ?? nested['ticketId'] ?? t['id'] ?? t['Id'] ?? t['ID'] ?? t['ticket_id'] ?? t['ticketId']) ?? 0;
  const preQuestion = safeStr(nested['pre_question'] ?? nested['preQuestion'] ?? t['pre_question'] ?? t['preQuestion']);
  const subject = safeStr(nested['subject'] ?? nested['Subject'] ?? nested['topic'] ?? t['subject'] ?? t['Subject'] ?? t['topic']);
  const statusVal = safeStr(nested['status'] ?? nested['Status'] ?? t['status'] ?? t['Status']);
  const status = (statusVal && ['open', 'in_progress', 'closed'].includes(statusVal) ? statusVal : 'open') as 'open' | 'in_progress' | 'closed';
  const createdAt = safeStr(nested['created_at'] ?? nested['createdAt'] ?? t['created_at'] ?? t['createdAt']) ?? '';
  const updatedAt = safeStr(nested['updated_at'] ?? nested['updatedAt'] ?? t['updated_at'] ?? t['updatedAt']) ?? '';
  const lm = nested['last_message'] ?? nested['lastMessage'] ?? t['last_message'] ?? t['lastMessage'];
  const preQuestionId = safeNum(
    nested['pre_question_id'] ??
      nested['preQuestionId'] ??
      (t as Record<string, unknown>)['pre_question_id'] ??
      (t as Record<string, unknown>)['preQuestionId'],
  );
  const last_message =
    lm != null && typeof lm === 'object' && !Array.isArray(lm)
      ? {
          text: safeStr((lm as Record<string, unknown>)['text'] ?? (lm as Record<string, unknown>)['message_text']),
          created_at: safeStr((lm as Record<string, unknown>)['created_at']) ?? '',
        }
      : null;
  return {
    id,
    pre_question_id: preQuestionId,
    pre_question: preQuestion,
    subject: subject ?? preQuestion ?? null,
    status,
    created_at: createdAt,
    updated_at: updatedAt,
    last_message,
  };
}

export function getMyTickets(params?: {
  page?: number;
  limit?: number;
  status?: 'open' | 'in_progress' | 'closed';
}): Promise<any> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const status = params?.status;

  return apiClient
    .get('/support/tickets', { params: { page, limit, status } })
    .then((r) => {
      if (typeof window !== 'undefined') {
        console.log('FULL AXIOS RESPONSE (support/tickets):', r);
        console.log('r.data (support/tickets):', r.data);
        try {
          console.log('JSON (support/tickets):', JSON.stringify(r.data));
        } catch (e) {
          console.log('JSON stringify error (support/tickets):', e);
        }
        console.log('r.data.items (support/tickets):', (r as any).data?.items);
        console.log('r.data.items[0] (support/tickets):', (r as any).data?.items?.[0]);
      }

      // TEMP: return raw data unchanged so we can inspect actual shape
      return r.data;
    });
}

export function getTicket(id: number | string): Promise<SupportTicketThread> {
  return apiClient.get(`/support/tickets/${id}`).then((r) => {
    const raw = r.data as Record<string, unknown>;
    // Ensure messages array is always present (backend may have been stripped by schema before fix)
    const messages = Array.isArray(raw?.messages) ? raw.messages : [];
    return { ...raw, messages } as SupportTicketThread;
  });
}

/** Upload for existing ticket (pass ticket_id). */
export function uploadAttachment(
  ticketId: number | string,
  file: File
): Promise<{ url: string; type: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiClient
    .post(`/support/upload?ticket_id=${ticketId}`, form)
    .then((r) => r.data);
}

/** Upload for new ticket (no ticket_id yet). Max 5MB; image, audio, or PDF. */
export function uploadAttachmentForNewTicket(
  file: File
): Promise<{ url: string; type: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiClient.post('/support/upload', form).then((r) => r.data);
}

export function addMessage(
  ticketId: number | string,
  body: { message_text?: string; attachment_urls?: Array<{ url: string; type?: string; filename?: string }> }
): Promise<{
  message_id: number;
  message_text: string | null;
  attachment_urls: unknown;
  created_at: string;
}> {
  return apiClient.post(`/support/tickets/${ticketId}/messages`, body).then((r) => r.data);
}

export function closeTicket(
  ticketId: number | string
): Promise<{ ticket_id: number; status: string; closed_at: string }> {
  return apiClient.post(`/support/tickets/${ticketId}/close`).then((r) => r.data);
}
