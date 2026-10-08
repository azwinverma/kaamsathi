# Guide — Worker registration camps (field agents)

| | |
| --- | --- |
| Owner | Field lead |
| Team per camp | 2 field agents (at least one woman where women workers are expected), 1 verifier (can be remote), plus the employer's champion or the naike for introductions |
| Tools | Ops console on a KaamSathi tablet or phone: `/ops/workers/new`, `/ops/workers/[id]` (photo + ID upload). Worker app for self-registration. Printed QR to the app store. Printed bilingual consent sheet. |
| Related | [kyc-identity-verification.md](kyc-identity-verification.md), [employer-onboarding-playbook.md](employer-onboarding-playbook.md), [fraud-escalation.md](fraud-escalation.md), [GO_TO_MARKET.md §4.2](../GO_TO_MARKET.md#42-worker-supply-free-for-workers-always) |

## Camp types

| Type | Where | When | Expectation per 2-agent team |
| --- | --- | --- | --- |
| Employer site camp | Pilot employer premises (staff room, guard post) | Shift change (06:30–08:00 or 14:00–15:00), agreed with HR | 40–80 workers/day, high verification rate (employer knows them) |
| Labour chowk desk | Kalanki, Chabahil, Koteshwor, Balkhu, Satdobato; bus parks in Birgunj/Hetauda | 06:00–09:00, before work is assigned | 20–40/day; skilled trades first; many without documents on them |
| Training institute day | CTEVT-affiliated schools, Employment Service Centres | During final-month classes | 30–60/day; credentials verified with the institute |
| Naike crew session | Naike's site or tea shop | Evening, after work | 10–25/session; check that the naike charges no fee |
| Returnee session | Municipal Migrant Resource Centre, returnee groups | Weekends | 10–30; foreign work history via reference checks |

## Before the camp

- [ ] Permission from the site owner or employer HR, or from the ward office for public spaces.
- [ ] Banner and leaflet (Nepali first): **"निःशुल्क दर्ता — कसैलाई पैसा नतिर्नुहोस्"** (Free registration — don't pay anyone).
- [ ] Devices charged, power bank, mobile data, a backup SIM from a second operator (NTC + Ncell).
- [ ] Logged in to the ops console with your **own** staff account. Never share logins.
- [ ] Printed consent sheets, for workers who prefer paper. They are stored in a locked folder
      at the office and never photographed on personal phones.
- [ ] Trade list and NSTB levels on a card (see [GLOSSARY.md](../GLOSSARY.md)).

## Station flow (about 6–8 minutes per worker)

1. **Welcome and explain** (script below): what KaamSathi is, that it's free, what we store,
   and who sees it.
2. **Consent.**
   - The worker agrees to data processing: tap in the app, or channel `ops`/`paper` on the record.
   - Sharing with employers beyond their own, and with partners, is **separate** and optional.
   - No consent, no registration. That's fine; thank them.
3. **Phone.** The worker's **own** mobile number. Not the naike's, and not a relative's unless the
   worker truly has no phone; if so, write it in the note. Send an OTP or welcome SMS to confirm
   it reaches them.
4. **Profile** (`/ops/workers/new`):
   - name in English and Nepali
   - gender
   - date of birth (enter AD; convert from the BS on their citizenship with the calendar tool)
   - permanent and current district
   - trades with years of experience and NSTB level if certified
   - expected monthly wage
   - availability
   - naike, if they belong to a crew
5. **Photo.** Face, plain background, no cap or sunglasses.
6. **ID.** Photograph the original citizenship certificate front and back, or the NID, **directly
   into the console**. Flat, all corners visible, no glare. Hand the document back immediately.
   Never keep any original document.
7. **Payment details** (employer camps only): bank and account, or eSewa/Khalti ID. These must be
   **in the worker's own name**. If the worker asks to use someone else's account, note it and
   tell the field lead (possible wage theft; see [fraud-escalation.md](fraud-escalation.md)).
8. **App** (optional): help install it, log in with OTP, set language to नेपाली, show
   hajiri/payslip/privacy. If they already had a profile, `POST /me/worker/claim` links it.
9. **Close.** Tell them what happens next: verification within 1 working day, and an SMS when done.

## Rules (non-negotiable)

- **No money changes hands.** Not for registration, photos, "processing", or "priority". Report
  any naike or agent who collects money.
- Only adults (18+). If a child turns up, don't register them; tell the field lead.
- Personal data stays in the system. No photos on personal phones, no WhatsApp groups with ID
  images, no paper lists of phone numbers left behind.
- Don't promise jobs or wages. Say: "Employers will be able to find you; we'll SMS you if you're
  shortlisted."
- Don't register anyone for foreign jobs. Refer them to the documents feature and the DoFE
  safety guidance ([foreign-employment-documents.md](foreign-employment-documents.md)).
- Women workers may prefer a woman agent and a private corner for photos. Arrange it.
- Treat everyone the same regardless of caste, ethnicity, religion, gender, disability or district.

## After the camp (same day)

- [ ] Count: registered, consented, IDs captured, apps installed, by trade. Post in the ops
      channel (numbers only).
- [ ] Verifier processes the camp's KYC queue within 1 working day.
- [ ] List workers without documents for a follow-up visit.
- [ ] Report incidents: fee-charging, child labour, a hostile naike.
- [ ] Paper consent sheets go into the locked folder; log them in the register.

## Scripts

| Moment | English | नेपाली |
| --- | --- | --- |
| Welcome | "KaamSathi keeps your work record, hajiri and payslips safe in your name. Registration is completely free. Nobody should take money from you." | "KaamSathi ले तपाईंको कामको अभिलेख, हाजिरी र तलब विवरण तपाईंकै नाममा सुरक्षित राख्छ। दर्ता पूर्ण रूपमा निःशुल्क छ। कसैले पनि तपाईंसँग पैसा लिनु हुँदैन।" |
| What we store | "We store your name, phone, photo, ID, skills and work history. Your employer sees what's needed for your job. Others see your profile only if you allow it, and you can see who viewed it." | "हामी तपाईंको नाम, फोन, फोटो, परिचयपत्र, सीप र कामको इतिहास राख्छौं। रोजगारदाताले कामका लागि चाहिने कुरा मात्र देख्छन्। अरूले तपाईंको अनुमतिमा मात्र हेर्न सक्छन्, र कसले हेर्‍यो भनेर तपाईं आफैं हेर्न सक्नुहुन्छ।" |
| Consent question | "Do you agree to register and let KaamSathi keep these details?" | "के तपाईं दर्ता हुन र यी विवरण KaamSathi मा राख्न सहमत हुनुहुन्छ?" |
| ID photo | "I'll take a photo of your citizenship and give it straight back. We don't keep the original." | "म तपाईंको नागरिकताको फोटो खिचेर तुरुन्तै फिर्ता दिन्छु। हामी सक्कल राख्दैनौं।" |
| Own account | "Your salary must come to an account in your own name." | "तपाईंको तलब तपाईंकै नाममा भएको खातामा आउनुपर्छ।" |
| Next steps | "We will check your details within one day and send you an SMS." | "हामी एक दिनभित्र तपाईंको विवरण जाँचेर SMS पठाउनेछौं।" |
