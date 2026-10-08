# KaamSathi — Production readiness checklist

This checklist covers every item in the reference checklist (`nepal-workforce-os/docs/PRODUCTION_CHECKLIST.md`),
plus KaamSathi's own launch items. The engineering task tracker is
[DETAILED_TASK_CHECKLIST.md](DETAILED_TASK_CHECKLIST.md). Status is stated honestly:

- ✅ **done**: in the repo and covered by tests or CI
- 🟡 **partial**: partly built, or built but not yet exercised outside tests
- 🔴 **needs you**: a decision, account, agreement, secret, review or human test that code can't provide

Last reviewed: 2026-10-08 (Ashwin 2083), against branch `phase-1`. Backend suite: **720 tests pass**.
All 19 Celery beat entries resolve to registered tasks. Every CONTRACT-EXTENSIONS workstream that was
"in progress" at the last review has since landed and was re-verified (see the bottom of this file).

## Launch blockers (do these first)

1. 🔴 **Generate and store all secrets** (see Deploy and accounts below), including
   `FIELD_ENCRYPTION_KEYS` and `FIELD_HASH_KEY`. Keep them in the password manager **and** one
   offline copy, **outside** the server. Losing the field keys makes the encrypted citizenship, NID,
   bank, PAN and travel-document numbers and the staff MFA secrets unreadable.
2. 🔴 **SMS**: approve the sender ID and fund both gateways (Sparrow primary, Aakash failover). No
   SMS means nobody can log in.
3. 🔴 **Lawyer review**: `/privacy`, `/terms`, consent text, worker and employer agreements,
   contract template, intermediary model. All are live as drafts with a "pending legal review"
   banner. Publish the grievance officer's name and contact.
4. 🔴 **Staff accounts**: create a `StaffProfile` with roles for every ops person and enrol each of
   them in TOTP MFA. In production a staff user with no profile gets **no** roles, and
   `STAFF_MFA_REQUIRED` blocks `/ops/*` until they enrol.
5. 🔴 **Run one restore drill** on staging and record its date and duration. Set
   `BACKUP_PASSPHRASE` and `BACKUP_S3_BUCKET` first: without a passphrase, dumps are stored
   unencrypted.
6. 🔴 **Human acceptance pass on staging** with real Android phones (offline hajiri, QR check-in,
   payslip, bank file, SSF file), plus a Nepali-language review.
7. 🟡 **Fix the CI production-compose validation.** `deploy/docker-compose.prod.yml` now requires
   `FIELD_ENCRYPTION_KEYS` and `FIELD_HASH_KEY` (`${…:?}`), and both are empty in
   `deploy/.env.prod.example`. The `docker` job's "Validate production compose file" `sed` in
   [.github/workflows/ci.yml](../.github/workflows/ci.yml) doesn't fill them, so the job fails.
   Add `-e 's/^FIELD_ENCRYPTION_KEYS=.*/FIELD_ENCRYPTION_KEYS=x/' -e 's/^FIELD_HASH_KEY=.*/FIELD_HASH_KEY=x/'`.

✅ Resolved since the last review: the production compose now forwards `FIELD_ENCRYPTION_KEYS` and
`FIELD_HASH_KEY` as required variables (`deploy/docker-compose.prod.yml` `x-backend-env`), and
staff MFA and roles are enforced (`apps/accounts/mfa.py`, `apps/accounts/staff_roles.py`,
`tests/test_security_mfa.py`).

---

## Product

| Item | Status | Evidence / next step |
| --- | --- | --- |
| Core user journeys acceptance-tested | 🟡 | API journeys have pytest coverage in [backend/tests/](../backend/tests) (720 tests: hiring, interest, offers, attendance, timesheets, payroll engine and API, payouts, billing, privacy, partners, mobility, passport…). Playwright E2E in [web/e2e/](../web/e2e) covers the employer, ops and passport journeys, runs in the CI `e2e` job against the docker-compose stack, and has a README. 🔴 Still needed: a recorded manual acceptance pass on staging with real devices: OTP login → onboarding → import staff → hajiri (web + app offline) → payroll run → payslip PDF → bank file → SSF file; job → shortlist → worker confirms → joined → placement charge → invoice. |
| Nepali/English localisation reviewed | 🟡 | Catalogues are complete and CI-checked (`pnpm messages:check`, `compilemessages -l ne`, mobile `app_ne.arb`); `tests/test_i18n.py`. 🔴 A native speaker who works with supervisors and workers needs to review the wording on all three surfaces, using [GLOSSARY.md](GLOSSARY.md). |
| Accessibility review | 🟡 | Automated axe (WCAG 2 A/AA, fails on serious or critical violations) on landing, login, employer dashboard and public passport: [web/e2e/a11y.spec.ts](../web/e2e/a11y.spec.ts). 🔴 Not done: a manual WCAG 2.1 AA pass (keyboard, screen reader), Flutter large-tap and TalkBack checks, and testing with low-literacy workers. |
| Error / empty / loading states | 🟡 | Shared components in `web/components/ui/feedback.tsx` and `mobile/lib/core/widgets/`. The newer pages (billing, analytics, mobility, support, timesheets) haven't had a dedicated review. |
| Support and dispute flows | ✅ | Disputes with SLA (`apps/trust`, `tests/test_trust.py`, `tests/test_support.py::test_dispute_sla_moves_with_status`). Support cases with SLA escalation, safety reports, phone lookup and help centre (`apps/support`, `tests/test_support.py`, `/app/support`, `/ops/support`, `/help`, mobile `features/common/support`). SOPs: [dispute-handling-sla.md](ops/dispute-handling-sla.md), [support-scripts.md](ops/support-scripts.md). |

## Backend

| Item | Status | Evidence / next step |
| --- | --- | --- |
| Automated migrations | ✅ | The backend container runs them on start (`RUN_MIGRATIONS=true`). CI runs `makemigrations --check`. Process: [RUNBOOK §4](RUNBOOK.md#4-migrations). |
| API schema published | ✅ | `/api/schema/` and `/api/docs/` (staff-only in prod, `tests/test_production.py`). CI validates the schema (`spectacular --validate`) and uploads the `openapi-schema` artifact. Partner docs at `/partners/docs`; enterprise docs at `/developers` (`web/app/developers`). Conventions: [API_CONVENTIONS.md](API_CONVENTIONS.md). |
| Rate limits configured | ✅ | DRF throttles: anon, user, otp, public, files, privacy, telemetry ([settings/base.py](../backend/config/settings/base.py), `tests/test_production.py::test_throttle_scopes_configured`). OTP limited to 5/phone/hour. `NUM_PROXIES=1` so throttles key on the real client IP (`tests/test_audit_ip.py`). |
| Idempotency on critical endpoints | ✅ | `Idempotency-Key` + `@idempotent` ([apps/core/idempotency.py](../backend/apps/core/idempotency.py)) on payroll-run create, payouts create/submit, ops shortlist, finance apply, member invite, employment create, privacy request, partner referral status and enterprise attendance bulk. Attendance `client_uuid` upsert. `tests/test_security_platform.py::test_idempotent_replay_and_conflict`, `test_shortlist_is_idempotent`. |
| Background task retry / dead-letter | ✅ | `ReliableTask` default base, `FailedTask` table, `/ops/system` (health, failed tasks, retry/dismiss) and beat heartbeat ([apps/core/tasks.py](../backend/apps/core/tasks.py), `tests/test_security_platform.py::test_failed_task_captured_and_ops_retry_dismiss`, `test_system_health_and_heartbeat`). All 19 beat entries are implemented (checked against the Celery registry; the four entries flagged at the last review now exist). |
| Audit events verified | ✅ | Append-only `AuditLog` (DB trigger blocks UPDATE/DELETE) with a sha256 hash chain, `/ops/audit` and `/ops/audit/verify` (`apps/audit`, `tests/test_security_platform.py::test_audit_update_and_delete_blocked_at_db`, `test_audit_verify_detects_tamper_and_deletion`). Payroll approve/mark-paid/exports, KYB, staff, billing, mobility, API-key events are audited. |
| Sensitive fields encrypted/hashed | ✅ | [apps/core/crypto.py](../backend/apps/core/crypto.py), `tests/test_crypto.py` (incl. `test_production_requires_keys`, `test_key_rotation`), `manage.py rotate_field_keys`. Wired into prod compose. Rotation is documented in [RUNBOOK §6](RUNBOOK.md#6-rotating-secrets) and [ADR 0005](adr/0005-field-level-encryption-with-blind-indexes.md). 🔴 Generate the keys (launch blocker 1). |
| Request IDs / correlation | ✅ | `X-Request-ID` middleware, `request_id` in logs, Sentry scope and `error.request_id` ([apps/core/request_id.py](../backend/apps/core/request_id.py), `tests/test_security_platform.py::test_request_id_echoed_and_in_error_envelope`). |
| Upload validation + malware scan | ✅ | `validate_upload`: magic bytes, extension/content-type agreement, EXIF/GPS strip, PDF active-content rejection, size caps; ClamAV INSTREAM ([apps/core/uploads.py](../backend/apps/core/uploads.py), `tests/test_security_uploads.py`). Optional `clamav` compose profile. 🔴 Decide whether to run ClamAV in prod (≈1.5 GB RAM) and set `CLAMAV_REQUIRED`. |
| Maintenance mode | ✅ | `manage.py maintenance read_only|full|off` ([apps/core/maintenance.py](../backend/apps/core/maintenance.py), `tests/test_security_platform.py::test_maintenance_mode_read_only_and_full`). |

## Security

| Item | Status | Evidence / next step |
| --- | --- | --- |
| External penetration test | 🔴 | Not done. Scope: OTP, MFA and auth; `X-Org-Id` tenant isolation; signed file URLs; partner, org-API-key and enterprise auth; BFF proxy; uploads. Listed in [SECURITY.md §8](SECURITY.md#8-open-items-before-go-live). |
| Dependency / container scan clean | ✅ / 🟡 | CI `security` job: bandit (fails on HIGH), gitleaks over the full history (`.gitleaks.toml`), trivy filesystem (fails on CRITICAL). `docker` job: trivy image scans of backend and web (fail on CRITICAL). [codeql.yml](../.github/workflows/codeql.yml): weekly CodeQL `security-extended` scans. 🟡 `pip-audit` and `pnpm audit --prod` are still informational only. |
| Secrets rotated / generated for prod | 🔴 | Procedure for every secret, including `FIELD_ENCRYPTION_KEYS` and `FIELD_HASH_KEY`: [RUNBOOK §6](RUNBOOK.md#6-rotating-secrets). CI/CD secrets: [RUNBOOK §13](RUNBOOK.md#13-cicd). None generated yet. |
| MFA enforced for admin/staff | ✅ | TOTP, recovery codes, MFA login step, `STAFF_MFA_REQUIRED` (default on in prod) ([apps/accounts/mfa.py](../backend/apps/accounts/mfa.py), `tests/test_security_mfa.py`); `/ops/account` enrolment. ⚠ Django admin (`DJANGO_ADMIN_URL`) is password-only, so keep superusers to 2 named people. 🔴 Enrol every staff member (launch blocker 4). |
| Staff roles / least privilege | ✅ | `StaffProfile.roles` + central `ROUTE_ROLES` ([apps/accounts/staff_roles.py](../backend/apps/accounts/staff_roles.py), `tests/test_security_mfa.py::test_role_enforced_on_real_endpoints`, `test_staff_without_profile_has_no_roles_in_production`). The ops nav hides routes a role can't open. `/ops/staff` admin is audited. |
| Session / device inventory, remote revoke | ✅ | `SessionDevice`, `/auth/sessions`, revoke one or revoke others (`tests/test_security_mfa.py::test_sessions_list_and_revoke`); UI `/app/account`, `/ops/account`, mobile security screen. |
| Backup restore tested | 🔴 | Tooling ✅ (`deploy/backup/`, `make backup-now`, `make restore`). Procedure: [RUNBOOK §5](RUNBOOK.md#5-backups-and-restore). Needs a first drill (launch blocker 5). Encryption is optional in `backup.sh`: set `BACKUP_PASSPHRASE`. |
| Incident response contacts / runbook | 🟡 | Runbook ✅ ([RUNBOOK §8](RUNBOOK.md#8-incident-response), §12 playbooks for account takeover, data leak, outage, fraud and payment; [SECURITY §6](SECURITY.md#6-breach-response); [incident-communications.md](ops/incident-communications.md)). 🔴 Fill in the on-call rota, the grievance/privacy officer, the lawyer's contact and the SMS gateway account managers. |
| CSRF / cross-site protection on web | ✅ | Tokens live in HttpOnly cookies and the BFF blocks token endpoints. Mutating BFF calls check `Origin`/`Sec-Fetch-Site` ([web/lib/server/origin.ts](../web/lib/server/origin.ts), `origin.test.ts`). |
| TLS, HSTS, secure headers | ✅ | Caddy plus `prod.py` (HSTS preload, nosniff, `X-Frame-Options: DENY`). CI runs `check --deploy --fail-level WARNING`. |
| Webhook signing | 🟡 | Partner and enterprise webhooks are signed with a timestamp (`X-KaamSathi-Timestamp`, `tests/test_integrations.py::test_signature_headers`, `tests/test_partners.py::test_webhook_signature`). ⚠ Inbound payout-provider webhooks (`X-Signature` over the raw body, [apps/payouts/providers.py](../backend/apps/payouts/providers.py)) still have no timestamp or replay window. |

## Reliability

| Item | Status | Evidence / next step |
| --- | --- | --- |
| Health / readiness checks | ✅ | `/api/v1/health`, `/api/v1/readiness` (DB + Redis + release); compose health checks on every service; `/ops/system/health` (queue length, workers seen, beat heartbeat, failed tasks, SMS failures). |
| Metrics + alerting | 🟡 | `/api/v1/metrics` (Prometheus, bearer `METRICS_TOKEN`; HTTP, Celery, OTP and SMS counters in Redis) ([apps/core/metrics.py](../backend/apps/core/metrics.py), `tests/test_security_platform.py::test_metrics_auth_and_content`). Alert rules: [deploy/monitoring/alerts.yml](../deploy/monitoring/alerts.yml). 🔴 Nothing scrapes it yet: choose where Prometheus/Alertmanager or an uptime checker runs (e.g. a small second VPS or a hosted service). Also add disk > 80% and backup-missing > 26 h checks there. |
| Error tracking | 🟡 | Sentry integration ✅ (`send_default_pii=False`, request id in scope). 🔴 Create the project and set `SENTRY_DSN`; consider the web and Flutter SDKs. |
| Log retention | 🟡 | JSON logs, Docker rotation 5 × 20 MB per container (a few days at pilot volume). 🔴 Ship to a log platform with 30-day retention ([SECURITY §5](SECURITY.md#5-retention)). |
| Capacity / load test | 🟡 | Script: [deploy/load/k6-smoke.js](../deploy/load/k6-smoke.js). 🔴 Not yet run against staging. Target: 15 pilot orgs × 300 workers with morning hajiri peaks at 07:00–09:00 NPT, and payroll runs on BS day 1–3. |
| DB connection pooling | 🟡 | Persistent connections (`CONN_MAX_AGE=60`, health checks); no PgBouncer. That's fine for 3 gunicorn workers × 2 threads + Celery; revisit above 10 workers. |
| CDN / private object storage | 🟡 | Private storage and signed URLs ✅ (`apps/core/files.py`, `tests/test_files.py`); S3-compatible storage supported. No CDN; static files come from WhiteNoise and Next.js. 🔴 Decide local volume vs S3-compatible bucket (block public access, versioning). |
| Single-host risk | 🔴 | Everything runs on one VM. Accept this for the pilot; document RTO 4 h / RPO 24 h. Before scale: managed Postgres with PITR, or a streaming replica plus WAL archiving. |
| CI/CD and rollback | ✅ / 🔴 | [ci.yml](../.github/workflows/ci.yml) (backend, web, mobile, security, docker, e2e); [deploy.yml](../.github/workflows/deploy.yml): GHCR images, staging on `main`, production on `v*` tags behind manual approval, automatic rollback to the previously deployed tag ([RUNBOOK §13](RUNBOOK.md#13-cicd)). 🔴 Staging and prod hosts, GitHub environments and secrets don't exist yet, so deploy jobs no-op. Rollback has never been exercised. See launch blocker 7 for the CI compose-validation fix. |

## Operations

| Item | Status | Evidence |
| --- | --- | --- |
| KYC SOP | ✅ written / 🔴 staff trained | [ops/kyc-identity-verification.md](ops/kyc-identity-verification.md). The code now requires an ID number and document before `verified` and blocks verification while a duplicate-identity flag is open (`tests/test_auth_permissions.py::test_ops_verify_requires_id_number_and_document`, `test_ops_verify_blocked_by_open_duplicate_identity_flag`). The second reviewer is still SOP-only (four-eyes QA). |
| Credential verification SOP | ✅ / 🔴 trained | [ops/credential-verification.md](ops/credential-verification.md); `/ops/credentials` |
| Employer verification (KYB) SOP | ✅ / 🔴 trained | [ops/employer-verification-kyb.md](ops/employer-verification-kyb.md). Tooling ✅: `/org/verification`, `/ops/employers`, `KYB_REQUIRED_FOR_SHORTLIST` gate (`tests/test_kyb.py`, [ADR 0004](adr/0004-kyb-gate-before-shortlisting.md)) |
| Work-history reference checks | ✅ / 🔴 trained | [ops/work-history-reference-checks.md](ops/work-history-reference-checks.md). Tooling ✅: `apps/experience`, `/ops/references` (`tests/test_experience.py`) |
| Fraud escalation SOP | ✅ / 🔴 trained | [ops/fraud-escalation.md](ops/fraud-escalation.md). Tooling ✅: `apps/risk` detectors + nightly scan, `/ops/risk` (`tests/test_risk.py`) |
| Dispute handling SLA | ✅ | [ops/dispute-handling-sla.md](ops/dispute-handling-sla.md); SLA escalation in code |
| Worker + employer support scripts | ✅ | [ops/support-scripts.md](ops/support-scripts.md); support cases + help centre |
| Employer onboarding playbook | ✅ | [ops/employer-onboarding-playbook.md](ops/employer-onboarding-playbook.md) |
| Registration camp guide | ✅ | [ops/worker-registration-camps.md](ops/worker-registration-camps.md) |
| Foreign-employment document guidance | ✅ | [ops/foreign-employment-documents.md](ops/foreign-employment-documents.md). Tooling ✅: `apps/mobility`, `/ops/mobility` (`tests/test_mobility.py`, [ADR 0007](adr/0007-foreign-employment-document-vault-only.md)) |
| Data-protection requests | ✅ | [ops/data-protection-requests.md](ops/data-protection-requests.md); `apps/privacy` (`tests/test_privacy.py`) |
| Incident communications | ✅ | [ops/incident-communications.md](ops/incident-communications.md) |
| Yearly reference data (tax slabs, minimum wage, holidays, SSF) | 🟡 | Process in [RUNBOOK §9](RUNBOOK.md#9-yearly-reference-data-checklist). 🔴 Holidays for 2083 are seeded as **approximate** (`apps/core/reference_data.py`): confirm them against the government calendar before the pilot. |

## Legal and finance

| Item | Status | Next step |
| --- | --- | --- |
| Terms of service | 🟡 draft | `/terms` with a "Draft — pending legal review" banner; versioned acceptance tracked (`apps/accounts/legal.py`). 🔴 lawyer |
| Privacy policy | 🟡 draft | `/privacy` (Individual Privacy Act 2075) has a grievance-officer section but no named officer yet. 🔴 lawyer + appoint the officer |
| Consent language | 🟡 | In-app consent screens (data processing, profile share, partner grants with partner, purpose, scopes and duration; mobility agency share). 🔴 lawyer + Nepali plain-language review |
| Data retention policy | 🟡 | [SECURITY §5](SECURITY.md#5-retention) states the assumptions (payroll ≥ 7 years, audit 5 years, telemetry 400 days); retention jobs exist (`privacy.process_requests`, `telemetry.purge_old_events`). 🔴 confirm with counsel |
| Employer commercial agreement | 🔴 | The acceptance gate for owners is built (`tests/test_security_mfa.py::test_employer_agreement_pending_for_owners_only`). Text still needed: a pilot letter (free 90 days, data terms, what we are not: not an employer of record, not a payroll fund holder), then the paid MSA (pilot plan: NPR 5,000/hire, NPR 150/worker/month, min 3,000, 30-day replacement; other plans in `apps/billing`). |
| Worker platform agreement | 🔴 | `worker_agreement` acceptance kind is built. Text: short, bilingual, read aloud at camps (free for workers, what we store, who sees it, how to delete). |
| Tax / VAT review | 🔴 | Invoicing is built: 13% VAT, gap-free numbering per BS fiscal year, bilingual PDF, credit notes (`apps/billing`, `tests/test_billing_invoices.py`). IRD CBMS adapter is a stub, disabled. Tax adviser: VAT registration, IRD invoice format and CBMS obligation, and whether placement fees need TDS treatment by employers. |
| Recruitment / intermediary legal review | 🔴 | Labour Act 2074 (labour supplier licensing), Foreign Employment Act 2064 (document vault + licensed-agency sharing; agency job publication stays off until a legal opinion, [ADR 0007](adr/0007-foreign-employment-document-vault-only.md)), Electronic Transactions Act 2063 (e-contracts, e-acceptance). |
| Payroll rules adviser (SSF + TDS) | 🔴 | Confirm: SSF 11% + 20% on basic; `SSF_DUE_DAYS=15`; the 1% slab waiver for SSF contributors; FY 2083/84 slabs; daily-wage basic/DA split; the OT approval rule in timesheets. Each fiscal year, see [RUNBOOK §9](RUNBOOK.md#9-yearly-reference-data-checklist). |
| Processor DPAs | 🔴 | Hosting, S3, Sparrow, Aakash, Sentry, FCM (if push is enabled), SMTP ([SECURITY §8](SECURITY.md#8-open-items-before-go-live)). Decide whether data may leave Nepal; if not, host in Nepal. |
| Grievance / privacy officer appointed and published | 🔴 | Name, phone and email on `/privacy` and in the app. |

## Deploy and accounts (KaamSathi-specific)

| Item | Status | Next step |
| --- | --- | --- |
| Hosts provisioned (staging + prod; Ubuntu 24.04, ≥ 2 vCPU / 4 GB, +1.5 GB for ClamAV), firewall 80/443 only, unattended upgrades | 🔴 | [RUNBOOK §1](RUNBOOK.md#1-first-deploy), server prerequisites in [RUNBOOK §13](RUNBOOK.md#13-cicd) |
| GitHub environments `staging` / `production` (required reviewers), deploy secrets, branch protection | 🔴 | [RUNBOOK §13](RUNBOOK.md#13-cicd) |
| DNS for `DOMAIN`, `www`, `API_DOMAIN`; `ACME_EMAIL` | 🔴 | |
| `deploy/.env.prod` (and `.env.staging`) filled, `chmod 600` | 🔴 | From [.env.prod.example](../deploy/.env.prod.example) |
| `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY` (distinct) | 🔴 | `openssl rand -hex 32` |
| `FIELD_ENCRYPTION_KEYS` (Fernet), `FIELD_HASH_KEY` | 🔴 | Compose wiring ✅. **Losing these makes encrypted IDs unreadable**, so store them in two places. |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `BACKUP_PASSPHRASE`, `METRICS_TOKEN` | 🔴 | |
| Non-default `DJANGO_ADMIN_URL`; first superuser; staff profiles + MFA | 🔴 | Launch blocker 4 |
| SMS: Sparrow token + approved sender ID; Aakash as failover, funded | 🔴 | Sender ID approval takes days; apply early. `SMS_BACKEND=sparrow`. **Never `console` in prod** (nobody can log in). [RUNBOOK §7](RUNBOOK.md#7-sms-gateway-failover-otp-login-depends-on-it). |
| Email (SMTP) for critical notifications and invoices | 🔴 | Email channel is built (`tests/test_notifications.py::test_email_channel_for_critical_payslip`); needs credentials. |
| Push (FCM project + service account) | 🔴 optional | The adapter is built and disabled until `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT_JSON` are set. The mobile app polls the inbox; adding the push plugin is deferred. |
| Sentry DSN | 🔴 | |
| Off-site backup bucket with lifecycle/object lock | 🔴 | |
| Mobile: Play Console account, upload keystore, `API_BASE_URL` release build, store listing assets | 🔴 | [mobile/README.md](../mobile/README.md). iOS optional for the pilot (most workers use Android). |
| `seed_reference` on prod; **never** `seed_demo` | ✅ | `seed_demo` refuses without `--allow-production` (`tests/test_production.py::test_seed_demo_refuses_without_debug`) |
| Demo orgs/workers absent from prod | ✅ | |
| Pricing (plans) | ✅ | `billing.Plan`. The seeded `pilot` plan keeps the phase-1 terms: 5000 / 150 / 3000 (`tests/test_billing_invoices.py::test_seeded_pilot_plan_keeps_phase1_pricing`). During the pilot, waive charges (`Charge.status=waived`) or pause subscriptions. |
| `KYB_REQUIRED_FOR_SHORTLIST` | ✅ | Built; default True (`tests/test_kyb.py::test_shortlist_blocked_for_unverified_employer`). 🔴 Verify the pilot partners' documents first. |
| `TELEMETRY_ENABLED` / retention | ✅ | First-party, no-PII events ([ADR 0009](adr/0009-first-party-product-telemetry.md), `tests/test_telemetry.py`). Mention them in the privacy policy. |

## Partner agreements (gates for switched-off features)

| Partner | Needed for | Status |
| --- | --- | --- |
| NRB-licensed bank / BFI / PSP (eSewa, Khalti, connectIPS via NCHL) | live payouts, loan/EWA referrals | 🔴 none signed; the bank file works without them ([ADR 0006](adr/0006-partners-carry-all-regulated-activity-no-lending-no-wallet.md)) |
| Nepal Insurance Authority-licensed insurer | insurance referrals | 🔴 |
| NSTB / CTEVT data agreement | registry verification of skill certificates | 🔴 manual verification works without it |
| CTEVT-affiliated training institutes | training partner portal, supply of certified workers | 🔴 |
| DoFE-licensed recruitment agencies (licence verified) | phase-5 document sharing | 🔴 sharing is built and limited to verified, unexpired agencies |
| SSF | e-filing integration (today: we prepare the file, the employer uploads it) | ⬜ not needed for the pilot |
| IRD | CBMS real-time invoice reporting | 🔴 tax adviser first; adapter disabled |

## Previously in-progress workstreams (re-verified 2026-10-08)

Every item that was 🟡 "in progress" at the 2026-10-07 review is now in the repo with tests:

| Workstream | Evidence |
| --- | --- |
| MFA and staff roles | `apps/accounts/mfa.py`, `staff_roles.py`, `tests/test_security_mfa.py` |
| Sessions | `apps/accounts/sessions.py`, `tests/test_security_mfa.py::test_sessions_list_and_revoke` |
| Request IDs | `apps/core/request_id.py`, `tests/test_security_platform.py` |
| Idempotency | `apps/core/idempotency.py`, `tests/test_security_platform.py::test_idempotent_replay_and_conflict` |
| Uploads and malware scan | `apps/core/uploads.py`, `tests/test_security_uploads.py` |
| Task reliability and `/ops/system` | `apps/core/tasks.py`, `system_views.py`, `tests/test_security_platform.py` |
| Metrics, alerts and load test | `apps/core/metrics.py`, `deploy/monitoring/alerts.yml`, `deploy/load/k6-smoke.js` (not yet run, not yet scraped) |
| Audit immutability and `/ops/audit` | `apps/audit`, `tests/test_security_platform.py::test_audit_*` |
| KYB | `apps/orgs/kyb.py`, `tests/test_kyb.py` |
| Risk flags | `apps/risk`, `tests/test_risk.py` |
| Support cases | `apps/support`, `tests/test_support.py` |
| Taxonomy | `apps/workers/taxonomy_views.py`, `tests/test_taxonomy.py` |
| External work history | `apps/experience`, `tests/test_experience.py` |
| Interest and invitations / matching v2 | `apps/hiring`, `tests/test_interest.py`, `tests/test_matching_v2.py` |
| Timesheets | `apps/timesheets`, `tests/test_timesheets.py` |
| Enterprise API and webhooks | `apps/integrations`, `tests/test_integrations.py`, `/developers` |
| Notifications inbox, templates and push | `apps/notifications`, `tests/test_notifications.py` |
| Mobility | `apps/mobility`, `tests/test_mobility.py` |
| Heatmap / KPIs / career | `apps/insights/intelligence.py`, `tests/test_insights_v2.py` |
| Billing and invoices | `apps/billing`, `tests/test_billing_invoices.py` |
| Product analytics | `apps/telemetry`, `tests/test_telemetry.py`, `/ops/analytics` |
| CI/CD, E2E, ADRs | `.github/workflows/{ci,codeql,deploy}.yml`, `web/e2e/`, `docs/adr/`, `CHANGELOG.md` |

## Known gaps (code vs docs)

- **CI:** the `docker` job's prod-compose validation doesn't fill `FIELD_ENCRYPTION_KEYS` /
  `FIELD_HASH_KEY`, so it fails (launch blocker 7).
- **Payout webhooks:** inbound payout-provider webhooks (`X-Signature`) have no timestamp or replay
  protection. Partner and enterprise webhooks do.
- **Backups:** they are only encrypted if `BACKUP_PASSPHRASE` is set, but the README says "nightly
  encrypted backup job". Either make the passphrase required in prod compose or fix the README.
- **KYC second reviewer:** the second-reviewer (four-eyes) check on identity verification exists
  only in the SOP, not in code. The ID number and document are now enforced in code.
- **Design tokens:** [design-tokens.json](design-tokens.json) holds the reference palette
  (#2563EB + coral/yellow/teal), while the shipped KaamSathi tokens are in [DESIGN.md](DESIGN.md),
  `web/app/globals.css` and `mobile/lib/core/theme/tokens.dart` (#2647C4 + crimson #DC2B4B).
  Regenerate the JSON from DESIGN.md or mark it as the reference palette.
- **Client telemetry:** the web sends only login events and the mobile app sends none, so client
  funnels are thin until more screens call `track()`.
- **OTP resend cooldown:** the 30 s cooldown is enforced only on the client. The server enforces
  5/phone/hour.

### Resolved since the last review

- The prod compose now forwards the field-encryption keys.
- RUNBOOK and SECURITY now document `FIELD_ENCRYPTION_KEYS`, `FIELD_HASH_KEY` and `rotate_field_keys`.
- `privacy.services.pseudonymous_phone` is now keyed with `FIELD_HASH_KEY` (`blind_index`), not
  `SECRET_KEY`.
- `POST /ops/workers/{id}/verify` now requires an ID number and document.
