# SOP — Credential verification (skills, licences, training)

| | |
| --- | --- |
| Owner | Ops lead |
| Performed by | `verifier` role |
| Tools | `/ops/credentials` (queue), `/ops/workers/[id]` (credentials tab); API `GET /ops/credentials?status=pending`, `POST /ops/credentials/{id}/verify {status, method, note}`, `GET|POST /ops/assessments` |
| Code | [apps/credentials](../../backend/apps/credentials) (`verifiers.py`, `services.py`) |

## Purpose

Make the "verified certificate" claim on the Skill Passport and in matching true. A verified
credential raises the worker to trust level 4, adds to matching (NSTB level), and appears in the
passport payload, the only one partners and agencies see. Only verified credentials are ever
shown to third parties.

## Credential kinds and how to verify each

| Kind (`kind`) | Typical issuer | Preferred method (`method`) | How |
| --- | --- | --- | --- |
| `nstb` skill test (Level 1–3, Elementary) | National Skill Testing Board (राष्ट्रिय सीप परीक्षण समिति), under CTEVT | `ops_call` or `document` (`issuer_registry` disabled until there is an NSTB data agreement) | Check the certificate number, name, occupation, level and test date. Call or email NSTB, or the testing centre, with the certificate number when anything looks off. |
| `ctevt_training` (TSLC, diploma, short courses) | CTEVT or an affiliated school | `ops_call` | Call the school's administration and confirm the name, course, batch year and roll number. |
| `training_course` | Partner training provider | `issuer_partner` (automatic) | Created as verified when ops marks a KaamSathi enrolment `completed` (`/ops/training`). No manual step. |
| `license` (driving, electrical, other occupational) | e.g. Department of Transport Management (driving) | `document` + `ops_call` if heavy-vehicle | Licence category must match the trade (e.g. heavy vehicle for `heavy_driver`). Check the expiry date. |
| `safety` (first aid, working at height, fire safety) | Training provider, Red Cross, employer | `document` / `ops_call` | Record the expiry, often 1–3 years. |
| `language` | e.g. Korean EPS-TOPIK, Japanese JLPT/JFT | `document` | Mostly relevant to mobility. Record the score or level. |
| `other` | — | `document` | Verify only if relevant to a seeded trade. Otherwise leave pending with a note. |

**Skill assessments** (`SkillAssessment`) are practical tests that KaamSathi or a partner
assessor runs (`/ops/assessments`). Record the trade, date, result (`pass`/`fail`), score and
level. A passed assessment gives trust level 3. Only assessors named by the ops lead may record
them.

## Steps

1. Open `/ops/credentials` and filter `status=pending`, oldest first.
2. Open the document (signed link). Check that the **name matches the worker's verified identity**.
   If the worker isn't identity-verified yet, do KYC first or leave the credential pending.
3. Check the issuer, certificate number, level and dates. Is the `expires_on` date in the past? Then
   mark it `rejected` with the reason "expired" and ask the worker to upload the renewal. The daily
   job also marks verified credentials `expired` automatically.
4. Choose the method:
   - Clean document from a known issuer, matching the worker → `document`.
   - Any doubt (photo quality, unknown school, high-value level such as NSTB Level 2–3 for
     electrician or HVAC) → call the issuer → `ops_call`. Log in the note who you spoke to,
     their role and the date: `"Called Balaju school admin, Ms. K., 2083-06-21: confirmed batch 2079"`.
     No personal phone numbers in notes.
5. Decide `verified` or `rejected` with a note. `issuer_registry` returns *"Registry verification is
   not available yet"* until a registry adapter is configured. That's expected.
6. Trust is recomputed automatically, and the worker sees the change in the app.

## Decision rules

- A certificate whose name differs from the worker's ID → reject (`mismatch_name`), unless an
  issuer letter explains the difference.
- Same certificate number on two workers → **stop**. Go to fraud escalation (`document_reuse`).
- Issuer can't be reached after 3 attempts over 5 working days → leave pending with a note and
  tell the worker. Don't verify on the document alone if you already had doubts.
- Never "verify" a skill from the worker's word or from years of experience. That belongs in
  `WorkerSkill` (self-declared), not in Credentials.

## SLA

| Case | Target |
| --- | --- |
| `document` verification | 2 working days |
| `ops_call` verification | 5 working days (issuers are slow, so say so to the worker) |
| Worker is shortlisted and the credential is pending | prioritise the same day |
| Expiry reminders | automatic SMS at 30 and 7 days before (`credentials.tasks.expiry_reminders`, 08:00) |

## Escalation

Forged certificate, a certificate "bought" from an institute, or an issuer reporting it never
issued the certificate → [fraud-escalation.md](fraud-escalation.md) (severity high). Never accuse
the worker on the call; collect the facts first.

## Audit trail

`AuditLog` `ops.credential.verify` (from/to status, method), the credential's
`verified_by`/`verified_at`, and the trust recompute. Document views go through signed links.

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| Calling an issuer | "Namaste, I am calling from KaamSathi, a workforce platform. A worker has shared their certificate with us with consent. Could you confirm whether certificate number ___ was issued to ___ in ___?" | "नमस्ते, म KaamSathi बाट बोल्दैछु। एक कामदारले आफ्नो सहमतिमा प्रमाणपत्र हामीलाई दिनुभएको छ। प्रमाणपत्र नं. ___ ___ लाई ___ सालमा जारी भएको हो कि होइन पुष्टि गरिदिनुहुन्छ?" |
| Asking the worker for a better copy | "Please upload a clearer photo of your certificate, with the number and stamp visible." | "कृपया प्रमाणपत्र नम्बर र छाप देखिने गरी प्रस्ट फोटो फेरि अपलोड गर्नुहोस्।" |
| Verified | "Your ___ certificate is verified. It now shows on your Skill Passport." | "तपाईंको ___ प्रमाणपत्र प्रमाणित भयो। अब यो तपाईंको सीप राहदानीमा देखिन्छ।" |
| Expiring | "Your ___ expires on ___. Upload the renewed one to keep your badge." | "तपाईंको ___ को म्याद ___ मा सकिँदैछ। ब्याज कायम राख्न नवीकरण गरिएको अपलोड गर्नुहोस्।" |
