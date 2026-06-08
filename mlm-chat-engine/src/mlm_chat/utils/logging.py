from __future__ import annotations

import json
import logging
from datetime import datetime, timezone


_SKIP_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__)

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Forward any extra={} fields the caller passed in.
        for key, val in record.__dict__.items():
            if key not in _SKIP_ATTRS and not key.startswith("_"):
                try:
                    json.dumps(val)  # skip non-serializable values
                    payload[key] = val
                except (TypeError, ValueError):
                    payload[key] = str(val)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)

