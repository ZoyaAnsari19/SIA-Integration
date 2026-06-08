from __future__ import annotations

from typing import TypedDict, Any, NotRequired


class GraphState(TypedDict):
    user_id: str
    role: NotRequired[str]
    messages: list[dict[str, Any]]  # [{role, content}]
    tool_results: NotRequired[list[dict[str, Any]]]
    pending_confirmation: NotRequired[dict[str, Any]]

