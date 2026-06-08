from __future__ import annotations

import logging
from typing import Any

import httpx

from .types import ToolContext, ToolSpec


logger = logging.getLogger(__name__)


def _simple_schema(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


async def _mlm_api_call(ctx: ToolContext, *, method: str, path: str, json_body: dict[str, Any]) -> dict[str, Any]:
    base_url = ctx.db  # placeholder; real base_url provided via ctx extras in executor
    raise RuntimeError("tool_context_missing_mlm_api_base_url")

def _require_admin(ctx: ToolContext) -> None:
    if not ctx.is_admin:
        raise PermissionError("admin_only_tool")


async def create_withdrawal_request(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/withdraw/requests
    """
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/withdraw/requests",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "amount": params["amount"],
                "payment_method": params["payment_method"],
                "account_details": params["account_details"],
                "remarks": params.get("remarks"),
                "withdraw_type": params.get("withdraw_type", "wallet"),
                "transaction_password": params["transaction_password"],
            },
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}

async def admin_approve_withdrawal(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/admin/withdraw/requests/:id/approve
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    withdraw_request_id = str(params["withdraw_request_id"])
    body: dict[str, Any] = {}
    if params.get("remarks"):
        body["remarks"] = params.get("remarks")
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/admin/withdraw/requests/{withdraw_request_id}/approve",
            headers={"Authorization": f"Bearer {token}"},
            json=body,
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


async def admin_reject_withdrawal(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/admin/withdraw/requests/:id/reject
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    withdraw_request_id = str(params["withdraw_request_id"])
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/admin/withdraw/requests/{withdraw_request_id}/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "rejection_reason": params["rejection_reason"],
                "remarks": params.get("remarks"),
            },
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


async def admin_approve_kyc(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/admin/kyc/:user_id/approve
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    user_id = str(params["user_id"])
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/admin/kyc/{user_id}/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


async def admin_reject_kyc(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/admin/kyc/:user_id/reject
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    user_id = str(params["user_id"])
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/admin/kyc/{user_id}/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": params["reason"]},
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


async def admin_manage_wallet(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/admin/wallet/manage
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/admin/wallet/manage",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "user_id": str(params["user_id"]),
                "main_wallet_amount": params.get("main_wallet_amount", 0),
                "spot_wallet_amount": params.get("spot_wallet_amount", 0),
                "team_royalty_wallet_amount": params.get("team_royalty_wallet_amount", 0),
                "reason": params.get("reason"),
            },
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


async def admin_approve_pending_kycs(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Batch approve pending KYC submissions.

    Calls MLM-API:
      - GET  /api/v1/admin/kyc/pending
      - POST /api/v1/admin/kyc/:user_id/approve  (per item)
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    max_items = int(params.get("max_items") or 5)
    max_items = max(1, min(50, max_items))

    async with httpx.AsyncClient(timeout=60.0) as client:
        pending = await client.get(
            f"{base_url}/api/v1/admin/kyc/pending",
            headers={"Authorization": f"Bearer {token}"},
        )
        pending_json: dict[str, Any] = pending.json() if pending.content else {}
        items = (pending_json.get("items") or []) if isinstance(pending_json, dict) else []

        approvals: list[dict[str, Any]] = []
        approved = 0
        failed = 0

        for it in items[:max_items]:
            uid = str((it or {}).get("user_id") or "")
            if not uid:
                continue
            r = await client.post(
                f"{base_url}/api/v1/admin/kyc/{uid}/approve",
                headers={"Authorization": f"Bearer {token}"},
                json={},
            )
            ok = bool(r.is_success)
            approvals.append(
                {
                    "user_id": uid,
                    "display_id": (it or {}).get("display_id"),
                    "ok": ok,
                    "status_code": r.status_code,
                    "result": r.json() if r.content else None,
                }
            )
            if ok:
                approved += 1
            else:
                failed += 1

        return {
            "ok": pending.is_success and failed == 0,
            "status_code": 200 if pending.is_success else pending.status_code,
            "summary": {
                "pending_returned": len(items),
                "attempted": len(approvals),
                "approved": approved,
                "failed": failed,
                "max_items": max_items,
            },
            "approvals": approvals,
        }


async def admin_approve_withdrawals_by_date(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Batch approve pending withdrawals on a given IST calendar date.

    Calls MLM-API:
      - GET  /api/v1/admin/withdraw/pending?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&withdraw_type=...
      - POST /api/v1/admin/withdraw/requests/:id/approve  (per item)
    """
    _require_admin(ctx)
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    on_date = str(params["on_date"])
    withdraw_type = params.get("withdraw_type")
    max_items = int(params.get("max_items") or 25)
    max_items = max(1, min(100, max_items))
    remarks = params.get("remarks")

    async with httpx.AsyncClient(timeout=60.0) as client:
        q: dict[str, Any] = {"page": 1, "limit": max_items, "start_date": on_date, "end_date": on_date}
        if withdraw_type:
            q["withdraw_type"] = withdraw_type
        pending = await client.get(
            f"{base_url}/api/v1/admin/withdraw/pending",
            headers={"Authorization": f"Bearer {token}"},
            params=q,
        )
        pending_json: dict[str, Any] = pending.json() if pending.content else {}
        items = (pending_json.get("items") or []) if isinstance(pending_json, dict) else []
        approve_results: list[dict[str, Any]] = []
        approved = 0
        failed = 0
        for it in items[:max_items]:
            wid = str((it or {}).get("id") or "")
            if not wid:
                continue
            body: dict[str, Any] = {}
            if remarks:
                body["remarks"] = remarks
            r = await client.post(
                f"{base_url}/api/v1/admin/withdraw/requests/{wid}/approve",
                headers={"Authorization": f"Bearer {token}"},
                json=body,
            )
            ok = bool(r.is_success)
            approve_results.append(
                {
                    "withdraw_request_id": wid,
                    "ok": ok,
                    "status_code": r.status_code,
                    "result": r.json() if r.content else None,
                }
            )
            if ok:
                approved += 1
            else:
                failed += 1

        return {
            "ok": pending.is_success and failed == 0,
            "status_code": 200 if pending.is_success else pending.status_code,
            "summary": {
                "on_date": on_date,
                "withdraw_type": withdraw_type,
                "requested_limit": max_items,
                "pending_returned": len(items),
                "attempted": len(approve_results),
                "approved": approved,
                "failed": failed,
            },
            "approvals": approve_results,
        }

async def create_p2p_transfer(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/transfer/p2p
    """
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/transfer/p2p",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "receiver_id": params["receiver_id"],
                "amount": params["amount"],
                "from_wallet": params.get("from_wallet", "other"),
                "remarks": params.get("remarks"),
                "transaction_password": params["transaction_password"],
            },
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


async def raise_support_ticket(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Calls MLM-API: POST /api/v1/support/tickets
    """
    base_url = params.pop("__mlm_api_base_url")
    token = ctx.token
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{base_url}/api/v1/support/tickets",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "pre_question_id": params.get("pre_question_id"),
                "message_text": params["message_text"],
                "subject": params.get("subject"),
                "attachment_urls": params.get("attachment_urls", []),
            },
        )
        return {"ok": r.is_success, "status_code": r.status_code, "result": r.json()}


def build_write_tool_specs() -> list[ToolSpec]:
    return [
        ToolSpec(
            name="createWithdrawalRequest",
            description="Create a withdrawal request (JWT-forwarded to MLM-API). Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "amount": {"type": "number"},
                    "payment_method": {"type": "string"},
                    "account_details": {"type": "string"},
                    "remarks": {"type": "string"},
                    "withdraw_type": {"type": "string", "enum": ["wallet", "spot", "team_royalty"]},
                    "transaction_password": {"type": "string"},
                },
                required=["amount", "payment_method", "account_details", "transaction_password"],
            ),
            handler=create_withdrawal_request,
        ),
        ToolSpec(
            name="createP2PTransfer",
            description="Create a P2P transfer (JWT-forwarded to MLM-API). Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "receiver_id": {"type": "string"},
                    "amount": {"type": "number"},
                    "from_wallet": {"type": "string", "enum": ["other"]},
                    "remarks": {"type": "string"},
                    "transaction_password": {"type": "string"},
                },
                required=["receiver_id", "amount", "from_wallet", "transaction_password"],
            ),
            handler=create_p2p_transfer,
        ),
        ToolSpec(
            name="raiseSupportTicket",
            description="Create a support ticket (JWT-forwarded to MLM-API). Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "pre_question_id": {"type": "integer"},
                    "message_text": {"type": "string"},
                    "subject": {"type": "string"},
                    "attachment_urls": {"type": "array"},
                },
                required=["message_text"],
            ),
            handler=raise_support_ticket,
        ),
        ToolSpec(
            name="adminApproveWithdrawal",
            description="ADMIN: Approve a withdrawal request by request ID. Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "withdraw_request_id": {"type": "string"},
                    "remarks": {"type": "string"},
                },
                required=["withdraw_request_id"],
            ),
            handler=admin_approve_withdrawal,
        ),
        ToolSpec(
            name="adminRejectWithdrawal",
            description="ADMIN: Reject a withdrawal request by request ID (requires rejection_reason). Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "withdraw_request_id": {"type": "string"},
                    "rejection_reason": {"type": "string"},
                    "remarks": {"type": "string"},
                },
                required=["withdraw_request_id", "rejection_reason"],
            ),
            handler=admin_reject_withdrawal,
        ),
        ToolSpec(
            name="adminApproveKyc",
            description="ADMIN: Approve KYC for a user_id. Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "user_id": {"type": "string"},
                },
                required=["user_id"],
            ),
            handler=admin_approve_kyc,
        ),
        ToolSpec(
            name="adminRejectKyc",
            description="ADMIN: Reject KYC for a user_id with reason. Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "user_id": {"type": "string"},
                    "reason": {"type": "string"},
                },
                required=["user_id", "reason"],
            ),
            handler=admin_reject_kyc,
        ),
        ToolSpec(
            name="adminManageWallet",
            description="ADMIN: Add/subtract from user wallets (main/spot/team_royalty). Positive=credit, Negative=debit. Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "user_id": {"type": "string"},
                    "main_wallet_amount": {"type": "number"},
                    "spot_wallet_amount": {"type": "number"},
                    "team_royalty_wallet_amount": {"type": "number"},
                    "reason": {"type": "string"},
                },
                required=["user_id", "main_wallet_amount", "spot_wallet_amount"],
            ),
            handler=admin_manage_wallet,
        ),
        ToolSpec(
            name="adminApproveWithdrawalsByDate",
            description="ADMIN: Batch-approve pending withdrawals on a given IST date (YYYY-MM-DD). Uses /admin/withdraw/pending filter then approves up to max_items. Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {
                    "on_date": {"type": "string", "description": "YYYY-MM-DD (IST calendar date)"},
                    "withdraw_type": {"type": "string", "enum": ["spot", "wallet", "team_royalty"]},
                    "max_items": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25},
                    "remarks": {"type": "string"},
                },
                required=["on_date"],
            ),
            handler=admin_approve_withdrawals_by_date,
        ),
        ToolSpec(
            name="adminApprovePendingKycs",
            description="ADMIN: Batch-approve pending KYC submissions (kyc_status='submitted'), approving up to max_items. Requires explicit CONFIRM.",
            input_schema=_simple_schema(
                {"max_items": {"type": "integer", "minimum": 1, "maximum": 50, "default": 5}},
                required=[],
            ),
            handler=admin_approve_pending_kycs,
        ),
    ]

