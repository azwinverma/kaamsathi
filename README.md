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
