# SOP — Fraud escalation

| | |
| --- | --- |
| Owner | Ops lead. A founder is the decision-maker for high-severity cases. |
| Performed by | `risk_analyst` role (until roles ship: ops lead), with verifiers and support raising flags |
| Tools | `/ops/risk` → API `GET /ops/risk/flags?status=&kind=&severity=`, `POST /ops/risk/flags` (manual), `POST /ops/risk/flags/{id}/resolve {status: confirmed|dismissed, note}`, `GET /ops/risk/summary` (**in progress**, `apps.risk`); the nightly `apps.risk.tasks.scan` at 04:00 |
| Related | [kyc-identity-verification.md](kyc-identity-verification.md), [employer-verification-kyb.md](employer-verification-kyb.md), [incident-communications.md](incident-communications.md), [SECURITY.md §6](../SECURITY.md#6-breach-response) |

## Purpose

Detect, contain and resolve fraud that harms workers, employers or the trust layer. The most
damaging cases for workers come first: wage theft through shared bank accounts, illegal fees,
and foreign-job scams.

## What counts (flag `kind`)

| Kind | Example in Nepal | Default severity |
| --- | --- | --- |
| `duplicate_identity` | Same citizenship/NID on two workers (blind-index match), often to get around a rejection or a bad rating | high |
| `shared_bank_account` | Several workers' wages go to one account. Often a naike or thekedar collecting wages → **wage theft risk** | high |
| `document_reuse` | Same ID photo or certificate file (identical sha256) on different workers | high |
| `attendance_anomaly` | Buddy punching: several check-ins from identical coordinates within 60 s; check-in after check-out | medium |
| `geo_anomaly` | ≥ 3 check-ins outside the geofence in 7 days | low–medium |
| `velocity` | One worker onboarded by ≥ 3 orgs in 7 days (identity being rented out) | medium |
| `reference_mismatch` | Reference denies the work history | low (high if part of a pattern) |
| `manual` | Anything staff or users report, including the cases below | set by reporter |

Report these as `manual` flags:
- An employer, naike or "agent" asking workers for money (registration, uniform, deposit, "visa
  processing"). Workers never pay; this is a breach of our terms and often illegal.
- Foreign-job offers posted or promised through KaamSathi.
- Underage workers.
- Passports or citizenship certificates being held by an employer or naike.
- Staff misconduct: browsing profiles without reason (visible in `ProfileView` / audit), or
  asking workers for favours.
- Partner misuse: pulling data beyond a grant, or pressuring workers to consent.

## Severity and response

| Severity | First response | Contain within | Decision within |
| --- | --- | --- | --- |
| **High** (wage theft, identity fraud, child labour, foreign-job scam, data misuse) | Ops lead informed **immediately** (phone) | 4 working hours | 2 working days; founder signs off |
| **Medium** | Assigned the same working day | 1 working day | 5 working days |
| **Low** | Weekly review | — | 10 working days |

## Steps

1. **Triage.**
   - Open the flag. Read `details`, then the subject's history: audit log, profile views,
     attendance and payout items.
   - Confirm it's not a data error. Common false positives: a family sharing one bank account
     (legitimate, but ask), and a hotel staff bus arriving together (identical coordinates).
2. **Contain.** Take the minimum action that stops harm:
   - Worker identity fraud → set `verification_status` back to `pending` with a note, so the
     badge and matching are removed.
   - Employer fraud → set KYB to `pending` (stops shortlisting). Close their open jobs via ops.
   - Wage theft via a shared account:
     1. Phone each affected worker **privately**. Never in front of the naike or employer.
     2. Confirm whether they receive their wages.
     3. With their consent, help them update their own bank or wallet details (`/me/worker`).
     4. Tell the employer that payslips must go to the worker's own account.
   - Partner misuse → revoke the API key (`/ops/partners`); grants stay revocable by workers.
   - Staff misconduct → disable the staff account; superadmin reviews the audit log.
3. **Collect evidence.** Use audit log entries, flag details and call notes, and attach them as
   notes on the flag. Don't download personal data to personal devices.
4. **Talk to the subject** only after containment, with the ops lead's approval. Two staff are
   on the call for high severity. Never threaten. Explain what we saw and give them a chance to
   explain.
5. **Resolve** (`confirmed` or `dismissed`) with a note.

   Confirmed outcomes:
   - worker: rejection, plus a merge or deactivation of the duplicate
   - employer: account suspended, with any charges waived or kept per contract
   - naike: crew deactivated and referral rewards voided (`/ops/referrals/{id}/void`)
   - partner: suspended
6. **Report externally** when required. A founder decides, with legal advice:
   - Crimes (identity forgery, fraud, extortion) → Nepal Police; for online fraud, the Nepal Police Cyber Bureau.
   - Foreign-employment fraud → Department of Foreign Employment (वैदेशिक रोजगार विभाग).
   - Labour violations (unpaid wages, child labour) → the relevant Labour and Occupational Safety
     Office (श्रम तथा व्यवसायजन्य सुरक्षा कार्यालय). Tell the worker they can complain directly.
   - Personal-data breach → [SECURITY.md §6](../SECURITY.md#6-breach-response).
7. **Learn.** Monthly risk review: counts by kind (`/ops/risk/summary`), false-positive rate, and
   any detector or SOP changes needed.

## Decision rules

- Protect the worker first. Containment must never cut off a worker's wages or record. Suspend
  badges, not employment records.
- One signal is a question, not a verdict. Confirm with at least two independent facts before
  `confirmed`.
- Confirmed fraud by an employer or naike is never resolved by "they promised not to again" alone.
  Suspension stays until the ops lead and a founder agree, in writing, to reinstate.
- Don't tell a reporter how the investigation turned out about the other party. Tell them only
  what was done about their own case.

## Audit trail

Flags have `created_at`, `resolved_by`, `resolved_at` and `note`. Every containment action uses
normal endpoints, so it is audited. External reports: record the date, office, reference number
and who reported, on the flag.

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| Private call to a worker (shared account) | "This call is private. Do you receive your salary in your own account? Has anyone asked you to share your bank account or pay a fee?" | "यो कुरा गोप्य हो। के तपाईंको तलब तपाईंकै खातामा आउँछ? कसैले तपाईंलाई बैंक खाता साझा गर्न वा पैसा तिर्न भनेको छ?" |
| Worker fee reassurance | "KaamSathi is completely free for workers. Nobody may take money from you for a job through KaamSathi. If someone asks, call us." | "KaamSathi कामदारका लागि पूर्ण रूपमा निःशुल्क छ। KaamSathi मार्फत कामका लागि कसैले पनि तपाईंसँग पैसा लिन पाउँदैन। कसैले मागेमा हामीलाई फोन गर्नुहोस्।" |
| Suspending an employer | "We have paused new candidates for your account while we review a report. Your existing hajiri and payroll keep working." | "एउटा गुनासोको जाँच भइरहेकाले तपाईंको खातामा नयाँ उम्मेदवार पठाउन अस्थायी रूपमा रोकिएको छ। हाजिरी र तलबी पहिलेझैं चल्छन्।" |
