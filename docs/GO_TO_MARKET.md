# KaamSathi — Go-to-market

This merges the venture strategy (guiding rules in [CONTRACT-ECOSYSTEM.md](CONTRACT-ECOSYSTEM.md)) with the
reference GTM (`nepal-workforce-os/docs/GO_TO_MARKET.md`). Where they differ, this document states
both and gives a recommendation. Pilot execution detail is in [ROADMAP.md](ROADMAP.md#90-day-pilot-plan-15-design-partners).

**What we sell, in one line:** *भरपर्दो कामदार, समयमै तलब — Verified workers. On-time pay.* For
employers that is hajiri, BS-month payroll, SSF and compliance in one place (Manage), plus fast,
verified hires (Hire). Workers get a free, portable record of their work and pay that they own.

Non-negotiables:
- B2B first, and employers pay. Workers never pay anything: no registration fee, no "visa fee", no
  deduction from wages.
- We never lend and never hold funds. Licensed partners do.
- The worker owns their record and consents to every share.
- No foreign recruitment. We only share documents with DoFE-licensed agencies, and only at the
  worker's request.

---

## 1. Segments: two views reconciled

| | Venture strategy | Reference design |
| --- | --- | --- |
| First ICP | Hotels, hospitals, security companies in **Kathmandu Valley** | Construction/MEP contractors, hotels/facilities, manufacturing/workshops, solar/energy installers, EV/automotive workshops |
| Next | Construction and factories in the **Birgunj–Hetauda** corridor | — |
| Wedge | **Manage** (hajiri + payroll + SSF) with Hire on top | **Hire** (placements) with Manage as a trial after the first placement |

`docs/MASTER_PRODUCT_SPEC.md` §2.2–2.3 proposes the same skilled-trade wedge as the reference
(electrician, HVAC, plumber, welder, maintenance, solar), plus a long segment list. It is covered
by the reference column above. Its `ForeignJobOpportunity` entity conflicts with the no-foreign-recruitment
rule and is **not** adopted.

**Recommendation: lead with the strategy's ICP, and borrow the reference's skilled trades inside it.**

1. **Why hotels, hospitals and security first.**
   - Their headcount is stable and large: 30–500 per employer.
   - They run monthly payroll with SSF obligations, and the work is attendance-heavy (shifts, 24×7).
   - They are formal: they have a PAN/VAT and can sign and pay invoices.
   - Their pain is felt every month (wage sheets in Excel, SSF filing, peski tracking, absconding
     guards), so Manage becomes a weekly habit. That habit is the go/no-go metric.
   - Construction hiring is more frequent, but it is cash-based, runs through naike, and the
     employer is often informal. That makes it harder to bill and harder to make Manage stick.
2. **Why still the reference trades.** Every hotel and hospital has an engineering/maintenance
   team: electrician, plumber, HVAC/refrigeration technician, maintenance technician, sometimes a
   welder. These are the roles they *can't* fill from their own networks. So we build skilled-trade
   supply (reference trades) and sell it to strategy-ICP employers. That's the Hire wedge inside a
   Manage account.
3. **Construction/MEP and factories** come second (Birgunj–Hetauda plus Valley MEP contractors).
   By then naike crews, daily-wage payroll and contractor views (`/app/contractors`) are proven,
   and we have verified skilled supply to offer.
4. **Solar/energy and EV workshops** come third. They are small employers, but the jobs are
   high-skill and growing. They suit the training/credential partnerships (phase 3), not the pilot.

Retail stays opportunistic.

## 2. Trades

| Priority | Trades (seeded code) | Why | Segment |
| --- | --- | --- | --- |
| A — pilot volume (Manage) | `security_guard`, `housekeeping`, `cleaner`, `cook`, `kitchen_helper`, `waiter`, `ward_attendant` | Bulk of headcount at pilot employers; high turnover, so hiring is recurring | hotels, hospitals, security |
| A — pilot skilled (Hire) | `electrician`, `plumber`, `technician` (use for maintenance), **HVAC/refrigeration technician** (add) | Hard to fill, credentials matter (NSTB), reference GTM | engineering teams of hotels and hospitals |
| B — segment 2 | `mason`, `carpenter`, `rebar_worker`, `painter`, `helper`, `welder`, `machine_operator`, `loader`, `store_keeper`, `driver`, `heavy_driver` | Construction sites, factories, warehouses | construction/MEP, factories |
| C — later | solar installer, EV technician (add when phase 3 training partners exist) | Growth trades, tied to training | energy, automotive |

Action: add `hvac_technician` and `maintenance_technician` through the taxonomy admin (in
progress: `/ops/taxonomy`; until then, Django admin → Trades). Add NSTB occupation names in
`name_ne`.

## 3. Geography and segment sequence

| Stage | Where | Who | Exit to next stage |
| --- | --- | --- | --- |
| Pilot (90 days) | Kathmandu, Lalitpur, Bhaktapur | 15 design partners: 5 hotels (Thamel, Durbar Marg, Lalitpur 3–4 star), 4 hospitals/clinics (private 50–200 beds), 4 security companies (300+ guards), 2 next-segment (1 MEP contractor, 1 factory) | Go/no-go: ≥ 10/15 use Manage weekly, ≥ 5/15 accept paid terms |
| Valley scale | Kathmandu Valley | 50 orgs, 20 paying; add MEP contractors and facility management companies | Phase-1 exit: 1,000 workers, 100 placements, median fill < 14 days |
| Corridor | Birgunj (Parsa), Simara/Bara, Hetauda (Makwanpur) industrial areas | factories (cement, steel, FMCG, plywood), logistics/warehouses, construction | 10 paying orgs in the corridor, with a local field team of 2 |
| Next cities | Pokhara (hotels), Butwal–Bhairahawa (factories, hotels), Biratnagar–Itahari (factories) | follow the existing customers' branches first | — |

## 4. Acquisition playbook

### 4.1 Employers (founder-led until 20 paying)

1. **Lists.** Build them from these sources:
   - Hotel Association Nepal (HAN) members
   - private hospitals' registrations
   - licensed security service companies
   - FNCCI/CNI district chapters
   - Birgunj and Hetauda chambers of commerce
   - Federation of Contractors' Associations of Nepal (FCAN) for contractors

   Qualify on headcount (≥ 30 blue-collar), whether they pay SSF, and whether payroll is in Excel.
2. **Opening offer.** "Free 90-day pilot: we set up your hajiri and run your next three payrolls
   with you. If it saves your HR/accounts time and you want to keep it, it's NPR 150 per worker per
   month (minimum 3,000)." Hiring is an add-on: "We fill your hard roles (electrician,
   HVAC, guards). You pay NPR 5,000 only when the person joins, with a free replacement if they
   leave within 30 days."
3. **Channels.**
   - Warm intros from investors and advisers.
   - Association events: HAN meetings, chamber events.
   - Direct visits to the HR/admin manager **and** the accountant. The accountant feels the payroll
     pain, so bring a printed sample तलब पाना and SSF file.
   - The reference's "free first requisition" can be used as a door-opener for hiring-only
     prospects (construction/MEP). Never offer free Manage beyond the pilot.
4. **Onboard** with [ops/employer-onboarding-playbook.md](ops/employer-onboarding-playbook.md). KYB first
   ([ops/employer-verification-kyb.md](ops/employer-verification-kyb.md)).
5. **Expand inside the account.** Add sites/branches, add the engineering team's hiring, and add
   contractor (thekedar) crews to the contractor view.

### 4.2 Worker supply (free for workers, always)

| Channel | How | Notes |
| --- | --- | --- |
| Employer staff imports | Every pilot employer's existing workers are onboarded via import plus a site camp | Biggest, cheapest source of verified history. Consent is collected at the camp. |
| **Naike / team leads** | Recruit naike as crew leads (`/me/crew`). They add members; we pay a referral reward (NPR 500 per placed member after 30 days, `NAIKE_REFERRAL_FEE`) **from KaamSathi, never deducted from the worker** | Key for construction, factories and security. Ops vets naike: no fees charged to members (see [fraud-escalation.md](ops/fraud-escalation.md)). |
| **Labour chowks** (Kalanki, Chabahil, Koteshwor, Balkhu, Satdobato in the Valley; bus parks and chowks in Birgunj/Hetauda) | Early-morning registration desks (06:00–09:00) with field agents | High volume, low verification. Verify ID on the spot and prioritise skilled trades. [worker-registration-camps.md](ops/worker-registration-camps.md) |
| **Training institutes** (CTEVT-affiliated schools, private technical institutes, Employment Service Centres (रोजगार सेवा केन्द्र) at municipalities) | Register graduating batches; credentials verified with the institute | Best source for electrician, plumber and HVAC. Leads into phase-3 partnerships. |
| **Returnee migrants** (returned from the Gulf and Malaysia with skills) | Partner with municipal Migrant Resource Centres and returnee groups; recognise foreign experience via work-history reference checks | Skilled, motivated, often lack local references. Phase 5 mobility documents may later help them, but **we don't recruit for abroad**. |
| Trade shops (hardware, electrical suppliers), WhatsApp/Viber/TikTok/Facebook groups | Posters with a QR to the app, plus a phone number | Cheap awareness. Expect low verification. |
| Worker referrals | Word of mouth after on-time payslips | The product loop: get paid on time → tell others |

Worker-side message: *"KaamSathi निःशुल्क हो। तपाईंको हाजिरी, तलब र अनुभव तपाईंकै नाममा सुरक्षित रहन्छ।
कसैलाई पनि पैसा नतिर्नुहोस्।"* (KaamSathi is free. Your attendance, pay and experience stay safely in
your name. Don't pay anyone.)

## 5. Pricing hypotheses (to validate in the pilot)

| Item | Hypothesis | In code |
| --- | --- | --- |
| Placement | NPR 5,000 per hire, charged on `joined`, free replacement within 30 days | `PLACEMENT_FEE`, `REPLACEMENT_WINDOW_DAYS` |
| Manage subscription | NPR 150 per active worker per BS month, minimum NPR 3,000 | `SUBSCRIPTION_PER_WORKER`, `SUBSCRIPTION_MINIMUM` (charged on BS day 1) |
| Pilot | Free for 90 days (`plan=pilot`, charges waived) | `Organization.plan` |
| Workers | Always free | rule |
| Naike reward | NPR 500 per placed member after 30 days, paid by KaamSathi | `NAIKE_REFERRAL_FEE` |
| Partners (phase 4) | Per-referral or revenue share from licensed partners, never fees to workers | not built (billing) |
| Enterprise API | Included for subscriptions above ~200 workers | — |

Questions to test:
- Is NPR 150 below the cost of one payroll clerk-day per month? It should be: 100 workers = NPR 15,000.
- Do security companies (low margin, high headcount) need a volume tier, e.g. NPR 100 above 300 workers?
- Is 5,000 per hire acceptable for a guard or housekeeper? A month's wage is about Rs. 19,550,
  so it may be too high for helpers. Consider NPR 2,500 for unskilled and 5,000 for skilled.
- Pricing is in NPR plus 13% VAT once KaamSathi is VAT-registered (tax adviser).

## 6. Pilot design (90 days, 15 design partners)

- **Who:**
  - 5 hotels, 4 hospitals/clinics, 4 security companies (Kathmandu Valley)
  - 2 next-segment learners: 1 MEP contractor, 1 factory in Hetauda or Birgunj
  - Each partner names a champion (HR/admin) and gives us access to their accountant.
- **What they get:**
  - onboarding of all workers
  - hajiri via the supervisor app and site QR
  - three payroll cycles with exports (wage sheet, bank file, SSF file)
  - compliance score
  - hiring for up to 5 hard roles, free during the pilot
- **What we ask:**
  - weekly use
  - a 30-minute feedback call every two weeks
  - permission to use anonymised metrics
  - a pricing decision in week 12
- **Success = go:**
  - ≥ **10 of 15** use Manage weekly (hajiri ≥ 4 days/week for 4 consecutive weeks plus a payroll run)
  - ≥ **5 of 15** accept paid terms in writing
- **Also measured:**
  - payroll errors found by the partner (target 0 after cycle 2)
  - time-to-shortlist (< 48 h)
  - time-to-fill (< 14 days)
  - worker app activation (≥ 40% of the partner's workers logged in once)
  - disputes resolved within SLA
- **Interview script (employers):**
  - How do you record hajiri today?
  - How long does monthly payroll take, and who does it?
  - How do you file SSF?
  - What did your last hard-to-fill role cost you in days?
  - What would make you stop using KaamSathi?
  - At what price per worker would this be an easy yes, and at what price a no?

## 7. Launch KPIs

Tracked in `/ops/kpis` (in progress) and the weekly pilot review:

| KPI | Definition | Pilot target |
| --- | --- | --- |
| Weekly active employers (Manage) | orgs with hajiri on ≥ 4 days in the week | ≥ 10/15 |
| Paid conversion | pilot partners signing paid terms | ≥ 5/15 |
| Time-to-shortlist | job published → first shortlist (`first_shortlist_at`) | median < 48 h |
| Time-to-fill | job published → joined | median < 14 days |
| Fill rate | joined ÷ openings, jobs closed in period | ≥ 60% |
| Cost per verified worker | field + ops cost ÷ newly verified workers | track; aim < NPR 300 |
| Employer acquisition cost | sales + onboarding cost ÷ new paying orgs | track |
| Placement revenue | Σ placement charges (not waived) | track |
| Repeat employer rate | orgs with ≥ 2 jobs in 90 days | ≥ 50% |
| Worker activation | workers who logged into the app ÷ workers onboarded | ≥ 40% |
| Payroll on-time | runs marked paid by BS day 7 | ≥ 80% |
| Dispute rate | disputes ÷ active employments per month | < 3% |
| Employer satisfaction | 0–10 "would you recommend" from the champion, every two weeks | ≥ 8 average |
| 90-day retention of placed workers | placements still active at 90 days | ≥ 70% |
