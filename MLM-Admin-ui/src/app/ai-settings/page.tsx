"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthToken } from "@/lib/api/auth";
import {
  Settings as SettingsIcon,
  Wrench,
  Activity,
  CheckCircle2,
  MessageSquare,
  Users,
  Timer,
  Shield,
  User as UserIcon,
} from "lucide-react";

type RoleSettings = { daily_limit: number; read: boolean; write: boolean };
type AiSettingsResp = {
  settings: { admin: RoleSettings; user: RoleSettings };
  stats: {
    total_questions_30d: number;
    total_questions_today: number;
    active_users_30d: number;
    active_users_today: number;
    avg_response_ms: number;
    enabled_tools_count: number;
  };
  model: string;
};

type AiTool = {
  name: string;
  description: string;
  kind: "read" | "write";
  enabled: boolean;
  audience?: "admin" | "user" | "both";
  category?: string;
};
type AiToolsResp = { items: AiTool[]; count: number; model: string };

type Tab = "settings" | "tools" | "usage";

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return "0";
  return Number(n).toLocaleString("en-IN");
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-5 py-5 shadow-sm">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-bold text-slate-800 tabular-nums">{value}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-100">
        {icon}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-slate-200"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

function LimitCard({
  title,
  role,
  data,
  onSave,
  saving,
  saved,
}: {
  title: string;
  role: "admin" | "user";
  data: RoleSettings;
  saving: boolean;
  saved: boolean;
  onSave: (next: RoleSettings) => void;
}) {
  const [limit, setLimit] = useState<number>(data.daily_limit);
  const [read, setRead] = useState<boolean>(data.read);
  const [write, setWrite] = useState<boolean>(data.write);

  useEffect(() => {
    setLimit(data.daily_limit);
    setRead(data.read);
    setWrite(data.write);
  }, [data.daily_limit, data.read, data.write]);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">{limit}</div>
          <div className="text-xs text-slate-500">daily question limit</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-100">
          {role === "admin" ? <Shield className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Limit</label>
        <input
          type="number"
          min={0}
          max={10000}
          value={limit}
          onChange={(e) => setLimit(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))}
          className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mt-3 flex items-center gap-4">
          <Toggle label="Read" checked={read} onChange={setRead} />
          <Toggle label="Write" checked={write} onChange={setWrite} />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({ daily_limit: limit, read, write })}
          className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60`}
        >
          {saving ? "Saving…" : saved ? (
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Saved</span>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}

export default function AiSettingsPage() {
  const baseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_CHAT_ENGINE_URL || "http://localhost:3004",
    []
  );

  const [tab, setTab] = useState<Tab>("settings");
  const [data, setData] = useState<AiSettingsResp | null>(null);
  const [tools, setTools] = useState<AiToolsResp | null>(null);
  const [toolAudience, setToolAudience] = useState<"all" | "admin" | "user">("all");
  const [loadErr, setLoadErr] = useState<string>("");
  const [savingRole, setSavingRole] = useState<"admin" | "user" | null>(null);
  const [savedRole, setSavedRole] = useState<"admin" | "user" | null>(null);

  async function loadSettings() {
    const token = getAuthToken();
    if (!token) {
      setLoadErr("Missing auth_token. Please re-login.");
      return;
    }
    try {
      const res = await fetch(`${baseUrl}/admin/ai-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoadErr(`Failed to load settings (${res.status})`);
        return;
      }
      const j = (await res.json()) as AiSettingsResp;
      setData(j);
      setLoadErr("");
    } catch (e: any) {
      setLoadErr(e?.message || "Network error");
    }
  }

  async function loadTools() {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${baseUrl}/admin/ai-tools`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const j = (await res.json()) as AiToolsResp;
      setTools(j);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadSettings();
    loadTools();
  }, []);

  async function saveRole(role: "admin" | "user", patch: RoleSettings) {
    const token = getAuthToken();
    if (!token) return;
    setSavingRole(role);
    setSavedRole(null);
    try {
      const res = await fetch(`${baseUrl}/admin/ai-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role, patch }),
      });
      if (res.ok) {
        await loadSettings();
        setSavedRole(role);
        setTimeout(() => setSavedRole(null), 2200);
      }
    } finally {
      setSavingRole(null);
    }
  }

  const stats = data?.stats;
  const allTools = tools?.items || [];
  const visibleTools = allTools.filter((t) => {
    const a = (t.audience || "both") as any;
    if (toolAudience === "admin") return a === "admin" || a === "both";
    if (toolAudience === "user") return a === "user" || a === "both";
    return true;
  });
  const writeCount = visibleTools.filter((t) => t.kind === "write").length;
  const readCount = visibleTools.filter((t) => t.kind === "read").length;

  const grouped = useMemo(() => {
    const m = new Map<string, AiTool[]>();
    for (const t of visibleTools) {
      const cat = (t.category || "Other").trim() || "Other";
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(t);
    }
    const order = [
      "KYC",
      "Withdrawal",
      "Wallet",
      "User",
      "Income/Commission",
      "Network/Levels",
      "Legacy/Migration",
      "Support",
      "System",
      "Other",
    ];
    const cats = Array.from(m.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return cats.map((c) => [c, (m.get(c) || []).sort((x, y) => x.name.localeCompare(y.name))] as const);
  }, [visibleTools]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">AI Settings</div>
          <div className="mt-1 text-sm text-slate-500">Control daily limits, tools visibility, and usage.</div>
        </div>
        <div className="text-xs text-slate-500">
          Live model: <span className="font-semibold text-slate-800">{data?.model || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total AI questions"
          value={fmt(stats?.total_questions_30d)}
          hint="Last 30 days"
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatCard
          label="Active users"
          value={fmt(stats?.active_users_30d)}
          hint="Last 30 days"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Enabled tools"
          value={fmt(stats?.enabled_tools_count)}
          hint="AI functions on"
          icon={<Wrench className="h-5 w-5" />}
        />
        <StatCard
          label="Avg response time"
          value={stats?.avg_response_ms ? `${stats.avg_response_ms} ms` : "—"}
          hint={stats?.avg_response_ms ? "Last 200 calls" : "Not tracked yet"}
          icon={<Timer className="h-5 w-5" />}
        />
      </div>

      <div className="mt-5 inline-flex rounded-full bg-white p-1 ring-1 ring-slate-200 shadow-sm">
          {(
            [
              { id: "settings", label: "Settings", Icon: SettingsIcon },
              { id: "tools", label: "Tools", Icon: Wrench },
              { id: "usage", label: "Usage", Icon: Activity },
            ] as { id: Tab; label: string; Icon: any }[]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {loadErr ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {loadErr}
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data ? (
              <>
                <LimitCard
                  title="Admin chat limits"
                  role="admin"
                  data={data.settings.admin}
                  saving={savingRole === "admin"}
                  saved={savedRole === "admin"}
                  onSave={(next) => saveRole("admin", next)}
                />
                <LimitCard
                  title="User chat limits"
                  role="user"
                  data={data.settings.user}
                  saving={savingRole === "user"}
                  saved={savedRole === "user"}
                  onSave={(next) => saveRole("user", next)}
                />
              </>
            ) : (
              <div className="col-span-full rounded-xl border border-slate-100 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Loading settings…
              </div>
            )}
          </div>
        ) : null}

        {tab === "tools" ? (
          <div className="mt-5 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Read tools: {readCount}
              </span>
              <span className="rounded-full bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-100">
                Write tools: {writeCount}
              </span>
              <span className="text-slate-500">Showing {visibleTools.length}/{tools?.count || 0}</span>

              <span className="mx-2 hidden h-4 w-px bg-slate-200 md:inline-flex" />

              <div className="inline-flex rounded-full bg-slate-50 p-1 ring-1 ring-slate-200">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "admin", label: "Admin" },
                    { id: "user", label: "User" },
                  ] as const
                ).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setToolAudience(it.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      toolAudience === it.id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-100">
              {grouped.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No tools.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {grouped.map(([cat, items]) => (
                    <div key={cat} className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cat}</div>
                        <div className="text-xs text-slate-400">{items.length}</div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        <table className="min-w-full text-sm text-slate-700">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Tool</th>
                              <th className="px-3 py-2 text-left">Audience</th>
                              <th className="px-3 py-2 text-left">Kind</th>
                              <th className="px-3 py-2 text-left">Description</th>
                              <th className="px-3 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((t) => (
                              <tr key={t.name} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium text-slate-900">{t.name}</td>
                                <td className="px-3 py-2">
                                  <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                                    {(t.audience || "both").toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      t.kind === "write"
                                        ? "bg-slate-900 text-white"
                                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                    }`}
                                  >
                                    {t.kind}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500">{t.description}</td>
                                <td className="px-3 py-2 text-emerald-700">Enabled</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "usage" ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-slate-900">
                <div>
                  <div className="text-2xl font-bold tabular-nums">{fmt(stats?.total_questions_today)}</div>
                  <div className="text-xs text-slate-500">Questions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{fmt(stats?.active_users_today)}</div>
                  <div className="text-xs text-slate-500">Active users</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last 30 days</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-slate-900">
                <div>
                  <div className="text-2xl font-bold tabular-nums">{fmt(stats?.total_questions_30d)}</div>
                  <div className="text-xs text-slate-500">Total questions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{fmt(stats?.active_users_30d)}</div>
                  <div className="text-xs text-slate-500">Active users</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average response time</div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {stats?.avg_response_ms ? `${stats.avg_response_ms} ms` : "—"}
              </div>
              <div className="text-xs text-slate-500">Computed from last 200 chats.</div>
            </div>
          </div>
        ) : null}
    </div>
  );
}
