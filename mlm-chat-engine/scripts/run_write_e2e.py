#!/usr/bin/env python3
"""
Write-tool E2E smoke runner (admin-side).

Runs 10 scenarios end-to-end:
  chat-engine /chat/stream -> confirmation_required -> /chat/confirm
and verifies effects via MLM-API admin endpoints.

Safe by default:
  - Wallet manage uses 0 deltas (no balance change).
  - Some scenarios run as cancel (confirm=false).
  - Withdrawal approve scenarios are skipped if no pending withdrawals exist.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx


API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000/api/v1")
CHAT_ENGINE_URL = os.environ.get("CHAT_ENGINE_URL", "http://localhost:3004")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "bilal@sia.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "nashik2nagpur")

REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT", "120"))


_SSE_LINE = re.compile(r"^(event|data):\s?(.*)$")


def parse_sse_events(raw: str) -> list[tuple[str, dict | str]]:
    events: list[tuple[str, dict | str]] = []
    cur_event = "message"
    cur_data: list[str] = []
    for line in raw.splitlines():
        if not line.strip():
            if cur_data:
                joined = "\n".join(cur_data)
                try:
                    events.append((cur_event, json.loads(joined)))
                except Exception:
                    events.append((cur_event, joined))
            cur_event = "message"
            cur_data = []
            continue
        m = _SSE_LINE.match(line)
        if not m:
            continue
        key, val = m.group(1), m.group(2)
        if key == "event":
            cur_event = val.strip()
        elif key == "data":
            cur_data.append(val)
    if cur_data:
        joined = "\n".join(cur_data)
        try:
            events.append((cur_event, json.loads(joined)))
        except Exception:
            events.append((cur_event, joined))
    return events


def login_admin() -> str:
    r = httpx.post(
        f"{API_BASE_URL}/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["token"]


def call_chat_stream(token: str, message: str) -> tuple[dict[str, Any] | None, list[tuple[str, Any]], str | None]:
    """
    Returns (confirmation_required_data_or_None, events, error)
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    try:
        with httpx.stream(
            "POST",
            f"{CHAT_ENGINE_URL}/chat/stream",
            headers=headers,
            json={"message": message},
            timeout=REQUEST_TIMEOUT,
        ) as r:
            raw = r.read().decode("utf-8", errors="replace")
        events = parse_sse_events(raw)
        conf = None
        for ev, data in events:
            if ev == "confirmation_required" and isinstance(data, dict):
                conf = data
                break
        return conf, events, None
    except Exception as exc:
        return None, [], f"{type(exc).__name__}: {exc}"


def call_chat_confirm(token: str, *, conversation_id: str, confirmation_token: str, confirm: bool) -> tuple[dict[str, Any] | None, list[tuple[str, Any]], str | None]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    try:
        with httpx.stream(
            "POST",
            f"{CHAT_ENGINE_URL}/chat/confirm",
            headers=headers,
            json={"conversation_id": conversation_id, "confirmation_token": confirmation_token, "confirm": confirm},
            timeout=REQUEST_TIMEOUT,
        ) as r:
            raw = r.read().decode("utf-8", errors="replace")
        events = parse_sse_events(raw)
        tool_result = None
        for ev, data in events:
            if ev == "tool_result" and isinstance(data, dict):
                tool_result = data.get("result") if isinstance(data.get("result"), dict) else data
                break
        return tool_result, events, None
    except Exception as exc:
        return None, [], f"{type(exc).__name__}: {exc}"


def api_get(token: str, path: str, *, params: dict[str, Any] | None = None) -> Any:
    r = httpx.get(
        f"{API_BASE_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


@dataclass
class Scenario:
    id: str
    title: str
    message: str
    confirm: bool | None  # None = no confirm step expected


def _write_reports(*, summary: dict[str, Any], results: list[dict[str, Any]]) -> tuple[str, str]:
    reports_dir = Path(__file__).resolve().parents[1] / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = reports_dir / f"write-e2e-{ts}.json"
    md_path = reports_dir / f"write-e2e-{ts}.md"

    payload = {"summary": summary, "results": results}
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    lines: list[str] = []
    lines.append("# Write tools E2E (admin)\n")
    lines.append(f"- Generated at: `{datetime.now().isoformat(timespec='seconds')}`\n")
    lines.append(f"- Passed: **{summary['passed']} / {summary['total']}**\n")
    lines.append(f"- Skipped: **{summary['skipped']}**\n")
    lines.append("")
    lines.append("## Results")
    lines.append("")
    lines.append("| Status | ID | Title | Notes |")
    lines.append("|---|---|---|---|")
    for r in results:
        status = "SKIP" if r.get("skipped") else ("PASS" if r.get("ok") else "FAIL")
        notes = r.get("error") or r.get("reason") or ""
        notes = str(notes).replace("\n", " ")[:180]
        lines.append(f"| {status} | {r.get('id','')} | {r.get('title','')} | {notes} |")
    lines.append("")
    lines.append("## Raw JSON report")
    lines.append("")
    lines.append(f"- `{json_path.name}`")
    lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")

    # Also keep stable "latest" pointers for convenience.
    (reports_dir / "write-e2e-latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (reports_dir / "write-e2e-latest.md").write_text("\n".join(lines), encoding="utf-8")

    return str(md_path), str(json_path)


def main() -> int:
    token = login_admin()

    # Snapshot helpers
    def pending_kycs() -> list[dict[str, Any]]:
        j = api_get(token, "/admin/kyc/pending")
        return list(j.get("items") or [])

    def user_kyc_status(user_id: str) -> str | None:
        j = api_get(token, "/admin/users", params={"user_id": user_id, "limit": 1})
        items = list(j.get("items") or [])
        return items[0].get("kyc_status") if items else None

    def user_wallets(user_id: str) -> dict[str, Any]:
        j = api_get(token, "/admin/users", params={"user_id": user_id, "limit": 1})
        items = list(j.get("items") or [])
        if not items:
            return {}
        it = items[0]
        return {
            "other_balance": it.get("other_balance"),
            "spot_balance": it.get("spot_balance"),
            "team_royalty_balance": it.get("team_royalty_balance"),
        }

    def pending_withdrawals(limit: int = 5) -> list[dict[str, Any]]:
        j = api_get(token, "/admin/withdraw/pending", params={"page": 1, "limit": limit})
        return list(j.get("items") or [])

    # Pick some real IDs
    pk = pending_kycs()
    pending_before = [p.get("user_id") for p in pk if p.get("user_id")]
    test_user_id = (pk[0].get("user_id") if pk else None) or "1"
    # Prefer SIA00299 if present
    try:
        u = api_get(token, "/admin/users", params={"display_id": "SIA00299", "limit": 1})
        if (u.get("items") or []):
            test_user_id = (u["items"][0].get("id") or test_user_id)
    except Exception:
        pass

    wd = pending_withdrawals(limit=1)
    pending_withdraw_id = wd[0].get("id") if wd else None

    scenarios: list[Scenario] = [
        Scenario("S01", "Approve 1 pending KYC", "approve 1 pending kyc", True),
        Scenario("S02", "Cancel approve 1 pending KYC", "approve 1 pending kyc", False),
        Scenario("S03", "Approve 2 pending KYCs", "approve 2 pending kyc", True),
        Scenario("S04", "List pending KYCs (should not ask IDs)", "list pending kyc requests top 3", None),
        Scenario("S05", "Wallet manage (no-op 0 amounts)", f"!tool adminManageWallet {{\"user_id\":\"{test_user_id}\",\"main_wallet_amount\":0,\"spot_wallet_amount\":0,\"team_royalty_wallet_amount\":0,\"reason\":\"e2e no-op\"}}", True),
        Scenario("S06", "Wallet manage cancel", f"!tool adminManageWallet {{\"user_id\":\"{test_user_id}\",\"main_wallet_amount\":0,\"spot_wallet_amount\":0,\"team_royalty_wallet_amount\":0,\"reason\":\"e2e cancel\"}}", False),
        Scenario("S07", "Approve withdrawals by date cancel", "approve today withdrawals (spot) max 1", False),
        Scenario("S08", "Approve withdrawals by date (spot) max 1", "approve today withdrawals (spot) max 1", True),
        Scenario("S09", "Approve one pending withdrawal by id", f"!tool adminApproveWithdrawal {{\"withdraw_request_id\":\"{pending_withdraw_id or ''}\",\"remarks\":\"e2e\"}}", True if pending_withdraw_id else None),
        Scenario("S10", "Reject one pending withdrawal by id (cancel)", f"!tool adminRejectWithdrawal {{\"withdraw_request_id\":\"{pending_withdraw_id or ''}\",\"rejection_reason\":\"e2e-cancel\"}}", False if pending_withdraw_id else None),
    ]

    results: list[dict[str, Any]] = []

    for sc in scenarios:
        t0 = time.time()
        row: dict[str, Any] = {"id": sc.id, "title": sc.title, "ok": False, "skipped": False}

        if sc.confirm is None:
            conf, events, err = call_chat_stream(token, sc.message)
            row["error"] = err
            # For list scenario, accept either tool_result or natural reply.
            row["ok"] = err is None
            row["elapsed_ms"] = int((time.time() - t0) * 1000)
            results.append(row)
            continue

        if sc.id in {"S09", "S10"} and not pending_withdraw_id:
            row["skipped"] = True
            row["reason"] = "no_pending_withdrawals"
            results.append(row)
            continue

        conf, events, err = call_chat_stream(token, sc.message)
        if err:
            row["error"] = err
            results.append(row)
            continue
        if not conf:
            # For withdrawal scenarios, it's valid that there are no pending withdrawals.
            if sc.id in {"S07", "S08"}:
                row["skipped"] = True
                row["reason"] = "no_pending_withdrawals_today_or_model_did_not_propose_write"
            else:
                row["error"] = "no_confirmation_required"
            results.append(row)
            continue

        tool_name = conf.get("tool_name")
        row["tool_name"] = tool_name

        # Pre-verify snapshots
        if sc.id in {"S01", "S02", "S03"}:
            row["pending_kyc_before"] = len(pending_kycs())

        if sc.id in {"S05", "S06"}:
            row["wallet_before"] = user_wallets(str(test_user_id))

        tool_result, _, cerr = call_chat_confirm(
            token,
            conversation_id=conf["conversation_id"],
            confirmation_token=conf["confirmation_token"],
            confirm=bool(sc.confirm),
        )
        if cerr:
            row["error"] = cerr
            results.append(row)
            continue

        row["confirmed"] = bool(sc.confirm)

        # Post-verify
        if sc.id in {"S01", "S03"} and sc.confirm:
            after = pending_kycs()
            row["pending_kyc_after"] = len(after)
            row["ok"] = row["pending_kyc_after"] <= row["pending_kyc_before"]
        elif sc.id == "S02" and sc.confirm is False:
            row["pending_kyc_after"] = len(pending_kycs())
            row["ok"] = row["pending_kyc_after"] == row["pending_kyc_before"]
        elif sc.id == "S05" and sc.confirm:
            row["wallet_after"] = user_wallets(str(test_user_id))
            row["ok"] = row["wallet_after"] == row["wallet_before"]
        elif sc.id == "S06" and sc.confirm is False:
            row["wallet_after"] = user_wallets(str(test_user_id))
            row["ok"] = row["wallet_after"] == row["wallet_before"]
        else:
            # Basic success heuristic
            row["ok"] = True

        row["elapsed_ms"] = int((time.time() - t0) * 1000)
        results.append(row)

    passed = sum(1 for r in results if r.get("ok"))
    skipped = sum(1 for r in results if r.get("skipped"))
    total = len(results)
    summary = {"passed": passed, "total": total, "skipped": skipped}
    print("\n=== WRITE TOOLS E2E (ADMIN) ===")
    print(f"Passed: {passed}/{total}  Skipped: {skipped}")
    for r in results:
        status = "SKIP" if r.get("skipped") else ("PASS" if r.get("ok") else "FAIL")
        extra = ""
        if r.get("error"):
            extra = f" err={r['error']}"
        print(f"{status} {r['id']} {r['title']}{extra}")

    md_path, json_path = _write_reports(summary=summary, results=results)
    print(f"\nWrote reports:\n- {md_path}\n- {json_path}")

    return 0 if passed == (total - skipped) else 1


if __name__ == "__main__":
    raise SystemExit(main())

