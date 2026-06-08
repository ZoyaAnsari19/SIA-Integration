from __future__ import annotations

import logging
import time
import base64
from google import genai


logger = logging.getLogger(__name__)


class GeminiClient:
    def __init__(self, api_key: str, model: str):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate(self, *, system: str, user: str, image: tuple[bytes, str] | None = None) -> str:
        started = time.perf_counter()
        prompt = f"{system}\n\n{user}"
        logger.info(
            "llm_request",
            extra={
                "provider": "gemini",
                "model": self._model,
                "prompt_chars": len(prompt),
                "system_chars": len(system),
                "user_chars": len(user),
                "has_image": bool(image),
            },
        )

        parts: list[dict] = [{"text": prompt}]
        if image:
            data, mime = image
            parts.append(
                {
                    "inline_data": {
                        "mime_type": mime,
                        "data": base64.b64encode(data).decode("ascii"),
                    }
                }
            )
        resp = self._client.models.generate_content(model=self._model, contents=[{"role": "user", "parts": parts}])
        try:
            out = resp.text or ""
            usage = getattr(resp, "usage_metadata", None)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            logger.info(
                "llm_response",
                extra={
                    "provider": "gemini",
                    "model": self._model,
                    "elapsed_ms": elapsed_ms,
                    "output_chars": len(out),
                    "usage": usage.model_dump() if hasattr(usage, "model_dump") else None,
                },
            )
            return out
        except Exception:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            logger.exception(
                "llm_failed",
                extra={"provider": "gemini", "model": self._model, "elapsed_ms": elapsed_ms},
            )
            return ""

    async def generate_text(self, *, system: str, user: str) -> str:
        return await self.generate(system=system, user=user, image=None)

