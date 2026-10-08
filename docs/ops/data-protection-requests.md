# SOP — Data-protection requests

| | |
| --- | --- |
| Owner | Grievance / privacy officer (named on `/privacy`; **🔴 to be appointed**) |
| Performed by | `support` role, with the privacy officer approving deletions and third-party requests |
| Tools | Worker app → Privacy (`GET|POST /me/privacy-requests`, download link). Ops `/ops/privacy` (`GET /ops/privacy-requests`, `POST /ops/privacy-requests/{id}/process {action: approve|reject, note}`). Consents `GET|POST /me/consents`. Grants `/me/grants/{id}/revoke`. Profile-view log `/me/profile-views`. |
| Law and policy | Individual Privacy Act 2075 and Regulations. [SECURITY.md §3–§5](../SECURITY.md#3-consent-model). |

## Purpose

Honour workers' (and employer users') rights over their personal data, within a predictable
time, without breaking the employer's legal duty to keep payroll and attendance records.

## Request types

| Type | Who | How we handle it |
| --- | --- | --- |
| **Access / export** | Worker | Self-service: `POST /me/privacy-requests {kind: export}`. Celery builds a zip (JSON + PDF) of profile, consents, employments, attendance, payslips, credentials, ratings, profile views, grants and referrals. The link is valid for 72 h. |
| **Correction** | Worker | Factual records (attendance, wages, dates) → a dispute ([dispute-handling-sla.md](dispute-handling-sla.md)). Profile data (name spelling, district) → the worker edits it, or ops edits it after an identity check. Any KYC-relevant change needs a re-verification. |
| **Deletion** | Worker | Request in the app; ops processes it (below). |
| **Withdraw consent / stop sharing** | Worker | Self-service: revoke partner grants, passport share links, make the passport private, or `POST /me/consents {scope, granted: false}`. Withdrawing `data_processing` = a deletion request. |
| **"Who saw my data?"** | Worker | Self-service: `/me/profile-views`, `/me/partner-access`. Ops can explain the entries. |
| **Request made through someone else** (naike, relative, employer) | — | Not accepted. The worker must request it themselves from their registered phone, or in person at a camp with ID. |
| **Employer asks for a worker's data beyond the employment** | Employer | Refuse. They only see what the employment needs, plus anything the worker consented to. |
| **Police / court / government request** | Authority | Only with a **written order or official letter**. The privacy officer and lawyer review it. Disclose the minimum. Log it. Tell the worker unless the order prohibits it. |
| **Employer user (staff member of an org)** | User | Same rights for their own account. Org records they created stay with the org. |

## Steps — deletion

1. **Verify the requester.** The request came from the logged-in worker account. If it came by
   phone, do a strong identity check and a call-back to the registered number.
2. **Check blockers:**
   - an open dispute → finish or close it first, with the worker's agreement
   - an unpaid payslip
   - an active employment → tell the worker their employer must keep employment records; their
     profile can be deleted, but the employer's records stay (anonymised link)
   - an open fraud flag → the privacy officer decides; we may keep the data needed for the
     investigation, and tell the worker
3. **Explain what happens** (script below):
   - name → "Deleted worker"
   - phone pseudonymised
   - ID, photo and certificate files deleted
   - skills, credentials, passport and financial profile removed
   - grants revoked
   - GPS removed from attendance
   - rating comments cleared
   - login deactivated

   **Kept**, linked to the anonymised record, as required by labour, SSF and tax law (≥ 7 years,
   to be confirmed by counsel):
   - employments, attendance, leave, advances, payslips and payout items
   - consent history and access logs
4. **Approve** in `/ops/privacy` with a note. This can't be undone. The worker would need to
   register again.
5. **Confirm to the worker** by SMS or a call to the registered number **before** you approve.
   Approval pseudonymises the phone, and the system sends no confirmation SMS on deletion (only
   on export), so this step is manual. Record in the approval note that the worker was told.

## Steps — export

Usually self-service. If it is stuck (`in_progress` for over 1 hour), it is re-queued nightly.
Escalate to engineering if it is still stuck the next day. Never email export files. The worker
downloads them from the app over a signed link.

## SLA

| Step | Target |
| --- | --- |
| Acknowledge (automatic + support check) | 7 days (aim for 1 working day) |
| Export available | automatic, usually minutes; ≤ 3 days |
| Correction | within the dispute SLA (≤ 14 days) |
| Deletion completed | **30 days** from the request (confirm the legal deadline with counsel) |
| Authority requests | Privacy officer reviews within 2 working days |

## Decision rules

- Don't refuse a deletion because an employer objects. They keep their legal records anyway.
- A rejection needs the privacy officer's approval and a reason given to the worker. Examples:
  identity not confirmed, an active investigation.
- Never send personal data by email, WhatsApp or SMS as a "quick answer".

## Audit trail

`PrivacyRequest` (`created_at`, `handled_by`, `completed_at`, `response_note`); audit rows for the
approval and for export downloads; consent rows are append-only. Keep a register of authority
requests: date, authority, legal basis, data disclosed, approver.

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| Export | "In the app, go to Privacy → Download my data. The file stays available for 3 days." | "एपमा गोपनीयता → मेरो डाटा डाउनलोड मा जानुहोस्। फाइल ३ दिनसम्म उपलब्ध रहन्छ।" |
| Deletion explained | "We will delete your profile, photos and documents. Your employer must keep salary and hajiri records by law, but they will no longer show your name. This cannot be undone." | "हामी तपाईंको प्रोफाइल, फोटो र कागजात हटाउनेछौं। कानुनअनुसार रोजगारदाताले तलब र हाजिरीको अभिलेख राख्नुपर्छ, तर त्यसमा तपाईंको नाम देखिने छैन। यो फेरि फर्काउन सकिँदैन।" |
| Stop sharing | "You can stop any sharing yourself in Privacy → Permissions. It takes effect immediately." | "गोपनीयता → अनुमतिमा गएर तपाईं आफैं कुनै पनि साझेदारी रोक्न सक्नुहुन्छ। यो तुरुन्तै लागू हुन्छ।" |
| Third-party refusal | "For your safety, only the worker can request this, from their own phone." | "सुरक्षाका लागि यो अनुरोध कामदार आफैंले आफ्नै फोनबाट मात्र गर्न सक्नुहुन्छ।" |
