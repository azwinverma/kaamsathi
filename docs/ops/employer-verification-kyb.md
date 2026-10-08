# SOP — Employer verification (KYB)

| | |
| --- | --- |
| Owner | Ops lead |
| Performed by | `verifier` role. The sales owner of the account may **not** verify their own account. |
| Tools | Employer side: `/app/verification` (owner/admin uploads). Ops: `/ops/employers?verification_status=pending`. API `GET|POST /org/verification`, `POST /ops/employers/{id}/verify {status, note}`. **In progress**; until it ships, record the decision in `/ops/organizations/[id]` notes and in Django admin (`Organization.verification_status`, `verification_note`). |
| Setting | `KYB_REQUIRED_FOR_SHORTLIST` (default True): ops cannot shortlist workers to an unverified employer |

## Purpose

Workers trust jobs shown on KaamSathi. A fake or abusive employer can harvest workers'
data, pay below minimum wage, or run a foreign-job scam. KYB proves that the organisation legally
exists, that the person signing up may act for it, and that it is fit to receive workers. Workers
see `employer_verified: true` on jobs and employments.

## Documents

| Document | Nepali | Check |
| --- | --- | --- |
| Company registration certificate (Office of Company Registrar), **or** firm/proprietorship registration (Department of Commerce / Cottage and Small Industries office / municipality) | कम्पनी दर्ता प्रमाणपत्र / फर्म दर्ता प्रमाणपत्र | Name matches `Organization.name`. Registration number into `registration_no`. Look the company up on the OCR online search where available. |
| PAN/VAT certificate (Inland Revenue Department) | स्थायी लेखा नम्बर (PAN) प्रमाणपत्र | Verify the PAN on the IRD taxpayer search (name, address, VAT status). PAN is stored encrypted (`pan_no`). |
| Sector licence (when applicable) | — | Hotel: Department of Tourism registration/star classification. Hospital/clinic: health-facility licence (Ministry of Health and Population / provincial health directorate). Security company: private security service licence from the competent authority. Factory: industry registration. |
| SSF employer registration (if they already contribute) | सामाजिक सुरक्षा कोष रोजगारदाता दर्ता | Into `ssf_employer_no`. Not a blocker for verification, but the compliance score flags it. |
| Signatory proof | — | The owner/admin on KaamSathi is a director, proprietor or authorised manager. Use a letter on letterhead or a call to the company's published landline. |

## Steps

1. **Intake.** The owner/admin uploads the registration doc and PAN doc, and enters
   `registration_no` and `pan_no` → status `pending`.
2. **Document check.** Names, numbers and addresses agree across documents and the profile.
   Look for tampering. Expired or renewal-due licences → request the renewal.
3. **Registry check.** Look up the OCR record and IRD PAN. Save a note of what you checked and when.
   No screenshots outside the system.
4. **Contact check.** Call the organisation's published landline (from its website, a Google
   listing or an association directory), **not** the number they gave us, and confirm the person
   and role.
5. **Site check.** For the first 15 pilot partners and any employer recruiting ≥ 10 workers at
   once: visit in person or do a video call at the site. Confirm the site exists, roughly matches
   the headcount, and that the `Site` geofence is placed correctly.
6. **Red-flag review** (below).
7. **Decide** `verified` or `rejected`, with a note: what was checked, sources and dates. The
   decision is audited.
8. **Tell the owner** (script below). Rejected → explain what's missing.

## Red flags (any one → escalate to the ops lead; some → reject)

- The organisation is a **foreign employment (manpower) agency** registered with DoFE and asks
  to post jobs → reject for the employer side. Agencies may only be partners under the mobility
  rules ([foreign-employment-documents.md](foreign-employment-documents.md)).
- Job wages below minimum wage. The API blocks this, but watch for "food and lodging deducted"
  talk on calls.
- They ask workers to pay anything: a deposit, uniform fee, training fee or "file charge".
  → reject + [fraud-escalation.md](fraud-escalation.md).
- No physical premises; only a mobile number; PAN name doesn't match; registration recently
  struck off.
- Bulk requests for worker contact data without hiring intent.
- Previous disputes or ratings on KaamSathi showing unpaid wages (`employer_reputation`).

## SLA

| Case | Target |
| --- | --- |
| Complete submission | decision within **2 working days** |
| Pilot partners | before onboarding day 1 |
| Incomplete submission | request missing items within 1 working day |
| Re-verification | yearly, on PAN or name change, or after a confirmed fraud flag |

## Escalation

- Ops lead decides borderline cases.
- A founder decides on rejecting a signed design partner.
- Fraud signals → [fraud-escalation.md](fraud-escalation.md). Suspend shortlisting immediately by
  setting the status back to `pending` with a note.

## Audit trail

The KYB decision is audited (actor, status change, note), and documents are only opened through
signed links. `verified_by`/`verified_at` sit on the organisation.

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| Requesting documents | "To show the Verified Employer badge to workers, please upload your company registration and PAN certificate under Settings → Verification." | "कामदारलाई 'प्रमाणित रोजगारदाता' चिन्ह देखाउन कृपया सेटिङ → प्रमाणीकरणमा कम्पनी दर्ता र प्यान प्रमाणपत्र अपलोड गर्नुहोस्।" |
| Verification call | "I'm calling from KaamSathi to confirm that ___ is authorised to use KaamSathi for your company. Is that correct?" | "तपाईंको कम्पनीका लागि ___ ले KaamSathi प्रयोग गर्न अधिकार पाउनुभएको हो भनी पुष्टि गर्न म KaamSathi बाट फोन गर्दैछु। के यो सही हो?" |
| Verified | "Your organisation is verified. You can now receive shortlisted candidates." | "तपाईंको संस्था प्रमाणित भयो। अब छानिएका उम्मेदवार पाउन सक्नुहुन्छ।" |
| Rejected / incomplete | "We could not verify your organisation yet because ___. Please send ___ and we will review within two working days." | "___ कारणले तपाईंको संस्था अहिलेसम्म प्रमाणित गर्न सकिएन। कृपया ___ पठाउनुहोस्, हामी दुई कार्यदिनभित्र हेर्नेछौं।" |
