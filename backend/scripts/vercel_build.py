"""Vercel build step for the API (backend/vercel.json → buildCommand).

Runs after dependencies are installed, before Vercel's own collectstatic. Production deploys
apply migrations and reference data here, so a failing migration fails the build and the
previous deployment keeps serving. Preview deploys never touch the database.
"""

import os
import subprocess
import sys


def manage(*args: str) -> None:
    print("+ manage.py", *args, flush=True)
    subprocess.run([sys.executable, "manage.py", *args], check=True)


# Names only (never values) of settings without which a production deploy cannot work.
REQUIRED = [
    "DJANGO_SETTINGS_MODULE",
    "DJANGO_SECRET_KEY",
    "JWT_SIGNING_KEY",
    "FIELD_ENCRYPTION_KEYS",
    "FIELD_HASH_KEY",
    "DJANGO_ALLOWED_HOSTS",
    "DATABASE_URL",
    "REDIS_URL",
]


def check_env() -> None:
    missing = [name for name in REQUIRED if not os.environ.get(name, "").strip()]
    if missing:
        sys.exit(
            "Missing environment variables (Vercel → Settings → Environment Variables, Production): "
            + ", ".join(missing)
        )
    db = os.environ["DATABASE_URL"]
    # Common copy/paste slips from Neon's Connect dialog (reported by shape, never by value).
    hints = [
        (db != db.strip(), "it has spaces or line breaks around it"),
        (db.lstrip().startswith("psql"), "it starts with `psql` (copy only the postgresql://… part)"),
        (db.lstrip()[:1] in "'\"", "it is wrapped in quotes"),
        (db.lstrip().upper().startswith("DATABASE_URL="), "it repeats `DATABASE_URL=` (value only)"),
        (db.lstrip().upper().startswith("PG"), "it is PGHOST/PGUSER lines (choose 'Connection string')"),
    ]
    found = [msg for bad, msg in hints if bad]
    if found:
        sys.exit("DATABASE_URL looks wrong: " + "; ".join(found) + ".")
    if "localhost" in db or "127.0.0.1" in db:
        sys.exit("DATABASE_URL points at localhost; paste the Neon pooled connection string instead.")
    if not db.startswith(("postgres://", "postgresql://")):
        sys.exit("DATABASE_URL must start with postgresql:// (copy it from Neon → Connect).")
    if not os.environ["REDIS_URL"].startswith(("redis://", "rediss://")):
        sys.exit("REDIS_URL must start with rediss:// (copy it from Upstash).")


def main() -> None:
    target = os.environ.get("VERCEL_ENV", "")
    if target != "production":
        print(f"VERCEL_ENV={target or 'unset'}: skipping migrations (production only).")
        return
    check_env()
    manage("check", "--deploy", "--fail-level", "ERROR")
    manage("migrate", "--noinput")
    manage("seed_reference")


if __name__ == "__main__":
    main()
