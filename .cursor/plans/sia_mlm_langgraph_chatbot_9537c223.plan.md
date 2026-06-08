---
name: SIA MLM LangGraph Chatbot
overview: Build a new `mlm-chat-engine/` FastAPI + LangGraph service with fetch-stream SSE chat, direct Postgres connectivity to the same SIA database for real-time reads, Redis-backed session memory, Gemini 2.5 Pro function-calling, and a role/permission-aware tool layer (user + admin) with CONFIRM-gated write actions.
todos:
  - id: repo-scaffold
    content: Scaffold `mlm-chat-engine/` FastAPI + LangGraph project with Gemini client + structured logging
    status: completed
  - id: sse-api
    content: "Define SSE endpoints: `/chat/stream`, `/chat/confirm`, `/chat/upload`, `/chat/sessions` with fetch-stream compatible response framing"
    status: completed
  - id: auth
    content: Implement JWT verification using shared `JWT_SECRET`; derive `user_id`, `role`, and admin permissions
    status: completed
  - id: redis
    content: Add Redis session memory (20 turns, 24h TTL) + docker-compose + kube manifests
    status: completed
  - id: tools-read
    content: Implement read tools using direct Postgres queries aligned to Prisma schema and business rules from MLM-API
    status: completed
  - id: tools-write
    content: Implement write tools as JWT-forwarded calls to MLM-API endpoints; add CONFIRM gate node
    status: completed
  - id: ui-widget-user
    content: Integrate ChatWidget into `MLM-user-ui-/user` using fetch streaming + image upload + confirmation UI
    status: completed
  - id: ui-widget-admin
    content: Integrate ChatWidget into `MLM-Admin-ui` with admin tool availability and permission-aware UI
    status: completed
  - id: tests
    content: Add unit + integration tests (JWT, routing, tool schemas, confirmation, smoke tests vs local DB seeded from dump)
    status: completed
  - id: deploy
    content: Add deployment manifests (kube/compose), env wiring for DATABASE_URL, REDIS_URL, JWT_SECRET, GEMINI_API_KEY
    status: completed
isProject: false
---

## Goals
- Add a **chatbot API server** inside this monorepo at `mlm-chat-engine/`.
- Use **SSE streaming over fetch** (`POST /chat/stream`) for browser → server chat.
- Connect the chatbot server to the **same PostgreSQL database** as `MLM-API` for real-time read knowledge.
- Implement **tool/function calling** per `Ai-plan.md` (27 user tools + 10 admin tools) with strong schemas.
- Allow **both user + admin write actions** in v1, but gated by explicit `CONFIRM` and admin permission checks.
- Use **Redis** for session memory (rolling last 20 turns, TTL 24h).
- Use **Gemini via `GEMINI_API_KEY`**.

## Key design decisions (from your answers)
- **Service location**: new folder `[mlm-chat-engine/](mlm-chat-engine/)`.
- **DB access**: **direct DB connection** using `DATABASE_URL` pointing to the same Postgres as `MLM-API`.
- **JWT**: verify with the same `JWT_SECRET` as `MLM-API`.
- **Redis**: added as part of infra (compose + kube manifests).
- **SSE transport**: fetch-stream SSE so we can send `Authorization: Bearer <JWT>`.
- **Writes in v1**: user + admin writes allowed with explicit confirmation.
- **No RAG**: the full `[Ai-plan.md](Ai-plan.md)` content is injected into the system prompt.

## Safety/consistency rule for write actions
Even with direct DB access enabled, **all write actions that affect money / eligibility / purchases / withdrawals** should be executed by calling existing `MLM-API` endpoints (JWT-forwarded) rather than writing DB rows directly.
- Reason: `MLM-API` already implements advisory locks, idempotency keys, wallet routing, holds, caps, and audit logs (see `[MLM-API/src/utils/wallet.ts](MLM-API/src/utils/wallet.ts)`, `[MLM-API/src/routes/withdraw.ts](MLM-API/src/routes/withdraw.ts)`, `[MLM-API/src/routes/p2p-transfer.ts](MLM-API/src/routes/p2p-transfer.ts)`, `[MLM-API/src/routes/admin-commissions.ts](MLM-API/src/routes/admin-commissions.ts)`).
- Result: chatbot stays “in sync” (reads are direct DB) while writes remain correct and compliant.

## API contract (chat service)
- `POST /chat/stream` (SSE)
  - Request: `{ message: string, attachments?: [{type, url}], conversation_id?: string }`
  - Response: `Content-Type: text/event-stream` with events:
    - `message_delta`
    - `tool_call`
    - `tool_result` (sanitized)
    - `confirmation_required` (includes parsed action params)
    - `final`
- `POST /chat/confirm` (JSON)
  - Request: `{ conversation_id, confirmation_token, confirm: true, transaction_pin?: string }`
  - Server continues the paused graph and streams the result.
- `POST /chat/upload`
  - Multipart image upload → stored (Bunny CDN or existing media storage) → returns `{url}`.
- `GET /chat/sessions`
  - Returns last N conversations for the authenticated user (from Redis).

## LangGraph workflow
- Node: `ingest`
  - Verify JWT with `JWT_SECRET`, derive `user_id`, `role`, and (if admin) load permissions.
- Node: `router`
  - Gemini intent classification using Section K in `[Ai-plan.md](Ai-plan.md)`.
- Node: `planner`
  - Produce tool calls with strict JSON schemas.
- Node: `tool_executor`
  - Execute tools in parallel; for reads use direct DB; for writes call `MLM-API`.
- Node: `confirmation_gate`
  - If tool is write-type, emit `confirmation_required` and pause.
- Node: `respond`
  - Compose bilingual answer, include relevant IDs (`display_id`) and amounts with ₹ formatting.
- Node: `persist`
  - Append turn to Redis `chat:session:{user_id}`.

## Tool layer implementation
- **Read tools (direct DB)**
  - Implement the 27 user tools + admin read tools with SQL queries aligned to the schema in `[MLM-API/prisma/schema.prisma](MLM-API/prisma/schema.prisma)` and the dump tables.
  - Use the same business definitions as `MLM-API`:
    - active purchase = `purchases.income < 2 * purchases.amount`
    - downline/upline via `user_tree_paths`
    - holds via `ledger_entries.metadata->>'hold_until'`
- **Write tools (call MLM-API)**
  - User writes: `createWithdrawalRequest`, `createP2PTransfer`, `raiseSupportTicket`
  - Admin writes: `adminAdjustWallet`, `adminApproveWithdrawal`, `adminRejectWithdrawal`, `adminAssignPackage`, `adminApprovePurchaseRequest`, `adminRecomputeEligibility`, etc.
  - Forward caller JWT to `MLM-API` so existing role/permission checks apply.

## Infra & local dev
- Add `mlm-chat-engine/docker-compose.yml`:
  - `chat-engine` + `redis` service
  - reuse existing Postgres (same `DATABASE_URL` as `MLM-API`) or allow pointing to local
- Add Kubernetes manifests under `azure-kube/` (or a new `mlm-chat-engine/infra/kube/`) for:
  - Deployment + Service for chat-engine
  - Redis Deployment + Service
  - Secrets: `JWT_SECRET`, `GEMINI_API_KEY`, `DATABASE_URL`, `REDIS_URL`

## UI integration (both apps)
- Add a `ChatWidget` client component:
  - `[MLM-user-ui-/user](MLM-user-ui-/user)` and `[MLM-Admin-ui](MLM-Admin-ui)`
  - Uses fetch streaming to `/chat/stream`
  - Supports image attachment upload via `/chat/upload`
  - Implements confirmation UI (shows card → user clicks confirm → POST `/chat/confirm`)

## Testing plan (engineering)
- Unit tests for:
  - JWT decode + role detection
  - router intent classification (golden prompts)
  - tool schema validation
  - confirmation gate behaviour
- Integration tests (local):
  - Connect to a local DB seeded from `production-db-backup/prod-backup-20260425_114114.sql`
  - Smoke-test key questions: wallet, withdrawals, pending commissions, level progress

## Key files to reference during implementation
- Knowledge base: `[Ai-plan.md](Ai-plan.md)`
- DB schema: `[MLM-API/prisma/schema.prisma](MLM-API/prisma/schema.prisma)`
- Commission logic: `[MLM-API/src/modules/commissions/commission.service.ts](MLM-API/src/modules/commissions/commission.service.ts)`
- Eligibility: `[MLM-API/src/modules/commissions/eligibility.compute.ts](MLM-API/src/modules/commissions/eligibility.compute.ts)`
- Wallet correctness: `[MLM-API/src/utils/wallet.ts](MLM-API/src/utils/wallet.ts)`
- Withdraw rules: `[MLM-API/src/routes/withdraw.ts](MLM-API/src/routes/withdraw.ts)` and `[MLM-API/src/utils/withdrawal-date.ts](MLM-API/src/utils/withdrawal-date.ts)`
- P2P rules: `[MLM-API/src/routes/p2p-transfer.ts](MLM-API/src/routes/p2p-transfer.ts)`
- Admin tools: `[MLM-API/src/routes/admin-commissions.ts](MLM-API/src/routes/admin-commissions.ts)`, `[MLM-API/src/routes/admin-user-packages.ts](MLM-API/src/routes/admin-user-packages.ts)`, `[MLM-API/src/routes/admin-purchase-requests.ts](MLM-API/src/routes/admin-purchase-requests.ts)`

## Deliverables
- `mlm-chat-engine/` service with SSE streaming + LangGraph + Gemini tool calling
- Redis session memory
- Tool layer (read direct DB, write via MLM-API)
- Chat widgets in both UIs
- Compose + kube manifests

