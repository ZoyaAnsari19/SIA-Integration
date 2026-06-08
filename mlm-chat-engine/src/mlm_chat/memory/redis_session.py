from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
import time

from redis.asyncio import Redis


@dataclass(frozen=True)
class SessionConfig:
    max_turns: int = 20
    ttl_seconds: int = 60 * 60 * 24  # 24h
    max_conversations: int = 25


class RedisSessionStore:
    def __init__(self, redis: Redis, cfg: SessionConfig | None = None):
        self._r = redis
        self._cfg = cfg or SessionConfig()

    def _key(self, user_id: str) -> str:
        # Back-compat: legacy single-thread history (still written for now).
        return f"chat:session:{user_id}"

    def _conv_key(self, user_id: str, conversation_id: str) -> str:
        return f"chat:conv:{user_id}:{conversation_id}"

    def _conv_meta_key(self, user_id: str, conversation_id: str) -> str:
        return f"chat:convmeta:{user_id}:{conversation_id}"

    def _conv_index_key(self, user_id: str) -> str:
        return f"chat:convindex:{user_id}"

    def _pending_key(self, conversation_id: str, confirmation_token: str) -> str:
        return f"chat:pending:{conversation_id}:{confirmation_token}"

    async def append_turn(self, user_id: str, turn: dict[str, Any], *, conversation_id: str | None = None) -> None:
        now = int(time.time())
        turn = dict(turn)
        turn.setdefault("ts", now)

        # Back-compat: keep writing legacy key (single-thread).
        key = self._key(user_id)
        await self._r.rpush(key, json.dumps(turn, ensure_ascii=False))
        await self._r.ltrim(key, -self._cfg.max_turns, -1)
        await self._r.expire(key, self._cfg.ttl_seconds)

        if not conversation_id:
            return

        ckey = self._conv_key(user_id, conversation_id)
        await self._r.rpush(ckey, json.dumps(turn, ensure_ascii=False))
        await self._r.ltrim(ckey, -self._cfg.max_turns, -1)
        await self._r.expire(ckey, self._cfg.ttl_seconds)

        # Update metadata + index (sorted by updated_at).
        mkey = self._conv_meta_key(user_id, conversation_id)
        title = (turn.get("user") or "").strip()
        if title:
            title = title.replace("\n", " ").strip()
            if len(title) > 60:
                title = title[:57] + "…"

        pipe = self._r.pipeline()
        pipe.hsetnx(mkey, "created_at", now)
        pipe.hset(mkey, mapping={"updated_at": now})
        pipe.hincrby(mkey, "message_count", 1)
        if title:
            pipe.hsetnx(mkey, "title", title)
        pipe.expire(mkey, self._cfg.ttl_seconds)
        pipe.zadd(self._conv_index_key(user_id), {conversation_id: float(now)})
        pipe.expire(self._conv_index_key(user_id), self._cfg.ttl_seconds)
        pipe.zremrangebyrank(self._conv_index_key(user_id), 0, -(self._cfg.max_conversations + 1))
        await pipe.execute()

    async def get_turns(self, user_id: str) -> list[dict[str, Any]]:
        key = self._key(user_id)
        raw = await self._r.lrange(key, 0, -1)
        out: list[dict[str, Any]] = []
        for item in raw:
            try:
                out.append(json.loads(item))
            except Exception:
                continue
        return out

    async def get_conversation_turns(self, user_id: str, conversation_id: str) -> list[dict[str, Any]]:
        key = self._conv_key(user_id, conversation_id)
        raw = await self._r.lrange(key, 0, -1)
        out: list[dict[str, Any]] = []
        for item in raw:
            try:
                out.append(json.loads(item))
            except Exception:
                continue
        return out

    async def list_conversations(self, user_id: str, *, limit: int = 20) -> list[dict[str, Any]]:
        idx = self._conv_index_key(user_id)
        conv_ids = await self._r.zrevrange(idx, 0, max(0, limit - 1))
        out: list[dict[str, Any]] = []
        for cid in conv_ids:
            mkey = self._conv_meta_key(user_id, cid)
            meta = await self._r.hgetall(mkey)
            # redis-py returns str keys/values in asyncio client by default (decode_responses default False).
            # Be defensive.
            def _s(x: Any) -> str:
                if x is None:
                    return ""
                if isinstance(x, (bytes, bytearray)):
                    try:
                        return x.decode("utf-8")
                    except Exception:
                        return ""
                return str(x)

            out.append(
                {
                    "conversation_id": _s(cid),
                    "title": _s(meta.get("title")) or "Chat",
                    "updated_at": int(_s(meta.get("updated_at")) or "0"),
                    "created_at": int(_s(meta.get("created_at")) or "0"),
                    "message_count": int(_s(meta.get("message_count")) or "0"),
                }
            )
        return out

    async def rename_conversation(self, user_id: str, conversation_id: str, *, title: str) -> None:
        now = int(time.time())
        title = (title or "").strip().replace("\n", " ")
        if not title:
            raise ValueError("title_required")
        if len(title) > 60:
            title = title[:57] + "…"
        mkey = self._conv_meta_key(user_id, conversation_id)
        pipe = self._r.pipeline()
        pipe.hset(mkey, mapping={"title": title, "updated_at": now})
        pipe.hsetnx(mkey, "created_at", now)
        pipe.expire(mkey, self._cfg.ttl_seconds)
        pipe.zadd(self._conv_index_key(user_id), {conversation_id: float(now)})
        pipe.expire(self._conv_index_key(user_id), self._cfg.ttl_seconds)
        await pipe.execute()

    async def set_pending_action(self, *, conversation_id: str, confirmation_token: str, action: dict[str, Any]) -> None:
        key = self._pending_key(conversation_id, confirmation_token)
        await self._r.set(key, json.dumps(action, ensure_ascii=False), ex=15 * 60)  # 15 min

    async def get_pending_action(self, *, conversation_id: str, confirmation_token: str) -> dict[str, Any] | None:
        key = self._pending_key(conversation_id, confirmation_token)
        raw = await self._r.get(key)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def clear_pending_action(self, *, conversation_id: str, confirmation_token: str) -> None:
        key = self._pending_key(conversation_id, confirmation_token)
        await self._r.delete(key)

