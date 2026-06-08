"""
Deterministic routing for high-frequency Hinglish questions so the correct DB
tools run even when the LLM mis-routes or prints raw tool_call JSON.
"""
from __future__ import annotations

import json
import re
from typing import Any


def _lo(msg: str) -> str:
    return (msg or "").strip().lower()


def _commission_complaint(t: str) -> bool:
    if not t:
        return False
    neg = re.search(
        r"(nahi|nhi|nahin|not|mila|mile|mili|mila$|mili$|mila\?|missing|mila$|aaya$|aayi$|nhi\s*mila|did\s*not|receive|receiv|got\s+0)",
        t,
    )
    if not neg:
        return False
    return bool(
        re.search(
            r"(direct|spot|kamy|komi|कम|commission|income|aaya|aayi|aaya$|aayi$|aaya\?|paisa|rupee|kamy)",
            t,
            re.IGNORECASE,
        )
    )


def _level_progress_question(t: str) -> bool:
    if not t:
        return False
    # e.g. "mai abhi konse level par hu", "next level pe kitna business chahiye"
    if re.search(
        r"(abhi|mera|meri|my|kaun|kon|kons[ae]|onse|konse|current).{0,40}\b(level|leval|lv\.)",
        t,
    ):
        return True
    if re.search(
        r"(next|agle|aage|aagla).{0,20}(level|leval)|qualif.{0,25}(level|next)|"
        r"(level|leval).{0,20}(kya|kaun|kitna|kitni|buis?ness|business|require|chah|छ|lag|aana|aaye|aayi|hoon|par\s+hu|pe\s+hu|हू)",
        t,
    ):
        return True
    if re.search(
        r"(buis?ness|business|टीम|team).{0,15}(aana|aaye|aayi|aana|chah|लग|qualif|next|aage|bage)",
        t,
    ):
        return True
    return False


def _monthly_income_intent(t: str) -> dict[str, Any] | None:
    if not re.search(
        r"(month|monthly|recurring|recur|masti|msth|royal|mās|māsik|maah|मास|मंथ|msthly|महि|मही|महिन)",
        t,
        re.IGNORECASE,
    ):
        return None
    if not re.search(
        r"(pichh|pich|last|prev|pech|din|dino|day|days|tees|7|15|30|60|90|is\s*mah|mahin|this\s*month|dino?|this)",
        t,
        re.IGNORECASE,
    ):
        return None
    n = 30
    m = re.search(
        r"(?:pichhle|pichh|last|past|prev)\s*(\d{1,4})\s*(?:dino?|din|day|days)",
        t,
        re.IGNORECASE,
    )
    if m:
        n = int(m.group(1))
    elif re.search(r"\b30\b", t) and re.search(
        r"(dino?|day|pichh|last|tee|tī|तीस|tees|ती)", t, re.IGNORECASE
    ):
        n = 30
    elif re.search(r"\b7\b", t) and re.search(
        r"(dino?|day|pichh|last)", t, re.IGNORECASE
    ):
        n = 7
    return {"days": n, "types": ["MONTHLY"]}


def _diagnose_params(t: str) -> dict[str, Any]:
    p: dict[str, Any] = {"commission_type": "SPOT"}
    if re.search(r"month|monthly|recurring|royal|मास|मंथ|महि|महिन", t, re.IGNORECASE):
        p["commission_type"] = "MONTHLY"
    elif re.search(r"global|helping|हेल", t, re.IGNORECASE):
        p["commission_type"] = "GLOBAL_HELPING"
    elif re.search(r"self|सेल|sef", t, re.IGNORECASE) and "month" not in t:
        p["commission_type"] = "SELF"
    if re.search(
        r"level\s*1|lvl\s*1|lv\s*1|first\s*level|level\s*one|"
        r"leval\s*1|लेवल\s*1|larvel\s*1|लेबल\s*1|লেভ",
        t,
        re.IGNORECASE,
    ):
        p["level"] = 1
    return p


def _dedupe_plan(items: list[tuple[str, dict[str, Any]]]) -> list[tuple[str, dict[str, Any]]]:
    seen: set[str] = set()
    out: list[tuple[str, dict[str, Any]]] = []
    for name, arg in items:
        key = f"{name}:{json.dumps(arg, sort_keys=True, default=str)}"
        if key in seen:
            continue
        seen.add(key)
        out.append((name, arg))
    return out


def plan_deterministic_tools(user_message: str) -> list[tuple[str, dict[str, Any]]]:
    t = _lo(user_message)
    if not t:
        return []
    has_comm = _commission_complaint(t)
    has_level = _level_progress_question(t)
    monthly = _monthly_income_intent(t)
    has_migration_mismatch = bool(
        re.search(
            r"(legacy|legcy|migration|migrate|18\\s*dec|18-12-2025|old\\s*system|purana|purani|"
            r"ledger.{0,20}(match|mismatch|nahi)|balance.{0,20}(match|mismatch|galat)|"
            r"2x|two\\s*x|expire|expiry|expired|kyu\\s*expire|kaise\\s*expire)",
            t,
            re.IGNORECASE,
        )
    )
    out: list[tuple[str, dict[str, Any]]] = []
    if has_migration_mismatch:
        out.append(("getUserMigrationContext", {}))
        out.append(("getUserLegacySpotSummary", {}))
        out.append(("compareLegacySpotVsLedgerSpot", {}))
        out.append(("getUserLegacyActivationSummary", {}))
    if has_level:
        out.append(("getUserLevelProgress", {}))
    if monthly:
        out.append(("getIncomeSummary", monthly))
    if has_comm:
        out.append(("diagnoseMissingCommission", _diagnose_params(t)))
    return _dedupe_plan(out)[:4]
