'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, X, Send, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { getAuthToken } from '@/lib/api/auth';

type ChatEvent =
  | { event: 'message_delta'; data: { text: string } }
  | { event: 'status'; data: { text: string; tool_name?: string } }
  | { event: 'tool_call'; data: any }
  | { event: 'tool_result'; data: any }
  | { event: 'confirmation_required'; data: { conversation_id: string; confirmation_token: string; tool_name: string; params: any } }
  | { event: 'final'; data: any };

type ChatMsg = { role: 'user' | 'assistant' | 'system'; text: string };
type ChatAttachment = { type: 'image'; url: string };

function formatActionResult(toolName: string | undefined, result: any, debug: boolean): string {
  const tn = String(toolName || '');
  const r = result || {};

  // Default fallbacks
  const details = debug ? `\n\nDetails:\n${JSON.stringify(r, null, 2)}` : '';

  if (tn === 'adminApprovePendingKycs') {
    const s = r?.summary || {};
    const approved = s?.approved ?? 0;
    const failed = s?.failed ?? 0;
    const attempted = s?.attempted ?? 0;
    const ids = Array.isArray(r?.approvals) ? r.approvals.map((a: any) => a?.display_id || a?.user_id).filter(Boolean) : [];
    const top = ids.slice(0, 8).join(', ');
    return [
      `KYC approval done.`,
      `- Approved: ${approved}/${attempted}`,
      `- Failed: ${failed}`,
      top ? `- Users: ${top}${ids.length > 8 ? '…' : ''}` : null,
    ]
      .filter(Boolean)
      .join('\n')
      .trim() + details;
  }

  if (tn === 'adminApproveKyc') {
    const ok = r?.ok ?? true;
    const uid = r?.result?.user_id || r?.user_id;
    return `KYC approved${uid ? ` (user_id ${uid})` : ''}.${details}`.trim();
  }

  if (tn === 'adminApproveWithdrawal' || tn === 'adminApproveWithdrawalsByDate') {
    const s = r?.summary;
    if (s?.approved != null) {
      return `Withdrawals approved: ${s.approved}/${s.attempted || s.approved}.${details}`.trim();
    }
    return `Withdrawal approved.${details}`.trim();
  }

  if (tn === 'adminManageWallet') {
    const res = r?.result || {};
    const main = res?.new_main_balance;
    const spot = res?.new_spot_balance;
    const team = res?.new_team_royalty_balance;
    const lines = ['Wallet updated.'];
    if (main != null) lines.push(`- New main wallet: ₹${main}`);
    if (spot != null) lines.push(`- New spot wallet: ₹${spot}`);
    if (team != null) lines.push(`- New team royalty: ₹${team}`);
    return lines.join('\n') + details;
  }

  // Generic
  if (r?.ok === false) return `Action failed.${details}`.trim();
  return `Done.${details}`.trim();
}

function isTableLike(text: string): boolean {
  // Lightweight heuristic: pipe-table lines or dashed separators.
  // We keep this conservative to avoid turning normal text into pre blocks.
  const t = (text || '').trim();
  if (!t) return false;
  const lines = t.split('\n');
  let pipeLines = 0;
  for (const ln of lines.slice(0, 12)) {
    const s = ln.trim();
    if (!s) continue;
    if (s.includes('|')) pipeLines += 1;
    if (/^\|?[-\s|]{6,}\|?$/.test(s)) return true;
  }
  return pipeLines >= 2;
}

type ChatFabMode = 'floating' | 'embedded';
type ChatFabProps = {
  defaultOpen?: boolean;
  mode?: ChatFabMode;
  className?: string;
  conversationId?: string;
  onConversationIdChange?: (id: string) => void;
  onMsgsChange?: (msgs: ChatMsg[]) => void;
};

function toolToStatus(toolName: string | undefined): string {
  if (!toolName) return 'Aapka request process ho raha hai…';
  const m: Record<string, string> = {
    getUserProfile: 'Aapka profile check kiya ja raha hai…',
    getWalletSummary: 'Aapka current balance check kiya ja raha hai…',
    getIncomeSummary: 'Income calculate ki ja rahi hai…',
    getUserIncome: 'Income history check ki ja rahi hai…',
    getUserWithdrawals: 'Withdrawal history check ki ja rahi hai…',
    getWithdrawalCounts: 'Withdrawal status check kiya ja raha hai…',
    getUserTransactions: 'Ledger entries check ki ja rahi hain…',
    getPendingCommissions: 'Pending commissions check ki ja rahi hain…',
    getUserNetwork: 'Team network load kiya ja raha hai…',
    getNetworkSize: 'Team size calculate ho raha hai…',
    getDirectReferralCount: 'Direct referrals count ho raha hai…',
    getUserLevelProgress: 'Level progress calculate ho raha hai…',
    diagnoseMissingCommission: 'Commission issue analyze ho raha hai…',
    getUserMigrationContext: 'Legacy/migration context check ho raha hai…',
    getUserLegacySpotSummary: 'Legacy (Excel) data analyze ho raha hai…',
    compareLegacySpotVsLedgerSpot: 'Legacy vs ledger compare ho raha hai…',
    explainPurchaseIncomeMismatch: 'Mismatch ka root cause nikal raha hu…',
    getNextWithdrawalDate: 'Next withdrawal date check ho raha hai…',
    getEligibleWithdrawalAmount: 'Eligible withdrawal amount calculate ho raha hai…',
  };
  return m[toolName] || 'Data analysis ho raha hai…';
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40" />
    </span>
  );
}

function parseSseChunk(buffer: string): { events: ChatEvent[]; rest: string } {
  const events: ChatEvent[] = [];
  let idx = 0;
  while (true) {
    const sep = buffer.indexOf('\n\n', idx);
    if (sep === -1) break;
    const block = buffer.slice(idx, sep);
    idx = sep + 2;

    let eventName = 'message';
    let dataStr = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim();
      if (line.startsWith('data:')) dataStr += line.slice('data:'.length).trim();
    }
    if (!dataStr) continue;
    try {
      const data = JSON.parse(dataStr);
      events.push({ event: eventName as any, data } as ChatEvent);
    } catch {
      // ignore
    }
  }
  return { events, rest: buffer.slice(idx) };
}

async function streamSse(opts: { url: string; token: string; body: any; onEvent: (ev: ChatEvent) => void }) {
  const debug = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';
  if (debug) {
    console.log('[chat] stream start', { url: opts.url, body: opts.body });
  }
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify(opts.body),
  });
  if (!res.ok || !res.body) {
    let detail = '';
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        detail = j?.detail || j?.error || j?.message || JSON.stringify(j);
      } else {
        detail = await res.text();
      }
    } catch {
      // ignore
    }
    throw new Error(`SSE failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buf);
    buf = rest;
    for (const ev of events) {
      if (debug) console.log('[chat] sse event', ev);
      opts.onEvent(ev);
    }
  }
}

async function uploadImage(opts: { baseUrl: string; token: string; file: File }): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', opts.file);
  const res = await fetch(`${opts.baseUrl}/chat/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json();
}

export function ChatFab(props: ChatFabProps) {
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_CHAT_ENGINE_URL || 'http://localhost:3004', []);
  const mode: ChatFabMode = props.mode || 'floating';
  const [open, setOpen] = useState(() => props.defaultOpen ?? false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [pendingConfirm, setPendingConfirm] = useState<{ conversationId: string; token: string; toolName: string; params: any } | null>(null);
  const autoConfirmInFlightRef = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // External control: when parent selects a conversation, load its turns.
  useEffect(() => {
    const nextId = props.conversationId;
    if (nextId === undefined) return;
    setConversationId(nextId || undefined);
    setPendingConfirm(null);
    setStatusText(null);
    setBusy(false);
    if (!nextId) {
      setMsgs([]);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMsgs([{ role: 'system', text: 'Please login again (missing auth_token).' }]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/chat/conversations/${encodeURIComponent(nextId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to load chat (${res.status})`);
        const data = await res.json();
        const turns = (data?.turns || []) as Array<{ user?: string; assistant?: string }>;
        const rebuilt: ChatMsg[] = [];
        for (const t of turns) {
          if (t.user) rebuilt.push({ role: 'user', text: String(t.user) });
          if (t.assistant) rebuilt.push({ role: 'assistant', text: String(t.assistant) });
        }
        setMsgs(rebuilt);
      } catch (e: any) {
        setMsgs([{ role: 'system', text: e?.message || 'Failed to load chat' }]);
      }
    })();
  }, [props.conversationId, baseUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open, pendingConfirm]);

  useEffect(() => {
    props.onMsgsChange?.(msgs);
  }, [msgs]);

  async function onSend(text: string) {
    const token = getAuthToken();
    if (!token) {
      setMsgs((m) => [...m, { role: 'system', text: 'Please login again (missing auth_token).' }]);
      return;
    }
    setBusy(true);
    setStatusText('Aapka request process ho raha hai…');
    const msgText = text.trim() || (pendingAttachments.length ? 'Please analyze the attached image.' : text);
    setMsgs((m) => [...m, { role: 'user', text: msgText }]);
    try {
      let assistantText = '';
      await streamSse({
        url: `${baseUrl}/chat/stream`,
        token,
        body: { message: msgText, conversation_id: conversationId, attachments: pendingAttachments },
        onEvent: (ev) => {
          if (ev.event === 'status') {
            setStatusText(ev.data.text || toolToStatus(ev.data.tool_name));
          }
          if (ev.event === 'tool_result') {
            // Back-compat: if backend didn't send status, infer from tool name.
            const tn = (ev.data?.tool_name || ev.data?.toolName || ev.data?.name) as string | undefined;
            if (tn) setStatusText(toolToStatus(tn));
          }
          if (ev.event === 'message_delta') {
            assistantText = ev.data.text || assistantText;
            setStatusText(null);
            setMsgs((m) => {
              const last = m[m.length - 1];
              if (last?.role === 'assistant') return [...m.slice(0, -1), { role: 'assistant', text: assistantText }];
              return [...m, { role: 'assistant', text: assistantText }];
            });
          }
          if (ev.event === 'confirmation_required') {
            setConversationId(ev.data.conversation_id);
            props.onConversationIdChange?.(ev.data.conversation_id);
            const toolName = String(ev.data.tool_name || '');
            // Admin UX: auto-confirm *approve* actions (no typing / no extra clicks).
            // Keep confirmation UI for high-risk actions like wallet manage / rejects.
            const autoConfirmTools = new Set<string>([
              'adminApproveKyc',
              'adminApprovePendingKycs',
              'adminApproveWithdrawal',
              'adminApproveWithdrawalsByDate',
            ]);
            if (autoConfirmTools.has(toolName) && !autoConfirmInFlightRef.current) {
              autoConfirmInFlightRef.current = true;
              setStatusText('Approval process chal raha hai…');
              // Fire-and-forget; the streamConfirm result will append tool_result.
              onConfirmDecision(true, {
                conversationId: ev.data.conversation_id,
                token: ev.data.confirmation_token,
                toolName,
                params: ev.data.params,
              }).finally(() => {
                autoConfirmInFlightRef.current = false;
              });
            } else {
              setPendingConfirm({
                conversationId: ev.data.conversation_id,
                token: ev.data.confirmation_token,
                toolName,
                params: ev.data.params,
              });
            }
          }
          if (ev.event === 'final') {
            if (ev.data?.conversation_id) {
              setConversationId(ev.data.conversation_id);
              props.onConversationIdChange?.(ev.data.conversation_id);
            }
            setStatusText(null);
          }
        },
      });
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'system', text: e?.message || 'Chat failed' }]);
    } finally {
      setBusy(false);
      setStatusText(null);
      setPendingAttachments([]);
    }
  }

  async function onConfirmDecision(
    confirm: boolean,
    override?: { conversationId: string; token: string; toolName: string; params: any }
  ) {
    const token = getAuthToken();
    const pc = override || pendingConfirm;
    if (!token || !pc) return;
    setBusy(true);
    const debug = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';
    try {
      setMsgs((m) => [...m, { role: 'user', text: confirm ? 'Yes' : 'No' }]);
      await streamSse({
        url: `${baseUrl}/chat/confirm`,
        token,
        body: { conversation_id: pc.conversationId, confirmation_token: pc.token, confirm },
        onEvent: (ev) => {
          if (ev.event === 'tool_result') {
            const toolName = (ev.data?.tool_name || pc.toolName) as string | undefined;
            const msg = formatActionResult(toolName, ev.data?.result, debug);
            setMsgs((m) => [...m, { role: 'assistant', text: msg }]);
          }
          if (ev.event === 'final' && confirm === false) {
            setMsgs((m) => [...m, { role: 'assistant', text: 'Okay — cancelled.' }]);
          }
        },
      });
      setPendingConfirm(null);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'system', text: e?.message || 'Confirm failed' }]);
    } finally {
      setBusy(false);
      setStatusText(null);
    }
  }

  async function onPickFile(file: File) {
    const token = getAuthToken();
    if (!token) return;
    setBusy(true);
    try {
      const up = await uploadImage({ baseUrl, token, file });
      if (up?.url) setPendingAttachments([{ type: 'image', url: up.url }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'system', text: e?.message || 'Upload failed' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {mode === 'floating' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)] hover:bg-emerald-500 transition-colors"
          aria-label="Open AI assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      ) : null}

      {open ? (
        <div
          className={[
            mode === 'floating'
              ? 'fixed bottom-6 right-6 z-[60] h-[70vh] max-h-[640px] min-h-[520px] w-[92vw] max-w-[420px]'
              : 'w-full max-w-[960px] h-[75vh] min-h-[560px] mx-auto',
            'flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]',
            props.className || '',
          ].join(' ')}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-600" />
              <div className="text-sm font-semibold">SIA Admin Assistant</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-black/5" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto px-4 py-3">
            <div className="space-y-3">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={[
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                      m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-black/5 text-black',
                      m.role === 'system' ? 'bg-amber-500/10 text-amber-900' : '',
                    ].join(' ')}
                  >
                    {m.role !== 'user' && isTableLike(m.text) ? (
                      <pre className="whitespace-pre-wrap font-mono text-[12px] leading-5">{m.text}</pre>
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              ))}

              {busy && statusText ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-black/5 px-3 py-2 text-sm text-black">
                    <div className="flex items-center gap-2">
                      <TypingDots />
                      <span className="text-black/70">{statusText}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {pendingConfirm ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <div className="font-semibold text-emerald-900">Confirmation required</div>
                  <div className="mt-1 text-black/70">
                    Tool: <span className="font-mono">{pendingConfirm.toolName}</span>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/5 p-2 text-xs text-black/70">
                    {JSON.stringify(pendingConfirm.params, null, 2)}
                  </pre>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onConfirmDecision(true)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfirmDecision(false)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-black/5 disabled:opacity-60"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-black/10 p-3">
            {pendingAttachments.length ? (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <div>1 image attached</div>
                <button
                  type="button"
                  onClick={() => setPendingAttachments([])}
                  className="rounded-md px-2 py-1 text-emerald-900 hover:bg-emerald-100"
                >
                  Remove
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && (input.trim() || pendingAttachments.length)) {
                      const t = input.trim();
                      setInput('');
                      onSend(t);
                    }
                  }
                }}
                placeholder="Type a message…"
                className="h-10 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={busy}
              />

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white hover:bg-black/5 disabled:opacity-60"
                aria-label="Attach image"
              >
                <ImageIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (busy || !input.trim()) return;
                  const t = input.trim();
                  setInput('');
                  onSend(t);
                }}
                disabled={busy || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 text-[11px] text-black/40">
              Dev tip: <span className="font-mono">!tool getSystemStats {"{}"}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

