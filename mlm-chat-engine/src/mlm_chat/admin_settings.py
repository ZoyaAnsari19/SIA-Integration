"""
Admin-controlled AI settings + per-day rate limit / read-write gating.

Stored in Redis so settings persist across chat-engine restarts.

Keys:
- chat:settings                          # hash: admin_daily_limit, user_daily_limit,
                                         #       admin_read, admin_write,
                                         #       user_read, user_write
- chat:usage:total:{YYYYMMDD}            # int (total questions asked that day)
- chat:usage:role:{role}:{YYYYMMDD}      # int (per-role count)
- chat:usage:user:{user_id}:{YYYYMMDD}   # int (per-user count)
- chat:usage:users:{YYYYMMDD}            # set of user_id's that asked that day
- chat:usage:latency                     # capped list (last 200 latencies in ms)
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from redis.asyncio import Redis


IST = timezone(timedelta(hours=5, minutes=30))


def _today_str(now: datetime | None = None) -> str:
    n = (now or datetime.now(IST)).astimezone(IST)
    return n.strftime("%Y%m%d")


def _last_n_days(n: int) -> list[str]:
    today = datetime.now(IST)
    return [(today - timedelta(days=i)).strftime("%Y%m%d") for i in range(n)]


@dataclass
class RoleSettings:
    daily_limit: int
    read: bool
    write: bool


@dataclass
class AiSettings:
    admin: RoleSettings
    user: RoleSettings


DEFAULTS = AiSettings(
    admin=RoleSettings(daily_limit=100, read=True, write=True),
    user=RoleSettings(daily_limit=25, read=True, write=True),
)


_DAY_TTL = 60 * 60 * 24 * 35  # ~5 weeks


def _to_int(v: Any, default: int) -> int:
    try:
        return int(v)
    except Exception:
        return default


def _to_bool(v: Any, default: bool) -> bool:
    if isinstance(v, bool):
        return v
    if v is None:
        return default
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off"):
        return False
    return default


class AiSettingsStore:
    """All admin settings + usage counters live here."""

    def __init__(self, redis: Redis):
        self._r = redis

    # ---------- settings ----------

    async def get(self) -> AiSettings:
        h = await self._r.hgetall("chat:settings")
        return AiSettings(
            admin=RoleSettings(
                daily_limit=_to_int(h.get("admin_daily_limit"), DEFAULTS.admin.daily_limit),
                read=_to_bool(h.get("admin_read"), DEFAULTS.admin.read),
                write=_to_bool(h.get("admin_write"), DEFAULTS.admin.write),
            ),
            user=RoleSettings(
                daily_limit=_to_int(h.get("user_daily_limit"), DEFAULTS.user.daily_limit),
                read=_to_bool(h.get("user_read"), DEFAULTS.user.read),
                write=_to_bool(h.get("user_write"), DEFAULTS.user.write),
            ),
        )

    async def update(self, *, role: str, patch: dict[str, Any]) -> AiSettings:
        """role in {'admin','user'}; patch may include daily_limit/read/write."""
        role = role.lower()
        if role not in ("admin", "user"):
            raise ValueError("invalid_role")

        mapping: dict[str, str] = {}
        if "daily_limit" in patch and patch["daily_limit"] is not None:
            limit = max(0, min(int(patch["daily_limit"]), 10_000))
            mapping[f"{role}_daily_limit"] = str(limit)
        if "read" in patch and patch["read"] is not None:
            mapping[f"{role}_read"] = "1" if bool(patch["read"]) else "0"
        if "write" in patch and patch["write"] is not None:
            mapping[f"{role}_write"] = "1" if bool(patch["write"]) else "0"

        if mapping:
            await self._r.hset("chat:settings", mapping=mapping)
        return await self.get()

    # ---------- usage / quota ----------

    async def quota_check(self, *, role: str, user_id: str) -> dict[str, Any]:
        s = await self.get()
        rs = s.admin if role == "admin" else s.user
        date = _today_str()
        used_role = _to_int(await self._r.get(f"chat:usage:role:{role}:{date}"), 0)
        used_user = _to_int(await self._r.get(f"chat:usage:user:{user_id}:{date}"), 0)
        # Per-user limit IS the role's daily_limit. Role-level counts are informational.
        allowed = used_user < rs.daily_limit if rs.daily_limit > 0 else True
        return {
            "allowed": allowed,
            "limit": rs.daily_limit,
            "used_today": used_user,
            "used_role_today": used_role,
            "read_enabled": rs.read,
            "write_enabled": rs.write,
        }

    async def record_question(self, *, role: str, user_id: str) -> None:
        date = _today_str()
        pipe = self._r.pipeline()
        pipe.incr(f"chat:usage:total:{date}")
        pipe.expire(f"chat:usage:total:{date}", _DAY_TTL)
        pipe.incr(f"chat:usage:role:{role}:{date}")
        pipe.expire(f"chat:usage:role:{role}:{date}", _DAY_TTL)
        pipe.incr(f"chat:usage:user:{user_id}:{date}")
        pipe.expire(f"chat:usage:user:{user_id}:{date}", _DAY_TTL)
        pipe.sadd(f"chat:usage:users:{date}", user_id)
        pipe.expire(f"chat:usage:users:{date}", _DAY_TTL)
        await pipe.execute()

    async def record_latency(self, ms: int) -> None:
        if ms <= 0:
            return
        pipe = self._r.pipeline()
        pipe.lpush("chat:usage:latency", int(ms))
        pipe.ltrim("chat:usage:latency", 0, 199)
        await pipe.execute()

    # ---------- stats (for admin dashboard) ----------

    async def stats(self, *, enabled_tools_count: int = 0) -> dict[str, Any]:
        date = _today_str()
        days30 = _last_n_days(30)

        # Total questions in last 30 days (sum of daily totals).
        keys_total = [f"chat:usage:total:{d}" for d in days30]
        vals_total = await self._r.mget(*keys_total) if keys_total else []
        total_30d = sum(_to_int(v, 0) for v in vals_total)
        total_today = _to_int(await self._r.get(f"chat:usage:total:{date}"), 0)

        # Active users in last 30 days (union of daily user sets).
        active_users_30d = 0
        if days30:
            try:
                active_users_30d = await self._r.sunionstore("chat:usage:active:_tmp", *(f"chat:usage:users:{d}" for d in days30))
                # Throw away the temp key after computing size.
                await self._r.delete("chat:usage:active:_tmp")
            except Exception:
                active_users_30d = 0

        active_users_today = await self._r.scard(f"chat:usage:users:{date}")

        # Avg response time.
        latencies_raw = await self._r.lrange("chat:usage:latency", 0, -1)
        latencies = [_to_int(x, 0) for x in latencies_raw if _to_int(x, 0) > 0]
        avg_ms = int(sum(latencies) / len(latencies)) if latencies else 0

        return {
            "total_questions_30d": total_30d,
            "total_questions_today": total_today,
            "active_users_30d": int(active_users_30d or 0),
            "active_users_today": int(active_users_today or 0),
            "avg_response_ms": avg_ms,
            "enabled_tools_count": int(enabled_tools_count),
        }
