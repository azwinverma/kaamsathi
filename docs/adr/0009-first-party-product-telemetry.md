# ADR 0009: First-party product telemetry

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

We need registration/onboarding/hiring funnels and retention (spec §20 ANALYTICS-01). Third-party
analytics SDKs would send worker and employer behaviour (and often device identifiers) abroad,
conflict with our privacy promises and Nepal's Privacy Act 2075, and add a vendor.

## Decision

`apps.telemetry`: our own `Event` table. Server events are recorded with
`apps.telemetry.track(name, ...)` (wired via model signals in one file); clients batch events
(≤ 50) to `POST /telemetry/events` (auth optional, throttled). Property keys are allow-listed and
PII-looking values (phone numbers, emails) rejected; clients may not send server-only events.
Ops sees funnels and weekly retention with k-anonymity 5; raw events are purged after 400 days.

## Consequences

+ No PII leaves our infrastructure; analytics joins cleanly with domain data; no vendor cost.
− We build our own dashboards; Python-side aggregation is fine at pilot scale but will need SQL
rollups or a warehouse past a few million events.
