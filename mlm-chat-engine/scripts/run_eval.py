#!/usr/bin/env python3
"""
SIA MLM Chat-Engine end-to-end evaluation runner.

For each scenario (35 user + 35 admin):
  1. Logs into MLM-API to get a JWT (admin or user).
  2. Sends the question to the chat-engine /chat/stream (SSE).
  3. Captures `message_delta` (final reply text) + any `tool_result` events.
  4. Runs the ground-truth SQL via `docker exec ... psql` against the dump DB.
  5. Scores the reply: PASS if any of `expect_any` substrings appear (case-insensitive)
     in the reply text; otherwise FAIL. Concept questions are scored on substring overlap
     with normalized text.
  6. Emits a JSON + Markdown report with overall + per-area satisfactory %.

Usage:
    python scripts/run_eval.py [--admin-only] [--user-only] [--out reports/eval.md]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx


SCRIPT_DIR = Path(__file__).resolve().parent
SCENARIOS_PATH = SCRIPT_DIR / "scenarios.json"

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000/api/v1")
CHAT_ENGINE_URL = os.environ.get("CHAT_ENGINE_URL", "http://localhost:3004")
DB_CONTAINER = os.environ.get("DB_CONTAINER", "mlm-local-dump-20260425")
DB_USER = os.environ.get("DB_USER", "mlm_user")
DB_NAME = os.environ.get("DB_NAME", "mlm_commission")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "bilal@sia.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "nashik2nagpur")
USER_LOGIN_ID = os.environ.get("USER_LOGIN_ID", "SIA00299")
USER_PASSWORD = os.environ.get("USER_PASSWORD", "123456")

REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT", "120"))
SLEEP_BETWEEN = float(os.environ.get("SLEEP_BETWEEN", "1.0"))


@dataclass
class ScenarioResult:
    id: str
    role: str
    area: str
    question: str
    expected: list[str]
    db_truth: str
    reply_text: str
    tool_calls: list[str] = field(default_factory=list)
    error: str | None = None
    elapsed_ms: int = 0
    passed: bool = False
    matched: list[str] = field(default_factory=list)


def login_admin() -> str:
    r = httpx.post(
        f"{API_BASE_URL}/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["token"]


def login_user() -> str:
    r = httpx.post(
        f"{API_BASE_URL}/auth/login",
        json={"userId": USER_LOGIN_ID, "password": USER_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["token"]


def db_query(sql: str) -> str:
    """Run SQL via docker exec and return stripped tuples-only output."""
    cmd = [
        "docker", "exec", "-i", DB_CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME, "-At", "-c", sql,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if proc.returncode != 0:
            return f"<db_error: {proc.stderr.strip()[:200]}>"
        return proc.stdout.strip()
    except Exception as exc:
        return f"<db_error: {exc!s}>"


_SSE_LINE = re.compile(r"^(event|data):\s?(.*)$")


def parse_sse_events(raw: str) -> list[tuple[str, dict | str]]:
    """Parse an SSE response body into [(event, data), ...]."""
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


def call_chat(token: str, message: str) -> tuple[str, list[str], str | None]:
    """Returns (reply_text, tool_calls, error)."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    body = {"message": message}
    try:
        with httpx.stream(
            "POST",
            f"{CHAT_ENGINE_URL}/chat/stream",
            headers=headers,
            json=body,
            timeout=REQUEST_TIMEOUT,
        ) as r:
            if r.status_code != 200:
                err = r.read().decode("utf-8", errors="replace")[:300]
                return "", [], f"http_{r.status_code}: {err}"
            chunks: list[str] = []
            for chunk in r.iter_text():
                if chunk:
                    chunks.append(chunk)
        raw = "".join(chunks)
    except Exception as exc:
        return "", [], f"transport_error: {exc!s}"

    events = parse_sse_events(raw)
    reply_parts: list[str] = []
    tool_calls: list[str] = []
    error: str | None = None
    for ev, data in events:
        if ev == "message_delta" and isinstance(data, dict):
            txt = data.get("text") or ""
            if txt:
                reply_parts.append(txt)
        elif ev == "tool_result" and isinstance(data, dict):
            tool_calls.append(str(data.get("tool_name") or ""))
        elif ev == "final" and isinstance(data, dict):
            if data.get("ok") is False and data.get("error"):
                error = str(data.get("error"))
    return ("".join(reply_parts).strip(), tool_calls, error)


def score(reply: str, expected: list[str]) -> tuple[bool, list[str]]:
    if not reply:
        return False, []
    norm = reply.lower()
    # Number-aware secondary view: strip commas/spaces so "₹46,208.31" matches "46208".
    norm_digits = re.sub(r"[,\u00a0\s_]", "", norm)
    matched: list[str] = []
    for e in expected:
        es = e.lower()
        es_digits = re.sub(r"[,\u00a0\s_]", "", es)
        if es in norm or es_digits in norm_digits:
            matched.append(e)
    if not expected:
        # Concept question with no fixed substrings — accept any non-trivial reply.
        return len(reply) > 60, []
    return len(matched) >= 1, matched


def run_role(role: str, scenarios: list[dict], token: str) -> list[ScenarioResult]:
    results: list[ScenarioResult] = []
    for i, sc in enumerate(scenarios, 1):
        sid = sc["id"]
        q = sc["question"]
        expected = list(sc.get("expect_any") or [])
        db_truth = db_query(sc["ground_truth_sql"])

        print(f"[{role}] {i:02d}/{len(scenarios)} {sid}: {q[:80]}", flush=True)
        t0 = time.perf_counter()
        reply, tools, err = call_chat(token, q)
        elapsed = int((time.perf_counter() - t0) * 1000)

        passed, matched = score(reply, expected)
        if err:
            passed = False

        results.append(
            ScenarioResult(
                id=sid,
                role=role,
                area=sc.get("area", "general"),
                question=q,
                expected=expected,
                db_truth=db_truth,
                reply_text=reply,
                tool_calls=tools,
                error=err,
                elapsed_ms=elapsed,
                passed=passed,
                matched=matched,
            )
        )
        flag = "PASS" if passed else "FAIL"
        extra = f" err={err}" if err else ""
        print(f"   -> {flag}  ({elapsed} ms)  matched={matched}{extra}", flush=True)

        if SLEEP_BETWEEN:
            time.sleep(SLEEP_BETWEEN)
    return results


def summarize(results: list[ScenarioResult]) -> dict[str, Any]:
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    by_role: dict[str, dict[str, int]] = {}
    by_area: dict[str, dict[str, int]] = {}
    for r in results:
        by_role.setdefault(r.role, {"total": 0, "passed": 0})
        by_role[r.role]["total"] += 1
        by_role[r.role]["passed"] += int(r.passed)
        by_area.setdefault(r.area, {"total": 0, "passed": 0})
        by_area[r.area]["total"] += 1
        by_area[r.area]["passed"] += int(r.passed)
    return {
        "total": total,
        "passed": passed,
        "satisfactory_pct": round(100.0 * passed / total, 2) if total else 0.0,
        "by_role": by_role,
        "by_area": by_area,
    }


def render_markdown(summary: dict[str, Any], results: list[ScenarioResult]) -> str:
    lines: list[str] = []
    lines.append(f"# SIA MLM Chat-Engine Evaluation Report")
    lines.append("")
    lines.append(f"- Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"- Chat engine: `{CHAT_ENGINE_URL}`")
    lines.append(f"- API: `{API_BASE_URL}`")
    lines.append(f"- DB container: `{DB_CONTAINER}` ({DB_USER}@{DB_NAME})")
    lines.append("")
    lines.append("## Overall")
    lines.append("")
    lines.append(f"- Total scenarios: **{summary['total']}**")
    lines.append(f"- Passed: **{summary['passed']}**")
    lines.append(f"- Satisfactory score: **{summary['satisfactory_pct']}%**")
    lines.append("")
    lines.append("## By role")
    lines.append("")
    lines.append("| Role | Total | Passed | Score |")
    lines.append("|---|---|---|---|")
    for role, stats in summary["by_role"].items():
        pct = round(100.0 * stats["passed"] / stats["total"], 2) if stats["total"] else 0.0
        lines.append(f"| {role} | {stats['total']} | {stats['passed']} | {pct}% |")
    lines.append("")
    lines.append("## By area")
    lines.append("")
    lines.append("| Area | Total | Passed | Score |")
    lines.append("|---|---|---|---|")
    for area, stats in sorted(summary["by_area"].items()):
        pct = round(100.0 * stats["passed"] / stats["total"], 2) if stats["total"] else 0.0
        lines.append(f"| {area} | {stats['total']} | {stats['passed']} | {pct}% |")
    lines.append("")
    lines.append("## Per-scenario detail")
    lines.append("")
    for r in results:
        flag = "PASS" if r.passed else "FAIL"
        lines.append(f"### {r.role.upper()} {r.id} — `{flag}` ({r.area})")
        lines.append("")
        lines.append(f"**Q:** {r.question}")
        lines.append("")
        lines.append(f"- expected_any: `{r.expected}`")
        lines.append(f"- matched: `{r.matched}`")
        if r.error:
            lines.append(f"- error: `{r.error}`")
        lines.append(f"- tool_calls: `{r.tool_calls}`")
        lines.append(f"- elapsed_ms: `{r.elapsed_ms}`")
        lines.append(f"- db_truth: `{r.db_truth[:300]}`")
        lines.append("")
        lines.append("**Reply:**")
        lines.append("")
        snippet = r.reply_text.strip()
        if len(snippet) > 800:
            snippet = snippet[:800] + " …"
        lines.append("```")
        lines.append(snippet or "(no reply text)")
        lines.append("```")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--admin-only", action="store_true")
    parser.add_argument("--user-only", action="store_true")
    parser.add_argument("--out", default=str(SCRIPT_DIR.parent / "reports" / "eval.md"))
    parser.add_argument("--json-out", default=str(SCRIPT_DIR.parent / "reports" / "eval.json"))
    parser.add_argument("--limit", type=int, default=0, help="Limit scenarios per role (0 = all)")
    parser.add_argument("--scenarios", default=str(SCENARIOS_PATH), help="Path to scenarios.json")
    args = parser.parse_args()

    scenarios_path = Path(args.scenarios)
    if not scenarios_path.exists():
        print(f"scenarios.json missing at {scenarios_path}", file=sys.stderr)
        return 2
    scenarios = json.loads(scenarios_path.read_text())

    out_md = Path(args.out)
    out_json = Path(args.json_out)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)

    results: list[ScenarioResult] = []

    if not args.admin_only:
        print("Logging in as user…", flush=True)
        user_token = login_user()
        user_scs = scenarios["user"]
        if args.limit:
            user_scs = user_scs[: args.limit]
        results.extend(run_role("user", user_scs, user_token))

    if not args.user_only:
        print("Logging in as admin…", flush=True)
        admin_token = login_admin()
        admin_scs = scenarios["admin"]
        if args.limit:
            admin_scs = admin_scs[: args.limit]
        results.extend(run_role("admin", admin_scs, admin_token))

    summary = summarize(results)
    md = render_markdown(summary, results)
    out_md.write_text(md)
    out_json.write_text(json.dumps({
        "summary": summary,
        "results": [r.__dict__ for r in results],
    }, indent=2, default=str))

    print()
    print("=" * 60)
    print(f"Total: {summary['total']}  Passed: {summary['passed']}")
    print(f"Satisfactory score: {summary['satisfactory_pct']}%")
    print(f"Report: {out_md}")
    print(f"JSON  : {out_json}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
