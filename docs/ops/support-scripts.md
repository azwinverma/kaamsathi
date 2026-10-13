# Support scripts — workers and employers (English / नेपाली)

| | |
| --- | --- |
| Owner | Ops lead |
| Used by | `support` role, field agents, anyone answering the KaamSathi phone |
| Tools | Support cases `/ops/support` → `GET /ops/support-cases`, `PATCH /ops/support-cases/{id}`, messages with an `internal` flag (**in progress**, `apps.support`). Until it ships, log every call in the shared support sheet *without personal data* (case number, org, category, outcome). Worker lookup: `/ops/workers`. Employer lookup: `/ops/organizations`. |
| Related | [dispute-handling-sla.md](dispute-handling-sla.md), [data-protection-requests.md](data-protection-requests.md), [fraud-escalation.md](fraud-escalation.md), [incident-communications.md](incident-communications.md), [bolau-home-visit-safety.md](bolau-home-visit-safety.md) |

## Service levels (support cases)

| Priority | Examples | First response | Resolution target (`sla_due_at`) |
| --- | --- | --- | --- |
| urgent | Can't log in at payroll time; whole site can't mark hajiri; wages not received; a worker asked to pay money; data exposure | 1 working hour | 4 h |
| high | One worker can't check in; payslip wrong; export not working | 4 working hours | 24 h |
| normal | How-to questions, profile changes | 1 working day | 72 h |
| low | Feedback, feature requests | 2 working days | 7 days |

Working hours: Sunday–Friday 09:00–18:00 NPT. On Saturdays and public holidays, monitor
**urgent** cases only (phone on rota). Payroll days (BS day 1–5): extend to 20:00.

## Golden rules

1. **Never ask for an OTP code, password or PIN.** Say this on every call where login comes up.
2. Verify the caller before discussing any record.
   - Worker: the call comes from the registered phone, **or** they state full name + date of
     birth + employer.
   - Employer: the call comes from a member's registered phone, **or** we call back the member
     on their registered number.
3. Don't read out ID numbers, bank account numbers or another person's details. Ever.
4. Workers never pay. If anyone asked them for money → [fraud-escalation.md](fraud-escalation.md).
5. Use the caller's language. Default to Nepali, and use simple words: हाजिरी, तलब, पेस्की, बिदा.
6. Open a case for every contact that needs follow-up, and quote the `request_id` from error
   screens when the app shows one.
7. Don't promise what the employer controls (pay dates, wage amounts). Explain what *they* can
   do in KaamSathi.

## Opening and closing

| | English | नेपाली |
| --- | --- | --- |
| Greeting | "Namaste, KaamSathi support, this is ___. How can I help?" | "नमस्ते, KaamSathi सहयोग केन्द्र, म ___ बोल्दैछु। म तपाईंलाई कसरी सहयोग गर्न सक्छु?" |
| Verify (worker) | "To protect your information, please tell me your full name, date of birth and employer." | "तपाईंको जानकारी सुरक्षित राख्न आफ्नो पूरा नाम, जन्म मिति र काम गर्ने ठाउँ बताउनुहोस्।" |
| OTP warning | "We will never ask for your OTP code. Don't share it with anyone, not even KaamSathi staff." | "हामी कहिल्यै OTP कोड माग्दैनौं। KaamSathi का कर्मचारीलाई समेत यो कोड नदिनुहोस्।" |
| Case number | "Your case number is KS-___. We will update you by ___." | "तपाईंको केस नम्बर KS-___ हो। हामी ___ सम्ममा जानकारी दिनेछौं।" |
| Close | "Is there anything else? Thank you for calling KaamSathi." | "अरू केही सहयोग चाहिन्छ? KaamSathi मा फोन गर्नुभएकोमा धन्यवाद।" |

## Worker issues

**1. "I don't get the login code (OTP)"**
- Check:
  - Is the number correct (10 digits, starts with 98/97)?
  - Do they have network coverage and SMS balance?
  - Have they had more than 5 requests in the last hour (`otp_rate_limited`)? If so, wait 1 hour.
  - Check the SMS log for failures (`notifications_smsmessage`). Several failures across users →
    gateway issue → [RUNBOOK §7](../RUNBOOK.md#7-sms-gateway-failover-otp-login-depends-on-it).
- EN: "Please wait one minute and tap 'Send code again'. The code expires after 5 minutes."
- NE: "कृपया एक मिनेट पर्खेर 'फेरि कोड पठाउनुहोस्' थिच्नुहोस्। कोड ५ मिनेटमा म्याद सकिन्छ।"

**2. "I changed my phone number"**
- Phone is the login. Verify identity strongly: name, DOB, employer, **plus** a call to their
  employer's HR. Then ops updates the phone, and the audit log records it.
- NE: "नयाँ नम्बर परिवर्तन गर्न हामी तपाईंको रोजगारदातासँग पनि पुष्टि गर्छौं। एक कार्यदिन लाग्न सक्छ।"

**3. "Check-in doesn't work" (QR / geofence)**
- `outside_geofence`: they must be at the site, with location turned on. GPS indoors can be off
  by 50–100 m. Ask them to step outside or near a window and try again. Repeated failures for
  many workers → the site's geofence or coordinates are wrong; tell the employer admin
  (`/app/settings/sites`).
- QR not recognised → the QR may have been rotated. Ask the supervisor for the current poster.
- EN: "Please turn on location, stand near the entrance, and scan the QR poster again. If it still fails, ask your supervisor to mark your hajiri."
- NE: "लोकेसन खोल्नुहोस्, गेटनजिक उभिएर QR पोस्टर फेरि स्क्यान गर्नुहोस्। अझै भएन भने सुपरभाइजरलाई हाजिरी लगाइदिन भन्नुहोस्।"

**4. "My hajiri is wrong" / "My payslip is wrong"**
- Look at the attendance register or payslip with them. Explain the lines: basic, DA, OT,
  SSF 11%, TDS and peski recovery are deducted.
- If it is still wrong → help them raise a dispute in the app (*Disputes → New*) or raise one for
  them ([dispute-handling-sla.md](dispute-handling-sla.md)).
- NE: "तलब विवरणमा आधारभूत तलब, महँगी भत्ता, ओभरटाइम छन्; सामाजिक सुरक्षा कोष ११%, कर र पेस्की कट्टी हुन्छ। फरक लागेमा एपबाट गुनासो दर्ता गर्नुहोस्, हामी रोजगारदातासँग जाँच्छौं।"

**5. "I haven't been paid"**
- Check the payroll run status (`approved` / `paid`) and the payout item status.
  - Marked `paid` but not received → check the bank or wallet details on file. Raise an urgent
    wage dispute.
  - Not run yet → tell them the employer hasn't finalised payroll. Don't promise a date.
- NE: "रोजगारदाताले यो महिनाको तलबी अझै टुंगो लगाउनुभएको छैन। हामी उहाँलाई सम्झाउँछौं।"

**6. "Someone asked me for money for a job"**
- Urgent → [fraud-escalation.md](fraud-escalation.md).
- NE: "KaamSathi मा काम पाउन कसैलाई पैसा तिर्नुपर्दैन। कसले, कति माग्नुभयो? हामी गोप्य राख्छौं।"

**7. "Who has seen my profile?" / "Stop sharing my data"**
- App → Privacy shows profile views and partner access. They can revoke grants and passport
  share links themselves. For export or deletion → [data-protection-requests.md](data-protection-requests.md).
- NE: "एपको 'गोपनीयता' मा कसले तपाईंको प्रोफाइल हेरे देखिन्छ। त्यहीँबाट अनुमति फिर्ता लिन सकिन्छ।"

**8. "I want to work abroad"**
- We don't recruit for foreign jobs. They can store documents and share them with a licensed
  agency they choose ([foreign-employment-documents.md](foreign-employment-documents.md)).
- NE: "KaamSathi ले विदेशमा काम दिलाउँदैन। तपाईं आफ्ना कागजात सुरक्षित राखेर आफूले रोजेको इजाजतप्राप्त म्यानपावर कम्पनीलाई देखाउन सक्नुहुन्छ। दर्ता इजाजत वैदेशिक रोजगार विभागको वेबसाइटमा जाँच्नुहोस्।"

**9. App language / can't read**
- Settings → Language → नेपाली. Low literacy → offer a call-back or help at the next site camp.

## Employer issues

**1. "Import failed"** (`POST /org/employments/import`)
- Download the template again (`import-template.xlsx`). Common errors:
  - phone not 10 digits
  - basic + DA below the minimum wage (Rs. 19,550 monthly; Rs. 754 daily)
  - BS dates without `date_system=bs`
  - duplicate phone numbers

  The error list gives a row number for each failure.
- NE: "टेम्प्लेट फेरि डाउनलोड गर्नुहोस्। त्रुटि सूचीमा पङ्क्ति नम्बर देखिन्छ, त्यही पङ्क्ति सच्याउनुहोस्।"

**2. "Why is this worker's salary different from Excel?"**
- Walk through the calculation:
  1. Days in the BS month: 29–32, not 30.
  2. Payable days include weekly off and public holidays for monthly staff. Days with no hajiri
     record count as **absent**.
  3. OT = (basic + DA) ÷ (days × 8) × 1.5.
  4. SSF 11% / 20% is on **basic** only.
  5. TDS: the 1% slab is waived for SSF contributors.
- Most common cause: hajiri was not marked. Fix it in the draft run, then *Recalculate*.

**3. "Payroll is approved but we found a mistake"**
- Approved months are locked by design. Correct it in next month's run, with a note
  ([dispute-handling-sla.md](dispute-handling-sla.md) step 5). Never promise a DB edit.

**4. "Bank won't accept the file"**
- Use the CSV/XLSX from *Payouts*. Some banks need their own column order: send the file to
  support. We'll add a bank-specific format and they can use manual entry for this month.

**5. "SSF file / due date"**
- *Compliance → SSF filings*. We prepare the file; the employer uploads it on the SSF portal and
  records the receipt number. Reminders go out 5 days and 1 day before the due date.

**6. "Add a supervisor"**
- *Settings → Team → Add* with phone, role `supervisor` and their sites. The supervisor installs
  the app and logs in with OTP.

**7. "Why can't I see the candidate's phone?"**
- The full profile opens after shortlisting or with the worker's consent. Workers see who viewed
  them; that's what makes them trust KaamSathi.

**8. Billing**
- Pilot is free (`plan=pilot`). After that: NPR 150 per active worker per month, minimum 3,000,
  plus NPR 5,000 per hire with a free replacement within 30 days. Invoices are under *Billing*.

| Employer phrase | English | नेपाली |
| --- | --- | --- |
| Minimum wage block | "KaamSathi does not allow wages below the government minimum: Rs. 19,550 per month or Rs. 754 per day." | "KaamSathi ले सरकारले तोकेको न्यूनतम पारिश्रमिकभन्दा कम राख्न दिँदैन: मासिक रु. १९,५५० वा दैनिक रु. ७५४।" |
| Locked month | "This month's payroll is approved, so hajiri is locked. We'll add the correction in next month's payroll." | "यो महिनाको तलबी स्वीकृत भइसकेकाले हाजिरी लक भएको छ। सच्याइ अर्को महिनाको तलबीमा गरिन्छ।" |
| Escalate | "I'm passing this to our payroll specialist; you'll hear back by ___." | "यो कुरा हाम्रो तलबी विशेषज्ञलाई पठाउँदैछु, ___ सम्ममा जवाफ आउनेछ।" |
