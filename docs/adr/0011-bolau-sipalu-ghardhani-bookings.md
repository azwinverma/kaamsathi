# ADR 0011: Bolau — Sipalu self-profiles and Ghardhani bookings

- Status: accepted
- Date: 2026-10-08
- Supersedes (for this module only): the "consumer household services marketplace" non-goal in
  MASTER_PRODUCT_SPEC §32 and the venture strategy's year-one exclusions.

## Context

The founder decided that skilled people should be able to create their own complete profile and be
booked directly by households and individuals, not only hired by B2B employers through ops.

## Decision

- Workers are called **Sipalu (सिपालु)**, people who book them **Ghardhani (घरधनी)**, the booking
  service **Bolau (बोलाउ)**. Employer/ops screens keep "workers/कामदार" for employees.
- Two ways to book: a specific Sipalu from their public profile, or a **Kaam request** that
  collects up to three offers.
- Money: the Ghardhani pays the Sipalu directly; KaamSathi charges the **Ghardhani** a small booking
  fee through a payment-gateway adapter. Sipalu never pay; KaamSathi never holds Sipalu money.
- Only identity-verified Sipalu are bookable; hourly rates may not go below the hourly minimum wage.
- Everything ships behind the `bolau` feature flag (off by default) so the B2B pilot is unaffected.

## Consequences

+ Workers get a second income channel and a reason to keep their Passport complete.
+ Reuses verification, Passport, trust, disputes, notifications, risk and payments plumbing.
− New risks: home-visit safety, off-platform payment solicitation, fake reviews, consumer-protection
  duties — mitigated by arrival codes, masked contacts, two-way moderated ratings, risk detectors and
  the confidential safety channel; legal review of intermediary status (Consumer Protection Act 2075)
  added to the production checklist.
− Ops load grows (no-shows, disputes); KPIs and an ops queue are part of the module.
