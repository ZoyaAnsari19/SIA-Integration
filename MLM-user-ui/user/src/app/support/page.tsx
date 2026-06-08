"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import {
  getPreQuestions,
  getMyTickets,
  createTicket,
  uploadAttachmentForNewTicket,
  type PreQuestion,
  type SupportTicketListItem,
} from "@/lib/api/support";
import { MessageCircle, Plus, Inbox, Loader2, AlertCircle, Paperclip, X } from "lucide-react";

type View = "list" | "new";
type StatusFilter = "all" | "open" | "in_progress" | "closed";

export default function SupportPage() {
  const [view, setView] = useState<View>("list");
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preQuestions, setPreQuestions] = useState<PreQuestion[]>([]);
  const [generalSupportFeeAmount, setGeneralSupportFeeAmount] = useState<number | null>(null);
  const [preQuestionsLoading, setPreQuestionsLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formPreQuestionId, setFormPreQuestionId] = useState<string>("");
  const [formSubject, setFormSubject] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ url: string; type: string; filename: string }>>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getMyTickets({
          page,
          limit,
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        if (cancelled) return;
        setTickets(res.items ?? []);
        setTotal(typeof res.total === "number" ? res.total : 0);
        setTotalPages(typeof res.total_pages === "number" ? res.total_pages : 0);
      } catch (e: unknown) {
        if (!cancelled) {
          setError((e as { userMessage?: string })?.userMessage ?? "Failed to load tickets");
          setTickets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [page, limit, statusFilter]);

  useEffect(() => {
    if (view !== "new") return;
    setPreQuestionsLoading(true);
    getPreQuestions()
      .then((r) => {
        setPreQuestions(r.items || []);
        setGeneralSupportFeeAmount(r.general_support_fee_amount ?? null);
      })
      .catch(() => setPreQuestions([]))
      .finally(() => setPreQuestionsLoading(false));
  }, [view]);

  const handleNewTicketFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setCreateError(null);
    try {
      const res = await uploadAttachmentForNewTicket(file);
      setPendingAttachments((prev) => [...prev, { url: res.url, type: res.type, filename: res.filename }]);
    } catch (err: unknown) {
      setCreateError((err as { message?: string })?.message ?? "File upload failed. Max 5MB; image, audio, or PDF.");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const removeNewTicketAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = formMessage.trim();
    if (!msg) {
      setCreateError("Please enter your message.");
      return;
    }
    if (formPreQuestionId === "") {
      setCreateError("Please select a topic.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await createTicket({
        pre_question_id: Number(formPreQuestionId),
        subject: formSubject.trim() || undefined,
        message_text: msg,
        attachment_urls: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      });
      setFormSubject("");
      setFormMessage("");
      setFormPreQuestionId("");
      setPendingAttachments([]);
      setView("list");
      if (res.ticket_id != null) {
        window.location.href = `/support/${res.ticket_id}`;
      }
    } catch (e: unknown) {
      setCreateError((e as { userMessage?: string })?.userMessage ?? "Failed to create ticket");
    } finally {
      setCreateLoading(false);
    }
  };

  const formatDate = (value: string | null | undefined): string => {
    if (!value) return "—";
    const d = new Date(value);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  const statusLabel = (s: string | null | undefined) => {
    if (!s) return "—";
    switch (s) {
      case "open":
        return "Open";
      case "in_progress":
        return "In Progress";
      case "closed":
        return "Closed";
      default:
        return s;
    }
  };

  const statusColor = (s: string | null | undefined) => {
    if (!s) return "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400";
    switch (s) {
      case "open":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "closed":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <H1>Support</H1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-[var(--brand-blue)] text-white"
                : "bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--sidebar-hover)]"
            }`}
          >
            <Inbox className="h-4 w-4" />
            My Tickets
          </button>
          <button
            type="button"
            onClick={() => setView("new")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === "new"
                ? "bg-[var(--brand-blue)] text-white"
                : "bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--sidebar-hover)]"
            }`}
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>
      </div>

      {view === "list" && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm text-[var(--text-muted)]">Status:</span>
            {(["all", "open", "in_progress", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  statusFilter === s
                    ? "bg-[var(--brand-blue)] text-white"
                    : "bg-[var(--sidebar-hover)] text-[var(--text-body)] hover:bg-[var(--border)]"
                }`}
              >
                {s === "all" ? "All" : statusLabel(s)}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tickets yet.</p>
              <button
                type="button"
                onClick={() => setView("new")}
                className="mt-2 text-[var(--brand-blue)] font-medium hover:underline"
              >
                Create your first ticket
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 pr-4 text-sm font-semibold text-[var(--text-muted)]">ID</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-[var(--text-muted)]">Subject / Topic</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-[var(--text-muted)]">Status</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-[var(--text-muted)]">Updated</th>
                    <th className="pb-2 text-sm font-semibold text-[var(--text-muted)]" />
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, index) => (
                    <tr key={t.id != null && t.id !== 0 ? `ticket-${t.id}` : `ticket-row-${index}`} className="border-b border-[var(--border)] hover:bg-[var(--sidebar-hover)]">
                      <td className="py-3 pr-4 text-sm font-medium">{t.id != null && t.id !== 0 ? `#${t.id}` : "—"}</td>
                      <td className="py-3 pr-4">
                        <span className="font-medium">{t.subject || t.pre_question || "No subject"}</span>
                        {t.last_message?.text && (
                          <p className="text-sm text-[var(--text-muted)] truncate max-w-[200px] mt-0.5">
                            {t.last_message.text}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">
                        {formatDate(t.updated_at)}
                      </td>
                      <td className="py-3">
                        {t.id != null && t.id !== 0 ? (
                          <Link
                            href={`/support/${t.id}`}
                            className="text-[var(--brand-blue)] font-medium hover:underline"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Page {page} of {totalPages} ({total} ticket{total !== 1 ? "s" : ""})
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  Per page:
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[var(--text-strong)]"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {view === "new" && (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-strong)] mb-4">New support ticket</h2>
          <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">Support fee information</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                Kuch <span className="font-medium">special topics</span> (jaise name / mobile / email change, commission analysis,
                profile correction, banking issues) par <span className="font-medium">support fee</span> lag sakti hai. Aisa topic
                choose karne par ticket create hote hi fee aapke wallet se deduct ho sakti hai.
              </li>
              <li>
                Jinke liye koi special topic-fee set nahi hai, un <span className="font-medium">general tickets ka pehla ticket free</span>{" "}
                hai. Usi user ke 2nd aur uske baad ke general tickets par{" "}
                <span className="font-medium">support fee</span> lag sakti hai (agar admin ne rule configure kiya ho).
              </li>
            </ul>
          </div>
          {createError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}
          <form onSubmit={handleCreateTicket} className="space-y-4 max-w-xl">
            <div>
              <label htmlFor="pre_question" className="block text-sm font-medium text-[var(--text-body)] mb-1">
                Topic <span className="text-red-500">*</span>
              </label>
              <select
                id="pre_question"
                value={formPreQuestionId}
                onChange={(e) => setFormPreQuestionId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--text-strong)]"
                disabled={preQuestionsLoading}
                required
              >
                <option value="">-- Select topic --</option>
                {preQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.question}
                  </option>
                ))}
              </select>
              {formPreQuestionId !== "" && (() => {
                const selected = preQuestions.find((q) => q.id === Number(formPreQuestionId));
                const amount = selected?.fee_amount ?? null;
                if (amount != null && amount > 0) {
                  return (
                    <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
                      <span className="font-medium">Is topic par ₹{amount.toLocaleString("en-IN")} fees lagti hai.</span>{" "}
                      Ticket create karte hi ye amount aapke wallet se deduct ho jayegi.
                    </div>
                  );
                }
                return (
                  <div className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                    Is topic par koi topic-specific fee nahi hai. Pehla ticket free hai. 2nd aur uske baad ke tickets par
                    support fee lag sakti hai
                    {generalSupportFeeAmount != null && generalSupportFeeAmount > 0
                      ? ` (₹${generalSupportFeeAmount.toLocaleString("en-IN")}).`
                      : " (agar admin ne rule configure kiya ho)."}
                  </div>
                );
              })()}
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-[var(--text-body)] mb-1">
                Subject (optional)
              </label>
              <input
                id="subject"
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Brief subject"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--text-strong)]"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-[var(--text-body)] mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                rows={5}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-[var(--text-strong)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                id="new-ticket-file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,audio/webm,audio/ogg,audio/mp4,audio/mpeg,application/pdf"
                className="hidden"
                onChange={handleNewTicketFileSelect}
                disabled={uploadingFile}
              />
              <label
                htmlFor="new-ticket-file"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-body)] cursor-pointer hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
              >
                {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                Attach file (image, audio, or PDF, max 5MB)
              </label>
              {pendingAttachments.length > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {pendingAttachments.length} file{pendingAttachments.length !== 1 ? "s" : ""} attached
                </span>
              )}
            </div>
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingAttachments.map((a) => (
                  <span
                    key={a.url}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--sidebar-hover)] px-2 py-1 text-xs"
                  >
                    {a.filename}
                    <button
                      type="button"
                      onClick={() => removeNewTicketAttachment(a.url)}
                      className="text-[var(--text-muted)] hover:text-red-500"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={createLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-white font-medium disabled:opacity-50"
            >
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              Submit ticket
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
