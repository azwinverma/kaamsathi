# KaamSathi — System contract (source of truth for backend, web, mobile)

Phase 1 = **Hire** (job openings → candidate pipeline → join) + **Manage**
(employments, hajiri, leave, peski) + **Payroll** (BS-month wage sheet, SSF, payslips)
+ **Ops console** (worker verification, matching, shortlisting) + **Worker self-service**.

Repo layout:
```
kaamsathi/
  backend/   Django 5 + DRF + PostgreSQL 16 + Redis + Celery   (port 8000)
  web/       Next.js 15 App Router + TS + Tailwind v4           (port 3000)
  mobile/    Flutter 3 app (supervisor + worker modes)
  docs/      this contract, DESIGN.md, GLOSSARY.md
  docker-compose.yml, Makefile, .github/workflows/ci.yml
```

## 1. Conventions
- Base URL `/api/v1`. JSON only (except exports). snake_case keys.
- IDs: UUID strings. Money: decimal **strings** with 2 places (`"19550.00"`).
- Dates: AD ISO `YYYY-MM-DD` stored and sent. Every date field `x` in a response
  is accompanied by `x_bs` = `"2083-06-21"` (BS, zero-padded). Datetimes ISO 8601 with offset, timezone Asia/Kathmandu.
- Auth: `Authorization: Bearer <access JWT>` (SimpleJWT; access 30 min, refresh 30 days, rotating).
- Org scoping: every `/org/*` request sends header `X-Org-Id: <organization uuid>`;
  server checks the user has a Membership there. Missing/invalid → 403 `org_forbidden`.
- Pagination (list endpoints): `?page=1&page_size=25` (max 100) →
  `{"count": n, "next": url|null, "previous": url|null, "results": [...]}`.
- Search/filter via query params as listed. Ordering via `?ordering=field|-field`.
- Errors: HTTP status + `{"error": {"code": "snake_code", "message": "Human text", "fields": {"field": ["msg"]}}}`.
  Codes used: `validation_error`, `not_authenticated`, `permission_denied`, `org_forbidden`,
  `not_found`, `otp_invalid`, `otp_expired`, `otp_rate_limited`, `below_minimum_wage`,
  `invalid_state`, `outside_geofence`, `duplicate`.
- Language: `Accept-Language: en|ne` — server localises `message` and `*_label` fields.
- Roles (Membership.role): `owner`, `admin`, `hr`, `supervisor`.
  supervisor = only attendance/leave for their assigned sites + read employments of those sites.
  hr/admin/owner = everything in the org; only owner/admin manage members & billing.
- Ops staff = `user.is_staff` → `/ops/*`.

## 2. Data model (backend apps)

**accounts**: `User(id, phone unique 10 digits ^9[78]\d{8}$, full_name, email?, preferred_language en|ne, is_staff, is_active, date_joined, last_login)`; `PhoneOTP(phone, code_hash, purpose=login, expires_at (+5 min), attempts ≤5, consumed_at)`; rate limit 5 requests/phone/hour. In DEBUG with `OTP_DEV_CODE` set, that code always works and `dev_code` is returned.

**geo** (seeded): `Province(code 1–7, name_en, name_ne)` — Koshi, Madhesh, Bagmati, Gandaki, Lumbini, Karnali, Sudurpashchim; `District(code slug e.g. "kathmandu", name_en, name_ne, province)` — all 77.

**orgs**: `Organization(id, name, name_ne?, pan_no?, vat_registered bool, ssf_employer_no?, industry: hospitality|healthcare|security|construction|manufacturing|retail|other, district FK, municipality, ward int?, address, phone, email?, logo?, plan: pilot|standard, weekly_off_day 0–6 (default 6=Saturday), created_at, is_active)`;
`Membership(id, user, organization, role, sites M2M Site, is_active, created_at)` unique(user, organization);
`Site(id, organization, name, address, district FK, lat?, lng?, geofence_radius_m=200, qr_token uuid, is_active)`;
`Shift(id, organization, name, start_time, end_time, break_minutes=60)`.

**workers**: `Trade(code, name_en, name_ne, category: construction|hospitality|security|healthcare|manufacturing|transport|general)` (seeded list in GLOSSARY);
`Worker(id, user OneToOne? , full_name, full_name_ne?, phone unique, gender male|female|other, date_of_birth?, permanent_district FK?, current_district FK?, address?, citizenship_no?, nid_no?, id_front image?, id_back image?, photo image?, verification_status unverified|pending|verified|rejected, verified_by?, verified_at?, verification_note?, expected_monthly_wage?, is_available bool, available_from?, payment_method bank|esewa|khalti|cash, bank_name?, bank_account_no?, bank_account_name?, wallet_id?, ssf_id?, naike FK Worker?, notes?, created_at, updated_at)`;
`WorkerSkill(worker, trade, years_experience int, nstb_level none|elementary|level1|level2|level3, certificate_no?)` unique(worker, trade);
`Consent(id, worker, organization?, scope: data_processing|profile_share|history_share, granted bool, channel app|sms|paper|ops, created_at)` — latest row per (worker, org, scope) wins;
`Rating(id, employment, rater: employer|worker, score_a 1–5 (employer: reliability / worker: pay on time), score_b 1–5 (employer: skill / worker: conditions), comment?, created_at)` unique(employment, rater).

**hiring**: `MinimumWage(effective_from, monthly_basic, monthly_da, monthly_total, daily, hourly, hourly_part_time)` seeded effective 2025-07-17: basic 12170, DA 7380, total 19550, daily 754, hourly 101, part-time hourly 107;
`JobOpening(id, organization, site?, trade FK, title, description, openings_count, wage_type monthly|daily, wage_amount, shift FK?, food_provided bool, accommodation_provided bool, start_date, min_experience_years=0, status draft|open|filled|closed, created_by, created_at, published_at?, first_shortlist_at?)` — validation: monthly ≥ current minimum monthly, daily ≥ minimum daily → 400 `below_minimum_wage`;
`Application(id, job, worker, stage sourced|shortlisted|interview|selected|joined|rejected|dropped, interview_at?, notes?, rejection_reason?, sourced_by user?, created_at, stage_changed_at)` unique(job, worker); `StageEvent(application, from_stage, to_stage, by user, note, created_at)`.
Job auto → `filled` when joined count ≥ openings_count.

**workforce**: `Employment(id, organization, worker, site?, trade FK?, designation, employee_code?, start_date, end_date?, status active|ended, end_reason resigned|terminated|contract_end|absconded|other?, wage_type monthly|daily, basic_salary?, dearness_allowance?, other_allowance=0, daily_wage?, ssf_enrolled bool, supervisor user?, shift FK?, application FK?, replacement_eligible_until? (start+30d when via application), created_at)` — one active employment per (worker, org); monthly needs basic+DA ≥ minimum; daily ≥ minimum daily.
`Attendance(id, employment, date, status present|absent|half_day|leave|holiday|weekly_off, check_in_at?, check_out_at?, check_in_lat/lng?, check_out_lat/lng?, method qr|manual|supervisor|self, overtime_minutes=0, recorded_by?, client_uuid unique?, note?, updated_at)` unique(employment, date);
`LeaveRequest(id, employment, leave_type home|sick|maternity|paternity|mourning|unpaid, from_date, to_date, days, reason?, status pending|approved|rejected, decided_by?, decided_at?)` — on approve, writes `leave` Attendance rows;
`Advance(id, employment, amount, given_on, recover_per_month, recovered_amount, note?)`;
`Holiday(id, organization? null=national, date, name_en, name_ne)`.

**payroll**: `PayrollRun(id, organization, bs_year, bs_month, period_start, period_end, days_in_month, include_festival_allowance bool, status draft|approved|paid, approved_by?, approved_at?, paid_at?, created_at)` unique(org, bs_year, bs_month);
`Payslip(id, run, employment, worker, wage_type, days_in_month, present_days decimal(5,1), paid_leave_days, holiday_days, weekly_off_days, absent_days, payable_days, overtime_hours, basic_earned, da_earned, allowance_earned, overtime_pay, festival_allowance, gross_pay, ssf_employee, ssf_employer, tds, advance_recovery, other_deductions, net_pay, note?, payment_method, payment_status pending|paid, paid_at?, payment_ref?)`;
`TaxSlab(fiscal_year "2083/84", lower, upper?, rate%, applies_to single)` seeded: 0–5,00,000 @1% (waived when ssf_enrolled) · 5,00,000–7,00,000 @10% · 7,00,000–10,00,000 @20% · 10,00,000–20,00,000 @30% · 20,00,000–50,00,000 @36% · >50,00,000 @39%. **Mark in admin: "verify each fiscal year".**

Payroll calculation (per active employment overlapping the BS month, prorated by join/end date):
1. `days_in_month` = BS month length. Count attendance in period: present=1, half_day=0.5, leave(approved paid types; unpaid excluded), holiday, weekly_off. Days with no record: if date is org weekly_off_day or a Holiday → weekly_off/holiday (paid); otherwise **absent**.
2. Monthly: `payable_days = present + paid_leave + holiday + weekly_off` (only days within employment); `basic_earned = basic × payable/dim`, same for DA and other_allowance.
   Daily: `payable_days = present` (+ paid holidays only if worked ≥ 1 day that week — keep simple: present only); `wage = daily_wage × payable_days`, split into basic/DA using MinimumWage basic:total ratio.
3. OT: hourly = (basic+DA)/(dim×8) monthly or daily_wage/8 daily; `overtime_pay = hours × hourly × 1.5`.
4. Festival allowance (if flag): basic_salary (monthly) or daily_wage×30×basic ratio (daily) × min(months_employed/12, 1).
5. `gross = basic+da+allowance+ot+festival`.
6. SSF if ssf_enrolled: employee 11% of basic_earned, employer 20% of basic_earned (employer share not deducted from net).
7. TDS: annualise (gross − ssf_employee)×12, apply slabs (skip 1% slab if ssf_enrolled), divide by 12, round to rupee.
8. Advance recovery = min(recover_per_month, amount − recovered); on `mark-paid` add to recovered_amount.
9. `net = gross − ssf_employee − tds − advance_recovery − other_deductions`. All rounding to 2 dp, ROUND_HALF_UP.

**billing**: `Charge(id, organization, kind placement|subscription, amount, description, bs_year?, bs_month?, application?, status unpaid|paid|waived, created_at)`. Placement charge NPR 5,000 created when an application reaches `joined` (waived if it replaces an employment ended within its replacement window). Subscription: Celery beat on BS month start → `max(active_workers × 150, 3000)`.

**audit**: `AuditLog(id, actor?, organization?, action, object_type, object_id, changes json, ip?, created_at)` — written for create/update/delete on org-owned models and all ops actions.

**notifications**: SMS adapter setting `SMS_BACKEND = console|sparrow|aakash` (Sparrow SMS & Aakash SMS are the common Nepali gateways); Celery tasks: send OTP, interview reminder (2h before), payslip ready.

## 3. Endpoints

### Health & reference (no auth)
- `GET /health` → `{"status":"ok"}`
- `GET /ref/provinces` · `GET /ref/districts?province=3` → `[{code, name_en, name_ne, province}]` (unpaginated)
- `GET /ref/trades` → `[{code, name_en, name_ne, category}]`
- `GET /ref/minimum-wage` → `{effective_from, effective_from_bs, monthly_basic, monthly_da, monthly_total, daily, hourly, hourly_part_time}`
- `GET /ref/calendar/today` → `{ad, bs, bs_year, bs_month, bs_day, bs_month_name_en, bs_month_name_ne, formatted_en "21 Ashwin 2083", formatted_ne "२१ असोज २०८३", fiscal_year "2083/84"}`
- `GET /ref/calendar/convert?ad=YYYY-MM-DD` or `?bs=YYYY-MM-DD` → same shape as today
- `GET /ref/calendar/month?bs_year=2083&bs_month=6` → `{bs_year, bs_month, name_en, name_ne, start_ad, end_ad, days, days_list:[{ad, bs_day, weekday 0=Sun}]}`

### Auth
- `POST /auth/otp/request {phone}` → `{"sent": true, "expires_in": 300, "dev_code"?: "123456"}`
- `POST /auth/otp/verify {phone, code}` → `{access, refresh, user: Me}` (creates user if new)
- `POST /auth/token/refresh {refresh}` → `{access, refresh}`
- `POST /auth/logout {refresh}` → 204 (blacklist)
- `GET /auth/me` → `Me`; `PATCH /auth/me {full_name?, email?, preferred_language?}`
- `Me` = `{id, phone, full_name, email, preferred_language, is_staff, worker_id: uuid|null, memberships: [{id, role, organization: {id, name, logo, industry}, site_ids: []}]}`

### Organization (X-Org-Id required except POST/GET /orgs)
- `GET /orgs` (mine) · `POST /orgs {name, pan_no?, industry, district, municipality?, ward?, address, phone, email?}` → Organization (caller = owner)
- `GET /org` · `PATCH /org` (owner/admin)
- `GET /org/dashboard` → `{today, today_bs, active_workers, present_today, absent_today, on_leave_today, not_marked_today, open_jobs, pipeline: {sourced, shortlisted, interview, selected}, hires_30d, attrition_30d, last_payroll: {id, bs_year, bs_month, net_total, status}|null, attendance_14d: [{date, date_bs, present, absent, leave}], wage_bill_month_estimate}`
- Members: `GET /org/members` · `POST /org/members {phone, full_name, role, site_ids?}` (creates user if needed) · `PATCH /org/members/{id}` · `DELETE /org/members/{id}`
- Sites: CRUD `/org/sites`, `/org/sites/{id}`; `GET /org/sites/{id}/qr.png` (QR encodes `kaamsathi://site/<qr_token>`); `POST /org/sites/{id}/rotate-qr`
- Shifts: CRUD `/org/shifts`

### Hiring
- `GET /org/jobs?status=&trade=&q=` · `POST /org/jobs` · `GET|PATCH|DELETE(draft only) /org/jobs/{id}`
- `POST /org/jobs/{id}/publish` (draft→open) · `POST /org/jobs/{id}/close`
- Job response includes `trade: {code, name_en, name_ne}`, `site: {id, name}|null`, `counts: {sourced, shortlisted, interview, selected, joined, rejected, dropped}`, `status_label`.
- `GET /org/applications?job=&stage=&q=` → Application with `worker: WorkerCard`, `job: {id, title}`, `stage_label`
- `GET /org/applications/{id}` (includes `events` and full `worker: WorkerProfile` if consent `profile_share` granted for this org or worker shortlisted to it)
- `POST /org/applications/{id}/move {stage, interview_at?, note?, rejection_reason?, employment?: {start_date, site_id?, designation?, wage_type, basic_salary?, dearness_allowance?, daily_wage?, ssf_enrolled}}` — `employment` required when stage=joined; returns `{application, employment_id?}`. Allowed transitions: sourced→shortlisted|rejected; shortlisted→interview|selected|rejected|dropped; interview→selected|rejected|dropped; selected→joined|dropped; any terminal → none (400 `invalid_state`).
- `WorkerCard` = `{id, full_name, phone_masked "98XXXXX123", photo, verification_status, district: {code,name_en,name_ne}, skills: [{trade, years_experience, nstb_level}], total_experience_years, rating_avg|null, placements_count}`
- `WorkerProfile` = WorkerCard + `{phone, gender, date_of_birth, address, history: [{organization_name, trade, start_date, end_date, months, rating}]}`

### Workforce
- `GET /org/employments?status=active&site=&trade=&q=&wage_type=` · `GET|PATCH /org/employments/{id}`
- `POST /org/employments` — onboard existing staff: `{worker: {phone, full_name, gender?, citizenship_no?, ...} | worker_id, site_id?, designation, start_date, wage_type, basic_salary?, dearness_allowance?, other_allowance?, daily_wage?, ssf_enrolled, employee_code?}` (worker matched by phone or created)
- `POST /org/employments/import` multipart `file` (CSV/XLSX: full_name, phone, designation, start_date (AD or BS `2081-04-01` with column `date_system`), wage_type, basic_salary, dearness_allowance, daily_wage, ssf_enrolled) → `{created, updated, errors: [{row, message}]}`; `GET /org/employments/import-template.xlsx`
- `POST /org/employments/{id}/end {end_date, end_reason}` · `POST /org/employments/{id}/rate {score_a, score_b, comment?}`
- Employment response: `{id, worker: WorkerCard, site, trade, designation, employee_code, start_date(+_bs), end_date(+_bs), status, wage_type, basic_salary, dearness_allowance, other_allowance, daily_wage, monthly_gross, ssf_enrolled, supervisor, replacement_eligible_until}`

### Hajiri (attendance)
- `GET /org/attendance/day?date=YYYY-MM-DD&site=` → `{date, date_bs, is_holiday, holiday_name, rows: [{employment_id, worker: {id, full_name, photo}, designation, site_id, record: Attendance|null}], summary: {present, absent, half_day, leave, not_marked}}`
- `GET /org/attendance/register?bs_year=&bs_month=&site=` → `{bs_year, bs_month, month_name_en, month_name_ne, days: [{date, bs_day, weekday, is_holiday, is_weekly_off}], rows: [{employment_id, worker_name, designation, cells: {"<ad date>": "P"|"A"|"H"|"L"|"PH"|"WO"|null}, totals: {present, half_day, absent, leave, overtime_hours}}]}`
- `POST /org/attendance/bulk {records: [{client_uuid, employment_id, date, status, check_in_at?, check_out_at?, lat?, lng?, method, overtime_minutes?, note?}]}` → `{saved: [client_uuid], errors: [{client_uuid, code, message}]}` — idempotent upsert on (employment, date); supervisors limited to their sites; payroll-approved months are locked (`invalid_state`).
- `Attendance` = `{id, employment_id, date, date_bs, status, status_label, check_in_at, check_out_at, method, overtime_minutes, note}`
- Leave: `GET /org/leaves?status=` · `POST /org/leaves` · `POST /org/leaves/{id}/approve` · `POST /org/leaves/{id}/reject {note?}`
- Peski: `GET /org/advances?employment=` · `POST /org/advances` · `PATCH /org/advances/{id}`
- Holidays: `GET /org/holidays?bs_year=` (national + org) · `POST /org/holidays` · `DELETE /org/holidays/{id}` (org only)

### Payroll
- `GET /org/payroll-runs` · `POST /org/payroll-runs {bs_year, bs_month, include_festival_allowance}` (computes payslips, 400 `duplicate` if exists)
- `GET /org/payroll-runs/{id}` → `{id, bs_year, bs_month, month_name_en, month_name_ne, period_start, period_end, status, totals: {workers, gross, ssf_employee, ssf_employer, tds, advance_recovery, other_deductions, net}, employer_cost}`
- `GET /org/payroll-runs/{id}/payslips?q=` → Payslip list (with `worker: {id, full_name}`, `designation`)
- `POST /org/payroll-runs/{id}/recalculate` (draft) · `POST .../approve` (draft→approved; locks attendance) · `POST .../mark-paid {paid_on, method?}` (approved→paid; marks payslips paid, updates advances, notifies workers)
- `PATCH /org/payslips/{id} {other_deductions?, note?, payment_method?}` (draft only; recomputes net)
- Exports: `GET /org/payroll-runs/{id}/wage-sheet.xlsx` (तलब पाना, bilingual headers) · `GET .../bank-transfer.csv` (name, account, bank, amount) · `GET .../ssf.csv` (ssf_id, name, basic, 11%, 20%, 31%) · `GET /org/payslips/{id}/payslip.pdf`

### Billing
- `GET /org/billing/summary` → `{plan, active_workers, monthly_estimate, unpaid_total}` · `GET /org/billing/charges`

### Worker self-service (user linked to a Worker)
- `GET /me/worker` · `PATCH /me/worker {full_name_ne?, payment_method?, bank_*, wallet_id?, is_available?}` · `POST /me/worker/claim {}` (links user to Worker with same phone, if exists)
- `GET /me/employments` · `GET /me/history` (verified work history)
- `GET /me/attendance?bs_year=&bs_month=` → `{days: [{date, bs_day, status}], totals}`
- `POST /me/attendance/check-in {site_qr_token, lat, lng, client_uuid}` · `POST /me/attendance/check-out {...}` — geofence check (`outside_geofence`)
- `GET /me/payslips` · `GET /me/payslips/{id}` · `GET /me/payslips/{id}/payslip.pdf`
- `GET /me/consents` · `POST /me/consents {organization_id?, scope, granted}`

### Ops console (is_staff)
- `GET /ops/dashboard` → `{organizations, workers, verified_workers, pending_verification, open_jobs, avg_hours_to_shortlist, hires_30d}`
- `GET /ops/workers?q=&trade=&district=&verification_status=&is_available=` · `POST /ops/workers` · `GET|PATCH /ops/workers/{id}`
- `POST /ops/workers/{id}/verify {status: verified|rejected, note?}`
- `GET /ops/jobs?status=open` (all orgs, includes `organization: {id, name}`, `hours_open`)
- `GET /ops/jobs/{id}/matches?limit=20` → `[{worker: WorkerCard, score 0–100, reasons: ["Trade match", "Same district", "Verified", "NSTB Level 2"]}]` — score: trade 50 + district 20 + verified 10 + NSTB 5/level (max 15) + experience 1/yr (max 10) − 10 if expected wage > offer; only `is_available` workers not already in pipeline.
- `POST /ops/jobs/{id}/shortlist {worker_ids: []}` → creates Applications at `shortlisted` (sets job.first_shortlist_at), notifies employer
- `GET /ops/organizations` · `GET /ops/organizations/{id}`

## 4. Demo data (`python manage.py seed_demo`)
- OTP dev code `123456` (DEBUG only).
- `9800000001` owner of **Hotel Annapurna View Pvt. Ltd.** (hospitality, Kathmandu) and of **Shivam Builders & Construction** (construction, Makwanpur).
- `9800000002` supervisor at Hotel Annapurna View, site "Thamel Main Building".
- `9800000003` ops staff (`is_staff`).
- `9800000010` worker user (Ram Bahadur Thapa, cook) employed at the hotel.
- 45 workers (realistic Nepali names, mixed trades/districts, ~70% verified), 30 active employments,
  60 days of attendance, approved+paid run for the previous BS month and a draft for the current one,
  3 open jobs with candidates in every stage, national holidays for 2083 (Dashain, Tihar, Chhath, etc. — approximate dates, editable).
