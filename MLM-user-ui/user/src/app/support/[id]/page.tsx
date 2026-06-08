"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import {
  getTicket,
  addMessage,
  uploadAttachment,
  closeTicket,
  type SupportTicketThread,
} from "@/lib/api/support";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Send,
  Paperclip,
  X,
  Lock,
  Image as ImageIcon,
  Mic,
  Square,
} from "lucide-react";
import { MessageAttachment } from "@/components/support/MessageAttachment";

interface PendingAttachment {
  url: string;
  type: string;
  filename: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function SupportTicketPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [ticket, setTicket] = useState<SupportTicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messageText, setMessageText] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!id || id === "undefined" || id === "null") {
      router.replace("/support");
      return;
    }
    setLoading(true);
    setError(null);
    getTicket(id)
      .then(setTicket)
      .catch((e: unknown) => {
        setError((e as { userMessage?: string })?.userMessage ?? "Failed to load ticket");
        setTicket(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const refreshTicket = async () => {
    if (!id) return;
    try {
      const data = await getTicket(id);
      setTicket(data);
    } catch {
      // keep existing ticket on refetch error
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingFile(true);
    try {
      const res = await uploadAttachment(id, file);
      setPendingAttachments((prev) => [...prev, { url: res.url, type: res.type, filename: res.filename }]);
    } catch (err: unknown) {
      setSendError((err as { userMessage?: string })?.userMessage ?? "Upload failed");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const removePendingAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const startRecording = useCallback(async () => {
    if (!id) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        setUploadingFile(true);
        setSendError(null);
        try {
          const res = await uploadAttachment(id, file);
          setPendingAttachments((prev) => [...prev, { url: res.url, type: res.type, filename: res.filename }]);
        } catch (err: unknown) {
          setSendError((err as { userMessage?: string })?.userMessage ?? "Voice upload failed");
        } finally {
          setUploadingFile(false);
        }
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      setSendError("Microphone access is needed to record voice.");
    }
  }, [id]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text && pendingAttachments.length === 0) {
      setSendError("Enter a message or add an attachment.");
      return;
    }
    if (!id) return;
    setSendLoading(true);
    setSendError(null);
    const attachmentsToSend = pendingAttachments.length > 0 ? pendingAttachments.map((a) => ({ url: a.url, type: a.type, filename: a.filename })) : undefined;
    try {
      const res = await addMessage(id, {
        message_text: text || undefined,
        attachment_urls: attachmentsToSend,
      });
      setMessageText("");
      setPendingAttachments([]);
      // Show new message immediately from response, then refetch to stay in sync
      if (ticket && res?.message_id != null) {
        setTicket({
          ...ticket,
          messages: [
            ...(Array.isArray(ticket.messages) ? ticket.messages : []),
            {
              id: res.message_id,
              sender_type: "user" as const,
              sender_user_id: null,
              message_text: (res.message_text ?? text) || null,
              attachment_urls: Array.isArray(res.attachment_urls) ? res.attachment_urls : (attachmentsToSend ?? null),
              created_at: res.created_at ?? new Date().toISOString(),
            },
          ],
        });
      }
      await refreshTicket();
    } catch (err: unknown) {
      setSendError((err as { userMessage?: string })?.userMessage ?? "Failed to send message");
    } finally {
      setSendLoading(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!id || !confirm("Close this ticket? You can still view the conversation.")) return;
    setCloseLoading(true);
    try {
      await closeTicket(id);
      refreshTicket();
    } catch (err: unknown) {
      setSendError((err as { userMessage?: string })?.userMessage ?? "Failed to close ticket");
    } finally {
      setCloseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Link href="/support" className="inline-flex items-center gap-2 text-[var(--brand-blue)] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Support
        </Link>
        <Card>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error ?? "Ticket not found."}</span>
          </div>
        </Card>
      </div>
    );
  }

  const isClosed = ticket.status === "closed";
  const statusColor =
    ticket.status === "open"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      : ticket.status === "in_progress"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        : "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--brand-blue)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Support</span>
          </Link>
          <H1 className="!text-xl">Ticket #{ticket.id}</H1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {ticket.status === "open"
              ? "Open"
              : ticket.status === "in_progress"
                ? "In Progress"
                : "Closed"}
          </span>
        </div>
        {!isClosed && (
          <button
            type="button"
            onClick={handleCloseTicket}
            disabled={closeLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {closeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Close ticket
          </button>
        )}
      </div>

      <Card padding="none">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar-hover)]">
          <p className="text-sm text-[var(--text-muted)]">
            {ticket.pre_question && <span>Topic: {ticket.pre_question}</span>}
            {ticket.subject && (
              <span className={ticket.pre_question ? " ml-2" : ""}>Subject: {ticket.subject}</span>
            )}
            {!ticket.pre_question && !ticket.subject && <span>No subject</span>}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Created {formatDate(ticket.created_at)}
          </p>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
          {(Array.isArray(ticket?.messages) ? ticket.messages : []).map((m, idx) => (
            <div
              key={m?.id ?? `msg-${idx}`}
              className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2 ${
                  m.sender_type === "user"
                    ? "bg-[var(--brand-blue)] text-white"
                    : "bg-[var(--sidebar-hover)] border border-[var(--border)]"
                }`}
              >
                {m.message_text && <p className="text-sm whitespace-pre-wrap">{m.message_text}</p>}
            {(() => {
              const raw = (m as any).attachment_urls;
              const singleUrl = (m as any).attachment_url as string | undefined;
              const singleType = (m as any).attachment_type as string | undefined;
              const singleFilename = (m as any).attachment_filename as string | undefined;

              const attachments: Array<{ url?: string; type?: string; filename?: string }> = [];
              if (Array.isArray(raw) && raw.length > 0) {
                attachments.push(...raw);
              } else if (singleUrl) {
                attachments.push({ url: singleUrl, type: singleType, filename: singleFilename });
              }

              if (attachments.length === 0) return null;

              return (
                <div className="mt-2 space-y-2">
                  {attachments.map((att, i) => (
                    <MessageAttachment
                      key={att.url || `${att.filename ?? "attachment"}-${i}`}
                      attachmentUrl={att.url ?? null}
                      attachmentType={att.type ?? null}
                      filename={att.filename ?? null}
                    />
                  ))}
                </div>
              );
            })()}
                <p
                  className={`text-xs mt-1 ${
                    m.sender_type === "user" ? "text-white/80" : "text-[var(--text-muted)]"
                  }`}
                >
                  {m.sender_type === "admin" ? "Support" : "You"} ·{" "}
                  {formatDate(m.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {!isClosed && (
          <>
            {sendError && (
              <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {sendError}
              </div>
            )}

            {pendingAttachments.length > 0 && (
              <div className="mx-4 mt-2 flex flex-wrap gap-2">
                {pendingAttachments.map((a) => (
                  <span
                    key={a.url}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--sidebar-hover)] px-2 py-1 text-xs"
                  >
                    {a.type === "image" ? <ImageIcon className="h-3 w-3" /> : a.type === "voice" || a.type === "audio" ? <Mic className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
                    {a.filename}
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(a.url)}
                      className="text-[var(--text-muted)] hover:text-red-500"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border)] flex gap-2 flex-wrap items-center">
              <input
                type="file"
                id="support-file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,audio/webm,audio/ogg,audio/mp4,audio/mpeg,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploadingFile || isRecording}
              />
              <label
                htmlFor="support-file"
                className="flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] cursor-pointer hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
                title="Add image, audio, or PDF (max 5MB)"
              >
                {uploadingFile ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Paperclip className="h-5 w-5 text-[var(--text-muted)]" />
                )}
              </label>
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={uploadingFile}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
                  title="Record voice message"
                >
                  <Mic className="h-5 w-5 text-[var(--text-muted)]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  title="Stop recording"
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              )}
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <button
                type="submit"
                disabled={sendLoading || (messageText.trim() === "" && pendingAttachments.length === 0)}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--brand-blue)] text-white disabled:opacity-50"
                title="Send"
              >
                {sendLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          </>
        )}

        {isClosed && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--sidebar-hover)] text-center text-sm text-[var(--text-muted)]">
            This ticket is closed. You can still view the conversation.
          </div>
        )}
      </Card>
    </div>
  );
}
