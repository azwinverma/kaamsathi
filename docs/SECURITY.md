# KaamSathi — Security and personal-data handling

KaamSathi processes personal data of Nepali workers and employers. The governing law is the
**Individual Privacy Act, 2075 (वैयक्तिक गोपनीयता सम्बन्धी ऐन, २०७५)** and its Regulations, plus the
Labour Act 2074, Contribution-Based Social Security Act 2074 and Income Tax Act 2058 for record
retention. This document is the engineering view; the public policy lives at `/privacy`
(draft — pending legal review). Operational steps are in [RUNBOOK.md](RUNBOOK.md).

## 1. Data classification

| Class | Examples | Storage | Who can see |
| --- | --- | --- | --- |
| **Restricted** | Citizenship / NID number, ID document photos (`id_front`, `id_back`), bank account / wallet numbers, SSF ID, payslips, privacy export bundles, partner API key hashes, OTP hashes | PostgreSQL; private media (signed links only) | Worker themself; ops staff; employer only for what employment needs (payslips/bank details of *their* employees) |
| **Confidential** | Name, phone, date of birth, address, photo, attendance with GPS, wages, ratings, disputes, consents, profile-view log | PostgreSQL; private media | Worker; employing org (scoped by `X-Org-Id` + role); ops staff; partners **only** with an active consent grant |
| **Internal** | Org settings, jobs, aggregated analytics (k ≥ 5) | PostgreSQL | Org members / ops |
| **Public** | Trades, districts, minimum wage, a worker's Skill Passport **only if the worker made it public** | — | Anyone |

Never put Restricted/Confidential data in logs, Sentry events (`send_default_pii=False`), analytics,
URLs (except short-lived signed file tokens), emails to third parties, or screenshots in tickets.

## 2. Who can see identity documents

Uploaded files are **never** publicly served. `MEDIA_URL` serves only `PUBLIC_MEDIA_PREFIXES`
(org logos); everything else is reachable only via `GET /api/v1/files/<token>`:

* Tokens are `django.core.signing` values (HMAC with `SECRET_KEY`) carrying the file name, the user
  they were issued to and an access rule; they expire after `FILE_URL_TTL_SECONDS` (10 min).
* Authorisation is checked when the link is issued **and again on download**
  (`apps/core/files.py`): user still active; for worker files the rule is re-evaluated; a replaced
  or deleted document invalidates old links; a request carrying a different user's JWT is refused.
* `id_front` / `id_back` (citizenship): **ops staff and the worker only.** Every download is written
  to the audit log (`worker.id_document.view`).
* `photo`: additionally members of an organisation that employs/employed the worker or to which
  the worker was shortlisted (application past `sourced`).
* Other apps' documents (credentials, contracts, exports) use `apps.core.files.signed_url` /
  `file_url` and may register a download re-check (`register_check`).
* With S3: the bucket must block all public access; objects are written without ACL and every
  storage URL is presigned (`AWS_QUERYSTRING_AUTH`), exports go to a separate `private/` location.
* Django admin shows file names, not working links — use the ops console to view documents.

## 3. Consent model

* `workers.Consent(worker, organization?, scope, granted, channel)` — append-only, latest row wins.
  Scopes: `data_processing` (required to use the platform), `profile_share` (full profile to a
  specific org), `history_share` (verified work history beyond the employing org).
* Sharing outside the employing org needs explicit, purpose-bound, time-limited (≤
  `PARTNER_GRANT_MAX_DAYS`), revocable consent (`partners.ConsentGrant`); every partner read is
  logged (`PartnerAccessLog`) and shown to the worker.
* Every view of a full worker profile is logged (`trust.ProfileView`) and visible to the worker
  (`GET /me/profile-views`). The worker viewing themself is not logged.
* We never sell data, never share for foreign recruitment, never show a "credit score".
* Workers never pay; no endpoint charges a worker.

## 4. Data-subject rights (privacy app, CONTRACT-ECOSYSTEM §11)

* **Export** — `POST /me/privacy-requests {kind: export}` → Celery builds a zip (JSON + PDF summary);
  downloadable for `PRIVACY_EXPORT_TTL_HOURS` (72 h), then purged nightly.
* **Correction** — routed to the ops dispute queue; ops corrects through the normal endpoints.
* **Deletion** — ops approves in `/ops/privacy`. The worker profile is anonymised (name →
  "Deleted worker", phone → keyed hash, ID/photo/certificate files deleted, skills, credentials,
  passport and financial profile removed, partner grants revoked, consents withdrawn, GPS removed
  from attendance, rating comments cleared, login account deactivated). **Kept** and linked to the
  anonymised record because employers must retain them by law: employments, attendance, leave,
  advances, payslips, payout items, consent history and access logs.
* Target: acknowledge within 7 days, complete within 30 days (confirm with counsel).

## 5. Retention

| Data | Retention |
| --- | --- |
| Payroll, payslips, attendance, employment records | As required by Labour Act / tax law (assume **≥ 7 years** after the fiscal year — confirm with counsel); kept anonymised after deletion requests |
| Worker profile & documents | Until deletion request, or 3 years of inactivity (review annually) |
| Privacy export bundles | 72 hours |
| OTP records | 30 days (`apps.privacy.tasks.process_requests`) |
| SMS logs (bodies; OTP codes are redacted) | 180 days (`SMS_LOG_RETENTION_DAYS`) |
| Audit log, profile-view log, partner access log | 5 years |
| Backups | 14 days local + bucket lifecycle (e.g. 90 days), encrypted with `BACKUP_PASSPHRASE` |
| Application logs | Docker log rotation (5 × 20 MB per container) / log platform 30 days |

## 6. Breach response

A personal-data breach is any unauthorised access, disclosure, loss or alteration — e.g. a leaked
backup, a public bucket, an ID photo reachable without auth, a stolen staff laptop with exports.

1. **Contain (hour 0–1):** revoke access (disable user, revoke partner keys, make bucket private),
   rotate secrets (RUNBOOK §6 — `SECRET_KEY` rotation invalidates all signed file links at once:
   set the new key **without** a fallback), take the affected feature offline if needed.
2. **Preserve evidence:** copy logs (`docker compose logs`, Caddy JSON logs, `audit_auditlog`,
   `trust_profileview`, `partners_partneraccesslog`) before rotation discards them.
3. **Assess (within 24 h):** what data classes, how many workers/orgs, which period, whether the
   data was actually accessed (audit/access logs).
4. **Notify:** the KaamSathi grievance/privacy officer and management immediately; legal counsel
   within 24 h to determine the regulator notification duty under the Privacy Act 2075 and its
   Regulations; affected workers by SMS in Nepali + English and affected employers by phone
   **within 72 hours** of confirmation (what happened, what data, what we did, what they should do,
   contact). Partners if their data flows were involved.
5. **Recover and review:** fix root cause, postmortem (RUNBOOK §8), update this document.

## 7. Platform controls (summary)

* TLS everywhere (Caddy, HSTS preload); Django `check --deploy` clean in CI; secure/HttpOnly cookies;
  CSP + security headers on the web; `X-Frame-Options: DENY`.
* Auth: phone OTP (5/phone/hour, `otp` throttle 30/hour/IP, 5 attempts per code), JWT 30 min access /
  30 days rotating refresh with blacklist; web keeps tokens in HttpOnly cookies behind a BFF proxy.
* Throttles: `anon` 120/min, `user` 600/min, `public` 60/min (Skill Passport), `files` 240/min,
  `privacy` 10/hour; `NUM_PROXIES=1` so limits apply per real client IP behind Caddy.
* Authorisation: org scoping by membership + role on every `/org/*` call; ops = `is_staff`;
  admin at a non-default path, staff only, password required; API schema staff-only in production.
* Containers run as non-root (except Caddy/Postgres/Redis entrypoints), `no-new-privileges`,
  backend/web with all capabilities dropped; only Caddy publishes ports.
* `seed_demo` refuses to run when `DEBUG=False`.
* Dependencies: `pip-audit` and `pnpm audit --prod` in CI (informational) — review weekly.

## 8. Open items before go-live

* Lawyer review of `/privacy`, `/terms`, the retention periods above and the contract template.
* Appoint and publish the grievance/privacy officer contact.
* Penetration test of auth, org scoping and file access.
* Confirm the hosting location/provider and a data-processing agreement with each processor
  (hosting, S3, SMS gateways, Sentry).
