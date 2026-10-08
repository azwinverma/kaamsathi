# ADR 0003: No public job board in phase 1 — ops-curated matching + worker interest

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

Open job boards in Nepal attract fake postings, agent fees charged to workers and spam
applications; employers in our pilot want a short, verified list, not hundreds of applicants.

## Decision

Phase 1 has no public job listing or open "apply". KaamSathi ops shortlist verified workers per job
(`/ops/jobs/{id}/matches` → shortlist). Workers can see *recommended* jobs from verified employers
that match their trades/districts and say "I'm interested" (`POST /me/jobs/{id}/interest`); that
creates a `sourced` application visible only to ops until ops shortlists it. Employers never see
unvetted applicants.

## Consequences

+ Quality and trust from day one; workers never pay; time-to-shortlist is an ops KPI we control.
− Ops effort scales with jobs; mitigated by matching v2 scores and worker interest signals.
− A public board can be added later behind KYB + moderation once fraud tooling (risk app) matures.
