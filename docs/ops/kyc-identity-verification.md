# SOP — Worker identity verification (KYC)

| | |
| --- | --- |
| Owner | Ops lead |
| Performed by | Staff with the `verifier` role (until staff roles ship: named ops staff only) |
| Tools | Ops console `/ops/verification`, `/ops/workers/[id]`; API `POST /ops/workers/{id}/verify` |
| Related | [fraud-escalation.md](fraud-escalation.md), [worker-registration-camps.md](worker-registration-camps.md), [SECURITY.md](../SECURITY.md) |

## Purpose

Confirm that a worker is a real, adult person who is who they say they are, with one record per
person. "Identity verified" (`verification_status = verified`, trust level 1) is shown to
employers and partners and feeds matching (+10). A wrong "verified" damages every employer who
trusts the badge. Our standard is that a verified worker matches their ID document, their face
and their phone.

## What we accept

| Document | Nepali | Notes |
| --- | --- | --- |
| Citizenship certificate (front + back) | नागरिकता प्रमाणपत्र | Primary. Check the issuing District Administration Office (जिल्ला प्रशासन कार्यालय), the citizenship number, BS date of birth, permanent address and photo. |
| National ID card | राष्ट्रिय परिचयपत्र | Accepted alone, or alongside citizenship. Record the NID number. |
| Passport | राहदानी | Only as a secondary document (store it under mobility documents when that ships, not as primary KYC). |
| Driving licence, voter ID | सवारी चालक अनुमतिपत्र, मतदाता परिचयपत्र | **Supporting only.** Not enough on their own. |

The minimum age to be verified on KaamSathi is **18**. Child Labour (Prohibition and Regulation)
Act 2056 and Labour Act 2074: no hazardous work under 18, and no work at all under 14. Under 18 →
reject with the reason `underage`. If you suspect a child is being employed, escalate as a fraud
case with severity **high**.

## Steps

1. **Open the queue** at `/ops/verification`, oldest first. Workers created at a camp the same day
   come first.
2. **Check the images** (`photo`, `id_front`, `id_back`). They open through signed links that
   last 10 minutes; every view is audit-logged as `worker.id_document.view`.
   - All four corners are visible and the text is readable. No glare over the number or photo.
   - The front shows: name (Nepali/English), citizenship number, issuing district, issue date,
     and the CDO signature and stamp.
   - The back shows: permanent address (district, municipality, ward), date of birth (BS), and the
     father's/mother's name.
   - Look for tampering: misaligned text, a different font for the name or number, a photo
     pasted over, a missing stamp, or a mismatch between a laminated copy and the original.
3. **Match the person.**
   - Compare the profile photo (taken live at the camp or in the app) with the ID photo. Allow for
     age, but a different person means reject.
   - Name: the profile's `full_name` and `full_name_ne` match the document. Spelling variants of
     the same name in English are fine (e.g. "Thapa Magar" / "Thapa").
   - DOB: convert BS → AD with `/ref/calendar/convert` and make sure it matches `date_of_birth`.
     Age must be ≥ 18.
   - District: the permanent district matches the document.
4. **Check the phone.** The worker logged in with OTP, or was registered at a camp and confirmed
   by SMS. If the profile was created by ops or an employer and the worker has never logged in,
   call the number and confirm their name and date of birth before verifying.
5. **Check for duplicates.**
   - Search `/ops/workers?q=` for the same name plus district, and the same phone.
   - When the risk module ships, an open `duplicate_identity` flag on the worker is a **hard stop**.
     Go to [fraud-escalation.md](fraud-escalation.md).
   - Until then, also search by citizenship number. The number is matched through its encrypted
     blind index, so exact matches only.
6. **Enter the ID numbers** in the profile: citizenship number exactly as printed (keep dashes and
   slashes), and NID if present. They are stored encrypted. **Never** write an ID number in
   `verification_note`, a support case, chat, or a spreadsheet.
7. **Decide** (`POST /ops/workers/{id}/verify`):
   - `verified`: every check above passes. Note: `"KYC ok: citizenship front+back, face match, phone confirmed"`.
   - `rejected`: give a short reason code plus a plain sentence. Reason codes: `unreadable`,
     `mismatch_name`, `mismatch_face`, `underage`, `tampered`, `duplicate`, `no_document`.
   - Leave it `pending` and send the worker an SMS asking for a re-upload when the photo is merely
     unreadable. The worker can re-upload in the app.
8. **Tell the worker** about a rejection. Use the script below by phone or SMS, and say what to fix.

## Decision rules

- **No document image, no verification.** The API currently accepts `verified` without images, so
  this rule depends on you. (Known gap; see [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md#known-gaps-found-while-writing-these-docs).)
- When in doubt, don't verify. `pending` with a note is fine; a wrong `verified` is not.
- Never verify a relative, friend, or anyone whose naike you personally know. Hand it to another verifier.
- Changing a `verified` worker back to `rejected` requires the ops lead's approval, and a note
  saying what changed.
- **Four-eyes QA.** Each working day the ops lead re-checks a random 10% of the previous day's
  verifications, plus all verifications by staff in their first month. Disagreements go to
  calibration, and the decision is corrected.

## SLA

| Case | Target |
| --- | --- |
| Registered at a camp or employer import | decision within 1 working day |
| Self-registered in the app | decision within 2 working days |
| Worker shortlisted for a job and still pending | same day (check `/ops/jobs` daily) |
| Re-upload after "unreadable" | 1 working day |

## Escalation

- Suspected forged document, duplicate identity, underage worker, or someone registering others
  in bulk → [fraud-escalation.md](fraud-escalation.md). Freeze; don't verify.
- Worker disputes a rejection → handle as a dispute of kind `identity`
  ([dispute-handling-sla.md](dispute-handling-sla.md)). A different verifier reviews it.

## Audit trail

- `AuditLog` action `ops.worker.verify`, with from/to status and note, actor and IP.
- `AuditLog` action `worker.id_document.view` for each ID image opened.
- The worker's trust level is recomputed on verification (`trust.recompute_trust`).
- Don't download ID images to your laptop or phone. Never screenshot them or send them on
  WhatsApp or Viber. If a worker sends an ID photo on WhatsApp, upload it through the console,
  then delete the message on both ends.

## Scripts (phone / SMS)

| Situation | English | नेपाली |
| --- | --- | --- |
| Asking for the ID photo | "Please take a clear photo of the front and back of your citizenship certificate in the KaamSathi app. All four corners must be visible." | "कृपया KaamSathi एपमा आफ्नो नागरिकताको अगाडि र पछाडिको स्पष्ट फोटो खिच्नुहोस्। चारै कुना देखिनुपर्छ।" |
| Confirming identity by phone | "I am calling from KaamSathi. To confirm your profile, please tell me your full name and date of birth. I will never ask for your OTP code." | "म KaamSathi बाट बोल्दैछु। तपाईंको प्रोफाइल पुष्टि गर्न आफ्नो पूरा नाम र जन्म मिति भन्नुहोस्। हामी कहिल्यै OTP कोड माग्दैनौं।" |
| Unreadable photo | "Your ID photo is not clear. Please upload it again in daylight, without flash." | "तपाईंको परिचयपत्रको फोटो प्रस्ट भएन। कृपया उज्यालोमा, फ्ल्यास बिना फेरि अपलोड गर्नुहोस्।" |
| Rejected (mismatch) | "We could not verify your identity because the details do not match your document. You can visit a KaamSathi camp or call us to fix it." | "तपाईंको विवरण कागजातसँग मेल नखाएकाले पहिचान प्रमाणित गर्न सकिएन। सच्याउन KaamSathi शिविरमा आउनुहोस् वा हामीलाई फोन गर्नुहोस्।" |
| Verified | "Your identity is verified on KaamSathi. Employers will now see the Verified badge." | "KaamSathi मा तपाईंको पहिचान प्रमाणित भयो। अब रोजगारदाताले 'प्रमाणित' चिन्ह देख्नेछन्।" |

SMS length: Nepali (Unicode) SMS fit **70 characters per part**, so keep SMS short and put
details in the app.
