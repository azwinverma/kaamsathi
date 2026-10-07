import json
import logging
from datetime import UTC, datetime


class JsonFormatter(logging.Formatter):
    """Minimal structured (JSON lines) log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("status_code", "request", "path", "method", "user_id", "org_id"):
            value = getattr(record, key, None)
            if value is not None and key != "request":
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)
