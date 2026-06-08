"use client";

import { ChatFab } from "@/components/chat/ChatFab";
import { useEffect, useMemo, useState } from "react";
import { getAuthToken } from "@/lib/api/client";
import { Edit } from "lucide-react";

type Conv = {
  conversation_id: string;
  title: string;
  updated_at: number;
  created_at: number;
  message_count: number;
};

export default function AiAssistantPage() {
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_CHAT_ENGINE_URL || "http://localhost:3004", []);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [renamingId, setRenamingId] = useState<string>("");
  const [renameText, setRenameText] = useState<string>("");

  async function refresh() {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch(`${baseUrl}/chat/conversations?limit=25`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as Conv[];
    setConvs(data || []);
  }

  async function renameConversation(conversationId: string, title: string) {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch(`${baseUrl}/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      console.error("[chat] rename failed", await res.text());
      return;
    }
    await refresh();
  }

  useEffect(() => {
    refresh();
  }, []);

  function formatDate(ts: number) {
    if (!ts) return "";
    try {
      return new Date(ts * 1000).toLocaleString("en-IN", { dateStyle: "medium" });
    } catch {
      return "";
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="text-xl font-semibold">SIA AI Assistant</div>
        <div className="mt-1 text-sm text-white/60">
          Ask anything about your package, wallet, withdrawals, commissions, or team.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <ChatFab
          mode="embedded"
          defaultOpen
          conversationId={activeId}
          onConversationIdChange={(id) => {
            setActiveId(id);
            refresh();
          }}
          className="shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        />

        <div className="h-[75vh] min-h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[var(--card-bg)] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold">Recent Chats</div>
            <button
              type="button"
              onClick={() => setActiveId("")}
              className="rounded-lg border border-white/10 bg-[var(--card-bg)] px-2.5 py-1 text-xs font-semibold hover:bg-white/5"
            >
              New
            </button>
          </div>

          <div className="max-h-full overflow-auto p-2">
            {convs.length === 0 ? (
              <div className="p-3 text-sm text-white/60">No chats yet.</div>
            ) : (
              <div className="space-y-1">
                {convs.map((c) => {
                  const isActive = activeId === c.conversation_id;
                  return (
                    <div
                      key={c.conversation_id}
                      className={[
                        "w-full rounded-xl px-3 py-2 text-left transition-colors",
                        isActive ? "bg-white/5 ring-1 ring-white/10" : "hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renamingId === c.conversation_id ? (
                          <form
                            className="flex-1"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const t = renameText.trim();
                              if (!t) return;
                              await renameConversation(c.conversation_id, t);
                              setRenamingId("");
                              setRenameText("");
                            }}
                          >
                            <input
                              autoFocus
                              value={renameText}
                              onChange={(e) => setRenameText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setRenamingId("");
                                  setRenameText("");
                                }
                              }}
                              className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="Rename chat…"
                            />
                            <div className="mt-1 text-[11px] text-white/50">Enter = save · Esc = cancel</div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveId(c.conversation_id)}
                            className="flex-1 text-left"
                          >
                            <div className="text-sm font-medium text-white">{c.title || "Chat"}</div>
                            <div className="mt-0.5 flex items-center justify-between text-xs text-white/50">
                              <span>{formatDate(c.updated_at || c.created_at)}</span>
                              <span>{c.message_count || 0} msgs</span>
                            </div>
                          </button>
                        )}

                        {renamingId !== c.conversation_id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(c.conversation_id);
                              setRenameText(c.title || "");
                            }}
                            className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white"
                            aria-label="Rename chat"
                            title="Rename"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

