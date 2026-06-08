from __future__ import annotations

from dataclasses import dataclass
import jwt


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    role: str | None = None
    is_admin: bool = False


def parse_bearer_token(auth_header: str | None) -> str | None:
    if not auth_header:
        return None
    parts = auth_header.split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


def verify_jwt(token: str, jwt_secret: str) -> dict:
    # MLM-API uses jsonwebtoken (HS256 by default). We mirror that here.
    return jwt.decode(token, jwt_secret, algorithms=["HS256"])


def auth_context_from_jwt_payload(payload: dict) -> AuthContext:
    # MLM-API puts user id at `user_id` in req.user payload.
    # We keep this intentionally minimal for the scaffold.
    user_id = str(payload.get("user_id") or payload.get("id") or "")
    role = payload.get("role")
    is_admin = bool(
        role in ("SUPER_ADMIN", "SUB_ADMIN", "admin")
        or payload.get("admin") is True
        or payload.get("authenticated") is True
    )
    return AuthContext(user_id=user_id, role=role, is_admin=is_admin)

