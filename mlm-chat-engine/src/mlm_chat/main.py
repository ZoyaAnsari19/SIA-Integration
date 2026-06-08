from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import AsyncGenerator
import uuid
import re
import time
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from .auth import parse_bearer_token, verify_jwt, auth_context_from_jwt_payload
from .admin_settings import AiSettingsStore
from .config import load_settings
from .db import Db
from .llm.gemini import GeminiClient
from .memory.redis_session import RedisSessionStore
from .models import (
    ChatStreamRequest,
    ChatConfirmRequest,
    ChatConversationListItem,
    ChatConversationTurnsResponse,
    ChatConversationRenameRequest,
)
from .tools.registry import build_tool_registry
from .tools.types import ToolContext
from .utils.logging import setup_logging
from .hinglish_router import plan_deterministic_tools


setup_logging()
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="SIA MLM Chat Engine", version="0.1.0")

# Allow local dev UIs + (optional) stage/prod domains to call chat-engine.
_extra_origins: list[str] = []
try:
    _raw = os.environ.get("CORS_ORIGINS", "") or ""
    _extra_origins = [o.strip() for o in _raw.split(",") if o.strip()]
except Exception:
    _extra_origins = []
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3003",
        "http://127.0.0.1:3003",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_system_prompt() -> str:
    tpl = Path(__file__).resolve().parent / "prompts" / "system_prompt.md"
    prompt = tpl.read_text(encoding="utf-8")

    # Find Ai-plan.md across known locations (local repo, Docker image /app).
    candidates = [
        Path(__file__).resolve().parents[3] / "Ai-plan.md",  # local repo root
        Path("/app/Ai-plan.md"),                              # Docker image
        Path(__file__).resolve().parents[2] / "Ai-plan.md",   # /app fallback
    ]
    ai_plan = ""
    for c in candidates:
        try:
            if c.exists():
                ai_plan = c.read_text(encoding="utf-8")
                break
        except Exception:
            continue
    return prompt.replace("{{AI_PLAN_MD}}", ai_plan)


SYSTEM_PROMPT = _read_system_prompt()
TOOL_REGISTRY = build_tool_registry()

# Used after deterministic tools run: model must *not* emit tool_call JSON.
POST_TOOL_ANSWER_SYSTEM = (
    "You are the SIA MLM assistant. The database has already been queried; the results are in the user message. "
    "Write a clear, short answer. If the user wrote in Hinglish, reply in Hinglish. "
    "NEVER output JSON, code blocks, or anything that looks like {\"tool_call\": ...}. "
    "Use exact amounts from the tool results."
)


def _sse(event: str, data: dict) -> bytes:
    return (f"event: {event}\n" f"data: {json.dumps(data, ensure_ascii=False, default=str)}\n\n").encode("utf-8")


def _is_write_tool(name: str) -> bool:
    return name in {
        "createWithdrawalRequest",
        "createP2PTransfer",
        "raiseSupportTicket",
        # Admin write tools (must be confirmation-gated)
        "adminApproveWithdrawal",
        "adminRejectWithdrawal",
        "adminApproveKyc",
        "adminRejectKyc",
        "adminManageWallet",
        "adminApproveWithdrawalsByDate",
        "adminApprovePendingKycs",
    }

def _status_text_for_tool(tool_name: str) -> str:
    # Keep these short; UI shows them as animated status.
    m = {
        "getUserProfile": "Aapka profile check kar raha hu…",
        "getWalletSummary": "Aapka current balance check kiya ja raha hai…",
        "getWalletTransactionsSummary": "Wallet transactions ka summary nikal raha hu…",
        "getUserIncome": "Income history check ki ja rahi hai…",
        "getIncomeSummary": "Income ka calculation / aggregation ho raha hai…",
        "getUserTransactions": "Ledger / transactions check kar raha hu…",
        "getUserWithdrawals": "Withdrawal history check kar raha hu…",
        "getWithdrawalCounts": "Withdrawal status counts nikal raha hu…",
        "getPendingCommissions": "Pending commissions check kar raha hu…",
        "getUserNetwork": "Team network / downline tree load kar raha hu…",
        "getNetworkSize": "Aapka team size calculate kar raha hu…",
        "getDirectReferralCount": "Direct referrals count kar raha hu…",
        "getMyPurchases": "Aapki package purchase history check kar raha hu…",
        "getPendingPurchaseRequests": "Pending activation requests check kar raha hu…",
        "getAllPackages": "Packages ki list fetch kar raha hu…",
        "getAllLevels": "Level requirements fetch kar raha hu…",
        "getUserLevelProgress": "Level progress calculate kar raha hu…",
        "diagnoseMissingCommission": "Commission issue diagnose kar raha hu…",
        "getUserMigrationContext": "Migration/legacy context check kar raha hu…",
        "getUserLegacySpotSummary": "Legacy (Excel) spot history analyze kar raha hu…",
        "compareLegacySpotVsLedgerSpot": "Legacy vs ledger comparison kar raha hu…",
        "explainPurchaseIncomeMismatch": "Package income mismatch ka root-cause nikal raha hu…",
        "getNextWithdrawalDate": "Next withdrawal date check kar raha hu…",
        "getEligibleWithdrawalAmount": "Next withdrawal date par eligible amount calculate kar raha hu…",
        "getAdminProjectedWithdrawalDemand": "Upcoming withdrawal demand ka projection nikal raha hu…",
    }
    return m.get(tool_name, "Aapka data analyze kar raha hu…")

_TOOL_SCHEMA_SNAPSHOT = None


def _try_parse_upload_url(url: str) -> str | None:
    # upload://<id>
    if not url:
        return None
    if not url.startswith("upload://"):
        return None
    return url.split("upload://", 1)[1].strip() or None


def _load_first_image_attachment(app: FastAPI, attachments: list[dict] | None) -> tuple[bytes, str] | None:
    if not attachments:
        return None
    try:
        a0 = attachments[0]
        if not isinstance(a0, dict):
            return None
        if a0.get("type") != "image":
            return None
        upload_id = _try_parse_upload_url(str(a0.get("url") or ""))
        if not upload_id:
            return None
        rec = (app.state.uploads or {}).get(upload_id)
        if not rec:
            return None
        return rec.get("data"), rec.get("content_type")
    except Exception:
        return None

def _tool_schemas() -> list[dict]:
    global _TOOL_SCHEMA_SNAPSHOT
    if _TOOL_SCHEMA_SNAPSHOT is None:
        from .tools.registry import list_tool_schemas

        _TOOL_SCHEMA_SNAPSHOT = list_tool_schemas()
    return _TOOL_SCHEMA_SNAPSHOT


def _extract_json(text: str) -> dict | None:
    """
    Best-effort: extract a JSON object from model output. Order:
      1. ```json ... ```   fenced block
      2. ```         ... ``` plain fenced block
      3. balanced {...} scan (handles strings, escapes)
      4. last-resort greedy {...}
    """
    if not text:
        return None

    # 1. ```json ... ```
    for pat in (
        r"```json\s*({[\s\S]*?})\s*```",
        r"```\s*({[\s\S]*?})\s*```",
    ):
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass

    # 3. balanced-brace scan that respects strings/escapes.
    s = text
    n = len(s)
    i = 0
    while i < n:
        if s[i] == "{":
            depth = 0
            in_str = False
            esc = False
            for j in range(i, n):
                c = s[j]
                if in_str:
                    if esc:
                        esc = False
                    elif c == "\\":
                        esc = True
                    elif c == '"':
                        in_str = False
                    continue
                if c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = s[i : j + 1]
                        try:
                            obj = json.loads(candidate)
                            if isinstance(obj, dict):
                                return obj
                        except Exception:
                            break
            i = j + 1 if "j" in dir() else i + 1
        else:
            i += 1

    # 4. last-resort greedy
    m = re.search(r"({[\s\S]*})", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None


def _looks_like_tool_call(text: str) -> bool:
    """Quick check used to detect when the model emitted a tool_call JSON instead of a natural reply."""
    if not text:
        return False
    return '"tool_call"' in text or "'tool_call'" in text


def _try_parse_root_tool_json(text: str) -> dict | None:
    """
    If the *entire* (or main) model output is a single JSON object with a tool_call, parse it
    when _extract_json missed edge cases.
    """
    if not text:
        return None
    t = text.strip()
    if not t.startswith("{"):
        return None
    if "tool_call" not in t:
        return None
    try:
        o = json.loads(t)
        if isinstance(o, dict) and o.get("tool_call"):
            return o
    except Exception:
        pass
    return None


def _sanitize_assistant_text(text: str | None) -> str:
    """Remove leaked tool JSON / code fences; never show raw tool_call to the end user."""
    if not text:
        return ""
    t = re.sub(r"```(?:json)?\s*[\s\S]*?```", "", str(text), flags=re.IGNORECASE)
    t2 = t.strip()
    if len(t2) < 900 and _looks_like_tool_call(t2):
        return ""
    if re.match(r"^\s*\{[\s\S]*\"tool_call\"[\s\S]*\}\s*$", t2):
        return ""
    return t2


def _fallback_reply_from_tool_results(
    user_message: str, tool_results: list[dict]
) -> str:
    """Last-resort human text when the LLM failed to paraphrase tool JSON."""
    lines: list[str] = []
    for tr in tool_results:
        name = tr.get("tool_name")
        r = tr.get("result")
        if not isinstance(r, dict) or not r.get("ok"):
            continue
        if name == "getUserLevelProgress":
            cl = r.get("current_level")
            nt = r.get("next_level_title")
            tb = (r.get("achieved") or {}).get("team_business", "?")
            gap = (r.get("gap") or {}).get("team_business", "?")
            lines.append(
                f"Abhi aap level {cl!s} par ho. Agla level: {r.get('next_level')!s} {nt or ''}. "
                f"Abhi team business (approx) ₹{tb}; next ke liye gap ₹{gap} (tool se)."
            )
        elif name == "getIncomeSummary":
            lines.append(
                f"Time window ke andar total income: ₹{r.get('total_amount', 0)} "
                f"(by-type breakdown result mein hai)."
            )
        elif name == "diagnoseMissingCommission":
            crd = r.get("credited_from_direct_referrals_only") or {}
            ld = crd.get("total", "?")
            tot = (r.get("ledger_totals") or {}).get("total", "?")
            blk = r.get("blockers") or []
            lines.append(
                f"Commission check: is type ka ledger total approx ₹{tot}. "
                f"Direct downline (Spot) se credited: ₹{ld}. "
                f"Blockers: {', '.join(blk) if blk else 'none'}"
            )
    if not lines:
        return (
            "Maaf karein, abhi aapke question ka poora jawad tayyar nahi ho paya. "
            "Thodi der baad dobara try karein, ya thoda sa detail ke saath dobara poochhein."
        )
    return " ".join(lines)


def _migration_legacy_summary_block(tool_results: list[dict]) -> str | None:
    """
    If migration/legacy tools ran, produce a deterministic summary block so the
    final answer always 'shows legacy data' (even if counts are 0).
    """
    mig = next((tr for tr in tool_results if tr.get("tool_name") == "getUserMigrationContext"), None)
    spot = next((tr for tr in tool_results if tr.get("tool_name") == "getUserLegacySpotSummary"), None)
    act = next((tr for tr in tool_results if tr.get("tool_name") == "getUserLegacyActivationSummary"), None)
    cmp = next((tr for tr in tool_results if tr.get("tool_name") == "compareLegacySpotVsLedgerSpot"), None)
    if not mig and not spot and not act and not cmp:
        return None

    lines: list[str] = []
    boundary = "2025-12-18"
    if isinstance(mig, dict) and isinstance(mig.get("result"), dict):
        r = mig["result"]
        boundary = str(r.get("migration_boundary_date") or boundary)
        lp = r.get("legacy_presence") or {}
        lines.append("Legacy/Migration Summary:")
        lines.append(f"- Migration boundary: {boundary}")
        try:
            lines.append(f"- Legacy SPOT rows: {int(lp.get('legacy_spot_rows') or 0)}")
        except Exception:
            pass
        try:
            lines.append(f"- Legacy Activation rows: {int(lp.get('legacy_activation_rows') or 0)}")
        except Exception:
            pass

    if isinstance(spot, dict) and isinstance(spot.get("result"), dict):
        r = spot["result"]
        tot = (r.get("total") or {}).get("total_amount")
        cnt = (r.get("total") or {}).get("row_count")
        if tot is not None and cnt is not None:
            lines.append(f"- Legacy SPOT total: ₹{tot} (rows {cnt})")

    if isinstance(act, dict) and isinstance(act.get("result"), dict):
        r = act["result"]
        cnt = (r.get("total") or {}).get("row_count")
        if cnt is not None:
            lines.append(f"- Legacy Activation rows: {cnt}")
        last = r.get("last_items") or []
        if isinstance(last, list) and last:
            # Show 1-2 most recent rows for visibility.
            for it in last[:2]:
                if not isinstance(it, dict):
                    continue
                st = it.get("status") or ""
                rt = it.get("request_type") or ""
                utr = it.get("utr_txn_id") or ""
                clar = it.get("clarification") or ""
                lines.append(f"  - {st} | {rt} | UTR: {utr or '—'} | {clar or '—'}")

    if isinstance(cmp, dict) and isinstance(cmp.get("result"), dict):
        r = cmp["result"]
        legacy_total = (r.get("legacy_spot") or {}).get("total")
        ledger_total = (r.get("ledger_spot") or {}).get("total")
        if legacy_total is not None and ledger_total is not None:
            lines.append(f"- SPOT compare: legacy ₹{legacy_total} vs ledger ₹{ledger_total}")

    return "\n".join(lines).strip() if lines else None


def _tool_instructions(is_admin: bool) -> str:
    tools = _tool_schemas()
    return (
        "TOOLS AVAILABLE (use only these exact names):\n"
        f"{json.dumps(tools, ensure_ascii=False)}\n"
        f"Admin mode: {str(bool(is_admin)).lower()}.\n"
        "OUTPUT FORMAT:\n"
        "- If you need data, output ONLY a JSON object (optionally inside ```json fences) of the form: "
        "{\"tool_call\": {\"name\": \"<ToolName>\", \"arguments\": {...}}}. No prose around it.\n"
        "- Once you have enough data (or the answer is conceptual), output the FINAL answer as natural "
        "language. NEVER output a tool_call JSON together with the final answer.\n"
        "- After a tool result is provided, prefer to ANSWER. Only call another tool if the previous "
        "result really lacks the requested fact.\n"
    )


@app.on_event("startup")
async def _startup():
    settings = load_settings()
    app.state.settings = settings
    app.state.db = await Db.connect(settings.database_url)
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
    app.state.sessions = RedisSessionStore(app.state.redis)
    app.state.gemini = GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
    app.state.uploads = {}  # upload_id -> {data: bytes, content_type: str, created_at: int}
    app.state.ai_settings = AiSettingsStore(app.state.redis)
    logger.info("chat_engine_started")


@app.on_event("shutdown")
async def _shutdown():
    db: Db = app.state.db
    await db.close()
    r: Redis = app.state.redis
    await r.aclose()


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/chat/stream")
async def chat_stream(request: Request, authorization: str | None = Header(default=None)):
    settings = app.state.settings
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    try:
        # Accept both user JWT and admin JWT (MLM-API supports ADMIN_JWT_SECRET).
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")

    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.user_id:
        raise HTTPException(status_code=401, detail="invalid_token_payload")

    body = ChatStreamRequest.model_validate(await request.json())
    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="message_required")

    gemini: GeminiClient = app.state.gemini
    sessions: RedisSessionStore = app.state.sessions
    db: Db = app.state.db
    ai_settings: AiSettingsStore = app.state.ai_settings

    role_key = "admin" if auth_ctx.is_admin else "user"
    try:
        quota = await ai_settings.quota_check(role=role_key, user_id=auth_ctx.user_id)
    except Exception:
        logger.exception("quota_check_failed", extra={"user_id": auth_ctx.user_id})
        quota = {"allowed": True, "limit": 0, "used_today": 0, "read_enabled": True, "write_enabled": True}

    async def event_stream() -> AsyncGenerator[bytes, None]:
        # Read-disabled: chat is paused for this role.
        if not quota.get("read_enabled", True):
            yield _sse(
                "message_delta",
                {
                    "text": (
                        "AI chat is currently disabled by the admin for "
                        + ("admins" if role_key == "admin" else "users")
                        + ". Please try again later."
                    )
                },
            )
            yield _sse("final", {"ok": False, "error": "ai_chat_disabled", "scope": role_key})
            return

        # Daily quota exceeded.
        if not quota.get("allowed", True):
            limit = quota.get("limit", 0)
            used = quota.get("used_today", 0)
            yield _sse(
                "message_delta",
                {
                    "text": (
                        f"Aapne aaj ki daily limit reach kar li hai ({used}/{limit}). "
                        "Kal phir try karein, ya admin se limit increase karwayein."
                    )
                },
            )
            yield _sse(
                "final",
                {"ok": False, "error": "rate_limit_exceeded", "limit": limit, "used_today": used},
            )
            return

        write_disabled = not quota.get("write_enabled", True)

        t_start = time.time()
        try:
            conv_id = body.conversation_id or str(uuid.uuid4())
            image = _load_first_image_attachment(app, [a.model_dump() for a in body.attachments] if body.attachments else None)
            image_used = False

            async def _llm(system: str, user: str) -> str:
                nonlocal image_used
                if image and not image_used:
                    image_used = True
                    return await gemini.generate(system=system, user=user, image=image)
                return await gemini.generate_text(system=system, user=user)
            try:
                turns = await sessions.get_turns(auth_ctx.user_id)
            except Exception:
                logger.exception("redis_get_turns_failed", extra={"user_id": auth_ctx.user_id})
                turns = []

            # Developer/testing escape hatch: allow explicit tool invocation.
            # Format: !tool <ToolName> <json>
            if user_message.startswith("!tool "):
                try:
                    _, rest = user_message.split("!tool ", 1)
                    tool_name, raw_json = rest.strip().split(" ", 1)
                    params = json.loads(raw_json)
                except Exception:
                    yield _sse("final", {"ok": False, "error": "invalid_tool_invocation_format"})
                    return

                spec = TOOL_REGISTRY.get(tool_name)
                if not spec:
                    yield _sse("final", {"ok": False, "error": "unknown_tool", "tool_name": tool_name})
                    return

                if _is_write_tool(tool_name):
                    if write_disabled:
                        yield _sse("message_delta", {"text": "Write actions are currently disabled by the admin for this role."})
                        yield _sse("final", {"ok": False, "error": "write_disabled"})
                        return
                    confirmation_token = str(uuid.uuid4())
                    await sessions.set_pending_action(
                        conversation_id=conv_id,
                        confirmation_token=confirmation_token,
                        action={"tool_name": tool_name, "params": params},
                    )
                    yield _sse(
                        "confirmation_required",
                        {
                            "conversation_id": conv_id,
                            "confirmation_token": confirmation_token,
                            "tool_name": tool_name,
                            "params": params,
                        },
                    )
                    yield _sse("final", {"ok": True, "requires_confirmation": True, "conversation_id": conv_id})
                    return

                tool_ctx = ToolContext(
                    user_id=auth_ctx.user_id,
                    role=auth_ctx.role,
                    is_admin=auth_ctx.is_admin,
                    token=token,
                    db=db,
                )
                yield _sse("status", {"text": _status_text_for_tool(tool_name), "tool_name": tool_name})
                result = await spec.handler(params, tool_ctx)
                yield _sse("tool_result", {"tool_name": tool_name, "result": result})
                yield _sse("final", {"ok": True, "conversation_id": conv_id})
                return

            try:
                # Auto-tool loop (max 2 tool calls) then final answer.
                tool_ctx = ToolContext(
                    user_id=auth_ctx.user_id,
                    role=auth_ctx.role,
                    is_admin=auth_ctx.is_admin,
                    token=token,
                    db=db,
                )

                working_user_msg = user_message
                tool_results: list[dict] = []
                reply_text: str | None = None

                # Admin fast-path: if the admin explicitly requests approvals, create a pending action
                # immediately (UI may auto-confirm for safe approve actions).
                if auth_ctx.is_admin and not write_disabled:
                    t = user_message.lower()
                    if "kyc" in t and re.search(r"\b(approve|approved|approval|aprove|aproove)\b", t):
                        # e.g. "2 kyc approve", "submitted kyc approve karo"
                        m = re.search(r"\b(\d{1,2})\b", t)
                        n = int(m.group(1)) if m else 25
                        n = max(1, min(50, n))
                        tool_name = "adminApprovePendingKycs"
                        params = {"max_items": n}
                        confirmation_token = str(uuid.uuid4())
                        await sessions.set_pending_action(
                            conversation_id=conv_id,
                            confirmation_token=confirmation_token,
                            action={"tool_name": tool_name, "params": params},
                        )
                        yield _sse(
                            "confirmation_required",
                            {
                                "conversation_id": conv_id,
                                "confirmation_token": confirmation_token,
                                "tool_name": tool_name,
                                "params": params,
                            },
                        )
                        yield _sse("final", {"ok": True, "requires_confirmation": True, "conversation_id": conv_id})
                        return

                # Deterministic Hinglish routing (level / monthly / commission) — runs tools first so the
                # user never sees raw `{"tool_call": ...}` and we avoid wrong tool selection.
                pre_plan = plan_deterministic_tools(user_message)
                used_deterministic_router = False
                if pre_plan:
                    used_deterministic_router = True
                    for tool_name, tool_params in pre_plan:
                        spec = TOOL_REGISTRY.get(tool_name)
                        if not spec or _is_write_tool(tool_name):
                            continue
                        yield _sse("status", {"text": _status_text_for_tool(tool_name), "tool_name": tool_name})
                        tr = await spec.handler(tool_params, tool_ctx)
                        rec = {
                            "tool_name": tool_name,
                            "params": tool_params,
                            "result": tr,
                        }
                        tool_results.append(rec)
                        yield _sse("tool_result", {"tool_name": tool_name, "result": tr})

                    batch = "\n".join(
                        f"- {r['tool_name']}: {json.dumps(r['result'], ensure_ascii=False, default=str)}"
                        for r in tool_results
                    )
                    post_user = (
                        f"User message:\n{user_message}\n\n"
                        f"Tool data (already executed; answer using this only, do not request more tools):\n{batch}"
                    )
                    reply_text = await gemini.generate_text(
                        system=POST_TOOL_ANSWER_SYSTEM,
                        user=post_user,
                    )
                    reply_text = _sanitize_assistant_text(reply_text)
                    mig_block = _migration_legacy_summary_block(tool_results)
                    if mig_block:
                        reply_text = f"{mig_block}\n\n{reply_text}".strip()
                    if not (reply_text or "").strip():
                        reply_text = await gemini.generate_text(
                            system=POST_TOOL_ANSWER_SYSTEM
                            + " Write 2-4 short sentences. Plain text only, no JSON.",
                            user=post_user + "\n(Your previous output was empty — answer now.)",
                        )
                        reply_text = _sanitize_assistant_text(reply_text)
                        mig_block = _migration_legacy_summary_block(tool_results)
                        if mig_block:
                            reply_text = f"{mig_block}\n\n{reply_text}".strip()
                    if not (reply_text or "").strip():
                        reply_text = _fallback_reply_from_tool_results(user_message, tool_results)
                else:
                    MAX_TOOL_CALLS = 4
                    tool_calls_done = 0
                    last_model_out = ""

                    while tool_calls_done < MAX_TOOL_CALLS:
                        prompt_system = SYSTEM_PROMPT + "\n\n" + _tool_instructions(
                            auth_ctx.is_admin
                        )
                        model_out = await _llm(prompt_system, working_user_msg)
                        last_model_out = model_out
                        parsed = _extract_json(model_out) or _try_parse_root_tool_json(
                            model_out
                        )
                        has_tool_call = bool(
                            parsed
                            and isinstance(parsed, dict)
                            and isinstance(parsed.get("tool_call"), dict)
                        )

                        if not has_tool_call:
                            # Natural-language reply -> final.
                            if _looks_like_tool_call(model_out):
                                # The model tried to emit JSON we couldn't parse; do not leak it to user.
                                reply_text = None
                                break
                            reply_text = model_out
                            break

                        tc = parsed["tool_call"]
                        tool_name = tc.get("name")
                        params = tc.get("arguments") or {}
                        if not tool_name or tool_name not in TOOL_REGISTRY:
                            # Bad tool name → ask the model to retry without tools.
                            working_user_msg = (
                                f"User question: {user_message}\n\n"
                                f"Note: tool '{tool_name}' is not available. Available tools: "
                                f"{', '.join(sorted(TOOL_REGISTRY.keys()))}.\n"
                                "Either pick a valid tool or answer the user directly in natural language. "
                                "DO NOT output tool_call JSON."
                            )
                            tool_calls_done += 1
                            continue

                        if _is_write_tool(tool_name):
                            if write_disabled:
                                yield _sse(
                                    "message_delta",
                                    {"text": "Write actions are currently disabled by the admin for this role."},
                                )
                                yield _sse("final", {"ok": False, "error": "write_disabled"})
                                return
                            confirmation_token = str(uuid.uuid4())
                            await sessions.set_pending_action(
                                conversation_id=conv_id,
                                confirmation_token=confirmation_token,
                                action={"tool_name": tool_name, "params": params},
                            )
                            yield _sse(
                                "confirmation_required",
                                {
                                    "conversation_id": conv_id,
                                    "confirmation_token": confirmation_token,
                                    "tool_name": tool_name,
                                    "params": params,
                                },
                            )
                            yield _sse("final", {"ok": True, "requires_confirmation": True, "conversation_id": conv_id})
                            return

                        spec = TOOL_REGISTRY[tool_name]
                        yield _sse("status", {"text": _status_text_for_tool(tool_name), "tool_name": tool_name})
                        result = await spec.handler(params, tool_ctx)
                        tool_results.append(
                            {"tool_name": tool_name, "params": params, "result": result}
                        )
                        yield _sse("tool_result", {"tool_name": tool_name, "result": result})

                        tool_calls_done += 1
                        last_iteration = tool_calls_done >= MAX_TOOL_CALLS
                        suffix = (
                            "Now write the FINAL natural-language answer to the user using the data above. "
                            "DO NOT output another tool_call. NO JSON."
                            if last_iteration
                            else "Now answer the user. If you need one more piece of data, you may call exactly one more tool. Otherwise reply in natural language. NEVER reply with raw JSON to the user."
                        )
                        working_user_msg = (
                            f"User question: {user_message}\n\n"
                            f"Tool calls so far ({len(tool_results)}):\n"
                            + "\n".join(
                                f"- {tr['tool_name']}({json.dumps(tr['params'], ensure_ascii=False, default=str)}) "
                                f"=> {json.dumps(tr['result'], ensure_ascii=False, default=str)}"
                                for tr in tool_results
                            )
                            + f"\n\n{suffix}"
                        )

                # Final-answer recovery (LLM path only; deterministic path already has natural text).
                if not used_deterministic_router and (
                    reply_text is None or _looks_like_tool_call(reply_text)
                ):
                    forced_user_msg = (
                        f"User question: {user_message}\n\n"
                        f"Tool data collected ({len(tool_results)} call(s)):\n"
                        + "\n".join(
                            f"- {tr['tool_name']} => {json.dumps(tr['result'], ensure_ascii=False, default=str)}"
                            for tr in tool_results
                        )
                        + "\n\nIMPORTANT: Tools are no longer available. Reply now in plain natural language "
                        "(Hinglish if the user used Hinglish). NEVER output JSON or tool_call."
                    )
                    forced_system = (
                        "You are the SIA MLM assistant. Tool execution has finished. "
                        "Write the final natural-language answer to the user using ONLY the tool data provided. "
                        "If a number is missing, say so politely. Never output JSON or backticks-fenced code."
                    )
                    try:
                        reply_text = await gemini.generate_text(
                            system=forced_system, user=forced_user_msg
                        )
                        reply_text = _sanitize_assistant_text(reply_text)
                        if not (reply_text or "").strip() or _looks_like_tool_call(
                            reply_text or ""
                        ):
                            reply_text = _fallback_reply_from_tool_results(
                                user_message, tool_results
                            )
                    except Exception:
                        logger.exception("forced_final_failed")
                        reply_text = _fallback_reply_from_tool_results(
                            user_message, tool_results
                        )
                        if not (reply_text or "").strip():
                            reply_text = (
                                "Mujhe is question ka final answer banane mein dikkat ho rahi hai. "
                                "Thodi der baad try karein, ya question ko thoda short karke pooch lein."
                            )
            except Exception as e:
                msg = str(e)
                if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
                    yield _sse(
                        "message_delta",
                        {
                            "text": "Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.",
                        },
                    )
                    yield _sse("final", {"ok": False, "error": "gemini_quota_exhausted"})
                    return
                logger.exception("gemini_generate_failed")
                yield _sse("final", {"ok": False, "error": "llm_failed"})
                return

            reply_text = _sanitize_assistant_text(reply_text)
            if not (reply_text or "").strip() and tool_results:
                reply_text = _fallback_reply_from_tool_results(
                    user_message, tool_results
                )

            try:
                await sessions.append_turn(
                    auth_ctx.user_id,
                    {"user": user_message, "assistant": reply_text},
                    conversation_id=conv_id,
                )
            except Exception:
                logger.exception("redis_append_turn_failed", extra={"user_id": auth_ctx.user_id})

            yield _sse("message_delta", {"text": reply_text})
            yield _sse("final", {"ok": True, "turns_in_memory": len(turns) + 1, "conversation_id": conv_id})

            # Record usage + latency (best-effort).
            try:
                await ai_settings.record_question(role=role_key, user_id=auth_ctx.user_id)
                await ai_settings.record_latency(int((time.time() - t_start) * 1000))
            except Exception:
                logger.exception("usage_record_failed", extra={"user_id": auth_ctx.user_id})

            # Give the client a beat to flush; avoids some proxy buffering edge cases.
            await asyncio.sleep(0)
        except Exception:
            logger.exception("chat_stream_failed", extra={"user_id": auth_ctx.user_id})
            yield _sse("final", {"ok": False, "error": "chat_stream_failed"})
            return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/chat/conversations", response_model=list[ChatConversationListItem])
async def chat_conversations(authorization: str | None = Header(default=None), limit: int = 20):
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.user_id:
        raise HTTPException(status_code=401, detail="invalid_token_payload")
    sessions: RedisSessionStore = app.state.sessions
    try:
        return await sessions.list_conversations(auth_ctx.user_id, limit=max(1, min(int(limit), 50)))
    except Exception:
        logger.exception("chat_conversations_failed", extra={"user_id": auth_ctx.user_id})
        return []


@app.get("/chat/conversations/{conversation_id}", response_model=ChatConversationTurnsResponse)
async def chat_conversation_turns(conversation_id: str, authorization: str | None = Header(default=None)):
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.user_id:
        raise HTTPException(status_code=401, detail="invalid_token_payload")
    sessions: RedisSessionStore = app.state.sessions
    try:
        turns = await sessions.get_conversation_turns(auth_ctx.user_id, conversation_id)
        return {"conversation_id": conversation_id, "turns": turns}
    except Exception:
        logger.exception("chat_conversation_turns_failed", extra={"user_id": auth_ctx.user_id, "conversation_id": conversation_id})
        return {"conversation_id": conversation_id, "turns": []}


@app.patch("/chat/conversations/{conversation_id}")
async def chat_conversation_rename(conversation_id: str, req: Request, authorization: str | None = Header(default=None)):
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.user_id:
        raise HTTPException(status_code=401, detail="invalid_token_payload")

    body = ChatConversationRenameRequest.model_validate(await req.json())
    sessions: RedisSessionStore = app.state.sessions
    try:
        await sessions.rename_conversation(auth_ctx.user_id, conversation_id, title=body.title)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("chat_conversation_rename_failed", extra={"user_id": auth_ctx.user_id, "conversation_id": conversation_id})
        raise HTTPException(status_code=500, detail="rename_failed")


@app.post("/chat/confirm")
async def chat_confirm(req: Request, authorization: str | None = Header(default=None)):
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.user_id:
        raise HTTPException(status_code=401, detail="invalid_token_payload")

    body = ChatConfirmRequest.model_validate(await req.json())
    sessions: RedisSessionStore = app.state.sessions
    db: Db = app.state.db
    settings = app.state.settings

    async def event_stream() -> AsyncGenerator[bytes, None]:
        pending = await sessions.get_pending_action(
            conversation_id=body.conversation_id,
            confirmation_token=body.confirmation_token,
        )
        if not pending:
            yield _sse("final", {"ok": False, "error": "confirmation_token_not_found"})
            return

        if not body.confirm:
            await sessions.clear_pending_action(
                conversation_id=body.conversation_id,
                confirmation_token=body.confirmation_token,
            )
            yield _sse("final", {"ok": True, "confirmed": False})
            return

        tool_name = pending["tool_name"]
        params = pending.get("params") or {}

        spec = TOOL_REGISTRY.get(tool_name)
        if not spec:
            yield _sse("final", {"ok": False, "error": "unknown_tool", "tool_name": tool_name})
            return

        # Inject config-only fields needed by write tools.
        if _is_write_tool(tool_name):
            params = {**params, "__mlm_api_base_url": settings.mlm_api_base_url}

        tool_ctx = ToolContext(
            user_id=auth_ctx.user_id,
            role=auth_ctx.role,
            is_admin=auth_ctx.is_admin,
            token=token,
            db=db,
        )

        yield _sse("tool_call", {"tool_name": tool_name, "params": {k: v for k, v in params.items() if k != "transaction_password"}})
        result = await spec.handler(params, tool_ctx)
        yield _sse("tool_result", {"tool_name": tool_name, "result": result})

        await sessions.clear_pending_action(
            conversation_id=body.conversation_id,
            confirmation_token=body.confirmation_token,
        )
        yield _sse("final", {"ok": True})
        await asyncio.sleep(0)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/chat/sessions")
async def chat_sessions(authorization: str | None = Header(default=None)):
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.user_id:
        raise HTTPException(status_code=401, detail="invalid_token_payload")

    sessions: RedisSessionStore = app.state.sessions
    try:
        turns = await sessions.get_turns(auth_ctx.user_id)
    except Exception:
        logger.exception("redis_get_turns_failed", extra={"user_id": auth_ctx.user_id})
        turns = []
    return {"user_id": auth_ctx.user_id, "turns": turns}


def _require_admin_or_401(authorization: str | None) -> None:
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            payload = verify_jwt(token, settings.jwt_secret)
        except Exception:
            payload = verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    auth_ctx = auth_context_from_jwt_payload(payload)
    if not auth_ctx.is_admin:
        raise HTTPException(status_code=403, detail="forbidden_admin_only")


def _serialize_settings(s) -> dict:
    return {
        "admin": {"daily_limit": s.admin.daily_limit, "read": s.admin.read, "write": s.admin.write},
        "user": {"daily_limit": s.user.daily_limit, "read": s.user.read, "write": s.user.write},
    }


@app.get("/admin/ai-settings")
async def admin_ai_settings_get(authorization: str | None = Header(default=None)):
    _require_admin_or_401(authorization)
    ai_settings: AiSettingsStore = app.state.ai_settings
    s = await ai_settings.get()
    stats = await ai_settings.stats(enabled_tools_count=len(TOOL_REGISTRY))
    return {"settings": _serialize_settings(s), "stats": stats, "model": app.state.settings.gemini_model}


@app.patch("/admin/ai-settings")
async def admin_ai_settings_patch(req: Request, authorization: str | None = Header(default=None)):
    _require_admin_or_401(authorization)
    body = await req.json()
    role = (body or {}).get("role")
    patch = (body or {}).get("patch") or {}
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="invalid_role")
    ai_settings: AiSettingsStore = app.state.ai_settings
    try:
        updated = await ai_settings.update(role=role, patch=patch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "settings": _serialize_settings(updated)}


@app.get("/admin/ai-tools")
async def admin_ai_tools(authorization: str | None = Header(default=None)):
    _require_admin_or_401(authorization)
    admin_only = {
        "adminListPendingKycs",
        "adminApproveWithdrawal",
        "adminRejectWithdrawal",
        "adminApproveKyc",
        "adminRejectKyc",
        "adminManageWallet",
        "adminApproveWithdrawalsByDate",
        "adminApprovePendingKycs",
    }

    def _audience(name: str) -> str:
        if name in admin_only or name.startswith("admin"):
            return "admin"
        # Default read tools are safe for both.
        return "both"

    def _category(name: str) -> str:
        n = name.lower()
        if "kyc" in n:
            return "KYC"
        if "withdraw" in n:
            return "Withdrawal"
        if "wallet" in n:
            return "Wallet"
        if "legacy" in n or "migration" in n:
            return "Legacy/Migration"
        if "network" in n or "upline" in n or "downline" in n or "level" in n or "legs" in n:
            return "Network/Levels"
        if "income" in n or "commission" in n or "payout" in n:
            return "Income/Commission"
        if "support" in n or "ticket" in n:
            return "Support"
        if "system" in n or "stats" in n or n.startswith("explain"):
            return "System"
        if "user" in n or "profile" in n:
            return "User"
        return "Other"

    items = []
    for name, spec in sorted(TOOL_REGISTRY.items()):
        items.append(
            {
                "name": name,
                "description": getattr(spec, "description", "") or "",
                "kind": "write" if _is_write_tool(name) else "read",
                "enabled": True,
                "audience": _audience(name),
                "category": _category(name),
            }
        )
    return {"items": items, "count": len(items), "model": app.state.settings.gemini_model}


@app.post("/chat/upload")
async def chat_upload(authorization: str | None = Header(default=None), file: UploadFile = File(...)):
    # Scaffold: store locally is not allowed for prod; later we will integrate Bunny CDN.
    # For now, we just return a placeholder URL-like value that UI can pass back.
    token = parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    settings = app.state.settings
    try:
        try:
            verify_jwt(token, settings.jwt_secret)
        except Exception:
            verify_jwt(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="only_image_supported")

    data = await file.read()
    upload_id = str(uuid.uuid4())
    app.state.uploads[upload_id] = {"data": data, "content_type": file.content_type, "created_at": int(time.time())}
    return {"url": f"upload://{upload_id}", "content_type": file.content_type, "filename": file.filename}

