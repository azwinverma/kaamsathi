# SOP — Incident communications

| | |
| --- | --- |
| Owner | Incident commander (IC): the on-call engineer for SEV2/3, a founder for SEV1 |
| Comms lead | Ops lead (employers and workers). A founder handles partners, regulator and press. |
| Technical runbook | [RUNBOOK.md §8](../RUNBOOK.md#8-incident-response) (triage, mitigation, postmortem), [SECURITY.md §6](../SECURITY.md#6-breach-response) (personal-data breach) |

## Purpose

When something breaks, the people who depend on KaamSathi hear it from us first, quickly and
plainly, in their language. Supervisors need to know whether to keep marking hajiri. Accountants
need to know whether payroll is safe. Workers need to know their pay is not affected.

## Severity → communication

| Severity (RUNBOOK §8) | Examples | Who we tell | First message | Updates |
| --- | --- | --- | --- | --- |
| **SEV1** | Login/OTP down for all; hajiri or payroll down for all; **any personal-data exposure** | All active employers (champion + owner by phone/SMS); workers if they are affected; partners if their flows are involved | **within 1 hour** | every hour until resolved, then a final note |
| **SEV2** | One feature down (exports, QR check-in), or one org affected | Affected employers' champions | within 4 working hours | at resolution |
| **SEV3** | Cosmetic, workaround exists | Nobody proactively; support answers if asked | — | — |

**Payroll-season rule:** between BS day 1 and day 7, treat any payroll, export or bank-file issue as
**SEV1** for communication purposes.

## Steps

1. The IC declares the incident and severity in the ops channel: what's broken, since when, and
   who's affected.
2. The comms lead drafts the first message from the templates below, the IC approves it, and it
   is sent:
   - Employers: a phone call to each pilot champion for SEV1, plus SMS.
   - Workers: SMS only if they're affected and need to act (e.g. "hajiri by supervisor today").
     Use the KaamSathi sender ID.
3. Give the workaround first:
   - OTP down → users with a valid session keep working, and supervisors mark hajiri offline (the
     app queues it).
   - QR check-in down → supervisor marks hajiri.
   - Export down → payroll data is safe; exports will follow.
4. Update on the promised cadence, even if the update is "still working on it".
5. Close it: what happened, impact, what we fixed, and what users need to do (usually nothing).
6. Postmortem within 5 working days (RUNBOOK §8). For SEV1, share a short summary with the
   affected employers.

## Personal-data breach (always SEV1)

Follow [SECURITY.md §6](../SECURITY.md#6-breach-response). Communication specifics:
- The privacy officer and a founder are informed immediately, and the lawyer within 24 h. The
  lawyer advises on regulator notification under the Privacy Act 2075.
- Affected workers get an SMS (Nepali + English) and affected employers a phone call **within 72
  hours** of confirmation. The message covers: what happened, what data, what we did, what they
  should do, and a contact.
- Don't speculate about the cause or the number of people affected before the assessment.
  Don't name individuals.
- Partners are told if their data flows were involved. API keys are rotated in coordination.

## Templates

SMS: Nepali (Unicode) fits **70 characters per part**, English 160. Keep the first part
self-explanatory. Sender ID `KaamSathi`.

**SEV1 outage — employers (SMS)**
- EN: `KaamSathi: Login/hajiri is down since 09:10. Keep marking hajiri in the app offline; it will sync. Update by 11:00. Help: 01-XXXXXXX`
- NE: `KaamSathi: ९:१० देखि लगइन/हाजिरीमा समस्या। एपमा अफलाइन हाजिरी लगाउँदै गर्नुहोस्, पछि सिंक हुन्छ। ११ बजेसम्म जानकारी दिनेछौं।`

**SEV1 outage — employer champion (phone)**
- EN: "This is ___ from KaamSathi. Since ___, ___ isn't working. Your data is safe. Please ___ (workaround). We'll call/SMS again by ___."
- NE: "म KaamSathi बाट ___ बोल्दैछु। ___ देखि ___ चलिरहेको छैन। तपाईंको डाटा सुरक्षित छ। कृपया ___ गर्नुहोस्। ___ सम्ममा फेरि जानकारी दिनेछौं।"

**Payroll export delay**
- EN: `KaamSathi: Wage sheet/bank file download is delayed. Your payroll figures are saved and correct. Expected fix: ___.`
- NE: `KaamSathi: तलब पाना/बैंक फाइल डाउनलोडमा ढिलाइ। तलबी तथ्यांक सुरक्षित छ। ___ सम्म ठीक हुनेछ।`

**Resolved**
- EN: `KaamSathi: Resolved at 10:40. Everything works normally. Offline hajiri has synced. Sorry for the trouble.`
- NE: `KaamSathi: १०:४० मा समाधान भयो। सबै सामान्य छ। अफलाइन हाजिरी सिंक भयो। असुविधाको लागि क्षमा।`

**Worker reassurance (only if workers noticed)**
- NE: `KaamSathi: प्राविधिक समस्या समाधान भयो। तपाईंको हाजिरी र तलब सुरक्षित छ।`
- EN: `KaamSathi: The technical problem is fixed. Your hajiri and pay records are safe.`

**Data breach notice — workers (SMS + follow-up call for high risk)**
- NE: `KaamSathi: तपाईंको ___ विवरणमा अनधिकृत पहुँच भएको पत्ता लाग्यो। हामीले रोकेका छौं। OTP कसैलाई नदिनुहोस्। जानकारी: 01-XXXXXXX`
- EN: `KaamSathi: We found unauthorised access to your ___ details and have stopped it. Never share your OTP. Info: 01-XXXXXXX`

(Replace `01-XXXXXXX` with the published support number once it is set up 🔴.)

## Contact list (keep current, outside the server)

| Role | Name | Phone | Backup |
| --- | --- | --- | --- |
| Incident commander (SEV1) | 🔴 | | |
| On-call engineer (rota) | 🔴 | | |
| Ops lead / comms | 🔴 | | |
| Privacy officer | 🔴 | | |
| Lawyer | 🔴 | | |
| Sparrow SMS account manager | 🔴 | | Aakash SMS |
| Hosting provider support | 🔴 | | |

## Audit trail

The incident log records: start and end times, severity, messages sent (text, audience, time,
channel) and the postmortem link. SMS sends also appear in `notifications_smsmessage`.
