# KaamSathi — Architecture (as built)

This file describes the system that exists in this repo today, not a target design. The
API and data model are defined in [CONTRACT.md](CONTRACT.md), [CONTRACT-ECOSYSTEM.md](CONTRACT-ECOSYSTEM.md)
and [CONTRACT-EXTENSIONS.md](CONTRACT-EXTENSIONS.md). Operating procedures are in [RUNBOOK.md](RUNBOOK.md),
data handling rules in [SECURITY.md](SECURITY.md), and API rules in [API_CONVENTIONS.md](API_CONVENTIONS.md).
The `nepal-workforce-os/` folder is a reference design we compared against. It is not part of the
running system.

Status markers: **built** means the code and tests are in `main`/`phase-1`. **In progress** means another
workstream is building it now under CONTRACT-EXTENSIONS.md (app skeleton registered, logic pending).

---

## 1. Surfaces

| Surface | Who | Tech | Where |
| --- | --- | --- | --- |
| Marketing site + legal pages | public | Next.js 15 (App Router) | `web/app/page.tsx`, `/privacy`, `/terms` (drafts, flagged for lawyer review) |
| Employer portal | employer members (owner/admin/hr/supervisor) | Next.js | `web/app/app/*` (`/app/jobs`, `/app/workers`, `/app/attendance`, `/app/payroll`, `/app/compliance`, `/app/roster`, `/app/contractors`, `/app/disputes`, `/app/analytics`, `/app/training`, `/app/billing`, `/app/settings`) |
| Ops console | KaamSathi staff (`is_staff`) | Next.js | `web/app/ops/*` (`/ops/workers`, `/ops/verification`, `/ops/jobs`, `/ops/organizations`, `/ops/credentials`, `/ops/disputes`, `/ops/crews`, `/ops/training`, `/ops/partners`, `/ops/finance`, `/ops/insights`, `/ops/privacy`) |
| Skill Passport (public) | anyone with the link | Next.js | `/p/[code]` (worker made it public), `/p/s/[token]` (time-limited share) |
| Partner API docs | partner engineers | Next.js | `/partners/docs` |
| Worker + supervisor app | workers, site supervisors | Flutter 3 (one app, two modes) | `mobile/lib/features/worker/*`, `mobile/lib/features/supervisor/*` |
| REST API | all clients | Django 5 + DRF | `https://<API_DOMAIN>/api/v1` ([config/api_urls.py](../backend/config/api_urls.py)) |
| Partner API | licensed partners (banks, insurers, training, agencies) | DRF, key auth | `/api/v1/partner/*` ([apps/partners/urls.py](../backend/apps/partners/urls.py)) |
| Enterprise API + webhooks | larger employers' HRIS/ERP | DRF, org keys | `/api/v1/enterprise/*` (in progress, `apps.integrations`) |
| Django admin | superusers with a password | Django admin | `https://<API_DOMAIN>/<DJANGO_ADMIN_URL>`, used for reference data (tax slabs, minimum wage, holidays) |
| API schema / Swagger | staff | drf-spectacular | `/api/schema/`, `/api/docs/` (open in DEBUG, staff-only in production) |

Nav entries for these are already in [web/components/shell/nav.ts](../web/components/shell/nav.ts), but the
pages are still being built: `/app/timesheets`, `/app/verification`, `/app/integrations`,
`/app/support`, `/app/account`, `/ops/employers`, `/ops/references`, `/ops/risk`, `/ops/support`,
`/ops/kpis`, `/ops/mobility`, `/ops/audit`, `/ops/staff`, `/ops/taxonomy`, `/ops/system`.

## 2. Deployment topology

One Linux host runs a single Docker Compose stack ([deploy/docker-compose.prod.yml](../deploy/docker-compose.prod.yml)).
Staging uses the same file with a different env file and project name.

```text
                        Internet (workers' phones, employer browsers, partner servers)
                                              │  HTTPS :443 (HTTP :80 → redirect, ACME)
                                              ▼
                               ┌──────────────────────────────┐
                               │ caddy (only published ports) │  TLS, HSTS, gzip/zstd, JSON access log
                               └──────┬───────────────┬───────┘
                         <DOMAIN>     │               │   <API_DOMAIN>  (12 MB body cap)
                                      ▼               ▼
              ┌───────────────────────────┐     ┌──────────────────────────────────────┐
              │ web  (Next.js standalone) │────▶│ backend  (Django + gunicorn :8000)    │
              │ marketing, /app, /ops,    │ BFF │ /api/v1, /api/v1/files/<token>,       │
              │ /p, BFF proxy /api/proxy  │HTTP │ admin, schema; migrates on start      │
              └───────────────────────────┘     └───────┬───────────────┬──────────────┘
                     ▲ Flutter app talks to API directly │               │
                     │ (Bearer JWT)                      ▼               ▼
                                              ┌────────────────┐  ┌────────────────────┐
                                              │ db  Postgres 16│  │ redis 7 (password, │
                                              │ volume pgdata  │  │ AOF, noeviction)   │
                                              └──────▲─────────┘  │ db0 cache, db1 broker
                                                     │            └─────────▲──────────┘
                    ┌────────────────────────────────┼──────────────────────┤
                    │                                │                      │
          ┌─────────┴─────────┐           ┌──────────┴────────┐   ┌─────────┴─────────┐
          │ celery-worker      │           │ celery-beat       │   │ backup            │
          │ SMS, exports, PDFs,│           │ DatabaseScheduler │   │ nightly pg_dump + │
          │ webhooks, trust    │           │ (schedule below)  │   │ media tar, GPG,   │
          └─────────┬──────────┘           └───────────────────┘   │ optional S3 copy  │
                    │                                              └───────────────────┘
                    ▼  outbound HTTPS
     Sparrow SMS / Aakash SMS · partner webhook URLs · S3-compatible storage (optional) · Sentry
```

- The `media` volume is shared by backend and celery-worker, and mounted read-only into backup. If
  `AWS_STORAGE_BUCKET_NAME` is set, files go to a private S3-compatible bucket instead and every URL is presigned.
- The web container calls the API over the private network (`API_BASE_URL=http://backend:8000/api/v1`).
  Browsers never hold a JWT: tokens sit in HttpOnly cookies (`ks_access`, `ks_refresh`, `ks_org`), and
  `web/app/api/proxy/[...path]/route.ts` adds `Authorization` and `X-Org-Id` to each call. Token-issuing
  endpoints are blocked through the proxy.
- Every container except Caddy, Postgres and Redis entrypoints runs as non-root with
  `no-new-privileges`. backend and web drop all capabilities, and resource limits are set per service.
- Health checks: backend `/api/v1/readiness` (DB + Redis, returns `release`), web `/robots.txt`,
  celery `inspect ping`, Caddy admin.
- An optional `clamav` service is planned for upload scanning (in progress).

## 3. Bounded contexts → Django apps

The backend is one Django project ([backend/config](../backend/config)) with one app per bounded context.
Each newer app owns its own `urls.py` built on `apps.core.routers.Router`.

| Reference context | Django app(s) | Owns (main models) | Status |
| --- | --- | --- | --- |
| Platform | `core` | crypto (`EncryptedCharField`, `blind_index`), signed files, BS calendar (`bs.py`), money, permissions (`OrgPermission`, `IsOpsStaff`), error envelope, pagination, JSON logging, `rotate_field_keys` / `seed_*` commands | built; request IDs, idempotency, uploads, metrics, `ReliableTask` in progress |
| Identity | `accounts` | `User` (phone), `PhoneOTP` | built; `StaffProfile` (roles + TOTP MFA), `SessionDevice` in progress |
| Reference data | `geo` | `Province`, `District` (77) | built |
| Employer | `orgs` | `Organization` (+ KYB fields), `Membership` (roles), `Site` (geofence, QR), `Shift` | built; KYB endpoints in progress |
| Workforce (worker record) | `workers` | `Trade`, `Worker` (encrypted IDs), `WorkerSkill` (NSTB level), `Consent`, `Rating` | built |
| Recruitment | `hiring` | `MinimumWage`, `JobOpening`, `Application`, `StageEvent` | built; worker interest, invitations and matching v2 in progress |
| Workforce management | `workforce` | `Employment`, `Attendance` (hajiri), `LeaveRequest`, `Advance` (peski), `Holiday` | built |
| | `scheduling` | `RosterEntry` | built |
| | `timesheets` | `TimesheetPolicy`, `Timesheet` | in progress |
| Payroll inputs + payroll | `payroll` | `PayrollRun` (BS month), `Payslip`, `TaxSlab`; engine in `engine.py` | built |
| | `payouts` | `PayoutBatch`, `PayoutItem`; provider adapters (`bank_file` live, eSewa/Khalti/connectIPS stubs) | built |
| Compliance | `compliance` | `EmploymentContract`, `SSFFiling`, `Contractor` (thekedar), `ContractorAssignment` | built |
| Billing | `billing` | `Charge` (placement, subscription) | built |
| Reputation & trust | `trust` | `ProfileView`, `WorkerTrust` (verification level 0–5, reliability score), `Dispute` | built; dispute SLA in progress |
| | `crews` | `Crew` (naike), `Referral` (naike reward) | built |
| | `risk` | `FraudFlag` + detectors | in progress |
| | `support` | `SupportCase`, `CaseMessage` | in progress |
| | `experience` | `WorkHistoryEntry` (external history, reference checks) | in progress |
| Skills & training | `credentials` | `Credential`, `SkillAssessment`, `Passport`, `PassportShare`; `verifiers.py` (manual only) | built |
| | `training` | `TrainingProvider`, `Course`, `Enrollment`; shortage engine | built |
| Partner layer | `partners` | `Partner`, `PartnerAPIKey`, `ConsentGrant`, `PartnerAccessLog`; partner API and webhooks | built |
| | `finance` | `FinancialProfile`, `Offer`, `Referral` (loan/EWA/insurance referrals, never lending) | built |
| | `integrations` | `OrgAPIKey`, `WebhookEndpoint`, `WebhookDelivery` | in progress |
| Foreign-employment passport | `mobility` | `TravelDocument`, `ClearanceDocument`; agency compliance on `partners.Partner` | in progress |
| Intelligence | `insights` | no models; aggregate queries with k-anonymity 5 | built; heatmap, KPIs and career in progress |
| Notifications | `notifications` | `SMSMessage` log; SMS adapters (`console`/`sparrow`/`aakash`) | built; inbox (`Notification`), `DeviceToken`, FCM push in progress |
| Audit | `audit` | `AuditLog` | built; append-only trigger and hash chain in progress |
| Privacy | `privacy` | `PrivacyRequest` (export, correction, deletion) | built |

## 4. Authentication and authorisation

| Scheme | Header / carrier | Used by | Code |
| --- | --- | --- | --- |
| Phone OTP → JWT | `Authorization: Bearer <access>` (30 min access, 30 days rotating refresh, blacklist on rotate/logout) | Flutter app, web BFF | `apps/accounts/otp.py`, `views.py`; SimpleJWT signed with `JWT_SIGNING_KEY` |
| Web session | HttpOnly cookies `ks_access` / `ks_refresh` / `ks_org`, added by the BFF proxy | browser | `web/lib/server/session.ts`, `web/app/api/proxy/[...path]/route.ts` |
| Org scoping | `X-Org-Id: <org uuid>` on every `/org/*` call; membership and role are checked server-side | employer clients | `apps/core/permissions.py` (`resolve_membership`, `OrgPermission`, `OrgScopedMixin`) |
| Ops staff | `user.is_staff` gates `/ops/*`; per-route staff roles + TOTP MFA | ops console | `IsOpsStaff`; `StaffProfile` / `staff_roles.py` in progress |
| Partner keys | `Authorization: Partner ks_<prefix>_<secret>` + per-endpoint scopes + an active worker `ConsentGrant` | `/partner/*` | `apps/partners/auth.py` (SHA-256 of key stored, constant-time compare) |
| Org API keys | `Authorization: Org ks_org_<prefix>_<secret>` + scopes | `/enterprise/*` | in progress (`apps.integrations`) |
| Signed file URLs | `GET /api/v1/files/<token>` (HMAC with `SECRET_KEY`, 10 min TTL, re-authorised on download) | ID photos, documents, exports | `apps/core/files.py` |
| Webhook signatures | `X-KaamSathi-Signature: sha256=…` + `X-KaamSathi-Timestamp` (outbound). `X-Signature` HMAC of raw body (inbound from payout providers) | partners, enterprise endpoints, payout providers | `apps/partners/services.py`, `apps/payouts/providers.py` |
| Metrics | `Authorization: Bearer <METRICS_TOKEN>` on `/metrics` | Prometheus | in progress |
| Django admin | Django session + password, staff only, non-default path | superusers | `config/urls.py` |

Employer roles (`Membership.role`): `owner`, `admin`, `hr`, `supervisor`. Supervisors can see only
their assigned sites, and only attendance, leave and roster. Planned staff roles: `verifier`,
`support`, `finance_ops`, `partner_manager`, `risk_analyst`, `superadmin`
([CONTRACT-EXTENSIONS §1](CONTRACT-EXTENSIONS.md#1-security--platform)).

## 5. Key data flows

**Hire (Phase 1).** Employer creates a `JobOpening`. Minimum wage is checked against
`hiring.MinimumWage`, and a wage below it returns `below_minimum_wage`. Ops opens `/ops/jobs/{id}`
and gets ranked matches (trade 50, district 20, verified 10, NSTB up to 15, experience up to 10,
reliability up to 5, minus 10 if the wage is below the worker's expectation), then shortlists.
`Application` rows are created at `shortlisted` and the employer gets an SMS. The employer moves
stages: interview → selected → joined. When an application reaches `joined`, these happen:
- an `Employment` is created with a 30-day replacement window
- `billing.Charge` placement NPR 5,000 is created, or waived if it is a replacement
- a `crews.Referral` is created if the worker has a naike
- `StageEvent` and `AuditLog` rows are written

The full worker profile is shown only with consent (`profile_share`) or after a shortlist, and
every view writes `trust.ProfileView`.

**Hajiri → payroll → payout → SSF.** Attendance comes from three places:
- supervisors, via `POST /org/attendance/bulk`, which is offline-safe and idempotent on `client_uuid`
- workers, via site-QR check-in with a geofence (default 200 m)
- enterprise bulk (in progress)

At BS month end the owner/hr creates a `PayrollRun`. `payroll/engine.py` computes prorated
basic/DA, OT at 1.5×, Dashain allowance, SSF 11% + 20%, TDS slabs and advance recovery.
Approving the run locks that month's attendance. Then:
1. `PayoutBatch` (bank file) is created.
2. The employer uploads the file to their bank, then reconciles or marks items paid.
3. The run is marked `paid` and workers get a "payslip ready" SMS.
4. An `SSFFiling` file is prepared for the employer to upload on the SSF portal.

Money moves employer → bank/provider → worker. KaamSathi never holds funds.

**Consent-based sharing (Phase 3).** The worker opens an offer or a partner, and the app
creates `partners.ConsentGrant` (purpose, scopes, ≤ 90 days), a `workers.Consent` audit row and a
`finance.Referral`. The partner gets a signed webhook. The partner then reads
`/partner/workers/{id}/profile|earnings` with its key, and each read writes `PartnerAccessLog`
and `ProfileView`, which the worker sees in `/me/partner-access`. The partner sets the referral
status; we never set `approved` or `disbursed`.

**Skill Passport.** Only verified data goes into the payload ([CONTRACT-ECOSYSTEM §3](CONTRACT-ECOSYSTEM.md#3-credentials-phase-2)).
A public code is visible only if the worker turned it on. Share tokens expire within ≤ 90 days and can be revoked.
Views are counted and logged.

**Privacy requests.** The worker files an export, correction or deletion request.
- Export: Celery builds a JSON+PDF zip, downloadable for 72 h.
- Deletion: ops approves; the profile is anonymised and the employer-retained payroll and
  attendance records are kept ([SECURITY.md §4](SECURITY.md#4-data-subject-rights-privacy-app-contract-ecosystem-11)).

**File access.** An upload goes through `validate_upload` (magic bytes, EXIF strip, PDF active
content, optional ClamAV — in progress) and lands in private storage. Clients only ever get
`signed_url(...)`. On download the server re-checks the user and the access rule, and ID-document
views are audited (`worker.id_document.view`).

## 6. Async jobs (Celery)

The broker is Redis db1. The worker runs with `--concurrency ${CELERY_CONCURRENCY}` and
`--max-tasks-per-child 200`. Calls made inside a request use `apps.notifications.services.enqueue`
(after commit). Beat uses `django_celery_beat`'s DatabaseScheduler and is seeded from
`CELERY_BEAT_SCHEDULE` in [config/settings/base.py](../backend/config/settings/base.py). All times
are Asia/Kathmandu.

| Beat entry | Task | When | Purpose |
| --- | --- | --- | --- |
| monthly-subscription-charges | `apps.billing.tasks.monthly_subscription_charges` | daily 00:30 (acts on BS day 1) | `max(active × 150, 3000)` charge |
| recompute-trust-scores | `apps.trust.tasks.recompute_all` | 01:00 | verification level + reliability score |
| naike-referral-eligibility | `apps.crews.tasks.update_referral_eligibility` | 01:30 | pending → eligible/void after 30 days |
| refresh-financial-profiles | `apps.finance.tasks.refresh_all_profiles` | 02:00 | verified earnings from paid payslips |
| privacy-retention | `apps.privacy.tasks.process_requests` | 03:00 | purge exports, OTPs > 30 d, SMS logs > 180 d; re-queue stuck exports |
| risk-anomaly-scan | `apps.risk.tasks.scan` | 04:00 | duplicate bank, document reuse, buddy punching, velocity (in progress) |
| credential-expiry-reminders | `apps.credentials.tasks.expiry_reminders` | 08:00 | mark expired, SMS at 30/7 days |
| mobility-document-expiry | `apps.mobility.tasks.expiry_reminders` | 08:30 | passport/medical/police at 60/30/7 days (in progress) |
| ssf-filing-reminders | `apps.compliance.tasks.ssf_reminders` | 09:00 | SMS owner/hr 5 and 1 days before due |
| expire-partner-consents | `apps.partners.tasks.expire_grants` | hourly :15 | expire consent grants |
| support-sla-escalation | `apps.support.tasks.escalate_overdue` | every 30 min | escalate overdue cases and disputes (in progress) |
| integrations-webhook-retry | `apps.integrations.tasks.retry_deliveries` | every 10 min | webhook backoff 1 m → 12 h (in progress) |

Event-driven tasks:
- `notifications.tasks.send_sms`, `interview_reminder` (2 h before), `payslip_ready`, `notify_employer_shortlist`
- `partners.tasks.send_referral_webhook`
- privacy export build
- debounced trust recompute after attendance saves

The four "in progress" beat entries are registered ahead of their tasks. If a beat entry fires
before its app's `tasks.py` is merged, the worker logs an "unregistered task" error. After
integration, check `make deploy-logs S=celery-worker`.

## 7. Storage

| Store | Holds | Protection |
| --- | --- | --- |
| PostgreSQL 16 (`pgdata`) | all records | private network only; persistent connections (`CONN_MAX_AGE=60`, health checks); restricted fields encrypted (below) |
| Redis 7 (`redisdata`) | Celery broker (db1), cache/throttle counters (db0) | password, no published port, AOF, `noeviction` |
| Media: local `media` volume **or** private S3-compatible bucket (`AWS_STORAGE_BUCKET_NAME`, optional `AWS_PRIVATE_BUCKET_NAME` for exports) | ID photos, worker photos, credentials, contracts, SSF/payout files, privacy exports | never served publicly except `PUBLIC_MEDIA_PREFIXES` (org logos); signed links only; bucket must block public access |
| Backups (`backups` volume + optional `BACKUP_S3_BUCKET`) | nightly `pg_dump` and media tarball | GPG AES-256 when `BACKUP_PASSPHRASE` is set; 14 days locally |

## 8. Where encryption, audit and consent live

**Encryption**
- In transit: Caddy TLS with HSTS preload. The internal network is plain HTTP.
- At rest, field level: [apps/core/crypto.py](../backend/apps/core/crypto.py) uses Fernet
  `MultiFernet(FIELD_ENCRYPTION_KEYS)` for these fields:
  - `Worker.citizenship_no`, `nid_no`, `bank_account_no`
  - `Organization.pan_no`
  - mobility document numbers and reference phones (in progress)
- Exact-match lookup and duplicate detection use keyed HMAC blind indexes (`FIELD_HASH_KEY`,
  `*_hash` columns). Re-encrypt with `manage.py rotate_field_keys` after adding a new key.
  Production refuses to start encrypted-field access without both keys (`FIELD_KEYS_REQUIRED`).
- Hashed secrets: OTP codes, partner keys and org keys are stored hashed. MFA secrets will be
  encrypted (in progress).
- Backups: GPG.

**Audit**
- `audit.AuditLog`: actor, org, action, object and diff of changes, IP. Written on org-owned
  create/update/delete and all ops actions. It will become append-only with a hash chain and get
  `/ops/audit` (in progress).
- Domain logs:
  - `hiring.StageEvent` (pipeline)
  - `trust.ProfileView` (who saw a worker's full profile — shown to the worker)
  - `partners.PartnerAccessLog`
  - `notifications.SMSMessage`
  - `payroll` status timestamps (`approved_by`, `paid_at`)

**Consent**
- `workers.Consent` is append-only and the latest row wins. Scopes are `data_processing`,
  `profile_share` and `history_share`.
- `partners.ConsentGrant` is purpose-bound, time-limited and revocable.
- `credentials.PassportShare` is a share token with expiry and revoke.
- `compliance.EmploymentContract.accepted_at` records the worker's acceptance of the contract.

## 9. Configuration and environments

| Env | Settings module | Notes |
| --- | --- | --- |
| local | `config.settings.dev` (via `docker-compose.yml`, `make up`) | `OTP_DEV_CODE=123456`, console SMS, keys derived from `SECRET_KEY` |
| test / CI | `config.settings.test` | throttles off; CI also runs `check --deploy` against `config.settings.prod` |
| staging / production | `config.settings.prod` | `deploy/.env.prod` / `.env.staging`; see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) |

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs these steps:
- backend: ruff, migrations check, Nepali `.po` compile, `check --deploy`, pytest with coverage,
  pip-audit (informational)
- web: messages check, lint, typecheck, tests, build, `pnpm audit` (informational)
- mobile: `flutter analyze`, `flutter test`
- Docker builds and production compose validation
