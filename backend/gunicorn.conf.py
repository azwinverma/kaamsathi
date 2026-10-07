"""Gunicorn settings (read automatically from the working directory; all tunable by env).

GUNICORN_WORKERS   default 2 × CPU + 1, capped at 9 (each worker ≈ 120–180 MB RSS)
GUNICORN_THREADS   default 2 (gthread: I/O-bound API, PDF/XLSX exports)
GUNICORN_TIMEOUT   default 60 s (wage-sheet/export generation can take a while)
LOG_JSON           true → access/error logs as JSON lines (same shape as Django's)
"""

import multiprocessing
import os


def _int(name, default):
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
workers = _int("GUNICORN_WORKERS", min(multiprocessing.cpu_count() * 2 + 1, 9))
worker_class = "gthread"
threads = _int("GUNICORN_THREADS", 2)
timeout = _int("GUNICORN_TIMEOUT", 60)
graceful_timeout = _int("GUNICORN_GRACEFUL_TIMEOUT", 30)
keepalive = 5
# Recycle workers periodically to contain slow memory growth (reportlab/openpyxl).
max_requests = _int("GUNICORN_MAX_REQUESTS", 1000)
max_requests_jitter = 100
worker_tmp_dir = "/dev/shm" if os.path.isdir("/dev/shm") else None
# Only the reverse proxy (Caddy, private Docker network) talks to gunicorn.
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "*")
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info").lower()
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(M)sms "%(a)s"'

if os.environ.get("LOG_JSON", "").lower() in ("1", "true", "yes"):
    logconfig_dict = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"json": {"()": "apps.core.logging.JsonFormatter"}},
        "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
        "loggers": {
            "gunicorn.error": {"handlers": ["console"], "level": loglevel.upper(), "propagate": False},
            "gunicorn.access": {"handlers": ["console"], "level": "INFO", "propagate": False},
        },
    }
