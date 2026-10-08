# KaamSathi — Production readiness checklist

This checklist covers every item in the reference checklist (`nepal-workforce-os/docs/PRODUCTION_CHECKLIST.md`),
plus KaamSathi's own launch items. Status is stated honestly:

- ✅ **done**: in the repo and covered by tests or CI
- 🟡 **partial / in progress**: partly built, or being built now by a CONTRACT-EXTENSIONS workstream
  (marked "in progress"; update after integration)
- 🔴 **needs you**: a decision, account, agreement, secret or review that code can't provide

Last reviewed: 2026-10-07 (Ashwin 2083).

## Launch blockers (do these first)

1. 🔴 **Fix: production compose doesn't pass the field-encryption keys.**
   `deploy/.env.prod.example` defines `FIELD_ENCRYPTION_KEYS` and `FIELD_HASH_KEY`, and
   `config/settings/prod.py` requires them (`FIELD_KEYS_REQUIRED = True`). But the `x-backend-env`
   block in [deploy/docker-compose.prod.yml](../deploy/docker-compose.prod.yml) doesn't forward
   them. As things stand, the first read or write of an encrypted field in production raises
   `ImproperlyConfigured`. Add both, required, to `x-backend-env`
   (`FIELD_ENCRYPTION_KEYS: ${FIELD_ENCRYPTION_KEYS:?…}` and the same for `FIELD_HASH_KEY`), and to
   the CI compose-validation `sed` step.
2. 🔴 Generate and store all secrets (see Secrets below). Keep them in the password manager,
   **outside** the server.
3. 🔴 SMS: approve the sender ID and fund both gateways.
4. 🔴 Lawyer review: `/privacy`, `/terms`, consent text, contract template, intermediary model.
5. 🟡 Staff MFA and roles enforced (in progress).
6. 🔴 Run one restore drill and record it.

---

## Product

| Item | Status | Evidence / next step |
| --- | --- | --- |
| Core user journeys acceptance-tested | 🟡 | API journeys have pytest coverage in [backend/tests/](../backend/tests): hiring, attendance, payroll engine and API, payouts, privacy, partners, passport and more. There is **no end-to-end UI test**. Next: a scripted manual acceptance pass on staging for: OTP login → onboarding → import staff → hajiri (web + app offline) → payroll run → payslip PDF → bank file → SSF file; job → shortlist → joined → placement charge. Record the results. |
| Nepali/English localisation reviewed | 🟡 | Catalogues are complete and CI-checked (`pnpm messages:check`, `compilemessages -l ne`, mobile `app_ne.arb`). 🔴 A native speaker who works with supervisors and workers needs to review the wording on all three surfaces, using [GLOSSARY.md](GLOSSARY.md). |
| Accessibility review | 🔴 | Not done. Do a WCAG 2.1 AA pass on the web (contrast, keyboard, labels) and large-tap and screen-reader checks on Flutter. Many workers have low literacy, so test with real workers too. |
| Error / empty / loading states | 🟡 | Shared components exist in the web and the app. Pages added in the current workstreams still need a pass. |
| Support and dispute flows | 🟡 | Disputes ✅ (`apps/trust`, `/app/disputes`, `/ops/disputes`, SOP [dispute-handling-sla.md](ops/dispute-handling-sla.md)). Support cases and SLA escalation are in progress (`apps/support`). Scripts: [support-scripts.md](ops/support-scripts.md). |

## Backend

| Item | Status | Evidence / next step |
| --- | --- | --- |
| Automated migrations | ✅ | Backend container runs them on start (`RUN_MIGRATIONS=true`). CI runs `makemigrations --check`. Process: [RUNBOOK §4](RUNBOOK.md#4-migrations). |
| API schema published | 🟡 | `/api/schema/`, `/api/docs/` (staff-only in prod). Partner docs at `/partners/docs` ✅. Enterprise `/developers` page in progress. Conventions: [API_CONVENTIONS.md](API_CONVENTIONS.md). |
| Rate limits configured | ✅ | DRF throttles: anon, user, otp, public, files, privacy ([settings/base.py](../backend/config/settings/base.py)). OTP limited to 5/phone/hour. `NUM_PROXIES=1` so throttles key on the real client IP. |
| Idempotency on critical endpoints | 🟡 | Attendance `client_uuid` upsert ✅; payroll-run `duplicate` ✅. `Idempotency-Key` middleware in progress (`apps/core/idempotency.py`). |
| Background task retry / dead-letter | 🟡 | Some tasks retry (SMS, partner webhooks). `ReliableTask` base, `FailedTask` table and `/ops/system` in progress. ⚠ Four beat entries (`risk.scan`, `support.escalate_overdue`, `mobility.expiry_reminders`, `integrations.retry_deliveries`) were registered before their tasks existed. Confirm all four are implemented after integration. |
| Audit events verified | 🟡 | `AuditLog` is written for org CRUD and ops actions ✅ (`apps/audit`, `tests/test_audit_ip.py`). Append-only trigger, hash chain, `/ops/audit` and full sensitive-export coverage are in progress. |
| Sensitive fields encrypted/hashed | 🟡 | Code ✅: [apps/core/crypto.py](../backend/apps/core/crypto.py), `tests/test_crypto.py`, `rotate_field_keys`. Deploy wiring 🔴: see launch blocker 1. |
| Request IDs / correlation | 🟡 | In progress (`X-Request-ID` middleware, `error.request_id`). |
| Upload validation + malware scan | 🟡 | Django caps size at 10 MB, Caddy at 12 MB. `validate_upload` (magic bytes, EXIF strip, PDF active content) and optional ClamAV service are in progress. |

## Security

| Item | Status | Evidence / next step |
| --- | --- | --- |
| External penetration test | 🔴 | Not done. Scope: OTP and auth, `X-Org-Id` tenant isolation, signed file URLs, partner and org key auth, BFF proxy. Listed in [SECURITY.md §8](SECURITY.md#8-open-items-before-go-live). |
| Dependency / container scan clean | 🟡 | `pip-audit` and `pnpm audit --prod` run in CI but are informational only (they don't fail the build). No container image scan, SAST or secret scan yet. Next: add Trivy (images), gitleaks (secrets) and CodeQL or semgrep, and make high-severity findings blocking. |
| Secrets rotated / generated for prod | 🔴 | Procedure: [RUNBOOK §6](RUNBOOK.md#6-rotating-secrets). That table doesn't yet cover `FIELD_ENCRYPTION_KEYS` (add a new key first in the list → deploy → `manage.py rotate_field_keys` → remove the old key) or `FIELD_HASH_KEY` (don't rotate without a re-index plan). |
| MFA enforced for admin/staff | 🟡 | In progress: TOTP, `STAFF_MFA_REQUIRED`, recovery codes (`apps/accounts`). Django admin is password-only today, so keep superusers to 2 named people. |
| Staff roles / least privilege | 🟡 | In progress (`StaffProfile.roles`, `ROUTE_ROLES`). Today any `is_staff` user can open every `/ops/*` route. |
| Session / device inventory, remote revoke | 🟡 | Refresh blacklist on logout ✅. `SessionDevice` and `/auth/sessions` in progress. |
| Backup restore tested | 🔴 | Tooling ✅ (`deploy/backup/`, `make backup-now`, `make restore`). Drill procedure in [RUNBOOK §5](RUNBOOK.md#5-backups-and-restore). Needs a first drill on staging; record the date and duration. Set `BACKUP_PASSPHRASE` and `BACKUP_S3_BUCKET` (off-site). Note that encryption is **optional** in the script: without a passphrase, dumps containing ID numbers are stored in clear. |
| Incident response contacts / runbook | 🟡 | Runbook ✅ ([RUNBOOK §8](RUNBOOK.md#8-incident-response), [SECURITY §6](SECURITY.md#6-breach-response), [incident-communications.md](ops/incident-communications.md)). 🔴 Fill in the on-call rota, the grievance/privacy officer, the lawyer's contact, and the SMS gateway account managers. |
| CSRF / cross-site protection on web | 🟡 | Tokens are in HttpOnly cookies and the BFF blocks token endpoints ✅. `Origin` / `Sec-Fetch-Site` check on mutating BFF calls in progress. |
| TLS, HSTS, secure headers | ✅ | Caddy plus `prod.py` (HSTS preload, nosniff, `X-Frame-Options: DENY`). CI runs `check --deploy`. |

## Reliability

| Item | Status | Evidence / next step |
| --- | --- | --- |
| Health / readiness checks | ✅ | `/api/v1/health`, `/api/v1/readiness` (DB + Redis + release). Compose health checks on every service. |
| Metrics + alerting | 🟡 | In progress: `/metrics` (Prometheus), `deploy/monitoring/alerts.yml`. Today: Sentry only. 🔴 Pick where Prometheus/Grafana or uptime checks run (e.g. a small second VPS or a hosted service). Alert on: readiness down, 5xx rate, OTP failures, SMS failure rate, Celery queue length, disk > 80%, backup missing > 26 h. |
| Error tracking | 🟡 | Sentry integration ✅ (`send_default_pii=False`). 🔴 Create the project and set `SENTRY_DSN` for backend; consider the web and Flutter SDKs. |
| Log retention | 🟡 | JSON logs, Docker rotation 5 × 20 MB per container (a few days at pilot volume). 🔴 Ship to a log platform with 30-day retention ([SECURITY §5](SECURITY.md#5-retention)). |
| Capacity / load test | 🟡 | In progress (`deploy/load/k6-smoke.js`). Target: 15 pilot orgs × 300 workers with morning hajiri peaks at 07:00–09:00 NPT, and payroll runs on BS day 1–3. |
| DB connection pooling | 🟡 | Persistent connections (`CONN_MAX_AGE=60`, health checks). No PgBouncer. That's fine for 3 gunicorn workers × 2 threads + Celery; revisit above 10 workers. |
| CDN / private object storage | 🟡 | Private storage and signed URLs ✅ (`apps/core/files.py`, `tests/test_files.py`). No CDN; static files come from WhiteNoise and Next.js. 🔴 Decide local volume vs S3-compatible bucket (block public access, versioning). |
| Single-host risk | 🔴 | Everything runs on one VM. Accept this for the pilot; document RTO 4 h / RPO 24 h. Before scale: managed Postgres with PITR, or streaming replica plus WAL archiving. |

## Operations

| Item | Status | Evidence |
| --- | --- | --- |
| KYC SOP | ✅ written / 🔴 staff trained | [ops/kyc-identity-verification.md](ops/kyc-identity-verification.md) |
| Credential verification SOP | ✅ / 🔴 trained | [ops/credential-verification.md](ops/credential-verification.md) |
| Employer verification (KYB) SOP | ✅ / 🟡 tooling in progress | [ops/employer-verification-kyb.md](ops/employer-verification-kyb.md) |
| Work-history reference checks | ✅ / 🟡 tooling in progress | [ops/work-history-reference-checks.md](ops/work-history-reference-checks.md) |
| Fraud escalation SOP | ✅ / 🟡 risk tooling in progress | [ops/fraud-escalation.md](ops/fraud-escalation.md) |
| Dispute handling SLA | ✅ | [ops/dispute-handling-sla.md](ops/dispute-handling-sla.md) |
| Worker + employer support scripts | ✅ | [ops/support-scripts.md](ops/support-scripts.md) |
| Employer onboarding playbook | ✅ | [ops/employer-onboarding-playbook.md](ops/employer-onboarding-playbook.md) |
| Registration camp guide | ✅ | [ops/worker-registration-camps.md](ops/worker-registration-camps.md) |
| Foreign-employment document guidance | ✅ / 🟡 tooling in progress | [ops/foreign-employment-documents.md](ops/foreign-employment-documents.md) |
| Data-protection requests | ✅ | [ops/data-protection-requests.md](ops/data-protection-requests.md) |
| Incident communications | ✅ | [ops/incident-communications.md](ops/incident-communications.md) |
| Yearly reference data (tax slabs, minimum wage, holidays, SSF) | 🟡 | Process in [RUNBOOK §9](RUNBOOK.md#9-yearly-reference-data-checklist). 🔴 Holidays for 2083 are seeded as **approximate**: confirm against the government calendar before the pilot. |

## Legal and finance

| Item | Status | Next step |
| --- | --- | --- |
| Terms of service | 🟡 draft | `/terms` (web) is flagged for review. 🔴 lawyer |
| Privacy policy | 🟡 draft | `/privacy`; Individual Privacy Act 2075. 🔴 lawyer |
| Consent language | 🟡 | In-app consent screens (data processing, profile share, partner grants with partner, regulator, scopes and duration). 🔴 lawyer + Nepali plain-language review |
| Data retention policy | 🟡 | [SECURITY §5](SECURITY.md#5-retention) states assumptions (payroll ≥ 7 years, audit 5 years). 🔴 confirm with counsel |
| Employer commercial agreement | 🔴 | Pilot letter (free 90 days, data terms, what we are not: not an employer of record, not a payroll fund holder). Then the paid MSA with NPR 5,000/hire, NPR 150/worker/month (min 3,000) and a 30-day replacement. |
| Worker platform agreement | 🔴 | Short, bilingual, read aloud at camps: free for workers, what we store, who sees it, how to delete. |
| Tax / VAT review | 🔴 | VAT registration for KaamSathi's own invoices (13%); whether placement fees need TDS treatment by employers; invoice format (IRD). Tax adviser. |
| Recruitment / intermediary legal review | 🔴 | Labour Act 2074 (labour supplier licensing), Foreign Employment Act 2064 (for phase 5), Electronic Transactions Act 2063 (e-contracts, e-acceptance of contracts). |
| Payroll rules adviser (SSF + TDS) | 🔴 | Confirm: SSF 11% + 20% on basic; the `SSF_DUE_DAYS=15` setting; the 1% slab waiver for SSF contributors; FY 2083/84 slabs; daily-wage basic/DA split. Each fiscal year, see [RUNBOOK §9](RUNBOOK.md#9-yearly-reference-data-checklist). |
| Processor DPAs | 🔴 | Hosting, S3, Sparrow, Aakash, Sentry ([SECURITY §8](SECURITY.md#8-open-items-before-go-live)). Decide whether data may leave Nepal; if not, host in Nepal. |
| Grievance / privacy officer appointed and published | 🔴 | Name, phone and email on `/privacy` and in the app. |

## Deploy and accounts (KaamSathi-specific)

| Item | Status | Next step |
| --- | --- | --- |
| Host provisioned (Ubuntu 24.04, ≥ 2 vCPU / 4 GB), firewall 80/443 only, unattended upgrades | 🔴 | [RUNBOOK §1](RUNBOOK.md#1-first-deploy) |
| DNS for `DOMAIN`, `www`, `API_DOMAIN`; `ACME_EMAIL` | 🔴 | |
| `deploy/.env.prod` filled, `chmod 600` | 🔴 | From [.env.prod.example](../deploy/.env.prod.example) |
| `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY` (distinct) | 🔴 | `openssl rand -hex 32` |
| `FIELD_ENCRYPTION_KEYS` (Fernet), `FIELD_HASH_KEY` | 🔴 + code fix | Launch blocker 1. **Losing these makes encrypted IDs unreadable**, so store them in two places. |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `BACKUP_PASSPHRASE` | 🔴 | |
| Non-default `DJANGO_ADMIN_URL`; first superuser | 🔴 | |
| SMS: Sparrow token + approved sender ID; Aakash as failover, funded | 🔴 | Sender ID approval takes days; apply early. `SMS_BACKEND=sparrow`. **Never `console` in prod** (nobody can log in). [RUNBOOK §7](RUNBOOK.md#7-sms-gateway-failover-otp-login-depends-on-it). |
| Sentry DSN | 🔴 | |
| Off-site backup bucket with lifecycle/object lock | 🔴 | |
| Mobile: Play Console account, upload keystore, `API_BASE_URL` release build | 🔴 | [mobile/README.md](../mobile/README.md). iOS optional for the pilot (most workers use Android). |
| `seed_reference` on prod; **never** `seed_demo` | ✅ | `seed_demo` refuses without `--allow-production` |
| Demo orgs/workers absent from prod | ✅ | |
| Pricing env (`PLACEMENT_FEE`, `SUBSCRIPTION_PER_WORKER`, `SUBSCRIPTION_MINIMUM`) | ✅ defaults | 5000 / 150 / 3000. During the pilot, set `plan=pilot` and waive charges (`Charge.status=waived`). |
| `KYB_REQUIRED_FOR_SHORTLIST` | 🟡 | In progress; default True. Verify the pilot partners first. |

## Partner agreements (gates for switched-off features)

| Partner | Needed for | Status |
| --- | --- | --- |
| NRB-licensed bank / BFI / PSP (eSewa, Khalti, connectIPS via NCHL) | live payouts, loan/EWA referrals | 🔴 none signed; bank file works without them |
| Nepal Insurance Authority-licensed insurer | insurance referrals | 🔴 |
| NSTB / CTEVT data agreement | registry verification of skill certificates | 🔴; manual verification works without it |
| CTEVT-affiliated training institutes | training partner portal, supply of certified workers | 🔴 |
| DoFE-licensed recruitment agencies (licence verified) | phase-5 document sharing | 🔴; feature gated |
| SSF | e-filing integration (today: we prepare the file, the employer uploads it) | ⬜ not needed for pilot |

## In-progress workstreams (re-check after integration)

These are marked 🟡 above and must be re-verified once merged:
- MFA and staff roles
- sessions
- request IDs
- idempotency
- uploads and malware scan
- task reliability and `/ops/system`
- metrics and alerts and load test
- audit immutability and `/ops/audit`
- KYB
- risk flags
- support cases
- taxonomy
- external work history
- interest and invitations / matching v2
- timesheets
- enterprise API and webhooks
- notifications inbox and push
- mobility
- heatmap / KPIs / career

## Known gaps found while writing these docs

- The production compose doesn't forward `FIELD_ENCRYPTION_KEYS` / `FIELD_HASH_KEY` (launch blocker 1).
- [RUNBOOK.md](RUNBOOK.md) and [SECURITY.md](SECURITY.md) don't mention field-encryption keys or
  `rotate_field_keys`, although `apps/core/crypto.py` and the command point to them.
- Payout provider webhooks (`X-Signature` over the raw body) have no timestamp or replay
  protection. Partner and enterprise webhooks do (`X-KaamSathi-Timestamp`).
- The privacy deletion pseudonym (`privacy.services.pseudonymous_phone`) is keyed with
  `SECRET_KEY`, so rotating `SECRET_KEY` changes the mapping. It should use `FIELD_HASH_KEY` /
  `blind_index`.
- `POST /ops/workers/{id}/verify` accepts `verified` without checking that ID images exist and
  without a second reviewer. The KYC SOP enforces this manually until the code does.
- Backups are only encrypted if `BACKUP_PASSPHRASE` is set, but the README says "nightly encrypted backup job".
