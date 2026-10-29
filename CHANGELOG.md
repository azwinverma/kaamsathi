# Changelog

All notable changes to KaamSathi. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/) once production releases are tagged (`v*` triggers the
production deploy, see docs/RUNBOOK.md → CI/CD). Architecture decisions: [docs/adr](docs/adr/README.md).

## [Unreleased]

### Added
- **Managed deploy path**: web on Vercel (`web/vercel.json`, region `sin1`) and backend on Railway,
  defined as code in `.railway/railway.ts` (api with pre-deploy migrations, Celery worker, single
  beat, Postgres 16, Redis, private media bucket). Walkthrough: `docs/deploy/RAILWAY_VERCEL.md`.
  Gunicorn binds `$PORT`. New `AWS_S3_ADDRESSING_STYLE` setting for virtual-hosted buckets.

- **Free deploy path** (`docs/deploy/VERCEL_FREE.md`): API on Vercel Hobby (`backend/vercel.json`,
  build step `scripts/vercel_build.py` migrates on production deploys only) with Neon, Upstash and
  Cloudflare R2. New `SERVERLESS` mode: Celery tasks run inline after commit (failures go to
  FailedTask, not the request); future-dated tasks become `DeferredTask` rows; the beat schedule is
  driven by `GET|POST /api/v1/internal/cron` (`CRON_SECRET`, `apps/core/cron.py`, `manage.py
  run_cron`), timed by cron-job.org, `.github/workflows/cron.yml` and a daily Vercel Cron.
  `DB_DISABLE_SERVER_SIDE_CURSORS` for pooled Postgres; `RELEASE` falls back to the Vercel commit.

- **Client analytics**: web `page_view` (route templates only: ids and person handles masked,
  `lib/telemetry-page.ts`), `otp_requested`, Bolau `search_performed` (never the free-text query),
  employer `onboarding_step`; mobile `lib/core/telemetry.dart` (release builds) sends `app_open`,
  screen views, `otp_requested`, `login_success` and Bolau search. Draft privacy policy discloses
  first-party usage statistics (en/ne).

- `MEDIA_STORAGE=database` (`apps/core/db_storage.py`, `StoredFile`): uploads kept in Postgres for
  hosts without a writable disk (Vercel free tier), same signed links; public logos via
  `PublicMediaView`. `manage.py export_db_media [--apply]` copies them to disk/S3 when moving to a
  VPS. The free deploy no longer needs Cloudflare R2.

### Changed
- Web: **light is the default theme** for everyone (no longer follows the OS dark setting); dark
  only when chosen with the toggle (remembered per browser).
- Backups refuse to run without `BACKUP_PASSPHRASE` (prod compose `:?` + `backup.sh`); dumps hold
  ID photos and personal data and are never written unencrypted.
- `docs/PRODUCTION_CHECKLIST.md` re-verified: stale "known gaps" moved to resolved; hosting added
  as a launch blocker. B007 (monochrome logo) marked done; it had shipped in `web/public/brand`.

### Fixed
- The web BFF now relays each user's IP to the API (`X-KaamSathi-Client-IP`, trusted only with the
  shared `BFF_PROXY_SECRET`; `apps/core/proxy_ip.py`). Previously, web OTP requests, logins and
  sessions were throttled and audited under the web server's address. `BFF_PROXY_SECRET` is now
  required in `deploy/.env.prod`.

- **Billing** (`apps/billing`): price plans (pilot, starter, growth, business, enterprise) with
  per-organization subscriptions; subscription charges priced from the org's plan (pilot keeps the
  phase-1 terms: Rs 150/active worker, minimum Rs 3,000, placement Rs 5,000).
- New charge kinds `verification_fee`, `training_commission`, `partner_referral_fee`; partner and
  training-provider revenue is billed to the partner (`Charge.payer_partner`) — workers are never billed
  (enforced by a database constraint).
- VAT invoices: monthly draft generation from unpaid charges (`manage.py generate_invoices`, task
  `apps.billing.tasks.generate_monthly_invoices`), gap-free numbering per BS fiscal year
  (`KS-2083/84-000123`, restarting each Shrawan 1), configurable `VAT_RATE` (13%), bilingual PDF,
  manual payment recording, credit notes, void; IRD CBMS adapter stub (disabled). Employer
  `/app/billing` shows invoices and the plan; ops console `/ops/billing`. All actions audited.
- **Product analytics** (`apps/telemetry`): first-party events with a no-PII property allowlist,
  `POST /telemetry/events` (batched, throttled), server-side `track()` for registration, onboarding,
  job published, stage changes, placement, first hajiri and payroll approval; ops funnels and weekly
  retention with k-anonymity 5 (`/ops/analytics`); 400-day purge task
  (`apps.telemetry.tasks.purge_old_events`); web `lib/telemetry.ts` batching helper.
- **CI/CD**: bandit, gitleaks, trivy (filesystem + images), CodeQL, validated OpenAPI schema artifact,
  Playwright E2E + axe accessibility job on the docker-compose stack; `deploy.yml` builds and pushes
  images to GHCR, deploys staging over SSH on `main` and production on `v*` tags behind a manual
  approval with automatic rollback.
- Playwright E2E suite (`web/e2e`, `pnpm e2e`): employer, ops and passport journeys plus axe scans.
- ADRs 0001–0010 and this changelog.
- Security, trust operations, worker growth, enterprise integrations, mobility and mobile work from
  `docs/CONTRACT-EXTENSIONS.md` (staff roles + MFA, sessions, idempotency, audit hash chain, uploads
  scanning, KYB, risk flags, support cases, external work history, worker interest, matching v2,
  timesheets, org API + webhooks, notification inbox + push, foreign-employment document vault,
  KPIs/heatmap/career) — checkpointed in `fbe62da`.

## 2026-10-07 — Encryption at rest and extension skeletons (`4be518e`)

### Added
- Field-level encryption for citizenship/NID/bank/PAN numbers with blind-index hashes and key
  rotation (`apps/core/crypto.py`); production refuses to run without keys.
- Organization KYB fields, worker preferred districts / service radius.
- Skeleton apps `risk`, `support`, `experience`, `timesheets`, `integrations`, `mobility` and
  `docs/CONTRACT-EXTENSIONS.md`.

## 2026-10-07 — Ecosystem and production hardening (`1e0adeb`)

### Added
- Phase 1 completion: profile-view log, verification levels and reliability score, disputes,
  worker→employer ratings, naike crews and referral rewards, privacy export/deletion.
- Phase 2: credentials and public Skill Passport, training and shortage engine, bilingual
  appointment letters, SSF filing, compliance score, contractors, payroll payouts (bank file + wallet
  adapters), shift roster, employer analytics.
- Phase 3: partner API with consent grants and access log, verified-earnings financial profile,
  partner offers and referrals (partners carry all lending), labour-market insights with k-anonymity.
- Production: private signed document URLs, `deploy/` stack (Caddy, backups, restore drill),
  RUNBOOK and SECURITY docs, Devanagari-shaped PDFs, Android release signing.

### Fixed
- Audit log client IP can no longer be spoofed through `X-Forwarded-For`.

## 2026-10-07 — Ecosystem pre-wiring (`3b0ad20`)

### Added
- Registered ecosystem app skeletons, navigation entries and `docs/CONTRACT-ECOSYSTEM.md`.

## 2026-10-07 — Phase 1: hire, manage, payroll, ops console (`cfc6648`)

### Added
- Django API, Next.js employer portal and ops console, Flutter supervisor/worker app per
  `docs/CONTRACT.md`: job openings and candidate pipeline, employments, hajiri (attendance), leave,
  peski (advances), BS-month payroll with SSF/TDS and payslips, ops verification and matching,
  placement and subscription charges.
- `seed_demo`, 187 backend tests, Docker/compose, Makefile and CI.
