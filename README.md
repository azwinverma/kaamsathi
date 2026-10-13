# KaamSathi (कामसाथी)

Verified workers. On-time pay. — Nepal's hiring and workforce platform for skilled
and blue-collar workers.

Phase 1 covers:

- **Hire** — job openings (रिक्त पद) with minimum-wage checks, ops-curated shortlists,
  candidate pipeline, 30-day replacement window.
- **Manage** — worker records (कामदार), hajiri (हाजिरी) by supervisor or site-QR self
  check-in with geofence, बिदा (leave), पेस्की (advances).
- **Payroll** — BS-month wage sheet (तलब पाना) with basic/DA split, OT at 1.5×,
  Dashain allowance, SSF 11% + 20%, TDS, advance recovery, payslips, bank/SSF exports.
- **Worker app** — own hajiri, payslips, verified work history, consent controls.
- **Ops console** — worker verification, ranked matching, shortlisting.

## Repository

| Path | What |
| --- | --- |
| [backend/](backend/) | Django 5 + DRF API, PostgreSQL, Redis, Celery |
| [web/](web/) | Next.js 15 employer portal, ops console, marketing site |
| [mobile/](mobile/) | Flutter supervisor + worker app |
| [docs/CONTRACT.md](docs/CONTRACT.md) | API and data model — source of truth |
| [docs/DESIGN.md](docs/DESIGN.md) | Design tokens, typography, formatting rules |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | English / नेपाली UI terms |

## Quick start (local)

```bash
cp .env.example .env
make up            # postgres (5433), redis (6380), backend (8000), workers, web (3000)
make seed          # reference data + demo data
```

Demo logins (OTP `123456`, dev only):

> Port 8000 already taken by another project? Run `make dev-backend API_PORT=8001` and put
> `API_BASE_URL=http://localhost:8001/api/v1` in `web/.env.local` (restart `pnpm dev`). For the
> Flutter app pass `--dart-define=API_BASE_URL=http://10.0.2.2:8001/api/v1` (Android emulator).

| Phone | Role |
| --- | --- |
| 9800000001 | Owner — Hotel Annapurna View, Shivam Builders |
| 9800000002 | Supervisor — Thamel Main Building |
| 9800000003 | Ops staff |
| 9800000010 | Worker — Ram Bahadur Thapa |

See each app's README for development without Docker.

## Rules baked in (verify yearly)

- Minimum wage from 17 July 2025: Rs. 19,550/month (basic 12,170 + DA 7,380), Rs. 754/day.
- SSF: 11% employee + 20% employer on basic salary.
- Income-tax slabs FY 2083/84 are seeded as editable data — confirm with a tax adviser each fiscal year.
- National holiday dates for 2083 are approximate and editable.

## Production

Production runs as one Docker Compose stack behind Caddy (automatic HTTPS):
`<domain>` → Next.js web, `api.<domain>` → Django API, plus Celery worker/beat, PostgreSQL 16,
Redis (password) and a nightly encrypted backup job.

```bash
cp deploy/.env.prod.example deploy/.env.prod   # fill every value; chmod 600
make deploy-up                                 # build, migrate, start, obtain certificates
make deploy-ps / deploy-logs / backup-now / restore FILE=...
```

| Doc | What |
| --- | --- |
| [deploy/](deploy/) | `docker-compose.prod.yml`, `Caddyfile`, `.env.prod.example`, backup image |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Deploy, rollback, migrations, backups + restore drill, secret rotation, SMS failover, incidents, yearly reference-data checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Data classification, ID-document access, consent, retention, breach response |
| [mobile/README.md](mobile/README.md) | Release signing, `API_BASE_URL`, store builds |

Personal data is handled under the Individual Privacy Act 2075: uploaded documents are served
only through short-lived signed links, workers can export or delete their data
(`/me/privacy-requests`, ops queue at `/ops/privacy`), and `seed_demo` refuses to run when
`DEBUG` is off.

## Documentation

| Doc | For | What |
| --- | --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | engineers | Surfaces, Django apps per bounded context, auth schemes, data flows, Celery beat, storage, deployment diagram, where encryption/audit/consent live |
| [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md) | engineers, partners | Base URL, auth (JWT, `X-Org-Id`, partner/org keys, signed files), errors + `request_id`, idempotency, pagination, BS dates, money, versioning, webhook signature verification (Python/Node) |
| [docs/CONTRACT.md](docs/CONTRACT.md) · [CONTRACT-ECOSYSTEM.md](docs/CONTRACT-ECOSYSTEM.md) · [CONTRACT-EXTENSIONS.md](docs/CONTRACT-EXTENSIONS.md) | engineers | API and data model: the source of truth |
| [docs/DESIGN.md](docs/DESIGN.md) · [docs/GLOSSARY.md](docs/GLOSSARY.md) | design, engineers | Design tokens and formatting; English/नेपाली UI terms |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) · [docs/SECURITY.md](docs/SECURITY.md) | engineers, ops | Deploy, rollback, backups, secret rotation, SMS failover, incidents; data handling, consent, retention, breach |
| [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | founders, engineers | Launch readiness, item by item (✅ / 🟡 / 🔴), including launch blockers and known gaps |
| [docs/ROADMAP.md](docs/ROADMAP.md) | founders | Phases 0–6: what's built, the gate to switch each on, what remains; 90-day pilot plan and exit criteria |
| [docs/GO_TO_MARKET.md](docs/GO_TO_MARKET.md) | founders, sales | Segments, trades, geography sequence, employer and worker acquisition, pricing hypotheses, pilot design, launch KPIs |

**Ops SOPs** ([docs/ops/](docs/ops/)), with bilingual scripts where staff talk to workers:

- Verification:
  - [KYC / identity](docs/ops/kyc-identity-verification.md)
  - [credentials](docs/ops/credential-verification.md)
  - [employer KYB](docs/ops/employer-verification-kyb.md)
  - [work-history reference checks](docs/ops/work-history-reference-checks.md)
- Trust:
  - [fraud escalation](docs/ops/fraud-escalation.md)
  - [dispute handling SLA](docs/ops/dispute-handling-sla.md)
  - [data-protection requests](docs/ops/data-protection-requests.md)
  - [foreign-employment documents](docs/ops/foreign-employment-documents.md)
  - [Bolau home-visit safety](docs/ops/bolau-home-visit-safety.md): verifying Sipalu before Bolau goes on, safety reports and emergencies (100), no-shows, off-platform payment, suspensions
- Field and customers:
  - [support scripts](docs/ops/support-scripts.md)
  - [employer onboarding playbook](docs/ops/employer-onboarding-playbook.md)
  - [worker registration camps](docs/ops/worker-registration-camps.md)
- Incidents: [incident communications](docs/ops/incident-communications.md)
