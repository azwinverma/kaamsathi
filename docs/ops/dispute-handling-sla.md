# SOP — Dispute handling and SLA

| | |
| --- | --- |
| Owner | Ops lead |
| Performed by | `support` role |
| Tools | Worker: app → disputes (`GET|POST /me/disputes`). Employer: `/app/disputes` (`GET /org/disputes`, `POST /org/disputes/{id}/respond {note}`). Ops: `/ops/disputes` (`GET /ops/disputes?status=`, `POST /ops/disputes/{id}/resolve {status: resolved|rejected, note}`). |
| Code | [apps/trust](../../backend/apps/trust) (`Dispute`); `sla_due_at` and escalation **in progress** |
| Related | Bolau booking disputes (Sipalu ↔ Ghardhani), safety reports, no-shows and suspensions: [bolau-home-visit-safety.md](bolau-home-visit-safety.md) |

## Purpose

Give workers a fair, visible way to challenge records that affect their pay and reputation:
attendance, wages, employment dates, ratings and identity. Resolve each dispute on evidence,
within a published time. KaamSathi is not a court or a Labour Office. We fix **records** on the
platform and point people to the official channels for legal claims.

## Dispute kinds

| `kind` | Typical case | Evidence to look at |
| --- | --- | --- |
| `attendance` | "I was present on 12 Kartik but marked absent" | Attendance record (`method`, `recorded_by`, check-in lat/lng/time), roster entry, site QR check-ins, supervisor's statement |
| `wage` | Wrong payslip: OT missing, wrong days, wrong deduction, peski over-recovered, not paid | Payslip lines, payroll run status, attendance register for that BS month, advance ledger, payout item status and `provider_ref` |
| `employment_dates` | Start or end date wrong, which affects history and the Dashain allowance | Employment record, application `joined` event, contract versions |
| `rating` | Unfair employer rating | Rating, comment, attendance and history. We remove a rating only if it's abusive or proven false. |
| `identity` | KYC rejection the worker thinks is wrong | KYC note; a second verifier reviews ([kyc-identity-verification.md](kyc-identity-verification.md)) |
| `other` | Anything else | — |

## Flow and SLA

```text
worker raises ──▶ open ──(employer responds ≤ 7 days)──▶ employer_responded ──(ops decides ≤ 7 days)──▶ resolved | rejected
                   │                                                                     ▲
                   └──── employer silent past 7 days ─▶ escalated to ops ────────────────┘
```

| Step | Target |
| --- | --- |
| Acknowledge to the worker (automatic notification + ops glance for urgency) | 1 working day |
| Employer response (`sla_due_at` while `open`) | 7 calendar days |
| Ops decision after the employer responds or the deadline passes (`sla_due_at` while `employer_responded`) | 7 calendar days |
| **Urgent wage disputes**: net pay not received for ≥ 30 days after `paid`, or paid below minimum wage | ops calls the employer within **2 working days**; target resolution 7 days |
| Overdue items | auto-escalated every 30 min by `support.tasks.escalate_overdue` (in progress); listed first in `/ops/disputes` |

## Steps (ops)

1. **Triage daily.** Sort by `sla_due_at` and mark urgent wage cases. Check that the worker's
   description is clear. If it isn't, call them (script below).
2. **Gather evidence** from the records listed above. For attendance, compare the method:
   - A `self` QR check-in inside the geofence is strong evidence for the worker.
   - A `supervisor` entry without a check-in is the supervisor's word.
3. **Hear both sides.** Read the employer's response (`employer_note`). If it is missing at the
   deadline, call the employer's HR/owner.
4. **Decide.**
   - `resolved`: the claim is upheld, fully or partly. Note what must change and who changes it.
   - `rejected`: the evidence doesn't support the claim. Explain why in plain language.
5. **Correct the record.** Resolving does **not** edit records automatically.
   - Attendance or payslip in a **draft** payroll month → the employer edits and recalculates (we
     can guide them on a call).
   - **Approved or paid** month → no edits to the locked month, and never edit DB rows directly
     ([RUNBOOK §8](../RUNBOOK.md#8-incident-response)). The payslip has no one-off arrears line
     yet (`PATCH /org/payslips/{id}` only takes `other_deductions ≥ 0`, `note` and
     `payment_method`). Until it does, use one of these:
     - **Underpayment:** the employer pays the arrears separately and records it in the next
       payslip's `note` ("Arrears for Kartik OT: Rs. 1,250 paid on …"). Alternatively, temporarily
       raise `other_allowance` on the employment for the next run, then revert it.
     - **Overpayment or over-recovery:** reduce `other_deductions` or the peski
       `recover_per_month` in the next draft run, with a note.
   - Employment dates → the employer edits them through `/org/employments/{id}`. The contract
     regenerates.
   - Rating → ops removes it only on abuse or proven falsehood, with an audit note.
6. **Inform** both sides. The worker gets the outcome in the app and by SMS if urgent.
7. **Repeat patterns.** An employer with ≥ 3 upheld wage disputes in 90 days → ops lead review.
   Consider pausing shortlists, and a KYB re-check ([employer-verification-kyb.md](employer-verification-kyb.md)).

## Decision rules

- The burden of proof is on the employer for records the employer controls (payroll,
  supervisor-entered attendance). A worker can't be expected to prove an absence of records.
- Never share one worker's data with another worker in a dispute.
- Wage claims we cannot resolve (the employer refuses, or the amount is contested) → tell the
  worker about the **Labour Office** (श्रम तथा व्यवसायजन्य सुरक्षा कार्यालय) and give them
  their export (payslips and attendance from `/me/privacy-requests` → export) as evidence. Mark
  the dispute `resolved` with the note "referred to Labour Office". We still record the outcome.
- No retaliation. An employer ending an employment or rating a worker down after a dispute →
  fraud/abuse review.

## Audit trail

Dispute `raised_at`, `responded_at`, `resolved_by`, `resolved_at` and notes, plus audited
corrections through normal endpoints. Dispute updates also go to enterprise webhooks
(`dispute.raised`, in progress).

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| Acknowledge | "We received your complaint about ___. Your employer has 7 days to respond, then we will decide within 7 days." | "___ सम्बन्धी तपाईंको गुनासो प्राप्त भयो। रोजगारदातालाई जवाफ दिन ७ दिन छ, त्यसपछि हामी ७ दिनभित्र निर्णय गर्छौं।" |
| Clarify with worker | "Which date or month is wrong, and what should it be?" | "कुन मिति वा महिना गलत छ, र के हुनुपर्ने हो?" |
| To employer | "A worker has raised a ___ dispute for ___. Please review it in KaamSathi → Disputes and respond within 7 days." | "एक कामदारले ___ को ___ सम्बन्धी गुनासो दर्ता गर्नुभएको छ। कृपया KaamSathi → गुनासोमा हेरी ७ दिनभित्र जवाफ दिनुहोस्।" |
| Upheld | "Your complaint was accepted. Your employer will correct ___ in the ___ payroll." | "तपाईंको गुनासो स्वीकार भयो। रोजगारदाताले ___ को तलबीमा ___ सच्याउनुहुनेछ।" |
| Not upheld | "We reviewed the records and could not confirm the claim because ___. You can still contact the Labour Office." | "अभिलेख हेर्दा ___ कारणले दाबी पुष्टि हुन सकेन। तपाईं श्रम कार्यालयमा पनि सम्पर्क गर्न सक्नुहुन्छ।" |
