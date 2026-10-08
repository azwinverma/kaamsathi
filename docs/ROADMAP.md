# KaamSathi — Roadmap

This roadmap uses the phase numbers (0–6) from the reference design
(`nepal-workforce-os/docs/ROADMAP.md`). For each phase it lists what KaamSathi has built, what has
to be true before we switch the phase on for real users (the **gate**), and what remains. The
order is set by the venture strategy, not by the code:
- B2B first, and employers pay
- workers never pay
- we never lend or hold funds
- the worker owns their record
- no foreign recruitment

Much of the code for phases 2–6 is already written. That doesn't mean we launch it. Each phase
waits for its data, partners and agreements, and for proof that phase 1 is wanted.

Legend: ✅ built · 🟡 in progress (CONTRACT-EXTENSIONS workstreams) · ⬜ not started · 🔒 built but
switched off until the gate is met.

---

## Phase 0 — Validation and operating model (now → pilot start)

| Item | Status | Notes |
| --- | --- | --- |
| Employer interviews | ⬜ needs founders | Target 40+ in the pilot ICP: hotels, hospitals/clinics, security companies in Kathmandu Valley. Add 10 construction/MEP and factory interviews to test the later segments. Use [GO_TO_MARKET.md §6](GO_TO_MARKET.md#6-pilot-design-90-days-15-design-partners) for the script. |
| Worker interviews | ⬜ | 100 workers. Half from pilot employers' existing staff, half from labour chowks, naike crews and training institutes. |
| Manual onboarding of first workers | ⬜ | Target 500 verified via [registration camps](ops/worker-registration-camps.md) and employer staff imports (`POST /org/employments/import`). |
| Trades shortlist | ✅ decided | See [GO_TO_MARKET.md §2](GO_TO_MARKET.md#2-trades). Seeded trades are in [GLOSSARY.md](GLOSSARY.md). HVAC/refrigeration and maintenance technician need adding through the taxonomy admin 🟡. |
| Willingness to pay | ⬜ | Run as part of the pilot (≥ 5 of 15 accept paid terms). |
| Legal structure, intermediary model, privacy terms | 🔴 needs lawyer | See [PRODUCTION_CHECKLIST.md → Legal](PRODUCTION_CHECKLIST.md#legal-and-finance). Key question: under the Labour Act 2074, does a placement fee make us a "labour supplier" (श्रम आपूर्तिकर्ता) that needs a licence? Our model: the employer hires directly; we are not employer of record. |
| Operating SOPs | ✅ written | [docs/ops/](ops/). Staff still need training on them. |

**Gate to start the pilot:**
- Production deployed and the checklist's 🔴 launch blockers closed
- 15 design partners signed (free pilot letter)
- SMS sender ID approved
- Privacy policy and terms reviewed by a lawyer

## Phase 1 — Hire, Manage and Worker Passport (pilot: 90 days)

Built ✅:
- **Phone OTP login, roles, org scoping.** `apps/accounts`, `apps/orgs`, `apps/core/permissions.py`; web `/login`, `/onboarding`, `/app/settings/team`.
- **Worker profile, skills, NSTB level, encrypted IDs.** `apps/workers`, `apps/core/crypto.py`; ops `/ops/workers`, `/ops/workers/new`, `/ops/verification`.
- **Identity verification (KYC) queue.** `POST /ops/workers/{id}/verify`; SOP [kyc-identity-verification.md](ops/kyc-identity-verification.md).
- **Jobs with minimum-wage guard, candidate pipeline, 30-day replacement.** `apps/hiring`; `/app/jobs`, `/app/candidates`.
- **Ops matching and shortlisting.** `GET /ops/jobs/{id}/matches`; `/ops/jobs/[id]`.
- **Hajiri (supervisor bulk, offline queue; worker QR + geofence), leave, peski.** `apps/workforce`; `/app/attendance`, `/app/leave`, `/app/advances`; Flutter supervisor `hajiri`, worker `checkin`.
- **BS-month payroll (SSF, TDS, OT, Dashain allowance), payslips, exports.** `apps/payroll`; `/app/payroll`.
- **Ratings both ways, reliability score, verification levels, disputes.** `apps/trust`; `/app/disputes`, `/ops/disputes`.
- **Naike crews and referral rewards.** `apps/crews`; `/ops/crews`.
- **Profile-view log, consents, privacy export/deletion.** `apps/trust`, `apps/workers.Consent`, `apps/privacy`; `/ops/privacy`.
- **Billing: NPR 5,000 placement, NPR 150/worker/month (min 3,000).** `apps/billing`; `/app/billing`.
- **SMS notifications (Sparrow/Aakash).** `apps/notifications`.
- **Audit log.** `apps/audit`.

In progress 🟡:
- employer verification (KYB)
- staff roles and MFA
- worker interest and invitations, matching v2
- external work history with reference checks
- notification inbox and push
- support cases
- risk flags
- append-only audit
- request IDs and idempotency
- upload scanning

**Exit criteria.** Both sets are needed to go wide in Kathmandu Valley.

*Pilot go/no-go (day 90):*
- ≥ **10 of 15** design partners use Manage weekly. "Weekly" means hajiri marked on ≥ 4 days in
  each of the last 4 weeks, plus at least one payroll run.
- ≥ **5 of 15** accept paid terms in writing.

*Phase-1 scale exit* (reference targets, tracked in `/ops/kpis` 🟡, `GET /ops/kpis` → `phase1_exit`):

| Metric | Target |
| --- | --- |
| registered workers | 1,000 (≥ 60% identity-verified) |
| organisations | 50 |
| paying organisations | 20 |
| placements | 100 |
| median time-to-fill for target roles | < 14 days |
| median time-to-shortlist | < 48 h (our own target) |
| dispute rate | < 3% of active employments per month (our own target) |

## Phase 2 — Workforce management depth (built; widen after pilot)

Built ✅:
- sites and QR geofence
- shift roster: `apps/scheduling`, `/app/roster`
- contractor (thekedar) workforce view: `/app/contractors`
- employment contracts in Nepali/English: `apps/compliance`, `/app/compliance`
- SSF filing file and reminders
- compliance score
- credential expiry alerts: `GET /org/credentials/expiring`
- payroll payouts by bank file: `apps/payouts`
- employer analytics: `/app/analytics`

In progress 🟡:
- weekly timesheets with OT approval and the 24 h/week OT cap: `apps/timesheets`, `/app/timesheets`
- enterprise API keys and webhooks: `apps/integrations`, `/app/integrations`, `/developers`

🔒 Gates:
- **Live wallet payouts** (eSewa, Khalti, connectIPS) stay off until there is a signed merchant or
  bulk-payout agreement with each provider (they are NRB-licensed PSPs/PSOs), plus webhook secrets
  in `PAYOUT_WEBHOOK_SECRETS`. Until then: bank file only.
- **Contract template** needs a labour lawyer's review before employers rely on it. It is marked
  "template — review with a labour lawyer".
- **SSF due-day setting** (`SSF_DUE_DAYS = 15`) needs confirming with SSF or an adviser.

Remaining ⬜: leave balances/accrual ledger, overtime pre-approval on mobile, biometric device
import (if pilot partners ask).

## Phase 3 — Credentials and training

Built ✅:
- credentials with manual verification: `apps/credentials`, `/ops/credentials`
- skill assessments
- Skill Passport with public and share links and a PDF: `/p/[code]`, `/p/s/[token]`
- training providers, courses and enrolments: `apps/training`, `/ops/training`, `/app/training`
- shortage engine

In progress 🟡: career recommendations (`GET /me/career`).

🔒 Gates:
- **NSTB/CTEVT registry verification** (`NSTBRegistryVerifier`, currently raises `NotConfigured`):
  needs a data-sharing agreement with NSTB/CTEVT. Until then, verify by document or a call to
  the issuer ([credential-verification.md](ops/credential-verification.md)).
- **Training partner portal**: needs 2–3 signed CTEVT-affiliated institutes. Today ops manages
  courses for them.

## Phase 4 — Payments and financial readiness

Built 🔒:
- partner registry and API keys: `apps/partners`, `/ops/partners`, `/partners/docs`
- consent grants
- partner access log
- verified-earnings financial profile: `apps/finance`
- partner offers and referrals (loan, EWA, insurance, tool/vehicle finance): `/ops/finance`

All of this is off for workers until the gate is met.

**Gate:**
- **Lenders, EWA, wallets:** a signed agreement with an **NRB-licensed** bank/financial
  institution or PSP. The partner must carry the regulatory obligation: lending, AML/KYC, and
  disbursement on their books.
- **Insurance:** an insurer licensed by the **Nepal Insurance Authority** (formerly Beema Samiti).
- Lawyer review of the referral model, showing that we don't act as an unlicensed agent or broker.
- We still never lend or hold funds, and we never call the score a "credit score".

Remaining ⬜: partner self-service portal, a partner sandbox environment, a worker-facing
financial literacy content pack (Nepali).

## Phase 5 — Foreign-employment document passport

🟡 In progress (`apps/mobility`, `/ops/mobility`, worker app screens):
- the worker holds passport, labour permit, visa, police clearance, medical, pre-departure
  orientation and language test records
- ops verifies them
- the worker shares them only with a DoFE-licensed agency they choose, through a time-limited
  consent grant
- agency licence compliance on the partner record
- safety guidance on every screen

**Gate:**
- Lawyer review under the Foreign Employment Act 2064 / Rules 2064, confirming that document
  sharing isn't "foreign employment business".
- Signed agreements with ≥ 2 DoFE-licensed agencies whose licences ops has checked on the official
  DoFE site.
- Strategy rule, permanent: **we never recruit, advertise or match for jobs abroad.**

SOP: [foreign-employment-documents.md](ops/foreign-employment-documents.md).

## Phase 6 — Intelligence and network effects

Built ✅:
- employer analytics
- labour-market wages (median/p25/p75), demand, supply, shortages and certification uplift, with
  k-anonymity 5 (`/ops/insights`, CSV export)

In progress 🟡:
- district heatmap
- ops KPIs (`/ops/kpis`)
- fraud and anomaly detection (`apps/risk`)
- matching v2 with an outcome bonus

**Gate:**
- Enough data. A trade × district cell needs ≥ 5 workers before it shows.
- Any external publication (wage reports for employer associations, government) needs ops lead
  and lawyer sign-off.

Remaining ⬜: predictive matching (needs ≥ 500 placements with 90-day outcomes), employer
reliability index published to workers, wage benchmark reports as a paid product.

---

## 90-day pilot plan (15 design partners)

Timing: don't start during Dashain–Tihar–Chhath. Payroll in that season is dominated by the Dashain
allowance, and supervisors are on leave. Start on **Mangsir 1, 2083 (≈ mid-November 2026)**; check
the exact date with `GET /ref/calendar/convert?bs=2083-08-01`. That gives three full BS payroll
cycles: Mangsir, Poush and Magh.

| Window | Goal | Activities | Owner |
| --- | --- | --- | --- |
| Weeks −4 to 0 (Kartik) | Partners signed, platform live | Sign 15 pilot letters: 5 hotels, 4 hospitals/clinics, 4 security companies, plus 2 "next segment" partners (1 MEP contractor, 1 factory). Run KYB ([employer-verification-kyb.md](ops/employer-verification-kyb.md)). Production deploy, SMS sender ID, staff trained on SOPs. | Founders, ops lead |
| Weeks 1–2 | Each partner's workforce on the platform | [Onboarding playbook](ops/employer-onboarding-playbook.md): import staff, sites and QR posters, supervisors on the app. Worker consent and app install camps at each site. | Ops |
| Weeks 3–6 | Daily hajiri habit; first payroll | Daily check of `attendance_unmarked` per partner; call any partner with 2 unmarked days. First payroll run (Mangsir) with an ops person on site. Open first job requests and shortlist within 48 h. | Ops + account owner |
| Weeks 7–10 | Second payroll; SSF; hiring | Poush payroll run by the partner alone. SSF file prepared. Disputes handled within SLA. Measure time-to-fill. | Ops |
| Weeks 11–13 | Pricing and decision | Magh payroll. Pricing conversation using each partner's usage report (`/app/analytics`). Ask for paid terms: NPR 150/worker/month (min 3,000) + NPR 5,000/hire. Go/no-go review. | Founders |

**Weekly pilot review** (every Sunday, 30 min). For each partner, check:
- hajiri days marked
- payroll status
- open jobs and hours to shortlist
- disputes and support cases
- an NPS-style question for the supervisor

**Kill or pivot signals:**
- fewer than 6 partners active weekly by week 6
- payroll trusted by fewer than 5 (partners re-doing it in Excel)
- time-to-shortlist over 5 days

**After a "go":**
- convert paying partners
- expand to 50 organisations in Kathmandu Valley
- start the [segment 2 sequence](GO_TO_MARKET.md#3-geography-and-segment-sequence) (construction/MEP and factories, Birgunj–Hetauda)
- switch on phase-2 timesheets and enterprise API for partners who ask
