from __future__ import annotations

from mlm_chat.auth import parse_bearer_token
from mlm_chat.tools.registry import build_tool_registry


def test_parse_bearer_token():
    assert parse_bearer_token(None) is None
    assert parse_bearer_token("") is None
    assert parse_bearer_token("Bearer ") is None
    assert parse_bearer_token("Bearer abc") == "abc"
    assert parse_bearer_token("bearer abc") == "abc"
    assert parse_bearer_token("Token abc") is None


def test_tool_registry_has_27_tools():
    reg = build_tool_registry()
    assert len(reg) == 27
    assert "getUserProfile" in reg
    assert "createWithdrawalRequest" in reg

