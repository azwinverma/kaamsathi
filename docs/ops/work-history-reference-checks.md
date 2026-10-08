# SOP — Work-history reference checks

| | |
| --- | --- |
| Owner | Ops lead |
| Performed by | `verifier` role |
| Tools | Worker adds history in the app (`/me/work-history`). Ops queue `/ops/references` → API `GET /ops/work-history?status=reference_pending`, `POST /ops/work-history/{id}/verify {status, method, note}`. On-platform employers confirm at `/org/work-history-confirmations`. **In progress** (`apps.experience`). |

## Purpose

Most Nepali blue-collar workers have years of experience with no paperwork: construction sites,
hotels in India or the Gulf, factories. A verified external history entry lets that experience
count:
- it shows on the Skill Passport as "verified by reference/employer/document"
- it counts toward trust level 2
- it counts toward the stability score (≥ 12 verified months)

Our job is to confirm the entry is true without exposing the worker to their old employer more
than they agreed to.

Platform history (employments on KaamSathi) is verified automatically and needs no check.

## Statuses

`self_reported` (no reference) → `reference_pending` (worker gave a reference) → `verified` |
`unverifiable` | `rejected`. Self-reported entries are visible to the worker only. They are never
shown as verified.

## Steps

1. **Pick** the oldest `reference_pending` entry. The worker must be identity-verified first.
   Check that the worker consented to a reference check; the app asks when they add a reference.
2. **Read** the entry: employer name, role, district, dates, reference name. The reference phone
   is visible to ops only.
3. **Choose the method:**
   - `employer_confirmed`: the employer is on KaamSathi (`employer_org` set). The confirmation
     request goes to that org automatically. Wait up to 5 working days, then fall back to a call.
   - `reference_call`: call the reference (script below).
   - `document`: appointment letter, experience letter (अनुभव पत्र), salary slips, a foreign
     labour permit with the employer's name, an SSF statement. Check names and dates.
4. **Reference call.** Confirm all of these:
   - The reference knows the worker. Ask them to describe the worker (role, approximate dates)
     **before** you read out the details.
   - The role and trade match.
   - The dates are within ±3 months for entries under 2 years, or ±6 months for older ones.
   - The reference's own relationship to the worker: supervisor, owner, naike or co-worker.
     **Co-workers and relatives don't count.** Naike count only for their own crew's work.
5. **Decide.**
   - `verified`: facts confirmed. Note the method, the reference's role and the date. Correct the
     dates if the reference gave better ones, and tell the worker.
   - `unverifiable`: 3 call attempts over 5 working days with no answer, or the company has
     closed. The worker may add a document instead.
   - `rejected`: the reference denies knowing the worker, or the facts contradict them. Mark it
     and create a `reference_mismatch` risk flag. One mismatch alone isn't fraud: talk to the
     worker first.
6. The worker is notified. Trust is recomputed.

### Foreign experience (returnees)

The reference is often abroad. A WhatsApp or Viber call from the official KaamSathi phone is
allowed. Don't use a personal phone. Accepted documents:
- labour permit (श्रम स्वीकृति) with employer name and dates
- visa pages
- an employer ID card
- experience letters in Arabic, Malay or English (get a summary translation into the note)

Mark these entries' district as the foreign country, not as a Nepali district.

## Decision rules

- Never tell the reference anything the worker hasn't put in the entry. Don't mention the
  worker's current employer, wage or disputes.
- Never ask the reference for a performance opinion beyond the "would you employ them again?"
  question. Record the answer only as yes / no / declined. It is not shown publicly.
- If a reference asks for money or a favour, end the call and mark the entry `unverifiable`.
- Don't verify entries the worker added for an employer where they currently have an active
  KaamSathi employment. That employment already counts.

## SLA

| Case | Target |
| --- | --- |
| First call attempt | 2 working days after the entry is submitted |
| Decision | 7 working days (3 attempts across different times of day) |
| Employer confirmation on platform | employer has 5 working days, then ops calls |

## Escalation

- A pattern of mismatches (≥ 2 for one worker, or one naike supplying fake references for many
  workers) → [fraud-escalation.md](fraud-escalation.md).
- A reference who is aggressive or reveals abuse of the worker (unpaid wages, passport withheld)
  → note it carefully and inform the ops lead. Advise the worker on the Labour Office (श्रम
  कार्यालय) and, for abroad, the DoFE complaint channel.

## Audit trail

Verification decisions are audited (status, method, note, actor). Reference phone numbers are
stored encrypted and never exported in passport payloads.

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| Opening | "Namaste, I'm ___ from KaamSathi. ___ has listed you as a reference for their work at ___, with their permission. Do you have two minutes?" | "नमस्ते, म KaamSathi बाट ___ बोल्दैछु। ___ ले आफ्नो सहमतिमा ___ मा गरेको कामका लागि तपाईंलाई सन्दर्भ व्यक्ति राख्नुभएको छ। दुई मिनेट कुरा गर्न मिल्छ?" |
| Open question | "How do you know ___? What work did they do, and roughly from when to when?" | "तपाईं ___ लाई कसरी चिन्नुहुन्छ? उहाँले कुन काम गर्नुहुन्थ्यो, लगभग कहिलेदेखि कहिलेसम्म?" |
| Confirm | "They said they worked as ___ from ___ to ___. Is that right?" | "उहाँले ___ देखि ___ सम्म ___ को रूपमा काम गरेको भन्नुभएको छ। के यो सही हो?" |
| Rehire question | "Would you employ them again? Yes, no, or prefer not to say is fine." | "के तपाईं उहाँलाई फेरि काममा राख्नुहुन्छ? हो, होइन, वा भन्न नचाहनु पनि ठीक छ।" |
| Close | "Thank you. We only use this to confirm their work experience." | "धन्यवाद। यो जानकारी उहाँको कामको अनुभव पुष्टि गर्न मात्र प्रयोग हुन्छ।" |
| To the worker (verified) | "Your work at ___ is verified and now shows on your Skill Passport." | "___ मा गरेको तपाईंको काम प्रमाणित भयो र अब सीप राहदानीमा देखिन्छ।" |
