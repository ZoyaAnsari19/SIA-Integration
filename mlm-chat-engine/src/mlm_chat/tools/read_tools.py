from __future__ import annotations

import logging
from typing import Any

from ..db import Db
from .types import ToolContext, ToolSpec
import datetime as _dt


logger = logging.getLogger(__name__)


def _simple_schema(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


async def _fetch_one(db: Db, sql: str, *args):
    async with db.pool.acquire() as conn:
        return await conn.fetchrow(sql, *args)


async def _fetch_all(db: Db, sql: str, *args):
    async with db.pool.acquire() as conn:
        return await conn.fetch(sql, *args)


async def get_user_profile(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)

    user = await _fetch_one(
        db,
        """
        select id, display_id, name, email, phone, role::text as role,
               status, kyc_status::text as kyc_status, referrer_user_id,
               withdrawal_blocked, is_disqualified, created_at
        from users
        where id = $1
        """,
        uid,
    )
    if not user:
        return {"ok": False, "error": "user_not_found"}

    balances = await _fetch_one(
        db,
        """
        select balance, spot_balance, other_balance, team_royalty_balance
        from user_balances
        where user_id = $1
        """,
        uid,
    )

    # Active purchase = completed and not yet doubled (income < amount*2).
    active_purchase = await _fetch_one(
        db,
        """
        select p.id, p.package_id, p.amount, p.income, p.purchased_at, p.is_renewal, p.purchase_type,
               pk.name as package_name, pk.price as package_price, pk.status as package_status
        from purchases p
        join packages pk on pk.id = p.package_id
        where p.user_id = $1
          and p.status = 'completed'
          and (p.income is null or p.income < (p.amount * 2))
        order by p.purchased_at desc
        limit 1
        """,
        uid,
    )

    purchase_counts = await _fetch_one(
        db,
        """
        select
          count(*)::int                                           as total_purchases,
          sum(case when status='completed' then 1 else 0 end)::int as completed,
          sum(case when status='pending'   then 1 else 0 end)::int as pending,
          sum(case when status='completed' and (income is null or income < amount*2) then 1 else 0 end)::int as active,
          sum(case when status='completed' and income is not null and income >= amount*2 then 1 else 0 end)::int as expired_2x
        from purchases where user_id = $1
        """,
        uid,
    )

    elig = await _fetch_one(
        db,
        "select eligibility from level_eligibility where user_id = $1",
        uid,
    )
    current_level = 0
    eligibility_map: dict[str, Any] = {}
    if elig and elig["eligibility"]:
        try:
            eligibility_map = (
                elig["eligibility"]
                if isinstance(elig["eligibility"], dict)
                else __import__("json").loads(elig["eligibility"])
            )
            for k, v in eligibility_map.items():
                try:
                    if v:
                        current_level = max(current_level, int(k))
                except Exception:
                    continue
        except Exception:
            pass

    direct_count = await _fetch_one(
        db, "select count(*)::int as n from users where referrer_user_id = $1", uid
    )

    sponsor = None
    if user["referrer_user_id"]:
        sp = await _fetch_one(
            db,
            "select id, display_id, name from users where id = $1",
            int(user["referrer_user_id"]),
        )
        sponsor = dict(sp) if sp else None

    last_incomes = await _fetch_all(
        db,
        """
        select id, commission_type, amount, source_user_id, purchase_id, credited_at
        from ledger_entries
        where receiver_user_id = $1
        order by credited_at desc
        limit 20
        """,
        uid,
    )

    last_withdrawals = await _fetch_all(
        db,
        """
        select id, withdraw_type, amount, status, created_at, processed_at, rejection_reason
        from withdraw_requests
        where user_id = $1
        order by created_at desc
        limit 10
        """,
        uid,
    )

    return {
        "ok": True,
        "user": dict(user),
        "sponsor": sponsor,
        "current_level": current_level,
        "level_eligibility": eligibility_map,
        "direct_referrals": direct_count["n"] if direct_count else 0,
        "purchase_counts": dict(purchase_counts) if purchase_counts else None,
        "wallet_summary": dict(balances) if balances else {"balance": "0", "spot_balance": "0", "other_balance": "0", "team_royalty_balance": "0"},
        "active_package": dict(active_purchase) if active_purchase else None,
        "last_20_income_entries": [dict(r) for r in last_incomes],
        "last_10_withdrawals": [dict(r) for r in last_withdrawals],
    }


async def get_user_profile_by_display_id(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Admin-only helper: fetch a user's profile by SIA display id (e.g. SIA00299).
    """
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}

    display_id = str(params.get("display_id") or "").strip()
    if not display_id:
        return {"ok": False, "error": "display_id_required"}

    db: Db = ctx.db
    row = await _fetch_one(db, "select id from users where display_id = $1", display_id)
    if not row:
        return {"ok": False, "error": "user_not_found", "display_id": display_id}

    proxy_ctx = ToolContext(
        user_id=str(int(row["id"])),
        role=ctx.role,
        is_admin=ctx.is_admin,
        token=ctx.token,
        db=ctx.db,
    )
    out = await get_user_profile({}, proxy_ctx)
    if isinstance(out, dict):
        out["display_id"] = display_id
    return out


async def get_all_packages(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    rows = await _fetch_all(
        db,
        """
        select id, name, price, self_roi_percent, global_ids, direct_spot_percent, direct_monthly_royalty_percent,
               validity_months, validity_days, status, course_id
        from packages
        order by id asc
        """,
    )
    return {"ok": True, "packages": [dict(r) for r in rows]}


async def get_package_details(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    package_id = int(params["package_id"])
    row = await _fetch_one(
        db,
        """
        select *
        from packages
        where id = $1
        """,
        package_id,
    )
    if not row:
        return {"ok": False, "error": "package_not_found"}
    return {"ok": True, "package": dict(row)}


async def get_all_levels(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    rows = await _fetch_all(
        db,
        """
        select level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, icon_url, color
        from levels
        order by level asc
        """,
    )
    return {"ok": True, "levels": [dict(r) for r in rows]}


async def get_wallet_summary(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    row = await _fetch_one(
        db,
        """
        select balance, spot_balance, other_balance, team_royalty_balance, spot_team_withdraw_used,
               spot_team_flush_active, spot_team_limit_reached_at, updated_at
        from user_balances
        where user_id = $1
        """,
        uid,
    )
    return {"ok": True, "wallet": dict(row) if row else None}


async def validate_transaction(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    amount = float(params.get("amount") or 0)
    wallet = (params.get("wallet") or "balance").lower()
    if amount <= 0:
        return {"ok": False, "isValid": False, "reason": "amount_must_be_positive"}

    row = await _fetch_one(
        db,
        """
        select balance, spot_balance, other_balance, team_royalty_balance
        from user_balances
        where user_id = $1
        """,
        uid,
    )
    if not row:
        return {"ok": False, "isValid": False, "reason": "wallet_not_found"}

    available = float(row.get(wallet) if wallet in row else row["balance"])
    return {
        "ok": True,
        "isValid": available >= amount,
        "available": str(available),
        "requested": str(amount),
        "wallet": wallet,
        "reason": None if available >= amount else "insufficient_balance",
    }


async def calculate_withdrawable_amount(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    row = await _fetch_one(
        db,
        """
        select balance, spot_balance, other_balance, team_royalty_balance
        from user_balances
        where user_id = $1
        """,
        uid,
    )
    if not row:
        return {"ok": False, "error": "wallet_not_found"}
    return {
        "ok": True,
        "withdrawable_amount": str(row["balance"]),
        "breakdown": {k: str(row[k]) for k in row.keys()},
        "note": "Estimate only; MLM-API enforces fees/caps/KYC/holds on withdrawal creation.",
    }


async def get_user_network(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    depth = int(params.get("depth") or 5)
    include_upline = bool(params.get("includeUpline") or False)

    # Downline via closure table, then re-link via referrer_user_id to form a tree.
    downline = await _fetch_all(
        db,
        """
        select utp.descendant_id as user_id, utp.depth, u.display_id, u.name, u.role, u.status, u.referrer_user_id
        from user_tree_paths utp
        join users u on u.id = utp.descendant_id
        where utp.ancestor_id = $1
          and utp.depth between 1 and $2
        order by utp.depth asc, utp.descendant_id asc
        """,
        uid,
        depth,
    )

    nodes: dict[int, dict[str, Any]] = {
        uid: {"user_id": uid, "depth": 0, "children": []},
    }
    for r in downline:
        rid = int(r["user_id"])
        nodes[rid] = {**dict(r), "children": []}

    # Attach children based on sponsor/referrer pointers when available.
    for rid, node in list(nodes.items()):
        if rid == uid:
            continue
        parent = node.get("referrer_user_id")
        if parent is None:
            continue
        parent_id = int(parent)
        if parent_id in nodes:
            nodes[parent_id]["children"].append(node)

    out: dict[str, Any] = {"root": nodes[uid], "max_depth": depth}

    if include_upline:
        upline = await _fetch_all(
            db,
            """
            select utp.ancestor_id as user_id, utp.depth, u.display_id, u.name, u.role, u.status, u.referrer_user_id
            from user_tree_paths utp
            join users u on u.id = utp.ancestor_id
            where utp.descendant_id = $1
              and utp.depth between 1 and $2
            order by utp.depth asc
            """,
            uid,
            depth,
        )
        out["upline"] = [dict(r) for r in upline]

    return {"ok": True, **out}


async def get_user_income(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    income_type = (params.get("type") or "ALL").upper()
    limit = int(params.get("limit") or 50)
    offset = int(params.get("offset") or 0)

    where = ["receiver_user_id = $1"]
    args: list[Any] = [uid]
    if income_type != "ALL":
        where.append("commission_type = $2")
        args.append(income_type)

    sql = f"""
        select id, commission_type, amount, source_user_id, purchase_id, credited_at, metadata
        from ledger_entries
        where {" and ".join(where)}
        order by credited_at desc
        limit {limit} offset {offset}
    """
    rows = await _fetch_all(db, sql, *args)
    return {"ok": True, "items": [dict(r) for r in rows], "limit": limit, "offset": offset}


async def get_user_withdrawals(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    rows = await _fetch_all(
        db,
        """
        select id, withdraw_type, amount, status, payment_method, created_at, processed_at, remarks, rejection_reason
        from withdraw_requests
        where user_id = $1
        order by created_at desc
        limit 100
        """,
        uid,
    )
    return {"ok": True, "withdrawals": [dict(r) for r in rows]}


async def get_pending_commissions(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    summary = await _fetch_one(
        db,
        """
        select count(*)::int as total_count,
               coalesce(sum(amount),0)::text as total_amount
        from pending_commissions
        where receiver_user_id = $1
        """,
        uid,
    )
    by_type_rows = await _fetch_all(
        db,
        """
        select coalesce(commission_type::text,'UNKNOWN') as commission_type,
               count(*)::int as count,
               coalesce(sum(amount),0)::text as total_amount
        from pending_commissions
        where receiver_user_id = $1
        group by commission_type
        order by count desc
        """,
        uid,
    )
    by_level_rows = await _fetch_all(
        db,
        """
        select level, count(*)::int as count, coalesce(sum(amount),0)::text as total_amount
        from pending_commissions
        where receiver_user_id = $1
        group by level
        order by level
        """,
        uid,
    )
    rows = await _fetch_all(
        db,
        """
        select id, receiver_user_id, source_user_id, purchase_id, level, commission_type, amount, created_at, metadata
        from pending_commissions
        where receiver_user_id = $1
        order by created_at desc
        limit 50
        """,
        uid,
    )
    return {
        "ok": True,
        "user_id": uid,
        "total_count": summary["total_count"] if summary else 0,
        "total_amount": summary["total_amount"] if summary else "0",
        "by_commission_type": [dict(r) for r in by_type_rows],
        "by_level": [dict(r) for r in by_level_rows],
        "recent_sample": [dict(r) for r in rows],
        "note": "recent_sample is the last 50 entries; total_count is the true full count.",
    }


async def get_scheduled_commissions(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    # scheduled_commissions table removed; keep endpoint/tool for compatibility.
    return {"ok": True, "scheduled": [], "note": "scheduled_commissions_table_removed"}


async def get_commission_breakdown(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    pid = int(params["purchase_id"])
    rows = await _fetch_all(
        db,
        """
        select id, receiver_user_id, source_user_id, commission_type, amount, credited_at, metadata
        from ledger_entries
        where purchase_id = $1
        order by credited_at asc
        """,
        pid,
    )
    return {"ok": True, "purchase_id": pid, "ledger_entries": [dict(r) for r in rows]}


async def simulate_commission(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    pid = int(params["purchase_id"])
    purchase = await _fetch_one(
        db,
        "select id, user_id, package_id, amount, purchased_at from purchases where id = $1",
        pid,
    )
    if not purchase:
        return {"ok": False, "error": "purchase_not_found"}

    upline = await _fetch_all(
        db,
        """
        select utp.ancestor_id as user_id, utp.depth,
               u.display_id, u.name, u.status, u.role
        from user_tree_paths utp
        join users u on u.id = utp.ancestor_id
        where utp.descendant_id = $1
          and utp.depth between 1 and 9
        order by utp.depth asc
        """,
        int(purchase["user_id"]),
    )

    rules = await _fetch_all(
        db,
        "select id, type, level, percent, fixed_amount, eligibility from commission_rules order by id asc",
    )

    return {
        "ok": True,
        "purchase": dict(purchase),
        "upline_chain": [dict(r) for r in upline],
        "commission_rules": [dict(r) for r in rules],
        "note": "Estimator only. Real commission crediting is executed by MLM-API.",
    }


async def get_user_eligibility(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    row = await _fetch_one(
        db,
        """
        select user_id, eligibility, updated_at
        from level_eligibility
        where user_id = $1
        """,
        uid,
    )
    return {"ok": True, "eligibility": dict(row) if row else None}


async def get_level_requirements(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    level = int(params["level"])
    row = await _fetch_one(
        db,
        """
        select level, title, business_requirement, spot_commission_percent, monthly_royalty_percent
        from levels
        where level = $1
        """,
        level,
    )
    return {"ok": True, "level": dict(row) if row else None}


async def get_user_transactions(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    limit = int(params.get("limit") or 100)

    # Minimal combined view (income + withdrawals + fees).
    incomes = await _fetch_all(
        db,
        """
        select 'INCOME' as type, id::text as id, amount, credited_at as at, commission_type as subtype
        from ledger_entries
        where receiver_user_id = $1
        order by credited_at desc
        limit $2
        """,
        uid,
        limit,
    )
    withdrawals = await _fetch_all(
        db,
        """
        select 'WITHDRAWAL' as type, id::text as id, amount, created_at as at, status as subtype
        from withdraw_requests
        where user_id = $1
        order by created_at desc
        limit $2
        """,
        uid,
        limit,
    )
    fees = await _fetch_all(
        db,
        """
        select 'FEE' as type, id::text as id, amount, created_at as at, rule_code as subtype
        from fee_transactions
        where user_id = $1
        order by created_at desc
        limit $2
        """,
        uid,
        limit,
    )

    items = [dict(r) for r in (list(incomes) + list(withdrawals) + list(fees))]
    items.sort(key=lambda x: str(x["at"]), reverse=True)
    return {"ok": True, "items": items[:limit]}


async def get_system_stats(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    users_total = await _fetch_one(db, "select count(*)::int as n from users")
    active_users = await _fetch_one(db, "select count(*)::int as n from users where status = 'active'")
    payouts = await _fetch_one(db, "select coalesce(sum(amount),0)::text as total from ledger_entries")
    invested_new = await _fetch_one(
        db,
        "select coalesce(sum(amount),0)::text as total, count(*)::int as count from purchases where status='completed'",
    )
    # Legacy activation (Excel import): price is embedded inside `data->>'New Package'`
    # Example: "English Speaking Basic -I - ₹2500.00" -> extract 2500.00
    invested_legacy = await _fetch_one(
        db,
        """
        select
          coalesce(
            sum(
              case
                when nullif(coalesce(data->>'New Package',''), '') is null then 0
                when (data->>'New Package') ~ '([0-9]+(\\.[0-9]+)?)' then
                  (regexp_replace(data->>'New Package', '.*?([0-9]+(\\.[0-9]+)?)\\D*$', '\\1'))::numeric
                else 0
              end
            )
          ,0)::text as total,
          count(*)::int as row_count
        from legacy_activation_history
        where coalesce(data->>'Status','') ilike any(array['%success%','%approved%'])
        """,
    )
    active_packages = await _fetch_one(
        db,
        """
        select count(*)::int as n
        from purchases
        where status = 'completed'
          and (income is null or income < (amount * 2))
        """,
    )
    return {
        "ok": True,
        "total_users": users_total["n"],
        "active_users": active_users["n"],
        "total_payouts": payouts["total"],
        "active_purchases": active_packages["n"],
        "total_invested_new": invested_new["total"] if invested_new else "0",
        "total_invested_legacy": invested_legacy["total"] if invested_legacy else "0",
        "total_invested_combined": str(
            (float(invested_new["total"] or 0) if invested_new else 0.0)
            + (float(invested_legacy["total"] or 0) if invested_legacy else 0.0)
        ),
    }


async def get_overall_investment_volume(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Admin-only: overall investment volume (new purchases + legacy activation).
    """
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}

    db: Db = ctx.db
    invested_new = await _fetch_one(
        db,
        "select coalesce(sum(amount),0)::text as total, count(*)::int as count from purchases where status='completed'",
    )
    invested_legacy = await _fetch_one(
        db,
        """
        select
          coalesce(
            sum(
              case
                when nullif(coalesce(data->>'New Package',''), '') is null then 0
                when (data->>'New Package') ~ '([0-9]+(\\.[0-9]+)?)' then
                  (regexp_replace(data->>'New Package', '.*?([0-9]+(\\.[0-9]+)?)\\D*$', '\\1'))::numeric
                else 0
              end
            )
          ,0)::text as total,
          count(*)::int as row_count
        from legacy_activation_history
        where coalesce(data->>'Status','') ilike any(array['%success%','%approved%'])
        """,
    )

    new_total = float(invested_new["total"] or 0) if invested_new else 0.0
    legacy_total = float(invested_legacy["total"] or 0) if invested_legacy else 0.0
    return {
        "ok": True,
        "new_system": {"total": invested_new["total"], "purchase_count": invested_new["count"]},
        "legacy_system": {"total": invested_legacy["total"], "activation_rows": invested_legacy["row_count"]},
        "combined_total": str(new_total + legacy_total),
        "note": (
            "combined_total = sum(completed purchases.amount) + sum(legacy_activation_history 'New Package' price). "
            "Legacy rows are Excel imports (pre-migration)."
        ),
    }


async def explain_system_concept(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    # This is LLM-native; tool returns structured anchors the model can use.
    return {"ok": True, "concept": params.get("concept"), "note": "Use Ai-plan.md sections for grounded explanation."}


async def get_user_level_progress(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    One-stop level progress: current level, next level, requirements vs achieved, gap.

    Output:
      current_level, next_level, eligibility_map,
      next_level_requirement: { total_business, required_leg_count, required_leg_min_amount },
      achieved: { team_business, qualifying_legs, direct_referrals },
      gap: { team_business, qualifying_legs }
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    elig = await _fetch_one(
        db, "select eligibility from level_eligibility where user_id = $1", uid
    )
    eligibility_map: dict[str, Any] = {}
    current_level = 0
    if elig and elig["eligibility"]:
        try:
            raw = elig["eligibility"]
            eligibility_map = raw if isinstance(raw, dict) else __import__("json").loads(raw)
            for k, v in eligibility_map.items():
                try:
                    if v:
                        current_level = max(current_level, int(k))
                except Exception:
                    continue
        except Exception:
            pass

    next_level = current_level + 1
    next_lvl_row = await _fetch_one(
        db,
        "select level, title, business_requirement from levels where level = $1",
        next_level,
    )

    # Aggregate team business across the whole downline (purchases.amount where status='completed').
    team_biz_row = await _fetch_one(
        db,
        """
        select coalesce(sum(p.amount),0)::text as total_business
        from user_tree_paths utp
        join purchases p on p.user_id = utp.descendant_id
        where utp.ancestor_id = $1 and utp.depth > 0 and p.status = 'completed'
        """,
        uid,
    )
    team_business = float(team_biz_row["total_business"] or 0)

    direct_count_row = await _fetch_one(
        db, "select count(*)::int as n from users where referrer_user_id = $1", uid
    )
    direct_referrals = direct_count_row["n"] if direct_count_row else 0

    # Per-leg business: for each direct referral, sum the full subtree purchases.
    legs_rows = await _fetch_all(
        db,
        """
        with directs as (
          select id from users where referrer_user_id = $1
        )
        select d.id as leg_user_id,
               coalesce(sum(p.amount),0)::text as leg_business
        from directs d
        left join user_tree_paths utp on utp.ancestor_id = d.id
        left join purchases p on p.user_id = utp.descendant_id and p.status = 'completed'
        group by d.id
        order by sum(p.amount) desc nulls last
        """,
        uid,
    )

    next_req: dict[str, Any] = {}
    if next_lvl_row and next_lvl_row["business_requirement"]:
        raw = next_lvl_row["business_requirement"]
        next_req = raw if isinstance(raw, dict) else __import__("json").loads(raw)

    required_per_leg = float(next_req.get("required_leg_min_amount") or 0)
    qualifying_legs = sum(
        1 for r in legs_rows if float(r["leg_business"] or 0) >= required_per_leg
    ) if required_per_leg else 0

    required_legs = int(next_req.get("required_leg_count") or 0)
    required_total = float(next_req.get("total_business") or 0)

    gap_business = max(0.0, required_total - team_business)
    gap_legs = max(0, required_legs - qualifying_legs)

    return {
        "ok": True,
        "user_id": uid,
        "current_level": current_level,
        "current_level_title": (
            (await _fetch_one(db, "select title from levels where level=$1", current_level))
            or {"title": None}
        ).get("title"),
        "next_level": next_lvl_row["level"] if next_lvl_row else None,
        "next_level_title": next_lvl_row["title"] if next_lvl_row else None,
        "next_level_requirement": {
            "total_business": str(required_total),
            "required_leg_count": required_legs,
            "required_leg_min_amount": str(required_per_leg),
        },
        "achieved": {
            "team_business": str(team_business),
            "qualifying_legs": qualifying_legs,
            "direct_referrals": direct_referrals,
        },
        "gap": {
            "team_business": str(gap_business),
            "qualifying_legs": gap_legs,
        },
        "eligibility_map": eligibility_map,
        "legs_breakdown": [
            {"leg_user_id": int(r["leg_user_id"]), "leg_business": r["leg_business"]}
            for r in legs_rows
        ],
        "note": "team_business = sum of completed purchases across full downline subtree. qualifying_legs = legs whose full subtree business >= required_leg_min_amount.",
    }


async def get_my_purchases(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Full purchase history for the user: every package they ever bought,
    with status (completed/pending), active vs expired-2x, package name and price.
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    rows = await _fetch_all(
        db,
        """
        select p.id, p.package_id, pk.name as package_name, pk.price as package_price,
               p.amount, p.income, p.status::text as status, p.purchase_type::text as purchase_type,
               p.is_renewal, p.purchased_at,
               case when p.status = 'completed' and p.income is not null and p.income >= p.amount * 2
                    then 'expired_2x'
                    when p.status = 'completed' then 'active'
                    else p.status::text
               end as effective_status
        from purchases p
        join packages pk on pk.id = p.package_id
        where p.user_id = $1
        order by p.purchased_at asc
        """,
        uid,
    )

    summary = {
        "total": len(rows),
        "active": sum(1 for r in rows if r["effective_status"] == "active"),
        "expired_2x": sum(1 for r in rows if r["effective_status"] == "expired_2x"),
        "pending": sum(1 for r in rows if r["effective_status"] == "pending"),
    }
    return {"ok": True, "user_id": uid, "summary": summary, "purchases": [dict(r) for r in rows]}


async def get_pending_purchase_requests(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Purchase activation requests sitting in pending state for the user
    (or for everyone if scope='global' and admin).
    """
    db: Db = ctx.db
    scope = (params.get("scope") or "user").lower()
    if scope == "global" and not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}

    if scope == "user":
        uid = await _resolve_user_id(params, ctx)
        if uid is None:
            return {"ok": False, "error": "user_not_found"}
        rows = await _fetch_all(
            db,
            """
            select pr.id, pr.user_id, pr.package_id, pk.name as package_name, pk.price as package_price,
                   pr.amount, pr.status::text as status, pr.request_type::text as request_type,
                   pr.created_at
            from purchase_requests pr
            join packages pk on pk.id = pr.package_id
            where pr.user_id = $1 and pr.status = 'pending'
            order by pr.created_at desc
            """,
            uid,
        )
    else:
        rows = await _fetch_all(
            db,
            """
            select pr.id, pr.user_id, u.display_id, pr.package_id, pk.name as package_name,
                   pr.amount, pr.status::text as status, pr.request_type::text as request_type, pr.created_at
            from purchase_requests pr
            join packages pk on pk.id = pr.package_id
            join users u on u.id = pr.user_id
            where pr.status = 'pending'
            order by pr.created_at desc
            limit 200
            """,
        )

    return {"ok": True, "scope": scope, "count": len(rows), "requests": [dict(r) for r in rows]}


async def diagnose_missing_commission(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Explain why a user may not be receiving an expected commission of a given type.

    Params:
      commission_type : SELF | GLOBAL_HELPING | SPOT | MONTHLY (default SPOT)
      level           : optional int (1..9)
      user_id / display_id : admin override
    Returns: blockers list + relevant facts (KYC, active package, pending vs ledger, recent downline activity).
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    ctype = (params.get("commission_type") or "SPOT").upper()
    if ctype not in {"SELF", "GLOBAL_HELPING", "SPOT", "MONTHLY"}:
        ctype = "SPOT"
    level = params.get("level")
    try:
        level = int(level) if level is not None else None
    except Exception:
        level = None

    user = await _fetch_one(
        db,
        """
        select status, kyc_status::text as kyc_status, withdrawal_blocked, is_disqualified
        from users where id = $1
        """,
        uid,
    )
    if not user:
        return {"ok": False, "error": "user_not_found"}

    active_pkg = await _fetch_one(
        db,
        """
        select id, package_id, amount, income
        from purchases
        where user_id = $1 and status='completed' and (income is null or income < amount * 2)
        order by purchased_at desc limit 1
        """,
        uid,
    )

    pending_args: list[Any] = [uid, ctype]
    pending_where = ["receiver_user_id = $1", "commission_type::text = $2"]
    if level is not None:
        pending_where.append("level = $3")
        pending_args.append(level)
    pending = await _fetch_all(
        db,
        f"""
        select id, source_user_id, level, amount, created_at
        from pending_commissions
        where {" and ".join(pending_where)}
        order by created_at desc
        limit 10
        """,
        *pending_args,
    )

    ledger_recent = await _fetch_all(
        db,
        """
        select id, source_user_id, amount, credited_at
        from ledger_entries
        where receiver_user_id = $1 and commission_type::text = $2
        order by credited_at desc
        limit 10
        """,
        uid,
        ctype,
    )

    ledger_totals = await _fetch_one(
        db,
        """
        select coalesce(sum(amount),0)::text as total, count(*)::int as count
        from ledger_entries
        where receiver_user_id = $1 and commission_type::text = $2
        """,
        uid,
        ctype,
    )

    # SPOT (or any type) credited from *direct* downline: source user’s sponsor is the receiver.
    from_directs = None
    if ctype == "SPOT":
        from_directs = await _fetch_one(
            db,
            """
            select coalesce(sum(le.amount),0)::text as total, count(*)::int as count
            from ledger_entries le
            join users src on src.id = le.source_user_id
            where le.receiver_user_id = $1
              and le.commission_type::text = 'SPOT'
              and src.referrer_user_id = $1
            """,
            uid,
        )

    # Recent downline activations (likely commission triggers).
    downline_recent = await _fetch_all(
        db,
        """
        select u.display_id, p.id as purchase_id, p.amount, p.purchased_at, utp.depth
        from user_tree_paths utp
        join purchases p on p.user_id = utp.descendant_id
        join users u on u.id = utp.descendant_id
        where utp.ancestor_id = $1 and utp.depth > 0 and p.status='completed'
        order by p.purchased_at desc
        limit 10
        """,
        uid,
    )

    blockers: list[str] = []
    if (user["kyc_status"] or "") != "approved" and ctype in {"SELF", "GLOBAL_HELPING", "SPOT", "MONTHLY"}:
        blockers.append(f"kyc_not_approved:{user['kyc_status']}")
    if user["is_disqualified"]:
        blockers.append("user_disqualified")
    if (user["status"] or "active") != "active":
        blockers.append(f"account_status:{user['status']}")
    if not active_pkg and ctype in {"SPOT", "MONTHLY", "SELF", "GLOBAL_HELPING"}:
        blockers.append("no_active_package_required_for_this_commission_type")

    return {
        "ok": True,
        "user_id": uid,
        "commission_type": ctype,
        "level_filter": level,
        "user_state": dict(user),
        "active_package": dict(active_pkg) if active_pkg else None,
        "pending_commissions_sample": [dict(r) for r in pending],
        "ledger_recent_sample": [dict(r) for r in ledger_recent],
        "ledger_totals": dict(ledger_totals) if ledger_totals else None,
        "credited_from_direct_referrals_only": dict(from_directs) if from_directs else None,
        "recent_downline_activations": [dict(r) for r in downline_recent],
        "blockers": blockers,
        "hint": (
            "If blockers is empty and pending_commissions_sample is non-empty, the credits will move from "
            "pending_commissions -> ledger_entries when the user's eligibility/rules are satisfied. "
            "If ledger_recent_sample is also empty for this commission_type, the user may not have any "
            "qualifying upline activity for this type."
        ),
    }


async def get_user_legs(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    direct = await _fetch_all(
        db,
        """
        select id as user_id, display_id, name, status, role
        from users
        where referrer_user_id = $1
        order by id asc
        """,
        uid,
    )
    legs: list[dict[str, Any]] = []
    for r in direct:
        leg_id = int(r["user_id"])
        business = await _fetch_one(
            db,
            """
            select coalesce(sum(p.amount),0)::text as total
            from user_tree_paths utp
            join purchases p on p.user_id = utp.descendant_id
            where utp.ancestor_id = $1
              and p.status = 'completed'
            """,
            leg_id,
        )
        legs.append({**dict(r), "total_business": business["total"]})
    return {"ok": True, "legs": legs}


async def analyze_user_growth(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    legs_resp = await get_user_legs(params, ctx)
    legs = legs_resp.get("legs") or []
    if not legs:
        return {"ok": True, "insights": ["No direct legs found."], "legs": []}

    def _as_float(x: str) -> float:
        try:
            return float(x)
        except Exception:
            return 0.0

    legs_sorted = sorted(legs, key=lambda x: _as_float(x.get("total_business", "0")), reverse=True)
    strongest = legs_sorted[0]
    weakest = legs_sorted[-1]
    return {
        "ok": True,
        "strongest_leg": strongest,
        "weakest_leg": weakest,
        "insights": [
            f"Strongest leg: {strongest.get('display_id') or strongest.get('user_id')} (business {strongest.get('total_business')})",
            f"Weakest leg: {weakest.get('display_id') or weakest.get('user_id')} (business {weakest.get('total_business')})",
        ],
    }


async def audit_user_wallet(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    bal = await _fetch_one(
        db,
        "select balance, spot_balance, other_balance, team_royalty_balance from user_balances where user_id = $1",
        uid,
    )
    tx_sum = await _fetch_one(
        db,
        "select coalesce(sum(amount),0)::text as total from wallet_transactions where receiver_user_id = $1",
        uid,
    )
    return {
        "ok": True,
        "expected_from_wallet_transactions": tx_sum["total"],
        "current_user_balances": dict(bal) if bal else None,
        "note": "Lightweight audit only; MLM-API ledger + wallet logic is the source of truth.",
    }


async def get_user_legacy_data(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    db: Db = ctx.db
    uid = int(ctx.user_id)
    async with db.pool.acquire() as conn:
        legacy_tables = ["legacy_activation_history", "legacy_spot_history", "legacy_income_history"]
        exists: dict[str, bool] = {}
        for t in legacy_tables:
            r = await conn.fetchrow("select to_regclass($1) as reg", t)
            exists[t] = bool(r and r["reg"])

        out: dict[str, Any] = {"ok": True, "tables": exists, "data": {}}
        for t, ok in exists.items():
            if not ok:
                out["data"][t] = []
                continue
            rows = await conn.fetch(f"select * from {t} where user_id = $1 order by 1 desc limit 50", uid)
            out["data"][t] = [dict(x) for x in rows]
        return out


# ---------------------------------------------------------------------------
# Legacy / migration helpers
# ---------------------------------------------------------------------------

def _legacy_spot_ts_expr() -> str:
    """
    legacy_spot_history.data->>'credited_date' has mixed formats:
    - '17-12-2025 20:31' (DD-MM-YYYY HH:MI)
    - ISO like '2025-02-03T15:00:50.000Z'
    We normalize to timestamptz using a CASE expression.
    """
    return (
        "case "
        "when (t.data->>'credited_date') ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4} [0-9]{2}:[0-9]{2}$' "
        "  then to_timestamp(t.data->>'credited_date','DD-MM-YYYY HH24:MI')::timestamptz "
        "when (t.data->>'credited_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' "
        "  then (t.data->>'credited_date')::timestamptz "
        "else null::timestamptz end"
    )


async def get_user_migration_context(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Return migration boundary context and what data exists in legacy vs ledger for this user.
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    # Boundary (documented): 18 Dec 2025
    boundary = "2025-12-18"

    led_minmax = await _fetch_one(
        db,
        """
        select min(credited_at)::text as min_at, max(credited_at)::text as max_at, count(*)::int as n
        from ledger_entries
        where receiver_user_id = $1
        """,
        uid,
    )
    bal = await _fetch_one(
        db,
        """
        select balance, spot_balance, other_balance, team_royalty_balance, updated_at
        from user_balances where user_id = $1
        """,
        uid,
    )
    legacy_spot_cnt = await _fetch_one(db, "select count(*)::int as n from legacy_spot_history where user_id=$1", uid)
    legacy_act_cnt = await _fetch_one(db, "select count(*)::int as n from legacy_activation_history where user_id=$1", uid)

    return {
        "ok": True,
        "user_id": uid,
        "migration_boundary_date": boundary,
        "note": (
            "Legacy migration was state-based. Wallet balances and active package state were migrated as a snapshot. "
            "The ledger is not a complete historical record; it mainly represents post-migration activity."
        ),
        "ledger_presence": dict(led_minmax) if led_minmax else None,
        "legacy_presence": {
            "legacy_spot_rows": legacy_spot_cnt["n"] if legacy_spot_cnt else 0,
            "legacy_activation_rows": legacy_act_cnt["n"] if legacy_act_cnt else 0,
        },
        "wallet_snapshot": dict(bal) if bal else None,
    }


async def get_user_legacy_spot_summary(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Summarize legacy_spot_history for a user (read-only Excel import).

    Params (optional):
      user_id / display_id : admin override
      from_date / to_date  : YYYY-MM-DD (filters by parsed credited_date)
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    where = ["t.user_id = $1", "nullif(t.data->>'income_amount','') is not null"]
    args: list[Any] = [uid]
    idx = 2

    ts_expr = _legacy_spot_ts_expr()
    if params.get("from_date"):
        where.append(f"{ts_expr} >= ${idx}::timestamptz")
        args.append(str(params["from_date"]))
        idx += 1
    if params.get("to_date"):
        where.append(f"{ts_expr} < (${idx}::timestamptz + interval '1 day')")
        args.append(str(params["to_date"]))
        idx += 1

    total = await _fetch_one(
        db,
        f"""
        select
          coalesce(sum((t.data->>'income_amount')::numeric),0)::text as total_amount,
          count(*)::int as row_count,
          min({ts_expr})::text as min_credited_at,
          max({ts_expr})::text as max_credited_at
        from legacy_spot_history t
        where {" and ".join(where)}
        """,
        *args,
    )

    by_level = await _fetch_all(
        db,
        f"""
        select coalesce(t.data->>'income_lvl','') as income_level,
               coalesce(sum((t.data->>'income_amount')::numeric),0)::text as total_amount,
               count(*)::int as row_count
        from legacy_spot_history t
        where {" and ".join(where)}
        group by coalesce(t.data->>'income_lvl','')
        order by coalesce(t.data->>'income_lvl','')
        """,
        *args,
    )

    return {
        "ok": True,
        "user_id": uid,
        "filter": {"from_date": params.get("from_date"), "to_date": params.get("to_date")},
        "total": dict(total) if total else None,
        "by_income_level": [dict(r) for r in by_level],
        "note": (
            "This is legacy SPOT history imported from Excel. It is read-only and is NOT part of the active ledger "
            "computation, but it explains pre-migration earnings and complaints."
        ),
    }


async def get_user_legacy_activation_summary(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Summarize legacy_activation_history for a user (read-only Excel import).

    Returns:
      total rows + counts by Status/Request Type + last few items (key fields).
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    total = await _fetch_one(
        db,
        "select count(*)::int as row_count from legacy_activation_history where user_id=$1",
        uid,
    )
    by_status = await _fetch_all(
        db,
        """
        select coalesce(data->>'Status','') as status, count(*)::int as count
        from legacy_activation_history
        where user_id=$1
        group by coalesce(data->>'Status','')
        order by count(*) desc
        """,
        uid,
    )
    by_type = await _fetch_all(
        db,
        """
        select coalesce(data->>'Request Type','') as request_type, count(*)::int as count
        from legacy_activation_history
        where user_id=$1
        group by coalesce(data->>'Request Type','')
        order by count(*) desc
        """,
        uid,
    )
    last_items = await _fetch_all(
        db,
        """
        select id, imported_at,
               data->>'Status' as status,
               data->>'Request Type' as request_type,
               data->>'New Package' as new_package,
               data->>'UTR / Txn ID' as utr_txn_id,
               data->>'Clarification' as clarification
        from legacy_activation_history
        where user_id=$1
        order by imported_at desc, id desc
        limit 5
        """,
        uid,
    )

    return {
        "ok": True,
        "user_id": uid,
        "total": {"row_count": total["row_count"] if total else 0},
        "by_status": [dict(r) for r in by_status],
        "by_request_type": [dict(r) for r in by_type],
        "last_items": [dict(r) for r in last_items],
        "note": "This is legacy activation history imported from Excel. Read-only reference; not part of active ledger computation.",
    }


async def compare_legacy_spot_vs_ledger_spot(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Compare legacy spot income (Excel import) vs ledger_entries SPOT for this user.
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    legacy_total = await _fetch_one(
        db,
        """
        select coalesce(sum((data->>'income_amount')::numeric),0)::text as total, count(*)::int as count
        from legacy_spot_history
        where user_id=$1 and nullif(data->>'income_amount','') is not null
        """,
        uid,
    )
    ledger_total = await _fetch_one(
        db,
        """
        select coalesce(sum(amount),0)::text as total, count(*)::int as count
        from ledger_entries
        where receiver_user_id=$1 and commission_type='SPOT'
        """,
        uid,
    )
    return {
        "ok": True,
        "user_id": uid,
        "legacy_spot": dict(legacy_total) if legacy_total else None,
        "ledger_spot": dict(ledger_total) if ledger_total else None,
        "explanation": (
            "If legacy_spot.total is significant, it means SPOT earnings existed in the old system before migration. "
            "Those rows are not part of the new ledger, so ledger SPOT may look lower even when overall earnings are correct."
        ),
    }


async def explain_purchase_income_mismatch(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Explain why a purchase's `income` (2x tracking) may not match visible ledger entries.
    This is common for migrated users because the purchase state could have been seeded with a baseline.

    Params:
      purchase_id (required)
    """
    db: Db = ctx.db
    pid = int(params["purchase_id"])
    purchase = await _fetch_one(
        db,
        """
        select p.id, p.user_id, u.display_id, p.package_id, pk.name as package_name,
               p.amount, p.income, p.status::text as status, p.purchased_at
        from purchases p
        join users u on u.id=p.user_id
        join packages pk on pk.id=p.package_id
        where p.id=$1
        """,
        pid,
    )
    if not purchase:
        return {"ok": False, "error": "purchase_not_found"}

    # Visibility restriction: non-admin can only introspect their own purchase.
    if not ctx.is_admin and int(purchase["user_id"]) != int(ctx.user_id):
        return {"ok": False, "error": "forbidden"}

    ledger_by_type = await _fetch_all(
        db,
        """
        select commission_type::text as commission_type,
               coalesce(sum(amount),0)::text as total,
               count(*)::int as count
        from ledger_entries
        where purchase_id=$1 and receiver_user_id=$2
        group by commission_type
        order by commission_type
        """,
        pid,
        int(purchase["user_id"]),
    )
    ledger_total = await _fetch_one(
        db,
        "select coalesce(sum(amount),0)::text as total from ledger_entries where purchase_id=$1 and receiver_user_id=$2",
        pid,
        int(purchase["user_id"]),
    )

    # Add legacy spot context (not tied to purchase, but useful for pre-migration narrative)
    legacy_spot = await _fetch_one(
        db,
        "select coalesce(sum((data->>'income_amount')::numeric),0)::text as total, count(*)::int as count from legacy_spot_history where user_id=$1 and nullif(data->>'income_amount','') is not null",
        int(purchase["user_id"]),
    )

    amount = float(purchase["amount"] or 0)
    income = float(purchase["income"] or 0)
    target_2x = amount * 2
    return {
        "ok": True,
        "purchase": dict(purchase),
        "two_x": {"target": str(target_2x), "purchase_income_counter": str(income), "amount": str(amount)},
        "ledger_total_for_purchase": ledger_total["total"] if ledger_total else "0",
        "ledger_by_type_for_purchase": [dict(r) for r in ledger_by_type],
        "legacy_spot_context_for_user": dict(legacy_spot) if legacy_spot else None,
        "explanation": (
            "In the new system, purchases track 2x expiry using the `purchases.income` counter. "
            "For migrated users, that counter and/or balances can include pre-migration baseline. "
            "So ledger entries after 18-Dec-2025 may not fully explain the total income used for expiry."
        ),
    }


async def not_implemented(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    return {"ok": False, "error": "not_implemented_yet"}


# ---------------------------------------------------------------------------
# Helpers for new aggregate / date / projection tools.
# ---------------------------------------------------------------------------

# Withdrawal date rules (mirror MLM-API/src/utils/withdrawal-date.ts):
#   day 10 or 20 -> SPOT only
#   day 30 (or 28 in February) -> SPOT + OTHER (main) + TEAM_ROYALTY (all)
# All withdrawal logic is evaluated in IST (UTC+5:30).

import datetime as _dt


def _ist_now() -> _dt.datetime:
    # IST = UTC+5:30; tz-naive but consistent semantics.
    return _dt.datetime.utcnow() + _dt.timedelta(hours=5, minutes=30)


def _next_withdrawal_date(now: _dt.datetime | None = None) -> dict[str, Any]:
    """Return next allowed withdrawal date and the wallets allowed on that date.
    Logic mirrors `isWithdrawalDateAllowed()` in MLM-API.
    """
    n = now or _ist_now()
    today = n.date()
    candidates: list[tuple[_dt.date, list[str]]] = []
    # Look up to ~40 days ahead; we only need the very next one.
    for offset in range(0, 40):
        d = today + _dt.timedelta(days=offset)
        day = d.day
        is_feb = d.month == 2
        if day in (10, 20):
            candidates.append((d, ["spot"]))
        elif (is_feb and day == 28) or (not is_feb and day == 30):
            candidates.append((d, ["spot", "other", "team_royalty"]))
        if candidates:
            break
    next_date, wallets = candidates[0]
    return {
        "ist_today": today.isoformat(),
        "next_withdrawal_date": next_date.isoformat(),
        "days_until": (next_date - today).days,
        "is_today": next_date == today,
        "allowed_wallets": wallets,
        "rule": (
            "SPOT only on 10th & 20th; on 30th (28th in February) all wallets "
            "(SPOT + Main/Other + Team Royalty)."
        ),
    }


async def _resolve_user_id(params: dict[str, Any], ctx: ToolContext) -> int | None:
    """Resolve target user id.

    For non-admins: always the caller (ignore params).
    For admins: optional `user_id` (int) or `display_id` (e.g. SIA00299) takes precedence.
    """
    if not ctx.is_admin:
        try:
            return int(ctx.user_id)
        except Exception:
            return None
    if params.get("user_id") is not None:
        try:
            return int(params["user_id"])
        except Exception:
            return None
    did = (params.get("display_id") or "").strip().upper()
    if did:
        row = await _fetch_one(ctx.db, "select id from users where display_id = $1", did)
        if row:
            return int(row["id"])
        return None
    try:
        return int(ctx.user_id)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 1. Income summary (totals + by type, with optional date range and package)
# ---------------------------------------------------------------------------

async def get_income_summary(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Aggregate ledger_entries for a user.

    Params (all optional):
      user_id / display_id : admin-only target override
      package_id           : restrict to entries credited from purchases of this package
      days                 : last N days window (e.g. 5, 7, 30, 90)
      from_date / to_date  : ISO date strings (YYYY-MM-DD) – override `days`
      types                : list of CommissionType values to include
                             (SELF, GLOBAL_HELPING, SPOT, MONTHLY, FEE_DEDUCTION, ADMIN_OPS)
    Returns total + per-type breakdown.
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    where = ["le.receiver_user_id = $1"]
    args: list[Any] = [uid]
    idx = 2

    types = params.get("types")
    if isinstance(types, list) and types:
        place = ", ".join(f"${idx + i}" for i in range(len(types)))
        where.append(f"le.commission_type::text in ({place})")
        for t in types:
            args.append(str(t))
            idx += 1

    if params.get("from_date") or params.get("to_date"):
        if params.get("from_date"):
            where.append(f"le.credited_at >= ${idx}::timestamptz")
            args.append(str(params["from_date"]))
            idx += 1
        if params.get("to_date"):
            where.append(f"le.credited_at < (${idx}::timestamptz + interval '1 day')")
            args.append(str(params["to_date"]))
            idx += 1
    elif params.get("days") is not None:
        try:
            days = int(params["days"])
            where.append(f"le.credited_at >= now() - (${idx} || ' days')::interval")
            args.append(str(days))
            idx += 1
        except Exception:
            pass

    pkg_join = ""
    if params.get("package_id") is not None:
        pkg_join = "join purchases p on p.id = le.purchase_id"
        where.append(f"p.package_id = ${idx}")
        args.append(int(params["package_id"]))
        idx += 1

    sql_total = f"""
        select coalesce(sum(le.amount),0)::text as total, count(*)::int as count
        from ledger_entries le
        {pkg_join}
        where {" and ".join(where)}
    """
    sql_by_type = f"""
        select le.commission_type::text as commission_type,
               coalesce(sum(le.amount),0)::text as total,
               count(*)::int as count
        from ledger_entries le
        {pkg_join}
        where {" and ".join(where)}
        group by le.commission_type
        order by le.commission_type
    """
    total_row = await _fetch_one(db, sql_total, *args)
    rows = await _fetch_all(db, sql_by_type, *args)

    return {
        "ok": True,
        "user_id": uid,
        "filter": {
            "package_id": params.get("package_id"),
            "days": params.get("days"),
            "from_date": params.get("from_date"),
            "to_date": params.get("to_date"),
            "types": types,
        },
        "total_amount": total_row["total"] if total_row else "0",
        "entry_count": total_row["count"] if total_row else 0,
        "by_type": [dict(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# 2. Withdrawal counts (per user or global), grouped by status
# ---------------------------------------------------------------------------

async def get_withdrawal_counts(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Count withdrawal requests grouped by status.

    Params:
      user_id / display_id : admin-only target user
      scope                : "user" (default) or "global" (admin-only)
      days                 : last N days window
      on_date              : optional YYYY-MM-DD (interpreted in IST) to restrict to that calendar day
    """
    db: Db = ctx.db
    scope = (params.get("scope") or "user").lower()
    if scope == "global" and not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}

    where: list[str] = []
    args: list[Any] = []
    idx = 1
    if scope == "user":
        uid = await _resolve_user_id(params, ctx)
        if uid is None:
            return {"ok": False, "error": "user_not_found"}
        where.append(f"user_id = ${idx}")
        args.append(uid)
        idx += 1
    if params.get("days") is not None:
        try:
            where.append(f"created_at >= now() - (${idx} || ' days')::interval")
            args.append(str(int(params["days"])))
            idx += 1
        except Exception:
            pass
    if params.get("on_date"):
        # Interpret calendar date in IST (matches product UI mental model).
        where.append(f"(created_at at time zone 'Asia/Kolkata')::date = ${idx}")
        try:
            args.append(_dt.date.fromisoformat(str(params["on_date"])))
        except Exception:
            # fallback (DB may still coerce); but avoid crashing tool
            args.append(str(params["on_date"]))
        idx += 1
    where_sql = ("where " + " and ".join(where)) if where else ""

    rows = await _fetch_all(
        db,
        f"""
        select status::text as status, count(*)::int as count, coalesce(sum(amount),0)::text as total_amount
        from withdraw_requests
        {where_sql}
        group by status
        order by status
        """,
        *args,
    )
    total_row = await _fetch_one(
        db,
        f"select count(*)::int as count, coalesce(sum(amount),0)::text as total_amount from withdraw_requests {where_sql}",
        *args,
    )
    return {
        "ok": True,
        "scope": scope,
        "filter": {"days": params.get("days"), "user_id": args[0] if scope == "user" else None},
        "total_count": total_row["count"] if total_row else 0,
        "total_amount": total_row["total_amount"] if total_row else "0",
        "by_status": [dict(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# 2b. Latest withdrawal (admin-friendly)
# ---------------------------------------------------------------------------

async def get_latest_withdrawal(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Fetch the latest withdrawal request.

    Admin defaults:
      - If admin and no target user is provided, returns latest PLATFORM withdrawal (global).
      - If display_id/user_id provided, returns latest for that user.

    Params:
      scope: "global" | "user" (optional). If omitted:
        - admin -> global
        - user  -> user
      user_id / display_id: admin-only target user (when scope=user)
      status: optional status filter (e.g. "Success", "Approved", "Pending")
    """
    db: Db = ctx.db

    scope = (params.get("scope") or ("global" if ctx.is_admin else "user")).lower()
    if scope == "global" and not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}

    where: list[str] = []
    args: list[Any] = []
    idx = 1

    if scope == "user":
        uid = await _resolve_user_id(params, ctx)
        if uid is None:
            return {"ok": False, "error": "user_not_found"}
        where.append(f"user_id = ${idx}")
        args.append(uid)
        idx += 1

    if params.get("status"):
        where.append(f"status::text = ${idx}")
        args.append(str(params["status"]))
        idx += 1

    where_sql = ("where " + " and ".join(where)) if where else ""
    row = await _fetch_one(
        db,
        f"""
        select id, user_id, withdraw_type, amount, status::text as status, payment_method,
               created_at, processed_at, remarks, rejection_reason
        from withdraw_requests
        {where_sql}
        order by coalesce(processed_at, created_at) desc
        limit 1
        """,
        *args,
    )
    return {"ok": True, "scope": scope, "withdrawal": dict(row) if row else None}


# ---------------------------------------------------------------------------
# 3. KYC counts (admin-friendly) + direct referral count + network size
# ---------------------------------------------------------------------------

async def get_kyc_counts(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}
    db: Db = ctx.db
    rows = await _fetch_all(
        db,
        """
        select kyc_status::text as kyc_status, count(*)::int as count
        from users
        group by kyc_status
        order by kyc_status
        """,
    )
    total = await _fetch_one(db, "select count(*)::int as n from users")
    return {"ok": True, "total_users": total["n"], "by_kyc_status": [dict(r) for r in rows]}


async def admin_list_pending_kycs(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Admin-only: list users whose kyc_status='submitted' (awaiting approval).
    """
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}

    db: Db = ctx.db
    limit = int(params.get("limit") or 25)
    limit = max(1, min(200, limit))

    rows = await _fetch_all(
        db,
        """
        select
          u.id::text as user_id,
          u.display_id,
          u.name,
          u.email,
          u.kyc_status::text as kyc_status,
          u.kyc_verified_at,
          u.created_at,
          u.updated_at,
          up.phone,
          up.pan_number,
          up.aadhar_number,
          up.bank_account_no,
          up.bank_ifsc,
          up.bank_name,
          up.bank_branch,
          up.bank_ac_holder,
          up.address,
          up.city,
          up.state,
          up.pincode
        from users u
        left join user_profiles up on up.user_id = u.id
        where u.kyc_status = 'submitted'
        order by u.updated_at desc
        limit $1
        """,
        limit,
    )
    items: list[dict[str, Any]] = []
    for r in rows:
        rr = dict(r)
        items.append(
            {
                "user_id": rr.get("user_id"),
                "display_id": rr.get("display_id"),
                "name": rr.get("name"),
                "email": rr.get("email"),
                "kyc_status": rr.get("kyc_status"),
                "kyc_verified_at": rr.get("kyc_verified_at"),
                "created_at": rr.get("created_at"),
                "updated_at": rr.get("updated_at"),
                "profile": {
                    "phone": rr.get("phone"),
                    "pan_number": rr.get("pan_number"),
                    "aadhar_number": rr.get("aadhar_number"),
                    "bank_account_no": rr.get("bank_account_no"),
                    "bank_ifsc": rr.get("bank_ifsc"),
                    "bank_name": rr.get("bank_name"),
                    "bank_branch": rr.get("bank_branch"),
                    "bank_ac_holder": rr.get("bank_ac_holder"),
                    "address": rr.get("address"),
                    "city": rr.get("city"),
                    "state": rr.get("state"),
                    "pincode": rr.get("pincode"),
                },
            }
        )

    return {"ok": True, "count": len(items), "items": items, "limit": limit}


async def get_direct_referral_count(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """Count of direct referrals (users.referrer_user_id = uid)."""
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}
    row = await _fetch_one(
        db, "select count(*)::int as n from users where referrer_user_id = $1", uid
    )
    return {"ok": True, "user_id": uid, "direct_referrals": row["n"] if row else 0}


async def get_network_size(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """Closure-table downline counts (excluding self) and per-depth breakdown."""
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}
    total = await _fetch_one(
        db,
        "select count(*)::int as n from user_tree_paths where ancestor_id = $1 and depth > 0",
        uid,
    )
    by_depth = await _fetch_all(
        db,
        """
        select depth, count(*)::int as count
        from user_tree_paths
        where ancestor_id = $1 and depth > 0
        group by depth
        order by depth
        """,
        uid,
    )
    upline = await _fetch_one(
        db,
        "select count(*)::int as n from user_tree_paths where descendant_id = $1 and depth > 0",
        uid,
    )
    return {
        "ok": True,
        "user_id": uid,
        "downline_total": total["n"] if total else 0,
        "upline_depth": upline["n"] if upline else 0,
        "by_depth": [dict(r) for r in by_depth],
    }


# ---------------------------------------------------------------------------
# 4. Top referrers (admin)
# ---------------------------------------------------------------------------

async def get_top_referrers(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}
    db: Db = ctx.db
    limit = int(params.get("limit") or 10)
    rows = await _fetch_all(
        db,
        """
        select u.id::text as user_id, u.display_id, u.name, t.cnt::int as direct_referrals
        from (
            select referrer_user_id, count(*) as cnt
            from users
            where referrer_user_id is not null
            group by referrer_user_id
            order by count(*) desc
            limit $1
        ) t
        join users u on u.id = t.referrer_user_id
        order by t.cnt desc
        """,
        limit,
    )
    return {"ok": True, "top": [dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# 5. Withdrawal-date helpers + projections
# ---------------------------------------------------------------------------

async def get_next_withdrawal_date(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    return {"ok": True, **_next_withdrawal_date()}


async def get_eligible_withdrawal_amount(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    How much can the user withdraw on the upcoming allowed withdrawal date?

    Logic:
      1. Determine the next allowed withdrawal date and the wallets opened on that day.
      2. Sum the user's eligible wallet balances.
      3. Apply spot_team_withdraw_used cap (light estimate; MLM-API enforces final).
      4. Return blocked reasons (KYC not approved, withdrawal_blocked, no balance).
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    user = await _fetch_one(
        db,
        "select kyc_status::text as kyc_status, withdrawal_blocked, status from users where id = $1",
        uid,
    )
    if not user:
        return {"ok": False, "error": "user_not_found"}

    bal = await _fetch_one(
        db,
        """
        select balance, spot_balance, other_balance, team_royalty_balance,
               spot_team_withdraw_used
        from user_balances where user_id = $1
        """,
        uid,
    )
    if not bal:
        bal = {
            "balance": 0,
            "spot_balance": 0,
            "other_balance": 0,
            "team_royalty_balance": 0,
            "spot_team_withdraw_used": 0,
        }

    info = _next_withdrawal_date()
    allowed = set(info["allowed_wallets"])

    spot_amt = float(bal["spot_balance"] or 0) if "spot" in allowed else 0.0
    other_amt = float(bal["other_balance"] or 0) if "other" in allowed else 0.0
    royalty_amt = float(bal["team_royalty_balance"] or 0) if "team_royalty" in allowed else 0.0

    blockers: list[str] = []
    if (user["kyc_status"] or "") != "approved":
        blockers.append(f"kyc_not_approved:{user['kyc_status']}")
    if user["withdrawal_blocked"]:
        blockers.append("withdrawal_blocked")
    if (user["status"] or "active") != "active":
        blockers.append(f"account_status:{user['status']}")

    eligible_total = spot_amt + other_amt + royalty_amt

    return {
        "ok": True,
        "user_id": uid,
        "next_withdrawal_date": info["next_withdrawal_date"],
        "days_until": info["days_until"],
        "allowed_wallets": info["allowed_wallets"],
        "eligible_breakdown": {
            "spot": str(spot_amt),
            "other_main": str(other_amt),
            "team_royalty": str(royalty_amt),
        },
        "eligible_total": str(eligible_total),
        "blockers": blockers,
        "note": (
            "Estimate only. MLM-API also enforces fees, the spot/team-royalty 10x cap "
            "(getSpotTeamWithdrawLimit), and 10:00–17:00 IST time-window."
        ),
    }


async def get_admin_projected_withdrawal_demand(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Admin-only: projected withdrawal demand on the upcoming allowed withdrawal date,
    summed across all eligible users (KYC approved, not blocked, active).
    """
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}
    db: Db = ctx.db
    info = _next_withdrawal_date()
    allowed = set(info["allowed_wallets"])

    rows = await _fetch_one(
        db,
        """
        select
            sum(case when $1 then ub.spot_balance         else 0 end)::text as spot_pool,
            sum(case when $2 then ub.other_balance        else 0 end)::text as other_pool,
            sum(case when $3 then ub.team_royalty_balance else 0 end)::text as royalty_pool,
            count(*)::int as eligible_users
        from user_balances ub
        join users u on u.id = ub.user_id
        where u.status = 'active'
          and u.withdrawal_blocked = false
          and u.kyc_status = 'approved'
        """,
        ("spot" in allowed),
        ("other" in allowed),
        ("team_royalty" in allowed),
    )
    spot = float(rows["spot_pool"] or 0)
    other = float(rows["other_pool"] or 0)
    royalty = float(rows["royalty_pool"] or 0)
    return {
        "ok": True,
        "next_withdrawal_date": info["next_withdrawal_date"],
        "days_until": info["days_until"],
        "allowed_wallets": info["allowed_wallets"],
        "eligible_user_count": rows["eligible_users"],
        "projected_demand": {
            "spot": str(spot),
            "other_main": str(other),
            "team_royalty": str(royalty),
            "total_max": str(spot + other + royalty),
        },
        "note": (
            "Upper-bound estimate of demand: assumes every eligible user withdraws "
            "their full eligible balance. Actual demand is typically lower due to per-user 10x "
            "spot/royalty cap and partial requests."
        ),
    }


# ---------------------------------------------------------------------------
# 6. Lookup user by display_id (lightweight)
# ---------------------------------------------------------------------------

async def get_wallet_transactions_summary(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Aggregate wallet_transactions rows for a user (count + total credit).

    Params:
      user_id / display_id : admin override
      days                 : optional last-N-days window
    """
    db: Db = ctx.db
    uid = await _resolve_user_id(params, ctx)
    if uid is None:
        return {"ok": False, "error": "user_not_found"}

    where = ["receiver_user_id = $1"]
    args: list[Any] = [uid]
    idx = 2
    if params.get("days") is not None:
        try:
            where.append(f"created_at >= now() - (${idx} || ' days')::interval")
            args.append(str(int(params["days"])))
            idx += 1
        except Exception:
            pass

    summary = await _fetch_one(
        db,
        f"""
        select count(*)::int as count,
               coalesce(sum(amount),0)::text as total_amount,
               coalesce(sum(case when amount > 0 then amount else 0 end),0)::text as total_credit,
               coalesce(sum(case when amount < 0 then amount else 0 end),0)::text as total_debit
        from wallet_transactions
        where {" and ".join(where)}
        """,
        *args,
    )
    return {
        "ok": True,
        "user_id": uid,
        "filter": {"days": params.get("days")},
        "count": summary["count"] if summary else 0,
        "total_amount": summary["total_amount"] if summary else "0",
        "total_credit": summary["total_credit"] if summary else "0",
        "total_debit": summary["total_debit"] if summary else "0",
    }


async def get_admin_platform_stats(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """
    Admin-only: high-volume table counts that don't have dedicated aggregate tools.
    Returns counts for purchases, ledger_entries, wallet_transactions, pending_commissions, fees,
    plus active vs total user counts.
    """
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}
    db: Db = ctx.db
    out: dict[str, Any] = {"ok": True}
    queries = {
        "users_total": "select count(*)::int from users",
        "users_active": "select count(*)::int from users where status='active'",
        "purchases_total": "select count(*)::int from purchases",
        "purchases_completed": "select count(*)::int from purchases where status='completed'",
        "purchases_pending": "select count(*)::int from purchases where status='pending'",
        "ledger_entries_total": "select count(*)::int from ledger_entries",
        "wallet_transactions_total": "select count(*)::int from wallet_transactions",
        "pending_commissions_total": "select count(*)::int from pending_commissions",
        "fee_transactions_total": "select count(*)::int from fee_transactions",
        "withdraw_requests_total": "select count(*)::int from withdraw_requests",
    }
    for k, sql in queries.items():
        try:
            row = await _fetch_one(db, sql)
            out[k] = list(dict(row).values())[0] if row else 0
        except Exception:
            out[k] = None
    return out


async def lookup_user_by_display_id(params: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    """Resolve a SIA display id into core profile fields. Admin-only."""
    if not ctx.is_admin:
        return {"ok": False, "error": "forbidden_admin_only"}
    db: Db = ctx.db
    did = (params.get("display_id") or "").strip().upper()
    if not did:
        return {"ok": False, "error": "display_id_required"}
    row = await _fetch_one(
        db,
        """
        select id, display_id, name, email, phone, role::text as role,
               status, kyc_status::text as kyc_status, referrer_user_id
        from users where display_id = $1
        """,
        did,
    )
    if not row:
        return {"ok": False, "error": "user_not_found", "display_id": did}
    return {"ok": True, "user": dict(row)}


def build_read_tool_specs() -> list[ToolSpec]:
    return [
        ToolSpec(
            name="getUserProfile",
            description="Get user profile, sponsor/upline info, active package, wallet summary, and recent income/withdrawals.",
            input_schema=_simple_schema({}),
            handler=get_user_profile,
        ),
        ToolSpec(
            name="getUserProfileByDisplayId",
            description="Admin-only: Get a user's profile by SIA display id (e.g. SIA00299).",
            input_schema=_simple_schema({"display_id": {"type": "string"}}, required=["display_id"]),
            handler=get_user_profile_by_display_id,
        ),
        ToolSpec(
            name="getUserNetwork",
            description="Get user network tree via closure table (downline) and optionally upline.",
            input_schema=_simple_schema(
                {
                    "depth": {"type": "integer", "minimum": 1, "maximum": 50},
                    "includeUpline": {"type": "boolean"},
                }
            ),
            handler=get_user_network,
        ),
        ToolSpec(
            name="getUserIncome",
            description="Get user income (ledger entries) filtered by commission type.",
            input_schema=_simple_schema(
                {
                    "type": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 500},
                    "offset": {"type": "integer", "minimum": 0},
                }
            ),
            handler=get_user_income,
        ),
        ToolSpec(
            name="getUserTransactions",
            description="Get a combined list of transactions (income + withdrawals + fees).",
            input_schema=_simple_schema(
                {
                    "limit": {"type": "integer", "minimum": 1, "maximum": 500},
                }
            ),
            handler=get_user_transactions,
        ),
        ToolSpec(
            name="getUserWithdrawals",
            description="Get recent withdrawal requests for the user.",
            input_schema=_simple_schema({}),
            handler=get_user_withdrawals,
        ),
        ToolSpec(
            name="getUserLegacyData",
            description="Return legacy data when legacy tables exist (otherwise empty).",
            input_schema=_simple_schema({}),
            handler=get_user_legacy_data,
        ),
        ToolSpec(
            name="getUserMigrationContext",
            description=(
                "Migration/legacy context for a user: boundary date (18-Dec-2025), "
                "ledger presence window, legacy row presence, and current wallet snapshot. "
                "Use when users report mismatches due to migration."
            ),
            input_schema=_simple_schema({"user_id": {"type": "integer"}, "display_id": {"type": "string"}}),
            handler=get_user_migration_context,
        ),
        ToolSpec(
            name="getUserLegacySpotSummary",
            description=(
                "Summarize legacy SPOT history imported from Excel (read-only). "
                "Returns totals + by income level + min/max credited date. "
                "Useful for pre-migration income context."
            ),
            input_schema=_simple_schema(
                {
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                    "from_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "to_date": {"type": "string", "description": "YYYY-MM-DD"},
                }
            ),
            handler=get_user_legacy_spot_summary,
        ),
        ToolSpec(
            name="compareLegacySpotVsLedgerSpot",
            description=(
                "Compare legacy SPOT (Excel import) vs new-system ledger SPOT totals for a user. "
                "Use for 'spot income missing' and migration mismatch complaints."
            ),
            input_schema=_simple_schema({"user_id": {"type": "integer"}, "display_id": {"type": "string"}}),
            handler=compare_legacy_spot_vs_ledger_spot,
        ),
        ToolSpec(
            name="getUserLegacyActivationSummary",
            description=(
                "Summarize legacy activation history imported from Excel for a user. "
                "Returns row counts by Status/Request Type and last few entries with key fields. "
                "Use when user says 'purane system ka activation/renewal/reinvestment history dikh nahi rahi'."
            ),
            input_schema=_simple_schema({"user_id": {"type": "integer"}, "display_id": {"type": "string"}}),
            handler=get_user_legacy_activation_summary,
        ),
        ToolSpec(
            name="explainPurchaseIncomeMismatch",
            description=(
                "Explain why a purchase's 2x income counter / expiry can differ from visible ledger entries "
                "(common after migration). Includes ledger totals for that purchase + legacy SPOT context."
            ),
            input_schema=_simple_schema({"purchase_id": {"type": "integer"}}, required=["purchase_id"]),
            handler=explain_purchase_income_mismatch,
        ),
        ToolSpec(
            name="getPackageDetails",
            description="Get package details by id.",
            input_schema=_simple_schema({"package_id": {"type": "integer"}}, required=["package_id"]),
            handler=get_package_details,
        ),
        ToolSpec(
            name="getAllPackages",
            description="List all packages.",
            input_schema=_simple_schema({}),
            handler=get_all_packages,
        ),
        ToolSpec(
            name="getAllLevels",
            description="List all levels and requirements metadata.",
            input_schema=_simple_schema({}),
            handler=get_all_levels,
        ),
        ToolSpec(
            name="simulateCommission",
            description="Simulate commission distribution for a purchase (best-effort estimator).",
            input_schema=_simple_schema({"purchase_id": {"type": "integer"}}, required=["purchase_id"]),
            handler=simulate_commission,
        ),
        ToolSpec(
            name="getCommissionBreakdown",
            description="Get ledger entries credited for a purchase id.",
            input_schema=_simple_schema({"purchase_id": {"type": "integer"}}, required=["purchase_id"]),
            handler=get_commission_breakdown,
        ),
        ToolSpec(
            name="getPendingCommissions",
            description="Get pending commissions for the user.",
            input_schema=_simple_schema({}),
            handler=get_pending_commissions,
        ),
        ToolSpec(
            name="getScheduledCommissions",
            description="Get scheduled commissions (always empty; table removed).",
            input_schema=_simple_schema({}),
            handler=get_scheduled_commissions,
        ),
        ToolSpec(
            name="getWalletSummary",
            description="Get wallet balances for the user.",
            input_schema=_simple_schema({}),
            handler=get_wallet_summary,
        ),
        ToolSpec(
            name="validateTransaction",
            description="Validate if requested amount is available in a wallet bucket.",
            input_schema=_simple_schema(
                {
                    "amount": {"type": "number"},
                    "wallet": {"type": "string", "enum": ["balance", "spot_balance", "other_balance", "team_royalty_balance"]},
                },
                required=["amount"],
            ),
            handler=validate_transaction,
        ),
        ToolSpec(
            name="calculateWithdrawableAmount",
            description="Estimate withdrawable amount (final validation in MLM-API).",
            input_schema=_simple_schema({}),
            handler=calculate_withdrawable_amount,
        ),
        ToolSpec(
            name="explainSystemConcept",
            description="Return anchors for concept explanation grounded in Ai-plan.md.",
            input_schema=_simple_schema({"concept": {"type": "string"}}, required=["concept"]),
            handler=explain_system_concept,
        ),
        ToolSpec(
            name="getSystemStats",
            description="Get system-wide stats (counts and totals).",
            input_schema=_simple_schema({}),
            handler=get_system_stats,
        ),
        ToolSpec(
            name="getOverallInvestmentVolume",
            description=(
                "Admin-only: overall investment volume (new purchases + legacy activation). "
                "Use for questions like 'overall total business/volume kitna hai start se ab tak'."
            ),
            input_schema=_simple_schema({}),
            handler=get_overall_investment_volume,
        ),
        ToolSpec(
            name="getUserEligibility",
            description="Get eligibility JSON for the user.",
            input_schema=_simple_schema({}),
            handler=get_user_eligibility,
        ),
        ToolSpec(
            name="getLevelRequirements",
            description="Get requirements for a specific level.",
            input_schema=_simple_schema({"level": {"type": "integer"}}, required=["level"]),
            handler=get_level_requirements,
        ),
        ToolSpec(
            name="getUserLevelProgress",
            description=(
                "Current MLM level, next level, team business, qualifying legs, gap to next level. "
                "For 'direct/spot/commission nahi mila' complaints use `diagnoseMissingCommission` (not this tool alone)."
            ),
            input_schema=_simple_schema({}),
            handler=get_user_level_progress,
        ),
        ToolSpec(name="getUserLegs", description="List direct legs with subtree business totals.", input_schema=_simple_schema({}), handler=get_user_legs),
        ToolSpec(name="analyzeUserGrowth", description="Analyze legs and provide growth insights.", input_schema=_simple_schema({}), handler=analyze_user_growth),
        ToolSpec(name="auditUserWallet", description="Lightweight audit comparing wallet tx sum to balances.", input_schema=_simple_schema({}), handler=audit_user_wallet),

        # ---- New aggregate / date / projection tools (added 25-04-2026) ----
        ToolSpec(
            name="getIncomeSummary",
            description=(
                "Aggregate income from ledger_entries. Filter by package_id, days, "
                "from_date/to_date, and types (SELF, GLOBAL_HELPING, SPOT, MONTHLY, FEE_DEDUCTION, ADMIN_OPS). "
                "Returns total_amount + per-type breakdown. Admin can pass user_id or display_id; "
                "non-admin always gets self."
            ),
            input_schema=_simple_schema(
                {
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                    "package_id": {"type": "integer"},
                    "days": {"type": "integer", "minimum": 1, "maximum": 3650},
                    "from_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "to_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "types": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["SELF", "GLOBAL_HELPING", "SPOT", "MONTHLY", "FEE_DEDUCTION", "ADMIN_OPS"]},
                    },
                }
            ),
            handler=get_income_summary,
        ),
        ToolSpec(
            name="getWithdrawalCounts",
            description=(
                "Count withdrawal_requests grouped by status (and totalled). "
                "scope='user' (default) returns the caller's data; admin may use scope='global' or pass user_id/display_id. "
                "Use on_date='YYYY-MM-DD' to count a specific calendar day in IST."
            ),
            input_schema=_simple_schema(
                {
                    "scope": {"type": "string", "enum": ["user", "global"]},
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                    "days": {"type": "integer", "minimum": 1, "maximum": 3650},
                    "on_date": {"type": "string", "description": "YYYY-MM-DD (IST calendar day)"},
                }
            ),
            handler=get_withdrawal_counts,
        ),
        ToolSpec(
            name="getLatestWithdrawal",
            description=(
                "Get the most recent withdrawal request. "
                "Admin defaults to platform-wide (scope='global') unless a user is specified; "
                "admin can also target a specific user via display_id/user_id (scope='user')."
            ),
            input_schema=_simple_schema(
                {
                    "scope": {"type": "string", "enum": ["user", "global"]},
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                    "status": {"type": "string"},
                }
            ),
            handler=get_latest_withdrawal,
        ),
        ToolSpec(
            name="getKycCounts",
            description="Admin-only: counts of users grouped by kyc_status (pending / submitted / approved / rejected).",
            input_schema=_simple_schema({}),
            handler=get_kyc_counts,
        ),
        ToolSpec(
            name="adminListPendingKycs",
            description="Admin-only: list KYC submissions waiting for approval (kyc_status='submitted'), including display_id and basic profile details.",
            input_schema=_simple_schema({"limit": {"type": "integer", "minimum": 1, "maximum": 200}}),
            handler=admin_list_pending_kycs,
        ),
        ToolSpec(
            name="getDirectReferralCount",
            description="Count of direct referrals (users.referrer_user_id = uid). Admin can pass user_id/display_id.",
            input_schema=_simple_schema(
                {"user_id": {"type": "integer"}, "display_id": {"type": "string"}}
            ),
            handler=get_direct_referral_count,
        ),
        ToolSpec(
            name="getNetworkSize",
            description="Total downline size from user_tree_paths (excluding self) + per-depth breakdown + upline depth. Admin can target another user.",
            input_schema=_simple_schema(
                {"user_id": {"type": "integer"}, "display_id": {"type": "string"}}
            ),
            handler=get_network_size,
        ),
        ToolSpec(
            name="getTopReferrers",
            description="Admin-only: top N users by direct referral count.",
            input_schema=_simple_schema({"limit": {"type": "integer", "minimum": 1, "maximum": 100}}),
            handler=get_top_referrers,
        ),
        ToolSpec(
            name="getNextWithdrawalDate",
            description=(
                "Return the upcoming allowed withdrawal date in IST and the wallets opened on that day. "
                "Rule: SPOT only on 10th & 20th; on 30th (28th in February) all wallets (SPOT + Main/Other + Team Royalty)."
            ),
            input_schema=_simple_schema({}),
            handler=get_next_withdrawal_date,
        ),
        ToolSpec(
            name="getEligibleWithdrawalAmount",
            description=(
                "How much can the user withdraw on the upcoming allowed withdrawal date — "
                "computed from wallet balances, the wallets opened on that date, KYC status, "
                "and withdrawal_blocked flag. Admin can target another user."
            ),
            input_schema=_simple_schema(
                {"user_id": {"type": "integer"}, "display_id": {"type": "string"}}
            ),
            handler=get_eligible_withdrawal_amount,
        ),
        ToolSpec(
            name="getAdminProjectedWithdrawalDemand",
            description=(
                "Admin-only: upper-bound projected withdrawal demand on the next allowed withdrawal date "
                "(sum of eligible wallet balances of all KYC-approved, non-blocked, active users)."
            ),
            input_schema=_simple_schema({}),
            handler=get_admin_projected_withdrawal_demand,
        ),
        ToolSpec(
            name="lookupUserByDisplayId",
            description="Admin-only: lightweight lookup of core profile fields by SIA display id (e.g. SIA00299).",
            input_schema=_simple_schema({"display_id": {"type": "string"}}, required=["display_id"]),
            handler=lookup_user_by_display_id,
        ),
        ToolSpec(
            name="getMyPurchases",
            description=(
                "Full purchase history for the user — every package they've ever bought, with status "
                "(active / pending / expired_2x), price, amount, purchase_type and purchased_at. "
                "Admin can pass user_id or display_id."
            ),
            input_schema=_simple_schema(
                {"user_id": {"type": "integer"}, "display_id": {"type": "string"}}
            ),
            handler=get_my_purchases,
        ),
        ToolSpec(
            name="getPendingPurchaseRequests",
            description=(
                "Pending package purchase / activation requests. scope='user' (default) for the caller; "
                "admin may use scope='global' to see all pending across the platform."
            ),
            input_schema=_simple_schema(
                {
                    "scope": {"type": "string", "enum": ["user", "global"]},
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                }
            ),
            handler=get_pending_purchase_requests,
        ),
        ToolSpec(
            name="getWalletTransactionsSummary",
            description=(
                "Aggregate wallet_transactions for a user: row count, total credit, total debit, "
                "net total. Optional `days` window. Admin can pass user_id or display_id."
            ),
            input_schema=_simple_schema(
                {
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                    "days": {"type": "integer", "minimum": 1, "maximum": 3650},
                }
            ),
            handler=get_wallet_transactions_summary,
        ),
        ToolSpec(
            name="getAdminPlatformStats",
            description=(
                "Admin-only: high-volume table counts (users, purchases, ledger_entries, wallet_transactions, "
                "pending_commissions, fees, withdraw_requests). Use for global magnitude questions."
            ),
            input_schema=_simple_schema({}),
            handler=get_admin_platform_stats,
        ),
        ToolSpec(
            name="diagnoseMissingCommission",
            description=(
                "Explain why a user is not receiving a particular commission type. "
                "Returns blockers (KYC, status, disqualified, no active package), pending vs credited samples, "
                "ledger totals, and recent downline activations. commission_type: SELF | GLOBAL_HELPING | SPOT | MONTHLY."
            ),
            input_schema=_simple_schema(
                {
                    "commission_type": {
                        "type": "string",
                        "enum": ["SELF", "GLOBAL_HELPING", "SPOT", "MONTHLY"],
                    },
                    "level": {"type": "integer", "minimum": 1, "maximum": 9},
                    "user_id": {"type": "integer"},
                    "display_id": {"type": "string"},
                }
            ),
            handler=diagnose_missing_commission,
        ),
    ]

