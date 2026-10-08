# KaamSathi — Operations runbook

Production runs as one Docker Compose stack (`deploy/docker-compose.prod.yml`) on a single
Linux host: Caddy (TLS) → Next.js web + Django/gunicorn API, Celery worker + beat, PostgreSQL 16,
Redis, and a nightly backup container. Staging is the same file with a different env file and
project name. Security and data-handling rules are in [SECURITY.md](SECURITY.md).

| Thing | Where |
| --- | --- |
| Stack definition | `deploy/docker-compose.prod.yml`, `deploy/Caddyfile` |
| Secrets / config | `deploy/.env.prod` (from `deploy/.env.prod.example`, `chmod 600`, never committed) |
| Web | `https://<DOMAIN>` — marketing, employer portal `/app`, ops console `/ops` |
| API | `https://<API_DOMAIN>/api/v1` — mobile app, signed file links |
| Admin | `https://<API_DOMAIN>/<DJANGO_ADMIN_URL>` (staff with a password only) |
| API docs | `https://<API_DOMAIN>/api/docs/` (staff only in production) |
| Liveness / readiness | `/api/v1/health` (cheap) · `/api/v1/readiness` (DB + Redis, returns `release`) |
| Logs | `make deploy-logs [S=backend]` — JSON lines (Django, gunicorn, Caddy) |
| Errors | Sentry (`SENTRY_DSN`), tagged with `environment` and `release` |

All `make` targets below accept `ENV_FILE=deploy/.env.staging PROJECT=kaamsathi-staging` for staging.

---

## 1. First deploy

1. Host: Ubuntu 24.04 LTS, ≥ 2 vCPU / 4 GB RAM / 40 GB SSD, Docker Engine + compose plugin,
   firewall open on 80/443 only (plus SSH). Enable unattended security upgrades.
2. DNS: `A`/`AAAA` records for `<DOMAIN>`, `www.<DOMAIN>` and `<API_DOMAIN>` → host IP.
3. `git clone` the repo, `cp deploy/.env.prod.example deploy/.env.prod`, fill every value
   (`openssl rand -hex 32` for secrets), `chmod 600 deploy/.env.prod`.
4. `make deploy-up` — builds images tagged with the git SHA, runs migrations + `seed_reference`
   on backend start, obtains TLS certificates.
5. Create the first ops admin: `docker compose ... exec backend python manage.py createsuperuser`
   (phone + password; admin needs a password, the app uses OTP).
6. Smoke test: `curl https://<API_DOMAIN>/api/v1/readiness`, log in on the web with a real phone
   (proves SMS), open `/ops`, upload a worker ID photo and check it opens only via the app.
7. **Never** run `seed_demo` on production (it refuses unless `--allow-production`).

## 2. Routine deploy

```bash
git fetch && git checkout <tag-or-sha>
make deploy-up                 # rebuilds, restarts changed containers, migrates on backend start
make deploy-ps                 # all services "healthy"
curl -s https://<API_DOMAIN>/api/v1/readiness   # "release" == new SHA
```
Pre-flight: CI green; read new migrations (`git diff <old>..<new> -- '*/migrations/*'`); take
`make backup-now` before any migration that rewrites or drops data. Deploy outside payroll
peaks (first 3 days of a BS month) and never during an SSF filing deadline.

## 3. Rollback

* **Code only (no migrations in between):** `git checkout <previous-sha> && make deploy-up`.
* **With migrations:** migrations are written forward-compatible where possible. If the new code
  must be undone *and* the schema is incompatible:
  1. `make deploy-down` is **not** needed — first try `docker compose ... exec backend python manage.py migrate <app> <previous_migration>` for each app whose migrations changed, then redeploy the previous SHA.
  2. If reverse migrations are impossible/lossy: restore the backup taken just before the deploy
     (§5) and redeploy the previous SHA. Data written since that backup is lost — announce it.
* Keep the previous images: `docker image ls kaamsathi-backend` (tags are SHAs) — set
  `BACKEND_IMAGE=kaamsathi-backend:<sha>` / `WEB_IMAGE=...` in the env file to pin an image.

## 4. Migrations

* Generated only with `makemigrations <app>`; CI fails on missing migrations (`makemigrations --check`).
* Applied automatically by the `backend` container (`RUN_MIGRATIONS=true`); workers don't migrate.
* Long migrations on big tables (attendance, payslips): run manually in a maintenance window
  (`docker compose ... run --rm backend python manage.py migrate`) after `make backup-now`.
* Expand → migrate data → contract: add nullable columns first, backfill, make required in a later release.

## 5. Backups and restore

* `backup` service runs nightly at `BACKUP_HOUR` (Asia/Kathmandu): `pg_dump | gzip` plus a
  tarball of the local `media` volume, encrypted with `BACKUP_PASSPHRASE` (GPG AES-256) when set,
  kept 14 days in the `backups` volume and optionally copied to `BACKUP_S3_BUCKET`
  (set a bucket lifecycle rule, e.g. 90 days; enable object lock/versioning if available).
* Manual: `make backup-now`, `make backup-list`.
* Store `BACKUP_PASSPHRASE` in the password manager **outside** the server — without it the
  backups are useless.

**Restore (production):**
```bash
make backup-list
make restore FILE=/backups/db-kaamsathi-20261007-020000.sql.gz.gpg
# → asks you to type the project name, stops web/backend/celery, takes a safety backup,
#   restores (single transaction), starts the app again.
# Media (local storage only; the backup service mounts media read-only, so use a one-off container
# as root and give files back to the app user, uid 1000):
docker run --rm --user 0 -e BACKUP_PASSPHRASE -v kaamsathi_media:/media -v kaamsathi_backups:/backups \
  kaamsathi-backup:latest sh -c 'restore.sh --media /backups/media-<stamp>.tar.gz.gpg && chown -R 1000:1000 /media' 
```
From an off-site copy: `aws s3 cp s3://<bucket>/kaamsathi/<file> .` then
`docker compose ... cp <file> backup:/backups/` and restore as above.

**Restore drill (quarterly — record date and duration in the ops log):**
1. On staging (or a scratch host): `make deploy-up ENV_FILE=deploy/.env.staging PROJECT=kaamsathi-staging`.
2. Copy last night's production dump to the staging `backups` volume; `make restore ... FILE=...`.
3. Check: `/api/v1/readiness` ok; row counts of `workers_worker`, `payroll_payslip`,
   `workforce_attendance` match production ± today's activity; open a payslip PDF; open a worker photo.
4. Wipe the staging copy afterwards (it contains real personal data) — `make deploy-down` and
   `docker volume rm kaamsathi-staging_pgdata kaamsathi-staging_media kaamsathi-staging_backups`.

## 6. Rotating secrets

| Secret | How | Impact |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Put the old value in `DJANGO_SECRET_KEY_FALLBACKS`, set a new one, `make deploy-up`; remove the fallback after 24 h | None (admin sessions + signed file links keep working via fallback) |
| `JWT_SIGNING_KEY` | Set new value, `make deploy-up` | **Everyone is logged out** (web + app) and must OTP again — do it off-hours; announce if planned |
| `POSTGRES_PASSWORD` | `docker compose ... exec db psql -U kaamsathi -c "ALTER USER kaamsathi PASSWORD '<new>'"`, update env file, `make deploy-up` | Brief API restart |
| `REDIS_PASSWORD` | Update env file, `make deploy-up` (redis restarts; queued tasks in flight may be retried) | Seconds |
| SMS tokens | Regenerate at the gateway, update env, `make deploy-up` | None |
| S3 keys / backup keys | Create new key, update env, deploy, then delete old key | None |
| Partner API keys | Ops console → Partners → revoke + issue | Partner must update |
| `BACKUP_PASSPHRASE` | New backups use the new one — keep the old one until all old backups expire (14 days local, bucket lifecycle) | None |
| `FIELD_ENCRYPTION_KEYS` | Generate `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`, put it **first** (`new,old`), `make deploy-up`, then `docker compose ... exec backend python manage.py rotate_field_keys`; remove the old key only after the command reports 0 failures **and** every backup encrypted with the old key has expired | None (both keys decrypt during rotation). Losing every key = citizenship/NID/bank/PAN numbers and staff MFA secrets are unrecoverable |
| `FIELD_HASH_KEY` | Do **not** rotate routinely — every `*_hash` blind index (`citizenship_no_hash`, `nid_no_hash`, `pan_hash`, travel-document hashes) must be recomputed with the new key in a maintenance window (`manage.py maintenance read_only`) by a one-off re-index script; only on confirmed compromise | Duplicate-identity detection and identifier lookups are wrong until re-indexed |
| `METRICS_TOKEN` | Set new value in env + Prometheus `bearer_token`, `make deploy-up` | Scrape gap of one interval |
| Staff MFA (lost phone / staff exit) | Ops console → Staff → **Reset MFA** (superadmin; revokes all their sessions), or deactivate the account | Staff member re-enrols on next login |

Rotate immediately on suspicion of leak, staff departure with server access, or yearly.

## 7. SMS gateway failover (OTP login depends on it)

Symptoms: users report no OTP; `notifications_smsmessage` rows with `status=failed`; Sentry errors
from `apps.notifications`.
1. Confirm: `docker compose ... exec backend python manage.py shell -c "from apps.notifications.models import SMSMessage as S; print(S.objects.order_by('-created_at').values('status','backend','provider_response')[:10])"`.
2. Check the gateway status page / balance (Sparrow credit runs out silently).
3. Fail over: set `SMS_BACKEND=aakash` (and `AAKASH_SMS_TOKEN`) in the env file, `make deploy-up`.
   Order of preference: **sparrow → aakash**; `console` only on staging (prints codes to logs — never
   in production, users cannot log in).
4. When the primary recovers, switch back and note the window in the incident log.
5. Keep both accounts funded and sender IDs approved; top up when balance < 2 weeks of traffic.

## 8. Incident response

1. **Triage (5 min):** what is broken, since when, how many orgs/workers. Check `make deploy-ps`,
   `/api/v1/readiness`, Sentry, `make deploy-logs S=backend`, host disk (`df -h`) and memory.
2. **Severity:** SEV1 = login/attendance/payroll down for everyone or **any personal-data exposure**;
   SEV2 = one feature or one org; SEV3 = cosmetic.
3. **Mitigate first:** roll back (§3), fail over SMS (§7), restart a service
   (`docker compose ... restart celery-worker`), scale gunicorn (`GUNICORN_WORKERS`).
4. **Communicate:** SEV1 — notify affected employers (phone/SMS) within 1 hour; status every hour.
5. **Personal-data breach:** follow [SECURITY.md §6](SECURITY.md#6-breach-response) in parallel —
   preserve logs, rotate secrets, legal notification steps.
6. **Postmortem** within 5 working days: timeline, root cause, actions with owners.

Common issues:
* *Disk full* → `docker system prune` (images), check `backups` volume size and log rotation.
* *Celery backlog* → `docker compose ... exec celery-worker celery -A config inspect active`; raise `CELERY_CONCURRENCY`.
* *Certificates* → `make deploy-logs S=caddy`; DNS must point at the host; port 80 must be reachable for ACME.
* *Payroll run wrong* → never edit DB rows directly; recalculate drafts in the app; approved/paid runs need a
  correcting adjustment next month (keeps the audit trail).

## 9. Yearly reference-data checklist

Owner: ops lead + external adviser. Do it before the dates below and record the source document.

| When | Item | Where to change |
| --- | --- | --- |
| Shrawan 1 (mid-July) — new fiscal year | **Income-tax slabs** (Finance Act); SSF-related tax waiver of 1 % slab | Admin → Payroll → Tax slabs (add rows for the new `fiscal_year`; never edit past years) |
| When gazetted (every ~2 years, last 17 July 2025) | **Minimum wage** monthly basic / DA / daily / hourly | Admin → Hiring → Minimum wages (new row with `effective_from`) |
| Before Baisakh 1 (BS new year) | **National holidays** for the new BS year (Dashain, Tihar, Chhath, … dates move yearly) | Admin → Workforce → Holidays (organization empty = national) |
| When SSF circulars change | **SSF rules**: 11 % / 20 % rates, filing due days (`SSF_DUE_DAYS`), basic-salary definition | Settings/env + code review; update docs/CONTRACT.md |
| Yearly | Labour Act / Rules changes: leave entitlements, overtime rate, festival allowance | Code + contract template (compliance app); lawyer review |
| Yearly | Placement/subscription pricing (`PLACEMENT_FEE`, `SUBSCRIPTION_*`) | env file |
| Yearly | BS calendar data in `nepali-datetime` covers the next 2 years | `pip install -U nepali-datetime`, run tests |
| Yearly | Privacy policy / terms reviewed by a lawyer; retention periods still correct | web `/privacy`, `/terms`, SECURITY.md |

## 10. Scheduled jobs (Celery beat)

Defined in `config/settings/base.py` (`CELERY_BEAT_SCHEDULE`, Asia/Kathmandu). Check
`make deploy-logs S=celery-beat` after deploys. Notable: `apps.privacy.tasks.process_requests`
(03:00) purges expired data exports, deletes OTP rows older than 30 days and SMS logs older than
180 days, and re-queues stuck exports.

## 11. Security & platform operations (docs/CONTRACT-EXTENSIONS.md §1)

**Staff access.** `/ops` needs `is_staff` **and** a role (`verifier`, `support`, `finance_ops`,
`partner_manager`, `risk_analyst`, `superadmin`) — the URL-prefix map lives in
`backend/apps/accounts/staff_roles.py` (unlisted `/ops/*` routes are superadmin-only). Manage staff in
**Ops → Staff** (`/ops/staff`): add by phone, edit roles, deactivate (signs out every session), reset MFA.
In production a staff user without a `StaffProfile` has **no** roles; create the first superadmin with
`python manage.py shell -c "from apps.accounts.models import *; u=User.objects.get(phone='98…'); u.is_staff=True; u.save(); StaffProfile.objects.update_or_create(user=u, defaults={'roles':['superadmin']})"`.

**MFA.** `STAFF_MFA_REQUIRED=true` (prod default): staff get tokens but every `/ops` call returns 403
`mfa_required` until they enrol a TOTP app in **/ops/account** (QR + 10 single-use recovery codes, shown
once). Login then asks for the 6-digit code (or a recovery code) after the SMS OTP; 5 wrong codes lock
the MFA step for 15 minutes. Lost device → another superadmin uses **Reset MFA**.

**Sessions.** Every login creates a session (`/app/account`, `/ops/account`, mobile "Login & security");
users can revoke one device or all others. Revocation blacklists the refresh token and rejects the
session's access tokens immediately (revoked-session ids are cached for the access-token lifetime — a
Redis flush shortens that to "until the access token expires", max 30 min).

**Request IDs.** Every response carries `X-Request-ID` (also in `error.request_id`, JSON logs and the
Sentry tag `request_id`). Support asks the user for the id shown on the error screen and searches:
`make deploy-logs S=backend | grep <id>`.

**Idempotency.** Clients may send `Idempotency-Key` on payroll-run create, payouts create/submit, ops
shortlist, finance offer apply, member invite, employment create, privacy requests, partner referral
status and enterprise attendance bulk. Records live 24 h (`IDEMPOTENCY_TTL_HOURS`) and are purged nightly
(`apps.core.tasks.purge_idempotency_records`, 03:30).

**Uploads + ClamAV.** All uploads go through `apps/core/uploads.validate_upload` (magic bytes,
extension/content-type agreement, EXIF/GPS stripped, PDF scripts rejected). Optional virus scan: set
`COMPOSE_PROFILES=clamav` and `CLAMAV_HOST=clamav` in the env file, `make deploy-up` (first start
downloads signatures, ~5 min, ~1.5 GB RAM). Unreachable scanner = logged error and upload accepted unless
`CLAMAV_REQUIRED=true`. Test: upload the EICAR test string as `eicar.pdf` → "rejected by the virus scanner".

**Failed tasks.** Celery tasks retry 5× with exponential backoff + jitter; final failures appear in
**Ops → System** (`/ops/system`) with redacted arguments. *Retry* re-queues with the stored arguments
(disabled when arguments were redacted — re-run from the source screen); *Dismiss* after fixing the cause.
System health on the same page: DB, Redis, queue length, workers seen, beat heartbeat (stale after 15 min
→ `make deploy-logs S=celery-beat`), failed tasks and failed SMS in the last 24 h.

**Audit trail.** `audit_auditlog` is append-only (a Postgres trigger rejects UPDATE/DELETE) and
hash-chained. **Ops → Audit** (`/ops/audit`, superadmin) filters by actor/org/action/object/date;
*Verify chain* (`GET /api/v1/ops/audit/verify`) must return `ok: true` — anything else is a SEV1 integrity
incident (§12.2). Run it after every restore and monthly. Rolling back `audit.0002` drops the trigger.

**Maintenance mode.** `docker compose ... exec backend python manage.py maintenance read_only` (writes
return 503 `maintenance`, logins still work) · `full` (whole API 503 except health/readiness/metrics) ·
`off` · no argument shows the state. Takes effect on all workers at once (shared Redis), is audited, and
can be pinned across restarts with `MAINTENANCE_MODE` in the env file.

**Metrics + alerts.** `GET https://<API_DOMAIN>/api/v1/metrics` with `Authorization: Bearer <METRICS_TOKEN>`
(404 when unset). Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: kaamsathi
    scheme: https
    metrics_path: /api/v1/metrics
    bearer_token: "<METRICS_TOKEN>"     # or bearer_token_file
    scrape_interval: 30s
    static_configs:
      - targets: ["<API_DOMAIN>"]
rule_files: ["alerts.yml"]              # deploy/monitoring/alerts.yml
```

Counters are kept in Redis (shared by gunicorn workers and Celery), so they reset only when Redis data
is lost. Families: `http_requests_total`, `http_request_duration_seconds` (histogram per route group),
`celery_tasks_total`, `otp_requests_total`, `sms_messages_total`. Alerts in
`deploy/monitoring/alerts.yml`: API down, 5xx > 2 %, p95 > 2.5 s, OTP failures, Celery failures, beat
heartbeat missing, SMS failures > 20 %.

**Load smoke test.** `deploy/load/k6-smoke.js` ([k6](https://k6.io)): `k6 run deploy/load/k6-smoke.js`
(local) or `BASE_URL=https://<staging API>/api/v1 ACCESS_TOKEN=<test employer JWT> ORG_ID=<uuid> VUS=20
DURATION=5m k6 run deploy/load/k6-smoke.js`. GET-only; thresholds: < 1 % errors, p95 < 800 ms. Run it on
staging before each release that touches hot paths (attendance, payroll, ops lists); never with a real
user's token against production.

**Legal acceptance.** Current terms/privacy (and employer agreement for org owners) are versioned in
Admin → Accounts → Legal documents. Publishing a new version: add a row with the new `version`, untick
`is_current` on the old row and tick it on the new one (one current row per kind); every user is asked
to accept again on next use. Acceptances (user, version, time, IP, channel) are kept and audited.

## 12. Incident playbooks

Start every incident with §8 (triage, severity, comms). Note the time of every action in the incident log;
keep the request ids of affected calls.

### 12.1 Account takeover (worker, employer or staff)
1. **Contain:** in Django admin or ops, deactivate the user (`is_active=False`) — staff via **Ops →
   Staff** (deactivating revokes all their sessions). For a non-staff user:
   `manage.py shell -c "from apps.accounts.models import User; from apps.accounts import sessions; u=User.objects.get(phone='98…'); sessions.revoke_all(u)"`.
2. **Staff account:** **Reset MFA** as well; check whether the attacker changed roles or other staff
   (`/ops/audit?actor=<phone>` and `?action=staff.`).
3. **Scope:** `/ops/audit?actor=<phone>&from=<date>` for everything the account did (exports,
   verifications, payroll approvals, `worker.id_document.view`, `payroll.export.*`, `privacy.export.*`).
   Check `accounts_sessiondevice` for unknown IPs/devices and `accounts_phoneotp` for OTP bursts (SIM swap?).
4. **Repair:** revert changes through the normal endpoints (audit rows are never edited). If payroll or
   bank details changed, hold payouts (12.5).
5. **Recover:** confirm identity by phone/in person, re-activate, user logs in again (new OTP; staff re-enrol MFA).
6. Personal data accessed by the attacker → breach process (SECURITY.md §6).

### 12.2 Data leak / integrity incident
1. **Contain:** `manage.py maintenance read_only` (or `full`) if data is actively leaking through the API;
   revoke the leaking credential: partner key (**Ops → Partners → Keys → Revoke**), org API key (org
   settings → API keys → Revoke), staff account (12.1), bucket made private.
2. **Preserve evidence before rotating:** `docker compose ... logs > incident/`, `pg_dump -t audit_auditlog
   -t partners_partneraccesslog -t trust_profileview -t accounts_sessiondevice`, Caddy JSON logs.
3. **Integrity:** run **Verify chain** (`/ops/audit/verify`); `first_broken_id` ≠ null means the audit table
   was modified by someone with database-owner rights — treat the DB host as compromised, restore to a
   clean host from backup and compare.
4. **Rotate:** `DJANGO_SECRET_KEY` **without** fallback (kills every signed file link),
   `JWT_SIGNING_KEY` (logs everyone out), `FIELD_ENCRYPTION_KEYS` + `rotate_field_keys` if the DB or a
   backup leaked together with the env file, DB/Redis passwords, `METRICS_TOKEN` (§6).
5. **Assess + notify:** SECURITY.md §6 (72-hour notifications). Use the audit/access logs to list the
   affected workers and orgs.
6. `manage.py maintenance off` once contained and patched.

### 12.3 Service outage
1. `make deploy-ps`, `/api/v1/readiness`, **Ops → System** (DB, Redis, queue length, workers seen, beat).
2. API up but tasks stuck: queue length growing + workers 0 → `docker compose ... restart celery-worker`;
   beat heartbeat stale → `restart celery-beat`. Afterwards check **Failed tasks** and retry.
3. DB/Redis down or disk full (`df -h`): free space (old images `docker image prune`, old backups),
   restart the service; if data is damaged restore (§5).
4. Bad release: roll back (§3). During a long fix put the API in `maintenance read_only` so attendance
   isn't half-written; tell employers to note hajiri on paper and enter it later (bulk endpoint is
   idempotent per `client_uuid`).
5. SMS down = nobody can log in → §7.

### 12.4 Fraud campaign (fake workers, buddy punching, referral or offer abuse)
1. **Risk queue** (`/ops/risk`): filter by kind (`duplicate_identity`, `shared_bank_account`,
   `document_reuse`, `attendance_anomaly`, `velocity`) — confirm or dismiss with notes.
2. **Stop the flow:** deactivate the offending users/workers; revoke partner keys or org API keys involved;
   void pending referrals (**Ops → Finance → Referrals → Void**); pause shortlisting from an employer by
   rejecting its KYB in **Ops → Employers** (`POST /ops/employers/{id}/verify {status: rejected, note}`;
   shortlists require a verified employer).
3. **Scope:** `/ops/audit?actor=…` and `?organization=…`, the partner access log, attendance check-ins
   from the same coordinates.
4. Hold payouts for affected payroll runs (12.5). Rejected identities stay flagged — never delete rows.
5. If staff were involved: deactivate, reset MFA, review every `ops.*.verify` they did.

### 12.5 Payment / billing incident (wrong wages, duplicate or failed payouts, wrong invoice)
1. **Stop money moving:** cancel open payout batches (**Payroll → Payouts → Cancel**,
   `POST /org/payouts/{id}/cancel`); for provider batches already submitted, call the provider
   (eSewa/Khalti/bank) to stop the transfer; `maintenance read_only` if the bug is systemic.
2. **Duplicates:** creates/submits are idempotent per `Idempotency-Key` — check `core_idempotencyrecord`
   and `/ops/audit?action=payout.` for two `payout.submit` rows; reconcile with the bank result file
   (`/org/payouts/{id}/reconcile`).
3. **Wrong amounts:** payroll runs that are approved are locked; fix inputs (attendance, salary), create a
   correction in the next run or a manual payslip adjustment, and re-issue payslips (workers get SMS).
4. **Billing:** void/re-issue the charge in Admin → Billing; employers are informed by phone.
5. Note every manual money movement with the provider reference in the incident log and the audit trail
   (actions through the API are audited automatically).
