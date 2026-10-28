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


def main() -> None:
    target = os.environ.get("VERCEL_ENV", "")
    if target != "production":
        print(f"VERCEL_ENV={target or 'unset'}: skipping migrations (production only).")
        return
    manage("check", "--deploy", "--fail-level", "ERROR")
    manage("migrate", "--noinput")
    manage("seed_reference")


if __name__ == "__main__":
    main()
