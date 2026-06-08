from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable


ToolHandler = Callable[[dict[str, Any], "ToolContext"], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolHandler


@dataclass(frozen=True)
class ToolContext:
    user_id: str
    role: str | None
    is_admin: bool
    token: str
    db: Any

