from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    port: int
    database_url: str
    jwt_secret: str
    admin_jwt_secret: str
    redis_url: str
    gemini_api_key: str
    gemini_model: str
    mlm_api_base_url: str


def load_settings() -> Settings:
    return Settings(
        port=int(os.getenv("PORT", "8088")),
        database_url=os.environ["DATABASE_URL"],
        jwt_secret=os.environ["JWT_SECRET"],
        admin_jwt_secret=os.getenv("ADMIN_JWT_SECRET", os.environ["JWT_SECRET"]),
        redis_url=os.environ["REDIS_URL"],
        gemini_api_key=os.environ["GEMINI_API_KEY"],
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-pro"),
        mlm_api_base_url=os.getenv("MLM_API_BASE_URL", "http://localhost:3000"),
    )

