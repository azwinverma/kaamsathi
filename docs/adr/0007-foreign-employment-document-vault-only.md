# ADR 0007: Foreign employment: document vault + licensed-agency sharing only

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

Foreign employment is the largest labour flow out of Nepal and the biggest source of worker abuse.
Matching workers to jobs abroad would make KaamSathi a recruitment agency under the Foreign
Employment Act 2064.

## Decision

The `mobility` app only lets a worker store and get verified their passport, labour permit,
medical, police clearance and training documents, and share them — on the worker's request, for
≤ 90 days, revocably — with a DoFE-licensed recruitment agency whose licence ops has verified.
We never publish, match or advertise jobs abroad. Publishing foreign opportunities is deferred
until a legal opinion confirms a compliant model.

## Consequences

+ Useful to workers (verified, shareable documents; safety guidance) without recruitment liability.
− No revenue from foreign placements; agencies must be onboarded and their licences tracked
(`license_valid_until`, compliance status).
