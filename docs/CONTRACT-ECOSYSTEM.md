# KaamSathi — Ecosystem contract (phases 1-complete, 2 and 3)

Extends [CONTRACT.md](CONTRACT.md); every convention there (base URL, snake_case, UUIDs,
money strings, `x_bs` dates, error envelope, `X-Org-Id`, roles, pagination, `Accept-Language`)
applies unchanged. Where this file and CONTRACT.md disagree, CONTRACT.md wins for phase-1
behaviour and this file wins for anything new.

Guiding rules from the venture strategy (do not break these in code):
- **Workers never pay.** No endpoint charges a worker.
- **We never lend, never hold customer funds.** Payroll money moves employer → provider → worker;
  loans, earned-wage access (EWA) and insurance sit on a licensed partner's books. We store
  referrals and statuses only.
- **The worker owns their record.** Every share of personal data outside the employing org needs an
  explicit, revocable, purpose-bound consent; every view is logged and visible to the worker.
- **No foreign recruitment.** We share a worker's passport with a licensed agency only when the
  worker asks; we never match for jobs abroad.
- Score shown to anyone is a **reliability score** — never call it a credit score.
- Integrations that need a contract with a third party (banks, wallets, CTEVT/NSTB, insurers) are
  built as **adapters with a working manual/file fallback** and a disabled-by-default live mode.

New apps (skeletons already registered in `INSTALLED_APPS` and included in `config/api_urls.py`;
each app owns its `urls.py` using `apps.core.routers.Router`):

| App | Phase | Owns |
| --- | --- | --- |
| `trust` | 1 | profile-view log, verification levels, reliability score, disputes, worker→employer rating |
| `crews` | 1 | naike (team lead) crews and referral rewards |
| `credentials` | 2 | credentials, skill assessments, Skill Passport + share links |
| `training` | 2 | training providers, courses, enrolments, shortage-driven recommendations |
| `compliance` | 2 | employment contracts, SSF filing, compliance status, contractors (thekedar) |
| `payouts` | 2 | payroll disbursement batches via provider adapters |
| `scheduling` | 2 | shift roster |
| `partners` | 3 | partner orgs (bank, insurer, training, recruitment agency), API keys, consent grants, partner API |
| `finance` | 3 | worker financial profile (verified earnings), offers, referrals (loan / EWA / insurance) |
| `insights` | 2–3 | employer analytics, labour-market intelligence (aggregates only) |
| `privacy` | 1 | data export, deletion/correction requests, retention |

Celery beat entries are pre-registered in `config/settings/base.py`; each app must implement the
task named there. Settings keys already defined: `NAIKE_REFERRAL_FEE`, `NAIKE_REFERRAL_HOLD_DAYS`,
`SSF_DUE_DAYS`, `PAYOUT_PROVIDERS`, `PAYOUT_WEBHOOK_SECRETS`, `PARTNER_GRANT_MAX_DAYS`,
`PUBLIC_WEB_URL`, `PRIVACY_EXPORT_TTL_HOURS`.

---

## 1. trust (phase 1 completion)

**Models**
- `ProfileView(id, worker, organization?, partner? (FK partners.Partner, nullable, string ref), viewer user?, context: application|employment|ops|partner|passport|crew, object_id?, created_at)`.
- `WorkerTrust(worker OneToOne PK, verification_level 0–5, reliability_score 0–100 nullable, breakdown json, computed_at)`.
- `Dispute(id, worker, organization?, employment?, payslip? (FK payroll.Payslip), attendance_date?, kind: attendance|wage|employment_dates|rating|identity|other, description, status: open|employer_responded|resolved|rejected, employer_note?, resolution_note?, raised_at, responded_at?, resolved_by user?, resolved_at?)`.

**Service API (other apps call these — keep signatures):**
```python
apps.trust.services.log_profile_view(worker, *, context, organization=None, partner=None, viewer=None, object_id=None) -> None
apps.trust.services.recompute_trust(worker) -> WorkerTrust
```
`log_profile_view` must be called wherever a *full* `WorkerProfile` (unmasked phone, history) is
served: `GET /org/applications/{id}` when the profile is visible, `GET /org/employments/{id}`,
`GET /ops/workers/{id}`, partner data pulls, passport views. Never log the worker viewing themself.

**Verification level** (highest satisfied, cumulative):
0 phone verified (has a phone) · 1 identity verified (`verification_status=verified`) ·
2 employment verified (≥1 employment with ≥30 recorded attendance days, or an ended employment rated by the employer) ·
3 skills assessed (a passed `credentials.SkillAssessment`) · 4 certification verified (a verified `credentials.Credential`) ·
5 highly trusted (level 4 + reliability ≥ 85 + ≥ 12 months of employment history on platform).
Credentials models may not exist yet in a test DB — import lazily and treat as none.

**Reliability score** (only when the worker has ≥1 employment, else `null`), weights:
30% employer feedback (mean of employer `score_a`,`score_b` over 5; neutral 0.7 if none) ·
20% attendance (last 180 days: (present + 0.5·half_day) / (present+half_day+absent); neutral 0.8 if <10 days) ·
15% job completion (share of ended employments not ended as terminated/absconded; 1.0 if none ended) ·
15% skill verification (1.0 verified credential, 0.7 passed assessment, 0.4 NSTB level declared, else 0.2) ·
10% repeat hiring (1.0 if rehired by an org or rated ≥4 by ≥2 orgs, 0.5 if one rating ≥4, else 0.3) ·
10% stability (min(avg tenure months / 12, 1)). Round to int. `breakdown` stores each component 0–1.
Recompute on: attendance bulk save (debounced via Celery), employment end, rating, verification, credential/assessment change; nightly `apps.trust.tasks.recompute_all`.

**Matching change:** add `+ floor(reliability_score / 20)` (0–5, 0 when null) to the CONTRACT §3 ops match score, reason `"Reliable"` when ≥ 4; total still capped at 100. `WorkerCard` gains `verification_level`, `reliability_score`.

**Endpoints**
- `GET /me/profile-views` → paginated `[{id, organization: {id,name}|null, partner: {id,name}|null, context, context_label, created_at}]`
- `GET /me/trust` → `{verification_level, verification_level_label, reliability_score, breakdown: {employer_feedback, attendance, completion, skills, repeat_hiring, stability}, next_steps: [string]}` (localised hints e.g. "Upload your NSTB certificate")
- `POST /me/employments/{id}/rate {score_a (pay on time), score_b (conditions), comment?}` → worker→employer Rating (only after 30 days of employment or after it ended; once).
- Disputes — worker: `GET|POST /me/disputes`; employer: `GET /org/disputes?status=`, `POST /org/disputes/{id}/respond {note}`; ops: `GET /ops/disputes?status=`, `POST /ops/disputes/{id}/resolve {status: resolved|rejected, note}`. Resolving an attendance/wage dispute does **not** auto-edit records; ops edits through existing endpoints.
- `GET /ops/organizations/{id}` adds `employer_reputation: {pay_on_time_avg, conditions_avg, count}` (only aggregated, ≥3 ratings, else null).

## 2. crews (phase 1 completion — naike as team lead)

**Models**
- `Crew(id, lead OneToOne workers.Worker, name, created_at, is_active)`; members are `Worker.naike = lead` (existing FK).
- `Referral(id, crew, worker, application OneToOne hiring.Application, employment?, amount, status: pending|eligible|paid|void, eligible_at?, paid_at?, payout_ref?, void_reason?, created_at)`.

**Rules:** when an application reaches `joined` and `worker.naike` has an active crew, create a `pending` referral of `NAIKE_REFERRAL_FEE` (paid by KaamSathi, never deducted from the worker). Daily task `apps.crews.tasks.update_referral_eligibility`: after `NAIKE_REFERRAL_HOLD_DAYS` with the employment still active → `eligible`; ended earlier → `void`. Ops marks paid. Hook the creation into hiring via a Django signal on Application save or a call from `move_application` (prefer signal so hiring stays decoupled).

**Endpoints**
- Lead (worker user who leads a crew): `GET /me/crew` → `{id, name, members: [WorkerCard + {is_available, current_employer|null}], stats: {members, placed_90d, earned_total, pending_total}}`; `POST /me/crew {name}` (become a lead); `POST /me/crew/members {phone, full_name, trade, years_experience?}` (creates/links Worker with `naike=lead`, `verification_status=unverified`, sends the member an SMS invite; the member's consent is recorded only when they log in and accept via `POST /me/consents`); `DELETE /me/crew/members/{worker_id}`; `GET /me/crew/referrals`.
- Ops: `GET /ops/crews`, `GET /ops/crews/{id}`, `GET /ops/referrals?status=`, `POST /ops/referrals/{id}/mark-paid {payout_ref}`, `POST /ops/referrals/{id}/void {reason}`.

## 3. credentials (phase 2)

**Models**
- `Credential(id, worker, kind: nstb|ctevt_training|training_course|license|safety|language|other, title, issuer, certificate_no?, level?, issued_on?, expires_on?, document file?, status: pending|verified|rejected|expired, verification_method: document|issuer_registry|issuer_partner|ops_call?, verified_by?, verified_at?, note?, created_at)`.
- `SkillAssessment(id, worker, trade, assessor_user?, assessor_partner? (partners.Partner), assessed_on, result: pass|fail, score?, level?, notes?)`.
- `Passport(worker OneToOne, public_code unique 10 chars [a-z0-9], is_public bool=False, show_contact bool=False, updated_at)` — created lazily.
- `PassportShare(id, worker, token unique 32 urlsafe, audience_label, purpose: job|recruitment_agency|bank|other, expires_at (≤ 90 days), include_contact bool, views int, revoked_at?, created_at)`.

**Issuer verification adapter** `apps/credentials/verifiers.py`: `class Verifier: def verify(credential) -> VerificationResult`; `ManualVerifier` (ops) is the only enabled one; `NSTBRegistryVerifier` stub raising `NotConfigured` until a data agreement exists.

**Passport payload** (shared by public + share endpoints, verified data only):
`{name, photo_url?, trade_primary, districts, verification_level, reliability_score, identity: {citizenship: bool, phone: bool, address: bool}, skills: [{trade, years, nstb_level}], credentials: [{kind, title, issuer, level, issued_on, expires_on, verified: true}], work: {verified_employers, total_months, completed_jobs, attendance_rate}, availability: {is_available, expected_monthly_wage?}, contact?: {phone}, verify_url, generated_at}` — only verified credentials; contact only when allowed.

**Endpoints**
- Worker: `GET|POST /me/credentials` (multipart document), `DELETE /me/credentials/{id}` (pending only); `GET /me/passport`, `PATCH /me/passport {is_public, show_contact}`; `GET|POST /me/passport/shares {audience_label, purpose, days, include_contact}` → `{..., url: PUBLIC_WEB_URL + "/p/s/<token>"}`; `POST /me/passport/shares/{id}/revoke`; `GET /me/passport.pdf` (bilingual, QR to verify_url).
- Public (no auth, throttled `anon`): `GET /public/passport/{public_code}` (404 unless `is_public`), `GET /public/passport/s/{token}` (404 if expired/revoked; increments views; logs ProfileView context=passport).
- Employer: `GET /org/credentials/expiring?days=30` → credentials of the org's active workers expiring within N days.
- Ops: `GET /ops/credentials?status=pending`, `POST /ops/credentials/{id}/verify {status: verified|rejected, method, note?}`, `GET|POST /ops/assessments`, `GET /ops/workers/{id}/credentials`.
- Daily `apps.credentials.tasks.expiry_reminders`: mark past-expiry `expired`; SMS worker 30 and 7 days before expiry.
- After any verify/assessment change call `apps.trust.services.recompute_trust`.

## 4. training (phase 2)

**Models**
- `TrainingProvider(id, name, name_ne?, kind: ctevt_affiliated|private|ngo|employer|government, ctevt_affiliation_no?, district, address?, phone, email?, partner? (partners.Partner), is_active)`.
- `Course(id, provider, trade, title, title_ne?, description?, level: basic|level1|level2|level3|refresher, duration_days, fee, sponsor_note?, mode: classroom|on_site|online, district, starts_on, seats, status: open|closed|completed, leads_to_nstb bool)`.
- `Enrollment(id, course, worker, status: applied|enrolled|completed|dropped|rejected, sponsored_by_org?, applied_at, completed_on?, credential? (credentials.Credential), unique(course, worker))`.

**Shortage engine** `apps/training/services.py: shortages(district=None, days=90)` → per trade: `demand` = Σ(openings_count − joined) over jobs open or created in the window; `supply` = available verified workers with that trade (district-filtered if given); `shortage = max(demand − supply, 0)`; `fill_rate`; sorted by shortage. Reused by insights.

**Endpoints**
- Worker: `GET /me/courses?trade=` (open courses; `recommended: true` for the worker's trades or top shortages) · `POST /me/enrollments {course_id}` · `GET /me/enrollments`.
- Employer: `GET /org/courses` · `POST /org/enrollments {course_id, worker_ids}` (sponsor own active workers; fee noted, not charged by us) · `GET /org/enrollments`.
- Ops: CRUD `/ops/training/providers`, `/ops/training/courses`; `GET /ops/training/enrollments?course=`; `POST /ops/training/enrollments/{id}/status {status}` — on `completed` create a verified `Credential(kind=training_course, verification_method=issuer_partner)`; `GET /ops/training/shortages?district=`.

## 5. compliance (phase 2)

**Models**
- `EmploymentContract(id, employment, version int, generated_at, language en|ne|both, accepted_at?, accepted_channel: app|sms|paper?, file?)` — new version when wage/designation/site changes.
- `SSFFiling(id, run OneToOne payroll.PayrollRun, status: prepared|submitted|acknowledged, due_date, prepared_at, submitted_on?, receipt_no?, file, prepared_by, note?)`.
- `Contractor(id, organization, name, pan_no?, phone, lead_worker? (workers.Worker), trades M2M workers.Trade, is_active, created_at)`; `ContractorAssignment(employment OneToOne workforce.Employment, contractor, assigned_on)`.

**Contract PDF** (bilingual appointment letter, Labour Act 2074 essentials): parties, designation, site, start date, wage type, basic/DA/allowances or daily wage, working hours 8/day 48/week, weekly off, OT 1.5×, leave entitlements (home 1 day per 20 worked, sick 12/yr, mourning 13, maternity 98 / paternity 15), SSF enrolment, probation, notice, grievance channel, signatures. Mark clearly "template — review with a labour lawyer" in admin + docs.

**SSF filing**: `due_date` = BS month end + `SSF_DUE_DAYS` days. File = XLSX + CSV with one row per SSF-enrolled payslip: `ssf_id, worker name, citizenship_no, basic_earned, employee_11, employer_20, total_31, bs_year, bs_month`; workers missing `ssf_id` listed in a second sheet "Missing SSF ID". We prepare the file; the employer uploads it to the SSF portal and records the receipt.

**Endpoints**
- `GET /org/employments/{id}/contract` (latest + versions) · `POST /org/employments/{id}/contract` (generate new version) · `GET /org/employments/{id}/contract.pdf`.
- Worker: `GET /me/employments/{id}/contract.pdf` · `POST /me/employments/{id}/contract/accept`.
- `POST /org/payroll-runs/{id}/ssf-filing` (approved/paid runs only) → SSFFiling · `GET /org/ssf-filings` · `PATCH /org/ssf-filings/{id} {status, submitted_on?, receipt_no?}` · `GET /org/ssf-filings/{id}/file.xlsx`.
- `GET /org/compliance` → `{score 0–100, items: [{key, status ok|warning|action, count, message, link}]}` keys: `ssf_employer_registered`, `workers_missing_ssf_id`, `ssf_filings_overdue`, `below_minimum_wage`, `contracts_missing`, `contracts_unaccepted`, `attendance_unmarked_7d`, `payroll_not_run_last_month`, `credentials_expiring`.
- Contractors: CRUD `/org/contractors`; `POST /org/contractors/{id}/assign {employment_ids}`; `GET /org/contractors/{id}/summary?bs_year=&bs_month=` (headcount, days, wages from payslips). Employments list filter `?contractor=`.
- Daily `apps.compliance.tasks.ssf_reminders`: SMS org owner/hr 5 days and 1 day before an unfiled SSF due date.

## 6. payouts (phase 2)

**Models**
- `PayoutBatch(id, run payroll.PayrollRun, provider: bank_file|esewa|khalti|connectips, status: draft|submitted|processing|completed|partially_failed|cancelled, created_by, submitted_at?, completed_at?, file?, totals json)`.
- `PayoutItem(id, batch, payslip OneToOne-per-batch, amount, method, account_name?, account_no?, bank_name?, wallet_id?, status: pending|sent|paid|failed, provider_ref?, failure_reason?, updated_at)`.

**Adapters** `apps/payouts/providers.py`: `class Provider: code; def submit(batch) -> None; def parse_webhook(request) -> list[ItemUpdate]`. `BankFileProvider` (enabled): generates the bank bulk-transfer file (generic CSV + XLSX: name, account, bank, amount, narration "Salary <month>"); employer uploads to their bank; ops/employer marks items paid individually or by uploading the bank's result CSV (`POST /org/payouts/{id}/reconcile` multipart). `EsewaProvider`, `KhaltiProvider`, `ConnectIPSProvider`: stubs raising `NotConfigured` unless code is in `PAYOUT_PROVIDERS` *and* credentials are set; webhook signature = HMAC-SHA256 of the raw body with `PAYOUT_WEBHOOK_SECRETS[provider]`, header `X-Signature`.

**Rules:** only approved runs; only payslips with `payment_method` matching the provider (bank_file takes bank; cash excluded with a count). When every item in all batches of a run is paid → call payroll `mark_paid` for that run. Never store full card/wallet credentials.

**Endpoints:** `POST /org/payroll-runs/{id}/payouts {provider}` · `GET /org/payouts?run=` · `GET /org/payouts/{id}` (with items) · `POST /org/payouts/{id}/submit` · `POST /org/payouts/{id}/items/{item_id}/mark {status, provider_ref?, failure_reason?}` · `POST /org/payouts/{id}/reconcile` · `GET /org/payouts/{id}/file.csv` · `POST /webhooks/payouts/{provider}` (no auth, signature).

## 7. scheduling (phase 2)

**Model** `RosterEntry(id, employment, date, shift? (orgs.Shift), site?, is_off bool, note?, created_by, updated_at) unique(employment, date)`.

**Endpoints:** `GET /org/roster?week_start=YYYY-MM-DD&site=` → `{days: [date + date_bs], rows: [{employment_id, worker_name, designation, cells: {"<date>": {shift_id, site_id, is_off}|null}}]}` · `PUT /org/roster {entries: [{employment_id, date, shift_id?, site_id?, is_off}]}` (upsert; supervisors limited to their sites) · `POST /org/roster/copy-week {from_week_start, to_week_start, site?}` · `GET /me/roster?week_start=` (worker's own shifts). Attendance day view (`/org/attendance/day`) adds `rostered_shift` per row when present.

## 8. partners (phase 3)

**Models**
- `Partner(id, name, kind: bank|microfinance|insurer|wallet|training|recruitment_agency|government, license_no?, regulator: nrb|beema_samiti|dofe|ctevt|other?, contact_email, contact_phone, is_active, webhook_url?, created_at)`.
- `PartnerAPIKey(id, partner, prefix 8 chars, key_hash, scopes json [profile.read, earnings.read, passport.read, referrals.write], created_at, last_used_at?, revoked_at?)` — full key shown once at creation: `ks_<prefix>_<secret>`.
- `ConsentGrant(id, worker, partner, purpose: loan_assessment|insurance|ewa|recruitment|training|verification, scopes json, granted_at, expires_at (≤ PARTNER_GRANT_MAX_DAYS), revoked_at?, channel app|sms|ops)`; every grant also writes a `workers.Consent(scope=history_share, organization=None)` row for audit.
- `PartnerAccessLog(id, partner, api_key, worker?, endpoint, scope, status_code, created_at)`.

**Auth:** `Authorization: Partner ks_<prefix>_<secret>` → DRF authentication class in `apps/partners/auth.py`; scope checked per endpoint; a worker's data is readable only with an active, unexpired, unrevoked grant covering that scope. Every read → `PartnerAccessLog` + `trust.log_profile_view(context=partner)`.

**Partner API (`/partner/*`):** `GET /partner/workers/{worker_id}/profile` (passport payload) · `GET /partner/workers/{worker_id}/earnings` (finance profile) · `GET /partner/grants?status=active` · `POST /partner/referrals/{id}/status {status, partner_ref?, amount_approved?, note?}` · `GET /partner/referrals?status=`.

**Worker:** `GET /me/partners` (active partners by kind, with what they offer) · `GET|POST /me/grants {partner_id, purpose, scopes, days}` · `POST /me/grants/{id}/revoke` · `GET /me/partner-access` (access log for the worker).
**Ops:** CRUD `/ops/partners`; `POST /ops/partners/{id}/keys {scopes}` → `{key (once), prefix}`; `POST /ops/partners/{id}/keys/{key_id}/revoke`; `GET /ops/partners/{id}/access-log`.
Hourly `apps.partners.tasks.expire_grants`.

## 9. finance (phase 3)

**Models**
- `FinancialProfile(worker OneToOne, months_on_platform, verified_months, avg_monthly_net, min_monthly_net, max_monthly_net, income_stability 0–1 (1 − coefficient of variation, floored at 0), employers_count, current_employment_months, ssf_months, last_payslip_month, monthly: json [{bs_year, bs_month, gross, net, employer, paid: bool}], computed_at)` — built only from payslips with `payment_status=paid` (verified earnings).
- `Offer(id, partner, kind: loan|ewa|insurance|savings|tool_finance|vehicle_finance, title, title_ne?, description, min_verified_months, min_avg_net?, max_amount?, interest_note? (partner-stated, displayed verbatim), is_active)`.
- `Referral(id, worker, offer, partner, grant ConsentGrant, amount_requested?, purpose_note?, status: submitted|under_review|approved|rejected|disbursed|closed, partner_ref?, amount_approved?, created_at, updated_at)` — status is set by the partner via the partner API; we never set approved/disbursed ourselves.

**Rules:** eligibility (`eligible: bool, reasons: []`) = offer thresholds vs FinancialProfile. Applying creates the ConsentGrant (purpose from offer kind, scopes `earnings.read`,`profile.read`) then the Referral, and notifies the partner (`webhook_url` POST, signed). Display "Offered by <partner>, regulated by <regulator>"; no fees to the worker added by us. Nightly `apps.finance.tasks.refresh_all_profiles`.

**Endpoints:** Worker `GET /me/financial-profile` · `GET /me/offers` (with eligibility) · `POST /me/offers/{id}/apply {amount_requested?, purpose_note?, days?}` · `GET /me/referrals`. Ops `GET /ops/finance/referrals?status=&partner=`, `GET|POST|PATCH /ops/finance/offers`, `GET /ops/finance/summary` (referrals by status/partner, approval rate, disbursed total).

## 10. insights (phase 2–3, aggregates only)

Never expose a single worker; suppress any cell with fewer than 5 workers (`k_anonymity = 5`).
- Employer `GET /org/analytics?months=6` → `{headcount_trend [{bs_year,bs_month,active,joined,left}], attrition_rate, avg_tenure_months, time_to_fill_days_avg, time_to_shortlist_hours_avg, attendance_rate_trend, overtime_hours_trend, wage_bill_trend [{month, gross, net, employer_cost}], cost_per_hire, absenteeism_by_site, top_absence_weekdays}`.
- Ops `GET /ops/insights/labour-market?district=&trade=` → `{wages: [{trade, district, median_monthly, p25, p75, sample}], demand: [{trade, open_positions, filled_90d, avg_days_to_fill}], supply: [{trade, registered, verified, available}], shortages (training.shortages), certification_uplift: [{kind_or_level, median_net_with, median_net_without, uplift_pct, sample}], origin_districts: [{district, workers}]}`.
- `GET /ops/insights/export.csv?report=` for the same tables.

## 11. privacy (phase 1 production requirement — Individual Privacy Act 2075)

**Models** `PrivacyRequest(id, worker? , user, kind: export|correction|deletion, status: received|in_progress|completed|rejected, details?, response_note?, file?, file_expires_at?, created_at, completed_at?, handled_by?)`.
**Rules:** export = JSON + PDF bundle of everything we hold on the worker (profile, consents, employments, attendance, payslips, credentials, ratings given/received aggregated, profile views, grants, referrals), generated by Celery, link valid `PRIVACY_EXPORT_TTL_HOURS`. Deletion = anonymise the worker's profile and documents (name → "Deleted worker", phone hashed, documents deleted, passport/grants revoked) **but keep** payroll and attendance rows the employer is legally required to retain, linked to the anonymised record; ops approves. Correction routes to ops/dispute flow.
**Endpoints:** `GET|POST /me/privacy-requests` · `GET /me/privacy-requests/{id}/download` · ops `GET /ops/privacy-requests`, `POST /ops/privacy-requests/{id}/process {action: approve|reject, note}`. Daily `apps.privacy.tasks.process_requests` purges expired export files.

---

## Web (Next.js) ownership for new areas
Nav entries and `lib/api/index.ts` exports are pre-wired. Each area owns `lib/api/hooks/<area>.ts`
(define query keys locally, do not edit `keys.ts`), `lib/api/types-<area>.ts`, `components/<area>/`,
`messages/src/<area>.{en,ne}.json` (own namespace = area name), and its routes:

| Area | Employer routes (`/app`) | Ops routes (`/ops`) | Public |
| --- | --- | --- | --- |
| trust + crews | `/app/disputes`; trust badge in shared worker card | `/ops/disputes`, `/ops/crews`, `/ops/crews/[id]` | — |
| credentials + training | `/app/training`; expiring credentials card on `/app/compliance` is owned by compliance (use the hook) | `/ops/credentials`, `/ops/training` (providers, courses, enrolments, shortages) | `/p/[code]`, `/p/s/[token]` (Skill Passport, no auth) |
| compliance + payouts + scheduling | `/app/compliance`, `/app/contractors`, `/app/roster`; contract + payout panels inside existing worker and payroll pages | — | — |
| partners + finance + insights | `/app/analytics` | `/ops/partners`, `/ops/finance`, `/ops/insights` | `/partners/docs` (partner API reference) |
| privacy | — | `/ops/privacy` | `/privacy`, `/terms` (draft legal pages, flagged for lawyer review) |

## Mobile (Flutter) additions — worker app unless noted
Trust card + level + next steps, profile-view log, disputes, rate employer · crew (naike lead) tab ·
credentials upload, Skill Passport (toggle public, share links via share sheet, PDF) · courses &
enrolments · contract view + accept · financial profile, offers, apply (consent screen showing partner,
regulator, scopes, duration), referrals, grants + revoke, partner access log · privacy requests ·
supervisor: roster view for the week.
