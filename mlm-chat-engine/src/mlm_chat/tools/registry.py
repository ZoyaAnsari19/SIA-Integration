from __future__ import annotations

from typing import Any

from .read_tools import build_read_tool_specs
from .write_tools import build_write_tool_specs
from .types import ToolSpec


def build_tool_registry() -> dict[str, ToolSpec]:
    specs = build_read_tool_specs() + build_write_tool_specs()
    return {s.name: s for s in specs}


def list_tool_schemas() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in build_read_tool_specs() + build_write_tool_specs():
        out.append(
            {
                "name": s.name,
                "description": s.description,
                "parameters": s.input_schema,
            }
        )
    return out

