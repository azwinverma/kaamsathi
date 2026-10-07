# KaamSathi backend

Django 5 + DRF API (`/api/v1`), PostgreSQL 16, Redis, Celery. The API contract is
[`../docs/CONTRACT.md`](../docs/CONTRACT.md); OpenAPI schema via drf-spectacular.

## Local development

```bash
make db                      # from repo root: Postgres :5433 + Redis :6380 in Docker
make backend-setup           # .venv + requirements-dev.txt
make dev-backend             # migrate + runserver :8000
make seed                    # reference data + demo orgs/workers (see root README for logins)
```

Celery tasks run inline in dev (`CELERY_TASK_ALWAYS_EAGER=true`). Set it to `false` and run
`make dev-worker` to exercise the worker and beat (monthly subscription charges on BS day 1).

## Layout

| App | Owns |
| --- | --- |
| `core` | BS calendar (`bs.py`), money rounding, error envelope, permissions, seed commands |
| `accounts` | phone-OTP login, JWT |
| `geo` | provinces, districts, reference endpoints |
| `orgs` | organizations, memberships/roles, sites (QR + geofence), shifts, dashboard |
| `workers` | worker profiles, skills/NSTB, verification, consent, ratings, `/me/*`, `/ops/*` |
| `hiring` | minimum wage, job openings, application pipeline |
| `workforce` | employments, hajiri, leave, peski, holidays, CSV/XLSX import |
| `payroll` | BS-month runs, payslip engine, wage sheet / bank / SSF exports, PDFs |
| `billing` | placement and subscription charges |
| `audit`, `notifications` | audit log; SMS (console / Sparrow / Aakash) |

## Checks

```bash
.venv/bin/pytest -q          # uses config.settings.test against the Docker Postgres
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```

Server messages and `*_label` fields follow `Accept-Language` (en/ne). After adding a
`gettext` string, run `make translations`, fill in the Nepali in `locale/ne/LC_MESSAGES/django.po`
(use `../docs/GLOSSARY.md` terms) and commit both the `.po` and the compiled `.mo`.

Yearly: confirm minimum wage, tax slabs and national holiday dates in `apps/core/reference_data.py`
(also editable in Django admin).
