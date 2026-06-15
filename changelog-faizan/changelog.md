<!-- changelog -->
## [25-04-2026 13:41] — Local dev run commands (UI + API)

**What changed:** Documented how to run `MLM-user-ui` on 3001, `MLM-Admin-ui` on 3003, and `MLM-API` locally (via Docker compose or Node dev).
**Files touched:** changelog-faizan/changelog.md
**API endpoints used:** N/A
**Breaking change:** NO
**Branch:** faizan-dev-ai-features

## [25-04-2026 19:56] — AI chat-engine upgrades (tools, prompt, legacy, UX)

**What changed:** Implemented the full AI feature-set for SIA MLM (chat-engine + tools + prompts + E2E eval + UI streaming UX).

- Chat-engine: SSE streaming chat with JWT auth (user + admin), Redis session memory, safer JSON serialization, and strong error handling for LLM failures/quota.
- Tool calling: automatic read-tool execution loop with write-action confirmation flow (`/chat/confirm`), plus stricter parsing so raw `{ \"tool_call\": ... }` never leaks into user-visible replies.
- Deterministic routing: added a Hinglish/English intent router for high-frequency intents to maximize accuracy (level progress, monthly income range, commission-missing complaints, migration/legacy mismatch cases) before the LLM generates final text.
- New/expanded read tools (DB-backed):
  - Aggregates: `getIncomeSummary`, `getWithdrawalCounts`, `getKycCounts`, `getTopReferrers`, `getDirectReferralCount`, `getNetworkSize`, `getAdminProjectedWithdrawalDemand`, `getWalletTransactionsSummary`, `getAdminPlatformStats`, `lookupUserByDisplayId`
  - User lifecycle: `getMyPurchases`, `getPendingPurchaseRequests`
  - Debug: `diagnoseMissingCommission` (now also reports SPOT credited from direct referrals only)
  - Legacy/migration suite: `getUserMigrationContext`, `getUserLegacySpotSummary`, `compareLegacySpotVsLedgerSpot`, `getUserLegacyActivationSummary`, `explainPurchaseIncomeMismatch` (2× tracker vs ledger vs legacy context)
- Prompt upgrades: system prompt rewritten for Hinglish mirroring + strict “no guessing” + IST date math + withdrawal-date rules + tool-routing, plus migration story (18-Dec-2025 state-based snapshot) and golden rule to check legacy on mismatch complaints.
- “No-freeze” UI UX: added SSE `status` event emitted right before each tool execution; Admin + User chat widgets show fancy typing/progress animation with tool-specific messages (balance check, ledger check, withdrawals, legacy compare, etc.) until reply arrives.
- E2E evaluation: authored 95-scenario suite (user + admin) with DB ground-truth checks and improved score to **84.21%** on best run; added a separate 35-scenario legacy/migration suite and ran it E2E.

**Files touched:** mlm-chat-engine/src/mlm_chat/main.py, mlm-chat-engine/src/mlm_chat/hinglish_router.py, mlm-chat-engine/src/mlm_chat/prompts/system_prompt.md, mlm-chat-engine/src/mlm_chat/tools/read_tools.py, mlm-chat-engine/scripts/scenarios.json, mlm-chat-engine/scripts/scenarios-legacy.json, mlm-chat-engine/scripts/run_eval.py, mlm-chat-engine/reports/eval-v4.md, mlm-chat-engine/reports/run-v4.log, mlm-chat-engine/reports/eval-legacy.md, mlm-chat-engine/reports/eval-legacy.json, mlm-chat-engine/reports/run-legacy.log, MLM-Admin-ui/src/components/chat/ChatFab.tsx, MLM-user-ui/user/src/components/chat/ChatFab.tsx
**API endpoints used:** POST /api/v1/auth/admin/login, POST /api/v1/auth/login, POST {chat-engine}/chat/stream, POST {chat-engine}/chat/confirm, POST {chat-engine}/chat/upload
**Breaking change:** NO
**Branch:** faizan-dev-ai-features

## [26-04-2026 13:06] — Standard chat widget initial size (admin + user)

**What changed:** Chat popup now opens at a consistent standard size (`min-h-[520px]`, `max-h-[640px]`, `h-[70vh]`) on both Admin and User UIs — no more tiny initial box.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [07-05-2026 16:37] — Started AI chat-engine locally (3004)

**What changed:** Started `mlm-chat-engine` locally on port 3004 (Uvicorn with `.env` loaded) and confirmed the server is responding (root returns 404 by design).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 16:17] — Fresh production backup loaded into local DB (5534)

**What changed:** Took a fresh production SQL dump (`production-db-backup/prod-backup-20260507_161340.sql` via Kubernetes `postgres-0`) and loaded it into the local Postgres container `mlm-local-5534` on `localhost:5534` by recreating the `mlm_commission` database to avoid duplicate/exists errors. Restarted `MLM-API` afterward and verified it responds on port 3000.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 16:09] — Started local frontend + backend

**What changed:** Started `MLM-user-ui` (3001) and `MLM-Admin-ui` (3003) Next.js dev servers and `MLM-API` (3000). Fixed backend startup by starting the required local Postgres container `mlm-local-5534` on port 5534 (used by `MLM-API/.env`). Verified all three ports respond.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [27-04-2026 20:41] — Restarted local dev servers (after abort)

**What changed:** After the previous dev-server tasks were aborted, restarted `MLM-API` (3000), `MLM-user-ui` (3001), `MLM-Admin-ui` (3003), and `mlm-chat-engine` (3004) and confirmed they respond.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 20:11] — Stage Gemini key/model aligned with local

**What changed:** Updated stage `mlm-chat-engine` Gemini configuration to match local: set `GEMINI_API_KEY` in `stage-mlm-secrets` and verified `GEMINI_MODEL=gemini-3-flash-preview`. Restarted chat-engine rollout so pods pick up the new secret.  
**Files touched:** `azure-kube-stage/k8s-stage/01-stage-secrets.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 19:44] — Stage Admin UI wired to stage-ai

**What changed:** Fixed stage Admin UI `AI Settings` page “Request failed” by wiring `NEXT_PUBLIC_CHAT_ENGINE_URL=https://stage-ai.secureinfiniteassociation.com` via stage configmap + admin UI deployment env, then rolled out `mlm-admin-ui` so frontend calls the correct chat-engine domain for `/admin/ai-settings` and `/admin/ai-tools`.  
**Files touched:** `azure-kube-stage/k8s-stage/02-stage-configmap.yaml`, `azure-kube-stage/k8s-stage/09-stage-mlm-admin-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 19:51] — Stage Admin UI rebuild with stage-ai baked in

**What changed:** Fixed “Failed to fetch” persisting on stage Admin UI by baking `NEXT_PUBLIC_CHAT_ENGINE_URL=https://stage-ai.secureinfiniteassociation.com` into the Next.js build (Next public env is build-time). Updated Admin UI Dockerfile + stage build script, bumped stage admin-ui version to `1.0.169`, pushed multi-arch image, and rolled out `mlm-admin-ui` on stage.  
**Files touched:** `MLM-Admin-ui/Dockerfile`, `azure-kube-stage/stage-build-and-push.sh`, `azure-kube-stage/stage-versions.env`, `azure-kube-stage/k8s-stage/09-stage-mlm-admin-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 18:07] — Restarted local dev servers (API/UI/chat-engine)

**What changed:** Restarted all local dev services after they were aborted: `MLM-API` on 3000 (connects to DB container on 5534 via `.env`), `MLM-user-ui` on 3001, `MLM-Admin-ui` on 3003, and `mlm-chat-engine` on 3004. Verified each port responds (chat-engine root returns 404 by design).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [26-04-2026 13:07] — Add "always update changelog" Cursor rule

**What changed:** Created `.cursor/rules/changelog-always-update.mdc` as an always-apply rule that enforces appending a changelog entry after every completed task.  
**Files touched:** `.cursor/rules/changelog-always-update.mdc`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:10] — Fix user-ui not loading on 3001

**What changed:** Cleared corrupted `.next` artifacts (ENOENT manifest errors) and restarted `MLM-user-ui` dev server. User UI now serves 200 on port 3001.  
**Files touched:** None (runtime fix)  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:13] — Add dedicated SIA AI page + sidebar links (admin + user)

**What changed:** Added "SIA AI" sidebar entry and a dedicated `/ai-assistant` page in both Admin and User apps. Refactored `ChatFab` to support `embedded` mode (full-page) while keeping the floating FAB on every other page.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-Admin-ui/src/components/sidebar.tsx`, `MLM-Admin-ui/src/app/ai-assistant/page.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/components/sidebar.tsx`, `MLM-user-ui/user/src/app/ai-assistant/page.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:33] — Add Recent Chats panel (admin + user AI page)

**What changed:** Implemented multi-conversation storage in Redis (per user + per conversation, sorted index); added `GET /chat/conversations` + `GET /chat/conversations/{id}` endpoints; updated AI pages to show "Recent Chats" panel with New button + click-to-reload; updated `ChatFab` to accept external `conversationId` and load history.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/memory/redis_session.py`, `mlm-chat-engine/src/mlm_chat/main.py`, `mlm-chat-engine/src/mlm_chat/models.py`, `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-Admin-ui/src/app/ai-assistant/page.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/app/ai-assistant/page.tsx`  
**API endpoints used:** `GET /chat/conversations`, `GET /chat/conversations/{conversation_id}`, `POST /chat/stream`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:35] — Fix User UI 3001 Turbopack ENOENT crash

**What changed:** Disabled Turbopack (`--turbopack` flag removed) for User UI dev script to stop `.next` tmp manifest ENOENT crashes. Dev server restarts cleanly now.  
**Files touched:** `MLM-user-ui/user/package.json`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:40] — Add "rename chat" for Recent Chats (admin + user)

**What changed:** Added Redis `rename_conversation` method + `PATCH /chat/conversations/{id}` endpoint; added inline rename UI (pencil icon → textbox → Enter/Esc) in Recent Chats panel on both Admin and User AI pages.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/memory/redis_session.py`, `mlm-chat-engine/src/mlm_chat/models.py`, `mlm-chat-engine/src/mlm_chat/main.py`, `MLM-Admin-ui/src/app/ai-assistant/page.tsx`, `MLM-user-ui/user/src/app/ai-assistant/page.tsx`  
**API endpoints used:** `PATCH /chat/conversations/{conversation_id}`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:48] — Fix /ai-assistant runtime crash (lucide icon export)

**What changed:** Fixed User/Admin `/ai-assistant` runtime 500 caused by importing a non-existent `lucide-react` export (`Pencil`). Switched to `Edit` icon so the page renders correctly in dev.  
**Files touched:** `MLM-user-ui/user/src/app/ai-assistant/page.tsx`, `MLM-Admin-ui/src/app/ai-assistant/page.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:52] — Improve admin-vs-user behavior in system prompt

**What changed:** Updated chat-engine system prompt to treat `Admin mode=true` as admin operator context (platform-wide / other-user queries), avoid answering admin questions as “self user”, and ask clarifying questions when user identifier is missing.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/prompts/system_prompt.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 13:58] — Admin default to platform for “last withdrawal” queries

**What changed:** Added `getLatestWithdrawal` read-tool (admin defaults to platform-wide latest withdrawal; supports per-user targeting via `display_id/user_id`) and updated admin prompt behavior to default to platform-wide when no SIA ID is provided (reduces unnecessary clarifying loops).  
**Files touched:** `mlm-chat-engine/src/mlm_chat/tools/read_tools.py`, `mlm-chat-engine/src/mlm_chat/prompts/system_prompt.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 14:06] — Fix withdrawal counts for specific calendar date (IST)

**What changed:** Verified local DB ground truth for 20-Apr-2026 withdrawals (IST) and fixed `getWithdrawalCounts` to support `on_date=YYYY-MM-DD` without asyncpg date-encoding errors.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/tools/read_tools.py`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 14:13] — Enable real image upload + multimodal chat

**What changed:** Implemented real image attachments end-to-end: `/chat/upload` now stores image bytes in memory and returns `upload://<id>`, the chat-engine sends the image to Gemini via inline image parts on the first model call, and Admin/User `ChatFab` now sends `attachments` to `/chat/stream` (with UI “1 image attached” + remove) instead of only pasting the URL into the input.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/main.py`, `mlm-chat-engine/src/mlm_chat/llm/gemini.py`, `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`  
**API endpoints used:** `POST /chat/upload`, `POST /chat/stream`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 14:24] — Add clean dev scripts for flaky Next dev cache

**What changed:** Added `dev:clean` / `start:clean` scripts to User UI to quickly recover from intermittent Next.js dev “React Client Manifest / missing chunk” corruption by clearing `.next` before starting.  
**Files touched:** `MLM-user-ui/user/package.json`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 14:35] — Improve reply formatting with table rendering

**What changed:** Improved response readability by (1) updating system prompt to produce ASCII pipe tables for structured data, and (2) updating Admin/User chat widgets to render table-like assistant/system messages in a monospace `<pre>` block so columns align.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/prompts/system_prompt.md`, `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 14:50] — Fix Next dev runtime crash on /ai-assistant (User UI)

**What changed:** Fixed intermittent Next.js dev runtime crash (`__webpack_modules__... is not a function`) by disabling the Next DevTools Segment Explorer experiment for the User UI and restarting with a clean `.next` rebuild.  
**Files touched:** `MLM-user-ui/user/next.config.ts`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 20:44] — Add admin write tools with confirmation gating

**What changed:** Added admin write tools to the chat-engine for withdrawal approve/reject, KYC approve/reject, and wallet manage, plus a safe batch approve-by-date tool. Wired them into the existing CONFIRM flow (never executes without explicit confirmation).  
**Files touched:** `mlm-chat-engine/src/mlm_chat/tools/write_tools.py`, `mlm-chat-engine/src/mlm_chat/main.py`, `mlm-chat-engine/src/mlm_chat/prompts/system_prompt.md`  
**API endpoints used:** `POST /api/v1/auth/admin/login`, `POST {chat-engine}/chat/stream`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 20:55] — Smoke test: adminApproveKyc works end-to-end

**What changed:** Verified admin KYC approval tool works end-to-end via chat-engine CONFIRM flow: picked one pending KYC user, received `confirmation_required`, confirmed, and observed MLM-API returns success; user’s `kyc_status` is now `approved` and removed from pending list.  
**Files touched:** None  
**API endpoints used:** `POST /api/v1/auth/admin/login`, `GET /api/v1/admin/kyc/pending`, `GET /api/v1/admin/users`, `POST {chat-engine}/chat/stream`, `POST {chat-engine}/chat/confirm`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:00] — Add adminListPendingKycs tool (no need to ask IDs)

**What changed:** Added an admin-only read tool `adminListPendingKycs` that lists KYC submissions waiting for approval (kyc_status='submitted'), so the AI can fetch pending users (including SIA display IDs + user_id) and doesn’t need to ask the admin to manually provide IDs.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/tools/read_tools.py`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:05] — Fix pending KYC listing + add batch KYC approval tool

**What changed:** Fixed `adminListPendingKycs` query to match actual `user_profiles` column names, and added `adminApprovePendingKycs` write tool to approve top N pending KYCs in one CONFIRM-gated action (admin can now say “4 KYC approve kar do” without providing IDs).  
**Files touched:** `mlm-chat-engine/src/mlm_chat/tools/read_tools.py`, `mlm-chat-engine/src/mlm_chat/tools/write_tools.py`, `mlm-chat-engine/src/mlm_chat/main.py`, `mlm-chat-engine/src/mlm_chat/prompts/system_prompt.md`  
**API endpoints used:** `POST /api/v1/auth/admin/login`, `GET /api/v1/admin/kyc/pending`, `POST /api/v1/admin/kyc/{user_id}/approve`, `POST {chat-engine}/chat/stream`, `POST {chat-engine}/chat/confirm`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:13] — Replace typed confirmation with Yes/No buttons

**What changed:** Updated Admin + User chat widgets to render confirmation prompts with **two buttons (Yes/No)** and call `/chat/confirm` with `confirm=true/false` accordingly, instead of asking the operator to type “yes”.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:20] — Auto-confirm admin approve actions (no prompt)

**What changed:** Improved Admin AI UX by auto-confirming safe admin “approve” write actions (KYC approve, withdrawal approve, batch approve) as soon as the backend emits `confirmation_required`, removing the extra confirmation prompt/click. High-risk actions (wallet manage, reject) still require Yes/No.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ChatFab.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:26] — Fix admin “KYC approve” not triggering tool

**What changed:** Fixed the admin “submitted KYC approve” flow by (1) removing duplicate confirmation handlers in Admin chat widget and (2) adding an admin fast-path in chat-engine that directly creates a pending action for `adminApprovePendingKycs` when the admin message clearly requests KYC approval, so the UI can auto-confirm and execute the write tool instead of the model asking to type “CONFIRM”.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `mlm-chat-engine/src/mlm_chat/main.py`  
**API endpoints used:** `POST /api/v1/auth/admin/login`, `POST {chat-engine}/chat/stream`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:27] — Add Bunny CDN/Stream creds to local MLM-API env

**What changed:** Added Bunny Storage + Bunny Stream environment variables to local `MLM-API/.env` for development; the file is gitignored so secrets won’t be committed.  
**Files touched:** `MLM-API/.env`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:40] — Show human-friendly summaries for write actions

**What changed:** Replaced raw JSON “Done” output after write actions with short human-readable summaries (approved counts, affected users, new balances). Raw JSON is only shown when `NEXT_PUBLIC_CHAT_DEBUG=true`.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ChatFab.tsx`, `MLM-user-ui/user/src/components/chat/ChatFab.tsx`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [26-04-2026 21:50] — Admin write-tools E2E smoke runner (10 scenarios)

**What changed:** Added a script to run 10 admin write-tool E2E scenarios via chat-engine SSE (`/chat/stream` + `/chat/confirm`) and verify outcomes against MLM-API admin endpoints. The script now also writes a Markdown + JSON report under `mlm-chat-engine/reports/` (and `write-e2e-latest.*`).  
**Files touched:** `mlm-chat-engine/scripts/run_write_e2e.py`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/admin/login`, `GET /api/v1/admin/kyc/pending`, `GET /api/v1/admin/users`, `GET /api/v1/admin/withdraw/pending`, `POST /chat/stream`, `POST /chat/confirm`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 15:57] — Fix admin UI SSE 404 by restoring chat-engine DB connection

**What changed:** Updated `mlm-chat-engine` `DATABASE_URL` to the correct local DB credentials/port and removed the unsupported `?schema=public` query so FastAPI can start and serve `/chat/*` routes. This resolves Admin UI “SSE failed (404): NotFound” caused by the chat-engine not booting (DB auth error).  
**Files touched:** `mlm-chat-engine/.env`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/admin/login`, `GET /chat/conversations`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 16:00] — AI Settings page (admin) + per-day rate limits + read/write toggles

**What changed:** Added admin-side **AI Settings** page (`/ai-settings`) matching the dark gradient reference: live model badge, 4 stat cards (questions/active users/enabled tools/avg response time), and tabs **Settings / Tools / Usage**. Settings tab lets admin set per-role daily question limits and read/write toggles for both **Admin** and **User** chat. Backend chat-engine now stores settings in Redis (`AiSettingsStore`), enforces per-day quota (per-user limit derived from role), gates read (full chat disabled) and write (write-tools refused) for the appropriate role, and tracks usage counters + average response latency. Added `/admin/ai-settings` (GET/PATCH) and `/admin/ai-tools` (GET).  
**Files touched:** `mlm-chat-engine/src/mlm_chat/admin_settings.py`, `mlm-chat-engine/src/mlm_chat/main.py`, `MLM-Admin-ui/src/app/ai-settings/page.tsx`, `MLM-Admin-ui/src/components/sidebar.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /admin/ai-settings`, `PATCH /admin/ai-settings`, `GET /admin/ai-tools`, `POST /chat/stream`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 16:12] — Categorize tools by Admin/User + domain groups

**What changed:** Tools list on Admin `AI Settings → Tools` is now grouped by domain (KYC, Withdrawal, Wallet, User, Income/Commission, Network/Levels, Legacy/Migration, Support, System, Other) and includes an **Audience** label (ADMIN/USER/BOTH) plus quick filters (All/Admin/User). Chat-engine `/admin/ai-tools` now returns `category` and `audience` fields for each tool.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/main.py`, `MLM-Admin-ui/src/app/ai-settings/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /admin/ai-tools`  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 16:52] — Make AI Settings UI minimal (match admin theme)

**What changed:** Restyled Admin `/ai-settings` page to a minimal look consistent with existing admin UI (white cards, slate text, subtle borders/shadows, single emerald accent) and removed heavy gradients/multi-color styling.  
**Files touched:** `MLM-Admin-ui/src/app/ai-settings/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 16:56] — Add icons to AI Settings stat cards

**What changed:** Added minimal Lucide icons to the 4 AI Settings stat cards (questions/users/tools/avg time) and role badges on limit cards (admin/user) to improve readability without adding more colors.  
**Files touched:** `MLM-Admin-ui/src/app/ai-settings/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 17:35] — Stage k8s deployment for mlm-chat-engine

**What changed:** Added stage Kubernetes deployment + service for `mlm-chat-engine` under `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, aligned with stage namespace (`stage-mlm`) and stage ACR secret. Added `CHAT_ENGINE_DATABASE_URL` to stage ConfigMap (asyncpg-compatible DSN without `?schema=public`) and added `GEMINI_API_KEY` placeholder to stage secrets for the chat-engine.  
**Files touched:** `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `azure-kube-stage/k8s-stage/02-stage-configmap.yaml`, `azure-kube-stage/k8s-stage/01-stage-secrets.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 18:14] — Stage build & push: api/user-ui/admin-ui/chat-engine (multi-arch)

**What changed:** Bumped stage image versions and pushed multi-arch (linux/amd64, linux/arm64) images to ACR: `mlm-api:1.0.213`, `mlm-user-ui:1.0.149`, `mlm-admin-ui:1.0.168`, `mlm-chat-engine:0.0.2`. Updated stage YAML tags to match. Extended `stage-build-and-push.sh` to also build/push `mlm-chat-engine` and update its YAML tag. Added `STAGE_CHAT_ENGINE_VERSION` to `stage-versions.env`. Hardened `mlm-chat-engine` Dockerfile + made `_read_system_prompt` resolve `Ai-plan.md` from multiple known locations so it works in Docker image and locally.  
**Files touched:** `azure-kube-stage/stage-versions.env`, `azure-kube-stage/stage-build-and-push.sh`, `azure-kube-stage/k8s-stage/04-stage-mlm-api-deployment.yaml`, `azure-kube-stage/k8s-stage/08-stage-mlm-user-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/09-stage-mlm-admin-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `mlm-chat-engine/Dockerfile`, `mlm-chat-engine/src/mlm_chat/main.py`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features

---

## [27-04-2026 17:42] — Stage AI domain + chat-engine CORS

**What changed:** Added `stage-ai.secureinfiniteassociation.com` to stage ingress and routed it to `mlm-chat-engine-service`. Added configurable CORS support in `mlm-chat-engine` via `CORS_ORIGINS` env and wired stage config (`CHAT_ENGINE_CORS_ORIGINS`) into stage chat-engine deployment so calls from stage admin/dashboard UIs are allowed.  
**Files touched:** `azure-kube-stage/k8s-stage/06-stage-ingress.yaml`, `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `azure-kube-stage/k8s-stage/02-stage-configmap.yaml`, `mlm-chat-engine/src/mlm_chat/main.py`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 19:40] — Stage chat-engine pending/crash fixed

**What changed:** Fixed stage `mlm-chat-engine` being stuck (init waiting for missing `redis-service`) by adding stage Redis deployment/service. Then fixed chat-engine CrashLoop (`python-multipart` missing for `/chat/upload`) by adding dependency, rebuilding/pushing stage image `mlm-chat-engine:0.0.3`, and rolling out the deployment.  
**Files touched:** `azure-kube-stage/k8s-stage/11-stage-redis-deployment.yaml`, `azure-kube-stage/stage-deploy.sh`, `mlm-chat-engine/requirements.txt`, `azure-kube-stage/stage-versions.env`, `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 21:12] — Overall investment volume (legacy + new)

**What changed:** Added system-wide “overall volume / total invested” computation by combining post-migration `purchases.amount` (completed) and legacy (pre-migration) activation amounts extracted from `legacy_activation_history.data->>'New Package'`. Exposed via new admin tool `getOverallInvestmentVolume` and extended `getSystemStats` with `total_invested_new`, `total_invested_legacy`, and `total_invested_combined`.  
**Files touched:** `mlm-chat-engine/src/mlm_chat/tools/read_tools.py`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 21:15] — Stage chat-engine build+push (0.0.4)

**What changed:** Built and pushed multi-arch stage image for `mlm-chat-engine` with latest tools (`getOverallInvestmentVolume` + extended `getSystemStats`) and rolled out stage deployment to `truelink.azurecr.io/mlm-chat-engine:0.0.4`.  
**Files touched:** `azure-kube-stage/stage-versions.env`, `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [27-04-2026 15:52] — Fresh local DB container (5534) + prod dump loaded

**What changed:** Created a fresh Postgres Docker container `mlm-local-5534` mapped to `localhost:5534`, loaded production SQL dump `production-db-backup/prod-backup-20260425_114114.sql` into `mlm_commission`, and updated `MLM-API` env config to connect to this DB (so PgBoss/auth no longer fails).  
**Files touched:** `MLM-API/.env`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-ai-features  

---

## [07-05-2026 22:03] — Prod ingress: ai.secureinfiniteassociation.com → chat-engine

**What changed:** Added production ingress host `ai.secureinfiniteassociation.com` (TLS SAN + HTTP rule) routing to service `mlm-chat-engine` on port `8088`. Extended nginx CORS allow-origin annotation to include the AI host. Updated `deploy.sh` printed domain list and DNS hints for the new host.  
**Files touched:** `azure-kube/k8s/06-ingress.yaml`, `azure-kube/deploy.sh`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 22:05] — Prod Gemini API key (mlm-secrets)

**What changed:** Set `GEMINI_API_KEY` in `azure-kube/k8s/01-secrets.yaml` for the chat-engine. Patched live cluster secret `mlm-secrets` in namespace `mlm` with the same key (merge). Attempted `kubectl rollout restart deploy/mlm-chat-engine` but deployment not present in cluster yet — after chat-engine is applied, restart once so pods reload the secret.  
**Files touched:** `azure-kube/k8s/01-secrets.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 22:10] — Production DB backup (pg_dump)

**What changed:** Ran `backup-production-db.sh` against cluster pod `postgres-0` in namespace `mlm`; wrote plain SQL dump (~272 MB, ~2M lines) to `production-db-backup/prod-backup-20260507_220802.sql` using `pg_dump` (`--no-owner --no-acl`).  
**Files touched:** `production-db-backup/prod-backup-20260507_220802.sql`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 17:56] — Prod build & push: api/user-ui/admin-ui/chat-engine

**What changed:** Production multi-arch (linux/amd64,linux/arm64) build & push to ACR for `mlm-api:1.0.252`, `mlm-user-ui:1.0.170`, `mlm-admin-ui:1.0.180`, and `mlm-chat-engine:0.0.4`. Updated `azure-kube/build-and-push.sh` to build the chat-engine, bake `NEXT_PUBLIC_CHAT_ENGINE_URL=https://ai.secureinfiniteassociation.com` into both UIs, bump versions, and `sed` the corresponding image tags into `azure-kube/k8s/04-mlm-api`, `08-mlm-user-ui`, `09-mlm-admin-ui`, and `12-mlm-chat-engine` deployment YAMLs. Added `NEXT_PUBLIC_CHAT_ENGINE_URL` build-arg to `MLM-user-ui/user/Dockerfile` (admin Dockerfile already had it).  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `MLM-user-ui/user/Dockerfile`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 16:28] — Hide AI chat FAB on login (admin + user)

**What changed:** Added a small client `ConditionalChatFab` that uses `usePathname()` and does not render the floating `ChatFab` on `/login`. Wired root layouts to use it instead of always mounting `ChatFab`, so the floating AI button no longer appears on Admin or User login pages. `/ai-assistant` still embeds `ChatFab` as before.  
**Files touched:** `MLM-Admin-ui/src/components/chat/ConditionalChatFab.tsx`, `MLM-Admin-ui/src/app/layout.tsx`, `MLM-user-ui/user/src/components/chat/ConditionalChatFab.tsx`, `MLM-user-ui/user/src/app/layout.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 16:39] — Block P2P when withdrawal pending

**What changed:** Added a validation to block P2P wallet transfers when the sender has any pending withdrawal request.
**Files touched:** `MLM-API/src/routes/p2p-transfer.ts`, `changelog-faizan/changelog.md`
**API endpoints used:** None
**Breaking change:** NO
**Branch:** faizan-dev-90-days-new-changes

---

## [07-05-2026 22:13] — Production deploy via deploy.sh

**What changed:** Ran `azure-kube/deploy.sh` with `push-db=false` against the configured AKS context. Namespace, secrets (`mlm-secrets` configured), configmap, ACR secret, Postgres apply (StatefulSet spec change rejected by API for forbidden fields—existing `postgres` unchanged), demo DB, `mlm-api` / `mlm-user-ui` / `mlm-admin-ui` / course UI / migration deployments applied or configured, ingress `mlm-ingress` configured. Skipped demo DB seed as requested.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [07-05-2026 22:29] — Prod chat-engine + Redis deployed (deploy.sh wired)

**What changed:** Wired Redis and AI chat-engine into prod `deploy.sh` (mirroring stage flow), added `CHAT_ENGINE_DATABASE_URL` (no Prisma `?schema=public`, asyncpg-safe), `CHAT_ENGINE_CORS_ORIGINS` and `NEXT_PUBLIC_CHAT_ENGINE_URL` to `mlm-config`, and updated `12-mlm-chat-engine-deployment.yaml` to read those (DSN + CORS) and to call `http://mlm-api-service` (correct prod Service name). Re-ran `deploy.sh push-db=false`: `redis` Deployment + `redis-service` **created**, `mlm-chat-engine` Deployment + Service **created**. Both chat-engine pods (`6bc64ffc8f-lhvk4`, `6bc64ffc8f-rwv4l`) are **Running 1/1** and `/health` returning **200**.  
**Files touched:** `azure-kube/deploy.sh`, `azure-kube/k8s/02-configmap.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** GET `https://ai.secureinfiniteassociation.com/health` (after DNS A-record points `ai.secureinfiniteassociation.com` → `4.224.96.234`)  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 16:05] — Global used IDs: counted users’ expiry does not shrink used_ids

**What changed:** Documented that `GLOBAL_HELPING` `used_ids` comes from distinct first purchases after the anchor date; those users later hitting 2× on their own package does not remove them from the count, so commission still uses the full used count (e.g. 1787) until the receiver’s own purchase is no longer processed (2×, disqualified, inactive, etc.).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 02:32] — Production DB backup + restore to local Docker (5534)

**What changed:** Ran `./backup-production-db.sh` to dump prod `mlm_commission` to `production-db-backup/prod-backup-20260510_023011.sql` (~288M). Recreated DB in container `mlm-local-5534`, imported the dump, verified `users` count (2876). Restarted `MLM-API` (already points at `localhost:5534` in `MLM-API/.env`); confirmed `http://localhost:3000` returns 302.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 02:33] — Started local frontends (user + admin)

**What changed:** Started `MLM-user-ui` Next dev on port 3001 and `MLM-Admin-ui` on port 3003; verified both return HTTP 200 on `/`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 18:45] — Local DB: SIA00397 post-purchase global cohort active vs 2×

**What changed:** Queried local Postgres (`mlm-local-5534` / `mlm_commission`) for user `SIA00397` (id 378): anchor purchase `purchases.id=261` (`purchased_at=2025-02-09 23:56:55+00`). Counted distinct users with first non-renewal completed purchase strictly after anchor (same shape as `GLOBAL_HELPING` used_ids), then split by whether the user still has any completed purchase with `income < 2×amount`. Totals: **1787** distinct (matches UI used), **1636** still have ≥1 active purchase, **151** have all purchases at 2×. Noted `legacy_activation_history` row counts for separate legacy reporting (not used in this query).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 19:15] — Local DB: same cohort vs legacy_activation_history

**What changed:** Cross-referenced the 1787-user global cohort (first `purchases` after SIA00397 anchor) with `legacy_activation_history`: any row, Success + parsed `Renewal Added` strictly after anchor, and active/expired (2×) splits. Parsed dates with `to_timestamp(..., 'DD/MM/YYYY, HH12:MI AM')`. Counted global overlap with all distinct users having post-anchor Success legacy events (1056 total, 1030 in cohort).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 20:05] — GLOBAL_HELPING: count only active first-purchase contributors

**What changed:** Added `getGlobalContributorWindowCounts()` (`rawDistinct` vs `activeDistinct`) using SQL: distinct first non-renewal purchasers in the window vs those whose earliest qualifying purchase in the window still has `income < 2×amount`. Daily `GLOBAL_HELPING` `used_ids` and admin/upgrade paths now use **activeDistinct** for payout; ledger metadata includes raw + active. `PackageStatusService.calculateGlobalIdsInfo` aligned: `used_ids` from active (capped), `total_global_users` / cap-loss from raw, `is_cap_reached` when raw ≥ cap.  
**Files touched:** `MLM-API/src/utils/global-helping-contributors.ts`, `MLM-API/src/modules/commissions/commission.service.ts`, `MLM-API/src/modules/purchases/package-status.service.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 20:28] — Show inactive global ID contributors in UI + API fields

**What changed:** Extended `GlobalIdsInfo` with `contributors_raw_in_window`, `contributors_active_in_window`, and `inactive_global_contributors` (raw − active). OpenAPI on `my-packages`, `my-course`, `admin-purchases` updated. User `my-course` + `dashboard` Global IDs boxes and Admin `UserSummaryModal` show inactive count with short explanation.  
**Files touched:** `MLM-API/src/modules/purchases/package-status.service.ts`, `MLM-API/src/routes/my-packages.ts`, `MLM-API/src/routes/my-course.ts`, `MLM-API/src/routes/admin-purchases.ts`, `MLM-API/scripts/test-package-status-service-local.ts`, `MLM-user-ui/user/src/lib/api/types.ts`, `MLM-user-ui/user/src/app/my-course/page.tsx`, `MLM-user-ui/user/src/app/dashboard/page.tsx`, `MLM-Admin-ui/src/lib/api/users.ts`, `MLM-Admin-ui/src/components/UserSummaryModal.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 04:49] — Global IDs UI: short red “Today inactive” line only

**What changed:** Replaced long inactive copy with a single red line `Today inactive: {count}` on User `my-course` package card + View Details modal, User `dashboard` Global Helping card, and Admin `UserSummaryModal` global IDs section.  
**Files touched:** `MLM-user-ui/user/src/app/my-course/page.tsx`, `MLM-user-ui/user/src/app/dashboard/page.tsx`, `MLM-Admin-ui/src/components/UserSummaryModal.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 21:10] — Docs: README + package status + commission-processing for active global contributors

**What changed:** Synced `MLM-API/README.md` (May 2026 callout, daily job snippet, calculation bullets, GLOBAL_HELPING “How it works” + files list), `MLM-API/docs/commission-processing.md` (2026 status note + progressive global section), `MLM-API/README_PACKAGE_STATUS.md` (business logic, `GlobalIdsInfo` shape, examples), and `MLM-API/DOCUMENTATION_SUMMARY.md` sample JSON with raw/active/inactive fields and payout vs cap semantics.  
**Files touched:** `MLM-API/README.md`, `MLM-API/docs/commission-processing.md`, `MLM-API/README_PACKAGE_STATUS.md`, `MLM-API/DOCUMENTATION_SUMMARY.md`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 05:35] — Stage: docker buildx push (ACR) via stage-build-and-push.sh

**What changed:** Ran `azure-kube-stage/stage-build-and-push.sh`: multi-platform (`linux/amd64`, `linux/arm64`) build and push to `truelink.azurecr.io` for tags from `stage-versions.env` — `mlm-api:1.0.213`, `mlm-course-ui:1.0.31`, `mlm-user-ui:1.0.149`, `mlm-admin-ui:1.0.169`, `mlm-chat-engine:0.0.4`; script updated `azure-kube-stage/k8s-stage/*.yaml` image tags.  
**Files touched:** `azure-kube-stage/k8s-stage/04-stage-mlm-api-deployment.yaml`, `azure-kube-stage/k8s-stage/05-stage-mlm-course-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/08-stage-mlm-user-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/09-stage-mlm-admin-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 05:38] — Stage: bump stage-versions.env + buildx push + yaml tags

**What changed:** Incremented `azure-kube-stage/stage-versions.env` (api 1.0.214, course-ui 1.0.32, user-ui 1.0.150, admin-ui 1.0.170, chat-engine 0.0.5), ran `stage-build-and-push.sh` (multi-arch push to ACR); script refreshed `k8s-stage` deployment image lines to match.  
**Files touched:** `azure-kube-stage/stage-versions.env`, `azure-kube-stage/k8s-stage/04-stage-mlm-api-deployment.yaml`, `azure-kube-stage/k8s-stage/05-stage-mlm-course-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/08-stage-mlm-user-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/09-stage-mlm-admin-ui-deployment.yaml`, `azure-kube-stage/k8s-stage/12-stage-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 05:40] — Stage: kubectl apply via stage-deploy.sh (stage-mlm)

**What changed:** Ran `azure-kube-stage/stage-deploy.sh` against AKS (`KUBECONFIG` = `azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08`): namespace, secrets, configmap, ACR secret, Redis, Postgres, demo DB, deployments (api / course-ui / user-ui / admin-ui / migration / chat-engine), ingress. DB seed skipped (`push-db=false`). Rollout started for updated workloads (new pods alongside existing until ready).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 05:45] — Prod DB dump → restore on stage Postgres (stage-clone-prod-db.sh)

**What changed:** Ran `azure-kube-stage/stage-clone-prod-db.sh`: `pg_dump` from `mlm/postgres-0` (`mlm_commission`, `--clean --if-exists`) to timestamped local file under `azure-kube-stage/` (gitignored), `kubectl cp` to `stage-mlm/postgres-0`, `psql -f` restore. Restore logged a few **cannot drop inherited constraint** errors on hashed partition child tables before continuing; main schema `COPY` phases completed. Local dump retained for optional delete.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO (stage-only; prod read-only dump)  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 17:49] — Production DB backup (pg_dump to production-db-backup)

**What changed:** Ran `backup-production-db.sh`: `kubectl exec` on `mlm/postgres-0`, `pg_dump -U mlm_user -d mlm_commission` (`--no-owner --no-acl`) to `production-db-backup/prod-backup-20260510_174645.sql` (~288MB, ~2.16M lines). Read-only on prod.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 18:05] — Prod ACR: build-and-push version bump + course-ui yaml sed

**What changed:** Bumped `azure-kube/build-and-push.sh` tags (api 1.0.253, course-ui 1.0.43, user-ui 1.0.171, admin-ui 1.0.181, chat-engine 0.0.5); added missing `sed` for `k8s/05-mlm-course-ui-deployment.yaml` so course-ui image tag tracks `UI_VERSION`; ran script — multi-arch push to `truelink.azurecr.io` and updated `04`/`05`/`08`/`09`/`12` deployment yamls. `*-p1-*` yamls unchanged by script.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [10-05-2026 18:06] — Production deploy via azure-kube/deploy.sh (mlm)

**What changed:** Ran `azure-kube/deploy.sh` to apply production `azure-kube/k8s/*.yaml` into namespace `mlm` (no DB seed). Deployments updated: `mlm-api`, `mlm-course-ui`, `mlm-user-ui`, `mlm-admin-ui`, `mlm-chat-engine`. Ingress unchanged. Script reported a forbidden update attempt on `postgres` StatefulSet spec (non-template fields), but DB pods remained ready; rollout proceeded for updated deployments (new pods in Init/ContainerCreating while old pods stayed running).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 15:59] — Started local backend + frontends

**What changed:** Started Docker Postgres `mlm-local-5534` (port 5534), `MLM-API` dev on 3000, `MLM-user-ui` on 3001, and `MLM-Admin-ui` on 3003; verified API 302 and both UIs 200 on `/`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 16:02] — Admin Dashboard: Ecosystem quick-links section

**What changed:** Added a new "Ecosystem" section on the Admin Dashboard (visible to SUPER_ADMIN) placed directly above the green Monthly Business hero card. The section renders 6 gradient cards that open the respective panels in a new tab: Networker (`https://admin-binary.securepharma.co.in/dashboard`), Secure Coin (`https://admin.securecoin.co.in/login`), SecurePharma (`https://admin.securepharma.co.in/admin/login`), Franchise (`https://franchise.securepharma.co.in`), Retailer (`https://retailer.securepharma.co.in`), Distributor (`https://distributor.securepharma.co.in/scm/distributor`). Each card has a branded gradient, icon, hover lift, and an external-link indicator. Pure UI change — no API, routing, or auth changes.  
**Files touched:** `MLM-Admin-ui/src/app/dashboard/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 16:05] — Admin Dashboard: Monthly Business amount hidden by default

**What changed:** Changed initial state of `showMonthlyBalance` from `true` to `false` so the Monthly Business amount on the dashboard hero card now renders masked (`₹ •••••••••`) on page load. Admin can click the eye icon to reveal the value.  
**Files touched:** `MLM-Admin-ui/src/app/dashboard/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 16:09] — Restarted local API + UIs after aborted tasks

**What changed:** Prior background dev servers (API 3000, user-ui 3001, admin-ui 3003) were aborted so ports were down. Started `mlm-local-5534`, then restarted `MLM-API`, `MLM-user-ui`, and `MLM-Admin-ui`; verified API 302 and both UIs 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 16:18] — Admin Dashboard: Ecosystem compact + SUB_ADMIN hidden until role load

**What changed:** Reduced vertical footprint of Ecosystem cards (tighter section padding, smaller header/badge, `gap-2`, card `px-3 py-2` with `rounded-lg`, 7×7 icon wells, smaller type and external-link icon, smaller decorative blur). Added `adminRoleReady` flag set in `finally` after `getMyPermissions()` so Ecosystem renders only when `adminRole === 'SUPER_ADMIN'` **after** the role response—prevents a brief flash for `SUB_ADMIN` users who previously defaulted optimistically to `SUPER_ADMIN` before the fetch completed.  
**Files touched:** `MLM-Admin-ui/src/app/dashboard/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /admin/my-permissions` (existing `getMyPermissions` call)  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 16:20] — ACR: admin-ui only build-push 1.0.182 + k8s tag

**What changed:** Bumped `ADMIN_UI_VERSION` to `1.0.182` in `azure-kube/build-and-push.sh`; ran `ONLY_IMAGES=mlm-admin-ui bash azure-kube/build-and-push.sh` — multi-arch (`linux/amd64,linux/arm64`) build and push of `truelink.azurecr.io/mlm-admin-ui:1.0.182`; script updated `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml` image tag to match. Other images skipped.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [12-05-2026 17:05] — Production: azure-kube deploy.sh (mlm namespace)

**What changed:** Ran `azure-kube/deploy.sh` (default `push-db=false`) against the configured kubeconfig. Applied namespace, secrets, config, ACR secret, Redis, Postgres StatefulSet (Kubernetes rejected forbidden non-template StatefulSet spec changes on `postgres` — same as prior runs; `postgres-0` / `postgres-p1` remained ready), demo DB, API, course-ui, user-ui, **mlm-admin-ui** (`configured` — new ReplicaSet rolling out with image `mlm-admin-ui:1.0.182`), migration, chat-engine, ingress. Pod list at end showed new `mlm-admin-ui` pod in `ContainerCreating` alongside older replicas until rollout completes.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [27-05-2026 13:38] — Ecosystem cards: ECOSYSTEM_VIEW permission for sub-admins

**What changed:** Added `ECOSYSTEM_VIEW` permission (`View Ecosystem Cards`, group `Dashboard`) via SQL migration `MLM-API/prisma/migrations/add_ecosystem_view_permission.sql`. Admin Management loads it from `/admin/permissions` (fallback in `PERMISSION_GROUPS`). Dashboard shows Ecosystem section for `SUPER_ADMIN` always, or for `SUB_ADMIN` only when `ECOSYSTEM_VIEW` is assigned in Edit Sub Admin.  
**Files touched:** `MLM-API/prisma/migrations/add_ecosystem_view_permission.sql`, `MLM-Admin-ui/src/lib/api/sub-admins.ts`, `MLM-Admin-ui/src/app/dashboard/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /admin/permissions`, `GET /admin/my-permissions` (existing)  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [27-05-2026 14:05] — Harbor: admin-ui only build-push 1.0.183

**What changed:** Bumped `ADMIN_UI_VERSION` to `1.0.183`; ran `ONLY_IMAGES=mlm-admin-ui bash azure-kube/build-and-push.sh` — built and pushed `registry.trueinception.in/library/mlm-admin-ui:1.0.183` (`linux/amd64`, includes ECOSYSTEM_VIEW permission UI). Updated `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml` image tag. Other services skipped.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-90-days-new-changes  

---

## [27-05-2026 14:12] — Contabo sia-prod: deploy admin-ui 1.0.183

**What changed:** Ran `azure-kube/deploy.sh` on Contabo cluster (`sia-prod`). `mlm-admin-ui` deployment **configured** — rolling update to `registry.trueinception.in/library/mlm-admin-ui:1.0.183` (new pod `mlm-admin-ui-555796847b-*` started). `mlm-migration-service` also configured; other workloads unchanged. DB seed skipped (`push-db=false`).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [27-05-2026 14:25] — Prod DB: ECOSYSTEM_VIEW permission + admin UI fallback

**What changed:** Root cause: `ECOSYSTEM_VIEW` was not in production `admin_permissions_master`, so `/admin/permissions` never returned it and Edit Sub Admin had no checkbox. Ran INSERT on Contabo `postgres-0` / `mlm_commission` (verified row). Added `azure-kube/run-ecosystem-permission-migration.sh` for repeat runs. Added admin-management fallback to inject `View Ecosystem Cards` from `PERMISSION_GROUPS` if API omits it.  
**Files touched:** `MLM-Admin-ui/src/app/master/admin-management/page.tsx`, `azure-kube/run-ecosystem-permission-migration.sh`, `changelog-faizan/changelog.md`  
**API endpoints used:** None (direct DB); `GET /admin/permissions` serves the new row after refresh  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [31-05-2026 12:45] — Export pending withdrawals from prod DB (admin Export format)

**What changed:** Queried Contabo production `mlm_commission` for all `withdraw_requests` with `status = 'pending'` (1024 rows). Added `scripts/export-pending-withdrawals-prod.py` mirroring Admin Pending Withdraw → Export (normal CSV): user ID, PAN, mobile, amount, payout (90%), wallet type, bank/UPI fields, status, date. Generated `pending-withdrawals-2026-05-31.csv` locally (not committed — contains PII). Totals: requested ₹74,63,571.55; payout after 10% TDS ₹67,17,214.39.  
**Files touched:** `scripts/export-pending-withdrawals-prod.py`, `pending-withdrawals-2026-05-31.csv` (local only), `changelog-faizan/changelog.md`  
**API endpoints used:** None (kubectl exec → Postgres)  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [31-05-2026 13:10] — Fix slow pending withdrawal Export (remove N+1 user API calls)

**What changed:** Export was taking 1+ hour because after loading ~1024 pending rows it called `getUserById` (+ often `getAllProfiles`) for **each unique user** in batches of 5 (~1000–2000 HTTP requests). Fixed by: (1) extending `GET /admin/withdraw/pending` to return bank/address profile fields in the list response (same DB query, no extra round-trips); (2) export now maps rows from list data only, fetches pages in parallel; (3) removed per-row user-detail fetch on the table page; Export button shows “Exporting…”.  
**Files touched:** `MLM-API/src/routes/admin-withdraw.ts`, `MLM-Admin-ui/src/lib/api/withdraw.ts`, `MLM-Admin-ui/src/app/withdraw/pending-withdraw/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /admin/withdraw/pending` (enhanced response)  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [31-05-2026 14:35] — Harbor: mlm-api + mlm-admin-ui build-push 1.0.254 / 1.0.184

**What changed:** Bumped `API_VERSION` to `1.0.254` and `ADMIN_UI_VERSION` to `1.0.184`; ran `ONLY_IMAGES=mlm-api,mlm-admin-ui bash azure-kube/build-and-push.sh` — pushed `registry.trueinception.in/library/mlm-api:1.0.254` (pending withdraw list profile fields) and `mlm-admin-ui:1.0.184` (fast export fix). Updated `azure-kube/k8s/04-mlm-api-deployment.yaml` and `09-mlm-admin-ui-deployment.yaml`. Other services skipped.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [31-05-2026 14:42] — Contabo sia-prod: deploy mlm-api 1.0.254 + admin-ui 1.0.184

**What changed:** Ran `azure-kube/deploy.sh` on Contabo `sia-prod`. `mlm-api` and `mlm-admin-ui` deployments **configured** — rolling update to `1.0.254` / `1.0.184` (new pods started; old replicas still running until rollout completes). Other workloads unchanged. `mlm-migration-service` still `ImagePullBackOff` (pre-existing, not part of this release).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 02:32] — Contabo migration guide (chat)

**What changed:** Documented Azure → Contabo cutover steps: Harbor image path, `sia-prod` vs `mlm` namespace RBAC, deploy order, Cloudflare DNS to ingress IP (not API server `217.216.58.204`), cert-manager/TLS, DB restore, and cutover checklist. No cluster or manifest changes applied.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 02:37] — Contabo: namespace mlm → sia-prod

**What changed:** Migrated all `azure-kube/k8s/*.yaml` and deploy/helper scripts from Kubernetes namespace `mlm` to `sia-prod`. Updated `00-namespace.yaml` metadata, `deploy.sh` + shell scripts to use `kubeconfig-mlm-prod.yaml`, and kubeconfig context default namespace to `sia-prod`. README/DEPLOYMENT_SUMMARY kubectl examples updated. Image registry paths unchanged (still ACR).  
**Files touched:** `azure-kube/k8s/*.yaml`, `azure-kube/deploy.sh`, `azure-kube/build-and-push.sh`, `azure-kube/kubeconfig-mlm-prod.yaml`, `azure-kube/*.sh`, `azure-kube/scripts/*`, `azure-kube/README.md`, `azure-kube/DEPLOYMENT_SUMMARY.md`, `azure-kube/DATABASE-ISOLATION.md`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES (new cluster namespace; Azure `mlm` namespace unchanged until cutover)  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 02:39] — Contabo Harbor registry + ingress cleanup

**What changed:** Switched all deployment images from `truelink.azurecr.io` to `registry.trueinception.in/library/*`. Updated `07-acr-secret.yaml` with Harbor pull credentials, `build-and-push.sh` to login/push Harbor (`linux/amd64` only), and sed paths for k8s tags. Removed p1 hosts (`api1`, `app1`) and backends from `06-ingress.yaml`.  
**Files touched:** `azure-kube/k8s/06-ingress.yaml`, `azure-kube/k8s/07-acr-secret.yaml`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/10-mlm-migration-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `azure-kube/build-and-push.sh`, `azure-kube/deploy.sh`, `azure-kube/README.md`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES (image registry + ingress routes)  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 13:32] — Harbor sequential image build and push

**What changed:** Built and pushed Contabo Harbor images one-by-one via `ONLY_IMAGES` (`mlm-user-ui` → `mlm-api` → `mlm-admin-ui` → `mlm-chat-engine` → `mlm-course-ui`). Fixed Cloudflare `413 Payload Too Large` on push by switching `MLM-API` and `MLM-course-ui` Dockerfiles from `node:20` to `node:20-bookworm-slim`. All five images published to `registry.trueinception.in/library/*` at versions in `build-and-push.sh`; k8s deployment YAML tags refreshed.  
**Files touched:** `MLM-API/Dockerfile`, `MLM-course-ui/Dockerfile`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 17:07] — Crown Harbor registry (registry.crownco.ai) build-push

**What changed:** Switched registry to `registry.crownco.ai` per `registry-crown.txt` in `build-and-push.sh`, `07-acr-secret.yaml`, and all deployment YAMLs. Full `./build-and-push.sh` succeeded — pushed mlm-api, course-ui, user-ui, admin-ui, chat-engine to `registry.crownco.ai/library/*` (linux/amd64).  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/07-acr-secret.yaml`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/10-mlm-migration-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `azure-kube/README.md`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES (registry host)  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 17:22] — Crown registry rebuild (node:20-alpine, no bookworm-slim)

**What changed:** Re-ran full `./build-and-push.sh` to `registry.crownco.ai/library/*` using `node:20-alpine` (Node) and `python:3.12-slim` (chat-engine). Added build script guard to abort if `bookworm-slim` is present in Node Dockerfiles. All five images pushed successfully.  
**Files touched:** `azure-kube/build-and-push.sh`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 17:35] — Contabo registry retry (trueinception) — push OK

**What changed:** Switched `build-and-push.sh`, `07-acr-secret.yaml`, and deployment YAMLs back to `registry.trueinception.in` per `contabo-registry.txt`. Full `./build-and-push.sh` succeeded (no 413); all five images pushed with `node:20-alpine` layers.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/07-acr-secret.yaml`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/10-mlm-migration-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `azure-kube/README.md`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 17:38] — node:20 vs alpine Contabo push test

**What changed:** Temporarily switched Node Dockerfiles to `node:20` (full Debian); `ONLY_IMAGES=mlm-api` push to `registry.trueinception.in` reproduced Cloudflare `413 Payload Too Large` on large layer blob. Reverted all Node Dockerfiles to `node:20-alpine` for production pushes.  
**Files touched:** `MLM-API/Dockerfile`, `MLM-course-ui/Dockerfile`, `MLM-Admin-ui/Dockerfile`, `MLM-user-ui/user/Dockerfile`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 18:17] — docker-slim + Contabo registry full build-push

**What changed:** Added `build_push_image()` to `build-and-push.sh` (build `--load` → `docker-slim` minify → push). Default `USE_DOCKER_SLIM=true`. Installed mintoolkit via Homebrew. Full push to `registry.trueinception.in/library/*` succeeded (no 413). Slim results: api 182→97MB, course-ui 54→47MB, user-ui 96→68MB, admin-ui 72→48MB, chat-engine 88→42MB.  
**Files touched:** `azure-kube/build-and-push.sh`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 18:57] — Contabo deploy (sia-prod)

**What changed:** Ran `./deploy.sh` on Contabo (`kubeconfig-mlm-prod.yaml`, namespace `sia-prod`). Fixed deploy health check (namespace vs cluster-info). Replaced Azure `managed-csi` PVCs with default `longhorn` storage. Disabled docker-slim for all app images after slim broke Next.js/API; rebuilt and pushed images. Added `openssl` to MLM-API Dockerfile for Prisma on Alpine. Scaled `mlm-migration-service` to 0 (image not in registry). Ingress ADDRESS: `217.216.58.204`, `82.180.144.92`, `82.180.147.20`. Core pods Running: api, course-ui, user-ui, admin-ui, chat-engine, postgres, redis.  
**Files touched:** `azure-kube/deploy.sh`, `azure-kube/k8s/03-postgres-statefulset.yaml`, `azure-kube/k8s/03-mlm-demo-db-statefulset.yaml`, `azure-kube/build-and-push.sh`, `MLM-API/Dockerfile`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES (new cluster; DB empty until Azure backup restore)  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 18:59] — Contabo deployments replicas → 1

**What changed:** Set `replicas: 1` for mlm-api, mlm-course-ui, mlm-user-ui, mlm-admin-ui, and mlm-chat-engine in k8s manifests; applied to Contabo `sia-prod` cluster. All deployments now 1/1 ready.  
**Files touched:** `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `azure-kube/k8s/12-mlm-chat-engine-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 19:06] — Azure prod DB dump → Contabo restore

**What changed:** Live `pg_dump` from Azure AKS `postgres-0` (namespace `mlm`) to `production-db-backup/prod-backup-azure-to-contabo-20260521_190419.sql` (312MB). Dropped/recreated `mlm_commission` on Contabo `postgres-0` (`sia-prod`) and restored dump; verified `users` count 2969. Scaled mlm-api/chat-engine down during restore, then back to 1 replica.  
**Files touched:** `production-db-backup/prod-backup-azure-to-contabo-20260521_190419.sql`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 19:20] — Contabo pre-cutover health check

**What changed:** Verified Contabo `sia-prod` before DNS switch: all core pods 1/1 Running; DB `mlm_commission` has 2969 users and 8 courses; HTTPS via ingress IP — api `/health` 200, app/dashboard/admin `/` 200, ai `/docs` 200; CORS preflight 204. TLS secret `mlm-tls-secret` not issued yet (nginx fake cert until DNS points and cert-manager completes). `migration` host returns 503 (mlm-migration-service replicas 0).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** GET `https://api.secureinfiniteassociation.com/health` (via --resolve)  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 20:04] — Fresh Azure prod DB backup → Contabo restore

**What changed:** Took live `pg_dump` from Azure `mlm/postgres-0` to `production-db-backup/prod-backup-azure-to-contabo-20260521_200230.sql` (312MB). Scaled Contabo `mlm-api` and `mlm-chat-engine` to 0, dropped/recreated `mlm_commission` on `sia-prod/postgres-0`, restored dump. Verified Contabo: 2970 users, 8 courses. Scaled API and chat-engine back to 1; API `/health` 200.  
**Files touched:** `production-db-backup/prod-backup-azure-to-contabo-20260521_200230.sql`, `changelog-faizan/changelog.md`  
**API endpoints used:** GET `https://api.secureinfiniteassociation.com/health`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 20:36] — Revert SIA marketing site Contabo deploy

**What changed:** Reverted all `Secure-Infinite-Association-` Contabo/K8s work per user request: removed `Dockerfile`, `.dockerignore`, `k8s/13-sia-website-deployment.yaml`, ingress www/apex routes, and `build-and-push.sh` / `deploy.sh` sia-website steps; restored `next.config.ts`. No registry push or cluster deploy for sia-website. Marketing site stays on Vercel (`app`/`www` CNAME).  
**Files touched:** `Secure-Infinite-Association-/next.config.ts`, `azure-kube/k8s/06-ingress.yaml`, `azure-kube/build-and-push.sh`, `azure-kube/deploy.sh`, `changelog-faizan/changelog.md` (deleted: `Secure-Infinite-Association-/Dockerfile`, `Secure-Infinite-Association-/.dockerignore`, `azure-kube/k8s/13-sia-website-deployment.yaml`)  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [21-05-2026 20:40] — README + scripts: Azure → Contabo production docs

**What changed:** Rewrote `azure-kube/README.md` for Contabo production (`sia-prod`, Harbor, ingress IPs, DNS, DB restore). Restored `deploy.sh` and `build-and-push.sh` to Contabo/Harbor + docker-slim flow; aligned `k8s/06-ingress.yaml` with live cluster (no api1/app1, namespace sia-prod).  
**Files touched:** `azure-kube/README.md`, `azure-kube/deploy.sh`, `azure-kube/build-and-push.sh`, `azure-kube/k8s/06-ingress.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:31] — Admin user edit 500: prod logs root cause

**What changed:** Checked `mlm-api` pod logs for `PUT /api/v1/admin/users/2460`. Root cause is Prisma `P2002` — duplicate email `dummy@gmail.com` already owned by user `2423` (SIA02481); target user `2460` (SIA02518) has `test12@gmail.com`. API returns generic 500; admin UI shows "Server error. Please try again later."  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** PUT `/api/v1/admin/users/:id`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:34] — Allow duplicate user emails

**What changed:** Removed `@unique` on `users.email` in Prisma schema; added migration `allow_duplicate_user_email.sql` (drops `users_email_key` index). Removed app-level duplicate-email checks in auth register, profile, users, admin-sub-admins. Replaced `findUnique({ email })` with `findFirst` where email lookup is used. Applied `DROP INDEX users_email_key` on prod Postgres (`sia-prod/postgres-0`).  
**Files touched:** `MLM-API/prisma/schema.prisma`, `MLM-API/prisma/migrations/allow_duplicate_user_email.sql`, `MLM-API/src/routes/auth.ts`, `MLM-API/src/routes/users.ts`, `MLM-API/src/routes/profile.ts`, `MLM-API/src/routes/admin-sub-admins.ts`, `MLM-API/src/routes/user-details.ts`, `MLM-API/src/routes/p2p-transfer.ts`, `azure-kube/run-allow-duplicate-email-migration.sh`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:37] — Duplicate email admin-only

**What changed:** Scoped duplicate email to admin user edit only. Restored app-level duplicate checks on register (`auth.ts`), user profile (`users.ts`, `profile.ts`), and sub-admin create/update. DB unique index remains dropped so `PUT /admin/users/:id` can assign same email; normal users still get `email_already_exists` / `Email already exists`.  
**Files touched:** `MLM-API/src/routes/auth.ts`, `MLM-API/src/routes/users.ts`, `MLM-API/src/routes/profile.ts`, `MLM-API/src/routes/admin-sub-admins.ts`, `MLM-API/src/routes/admin-users.ts`, `MLM-API/prisma/migrations/allow_duplicate_user_email.sql`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:39] — Sub-admin duplicate email allowed

**What changed:** Removed duplicate-email checks on sub-admin create/update so same email as an existing user is allowed (e.g. `faizan@gmail.com`). Admin login now filters by `SUPER_ADMIN`/`SUB_ADMIN` role when resolving email so shared emails still log into admin panel correctly. Register/profile duplicate checks unchanged.  
**Files touched:** `MLM-API/src/routes/admin-sub-admins.ts`, `MLM-API/src/routes/auth.ts`, `MLM-API/prisma/migrations/allow_duplicate_user_email.sql`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:43] — Build & push mlm-api v1.0.255

**What changed:** Built and pushed `mlm-api:1.0.255` to Harbor (duplicate email admin/sub-admin changes). Updated `build-and-push.sh` API_VERSION and `k8s/04-mlm-api-deployment.yaml` image tag.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:44] — Deploy mlm-api v1.0.255 to prod

**What changed:** Ran `./deploy.sh` on Contabo `sia-prod`. `mlm-api` rolled out to `1.0.255`; pod `mlm-api-845888b4f7-mkx66` Running; `GET /health` returns 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** GET `https://api.secureinfiniteassociation.com/health`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:48] — Edit User modal: no backdrop close

**What changed:** Edit User modal on User Details page now closes only via X or Cancel/Save — blank backdrop click no longer dismisses it (`closeOnBackdropClick={false}`).  
**Files touched:** `MLM-Admin-ui/src/app/user-management/users-details/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:51] — Build & push mlm-admin-ui v1.0.185

**What changed:** Built and pushed `mlm-admin-ui:1.0.185` to Harbor (Edit User modal backdrop fix). Updated `build-and-push.sh` ADMIN_UI_VERSION and `k8s/09-mlm-admin-ui-deployment.yaml` image tag.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:04] — P2P email OTP (SMTP, no SMS)

**What changed:** Added nodemailer `EmailService` for P2P transfer OTP via registered email. New `POST /transfer/p2p/send-otp`; `POST /transfer/p2p` now requires 6-digit email OTP (SMS/mobile OTP removed for P2P). User UI confirm dialog sends OTP to email with resend + countdown. Wired SMTP env in `mlm-api` deployment and secrets.  
**Files touched:** `MLM-API/package.json`, `MLM-API/src/modules/email/emailService.ts`, `MLM-API/src/routes/p2p-transfer.ts`, `MLM-API/.env.example`, `MLM-user-ui/user/src/app/transfer-money/p2p-transfer/page.tsx`, `MLM-user-ui/user/src/lib/api/wallet.ts`, `MLM-user-ui/user/src/lib/api/types.ts`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/01-secrets.yaml`, `azure-kube/k8s/02-configmap.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** POST `/api/v1/transfer/p2p/send-otp`, POST `/api/v1/transfer/p2p`  
**Breaking change:** YES (P2P transfer now requires email OTP)  
**Branch:** faizan-dev-contabo-setup  

---


## [04-06-2026 01:54] — Deploy mlm-admin-ui v1.0.185 to prod

**What changed:** Ran `./deploy.sh` on Contabo `sia-prod`. `mlm-admin-ui` rolled out to `1.0.185`; pod `mlm-admin-ui-769877f678-hsdpf` Running.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:05] — Started local backend + frontends

**What changed:** Started Docker Postgres `mlm-local-5534`, restarted `MLM-API` on 3000, started `MLM-user-ui` on 3001; `MLM-Admin-ui` already up on 3003. Verified API 302 and both UIs 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:10] — Ran Admin UI locally on 3003

**What changed:** Started `MLM-Admin-ui` dev server (Next.js 16, Turbopack) on port 3003. Verified Ready in ~1.6s and `/` returns 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:22] — Local DB: SIA02000 email for P2P OTP test

**What changed:** Updated local Postgres (`localhost:5534/mlm_commission`) user `SIA02000` (id 1898) email from `faizan12@gmail.com` to `faizanansari.1692@gmail.com` for P2P email OTP testing.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:26] — Register & Add Member email OTP

**What changed:** Replaced mobile/SMS OTP with email OTP on registration and add-member flows. User UI `new-join` and Course UI `register` now send/verify OTP via `POST /auth/email-otp/send` and `/verify`, then pass `email_verified_token` on register. Mobile field remains required but no OTP.  
**Files touched:** `MLM-user-ui/user/src/lib/api/auth.ts`, `MLM-user-ui/user/src/app/new-join/page.tsx`, `MLM-course-ui/lib/api.js`, `MLM-course-ui/app/register/page.jsx`, `MLM-course-ui/contexts/AuthContext.jsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** POST `/api/v1/auth/email-otp/send`, POST `/api/v1/auth/email-otp/verify`, POST `/api/v1/auth/register`  
**Breaking change:** YES (register now requires verified email OTP; mobile OTP no longer accepted)  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 17:22] — MLM-course-ui deployed to Vercel

**What changed:** MLM-course-ui (secure-academy-ui) deployed to Vercel production. Email OTP changes for register and forgot-password now live at `https://app.secureinfiniteassociation.com`. Deploy ID: `dpl_DXKQu7RbahJFh9YW1cNSTf4oz1hW`.  
**Files touched:** `MLM-course-ui/.vercel/` (auto-created), `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 17:08] — Production deploy: email OTP release

**What changed:** Deployed all 4 updated services to production (sia-prod). All rollouts completed successfully. DB backup taken before deploy (368MB, 26.7L lines → `production-db-backup/prod-backup-20260606_170044.sql`).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:58] — Build & push all services (email OTP release)

**What changed:** Built and pushed all 4 services with email OTP changes. Fixed 413 Payload Too Large Harbor push error by moving `tsx` and `prisma` to `dependencies` and using `npm ci --omit=dev` in Dockerfile — removes jest/eslint/typescript from production image (~100MB saved).  
**Files touched:** `MLM-API/package.json`, `MLM-API/Dockerfile`, `azure-kube/build-and-push.sh`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/05-mlm-course-ui-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `azure-kube/k8s/09-mlm-admin-ui-deployment.yaml`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [06-06-2026 16:31] — Password reset & change email OTP

**What changed:** Forgot-password flow now uses email OTP instead of mobile SMS (`/auth/forgot-password/*` accepts `email`). Logged-in password change requires email OTP via new `POST /profile/password/send-otp` and `otp` on `PUT /profile/password`. Updated User UI forgot-password + Security Settings, Course UI forgot-password, and Admin settings page.  
**Files touched:** `MLM-API/src/modules/email/emailService.ts`, `MLM-API/src/routes/auth.ts`, `MLM-API/src/routes/profile.ts`, `MLM-user-ui/user/src/lib/api/auth.ts`, `MLM-user-ui/user/src/app/forgot-password/page.tsx`, `MLM-user-ui/user/src/app/password/page.tsx`, `MLM-course-ui/lib/api.js`, `MLM-course-ui/app/forgot-password/page.jsx`, `MLM-Admin-ui/src/lib/api/auth.ts`, `MLM-Admin-ui/src/app/settings1/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** POST `/api/v1/auth/forgot-password/send-otp`, POST `/api/v1/auth/forgot-password/verify-otp`, POST `/api/v1/auth/forgot-password/reset`, POST `/api/v1/profile/password/send-otp`, PUT `/api/v1/profile/password`  
**Breaking change:** YES (forgot-password uses email; change password requires OTP)  
**Branch:** faizan-dev-contabo-setup  

---


## [07-06-2026 01:02] — Started Admin UI and User UI locally

**What changed:** Started `MLM-Admin-ui` dev server on port 3003 and `MLM-user-ui` dev server on port 3001. Both servers ready and serving locally.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [07-06-2026 01:15] — Global Help Income: show inactive contributors per credit row

**What changed:** `GET /income-history/global-help-income` now returns `inactive_global_contributors` per row (`global_contributors_raw − global_contributors_active` from ledger metadata at credit time). User Global Commission page adds red **Inactive** column, Today summary line, updated help copy, and PDF export column; older credits without metadata show `-`.  
**Files touched:** `MLM-API/src/routes/income-history.ts`, `MLM-user-ui/user/src/lib/api/types.ts`, `MLM-user-ui/user/src/app/income-history/global-help-income/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /api/v1/income-history/global-help-income`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [07-06-2026 01:21] — Production deploy: mlm-api 1.0.257 + mlm-user-ui 1.0.173

**What changed:** Deployed latest Global Help Income release to sia-prod — `mlm-api:1.0.257` and `mlm-user-ui:1.0.173` rollouts configured successfully.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [07-06-2026 01:20] — Build & push mlm-api and mlm-user-ui (Global Help Income)

**What changed:** Built and pushed latest Global Help Income changes — `mlm-api` **1.0.257** and `mlm-user-ui` **1.0.173**. K8s deployment YAMLs updated.  
**Files touched:** `azure-kube/build-and-push.sh`, `azure-kube/k8s/04-mlm-api-deployment.yaml`, `azure-kube/k8s/08-mlm-user-ui-deployment.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 15:20] — User UI: mock data for profile, leaderboard, package, income pages

**What changed:** Removed backend API integration from profile, leaderboard, package (my-course, pay-now), and all income-history pages. Added `src/lib/mock/` modules with dummy data and local mock handlers for reads/writes (profile update, KYC, payment submit, etc.). Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/mock/profile.ts`, `MLM-user-ui/user/src/lib/mock/leaderboard.ts`, `MLM-user-ui/user/src/lib/mock/packages.ts`, `MLM-user-ui/user/src/lib/mock/income.ts`, `MLM-user-ui/user/src/app/profile/page.tsx`, `MLM-user-ui/user/src/app/leaderboard/page.tsx`, `MLM-user-ui/user/src/app/my-course/page.tsx`, `MLM-user-ui/user/src/app/pay-now/page.tsx`, `MLM-user-ui/user/src/app/income-history/self-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/spot-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/direct-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/team-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/global-help-income/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 15:35] — User UI: mock data for add-balance and wallet-history pages

**What changed:** Removed backend API integration from add-balance and wallet-history pages. Extended `mock/packages.ts` with `checkReinvestmentAmount`; added `mock/courses.ts` and `mock/wallet.ts` for course lookup and wallet transaction history dummy data. Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/mock/packages.ts`, `MLM-user-ui/user/src/lib/mock/courses.ts`, `MLM-user-ui/user/src/lib/mock/wallet.ts`, `MLM-user-ui/user/src/app/add-balance/page.tsx`, `MLM-user-ui/user/src/app/wallet-history/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 15:50] — User UI: mock data for all withdrawal pages

**What changed:** Removed backend API integration from all withdraw pages (spot-withdraw-request, list-withdraw-request, overall-withdraw, payment-history, bill). Added `mock/withdrawal.ts` and `mock/bills.ts`; extended `mock/wallet.ts` with `getWalletBalance` and `mock/income.ts` with `getPaymentHistory`. Demo mode allows withdrawal on any date/time. Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/mock/withdrawal.ts`, `MLM-user-ui/user/src/lib/mock/bills.ts`, `MLM-user-ui/user/src/lib/mock/wallet.ts`, `MLM-user-ui/user/src/lib/mock/income.ts`, `MLM-user-ui/user/src/app/withdraw/spot-withdraw-request/page.tsx`, `MLM-user-ui/user/src/app/withdraw/list-withdraw-request/page.tsx`, `MLM-user-ui/user/src/app/withdraw/overall-withdraw/page.tsx`, `MLM-user-ui/user/src/app/withdraw/payment-history/page.tsx`, `MLM-user-ui/user/src/app/withdraw/bill/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 16:05] — User UI: mock login (no backend auth API)

**What changed:** Removed backend API integration from login page. Added `mock/auth.ts` with demo login and transaction-password setup; login uses mock packages for post-login package alerts. Any valid user ID + password logs in as demo user. Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/mock/auth.ts`, `MLM-user-ui/user/src/app/login/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 16:15] — User UI: remove JWT auth (demo session only)

**What changed:** Disabled JWT/Bearer auth across user UI. No `auth_token` storage; session is `auth_user` in localStorage only. Removed axios JWT interceptor, 401 auto-logout redirect, and `/auth/me` token validation on app load. Protected routes check user session, not JWT. Mock login no longer issues tokens. Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/api/client.ts`, `MLM-user-ui/user/src/redux/features/auth/authSlice.ts`, `MLM-user-ui/user/src/lib/mock/auth.ts`, `MLM-user-ui/user/src/app/login/page.tsx`, `MLM-user-ui/user/src/app/providers.tsx`, `MLM-user-ui/user/src/components/auth/ProtectedRoute.tsx`, `MLM-user-ui/user/src/components/topbar.tsx`, `MLM-user-ui/user/src/app/dashboard/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES (user UI no longer sends JWT; real API pages will not authenticate until re-enabled)  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 17:15] — User UI: bypass auth gate; login goes straight to dashboard

**What changed:** Fully disabled route protection for demo UI. `ProtectedRoute` is pass-through; `isAuthenticated()` always true. App auto-loads demo user on startup. Login skips policy/transaction-password modals and redirects immediately to `/dashboard`. Added `demoSession.ts` helper. Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/mock/demoSession.ts`, `MLM-user-ui/user/src/lib/mock/auth.ts`, `MLM-user-ui/user/src/lib/api/client.ts`, `MLM-user-ui/user/src/components/auth/ProtectedRoute.tsx`, `MLM-user-ui/user/src/app/providers.tsx`, `MLM-user-ui/user/src/app/login/page.tsx`, `MLM-user-ui/user/src/components/topbar.tsx`, `MLM-user-ui/user/src/redux/features/auth/authSlice.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** YES  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 17:30] — User UI: mock data for payment and transfer-money pages

**What changed:** Removed backend API integration from pay-now, add-balance, and all transfer-money pages (p2p-transfer, self-transfer, history, fund-transfer-data). Extended `mock/wallet.ts` with transfer history, user lookup, P2P/self transfer, OTP, and rules. Payment pages use `mock/packages` and `mock/courses`. Backend untouched.  
**Files touched:** `MLM-user-ui/user/src/lib/mock/wallet.ts`, `MLM-user-ui/user/src/app/pay-now/page.tsx`, `MLM-user-ui/user/src/app/add-balance/page.tsx`, `MLM-user-ui/user/src/app/transfer-money/p2p-transfer/page.tsx`, `MLM-user-ui/user/src/app/transfer-money/self-transfer/page.tsx`, `MLM-user-ui/user/src/app/transfer-money/history/page.tsx`, `MLM-user-ui/user/src/app/transfer-money/fund-transfer-data/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 17:45] — Admin UI: remove sub-admin features API integration

**What changed:** Removed backend API integration for sub-admin features in admin UI. Added `mock/sub-admins.ts`, `mock/admin-pin.ts`, and `mock/activity-logs.ts` with dummy data. Updated admin-management, sub-admin-activity, sidebar permissions, PIN verification hook/modal, and pages using `getMyPermissions`. Demo runs as SUPER_ADMIN with all permissions; PIN not required. Backend untouched.  
**Files touched:** `MLM-Admin-ui/src/lib/mock/sub-admins.ts`, `MLM-Admin-ui/src/lib/mock/admin-pin.ts`, `MLM-Admin-ui/src/lib/mock/activity-logs.ts`, `MLM-Admin-ui/src/app/master/admin-management/page.tsx`, `MLM-Admin-ui/src/app/master/sub-admin-activity/page.tsx`, `MLM-Admin-ui/src/components/sidebar.tsx`, `MLM-Admin-ui/src/components/ui/PinVerificationModal.tsx`, `MLM-Admin-ui/src/hooks/usePinVerification.tsx`, `MLM-Admin-ui/src/app/dashboard/page.tsx`, `MLM-Admin-ui/src/app/ledger-logs/page.tsx`, `MLM-Admin-ui/src/app/support/pre-questions/page.tsx`, `MLM-Admin-ui/src/app/support/tickets/page.tsx`, `MLM-Admin-ui/src/app/support/tickets/[id]/page.tsx`, `MLM-Admin-ui/src/app/user-management/users-details/page.tsx`, `MLM-Admin-ui/src/app/user-management/users-wallet/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [10-06-2026 14:30] — Admin UI: sub-admin activity mock dates for demo charts

**What changed:** Confirmed `/master/sub-admin-activity` uses `mock/activity-logs` and `mock/sub-admins` (no backend calls). Updated dummy activity log dates to the last 7 days so dashboard charts and filters show sample data in demo mode.  
**Files touched:** `MLM-Admin-ui/src/lib/mock/activity-logs.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---


## [08-06-2026 16:30] — Run MLM-user-ui locally on port 3001

**What changed:** Installed dependencies (`npm install`) and started the Next.js dev server for the user UI on port 3001 (`npm run dev`). App is now serving at http://localhost:3001.  
**Files touched:** None (runtime only)  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 16:36] — MLM-API local backend setup and run

**What changed:** Created `.env` from `env.example` with Docker Postgres (`localhost:5433`), started `mlm-api-v2-db-1` container, ran `npm install`, `prisma generate`, `prisma db push`, seeded levels/fees and partial minimal seed (packages). Added dev `BUNNY_API_KEY` placeholder so server starts. Backend dev server running at `http://localhost:3000`.  
**Files touched:** `MLM-API/.env`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`, `GET /api/v1/packages`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 17:05] — DB setup for updated MLM-API .env (port 5534)

**What changed:** Verified user-updated `.env` (Bunny CDN/Stream, SMTP, `DATABASE_URL` on `localhost:5534/mlm_commission`). Started new Postgres container `mlm-local-5534` on port 5534, ran `prisma db push`, seeded levels (10), fee rules (5), packages (3), and withdrawal rules (1). Restarted backend on port 3000 against new DB.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`, `GET /api/v1/packages`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---


## [08-06-2026 17:30] — Restore prod backup to local DB (port 5534)

**What changed:** Restored `MLM-API/db-backup/prod-backup-20260606_170044.sql` into `mlm-local-5534` (`mlm_commission` on `localhost:5534`). Dropped/recreated DB, imported ~356MB dump, ran `prisma db push --accept-data-loss` for indexes/constraints, reset sequences. Prod data loaded: 3110 users, 13 packages, 1.3M+ ledger entries. Note: backup file is truncated at end of `wallet_transactions` COPY (no `\.` footer). Backend restarted on port 3000.  
**Files touched:** `MLM-API/db-backup/restore-log.txt`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`, `GET /api/v1/packages`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---
## [08-06-2026 17:28] — Run Swagger locally on port 4005

**What changed:** Set local `PORT=4005` in `MLM-API/.env` and started dev server. Swagger UI available at `http://localhost:4005/docs`; OpenAPI JSON at `http://localhost:4005/docs/json`. Static spec files remain in `MLM-API/swagger/` (`openapi.json`, `openapi.yaml`).  
**Files touched:** `MLM-API/.env`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`, `GET /docs`, `GET /docs/json`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 17:45] — User UI login page backend integration

**What changed:** Wired login page to real API (`POST /auth/login`) instead of mock auth. Re-enabled JWT token storage/sending in API client, restored Redux auth token handling, and removed auto demo session on app load. Post-login flow: policy agreement → transaction PIN (if missing) → package alerts → dashboard. Added `.env.local` pointing to `http://localhost:4005/api/v1`. No backend changes.  
**Files touched:** `MLM-user-ui/user/src/app/login/page.tsx`, `MLM-user-ui/user/src/lib/api/client.ts`, `MLM-user-ui/user/src/redux/features/auth/authSlice.ts`, `MLM-user-ui/user/src/app/providers.tsx`, `MLM-user-ui/user/.env.local`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/login`, `POST /api/v1/profile/transaction-pin/set`, `GET /api/v1/my-packages`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 18:05] — User UI profile page backend integration

**What changed:** Switched profile page from `@/lib/mock/profile` to real API modules (`@/lib/api/kyc`, `@/lib/api/fees`). Profile load, KYC, photo upload, name-change OTP, bank check, and fee display now hit backend. No backend changes.  
**Files touched:** `MLM-user-ui/user/src/app/profile/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /api/v1/profile`, `GET /api/v1/users/:id/kyc/status`, `PUT /api/v1/profile`, `POST /api/v1/user/profile/photo`, `POST /api/v1/user/kyc/document`, `POST /api/v1/users/:id/kyc/submit`, `GET /api/v1/fees/rules`, `POST /api/v1/profile/name-change/send-otp`, `POST /api/v1/profile/name-change/verify-otp`, `GET /api/v1/profile/check-account-number`  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 18:12] — Fix Topbar hydration mismatch (auth user name)

**What changed:** Stopped reading `localStorage` in Redux auth initial state so SSR and first client render match. Session still restored in `AuthInitializer` via `useEffect`. Fixed Topbar avatar `useState` initializer that also read `localStorage` during render.  
**Files touched:** `MLM-user-ui/user/src/redux/features/auth/authSlice.ts`, `MLM-user-ui/user/src/components/topbar.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 18:20] — Root .gitignore setup for monorepo

**What changed:** Expanded root `.gitignore` for node_modules, env/secrets, build outputs, DB backups/dumps, Python venv, logs, and IDE files. Fixed `MLM-API/.gitignore` to stop force-including all `*.sql` (which pulled in 350MB+ prod backups).  
**Files touched:** `.gitignore`, `MLM-API/.gitignore`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** faizan-dev-contabo-setup  

---

## [08-06-2026 18:28] — Fix GitHub push (remove 356MB SQL from history)

**What changed:** Rewrote git history with a clean orphan commit excluding `MLM-API/db-backup/prod-backup-*.sql`, `.env.backup*` files, and `node_modules`. Push to `origin/main` succeeded. Removed `payment-gateway/secretKey` from repo and added to `.gitignore`.  
**Files touched:** `.gitignore`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** main  

---

## [09-06-2026 11:06] — Fix local pgAdmin DB connection timeout (5534)

**What changed:** Diagnosed pgAdmin "connection timeout" on `localhost:5534` — password was correct but Postgres container `mlm-local-5534` was stopped (nothing listening on 5534). Started the container; verified `mlm_user` / `mlm_commission` accepts connections and prod data (3110 users) is reachable on port 5534. Noted separate running DB `mlm-api-v2-db-1` on port 5433 (postgres/postgres/mlm) explains API health showing `localhost:5433`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:11] — Start local MLM user-ui frontend

**What changed:** Started `MLM-user-ui` Next.js dev server on port 3001. Added `MLM-user-ui/user/.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1` so the UI talks to the local API on 3000. Verified dev server ready on `http://localhost:3001`.  
**Files touched:** `MLM-user-ui/user/.env.local`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:16] — Swagger UI available locally

**What changed:** Verified MLM-API Swagger UI is live at `http://localhost:3000/docs` (HTTP 200). Regenerated static spec files (`swagger/openapi.json`, `swagger/openapi.yaml`) with 257 API paths via `npm run swagger:generate`.  
**Files touched:** `MLM-API/swagger/openapi.json`, `MLM-API/swagger/openapi.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /docs`, `GET /docs/json`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:20] — Swagger on port 4005

**What changed:** Started `MLM-API` dev server with `.env` `PORT=4005`. Swagger UI verified at `http://localhost:4005/docs` (HTTP 200); health returns `db: localhost:5534`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /docs`, `GET /health`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:23] — Fix login 401 (wrong API port/DB)

**What changed:** Diagnosed login failure for `SIA02000`: user exists in `mlm-local-5534` (`localhost:5534`) with password `123123`, but frontend called API on port 3000 which uses DB `localhost:5433` (different empty/seed DB). Login succeeds on port 4005. Updated `MLM-user-ui/user/.env.local` to `http://localhost:4005/api/v1` and restarted user-ui dev server on 3001.  
**Files touched:** `MLM-user-ui/user/.env.local`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/login`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:33] — Leaderboard page API integration

**What changed:** Switched `/leaderboard` page from mock data (`lib/mock/leaderboard`) to real API (`lib/api/leaderboard`). Calls `GET /leaderboard/top-earners` and `GET /leaderboard/my-position` with category/period filters; improved error handling via `getUserFriendlyError`. No backend changes.  
**Files touched:** `MLM-user-ui/user/src/app/leaderboard/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /api/v1/leaderboard/top-earners`, `GET /api/v1/leaderboard/my-position`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:42] — My Packages page API integration

**What changed:** Switched `/my-course` (My Packages) from mock (`lib/mock/packages`) to real API (`lib/api/packages`). Uses `GET /my-packages`, `GET /my-packages/{id}`, and `GET /packages` for list, details, and renewal/upgrade options. Improved error handling via `getUserFriendlyError`. No backend changes.  
**Files touched:** `MLM-user-ui/user/src/app/my-course/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /api/v1/my-packages`, `GET /api/v1/my-packages/{id}`, `GET /api/v1/packages`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:48] — Withdraw section API integration

**What changed:** Switched all 5 withdraw pages from mock to real API (no backend changes). `spot-withdraw-request`: withdrawal + dashboard wallet + KYC profile. `list-withdraw-request` & `overall-withdraw`: withdrawal requests list. `payment-history`: payment history ledger API. `bill`: bills + invoice + bond + profile APIs.  
**Files touched:** `MLM-user-ui/user/src/app/withdraw/spot-withdraw-request/page.tsx`, `MLM-user-ui/user/src/app/withdraw/list-withdraw-request/page.tsx`, `MLM-user-ui/user/src/app/withdraw/overall-withdraw/page.tsx`, `MLM-user-ui/user/src/app/withdraw/payment-history/page.tsx`, `MLM-user-ui/user/src/app/withdraw/bill/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET/POST /api/v1/withdraw/requests`, `GET /api/v1/withdraw/rules`, `GET /api/v1/dashboard/wallet`, `GET /api/v1/profile`, `GET /api/v1/payment-history`, `GET /api/v1/bills`, `GET /api/v1/invoices/{id}`, `GET/POST /api/v1/users/bond/*`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 11:55] — Income history pages API integration

**What changed:** Switched 5 sidebar income history pages from mock (`lib/mock/income`) to real API (`lib/api/ledger`): self-income, direct-income, team-income, global-help-income, spot-income. Improved error handling via `getUserFriendlyError`. No backend changes. Note: `/income-history/bill` (not in sidebar) still uses inline mock data.  
**Files touched:** `MLM-user-ui/user/src/app/income-history/self-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/direct-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/team-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/global-help-income/page.tsx`, `MLM-user-ui/user/src/app/income-history/spot-income/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /api/v1/income-history/self-income`, `GET /api/v1/income-history/direct-income`, `GET /api/v1/income-history/team-income`, `GET /api/v1/income-history/global-help-income`, `GET /api/v1/income-history/spot-income`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 15:37] — Verify local MLM-API backend running

**What changed:** Verified local backend already running: `MLM-API` on port 4005 (`/health` → `db: localhost:5534`), Postgres `mlm-local-5534` up, Swagger `/docs` HTTP 200. Note: stale API instance also on port 3000 (`db: localhost:5433`) — use 4005 for prod dump DB.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`, `GET /docs`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 16:27] — Curl test withdraw request SIA02000

**What changed:** Tested `POST /api/v1/withdraw/requests` via curl for user `SIA02000` (main wallet ₹1000, transaction pin `123456`). Login succeeded; create returned 400 `pending_withdrawal_exists` — existing pending main-wallet request id `1` (₹29999.97). Verified with `GET /api/v1/withdraw/requests?status=pending&withdraw_type=wallet`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/login`, `POST /api/v1/withdraw/requests`, `GET /api/v1/withdraw/requests`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 16:44] — Spot wallet withdraw request SIA02000

**What changed:** Created spot wallet withdrawal via API for `SIA02000`: ₹1000 UPI, transaction pin verified. Request id `2`, status `pending`, user_id `1898`. No prior pending spot request existed.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/login`, `POST /api/v1/withdraw/requests` (`withdraw_type=spot`)  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 16:39] — Start MLM Admin UI locally on port 3003

**What changed:** Port 3003 was already free. Created `MLM-Admin-ui/.env.local` pointing API to `http://localhost:4005/api/v1`, installed dependencies, and started Next.js dev server on port 3003. Homepage verified (HTTP 200).  
**Files touched:** `MLM-Admin-ui/.env.local`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 16:45] — Main wallet withdraw request SIA02000 ₹2000

**What changed:** Created main wallet (`withdraw_type=wallet`) withdrawal via API for `SIA02000`: ₹2000 UPI. Prior pending main-wallet request was cleared; new request id `3`, status `pending`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/login`, `POST /api/v1/withdraw/requests`, `GET /api/v1/withdraw/requests`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 16:58] — Fix Swagger auth on withdraw endpoints

**What changed:** Added `security: bearerAuth` to all user withdraw route schemas so Swagger UI sends JWT after Authorize. Added `transaction_password` to POST body schema. Fixed bearerAuth description to `POST /api/v1/auth/login`. Regenerated `openapi.json` / `openapi.yaml`.  
**Files touched:** `MLM-API/src/routes/withdraw.ts`, `MLM-API/src/app.ts`, `MLM-API/swagger/openapi.json`, `MLM-API/swagger/openapi.yaml`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 17:07] — Show dev OTP on New Join registration page

**What changed:** Non-production `POST /api/v1/auth/email-otp/send` now returns `dev_otp` in response. New Join page shows amber dev-mode OTP banner after Get OTP. Updated `sendEmailOTP` client type.  
**Files touched:** `MLM-API/src/routes/auth.ts`, `MLM-user-ui/user/src/lib/api/auth.ts`, `MLM-user-ui/user/src/app/new-join/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/auth/email-otp/send`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 17:18] — Restart local MLM-API backend

**What changed:** Stopped old process on port 4005 and restarted `npm run dev` in MLM-API. Server is up at `http://localhost:4005`; health check returns `{ status: "ok", db: "localhost:5534" }`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 17:24] — Start local MLM-user-ui frontend

**What changed:** Stopped hung process on port 3001 and started `npm run dev` in `MLM-user-ui/user`. User frontend is up at `http://localhost:3001` (API base: `http://localhost:4005/api/v1`).  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [09-06-2026 17:32] — Fix withdraw.ts Fastify response schema TypeScript errors

**What changed:** Added shared `apiErrorResponse` / `apiNotFoundResponse` schemas and declared missing HTTP status codes (400, 403, 404, 500) on withdraw route `response` blocks so `reply.code()` matches Fastify typings. Resolved all 9 TS errors in `withdraw.ts`.  
**Files touched:** `MLM-API/src/routes/withdraw.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 10:27] — Start MLM-API backend locally

**What changed:** Started Docker Desktop and Postgres container `mlm-local-5534` (port 5534). Launched `MLM-API` dev server on port 4005; health check returns `{ status: "ok", db: "localhost:5534" }`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** GET `/health`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 10:30] — Start MLM-user-ui locally

**What changed:** Started `MLM-user-ui` Next.js dev server on port 3001 (`npm run dev` in `MLM-user-ui/user`). Verified homepage HTTP 200. API base URL from `.env.local`: `http://localhost:4005/api/v1`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 10:33] — Start MLM-Admin-ui locally

**What changed:** Started `MLM-Admin-ui` Next.js dev server on port 3003 (`npm run dev`). Verified homepage HTTP 200. API base URL from `.env.local`: `http://localhost:4005/api/v1`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 10:51] — Wire MLM-user-ui payment pages to real API

**What changed:** Replaced mock imports with real API modules on `add-balance`, `pay-now`, and `wallet-history`. Manual deposit now calls `POST /deposit/manual`, payment proof upload uses `/deposit/payment-proof`, packages/bank/course data from backend. Fixed `add-balance` package dropdown to use package IDs (not price). No backend changes.  
**Files touched:** `MLM-user-ui/user/src/app/add-balance/page.tsx`, `MLM-user-ui/user/src/app/pay-now/page.tsx`, `MLM-user-ui/user/src/app/wallet-history/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** GET `/packages`, GET `/my-packages`, GET `/company-bank/active`, GET `/courses/by-package/:id`, POST `/deposit/payment-proof`, POST `/deposit/manual`, GET `/deposit/check-utr`, POST `/purchases/reinvestment/check`, GET `/users/:id/wallet/transactions`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 14:16] — Payment pages real API integration

**What changed:** Switched `pay-now` and `add-balance` from `@/lib/mock/*` to real API modules (`@/lib/api/packages`, `@/lib/api/company-bank`, `@/lib/api/courses`). Manual deposit, UTR check, payment proof upload, packages, bank details, and course lookup now hit backend. `pay-now` gateway tab fixed to use package IDs (not price) and redirects to course app checkout like `add-balance`. No backend changes.  
**Files touched:** `MLM-user-ui/user/src/app/pay-now/page.tsx`, `MLM-user-ui/user/src/app/add-balance/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** GET `/packages`, GET `/my-packages`, GET `/company-bank/active`, GET `/courses/by-package/:id`, POST `/deposit/payment-proof`, POST `/deposit/manual`, GET `/deposit/check-utr`, POST `/purchases/reinvestment/check`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 15:27] — Swagger auth for deposit endpoints

**What changed:** Added `security: bearerAuth` to deposit Swagger schemas so Authorize sends JWT on `POST /deposit/payment-proof`, `POST /deposit/manual`, and `GET /deposit/check-utr`. Payment-proof now documents multipart `file` upload in Swagger UI. No runtime API behavior change.  
**Files touched:** `MLM-API/src/routes/manual-deposit.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** POST `/deposit/payment-proof`, POST `/deposit/manual`, GET `/deposit/check-utr`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 15:32] — Restart MLM-API locally

**What changed:** Stopped prior API process on port 4005 and restarted `npm run dev` in `MLM-API`. Verified server listening at `http://localhost:4005` and Swagger `/docs` returns HTTP 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 15:52] — Admin Management real API integration

**What changed:** Switched Admin Management page from mock data to real backend API calls for sub-admin CRUD, permissions, and PIN management. No backend changes.  
**Files touched:** `MLM-Admin-ui/src/app/master/admin-management/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** GET `/admin/permissions`, GET `/admin/sub-admins`, GET `/admin/sub-admins/:id`, POST `/admin/sub-admins`, PUT `/admin/sub-admins/:id`, DELETE `/admin/sub-admins/:id`, POST `/admin/pin/set`, POST `/admin/pin/reset`, GET `/admin/pin/info/:sub_admin_id`, POST `/admin/pin/unlock`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:05] — Swagger auth for sub-admin and PIN routes

**What changed:** Added `security: [{ bearerAuth }, { adminAuth }]` to Fastify schemas for all Admin Sub-Admins and Admin PIN routes so Swagger UI sends the Authorization header after Authorize. No runtime API behavior change.  
**Files touched:** `MLM-API/src/routes/admin-sub-admins.ts`, `MLM-API/src/routes/admin-pin.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None (Swagger schema only)  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:12] — Restart MLM-API locally

**What changed:** Stopped prior API process on port 4005 and restarted `npm run dev` in `MLM-API`. Verified server listening at `http://localhost:4005` and Swagger `/docs` returns HTTP 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:18] — Fix admin-pin TypeScript schema errors

**What changed:** Typed `adminRouteSecurity` for Fastify `security` and added shared error response schemas (400/401/404/423/500) to admin PIN routes so `reply.code()` calls type-check correctly.  
**Files touched:** `MLM-API/src/routes/admin-pin.ts`, `MLM-API/src/routes/admin-sub-admins.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:28] — Sub Admin Activity real API integration

**What changed:** Switched Sub Admin Activity page from mock data to real backend API calls for activity logs, sub-admin filter dropdown, and SUPER_ADMIN role check. No backend changes.  
**Files touched:** `MLM-Admin-ui/src/app/master/sub-admin-activity/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** GET `/admin/activity-logs`, GET `/admin/sub-admins`, GET `/admin/my-permissions`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:35] — Restart MLM-API locally

**What changed:** Stopped prior API process on port 4005 and restarted `npm run dev` in `MLM-API`. Verified server listening at `http://localhost:4005` and Swagger `/docs` returns HTTP 200.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:42] — Swagger auth for activity-logs route

**What changed:** Added `security: [{ bearerAuth }, { adminAuth }]` to Fastify schema for `GET /admin/activity-logs` so Swagger UI sends Authorization header after Authorize. No runtime API behavior change.  
**Files touched:** `MLM-API/src/routes/admin-activity-logs.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None (Swagger schema only)  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [10-06-2026 16:48] — Fix admin-activity-logs TypeScript schema errors

**What changed:** Added shared 400/500 error response schemas to activity-logs route so `reply.code()` calls type-check correctly with Fastify.  
**Files touched:** `MLM-API/src/routes/admin-activity-logs.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 10:25] — Start MLM-API backend locally

**What changed:** Started Docker Desktop and Postgres container `mlm-local-5534` (port 5534). Launched `MLM-API` dev server via `npm run dev` on port 4005; health check returns `{ status: "ok", db: "localhost:5534" }`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 10:30] — Start MLM Admin UI locally on port 3003

**What changed:** Created `MLM-Admin-ui/.env.local` pointing API to `http://localhost:4005/api/v1` and started Next.js dev server on port 3003. Homepage verified (HTTP 200).  
**Files touched:** `MLM-Admin-ui/.env.local`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 10:32] — Start MLM User UI locally on port 3001

**What changed:** Created `MLM-user-ui/user/.env.local` pointing API to `http://localhost:4005/api/v1` and started Next.js dev server on port 3001. Homepage verified (HTTP 200).  
**Files touched:** `MLM-user-ui/user/.env.local`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 11:15] — Swagger bearerAuth on bills endpoints

**What changed:** Added `security: [{ bearerAuth: [] }]` to `GET /api/v1/bills` and `GET /api/v1/invoices/:id` so Swagger UI sends the user JWT after Authorize. Clarified in descriptions that admin login token is not valid for these routes.  
**Files touched:** `MLM-API/src/routes/bills.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 11:45] — Fix bills route TypeScript response schema errors

**What changed:** Added shared `500` error response schema to `GET /api/v1/bills` and `GET /api/v1/invoices/:id` so `reply.code(500)` type-checks with Fastify.  
**Files touched:** `MLM-API/src/routes/bills.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 12:20] — Fix payment proof upload 400 on manual deposit

**What changed:** Set `body: false` on `POST /api/v1/deposit/payment-proof` so Fastify skips JSON body validation for multipart uploads (fixes 400 before file handler runs). Improved Buy More error modal to show API `message` via `getUserFriendlyError` instead of generic axios text.  
**Files touched:** `MLM-API/src/routes/manual-deposit.ts`, `MLM-user-ui/user/src/app/add-balance/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/deposit/payment-proof`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 12:35] — Fix manual-deposit route TypeScript response schemas

**What changed:** Added shared `400`/`404`/`500` response schemas to deposit routes (`payment-proof`, `manual`, `check-utr`) so `reply.code()` calls type-check with Fastify.  
**Files touched:** `MLM-API/src/routes/manual-deposit.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 12:50] — Idempotent admin withdrawal approve (fix 500 on retry)

**What changed:** Fixed `POST /api/v1/admin/withdraw/requests/:id/approve` returning 500 when ledger row already exists for `withdraw:approve:{id}` (partial prior approve). Recovery path completes approval without double wallet deduction; P2002 idempotency race handled. Admin UI shows API error message on 500 instead of generic text.  
**Files touched:** `MLM-API/src/routes/admin-withdraw.ts`, `MLM-Admin-ui/src/lib/api/withdraw.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** `POST /api/v1/admin/withdraw/requests/:id/approve`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [11-06-2026 13:10] — Admin withdraw route TypeScript response schemas

**What changed:** Finished Fastify response schema typing for all admin withdraw routes: shared `adminWithdrawErrorResponse` / `adminWithdrawServerError` on get-by-id, approve, reject, history, and wallet-transfers; removed dead `approved` branch in idempotent approve recovery (status already narrowed to `pending`). All linter errors in `admin-withdraw.ts` resolved.  
**Files touched:** `MLM-API/src/routes/admin-withdraw.ts`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [12-06-2026 14:18] — Start MLM-API locally

**What changed:** Started Docker Desktop and Postgres container `mlm-local-5534` (port 5534). Launched `MLM-API` dev server via `npm run dev` on port 4005; health check returns `{ status: "ok", db: "localhost:5534" }`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [12-06-2026 14:21] — Start MLM-user-ui locally

**What changed:** Freed port 3001 (was occupied by unrelated `cdpl-ui` Next.js app). Started `MLM-user-ui` dev server via `npm run dev` on port 3001; verified HTTP 200 on `/`. API base URL in `.env.local` points to `http://localhost:4005/api/v1`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [12-06-2026 14:31] — Start MLM-Admin-ui locally

**What changed:** Started `MLM-Admin-ui` dev server via `npm run dev` on port 3003; verified HTTP 200 on `/`. API base URL in `.env.local` points to `http://localhost:4005/api/v1`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [12-06-2026 15:10] — Admin UI: package-setting mock integration

**What changed:** Removed backend API integration from `/master/package-setting`. Added `mock/packages.ts` with dummy packages (Starter, Growth, Premium) and local handlers for list, get, create, update, and delete. Page imports switched from `lib/api/packages` to `lib/mock/packages`. UI unchanged; backend untouched.  
**Files touched:** `MLM-Admin-ui/src/lib/mock/packages.ts`, `MLM-Admin-ui/src/app/master/package-setting/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 10:54] — Start MLM-API locally

**What changed:** Started Docker Desktop and Postgres container `mlm-local-5534` (port 5534). Launched `MLM-API` dev server via `npm run dev` on port 4005; health check returns `{ status: "ok", db: "localhost:5534" }`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /health`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 10:57] — Start MLM-Admin-ui locally

**What changed:** Started `MLM-Admin-ui` dev server via `npm run dev` on port 3003; verified HTTP 200 on `/`. API base URL in `.env.local` points to `http://localhost:4005/api/v1`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 10:59] — Start MLM-user-ui locally

**What changed:** Started `MLM-user-ui` dev server via `npm run dev` on port 3001; verified HTTP 200 on `/`. API base URL in `.env.local` points to `http://localhost:4005/api/v1`.  
**Files touched:** `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 11:12] — Package-setting real API integration

**What changed:** Wired `/master/package-setting` to real backend via `lib/api/packages` (replaced `lib/mock/packages`). List, get, create, update, and delete now call admin package endpoints with JWT auth. No backend changes.  
**Files touched:** `MLM-Admin-ui/src/app/master/package-setting/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** `GET /api/v1/admin/packages`, `GET /api/v1/admin/packages/{id}`, `POST /api/v1/admin/packages`, `PUT /api/v1/admin/packages/{id}`, `DELETE /api/v1/admin/packages/{id}`  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 11:25] — Admin UI: fee-rules mock integration

**What changed:** Removed backend API integration from `/master/fee-rules`. Added `mock/feeRules.ts` with dummy fee rules (KYC, bond download, withdrawal, support, OTP, etc.) and local handlers for list, create, update, and delete. Page imports switched from `lib/api/feeRules` to `lib/mock/feeRules`. UI unchanged; backend untouched.  
**Files touched:** `MLM-Admin-ui/src/lib/mock/feeRules.ts`, `MLM-Admin-ui/src/app/master/fee-rules/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 11:40] — Admin UI: company-bank mock integration

**What changed:** Removed backend API integration from `/master/company-bank`. Added `mock/companyBank.ts` with dummy bank accounts (Bank Of India, HDFC) and local handlers for list, create, update, delete, and QR upload (base64 preview). Page imports switched from `lib/api/companyBank` to `lib/mock/companyBank`. UI unchanged; backend untouched.  
**Files touched:** `MLM-Admin-ui/src/lib/mock/companyBank.ts`, `MLM-Admin-ui/src/app/master/company-bank/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---

## [15-06-2026 11:55] — Admin UI: levels mock integration

**What changed:** Removed backend API integration from `/master/levels`. Added `mock/levels.ts` with dummy levels 0–9 (Field Worker through King) including spot/monthly commission and business requirements. Local handlers for list and update. Page imports switched from `lib/api/levels` to `lib/mock/levels`. UI unchanged; backend untouched.  
**Files touched:** `MLM-Admin-ui/src/lib/mock/levels.ts`, `MLM-Admin-ui/src/app/master/levels/page.tsx`, `changelog-faizan/changelog.md`  
**API endpoints used:** None  
**Breaking change:** NO  
**Branch:** zoya-dev  

---
