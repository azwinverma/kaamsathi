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
