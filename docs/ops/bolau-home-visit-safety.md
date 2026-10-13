# SOP — Bolau home-visit safety, no-shows and suspensions

| | |
| --- | --- |
| Owner | Ops lead |
| Performed by | `verifier` role (Sipalu identity), `support` role (bookings, safety cases, no-shows, suspensions) |
| Tools | Ops console `/ops/verification`, `/ops/bolau` (bookings, requests, Sipalu, ratings, reports, risk flags, KPIs, fees), `/ops/support` (safety cases), `/ops/disputes`, `/ops/audit` |
| Code | [apps/bolau](../../backend/apps/bolau) (`ops.py` suspend/unsuspend, `risk.py` detectors, `bookings.py` no-show), [apps/support](../../backend/apps/support) (`safety` cases), [apps/trust](../../backend/apps/trust) (booking disputes) |
| Related | [CONTRACT-BOLAU.md](../CONTRACT-BOLAU.md), [ADR 0011](../adr/0011-bolau-sipalu-ghardhani-bookings.md), [kyc-identity-verification.md](kyc-identity-verification.md), [dispute-handling-sla.md](dispute-handling-sla.md), [fraud-escalation.md](fraud-escalation.md), [support-scripts.md](support-scripts.md), [incident-communications.md](incident-communications.md) |

## Purpose

Bolau sends a Sipalu (सिपालु) into a Ghardhani's (घरधनी) home. That is the riskiest thing KaamSathi
does: both people are alone with a stranger. This SOP sets out what ops checks **before** the
`bolau` flag is switched on and before a Sipalu becomes bookable, and how ops handles safety
reports, emergencies, no-shows, off-platform payment and suspensions afterwards.

KaamSathi is an intermediary, not the police and not an employer of the Sipalu. In danger, the
first call is always **100 (Nepal Police)**. We record, protect evidence, support both people,
and act on the platform (suspend, cancel, refund).

## 0. Before switching Bolau on (go-live gate)

The `bolau` flag stays **off** in production until all of these are true
([PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md) → Bolau):

- [ ] Lawyer sign-off (Consumer Protection Act 2075, intermediary status, booking terms, liability for home-visit incidents).
- [ ] At least two named `support` staff on the rota for every hour that bookings can start (the app only offers slots inside Sipalu availability, typically 06:00–21:00), each enrolled in TOTP MFA and trained on this SOP.
- [ ] An escalation contact (ops lead) reachable by phone for emergencies at all those hours.
- [ ] Every Sipalu who will be bookable has passed §1 below.
- [ ] Staff can find the booking code, both phone numbers and the address snapshot in `/ops/bolau` within one minute (drill it).
- [ ] If `bolau_fee` will be on: the gateway merchant agreement is signed and `BOLAU_WEBHOOK_SECRETS` is set.

## 1. Verifying a Sipalu before they can be booked

A Sipalu is bookable only when `verification_status=verified`, `bolau_enabled` is on and they are
not suspended (enforced in code). Verification is the normal KYC flow with the extra checks below.

1. Run [kyc-identity-verification.md](kyc-identity-verification.md) in full: citizenship / NID
   photos match the selfie, the name matches, the person is an adult, one record per person.
2. **Video or in-person call** (5 minutes) before the first approval: the face matches the ID and
   the profile photo; they can describe their trade and the area they serve.
3. Check the profile text and portfolio: no phone numbers, links or "pay me outside the app"
   wording; photos are of their own work (no stock images, no other people's faces without consent).
4. Prices: the app already blocks hourly rates below the minimum wage. Look for obviously wrong
   fixed prices (e.g. Rs 5) and ask them to fix it.
5. Ask whether they have any criminal case pending. Note the answer in the KYC note. We do not have
   police-record access; if one is disclosed, escalate to the ops lead before approving.
6. Record the result in the verification note: "Bolau checks done: video call, profile, prices" + your name.

Reject or hold (with a reason the Sipalu can act on) if any step fails. Never mark verified to
"help someone start earning" before the checks are done.

## 2. Safety reports and emergencies

Either party can file a confidential safety report from any booking (`POST
/bolau/bookings/{id}/safety-report`, `{safety_kind, description, emergency?, anonymous?}`). It
creates a support case, category `safety`, always confidential, **high** priority (24 h SLA), or
**urgent** (4 h SLA, alerts all support staff now) when `emergency` is set. The booking screen also
shows the emergency line 100 in both languages.

| Situation | What to do |
| --- | --- |
| **Emergency** (violence, threat, someone hurt, someone trapped, still happening) | Call the reporter **now**. If they are in danger and have not called 100, tell them to, or call 100 for them with the address from the booking. Stay on the line until help is coming. Then call the ops lead. |
| Harassment / abuse, no immediate danger | Call the reporter within 4 h. Listen, write down what happened in their words, ask what they need. Suspend the other party's Bolau access (§5) while you investigate if the report is credible. |
| Unsafe situation at the home (dog, electrics, unsafe ladder) | Call within 24 h. Support the Sipalu's right to refuse unsafe work; no rating penalty for a safety-based cancellation (ops cancels with reason `safety`). |
| Theft or damage accusation | Treat as a booking dispute (§4) unless violence was involved. Advise a police report for theft. |

For every safety case:

1. Keep the reporter's identity from the other party when they chose `anonymous`.
2. Preserve evidence: do not delete messages, ratings or the booking; screenshot the booking
   detail (`/ops/bolau` → booking) into the case.
3. Cancel any **future** bookings between the same two people (`POST /ops/bolau/bookings/{id}/cancel {reason}`).
4. Follow up within 7 days and close the case with a written outcome.
5. Serious incidents (assault, sexual harassment, injury) → incident process in
   [incident-communications.md](incident-communications.md); the ops lead decides on a police
   referral with the victim's consent, and handles any media question. Never post about a case.

## 3. No-shows

- The Ghardhani can report a no-show 30 minutes after the booked start (`report-no-show`). The
  booking becomes `no_show` and any booking fee is refunded or waived automatically.
- The Sipalu can't report the Ghardhani as a no-show in the app: they call support or raise a booking
  dispute. Check the "on the way" and arrival-code events, then cancel with reason `ghardhani_no_show`.
- Check the Sipalu's history in `/ops/bolau` → Sipalu. **2 no-shows in 30 days** → warning call;
  **3** → suspend (§5) until a call with the ops lead.
- If the Sipalu had a genuine emergency (illness, accident), record it in the case and don't count it.

## 4. Disputes, ratings and off-platform payment

- **Booking disputes** (price, quality, damage, "paid but not marked paid") follow
  [dispute-handling-sla.md](dispute-handling-sla.md). Both parties can see the dispute, add evidence
  and appeal once. The Ghardhani uses `/ghar` or the app → My disputes.
- **Ratings**: hide or void only abusive or proven-false ratings (`/ops/bolau` → ratings). The
  review-fraud detector flags ratings from the same device or address; check the flags weekly.
- **Off-platform payment**: Ghardhani pay the Sipalu directly (cash, eSewa, Khalti, bank), and that is
  allowed. What is **not** allowed is taking bookings off KaamSathi to avoid the booking fee or
  the safety trail ("call me directly next time"), or asking for advance payment before the visit.
  Reports (`report {reason: off_platform_payment}`) raise a risk flag.
  - First report → call the Sipalu, explain the rule (script below), note it.
  - Second confirmed report in 90 days → 14-day suspension.
  - Demanding advance payment, or any threat → immediate suspension and escalation.
- **Cancellation abuse**: the detector flags many late cancellations. Call, find out why, and
  suspend only if it continues after a warning.

## 5. Suspension rules

Suspend from `/ops/bolau` → Sipalu → **Suspend** with a written reason (audited). Suspension turns
Bolau off and blocks new bookings; the Sipalu cannot switch it back on. Existing future bookings are
**not** cancelled automatically: cancel them with reason `sipalu_suspended` and tell each Ghardhani.

| Trigger | Action |
| --- | --- |
| Credible safety report (violence, harassment, theft) | Suspend at once, pending investigation |
| Demanding advance payment / threats | Suspend at once |
| 3 no-shows in 30 days | Suspend until a call with the ops lead |
| 2nd confirmed off-platform solicitation in 90 days | 14-day suspension |
| Identity doubt (ID mismatch found later) | Suspend + re-run KYC |
| Review fraud confirmed | Void the fake ratings; suspend 30 days on a repeat |

**Lifting**: only the ops lead lifts a suspension for a safety reason. Lift with a note
(`unsuspend {note}`). Lifting does **not** re-enable bookings: the Sipalu switches Bolau back on
in their app. Tell them so on the call.

A Ghardhani who abuses a Sipalu loses the ability to book: ops cancels their open bookings, and the
case goes to the ops lead to block the account under the terms.

## 6. Scripts (EN / NE)

Use the caller's language; default to Nepali. Keep it short and calm.

**Emergency call-back (to either party)**
- EN: "This is {name} from KaamSathi. You reported an emergency on booking {code}. Are you safe right now? If anyone is in danger, please call 100 now. I can call them for you."
- NE: "म कामसाथीबाट {name} बोल्दैछु। तपाईंले बुकिङ {code} मा आपतकालीन रिपोर्ट गर्नुभएको छ। तपाईं अहिले सुरक्षित हुनुहुन्छ? कोही खतरामा भए अहिल्यै १०० मा फोन गर्नुहोस्। म तपाईंका लागि फोन गरिदिन सक्छु।"

**Safety report follow-up**
- EN: "Thank you for telling us. Your report is confidential. We won't share your name without your permission. We have paused bookings between you and this person while we look into it."
- NE: "हामीलाई भन्नुभएकोमा धन्यवाद। तपाईंको रिपोर्ट गोप्य राखिन्छ, तपाईंको अनुमति बिना नाम कसैलाई भनिँदैन। हामीले छानबिन गर्दासम्म तपाईं र उहाँबीचका बुकिङ रोकेका छौँ।"

**No-show (to the Sipalu)**
- EN: "Booking {code} was reported as a no-show. Could you tell me what happened? If you can't make a booking, please cancel it in the app as early as you can, so the household isn't left waiting."
- NE: "बुकिङ {code} मा तपाईं आउनुभएन भनेर रिपोर्ट आएको छ। के भएको थियो, भन्नुहोस् न? बुकिङमा आउन नसक्ने भए सकेसम्म चाँडो एपमै रद्द गर्नुहोस्, ताकि घरधनी कुरेर बस्नु नपरोस्।"

**Off-platform solicitation (first warning, to the Sipalu)**
- EN: "Households pay you directly, and that's fine. But bookings must stay on KaamSathi. That's how both of you are protected, with the arrival code, the safety report and your ratings. Please don't ask for bookings or advance payment outside the app."
- NE: "घरधनीले पैसा सिधै तपाईंलाई तिर्नु ठिकै हो। तर बुकिङ भने कामसाथीमै हुनुपर्छ, किनकि आगमन कोड, सुरक्षा रिपोर्ट र रेटिङले तपाईं दुवैलाई सुरक्षित राख्छ। कृपया एपबाहिर बुकिङ वा अग्रिम भुक्तानी नमाग्नुहोस्।"

**Suspension (to the Sipalu)**
- EN: "We have paused your Bolau profile because {reason}. You can still use KaamSathi for other work. {next step}. If you think this is wrong, you can raise a dispute in the app."
- NE: "{reason} भएकाले हामीले तपाईंको बोलाउ प्रोफाइल रोकेका छौँ। कामसाथीका अरू सेवा भने चलाउन सक्नुहुन्छ। {next step}। यो गलत भयो जस्तो लागे एपबाट उजुरी दिन सक्नुहुन्छ।"

**Suspension lifted**
- EN: "Your Bolau profile is no longer paused. Switch 'Take bookings' back on in the app (Jobs → Bolau) when you're ready."
- NE: "तपाईंको बोलाउ प्रोफाइल अब रोकिएको छैन। तयार हुनुभएपछि एपमा (काम → बोलाउ) 'बुकिङ लिने' फेरि खोल्नुहोस्।"

> 🔴 The Nepali scripts need the native-speaker review listed in
> [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md) before staff use them.

## 7. Records and review

- Every suspension, lift, cancellation and rating action is in `/ops/audit`.
- Weekly: review `/ops/bolau` KPIs (cancellations, no-shows, open disputes), open risk flags and
  every safety case still open.
- Monthly: the ops lead reviews suspensions and safety outcomes, and updates this SOP.
