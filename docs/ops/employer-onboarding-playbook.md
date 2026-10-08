# Playbook — Employer onboarding (first 30 days)

| | |
| --- | --- |
| Owner | Account owner (ops), with the founder who sold the deal |
| Goal | The employer uses **Manage weekly**: hajiri on ≥ 4 days/week and a payroll run they trust. That is the pilot go/no-go metric ([ROADMAP.md](../ROADMAP.md#phase-1--hire-manage-and-worker-passport-pilot-90-days)). |
| Related | [employer-verification-kyb.md](employer-verification-kyb.md), [worker-registration-camps.md](worker-registration-camps.md), [support-scripts.md](support-scripts.md) |

## Roles

| Role | Who | Does |
| --- | --- | --- |
| Account owner | KaamSathi ops | Runs this playbook, weekly check-in, first payroll on site |
| Champion | Employer HR/admin (`hr` or `admin` membership) | Owns data and staff communication |
| Accountant | Employer accounts (`hr` role or read access via the owner) | Compares the first payroll with Excel |
| Supervisors | One per site/shift (`supervisor` membership with sites) | Daily hajiri in the app |
| Field agents | KaamSathi | Site camp: worker consent, app install, photos |

## Before day 1 (sales handover)

- [ ] Pilot letter signed: free 90 days, data terms, our role (not employer of record, never holds wages).
- [ ] Owner logged in (`/login`) and created the organisation (`/onboarding`): legal name, PAN,
      industry, district, address, phone.
- [ ] KYB submitted and verified ([employer-verification-kyb.md](employer-verification-kyb.md)).
- [ ] Ask for:
  - [ ] the staff list (Excel): name, phone, designation, start date, wage type, basic, DA,
        allowances, SSF yes/no, SSF ID, bank, account number
  - [ ] the last 2 months' wage sheets
  - [ ] their leave policy
  - [ ] their weekly off day
  - [ ] site addresses
  - [ ] shift times

  Their Excel wage sheet is the baseline we must match.

## Day 1–3: set up

1. **Settings** (`/app/settings`):
   - weekly off day (default Saturday)
   - `ssf_employer_no`
   - VAT registered
   - logo
2. **Sites** (`/app/settings/sites`):
   - Drop the pin **at the gate where people check in**, not at the building's centre.
   - Geofence radius 200 m by default. Use 100 m for compact hotels, and 300–500 m for large
     hospitals or construction sites.
   - Print the site QR (`/org/sites/{id}/qr.png`) on A4 and laminate it. Post it at the entrance
     and at the security post.
3. **Shifts** (`/app/settings/shifts`): morning/evening/night with break minutes. Security
   companies usually run 12-hour shifts; record OT properly (above 8 h/day is OT, max 24 h/week
   per the Labour Act).
4. **Holidays** (`/app/settings/holidays`): check the national 2083 list (dates are approximate
   and editable) and add organisation-specific holidays.
5. **Team** (`/app/settings/team`): add HR/admin and each supervisor with their sites.
6. **Import staff** (`/app/workers` → Import):
   - Use `import-template.xlsx` and fix the errors it reports row by row.
   - Wages below the minimum wage are rejected. If their sheet shows it, raise it tactfully with
     the champion: it's a legal exposure for them, and the compliance score will show it.
   - BS dates are fine with `date_system = bs`.
7. **Check employments** after import:
   - wage type
   - basic/DA split (monthly) or daily wage
   - SSF enrolled
   - site
   - supervisor
   - employee code

## Day 3–7: people

1. **Supervisor training** (30 min per site, in person):
   - install the app and log in with OTP
   - Hajiri screen: mark all present → change the exceptions → save
   - offline: it saves on the phone and syncs later
   - leave approve/reject
   - roster
   - Leave each supervisor with the one-page cheat sheet (Nepali).
2. **Worker site camp** ([worker-registration-camps.md](worker-registration-camps.md)):
   - consent (data processing) recorded
   - app installed where the worker wants it (optional; supervisor hajiri works without it)
   - photo and ID for KYC
   - bank/wallet details confirmed by the worker themself
   - SSF ID collected
3. **Explain to workers** (script below) what changes for them and that KaamSathi is free.

## Week 2–4: habit and first payroll

| When | Action | Check |
| --- | --- | --- |
| Daily, first 2 weeks | Account owner checks `/app/attendance` (or `/ops/organizations/[id]`) for not-marked counts | Call the supervisor if a site has 2 unmarked days |
| End of week 1 | 15-min call with the champion: problems and missing workers | — |
| BS month end | Create the payroll run (`/app/payroll`), with the Dashain allowance flag if relevant | Account owner sits with the accountant |
| Same day | **Parallel run**: compare KaamSathi totals with their Excel line by line | Every difference is explained as either a KaamSathi data error (fix it) or an error in their Excel (show them) |
| Next day | Approve; export the wage sheet (तलब पाना), bank file and payslips; mark paid after the transfer | Workers get the "payslip ready" SMS |
| Within SSF due days | Prepare the SSF file (*Compliance*), upload it to the SSF portal, record the receipt | Compliance score item `ssf_filings_overdue` stays OK |
| Day 30 | Review: hajiri days marked per week, payroll accepted, open issues, first job request | Decide on next steps |

## Hire add-on (any time after KYB)

- Champion posts a job (`/app/jobs/new`). Wage ≥ minimum is enforced. Include food and
  accommodation, shift and start date.
- Ops shortlists within **48 h** (`/ops/jobs/[id]` → matches → shortlist). The employer moves
  candidates through interview → selected → joined, entering employment details at joined.
- Explain the replacement window: a free replacement if the hire leaves within 30 days. During
  the pilot, placement charges are waived.

## Success criteria at day 30

- [ ] ≥ 90% of active workers imported and linked to a site
- [ ] Hajiri marked on ≥ 4 days/week for the last 2 weeks
- [ ] First payroll approved and accepted by the accountant (differences explained)
- [ ] All supervisors active in the app
- [ ] Compliance score reviewed with the champion, with 3 action items agreed
- [ ] At least one hard-to-fill role identified for Hire

## Scripts

| Situation | English | नेपाली |
| --- | --- | --- |
| To workers at the site | "Your company now records hajiri and salary in KaamSathi. It's free for you. You can see your hajiri and payslip on your phone, and your work record stays with you even if you change jobs." | "तपाईंको कम्पनीले अब हाजिरी र तलब KaamSathi मा राख्छ। यो तपाईंका लागि निःशुल्क हो। आफ्नो हाजिरी र तलब विवरण मोबाइलमै हेर्न सक्नुहुन्छ, र काम छाडे पनि कामको अभिलेख तपाईंकै नाममा रहन्छ।" |
| To supervisors | "Every morning, open Hajiri, tap 'All present', change only those who are absent or on leave, and save. No network? It saves and sends later." | "हरेक बिहान हाजिरी खोल्नुहोस्, 'सबै उपस्थित' थिच्नुहोस्, अनुपस्थित वा बिदामा हुनेलाई मात्र परिवर्तन गरेर सेभ गर्नुहोस्। नेट नभए पनि सेभ हुन्छ, पछि आफैं पठाउँछ।" |
| To the accountant | "We'll run this month in parallel with your Excel. Any difference we'll explain line by line before you approve." | "यो महिना तपाईंको एक्सेलसँगै चलाएर हेरौं। स्वीकृत गर्नुअघि हरेक फरक पङ्क्ति-पङ्क्ति बुझाउँछौं।" |
