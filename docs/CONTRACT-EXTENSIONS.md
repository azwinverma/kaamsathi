# KaamSathi — Extensions contract (reference-architecture gaps)

Closes the gaps found by comparing KaamSathi with the `nepal-workforce-os` reference design
(architecture, data model, API, security baseline, production checklist, roadmap phases 0–6).
All conventions of [CONTRACT.md](CONTRACT.md) and [CONTRACT-ECOSYSTEM.md](CONTRACT-ECOSYSTEM.md)
apply (page-number pagination is kept deliberately — every client already uses it; the error
envelope gains an optional `request_id`). Guiding rules of CONTRACT-ECOSYSTEM.md still bind.

Already done before this contract (do not redo): field encryption — `apps/core/crypto.py`
(`EncryptedCharField`, `blind_index(value, purpose)`, `mask()`), `Worker.citizenship_no/nid_no/
bank_account_no` encrypted with `citizenship_no_hash`/`nid_no_hash`, `Organization.pan_no` encrypted with
`pan_hash`; new fields `Worker.preferred_districts` (M2M District), `Worker.service_radius_km`;
Organization KYB fields `verification_status, registration_no, registration_doc, pan_doc, verified_by,
verified_at, verification_note` (migrations `workers/0003-0004`, `orgs/0002`). App skeletons
`risk, support, experience, timesheets, integrations, mobility` are registered, routed and have beat
entries (`apps.risk.tasks.scan`, `apps.support.tasks.escalate_overdue`,
`apps.mobility.tasks.expiry_reminders`, `apps.integrations.tasks.retry_deliveries`). Web nav entries
and `lib/api/{types-,hooks/}<area>.ts` stubs exist for risk, support, experience, timesheets,
integrations, mobility, security.

Shared service signatures (other agents call these — keep them exact; call through a lazy import
that no-ops if the module isn't there yet):
```python
apps.core.uploads.validate_upload(file, *, kinds: set[str], max_mb: int = 8) -> File   # raises APIError("upload_rejected")
apps.notifications.services.notify(user, kind: str, title: str, body: str, *, title_ne=None, body_ne=None,
                                   data=None, link=None, sms: bool = False) -> None
apps.integrations.services.emit(organization, event: str, payload: dict) -> None
apps.risk.services.flag(subject, kind: str, severity: str, details: dict | None = None) -> None   # idempotent per open (subject, kind)
```

| # | Area | Owner | Apps / files |
| --- | --- | --- | --- |
| 1 | Security & platform | security agent | `accounts` (MFA, sessions, staff roles), `core` (request id, idempotency, uploads, metrics, celery base, `permissions.IsOpsStaff`), `audit` |
| 2 | Trust operations | trust-ops agent | `risk`, `support`, KYB endpoints (`orgs` views/serializers), `Trade.is_active` (`workers` migration 0005), `trust.Dispute.sla_due_at` (`trust` migration) |
| 3 | Worker growth | worker agent | `experience`, `hiring` (interest, invitations, matching v2), `/me/worker` preferences |
| 4 | Workforce & enterprise | enterprise agent | `timesheets`, `integrations`, `notifications` inbox + push, payroll OT approval hook |
| 5 | Mobility & intelligence | mobility agent | `mobility`, `partners` agency compliance, `insights` heatmap + KPIs + career |
| 6 | Mobile | mobile agent | `mobile/lib` only |
| 7 | Docs & operations | docs agent | `docs/` SOPs, roadmap, checklist, GTM, API conventions |

---

## 1. Security & platform

**Staff roles + MFA** (`accounts`)
- `StaffProfile(user OneToOne, roles json [verifier|support|finance_ops|partner_manager|risk_analyst|superadmin], mfa_secret EncryptedCharField, mfa_enabled bool, mfa_enrolled_at?, recovery_codes json [sha256 hashes], updated_at)`.
- `user.is_staff` still gates `/ops/*`; **role check is central**: `apps.core.permissions.IsOpsStaff` consults `apps/accounts/staff_roles.py: ROUTE_ROLES` (URL-prefix → roles) so no ops view file changes. Map: `/ops/workers*`, `/ops/verification`, `/ops/credentials*`, `/ops/assessments*`, `/ops/work-history*`, `/ops/employers*`, `/ops/mobility*` → verifier · `/ops/disputes*`, `/ops/support-cases*`, `/ops/privacy-requests*` → support · `/ops/finance*`, `/ops/referrals*` → finance_ops · `/ops/partners*` → partner_manager · `/ops/risk*` → risk_analyst · `/ops/audit*`, `/ops/staff*`, `/ops/taxonomy*`, `/ops/system*` → superadmin · `/ops/jobs*`, `/ops/organizations*`, `/ops/crews*`, `/ops/training*` → verifier or support · `/ops/dashboard`, `/ops/insights*`, `/ops/kpis` → any staff. `superadmin` passes everything. Staff with no profile = `superadmin` only when `settings.DEBUG` (keeps dev/tests simple); in production a missing profile = no roles. Seed: 9800000003 gets all roles.
- MFA = TOTP (RFC 6238, SHA1, 30 s, 6 digits, ±1 step), implemented in `apps/accounts/mfa.py` (no new deps). `STAFF_MFA_REQUIRED` setting (default True in prod, False in dev/test).
  - `POST /auth/otp/verify` for a staff user with MFA enabled → `{mfa_required: true, mfa_token}` (signed, 5 min) instead of tokens; `POST /auth/mfa/verify {mfa_token, code | recovery_code}` → normal token response.
  - Staff without MFA while required: tokens are issued but every `/ops/*` call returns 403 `mfa_required` until enrolled.
  - `POST /auth/mfa/setup` → `{secret, otpauth_uri}` · `GET /auth/mfa/qr.svg` · `POST /auth/mfa/confirm {code}` → `{recovery_codes: [10]}` (shown once) · `POST /auth/mfa/disable {code}` · ops `POST /ops/staff/{user_id}/reset-mfa` (superadmin).
  - `Me` gains `staff_roles: []`, `mfa_enabled`, `mfa_required`.
- Staff admin: `GET|POST /ops/staff` (`{phone, full_name, roles}` creates/promotes) · `PATCH /ops/staff/{user_id} {roles?, is_active?}` · every change audited.

**Sessions / devices** — `SessionDevice(id, user, jti (refresh), user_agent, ip, platform web|android|ios|other, created_at, last_seen_at, revoked_at?)` recorded on login and refresh (rotation updates jti). `GET /auth/sessions` (current one flagged `current: true`) · `DELETE /auth/sessions/{id}` (blacklist its refresh) · `POST /auth/sessions/revoke-others`.

**Request IDs** — middleware: accept `X-Request-ID` (≤ 64 safe chars) or generate uuid4; set on response, in log records (`request_id`), in Sentry scope, and in the error envelope `error.request_id`. Web BFF forwards it.

**Idempotency** — `Idempotency-Key` header (≤ 100 chars) on POSTs decorated with `@idempotent` (`apps/core/idempotency.py`): store `(user/partner, method, path, key) → (body hash, status, response)` for 24 h (`IdempotencyRecord` model in core — core gets its first migration); replay returns the stored response with header `Idempotent-Replayed: true`; same key + different body → 409 `idempotency_conflict`. Apply to: payroll-run create, payouts create/submit, ops shortlist, offers apply, org member invite, employment create, privacy-request create, partner referral status, enterprise attendance bulk.

**Audit** — `AuditLog` becomes append-only: Postgres trigger rejecting UPDATE/DELETE (migration with `RunSQL`, reversible) plus `prev_hash`, `hash` (sha256 over canonical JSON of the row + prev_hash) chain. `GET /ops/audit?actor=&organization=&action=&object_type=&object_id=&from=&to=` (superadmin; paginated) · `GET /ops/audit/verify` → `{ok, checked, first_broken_id|null}`. Make sure these emit audit rows: staff role/MFA changes, KYB decisions, identity/credential/work-history/mobility verifications, payroll approve/mark-paid, sensitive exports & downloads (wage sheet, bank file, SSF file, privacy export, ID documents), partner data reads (one row per read in addition to PartnerAccessLog), enterprise key creation.

**Uploads** — `apps/core/uploads.py: validate_upload` — magic-byte sniff (`jpeg|png|webp|pdf|xlsx|csv`), extension/content-type agreement, size cap, images re-encoded with Pillow (strip EXIF incl. GPS, cap 4000 px), PDFs rejected if they contain `/JavaScript`, `/JS`, `/EmbeddedFile`, `/Launch`; optional ClamAV via clamd INSTREAM over TCP (`CLAMAV_HOST`, `CLAMAV_PORT`; unset → skipped and logged; infected → `upload_rejected`). Wire into every existing upload: worker ID/photo (ops + me), credentials, employment import, compliance reconcile CSV; new apps call it themselves. Add optional `clamav` service to `deploy/docker-compose.prod.yml`.

**Task reliability** — `apps/core/tasks.py: ReliableTask` Celery base (retry with exponential backoff + jitter, `max_retries=5`, `acks_late`), `FailedTask(id, task_name, task_id, args_redacted json, exception, traceback, created_at, retried_at?, dismissed_at?)` written on final failure; set as default base where practical. `GET /ops/system/health` → `{db, redis, celery: {queue_length, workers_seen}, beat: {last_heartbeat}, failed_tasks_24h, sms_failed_24h, version}` · `GET /ops/system/failed-tasks` · `POST /ops/system/failed-tasks/{id}/retry|dismiss`. Beat heartbeat task every 5 min.

**Metrics** — `GET /metrics` (Prometheus text, bearer `METRICS_TOKEN`; 404 when unset): `http_requests_total{method,status_class,group}`, `http_request_duration_seconds` histogram (`group` = first two path segments), `celery_tasks_total{task,state}`, `otp_requests_total{result}`, `sms_messages_total{backend,status}`. Store counters in Redis (multi-process safe). Example alert rules in `deploy/monitoring/alerts.yml` + scrape config doc. Load test script `deploy/load/k6-smoke.js` (+ how to run).

**Web** — BFF mutating handlers reject cross-site requests (`Origin`/`Sec-Fetch-Site` check → 403); MFA step in the login flow for staff; `/app/account` and `/ops/account` (sessions list/revoke, MFA enrol with QR + recovery codes, disable); `/ops/audit`, `/ops/staff`, `/ops/system`; ops nav hides items the staff member's roles can't open (add optional `staffRoles` to NavItem in `components/shell/nav.ts`).

## 2. Trust operations

**Employer verification (KYB)** — `GET|POST /org/verification` (owner/admin; multipart `registration_no`, `registration_doc`, `pan_doc`, `pan_no?`) → status `pending` · ops `GET /ops/employers?verification_status=` (with documents as signed URLs) · `POST /ops/employers/{id}/verify {status: verified|rejected, note}`. `Organization` payloads expose `verification_status`; worker-facing job/employment payloads expose `employer_verified: bool`. Setting `KYB_REQUIRED_FOR_SHORTLIST` (default True): `/ops/jobs/{id}/shortlist` → 400 `invalid_state` "Employer is not verified yet" for unverified orgs. Demo orgs seeded verified.

**Risk** — `FraudFlag(id, subject_type worker|organization|employment|attendance|credential|work_history|travel_document, subject_id, kind duplicate_identity|shared_bank_account|document_reuse|attendance_anomaly|geo_anomaly|velocity|reference_mismatch|manual, severity low|medium|high, details json, status open|confirmed|dismissed, created_at, resolved_by?, resolved_at?, note?)`.
Detectors: on Worker save — another worker with the same citizenship/NID hash → `duplicate_identity` high; nightly `apps.risk.tasks.scan` — shared bank account (compare `blind_index(bank_account_no,"bank")` computed in memory), identical document file sha256 across workers (`document_reuse`), attendance anomalies (≥3 check-ins outside geofence in 7 days; several workers checking in from identical coordinates within 60 s — buddy punching; check-in after check-out), velocity (worker onboarded by ≥3 orgs in 7 days). `GET /ops/risk/flags?status=&kind=&severity=&subject_type=` · `POST /ops/risk/flags` (manual) · `POST /ops/risk/flags/{id}/resolve {status: confirmed|dismissed, note}` · `GET /ops/risk/summary` (counts by kind/severity, 30-day trend). Ops worker detail shows `open_risk_flags` count (allowed edit of `apps/workers/ops_views.py` serializer only).

**Support** — `SupportCase(id, number "KS-000123", requester user, worker?, organization?, channel app|web|phone|sms|field, category account|payment|attendance|job|privacy|technical|other, subject, description, priority low|normal|high|urgent, status open|pending_user|resolved|closed, assignee?, sla_due_at (urgent 4 h, high 24 h, normal 72 h, low 7 d), first_response_at?, resolved_at?, escalated bool, created_at)` + `CaseMessage(case, author, body, internal bool, created_at)`. `GET|POST /me/support-cases`, `GET|POST /me/support-cases/{id}/messages` (workers) · same under `/org/support-cases` (any member; org-scoped) · ops `GET /ops/support-cases?status=&priority=&assignee=&overdue=`, `PATCH /ops/support-cases/{id} {assignee_id?, status?, priority?}`, `GET|POST /ops/support-cases/{id}/messages {body, internal}`. First non-internal staff message sets `first_response_at`; requester gets `notify()`. `escalate_overdue` marks `escalated` and notifies staff with `support` role. `trust.Dispute` gains `sla_due_at` (open → 7 days for employer response; employer_responded → 7 days for ops) shown in dispute lists; escalation covers disputes too.

**Taxonomy** — `Trade.is_active` (default True; inactive trades hidden from `/ref/trades` unless `?all=1`). `GET|POST /ops/taxonomy/trades`, `PATCH /ops/taxonomy/trades/{code}` (name_en, name_ne, category, is_active; code immutable). Audited.

## 3. Worker growth

**External work history** (`experience`) — `WorkHistoryEntry(id, worker, employer_name, employer_org? (orgs.Organization), trade?, role_title, district?, start_date, end_date?, description?, reference_name?, reference_phone EncryptedCharField?, status self_reported|reference_pending|verified|unverifiable|rejected, verification_method? reference_call|document|employer_confirmed, document? (private, validate_upload), verified_by?, verified_at?, note?, created_at)`. Worker `GET|POST /me/work-history`, `PATCH|DELETE /me/work-history/{id}` (only while not verified); submitting with a reference → `reference_pending`. Ops `GET /ops/work-history?status=` (reference phone shown to ops only), `POST /ops/work-history/{id}/verify {status, method, note}`. On-platform employer (`employer_org` set): `GET /org/work-history-confirmations`, `POST /org/work-history/{id}/confirm|reject`. Effects: verified entries appear in the passport payload under `work.external: [{employer_name, role_title, from, to, verified_by: "reference"|"employer"|"document"}]` (minimal edit of `apps/credentials/services.py`) and count toward trust level 2 and the stability component (≥ 12 verified months; minimal edit of `apps/trust/services.py`).

**Interest & invitations** (`hiring`) — `Application.source ops|worker_interest|employer_invite` (default ops), `worker_response pending|interested|declined|null`, `responded_at?`. Worker: `GET /me/jobs/recommended` (open jobs whose trade is among the worker's skills and whose site/org district is in current or preferred districts; excludes jobs already in the worker's pipeline; fields: title, trade, wage, wage_type, district, food/accommodation, start_date, organization name, `employer_verified`) · `POST /me/jobs/{id}/interest` → Application `sourced` + `worker_interest` (never visible to the employer until ops shortlists; org application lists exclude `sourced` rows with source `worker_interest`) · `GET /me/applications` (stage, job summary, org name, `worker_response`, interview_at) · `POST /me/applications/{id}/respond {response: interested|declined, note?}` (declined → stage `dropped`, note "Declined by worker"). When ops shortlists a worker: `worker_response = pending` and `notify(... sms=True)` "Shortlisted for X at Y — confirm interest". Employer sees `worker_response` on applications. Jobs from unverified employers are not recommended.

**Matching v2** — `match_score` adds: `+5` preferred-district match ("Prefers this area"), `+0–5` outcome bonus = 5 × share of the worker's past placements that stayed ≥ 90 days (needs ≥ 1 placement; reason "Stays in jobs"), `−10` if worker declined this employer before; total still clamped 0–100. `GET /ops/jobs/{id}/matches` items gain `explain: {component: points}`. Update existing matching tests' expectations only where the formula changed.

**Preferences** — `PATCH /me/worker` accepts `preferred_districts: [code]`, `service_radius_km`, `expected_monthly_wage`, `available_from`, `is_available`; `GET /me/worker` returns them.

## 4. Workforce & enterprise

**Timesheets** (`timesheets`) — `TimesheetPolicy(organization OneToOne, ot_requires_approval bool=False, weekly_ot_cap_minutes=1440 (Labour Act: 24 h/week), daily_regular_minutes=480)`; `Timesheet(id, employment, week_start (Sunday), status draft|submitted|approved|rejected, days json [{date, worked_minutes, regular_minutes, overtime_minutes, status}], regular_minutes, overtime_minutes_claimed, overtime_minutes_approved?, submitted_by?, submitted_at?, approved_by?, approved_at?, note?)` unique(employment, week_start). Built from attendance (check-in/out when present, else status: present = daily regular, half_day = half, OT from `overtime_minutes`). Endpoints: `GET /org/timesheets?week_start=&site=&status=` · `POST /org/timesheets/generate {week_start, site?}` (create/refresh drafts; never overwrite approved) · `POST /org/timesheets/{id}/submit` (supervisor for own sites) · `POST /org/timesheets/{id}/approve {overtime_minutes_approved?}` / `reject {note}` (owner/admin/hr) · `POST /org/timesheets/bulk-approve {ids}` · `GET|PATCH /org/timesheet-policy` · worker `GET /me/timesheets`. Weekly OT above the cap → `over_cap: true` + warning. **Payroll hook**: when `ot_requires_approval`, the engine uses approved timesheet OT for the month (prorated by days in month) instead of attendance OT — minimal edit of `apps/payroll/engine.py`/services with tests; default behaviour unchanged.

**Enterprise API & webhooks** (`integrations`) — `OrgAPIKey(id, organization, name, prefix, key_hash, scopes [jobs.read, jobs.write, workforce.read, attendance.read, attendance.write, payroll.read, timesheets.read], created_by, created_at, last_used_at?, revoked_at?)`; header `Authorization: Org ks_org_<prefix>_<secret>`; endpoints under `/enterprise/*` (no X-Org-Id): `GET /enterprise/jobs`, `POST /enterprise/jobs` (same min-wage rules), `GET /enterprise/employments`, `GET /enterprise/attendance?from=&to=&site=`, `POST /enterprise/attendance/bulk` (same semantics as `/org/attendance/bulk`, idempotent), `GET /enterprise/payroll-runs`, `GET /enterprise/payroll-runs/{id}/payslips`, `GET /enterprise/timesheets?week_start=`. Webhooks: `WebhookEndpoint(id, organization, url (https only in prod), secret, events [], is_active, created_at)`, `WebhookDelivery(id, endpoint, event, payload, status pending|delivered|failed, attempts, next_attempt_at, last_status_code?, last_error?, created_at, delivered_at?)`. Events: `application.stage_changed`, `employment.started`, `employment.ended`, `payroll.run_approved`, `payroll.run_paid`, `timesheet.approved`, `dispute.raised`, `support_case.updated` — emitted via `emit()` from signals/services; signature header `X-KaamSathi-Signature: sha256=<hmac(secret, timestamp + "." + body)>` + `X-KaamSathi-Timestamp`; retries with backoff (1 m, 5 m, 30 m, 2 h, 12 h) then `failed`. Org UI endpoints: `GET|POST /org/api-keys` (key shown once), `POST /org/api-keys/{id}/revoke`, CRUD `/org/webhooks`, `POST /org/webhooks/{id}/test`, `GET /org/webhooks/{id}/deliveries`, `POST /org/webhooks/deliveries/{id}/redeliver` (owner/admin). Public docs page `/developers`.

**Notifications** — `Notification(id, user, kind, title, title_ne?, body, body_ne?, data json, link?, read_at?, created_at)`, `DeviceToken(id, user, platform android|ios|web, token unique, created_at, last_seen_at)`. `notify()` creates the inbox row, sends push through an FCM HTTP v1 adapter when `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` are set (OAuth JWT signed RS256 with `cryptography`; otherwise skipped), and SMS when `sms=True`. Endpoints: `GET /me/notifications`, `GET /me/notifications/unread-count`, `POST /me/notifications/{id}/read`, `POST /me/notifications/read-all`, `POST /me/devices {platform, token}`, `DELETE /me/devices/{token}`. Existing SMS events (payslip ready, shortlist, interview reminder, dispute updates, credential expiry) also create inbox rows. Web: bell with unread count + dropdown in the shell header.

## 5. Mobility & intelligence

**Foreign-employment passport** (`mobility`) — strategy rule: we never recruit or match for jobs abroad; we only let a worker hold and share verified documents with a **licensed** recruitment agency of their choice, and show safety guidance.
- `TravelDocument(id, worker, kind passport|labour_permit|visa, number EncryptedCharField, number_hash, issuing_country default "NP", issued_on?, expires_on?, document private file, status pending|verified|rejected|expired, verified_by?, verified_at?, note?)`.
- `ClearanceDocument(id, worker, kind police_clearance|medical_fitness|pre_departure_orientation|insurance|language_test, title, issuer, reference_no EncryptedCharField?, issued_on?, expires_on?, score_or_level?, document private file, status…, verified_by?, verified_at?, note?)`.
- `partners.Partner` gains `license_valid_until?`, `compliance_status unverified|verified|suspended`, `compliance_verified_by?`, `compliance_verified_at?`, `compliance_note?` (partners migration). An agency is *eligible* only if kind `recruitment_agency`, compliance `verified`, license unexpired.
- Worker: CRUD `/me/mobility/documents` (both kinds, `kind_group: travel|clearance`) · `GET /me/mobility/agencies` (eligible only, with license no + valid-until) · `POST /me/mobility/shares {partner_id, days ≤ 90}` → `partners.ConsentGrant(purpose=recruitment, scopes=[passport.read, mobility.read])` · revoke via existing `/me/grants/{id}/revoke`. Partner API: `GET /partner/workers/{id}/mobility` (scope `mobility.read`): verified flags, expiry dates, kinds — never document images or full numbers (masked).
- Ops: `GET /ops/mobility/documents?status=`, `POST /ops/mobility/documents/{id}/verify {status, note}`, `GET /ops/mobility/agencies`, `POST /ops/mobility/agencies/{partner_id}/compliance {status, license_valid_until, note}`.
- Daily `expiry_reminders`: mark expired; notify 60/30/7 days before passport/medical/police expiry.
- Every mobility screen shows safety guidance: use only DoFE-licensed agencies, check the licence on the official DoFE site, get receipts for any payment, never hand over your original passport without a receipt.

**Intelligence** (`insights`) — all with k-anonymity 5.
- `GET /ops/insights/heatmap?metric=demand|supply|shortage|median_wage&trade=` → `{metric, trade, cells: [{district: {code,name_en,name_ne,province}, value|null, suppressed}]}`; web shows a province-grouped district grid with a sequential colour scale (no map library).
- `GET /ops/kpis?days=30|90|365` → `{time_to_fill_days_median, time_to_shortlist_hours_median, fill_rate, placements, placement_revenue, repeat_employer_rate, worker_activation_rate, verified_workers_added, dispute_rate, avg_employer_rating_of_workers, avg_worker_rating_of_employers, phase1_exit: [{key, target, actual, met}]}` with exit targets 1,000 workers · 50 orgs · 20 paying orgs · 100 placements · median fill < 14 days.
- `GET /me/career` → `{trades: [...], recommendations: [{kind: credential|course|skill|profile, title, title_ne, reason, expected_uplift_pct|null, course_id?, link?}]}` built from certification uplift, open shortages in the worker's area, and profile gaps (no ID, no verified credential, no external history).

## 6. Mobile (worker + supervisor)
Notification inbox with unread badge (poll `unread-count` on resume; FCM registration only if a push plugin is added later — document, don't add now) · Login & security: sessions list + revoke · Work history (external) CRUD with reference · Recommended jobs + "I'm interested" · My applications with confirm/decline · Availability & preferred areas · Help & support cases with messages · Foreign-employment documents, eligible agencies, share/revoke, safety guidance · Career recommendations · Employer-verified badge on jobs and employments · Worker timesheets view; supervisor: submit timesheets for own sites.

## 7. Docs & operations
`docs/ops/` SOPs: KYC/identity verification, credential verification, employer verification (KYB), work-history reference checks, fraud escalation, dispute handling SLA, support scripts (worker + employer, en/ne key phrases), employer onboarding playbook, field-agent worker registration camp guide, foreign-employment document guidance. `docs/ROADMAP.md` (phases 0–6 mapped to what is built, behind which gate), `docs/PRODUCTION_CHECKLIST.md` (every item with status: done / partial / needs-you, linked to code or doc), `docs/GO_TO_MARKET.md` (merged strategy + reference), `docs/API_CONVENTIONS.md` (auth schemes, errors, request ids, idempotency, pagination, versioning, webhooks signature verification), `docs/ARCHITECTURE.md` (actual system with diagram).

## 8. Platform & payroll completion (checklist R001 · R003 · R005 · C015/X012 · D005)

All defaults reproduce the earlier behaviour exactly; existing clients need no change.

**Hourly wage type (R005)** — `wage_type` everywhere (`Employment`, `JobOpening`, `JobOffer`, `Payslip`)
accepts `monthly|daily|hourly`.
- `Employment` gains `hourly_wage` (money string|null) and `part_time` (bool, default false); `JobOffer`
  gains `hourly_wage`; the join/offer payloads accept `hourly_wage` (and `part_time` on join).
  Validation: hourly `hourly_wage ≥ MinimumWage.hourly` (101), or `≥ hourly_part_time` (107) when
  `part_time` → 400 `below_minimum_wage` with `fields.hourly_wage`; missing → `validation_error`.
  Jobs: `wage_type=hourly` → `wage_amount ≥ MinimumWage.hourly`. `monthly_gross` for hourly = hourly × 8 × 30.
- `Attendance` gains `hours_worked` (decimal string `"9.50"`|null); `POST /org/attendance/bulk` records accept
  optional `hours_worked` (0–24).
- Payroll (hourly): hours per worked day = `hours_worked`, else check-out − check-in − shift `break_minutes`,
  else 8 × day fraction (present 1, half day = policy fraction). Regular hours ≤ 8/day; the excess is
  overtime (plus `overtime_minutes` on days with unknown hours). `wage = hourly_wage × regular_hours`, split
  basic/DA by the minimum-wage ratio; OT = hours × hourly_wage × OT multiplier; festival base =
  hourly_wage × 8 × 30 × ratio. `Payslip` gains `regular_hours` (string `"14.00"`, 0 for other wage types).

**Pay policy (R003)** — `PayPolicy(organization OneToOne, ot_multiplier ≥ 1.5 (Labour Act floor; engine
clamps), festival_allowance_rule one_month_basic|custom_amount|none, festival_custom_amount,
festival_month 1–12|null, rounding two_decimals|nearest_rupee, weekly_off_paid=true, half_day_fraction=0.5)`.
- `GET /org/pay-policy` (owner/admin/hr) → `{ot_multiplier "1.50", festival_allowance_rule, festival_custom_amount
  "0.00", festival_month, rounding, weekly_off_paid, half_day_fraction "0.50", updated_at|null, is_default}`
  (defaults when the org has none) · `PATCH /org/pay-policy` (owner/admin; audited `payroll.pay_policy.update`).
- `POST /org/payroll-runs` → `include_festival_allowance` is now optional: omitted/null = true only when the
  run's BS month equals `festival_month` (and the rule isn't `none`).

**Pay groups (R001)** — `PayGroup(id, organization, name unique per org, site_ids [], wage_types [], contractor_ids [],
pay_day 1–32|null, is_active, created_at)`. An employment belongs to the oldest active group whose non-empty
criteria all match; otherwise to the null group.
- CRUD `/org/pay-groups` (owner/admin/hr; audited); responses add `employment_count` (active employments now in
  the group). `DELETE` of a group with runs → 400 `invalid_state` (deactivate instead).
- `PayrollRun` gains `pay_group` → responses `pay_group: {id, name}|null`; create accepts `pay_group_id`.
  Unique per `(org, bs_year, bs_month, pay_group)` with the null group once per month (400 `duplicate`).
  A run never includes an employment that already has a payslip in another run of the same org and month.
  Attendance locking stays month-wide: any approved run locks the month for everyone.

**Feature flags (C015/X012)** — `core.FeatureFlag(key slug PK, description, enabled, rollout all|orgs|percent,
org_ids [], percent 0–100, client_visible, updated_by, updated_at)`; `apps.core.flags.is_enabled(key,
organization=None, user=None)`: row decides, else settings fallback (`kyb_required_for_shortlist`,
`ird_cbms_enabled`, `telemetry`, `kyc_four_eyes`, `payout_esewa|khalti|connectips`), else off. Percent rollout
hashes key + org id (user id without org). Cached `FEATURE_FLAG_CACHE_SECONDS` (30).
- `GET /flags` (any signed-in user; optional `X-Org-Id`) → `{flags: {key: bool}}` — client-visible flags only.
- Ops (superadmin, audited `ops.flag.*`): `GET /ops/flags` → `{results: [Flag], settings_defaults: [{key, default}]}`
  · `POST /ops/flags` · `GET|PATCH|DELETE /ops/flags/{key}`. Flag = model fields + `updated_by {id, full_name}|null`,
  `has_settings_fallback`.

**OTP resend cooldown (D005)** — `POST /auth/otp/request` within `OTP_RESEND_COOLDOWN_SECONDS` (30) of the last
code for the phone, or over `OTP_MAX_PER_HOUR` → 429 `{"error": {"code": "otp_rate_limited", …, "retry_after": 27}}`
plus `Retry-After` header. Dev/compose default the cooldown to 0.

**Payout webhooks** — optional `X-Timestamp` (unix seconds): when present the HMAC covers `ts + "." + body` and
|now − ts| ≤ `PAYOUT_WEBHOOK_MAX_SKEW_SECONDS` (300) else 403 `invalid_signature`; without it the raw body is
signed (unchanged). A verified signature replayed within 24 h → 409 `webhook_replayed` (forgotten again if
processing fails, so provider retries work).

**KYC four-eyes** — flag/setting `kyc_four_eyes` (default off). On: the first `POST /ops/workers/{id}/verify
{status: verified}` keeps the worker `pending` and stores `risk.VerificationReview(stage=first)`; a different
verifier's `verified` finalises (`stage=final`); the same verifier → 400 `invalid_state`; `rejected` is always
final. The verify response gains `kyc_review: {required: true, first_review_by: {id, full_name}, first_review_at}|null`.

**Employment history** — `GET /org/employments/{id}/history` (owner/admin/hr; supervisors only for employments at
their own sites; another org's or another site's employment → 404). Paginated (`page`, `page_size` ≤ 100),
newest first: `{count, next, previous, results: [{type, at, at_bs, title, detail, actor: {id, full_name}|null}]}`.
`at` is an ISO date for dated facts (start, end, advance — the end sorts as the end of its day) or an ISO
datetime; `at_bs` is the BS date; `title` is localised (Accept-Language). Types and `detail`:
- `employment_started` `{site: {id, name}|null, designation}` — as on the first day (before logged changes).
- `employment_ended` `{end_reason, end_reason_label}`.
- `wage_changed` `{changes: {field: {from, to}}, monthly_gross: {from, to}, wage_type: {from, to, from_label,
  to_label}}` — fields `wage_type|basic_salary|dearness_allowance|other_allowance|daily_wage|hourly_wage|part_time|
  ssf_enrolled`; one event per audited `employment.update` (the audit row's `changes` hold `{field: {from, to}}`).
- `site_changed` `{from: {id, name}|null, to}` · `designation_changed` `{from, to}`.
- `rating_given` `{id, score_a (reliability), score_b (skill), comment, comment_status, comment_status_label,
  voided}` — only the employer's own rating of this employment; the worker's rating of the employer never appears.
- `contract_issued` `{id, version, monthly_gross}` (actor = generated_by) · `contract_accepted` `{id, version, channel}`.
- `dispute_opened` `{id, kind, kind_label, status, status_label, description}` · `dispute_resolved` (same + `appeal`
  bool, `note`, `outcome` on appeals); actor is always null (KaamSathi staff are not named).
- `advance_given` `{id, amount, recover_per_month, recovered_amount, note}`.
