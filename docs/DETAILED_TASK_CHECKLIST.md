# KaamSathi — Detailed Engineering Task Checklist

> **Product name.** This checklist was written for the generic reference design "Nepal Workforce OS"
> (`workforce_os` in the reference spec). The product built in this repo is **KaamSathi (कामसाथी)**
> and keeps that name; read every "Nepal Workforce OS" / `workforce_os` reference as KaamSathi.

Use this as the implementation tracker. Every task should be linked to an issue/ticket. Update it as
features complete; nothing is marked complete without its acceptance criteria passing.

Last audited: 2026-10-08, against branch `phase-1` (backend suite: **720 passed**; beat schedule:
19 entries, all registered as Celery tasks). Section BL (Bolau) added 2026-10-13 against `main`
(backend suite: **880 passed**; web 217 unit tests; Playwright 16/16 incl. axe).

**Legend**
- `- [x] … — ✅ <evidence>`: built, with code and (where it applies) a test that passes.
- `— 🟡 partial: …`: partly built; the note says what's missing.
- `— ⛔ by decision: …`: deliberately not built because of a strategy rule
  ([CONTRACT-ECOSYSTEM.md](CONTRACT-ECOSYSTEM.md) guiding rules, [CONTRACT-EXTENSIONS.md](CONTRACT-EXTENSIONS.md), [docs/adr/](adr/)).
- `— 🔴 needs owner: …`: needs a real-world input (lawyer, account, partner, human test).
- `— ❌ not built: …`: not started; no strategy decision against it.

Paths are relative to the repo root. `tests/…` means `backend/tests/…`.

## Summary

| Section | Items | ✅ Done | 🟡 Partial | ⛔ By decision | 🔴 Needs owner | ❌ Not built |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A. Repository & Foundation | 20 | 20 | 0 | 0 | 0 | 0 |
| B. Brand & Design System | 20 | 17 | 1 | 0 | 2 | 0 |
| C. Backend Core | 15 | 14 | 1 | 0 | 0 | 0 |
| D. Authentication & Security | 20 | 19 | 0 | 1 | 0 | 0 |
| E. Worker Identity & Passport | 15 | 14 | 1 | 0 | 0 | 0 |
| F. Skill Taxonomy | 10 | 9 | 1 | 0 | 0 | 0 |
| G. Credentials & Documents | 13 | 13 | 0 | 0 | 0 | 0 |
| H. Worker Experience | 5 | 5 | 0 | 0 | 0 | 0 |
| I. Employer Organization | 13 | 12 | 1 | 0 | 0 | 0 |
| J. Jobs & Recruitment | 11 | 9 | 0 | 2 | 0 | 0 |
| K. Matching | 12 | 12 | 0 | 0 | 0 | 0 |
| L. Applications / ATS | 13 | 12 | 0 | 1 | 0 | 0 |
| M. Placement | 9 | 9 | 0 | 0 | 0 | 0 |
| N. Reviews & Disputes | 8 | 8 | 0 | 0 | 0 | 0 |
| O. Shifts & Rostering | 7 | 7 | 0 | 0 | 0 | 0 |
| P. Attendance | 10 | 10 | 0 | 0 | 0 | 0 |
| Q. Timesheets | 6 | 6 | 0 | 0 | 0 | 0 |
| R. Payroll | 15 | 15 | 0 | 0 | 0 | 0 |
| S. Notifications | 9 | 9 | 0 | 0 | 0 | 0 |
| T. Training | 10 | 10 | 0 | 0 | 0 | 0 |
| U. Billing | 9 | 9 | 0 | 0 | 0 | 0 |
| V. Partner/Finance | 8 | 8 | 0 | 0 | 0 | 0 |
| W. Foreign Employment | 10 | 7 | 0 | 3 | 0 | 0 |
| X. Admin Console | 13 | 13 | 0 | 0 | 0 | 0 |
| Y. Analytics | 8 | 6 | 2 | 0 | 0 | 0 |
| Z. Production Readiness | 20 | 8 | 3 | 0 | 9 | 0 |
| BL. Bolau (Sipalu bookings) — ADR 0011 | 37 | 33 | 0 | 0 | 4 | 0 |
| **Total** | **346** | **314** | **10** | **7** | **15** | **0** |

Counts are taken from the item markers below. Z012, Z014 and Z016 are 🟡 partial items that also
need a staging host (🔴); they're counted as partial.

## A. Repository & Foundation
- [x] A001 Create monorepo or coordinated repositories for backend, worker app, employer web, admin web, infra, docs. — ✅ monorepo: `backend/`, `web/` (employer `/app` + ops console `/ops` + marketing), `mobile/` (worker + supervisor), `deploy/`, `docs/`
- [x] A002 Add README with local setup. — ✅ `README.md`, `backend/README.md`, `web/README.md`, `mobile/README.md`
- [x] A003 Add `.env.example` for every service. — ✅ `.env.example`, `web/.env.example`, `deploy/.env.prod.example` (mobile uses `--dart-define`, see `mobile/README.md`)
- [x] A004 Add pre-commit hooks. — ✅ `.pre-commit-config.yaml`: ruff + ruff-format, prettier (web), web message bundle check, `makemigrations --check`, gitleaks, EOF/whitespace/YAML/JSON, optional `dart format`; setup in `CONTRIBUTING.md`
- [x] A005 Add formatting/linting configs. — ✅ `backend/ruff.toml` (lint + format), `web/eslint.config.mjs`, `web/.prettierrc.json`, `mobile/analysis_options.yaml`; enforced in `.github/workflows/ci.yml`
- [x] A006 Add commit/branch conventions. — ✅ `CONTRIBUTING.md`: branch naming, Conventional Commits, PR checklist (contract, migrations, tests, permissions, audit, translations, privacy), SemVer release tags (`v*` → production, `docs/RUNBOOK.md` §13)
- [x] A007 Add architecture decision record folder. — ✅ `docs/adr/` (README + ADRs 0001–0010)
- [x] A008 Create development Docker Compose. — ✅ `docker-compose.yml`, `Makefile` (`make up`, `make seed`)
- [x] A009 Add PostgreSQL service. — ✅ `docker-compose.yml` `db` (postgres:16, port 5433)
- [x] A010 Add Redis service. — ✅ `docker-compose.yml` `redis` (port 6380)
- [x] A011 Add Celery worker. — ✅ `docker-compose.yml` `celery-worker`, `backend/config/celery.py`
- [x] A012 Add Celery beat. — ✅ `docker-compose.yml` `celery-beat` (DatabaseScheduler); schedule in `backend/config/settings/base.py` `CELERY_BEAT_SCHEDULE`
- [x] A013 Add local object storage emulator if desired. — ✅ MinIO in `docker-compose.yml` (profile `s3`, `minio-init` creates the buckets); usage in `CONTRIBUTING.md` "Local S3 with MinIO"
- [x] A014 Add health endpoints. — ✅ `/api/v1/health`, `/api/v1/readiness` (`backend/apps/core/views.py`) (+test `tests/test_production.py::test_readiness_checks_db_and_cache`, `tests/test_bs_reference.py::test_health`)
- [x] A015 Add request ID middleware. — ✅ `backend/apps/core/request_id.py` (+test `tests/test_security_platform.py::test_request_id_echoed_and_in_error_envelope`)
- [x] A016 Add structured JSON logging. — ✅ `backend/apps/core/logging.py`, `LOGGING` in `backend/config/settings/prod.py` (+test `tests/test_security_platform.py::test_log_records_get_request_id`)
- [x] A017 Configure error tracking. — ✅ Sentry in `backend/config/settings/prod.py` (`send_default_pii=False`); 🔴 the Sentry project and `SENTRY_DSN` still have to be created
- [x] A018 Configure metrics. — ✅ `/api/v1/metrics` (`backend/apps/core/metrics.py`), `deploy/monitoring/alerts.yml` (+test `tests/test_security_platform.py::test_metrics_auth_and_content`)
- [x] A019 Configure CI. — ✅ `.github/workflows/ci.yml` (backend, web, mobile, security, docker, e2e), `.github/workflows/codeql.yml`
- [x] A020 Configure staging deployment. — ✅ `.github/workflows/deploy.yml` (`main` → staging over SSH + `/readiness` smoke test); 🔴 the staging host and `STAGING_SSH_*` secrets don't exist yet, so the job no-ops for now

## B. Brand & Design System
- [x] B001 Confirm working product name. — ✅ KaamSathi / कामसाथी (`README.md`, `docs/GLOSSARY.md` `app.name`)
- [ ] B002 Trademark/domain availability research. — 🔴 needs owner: trademark search (Department of Industry) and domain registration
- [x] B003 Define brand story. — ✅ `docs/BRAND_GUIDELINES_V2.md` §1–3, `docs/BRAND_GUIDELINES.md` (mission/promise); written under the reference name, and they apply to KaamSathi
- [x] B004 Define brand values. — ✅ `docs/BRAND_GUIDELINES_V2.md` §2 (personality), `docs/BRAND_GUIDELINES.md` (personality)
- [x] B005 Create primary logo. — ✅ code-drawn logomark + wordmark `web/components/brand.tsx` (`Logo`, `LogoMark`), `web/public/icon.svg`, `mobile/assets/logo.png`; a designer-finished logo is optional
- [x] B006 Create icon-only logo. — ✅ `LogoMark` in `web/components/brand.tsx`, `web/app/apple-icon.tsx`, `web/public/icon.svg`
- [ ] B007 Create monochrome logo. — 🟡 partial: only the Android adaptive-icon monochrome layer exists (`mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`); there's no monochrome logo file for print or documents
- [x] B008 Create app icon. — ✅ Android adaptive icon (`mobile/android/app/src/main/res/mipmap-*`), iOS `AppIcon.appiconset`
- [x] B009 Define color tokens. — ✅ `docs/DESIGN.md` (Colour), `web/app/globals.css`, `mobile/lib/core/theme/tokens.dart`. ⚠ `docs/design-tokens.json` holds the reference palette (#2563EB + coral/yellow/teal), not the shipped KaamSathi palette (#2647C4 + crimson #DC2B4B)
- [x] B010 Define typography. — ✅ `docs/DESIGN.md` (Inter + Noto Sans Devanagari, scale), `mobile/assets/fonts/`
- [x] B011 Define spacing/radius/shadow tokens. — ✅ `docs/DESIGN.md` "Shape, space, elevation"
- [x] B012 Define icon style. — ✅ `docs/BRAND_GUIDELINES_V2.md` §13
- [x] B013 Define photography style. — ✅ `docs/BRAND_GUIDELINES_V2.md` §15
- [x] B014 Define illustration style. — ✅ `docs/BRAND_GUIDELINES_V2.md` §14
- [x] B015 Define worker-facing tone. — ✅ `docs/BRAND_GUIDELINES_V2.md` §20 "Worker-facing", `docs/GLOSSARY.md`
- [x] B016 Define employer-facing tone. — ✅ `docs/BRAND_GUIDELINES_V2.md` §20 "Employer-facing"
- [ ] B017 Build Figma components. — 🔴 needs owner: no Figma file; the components exist only in code (B018/B019)
- [x] B018 Build web component library. — ✅ `web/components/ui/` (button, card, dialog, table, field, pagination, …), `web/components/shared/`
- [x] B019 Build Flutter component library. — ✅ `mobile/lib/core/widgets/`, `mobile/lib/core/theme/` (+test `mobile/test/widgets/`)
- [x] B020 Add bilingual copy style guide. — ✅ `docs/GLOSSARY.md` (en/ne UI terms), `docs/BRAND_GUIDELINES_V2.md` §21; catalogue parity is CI-checked (`pnpm messages:check`)

## C. Backend Core
- [x] C001 Create Django project. — ✅ `backend/config/`, `backend/manage.py`
- [x] C002 Configure DRF. — ✅ `REST_FRAMEWORK` in `backend/config/settings/base.py`
- [x] C003 Configure environment settings split. — ✅ `backend/config/settings/{base,dev,prod,test}.py`
- [x] C004 Configure PostgreSQL. — ✅ `DATABASE_URL` (`CONN_MAX_AGE`, health checks) in `backend/config/settings/base.py`
- [x] C005 Configure Redis. — ✅ cache + broker (`REDIS_URL`, `CELERY_BROKER_URL`); readiness checks it (`tests/test_production.py`)
- [x] C006 Configure Celery. — ✅ `backend/config/celery.py`, `ReliableTask` default base `backend/apps/core/tasks.py` (+test `tests/test_security_platform.py::test_reliable_task_is_default_base`)
- [x] C007 Configure S3-compatible storage. — ✅ `STORAGES` + `django-storages` S3 option, separate private bucket (`backend/config/settings/base.py`); signed access in `backend/apps/core/files.py` (+test `tests/test_files.py`)
- [x] C008 Configure CORS/CSRF. — ✅ `CORS_*`/`CSRF_*` in settings; the web BFF checks `Origin`/`Sec-Fetch-Site` (`web/lib/server/origin.ts`, +test `web/lib/server/origin.test.ts`)
- [x] C009 Configure OpenAPI. — ✅ drf-spectacular `/api/schema/`, `/api/docs/` (staff-only in prod; `tests/test_production.py::test_api_docs_staff_only_when_not_debug`); CI validates and publishes the schema
- [x] C010 Add standard API error schema. — ✅ `backend/apps/core/exceptions.py` envelope with `request_id` (+test `tests/test_auth_permissions.py::test_validation_envelope_fields`, `tests/test_i18n.py`)
- [x] C011 Add pagination standard. — ✅ page-number `backend/apps/core/pagination.py` (deliberately not cursor: [ADR 0002](adr/0002-page-number-pagination-over-cursor-pagination.md))
- [ ] C012 Add common timestamp/base models. — 🟡 partial: every model has `created_at`/`updated_at` fields, but there's no shared abstract base model
- [x] C013 Add UUID public identifiers. — ✅ `UUIDField(primary_key=True)` on all domain models (`backend/apps/*/models.py`)
- [x] C014 Add audit event helper. — ✅ `backend/apps/audit/services.py::log` (hash-chained, append-only) (+test `tests/test_security_platform.py::test_audit_chain_links_and_verifies`)
- [x] C015 Add feature flag service abstraction. — ✅ `apps/core/flags.py` `is_enabled(key, organization, user)` over `core.FeatureFlag` (rollout all/orgs/percent) with settings fallback (`KYB_REQUIRED_FOR_SHORTLIST`, `IRD_CBMS_ENABLED`, `TELEMETRY_ENABLED`, `PAYOUT_PROVIDERS`, `KYC_FOUR_EYES`); `GET /flags` for clients; `tests/test_platform_controls.py`

## D. Authentication & Security
- [x] D001 User model. — ✅ `backend/apps/accounts/models.py::User` (phone-based)
- [x] D002 Phone normalization. — ✅ `backend/apps/core/phone.py` (+test `tests/test_auth_permissions.py::test_otp_phone_normalised_and_validated`)
- [x] D003 OTP request endpoint. — ✅ `POST /auth/otp/request` (`backend/apps/accounts/views.py`, `otp.py`) (+test `tests/test_auth_permissions.py::test_otp_request_and_verify_creates_user`)
- [x] D004 OTP verification endpoint. — ✅ `POST /auth/otp/verify` (+test `tests/test_auth_permissions.py::test_otp_expired`)
- [x] D005 OTP cooldown. — ✅ server-side 30 s resend cooldown per phone (`OTP_RESEND_COOLDOWN_SECONDS`) + 5/hour limit, 429 `otp_rate_limited` with `error.retry_after` and `Retry-After` (`apps/accounts/otp.py`, `tests/test_platform_controls.py::test_otp_resend_cooldown_30_seconds`); clients keep their 30 s timer
- [x] D006 OTP brute force limits. — ✅ attempt limit + `otp` throttle scope (+test `tests/test_auth_permissions.py::test_otp_wrong_code_and_attempt_limit`)
- [x] D007 JWT access token. — ✅ simplejwt (`JWT_SIGNING_KEY`) (+test `tests/test_auth_permissions.py::test_refresh_and_logout`)
- [x] D008 Refresh token rotation. — ✅ (+test `tests/test_security_mfa.py::test_refresh_rotation_updates_session_and_revoke_others`)
- [x] D009 Refresh token revocation. — ✅ blacklist on logout or session revoke (+test `tests/test_security_mfa.py::test_logout_revokes_session`)
- [x] D010 Session/device model. — ✅ `SessionDevice` `backend/apps/accounts/sessions.py` (+test `tests/test_security_mfa.py::test_sessions_list_and_revoke`)
- [x] D011 Logout device. — ✅ `DELETE /auth/sessions/{id}` (+test `tests/test_security_mfa.py::test_cannot_revoke_someone_elses_session`)
- [x] D012 Logout all devices. — ✅ `POST /auth/sessions/revoke-others` + logout (+test `tests/test_security_mfa.py::test_refresh_rotation_updates_session_and_revoke_others`); UI `web/app/app/account`, `mobile/lib/features/common/security/`
- [ ] D013 Password support for employer/admin if needed. — ⛔ by decision: login is OTP for everyone plus TOTP MFA for staff; only Django admin uses a password (kept to 2 named superusers)
- [x] D014 TOTP MFA. — ✅ `backend/apps/accounts/mfa.py` (RFC 6238) (+test `tests/test_security_mfa.py::test_totp_rfc6238_sha1_vectors`, `test_mfa_required_gate_blocks_ops_until_enrolled`)
- [x] D015 Recovery codes. — ✅ hashed, single use (+test `tests/test_security_mfa.py::test_recovery_code_is_single_use`)
- [x] D016 Role model. — ✅ `orgs.Membership.role` (owner/admin/hr/supervisor), `accounts.StaffProfile.roles`
- [x] D017 Permission model. — ✅ code-defined: `backend/apps/core/permissions.py`, `backend/apps/accounts/staff_roles.py::ROUTE_ROLES` (+test `tests/test_security_mfa.py::test_route_role_map`)
- [x] D018 Platform roles. — ✅ verifier/support/finance_ops/partner_manager/risk_analyst/superadmin (+test `tests/test_security_mfa.py::test_role_enforced_on_real_endpoints`); UI `web/app/ops/staff`
- [x] D019 Employer roles. — ✅ (+test `tests/test_auth_permissions.py::test_members_create_owner_admin_only`, `test_supervisor_limited_to_own_sites`)
- [x] D020 Object-level organization scoping tests. — ✅ `tests/test_security_idor.py`, `tests/test_auth_permissions.py::test_org_data_is_scoped`

## E. Worker Identity & Passport
- [x] E001 Worker profile model. — ✅ `backend/apps/workers/models.py::Worker` (encrypted IDs)
- [x] E002 Worker address. — ✅ `permanent_district`, `current_district`, `address` on `Worker`
- [ ] E003 Province/district/local-level lookup data. — 🟡 partial: provinces + 77 districts seeded (`backend/apps/geo/`, `seed_reference`, `/ref/provinces`, `/ref/districts`); local levels (municipality/ward) are free text with no lookup table
- [x] E004 Language list. — ✅ `workers.WorkerLanguage` via `/me/worker` + ops edit (+test `tests/test_profile_ext.py::test_me_worker_languages_roundtrip_and_completeness`, `::test_language_validation`)
- [x] E005 Availability model. — ✅ `Worker.is_available`, `available_from` (+test `tests/test_interest.py::test_me_worker_preferences`); mobile `mobile/lib/features/worker/preferences/availability_screen.dart`
- [x] E006 Wage expectation model. — ✅ `Worker.expected_monthly_wage` (used in matching) (+test `tests/test_interest.py::test_me_worker_preferences`)
- [x] E007 Preferred work locations. — ✅ `Worker.preferred_districts`, `service_radius_km` (+test `tests/test_matching_v2.py::test_preferred_district_bonus`)
- [x] E008 Profile completion logic. — ✅ `profile_completeness` on `/me/worker` + ops detail (+test `tests/test_profile_ext.py::test_profile_completeness_full`, `::test_payment_details_rules`)
- [x] E009 Unique worker ID generation. — ✅ UUID PK + Skill Passport `public_code` (`backend/apps/credentials/models.py::Passport`)
- [x] E010 Public worker slug. — ✅ `Passport.public_code` → `/p/[code]` (`web/app/p/[code]`), private by default (+test `tests/test_passport.py::test_public_passport_only_when_public`)
- [x] E011 Public/private field rules. — ✅ (+test `tests/test_passport.py::test_payload_is_verified_only_and_contact_hidden`, `tests/test_files.py::test_employer_member_gets_photo_of_employee_but_never_id`)
- [x] E012 QR identity generation. — ✅ passport QR SVG (+test `tests/test_passport.py::test_public_qr_svg`)
- [x] E013 Worker profile API. — ✅ `GET|PATCH /me/worker` (`backend/apps/workers/me_views.py`) (+test `tests/test_interest.py::test_me_worker_preferences`)
- [x] E014 Worker public profile API. — ✅ public passport + share links (+test `tests/test_passport.py::test_share_lifecycle`)
- [x] E015 Worker Passport PDF later. — ✅ `backend/apps/credentials/pdf.py` (+test `tests/test_passport.py::test_passport_pdf`)

## F. Skill Taxonomy
- [x] F001 Skill category model. — ✅ as an enum: `Trade.CATEGORIES` (`backend/apps/workers/models.py`)
- [x] F002 Occupation model. — ✅ `workers.Trade` (code, name_en, name_ne, category, is_active)
- [ ] F003 Skill model. — 🟡 partial: one level only; `Trade` stands for both occupation and skill, with no finer sub-skills
- [x] F004 Skill aliases. — ✅ `workers.TradeAlias` + ops alias CRUD, alias-aware search (+test `tests/test_profile_ext.py::test_ops_taxonomy_aliases_crud_and_search`, `::test_job_search_matches_alias`)
- [x] F005 Skill levels. — ✅ `WorkerSkill.nstb_level`, `years_experience`; credential `level`
- [x] F006 WorkerSkill model. — ✅ `backend/apps/workers/models.py::WorkerSkill`
- [x] F007 Evidence attachment. — ✅ credential document upload (private, validated) (+test `tests/test_credentials.py::test_worker_uploads_credential_with_document`)
- [x] F008 Verification state. — ✅ credential pending/verified/rejected/expired; declared NSTB not shown until verified (+test `tests/test_passport.py::test_unverified_identity_and_declared_nstb_not_shown`)
- [x] F009 Admin taxonomy CRUD. — ✅ `/ops/taxonomy/trades` (+test `tests/test_taxonomy.py`); UI `web/app/ops/taxonomy`
- [x] F010 Seed initial trades. — ✅ `backend/apps/core/reference_data.py::TRADES` via `manage.py seed_reference`

## G. Credentials & Documents
- [x] G001 Document type model. — ✅ as enums: `Credential.KINDS`, `TravelDocument`/`ClearanceDocument` kinds
- [x] G002 Private upload endpoint. — ✅ private storage (`backend/apps/core/files.py`) (+test `tests/test_files.py::test_media_is_not_served_publicly`)
- [x] G003 MIME/type validation. — ✅ magic-byte sniff `backend/apps/core/uploads.py::validate_upload` (+test `tests/test_security_uploads.py::test_fake_extension_rejected`)
- [x] G004 File size limits. — ✅ (+test `tests/test_security_uploads.py::test_kind_not_allowed_and_size_cap`); Caddy caps bodies at 12 MB
- [x] G005 Malware scanning integration. — ✅ ClamAV INSTREAM (`backend/apps/core/uploads.py`, optional `clamav` profile in `deploy/docker-compose.prod.yml`) (+test `tests/test_security_uploads.py::test_clamav_instream_infected_and_clean`)
- [x] G006 Signed URL access. — ✅ `backend/apps/core/files.py` (+test `tests/test_files.py::test_token_expires`)
- [x] G007 Credential model. — ✅ `backend/apps/credentials/models.py::Credential`
- [x] G008 Issuer. — ✅ `Credential.issuer`
- [x] G009 Issue date. — ✅ `Credential.issued_on`
- [x] G010 Expiry date. — ✅ `Credential.expires_on` (+test `tests/test_credentials.py::test_verify_already_expired_certificate_marks_expired`)
- [x] G011 Verification queue. — ✅ `/ops/credentials` (+test `tests/test_credentials.py::test_ops_verify_flow_and_trust_recompute`); UI `web/app/ops/credentials`
- [x] G012 Rejection/resubmit flow. — ✅ `Credential.resubmission_of` + `POST /me/credentials/{id}/resubmit` (+test `tests/test_trust_ext.py::test_credential_resubmission`)
- [x] G013 Expiry notification job. — ✅ `apps.credentials.tasks.expiry_reminders` (+test `tests/test_credentials.py::test_expiry_task_marks_expired_and_sends_reminders`)

## H. Worker Experience
- [x] H001 Experience claim model. — ✅ `backend/apps/experience/models.py::WorkHistoryEntry` (+test `tests/test_experience.py`)
- [x] H002 Employer reference request. — ✅ reference name/phone (encrypted) → `reference_pending` (+test `tests/test_experience.py::test_create_with_reference_is_pending_and_phone_encrypted`)
- [x] H003 Reference confirmation link/workflow. — ✅ ops reference-call verify + on-platform employer confirm/reject (+test `tests/test_experience.py::test_employer_confirm_flow`, `test_ops_verify_flow`); SOP `docs/ops/work-history-reference-checks.md`. No public tokenised link for off-platform referees
- [x] H004 Verified/unverified distinction. — ✅ statuses + passport `work.external` shows only verified entries (+test `tests/test_experience.py::test_passport_work_external`)
- [x] H005 Experience timeline. — ✅ `mobile/lib/features/worker/experience/ui/work_history_screen.dart`, `mobile/lib/features/worker/profile/ui/history_screen.dart`, passport work summary (+test `tests/test_passport.py::test_work_summary`)

## I. Employer Organization
- [x] I001 Organization model. — ✅ `backend/apps/orgs/models.py::Organization`
- [x] I002 Industry taxonomy. — ✅ as an enum: `labels.INDUSTRY` (`backend/apps/core/labels.py`)
- [x] I003 Organization onboarding. — ✅ `web/app/onboarding` (+test `tests/test_auth_permissions.py::test_create_org_makes_caller_owner`)
- [x] I004 Legal registration fields. — ✅ `pan_no` (encrypted), `registration_no`, `vat_registered`, `ssf_employer_no`
- [x] I005 Organization documents. — ✅ `registration_doc`, `pan_doc` (private) (+test `tests/test_kyb.py::test_signed_doc_url_downloads_for_owner_only`)
- [x] I006 Verification workflow. — ✅ KYB `backend/apps/orgs/kyb.py`, `kyb_views.py` (+test `tests/test_kyb.py`); UI `web/app/app/verification`, `web/app/ops/employers`; SOP `docs/ops/employer-verification-kyb.md`
- [x] I007 Organization member model. — ✅ `orgs.Membership`
- [x] I008 Invite member. — ✅ owner/admin add members by phone (+test `tests/test_auth_permissions.py::test_members_create_owner_admin_only`); idempotent
- [x] I009 Assign organization roles. — ✅ (+test `tests/test_auth_permissions.py::test_cannot_remove_last_owner`)
- [ ] I010 Branch model. — 🟡 partial: `Site` serves as branch and worksite; no separate branch tier
- [x] I011 Worksite model. — ✅ `orgs.Site`
- [x] I012 Site managers. — ✅ supervisor `Membership.sites` (+test `tests/test_auth_permissions.py::test_supervisor_limited_to_own_sites`)
- [x] I013 Site geofence settings. — ✅ `Site.lat/lng/geofence_radius_m` (+test `tests/test_attendance.py::test_geofence_helper`)

## J. Jobs & Recruitment
- [x] J001 Job requisition model. — ✅ `backend/apps/hiring/models.py::JobOpening`
- [x] J002 Job skills requirements. — ✅ `hiring.JobRequirement` used in matching (+test `tests/test_hiring_ext.py::test_job_form_requirements_roundtrip`, `::test_requirements_in_matching`)
- [x] J003 Compensation model. — ✅ `wage_type`/`wage_amount` with the minimum-wage check (+test `tests/test_hiring.py::test_job_minimum_wage`)
- [x] J004 Shift requirement. — ✅ `JobOpening.shift`
- [x] J005 Benefits fields. — ✅ `food_provided`, `accommodation_provided`
- [x] J006 Draft/published/paused/closed lifecycle. — ✅ `paused` status with pause/resume (+test `tests/test_hiring_ext.py::test_pause_resume_and_effects`)
- [x] J007 Publish permissions. — ✅ org roles + KYB (unverified employers' jobs aren't recommended or alerted) (+test `tests/test_offers_alerts.py::test_unverified_employer_publish_sends_nothing`)
- [x] J008 Job listing API. — ✅ `/org/jobs`, `/ops/jobs`, worker `/me/jobs/recommended` (+test `tests/test_interest.py::test_recommended_filters`); no public listing ([ADR 0003](adr/0003-no-public-job-board-in-phase-1.md))
- [ ] J009 Worker job search. — ⛔ by decision: no public job board or open search in phase 1; workers get recommended jobs + job alerts instead ([ADR 0003](adr/0003-no-public-job-board-in-phase-1.md))
- [ ] J010 Saved jobs. — ⛔ by decision: replaced by "I'm interested" + job alerts (`JobAlert`, `tests/test_offers_alerts.py::test_alert_crud`) ([ADR 0003](adr/0003-no-public-job-board-in-phase-1.md))
- [x] J011 Employer job dashboard. — ✅ `web/app/app/jobs`, `web/app/app/jobs/[id]`

## K. Matching
- [x] K001 Match scoring config. — ✅ `MatchConfig` ops editor, superadmin (+test `tests/test_hiring_ext.py::test_match_config_editor`, `::test_default_weights_match_v2_constants`)
- [x] K002 Hard filters. — ✅ available, not already employed by the org, not in the visible pipeline, verified employers only (`job_matches`, `recommended_jobs`) (+test `tests/test_ops_matching.py::test_matches_endpoint_filters_and_orders`)
- [x] K003 Required skill score. — ✅ trade +50 (+test `tests/test_ops_matching.py::test_match_score_formula`)
- [x] K004 Experience score. — ✅ +1/yr up to 10, plus outcome bonus (+test `tests/test_matching_v2.py::test_outcome_bonus`)
- [x] K005 Location score. — ✅ same district +20, preferred district +5 (+test `tests/test_matching_v2.py::test_preferred_district_bonus`)
- [x] K006 Availability score. — ✅ as a hard filter (`is_available`); not a graded score
- [x] K007 Credential score. — ✅ verified +10, NSTB level 5/level, reliability bonus (+test `tests/test_trust.py::test_match_score_reliability_bonus`)
- [x] K008 Wage score. — ✅ −10 when expectation > offer (`match_explain`)
- [x] K009 Explainability output. — ✅ `explain` + `reasons` (+test `tests/test_matching_v2.py::test_explain_sums_to_score`, `test_matches_endpoint_has_explain`)
- [x] K010 Persist scored candidates. — ✅ `MatchRun`/`MatchCandidate` persisted per matches call (+test `tests/test_hiring_ext.py::test_matches_persist_runs_and_reuse`)
- [x] K011 Recompute job. — ✅ `?refresh=1` recompute + reuse window; nightly trust refresh (+test `tests/test_hiring_ext.py::test_matches_persist_runs_and_reuse`)
- [x] K012 Version algorithm. — ✅ `algorithm_version` on runs and shortlisted applications (+test `tests/test_hiring_ext.py::test_shortlist_records_score_and_version`)

## L. Applications / ATS
- [x] L001 JobApplication model. — ✅ `hiring.Application` (stage, source, worker_response)
- [x] L002 Apply endpoint. — ✅ as worker interest `POST /me/jobs/{id}/interest`, hidden from the employer until ops shortlists (+test `tests/test_interest.py::test_interest_hidden_from_employer_until_shortlist`); no open apply ([ADR 0003](adr/0003-no-public-job-board-in-phase-1.md))
- [x] L003 Withdraw endpoint. — ✅ (+test `tests/test_interest.py::test_withdraw_own_interest`, `test_respond_declined_drops`)
- [x] L004 Invitation model. — ✅ `POST /org/jobs/{id}/invite` (past worker or passport share) (+test `tests/test_hiring_ext.py::test_invite_past_worker`, `::test_invite_via_passport_share`, `::test_invite_kyb_gate_and_paused`)
- [ ] L005 Employer invite. — ⛔ by decision: employers don't contact workers directly in phase 1; ops curates the shortlist ([ADR 0003](adr/0003-no-public-job-board-in-phase-1.md), [ADR 0004](adr/0004-kyb-gate-before-shortlisting.md))
- [x] L006 Status history. — ✅ `hiring.StageEvent` (+test `tests/test_hiring.py::test_shortlisted_shows_profile_and_events`)
- [x] L007 Applicant notes. — ✅ `Application.notes`, `rejection_reason`
- [x] L008 Tags. — ✅ application `tags` + `/org/application-tags` (+test `tests/test_hiring_ext.py::test_tags_and_assignee`, `::test_tags_cross_org_and_supervisor`)
- [x] L009 Recruiter assignment. — ✅ `Application.assignee` + `JobOpening.ops_owner` (+test `tests/test_hiring_ext.py::test_tags_and_assignee`, `::test_ops_job_owner`)
- [x] L010 Interview model. — ✅ `hiring.Interview` rounds (+test `tests/test_hiring_ext.py::test_interviews_lifecycle`, `::test_interview_reminder_task_skips_rescheduled`)
- [x] L011 Interview schedule. — ✅ `interview_at` + SMS/inbox reminder `apps.notifications.tasks.interview_reminder`
- [x] L012 Offer model. — ✅ `hiring.JobOffer` (+test `tests/test_offers_alerts.py::test_offer_requires_selected_and_min_wage`)
- [x] L013 Offer accept/decline. — ✅ (+test `tests/test_offers_alerts.py::test_offer_lifecycle_accept_and_join_prefill`, `test_decline_withdraw_and_expiry`); mobile `mobile/lib/features/worker/jobs/ui/offers.dart`

## M. Placement
- [x] M001 Placement model. — ✅ `workforce.Employment` (linked to `Application`, placement `billing.Charge`) (+test `tests/test_hiring.py::test_join_creates_employment_charge_and_fills_job`)
- [x] M002 Create from accepted offer. — ✅ (+test `tests/test_offers_alerts.py::test_offer_lifecycle_accept_and_join_prefill`)
- [x] M003 Site assignment. — ✅ `Employment.site`
- [x] M004 Supervisor. — ✅ `Employment.supervisor`
- [x] M005 Pay terms snapshot. — ✅ wage terms copied onto `Employment` at join; contract versions in `compliance.EmploymentContract` (+test `tests/test_compliance.py::test_contract_versioning_and_pdf`)
- [x] M006 Start/end lifecycle. — ✅ `start_date`/`end_date`/`status` (+test `tests/test_hiring.py::test_one_active_employment_per_org`)
- [x] M007 Placement termination reasons. — ✅ `labels.END_REASON`; replacement window (+test `tests/test_hiring.py::test_replacement_within_window_is_waived`)
- [x] M008 Auto-create verified experience. — ✅ on-platform employment counts as verified work after 30 worked days (+test `tests/test_trust.py::test_employment_verified_by_30_worked_days`, `tests/test_passport.py::test_work_summary`)
- [x] M009 Placement documents. — ✅ employment contract PDF + worker e-acceptance (+test `tests/test_compliance.py::test_worker_accepts_latest_contract`)

## N. Reviews & Disputes
- [x] N001 Review eligibility. — ✅ (+test `tests/test_trust.py::test_worker_rates_employer_rules`)
- [x] N002 Worker review of employer. — ✅ (+test `tests/test_trust.py::test_worker_rates_employer_rules`, `test_employer_reputation_needs_three_ratings`); mobile `rate_employer_sheet.dart`
- [x] N003 Employer review of worker. — ✅ `POST /org/employments/{id}/rate` (+test `tests/test_trust_ext.py::test_employer_rates_worker`, `::test_employer_rate_permissions`)
- [x] N004 Review moderation. — ✅ rating flag/hide/void moderation (+test `tests/test_trust_ext.py::test_worker_flags_employer_comment_and_ops_hides`, `::test_ops_void_excludes_rating_from_scores`)
- [x] N005 Dispute creation. — ✅ `trust.Dispute` (+test `tests/test_trust.py::test_worker_raises_dispute`)
- [x] N006 Evidence upload. — ✅ `trust.DisputeEvidence` with signed URLs (+test `tests/test_trust_ext.py::test_evidence_upload_and_access`, `::test_evidence_isolation`)
- [x] N007 Admin decision. — ✅ ops resolve/reject with note + SLA (+test `tests/test_trust.py::test_dispute_role_permissions`, `tests/test_support.py::test_dispute_sla_moves_with_status`); UI `web/app/ops/disputes`
- [x] N008 Appeal state. — ✅ `appealed`/`appeal_resolved`, second staff member decides (+test `tests/test_trust_ext.py::test_worker_appeal_and_second_staff_decides`, `::test_employer_appeal_and_deadline`)

## O. Shifts & Rostering
- [x] O001 Shift template. — ✅ `orgs.Shift`
- [x] O002 Shift instance. — ✅ `scheduling.RosterEntry` (employment × date × shift)
- [x] O003 Roster. — ✅ `/org/roster` (+test `tests/test_scheduling.py::test_roster_grid_and_upsert`); UI `web/app/app/roster`, mobile `roster_week_screen.dart`
- [x] O004 Worker assignment. — ✅ (+test `tests/test_scheduling.py::test_roster_validation`, `test_me_roster`)
- [x] O005 Conflict detection. — ✅ roster warnings incl. anonymous cross-org conflict (+test `tests/test_workforce_ext.py::test_roster_warns_on_leave_and_holiday`, `::test_roster_conflict_elsewhere_is_anonymous`)
- [x] O006 Copy schedule. — ✅ (+test `tests/test_scheduling.py::test_copy_week`)
- [x] O007 Shift notification. — ✅ `roster_changed` notification per save batch (+test `tests/test_workforce_ext.py::test_roster_change_notifies_worker_once_per_batch`)

## P. Attendance
- [x] P001 Check-in endpoint. — ✅ (+test `tests/test_attendance.py::test_check_in_inside_geofence`)
- [x] P002 Check-out endpoint. — ✅ (+test `tests/test_attendance.py::test_check_out_requires_check_in`)
- [x] P003 QR validation. — ✅ site `qr_token` QR self check-in (+test `tests/test_attendance.py::test_check_in_unknown_site_or_not_employed`); mobile `mobile/lib/features/worker/checkin/`
- [x] P004 GPS validation. — ✅ (+test `tests/test_attendance.py::test_check_in_outside_geofence`)
- [x] P005 Geofence settings. — ✅ `Site.geofence_radius_m`; anomaly detection (+test `tests/test_risk.py::test_outside_geofence_three_times_in_a_week`)
- [x] P006 Offline event ingestion. — ✅ `client_uuid` bulk upsert (+test `tests/test_attendance.py::test_bulk_saves_and_is_idempotent`); mobile offline queue `mobile/lib/features/supervisor/hajiri/data/attendance_queue.dart`
- [x] P007 Duplicate protection. — ✅ (+test `tests/test_attendance.py::test_bulk_client_uuid_reused_for_other_day_is_duplicate`)
- [x] P008 Correction request. — ✅ `AttendanceCorrection` (apps/timesheets) worker request → manager approve, payroll lock respected (+test `tests/test_workforce_ext.py::test_correction_request_and_approval`, `::test_correction_respects_payroll_lock`)
- [x] P009 Manager approval. — ✅ weekly timesheet approval (+test `tests/test_timesheets.py::test_approve_reject_and_bulk`); payroll approval locks attendance (`tests/test_attendance.py::test_approve_via_api_locks_attendance`)
- [x] P010 Attendance dashboard. — ✅ `web/app/app/attendance` (+test `tests/test_attendance.py::test_attendance_day_and_register`)

## Q. Timesheets
- [x] Q001 Timesheet generation. — ✅ `backend/apps/timesheets/services.py` (+test `tests/test_timesheets.py::test_generation_math`)
- [x] Q002 Entry model. — ✅ `Timesheet.days` per-day entries (+test `tests/test_timesheets.py::test_generation_respects_policy_and_employment_window`)
- [x] Q003 Overtime entry. — ✅ claimed/approved OT, weekly cap flag (+test `tests/test_timesheets.py::test_over_cap_flag`)
- [x] Q004 Manager adjustment. — ✅ `overtime_minutes_approved` on approval (+test `tests/test_timesheets.py::test_payroll_uses_approved_ot_prorated`)
- [x] Q005 Approval workflow. — ✅ draft → submitted → approved/rejected, bulk approve (+test `tests/test_timesheets.py::test_approve_reject_and_bulk`); UI `web/app/app/timesheets`, mobile supervisor `timesheets_screen.dart`
- [x] Q006 Locking. — ✅ approved timesheets are never regenerated (+test `tests/test_timesheets.py::test_generate_refreshes_drafts_but_never_approved`); attendance locks after payroll approval

## R. Payroll
- [x] R001 Pay groups. — ✅ `payroll.PayGroup` (sites / wage types / contractors, pay day), `/org/pay-groups` CRUD, runs unique per (org, BS month, pay group), never double-counting an employment; web group picker + `/app/payroll/settings` (`tests/test_payroll_extensions.py`)
- [x] R002 Pay periods. — ✅ BS month (`backend/apps/core/bs.py`, `PayrollRun`) (+test `tests/test_bs_reference.py::test_consecutive_months_are_contiguous`)
- [x] R003 Pay rules. — ✅ `payroll.PayPolicy` per org (OT multiplier ≥ 1.5, festival rule/amount/month, rounding, weekly off paid, half-day fraction), `GET|PATCH /org/pay-policy`, engine reads it, defaults = contract; web `/app/payroll/settings` (`tests/test_payroll_extensions.py`)
- [x] R004 Daily wage calculation. — ✅ (+test `tests/test_payroll_engine.py::test_daily_wage_present_only_split_by_min_wage_ratio`)
- [x] R005 Hourly calculation. — ✅ `wage_type=hourly` for employments/jobs/offers (≥ Rs 101/h, 107 part-time), hours from `Attendance.hours_worked` or check-in/out minus shift break, ≤ 8 h/day regular + OT at the policy multiplier, basic/DA by minimum-wage ratio, `Payslip.regular_hours` (`tests/test_payroll_extensions.py`)
- [x] R006 Monthly salary. — ✅ (+test `tests/test_payroll_engine.py::test_full_month_minimum_wage_non_ssf_with_tds`)
- [x] R007 Overtime. — ✅ (+test `tests/test_payroll_engine.py::test_overtime_monthly_one_and_half_times`, `test_overtime_daily_uses_daily_wage_over_eight`)
- [x] R008 Allowance. — ✅ other allowance, festival (Dashain) allowance (+test `tests/test_payroll_engine.py::test_festival_allowance_prorated_monthly`)
- [x] R009 Deduction. — ✅ SSF 11%, TDS, advance recovery (+test `tests/test_payroll_engine.py::test_net_formula_with_all_deductions`)
- [x] R010 Payroll run. — ✅ (+test `tests/test_payroll_api.py::test_create_run_computes_payslips`, idempotent `test_duplicate_run`)
- [x] R011 Preview. — ✅ draft run with editable payslips that recompute (+test `tests/test_payroll_api.py::test_payslip_edit_recomputes_net_and_lifecycle`)
- [x] R012 Approval. — ✅ draft → approved → paid (+test `tests/test_payroll_api.py::test_payroll_hr_allowed_supervisor_forbidden`)
- [x] R013 Lock. — ✅ (+test `tests/test_attendance.py::test_bulk_locked_after_payroll_approved`)
- [x] R014 CSV/XLSX export. — ✅ wage-sheet XLSX, bank CSV, SSF CSV, payslip PDF (`backend/apps/payroll/exports.py`) (+test `tests/test_payroll_api.py::test_exports`)
- [x] R015 Worker earnings history. — ✅ worker payslips (`mobile/lib/features/worker/talab/`), verified-earnings profile (+test `tests/test_finance.py::test_me_financial_profile`, `tests/test_security_idor.py::test_worker_cannot_read_another_workers_payslip`)

## S. Notifications
- [x] S001 Notification model. — ✅ `backend/apps/notifications/models.py::Notification` (+test `tests/test_notifications.py::test_notify_creates_inbox_row`)
- [x] S002 In-app inbox. — ✅ (+test `tests/test_notifications.py::test_inbox_unread_count_read_and_read_all`); web bell, mobile `mobile/lib/features/common/inbox/`
- [x] S003 Push provider. — ✅ FCM HTTP v1 adapter `backend/apps/notifications/push.py`, disabled until configured (+test `tests/test_notifications.py::test_fcm_send_flow_and_unregistered_token`); 🔴 the Firebase project is still needed, and the mobile push plugin is deferred by contract
- [x] S004 Email provider. — ✅ email channel (+test `tests/test_notifications.py::test_email_channel_for_critical_payslip`); 🔴 SMTP credentials are still needed
- [x] S005 SMS provider abstraction. — ✅ `backend/apps/notifications/sms.py` (Console/Sparrow/Aakash + failover)
- [x] S006 Template model. — ✅ `NotificationTemplate` (versioned) (+test `tests/test_notifications.py::test_ops_template_crud_versions_and_preview`)
- [x] S007 Bilingual templates. — ✅ (+test `tests/test_notifications.py::test_render_language_fallback_and_missing_vars`, `test_notify_with_sms_sends_in_user_language`)
- [x] S008 Retry/dead-letter handling. — ✅ `NotificationDelivery` retries + `FailedTask` (+test `tests/test_notifications.py::test_sms_delivery_retries_then_fails`, `tests/test_security_platform.py::test_failed_task_captured_and_ops_retry_dismiss`)
- [x] S009 Preferences. — ✅ `NotificationPreference` (opt-outs, quiet hours) (+test `tests/test_notifications.py::test_opt_outs_marketing_and_quiet_hours`); mobile `notification_prefs.dart`

## T. Training
- [x] T001 Provider model. — ✅ `backend/apps/training/models.py::TrainingProvider`
- [x] T002 Provider verification. — ✅ `TrainingProvider.verification_status` + ops verify (+test `tests/test_training_ext.py::test_provider_verification`)
- [x] T003 Program/course. — ✅ `training.Course` (+test `tests/test_training.py::test_ops_provider_and_course_crud`)
- [x] T004 Schedule/cohort. — ✅ each `Course` is a cohort (`starts_on`, `duration_days`, `seats`) (+test `tests/test_training.py::test_seats_limit`)
- [x] T005 Enrollment. — ✅ (+test `tests/test_training.py::test_worker_courses_recommended_and_enroll`, `test_org_sponsors_only_own_active_workers`)
- [x] T006 Attendance. — ✅ `TrainingSession`/`SessionAttendance` + completion gate (+test `tests/test_training_ext.py::test_sessions_attendance_and_completion_gate`)
- [x] T007 Assessment. — ✅ `credentials.SkillAssessment` (+test `tests/test_credentials.py::test_ops_assessments`)
- [x] T008 Certificate. — ✅ completion issues a verified credential (+test `tests/test_training.py::test_completion_creates_verified_credential`)
- [x] T009 Auto-add worker credential. — ✅ same (+test `tests/test_training.py::test_completion_creates_verified_credential`)
- [x] T010 Placement outcome tracking. — ✅ `/ops/training/outcomes` per course, k-anon 5 (+test `tests/test_training_ext.py::test_outcomes_math_and_k_anonymity`)

## U. Billing
- [x] U001 Subscription plan model. — ✅ `backend/apps/billing/models.py::Plan` (+test `tests/test_billing_invoices.py::test_plan_pricing_base_included_workers_and_minimum`)
- [x] U002 Organization subscription. — ✅ `billing.Subscription` (+test `tests/test_billing_invoices.py::test_org_subscription_endpoint`, `test_paused_subscription_creates_no_charge`)
- [x] U003 Usage metering. — ✅ workers active in the month (+test `tests/test_billing_notifications.py::test_past_month_subscription_counts_workers_active_in_that_month`)
- [x] U004 Invoice. — ✅ per-BS-fiscal-year numbering, 13% VAT (+test `tests/test_billing_invoices.py::test_numbering_is_sequential_per_bs_fiscal_year_and_rolls_over_in_shrawan`, `test_vat_math`); 🔴 the IRD invoice format and CBMS (`backend/apps/billing/ird.py`, off by default) still need tax-adviser sign-off
- [x] U005 Invoice PDF. — ✅ `backend/apps/billing/pdf.py` (+test `tests/test_billing_invoices.py::test_issue_sets_due_date_and_stores_pdf`)
- [x] U006 Payment record. — ✅ `billing.PaymentRecord` (+test `tests/test_billing_invoices.py::test_payments_mark_invoice_and_charges_paid`)
- [x] U007 Credit note. — ✅ `billing.CreditNote` (+test `tests/test_billing_invoices.py::test_credit_note_reduces_balance_and_can_settle`)
- [x] U008 Placement fee rule. — ✅ placement `Charge` on join, replacement waiver (+test `tests/test_hiring.py::test_join_creates_employment_charge_and_fills_job`, `test_replacement_after_window_is_charged`); workers never billed (`tests/test_billing_invoices.py::test_workers_are_never_billed`)
- [x] U009 Admin billing console. — ✅ `web/app/ops/billing` (+test `tests/test_billing_invoices.py::test_ops_invoice_flow_over_api_is_audited`); employer `web/app/app/billing`

## V. Partner/Finance
- [x] V001 Partner model. — ✅ `backend/apps/partners/models.py::Partner` + hashed API keys (+test `tests/test_partners.py::test_key_stored_as_hash_only`)
- [x] V002 Partner verification. — ✅ `compliance_status`/licence validity, ops-set (+test `tests/test_mobility.py::test_ops_agency_compliance`); 🔴 real licences must be checked by hand (NRB/IB/DoFE)
- [x] V003 Partner product. — ✅ `finance.Offer` (+test `tests/test_finance.py::test_ops_offers_crud`)
- [x] V004 Worker consent flow. — ✅ purpose-bound, time-limited `ConsentGrant` (+test `tests/test_finance.py::test_apply_creates_grant_consent_and_referral`); mobile `consent_screen.dart`
- [x] V005 Referral application. — ✅ `finance.Referral` (+test `tests/test_finance.py::test_apply_rejects_ineligible_and_over_max`). We never lend or hold funds ([ADR 0006](adr/0006-partners-carry-all-regulated-activity-no-lending-no-wallet.md))
- [x] V006 Partner webhook/status update. — ✅ (+test `tests/test_partners.py::test_partner_updates_referral_status`, `test_webhook_signature`, `test_referral_apply_fires_webhook_after_commit`)
- [x] V007 Commission record. — ✅ partner-payer charges (`partner_referral_fee`, `training_commission`) (+test `tests/test_billing_invoices.py::test_partner_charges_and_invoices`); entered by ops, not created automatically per referral
- [x] V008 Consent revocation. — ✅ (+test `tests/test_partners.py::test_worker_grant_and_instant_revoke`, `test_expire_grants_task`)

## W. Foreign Employment
- [x] W001 Skill passport model. — ✅ `credentials.Passport` + `PassportShare` (+test `tests/test_passport.py`)
- [x] W002 Passport reference. — ✅ `mobility.TravelDocument` (number encrypted, masked) (+test `tests/test_mobility.py::test_create_travel_document_encrypts_number_and_masks_response`)
- [x] W003 Police clearance reference. — ✅ `mobility.ClearanceDocument(kind=police_clearance)` (+test `tests/test_mobility.py::test_clearance_document_reference_encrypted`)
- [x] W004 Medical reference. — ✅ `ClearanceDocument(kind=medical_fitness)` (+test `tests/test_mobility.py::test_expiry_reminders`)
- [x] W005 Language qualification. — ✅ `ClearanceDocument(kind=language_test, score_or_level)`
- [x] W006 Licensed agency model. — ✅ `Partner(kind=recruitment_agency)` + licence/compliance fields (+test `tests/test_mobility.py::test_agencies_lists_only_eligible`)
- [x] W007 Agency verification. — ✅ (+test `tests/test_mobility.py::test_ops_agency_compliance`, `test_share_refused_for_ineligible_agency`); UI `web/app/ops/mobility`; 🔴 no DoFE-licensed agency signed yet
- [ ] W008 Foreign opportunity. — ⛔ by decision: we never recruit or match for jobs abroad; agency job publication is deferred pending a legal opinion ([ADR 0007](adr/0007-foreign-employment-document-vault-only.md))
- [ ] W009 Candidate submission. — ⛔ by decision: replaced by worker-initiated, revocable document sharing with an eligible agency (`POST /me/mobility/shares`, `tests/test_mobility.py::test_share_with_eligible_agency_creates_recruitment_grant`) ([ADR 0007](adr/0007-foreign-employment-document-vault-only.md))
- [ ] W010 Status tracking. — ⛔ by decision: we don't track a recruitment pipeline; only document verification and expiry status (`tests/test_mobility.py::test_expiry_reminders`) ([ADR 0007](adr/0007-foreign-employment-document-vault-only.md))

## X. Admin Console
- [x] X001 Admin dashboard. — ✅ `web/app/ops` (dashboard), `web/app/ops/kpis`
- [x] X002 Worker search/detail. — ✅ `web/app/ops/workers`, `web/app/ops/workers/[id]` (+test `tests/test_crypto.py::test_ops_search_by_citizenship_number`, `tests/test_risk.py::test_ops_worker_detail_shows_open_risk_flags`)
- [x] X003 Employer search/detail. — ✅ `web/app/ops/employers`, `web/app/ops/organizations/[id]` (+test `tests/test_kyb.py::test_ops_queue_and_verify`)
- [x] X004 Verification queues. — ✅ `web/app/ops/verification`, `/ops/references`, `/ops/mobility`, `/ops/employers` (+test `tests/test_auth_permissions.py::test_ops_verify_requires_id_number_and_document`)
- [x] X005 Credential review. — ✅ `web/app/ops/credentials` (+test `tests/test_credentials.py::test_ops_verify_flow_and_trust_recompute`)
- [x] X006 Taxonomy management. — ✅ `web/app/ops/taxonomy` (+test `tests/test_taxonomy.py`)
- [x] X007 Disputes. — ✅ `web/app/ops/disputes` (+test `tests/test_trust.py::test_dispute_role_permissions`)
- [x] X008 Fraud flags. — ✅ `web/app/ops/risk`, `backend/apps/risk/` (+test `tests/test_risk.py`)
- [x] X009 Support tickets. — ✅ `web/app/ops/support`, `backend/apps/support/` (+test `tests/test_support.py`)
- [x] X010 Billing admin. — ✅ `web/app/ops/billing` (+test `tests/test_billing_invoices.py::test_ops_plans_crud_and_subscription_change_audited`)
- [x] X011 Notification templates. — ✅ `web/app/ops/notifications` (+test `tests/test_notifications.py::test_ops_template_crud_versions_and_preview`)
- [x] X012 Feature flags. — ✅ ops `/ops/flags` (superadmin, audited) — API `apps/core/flag_views.py`, web `web/app/ops/flags`; maintenance mode stays a management command
- [x] X013 Audit explorer. — ✅ `web/app/ops/audit`, `GET /ops/audit`, `/ops/audit/verify` (+test `tests/test_security_platform.py::test_ops_audit_list_filters_and_verify_endpoint`)

## Y. Analytics
- [x] Y001 Event taxonomy. — ✅ allow-listed server and client events, no PII (`backend/apps/telemetry/schema.py`, [ADR 0009](adr/0009-first-party-product-telemetry.md)) (+test `tests/test_telemetry.py::test_pii_and_unknown_properties_are_rejected`)
- [x] Y002 Product events. — ✅ server-side key-flow events (+test `tests/test_telemetry.py::test_key_flows_are_instrumented`). Client instrumentation is thin: the web sends login events (`web/components/auth/login-flow.tsx`) and the mobile app sends none yet
- [x] Y003 Marketplace metrics. — ✅ `GET /ops/kpis` (time to fill, fill rate, phase-1 exit targets) (+test `tests/test_insights_v2.py::test_kpi_math`); funnels/retention (+test `tests/test_telemetry.py::test_ops_funnel_and_retention_endpoints`)
- [x] Y004 Employer analytics. — ✅ `web/app/app/analytics`, `org_analytics` (k-anon) (+test `tests/test_insights.py::test_org_analytics_shape`)
- [x] Y005 Worker analytics. — ✅ supply/heatmap, worker activation in KPIs, worker career view (+test `tests/test_insights_v2.py::test_heatmap_supply_and_shortage_suppression`, `test_career_recommendations_shape`)
- [ ] Y006 Training analytics. — 🟡 partial: shortage-driven recommendations + certification uplift (`tests/test_training.py::test_shortage_math`, `tests/test_insights.py::test_certification_uplift_suppression`); no completion or placement-rate dashboard per provider or course
- [x] Y007 Admin operational analytics. — ✅ `/ops/system` health, risk summary, support queue/SLA, `web/app/ops/analytics` (+test `tests/test_security_platform.py::test_system_health_and_heartbeat`, `tests/test_risk.py::test_summary`)
- [ ] Y008 BI export/warehouse later. — 🟡 partial: CSV export of labour-market reports (`tests/test_insights.py::test_export_csv`); no warehouse feed

## Z. Production Readiness
- [ ] Z001 Legal review. — 🔴 needs owner: lawyer review of terms, privacy, consent text, contract template and the intermediary model (Labour Act 2074, Foreign Employment Act 2064, ETA 2063)
- [ ] Z002 Privacy policy. — 🔴 needs owner: draft at `/privacy` (`web/app/privacy`), versioned acceptance (`backend/apps/accounts/legal.py`, `tests/test_security_mfa.py::test_legal_current_pending_and_accept`); needs a lawyer and a named grievance officer
- [ ] Z003 Terms. — 🔴 needs owner: draft at `/terms` (`web/app/terms`) with acceptance tracking; needs a lawyer
- [ ] Z004 Employer agreement. — 🔴 needs owner: acceptance gate built (`tests/test_security_mfa.py::test_employer_agreement_pending_for_owners_only`); the pilot letter and paid MSA text need a lawyer
- [ ] Z005 Worker agreement. — 🔴 needs owner: `worker_agreement` acceptance kind built (`backend/apps/accounts/legal.py`); short bilingual text needs a lawyer and a plain-Nepali review
- [x] Z006 Verification SOP. — ✅ `docs/ops/kyc-identity-verification.md`, `credential-verification.md`, `employer-verification-kyb.md`, `work-history-reference-checks.md` (🔴 staff not yet trained)
- [x] Z007 Dispute SOP. — ✅ `docs/ops/dispute-handling-sla.md`
- [x] Z008 Support SOP. — ✅ `docs/ops/support-scripts.md`, help centre (`web/app/help`, `tests/test_support.py::test_help_center_public_and_seeded`)
- [x] Z009 Incident response. — ✅ `docs/RUNBOOK.md` §8 + §12 playbooks, `docs/SECURITY.md` §6, `docs/ops/incident-communications.md` (🔴 on-call rota and contacts still need filling in)
- [x] Z010 Backup automation. — ✅ `deploy/backup/` (nightly, retention, optional gpg, off-site S3) (`make backup-now`, `make restore`). ⚠ encryption only happens when `BACKUP_PASSPHRASE` is set
- [ ] Z011 Restore drill. — 🔴 needs owner: procedure in `docs/RUNBOOK.md` §5; run one on staging and record the date and duration
- [ ] Z012 Load testing. — 🟡 partial: script `deploy/load/k6-smoke.js`; never run against staging at pilot load (🔴 needs a staging host)
- [ ] Z013 Security test. — 🔴 needs owner: an external pen test. Automated scans run (bandit, gitleaks, trivy fs/image, CodeQL in `.github/workflows/`), and `tests/test_security_*.py` covers IDOR, MFA, uploads and the platform
- [ ] Z014 Monitoring alerts. — 🟡 partial: rules in `deploy/monitoring/alerts.yml` and `/metrics` endpoint; no Prometheus/Alertmanager or uptime checker deployed (🔴 choose where it runs)
- [x] Z015 Production runbook. — ✅ `docs/RUNBOOK.md`
- [ ] Z016 Rollback test. — 🟡 partial: rollback procedure in `docs/RUNBOOK.md` §3 and automatic rollback in `.github/workflows/deploy.yml`; never exercised (🔴 needs a staging host)
- [x] Z017 Pilot employer onboarding pack. — ✅ `docs/ops/employer-onboarding-playbook.md`, `docs/GO_TO_MARKET.md`
- [x] Z018 Worker field onboarding pack. — ✅ `docs/ops/worker-registration-camps.md`
- [ ] Z019 App store assets. — 🔴 needs owner: Play Console account, upload keystore, listing screenshots and texts, privacy URL
- [ ] Z020 Launch checklist signoff. — 🔴 needs owner: sign-off on `docs/PRODUCTION_CHECKLIST.md`

## BL. Bolau (Sipalu bookings) — ADR 0011
Spec: [CONTRACT-BOLAU.md](CONTRACT-BOLAU.md), [ADR 0011](adr/0011-bolau-sipalu-ghardhani-bookings.md). Whole module behind flag `bolau` (off by default); the fee behind `bolau_fee`. `tests/test_bolau_*.py` = `backend/tests/…`; mobile tests are under `mobile/test/`.
- [x] BL001 Sipalu self-onboarding. — ✅ wizard steps saved through `POST /me/sipalu/onboarding-step`; a user without a Worker gets one `pending` with `data_processing` consent, an unlinked Worker with the same phone is linked (`backend/apps/bolau/onboarding.py`, `profiles.py::ensure_worker`) (+test `tests/test_bolau_profile.py::test_user_without_worker_gets_one_pending_with_consent`, `test_existing_unlinked_worker_with_same_phone_is_linked`, `test_onboarding_steps_progress_and_completeness`, `test_onboarding_rejects_bad_step_and_bad_data`); web `/sipalu/join` (`web/e2e/bolau-join.spec.ts`); mobile `lib/features/bolau/ui/sipalu/onboarding_screen.dart` (`test/widgets/bolau_screens_test.dart` "onboarding basics posts the name and photo steps")
- [x] BL002 Handle. — ✅ unique `SipaluProfile.handle`, format check constraint `bolau_handle_format`, reserved words, auto-assigned unique handle, change cooldown (+test `tests/test_bolau_profile.py::test_handle_rules`, `test_auto_handle_is_unique`; mobile `test/features/bolau_models_test.dart` "handles match the server rule")
- [x] BL003 Services and prices with the minimum-wage floor. — ✅ `SipaluService` (fixed / hourly / visit-then-quote, price ≥ 0 constraint); hourly rate ≥ `MinimumWage.hourly` on services and offers (+test `tests/test_bolau_profile.py::test_min_hourly_rate_enforced`, `tests/test_bolau_requests.py::test_offer_rules_min_wage_window_and_withdraw`; mobile `test/widgets/bolau_screens_test.dart` "hourly price below the minimum wage is refused")
- [x] BL004 Availability and time off. — ✅ weekly `AvailabilityRule` (ordered, unique) + `TimeOff`; bookings outside hours or in time off are refused (`backend/apps/bolau/availability.py`) (+test `tests/test_bolau_profile.py::test_availability_bulk_put_and_overlap`, `test_time_off_blocks_booking_and_outside_hours_rejected`); web slot picker `web/lib/bolau/slots.ts` (+test `web/lib/bolau/slots.test.ts`)
- [x] BL005 Portfolio. — ✅ `PortfolioItem`, up to 12 photos through the upload validator (+test `tests/test_bolau_profile.py::test_portfolio_upload_and_limit`); mobile `lib/features/bolau/ui/sipalu/portfolio_screen.dart` (`test/widgets/bolau_gaps_test.dart` "add: picks a compressed photo…", "at 12 photos there is no add tile…")
- [x] BL006 Public profile and indexable opt-in. — ✅ `GET /public/sipalu/{handle}` never shows phone, address, ID or exact location; public only with consent + verified + Bolau on + not suspended; `X-Robots-Tag: noindex` unless `public_indexable` (+test `tests/test_bolau_profile.py::test_public_profile_masks_contact_and_respects_consent`); web `web/app/sipalu/[handle]/page.tsx` robots + sitemap lists opted-in profiles only (+test `web/lib/bolau/flag.test.ts` "lists only opted-in Sipalu profiles"; axe in `web/e2e/bolau.spec.ts`)
- [x] BL007 Ghardhani accounts, addresses, favourites. — ✅ `GhardhaniProfile`, `Address` (default address, blind-indexed line for fraud checks), `Favourite` (unique) (+test `tests/test_bolau_profile.py::test_ghardhani_profile_addresses_and_favourites`); web `/ghar/addresses`, `/ghar/favourites`; mobile `lib/features/bolau/ui/ghardhani/addresses_screen.dart` (`test/features/bolau_models_test.dart` "addresses round-trip to the API body")
- [x] BL008 Search and ranking. — ✅ `backend/apps/bolau/search.py`: verified + Bolau-on + in-area + free at the requested time, Bayesian rating, response time, distance band, trade aliases; trade "from" prices k-anonymous (+test `tests/test_bolau_ops_payments.py::test_search_ranking_alias_and_card_shape`, `test_trades_k_anonymity`); web `/bolau` (`web/e2e/home-bolau.spec.ts` hero search, `web/e2e/bolau.spec.ts`)
- [x] BL009 Booking lifecycle. — ✅ state machine requested → accepted → on the way → arrived → in progress → completed → confirmed, with `BookingEvent` per move, instant booking, accept timeout, auto-confirm after 24 h (Celery `bolau-expire-and-confirm`, every 5 min) (`backend/apps/bolau/bookings.py`) (+test `tests/test_bolau_bookings.py::test_full_lifecycle_with_events_and_notifications`, `test_instant_booking_is_accepted_immediately`, `test_expiry_and_fee_refund`, `test_expires_at_is_min_of_timeout_and_15_before_start`, `test_auto_confirm_after_24h`, `test_unbookable_and_out_of_area`)
- [x] BL010 Arrival code. — ✅ 4 digits, stored hashed, shown to the Ghardhani only, 5 tries then ops reset (+test `tests/test_bolau_bookings.py::test_arrival_code_five_tries`; mobile `test/widgets/bolau_screens_test.dart` "arrival code: four digits (Devanagari too) are sent as Latin digits"; web `web/e2e/bolau.spec.ts` "/ghar booking detail: arrival code…")
- [x] BL011 No double-booking. — ✅ service check + Postgres `ExclusionConstraint` `bolau_no_double_booking` on the Sipalu's active time ranges; a race returns 409 `slot_taken` (+test `tests/test_bolau_bookings.py::test_no_double_booking_service_and_db`)
- [x] BL012 Visit-then-quote. — ✅ Sipalu proposes a quote on site, the Ghardhani approves or rejects (rejected → completes with the visit fee) (+test `tests/test_bolau_bookings.py::test_visit_then_quote_requires_approval`, `test_visit_then_quote_rejected_completes_with_visit_fee`; mobile `test/widgets/bolau_screens_test.dart` "a proposed quote can be approved or declined")
- [x] BL013 Cancellation windows. — ✅ free while requested and until `BOLAU_FREE_CANCEL_HOURS` (2 h) before start; later = `late_cancellation` (fee kept, risk-checked); Sipalu cancel refunds the fee; no-show reportable 30 min after start; clients read the window from `GET /bolau/config` (+test `tests/test_bolau_bookings.py::test_cancellation_windows_and_fee`, `test_no_show_after_grace_refunds`, `tests/test_bolau_ops_payments.py::test_public_config`; mobile `test/widgets/bolau_gaps_test.dart` "accept countdown and free cancellation follow the config")
- [x] BL014 Contact and address privacy. — ✅ exact address and phone only after acceptance, hidden again 48 h after completion; every booking endpoint scoped to its two parties (+test `tests/test_bolau_bookings.py::test_contact_and_address_masking_windows`, `test_cross_party_404s`)
- [x] BL015 Kaam requests and max 3 offers. — ✅ `KaamRequest` + `Offer`; matching verified in-area Sipalu notified; DB unique `(request, slot)` with slot 1–3 caps offers at three, one per Sipalu; accepting one books it and rejects the others (`backend/apps/bolau/kaam.py`) (+test `tests/test_bolau_requests.py::test_request_notifies_matches_max_three_offers_and_accept`, `test_db_caps_offers_at_three`, `test_request_cancel_expire_and_scoping`, `test_request_validation`); web `/bolau/request`, `/ghar/requests`; mobile `test/widgets/bolau_screens_test.dart` "offers compare shows at most three offers"
- [x] BL016 Two-way ratings and moderation. — ✅ `BookingRating` once per side after confirmation (DB unique), side-specific tags, rated party can flag, ops hide / restore / void, public reviews moderated and first names only (+test `tests/test_bolau_bookings.py::test_ratings_once_per_side_after_confirm_and_moderation`)
- [x] BL017 Booking disputes for both parties. — ✅ `trust.Dispute.booking`; the Sipalu uses `/me/disputes`, the Ghardhani `/me/booking-disputes[/{id}[/evidence|/appeal]]` (evidence party `ghardhani`) (+test `tests/test_bolau_disputes.py::test_booking_dispute_visible_to_both_parties_only`, `test_me_booking_disputes_list_detail_and_scope`, `test_ghardhani_evidence_and_appeal`, `tests/test_bolau_bookings.py::test_dispute_and_safety_report`); web `/ghar` dispute box; mobile `test/widgets/ghar_disputes_test.dart`, `test/widgets/bolau_gaps_test.dart` "Ghardhani raises a dispute…"
- [x] BL018 Safety report and emergency line 100. — ✅ `POST /bolau/bookings/{id}/safety-report` → confidential `safety` support case carrying the booking code, `emergency` = urgent + all-staff alert; every booking returns `safety.emergency_line` "100" in both languages (+test `tests/test_bolau_bookings.py::test_dispute_and_safety_report`); SOP `docs/ops/bolau-home-visit-safety.md` (🔴 staff not yet trained)
- [x] BL019 Booking fee via the gateway adapter (Ghardhani only). — ✅ `backend/apps/bolau/payments.py`: `Charge(kind=booking_fee, payer_user=Ghardhani)` opened on acceptance, waived while `bolau_fee` is off, refunded when the Ghardhani is not at fault; eSewa / Khalti adapters raise `provider_not_configured` until credentials exist; webhook HMAC + timestamp + replay protection; Sipalu never pay (+test `tests/test_bolau_bookings.py::test_fee_waived_when_flag_off`, `test_db_requires_ghardhani_payer_for_booking_fee`, `tests/test_bolau_ops_payments.py::test_gateway_stub_not_configured`, `test_webhook_signature_replay_and_receipt`; mobile `test/widgets/bolau_gaps_test.dart` "pending + fees on: pay with eSewa…"). 🔴 merchant agreement: BL034
- [x] BL020 Receipt PDF. — ✅ bilingual receipt per paid fee, `GET /bolau/bookings/{id}/receipt.pdf` (`payments.receipt_pdf`) (+test `tests/test_bolau_ops_payments.py::test_webhook_signature_replay_and_receipt`, `test_receipt_unavailable_when_not_paid`; mobile `test/widgets/bolau_gaps_test.dart` "paid: receipt link")
- [x] BL021 Pay the Sipalu directly. — ✅ both parties mark how the Sipalu was paid (cash / eSewa / Khalti / bank); KaamSathi never holds the Sipalu's money (+test `tests/test_bolau_bookings.py::test_paid_marks_from_both_sides`)
- [x] BL022 Risk detectors. — ✅ `backend/apps/bolau/risk.py`: many cancellations, off-platform payment reports, review fraud (same hashed device / address) → `FraudFlag`; nightly `bolau-risk-scan`; bookings feed the trust reliability component (+test `tests/test_bolau_ops_payments.py::test_risk_cancellation_abuse_and_off_platform_reports`, `test_risk_review_fraud_same_device`, `test_trust_bookings_component`)
- [x] BL023 Ops queue and suspension. — ✅ `/ops/bolau` (`support` role): bookings, requests, Sipalu, ratings, reports, flags, KPIs, fee ledger; suspend / lift with a reason, audited; a suspended Sipalu can't switch Bolau back on (`backend/apps/bolau/ops.py`, `ops_views.py`) (+test `tests/test_bolau_ops_payments.py::test_ops_role_gate`, `test_ops_suspend_audited_and_blocks_booking`, `test_ops_lists_kpis_fees`, `tests/test_bolau_profile.py::test_suspended_sipalu_cannot_reenable`; `web/e2e/ops-bolau.spec.ts`)
- [x] BL024 Notifications. — ✅ bilingual in-app + SMS-worthy templates for every booking, request and offer event (`backend/apps/bolau/notify.py`) (+test `tests/test_bolau_bookings.py::test_full_lifecycle_with_events_and_notifications`, `tests/test_bolau_requests.py::test_request_notifies_matches_max_three_offers_and_accept`; mobile `test/widgets/ghar_disputes_test.dart` "Ghardhani dispute notifications open the Ghardhani dispute")
- [x] BL025 Telemetry. — ✅ allow-listed `bolau_*` events (`backend/apps/telemetry/schema.py`, `backend/apps/bolau/telemetry.py`), ids and statuses only, no PII (+test `tests/test_bolau_bookings.py::test_booking_telemetry_events_carry_no_pii`)
- [x] BL026 Flag gating. — ✅ `bolau` off → booking, search and public endpoints 404, profile editing still allowed; `bolau_fee` off → fees waived; web hides nav, pages and sitemap entries; mobile hides the mode switch and the Bolau segment (+test `tests/test_bolau_bookings.py::test_flag_off_hides_booking_endpoints`, `tests/test_bolau_profile.py::test_profile_editing_allowed_with_flag_off`; `web/lib/bolau/flag.test.ts`; mobile `test/widgets/bolau_screens_test.dart` "flag off: no mode switcher…", "Jobs tab … the Bolau segment when the flag is …")
- [x] BL027 Both languages. — ✅ API labels and errors in Nepali (`backend/apps/bolau/labels.py`) (+test `tests/test_bolau_profile.py::test_nepali_messages`); web `web/messages/src/bolau.{en,ne}.json` (`pnpm messages:check`); mobile `app_ne.arb` `bl*` keys (`test/widgets/bolau_screens_test.dart` runs every screen in en + ne). 🔴 native review: BL036
- [x] BL028 Web pages. — ✅ `/bolau`, `/bolau/book/[handle]` (inline OTP), `/bolau/request`, `/sipalu/[handle]`, `/sipalu/join`, `/ghar` (bookings, requests + offers compare, addresses, favourites, disputes), `/ops/bolau`, Bolau-first home while the flag is on (+test `web/components/bolau/ghar-shell.test.tsx`, `web/lib/bolau/{price,timeline,trades,slots,flag}.test.ts`, `web/app/page.test.tsx`; E2E `web/e2e/bolau.spec.ts`, `bolau-join.spec.ts`, `home-bolau.spec.ts`, `ops-bolau.spec.ts`)
- [x] BL029 Mobile modes. — ✅ mode switch Sipalu / Ghardhani / supervisor (`mobile/lib/features/bolau/ui/mode/welcome_screen.dart`); Sipalu: Bolau tab inside Jobs, services editor, portfolio, job screen with arrival code; Ghardhani 4-tab shell (`ui/ghardhani/ghardhani_shell.dart`: search, book, requests, bookings, disputes, profile) (+test `test/widgets/bolau_screens_test.dart` "mode switcher lists Sipalu, Ghardhani and supervisor, and switches", "Bolau tab shows the incoming request countdown…", "book flow shows the price, the fee line and free cancellation"; `test/features/bolau_models_test.dart`)
- [x] BL030 E2E. — ✅ four Bolau Playwright specs with axe (WCAG 2 A/AA), skipped while the flag is off: `web/e2e/bolau-join.spec.ts`, `bolau.spec.ts`, `ops-bolau.spec.ts`, `home-bolau.spec.ts` (incl. hero captions never covered); they clean up after themselves ([web/e2e/README.md](../web/e2e/README.md))
- [x] BL031 Demo data. — ✅ 12 Sipalu, Ghardhani 9800000020/21, Ram as `ram-bhanse`, idempotent (`backend/apps/bolau/demo.py`) (+test `tests/test_bolau_demo.py::test_demo_seed_idempotent_and_complete`)
- [x] BL032 Dev test-data cleanup. — ✅ `manage.py cleanup_dev_test_data [--apply]` removes `E2E:` bookings (+ events, ratings, reports, fee charges, notifications) and pending `98000009xx` test Sipalu with no bookings; dev settings only, dry run by default (`backend/apps/bolau/management/commands/cleanup_dev_test_data.py`, [RUNBOOK §14](RUNBOOK.md#14-local-development)) (+test `tests/test_bolau_cleanup.py`)
- [x] BL033 Home-visit safety SOP. — ✅ `docs/ops/bolau-home-visit-safety.md` (pre-launch gate, Sipalu checks before verification, safety reports and emergencies, no-shows, off-platform payment, suspension rules, en/ne scripts) (🔴 staff not yet trained; ops staffing: BL037)
- [ ] BL034 Payment gateway merchant agreement. — 🔴 needs owner: eSewa ePay / Khalti KPG merchant accounts, credentials and `BOLAU_WEBHOOK_SECRETS`, refund API terms, VAT treatment of the fee; only needed if `bolau_fee` is switched on ([PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) → Partner agreements)
- [ ] BL035 Consumer Protection Act 2075 review. — 🔴 needs owner: lawyer review of platform duties, intermediary status, Sipalu independent-worker status, booking / cancellation terms, liability for home-visit incidents, review rules; flag stays off in production until signed off
- [ ] BL036 Native Nepali review. — 🔴 needs owner: native speaker review of the Bolau web and mobile copy, notifications / SMS and the SOP scripts, against [GLOSSARY.md](GLOSSARY.md)
- [ ] BL037 Ops staffing for no-shows, safety reports and disputes. — 🔴 needs owner: two `support` staff on the rota for every hour bookings can start + an ops-lead escalation phone, trained on `docs/ops/bolau-home-visit-safety.md`
