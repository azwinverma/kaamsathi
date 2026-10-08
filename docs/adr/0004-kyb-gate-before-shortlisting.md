# ADR 0004: KYB gate before shortlisting

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

Fake or unregistered employers are the main way workers get exploited (unpaid wages, foreign
recruitment scams). Workers' data is shared with an employer when they are shortlisted.

## Decision

Organizations go through KYB (registration certificate, PAN, documents; `POST /org/verification`,
ops decision at `/ops/employers`). With `KYB_REQUIRED_FOR_SHORTLIST=True` (default) ops cannot
shortlist workers for an unverified employer (400 `invalid_state`), and jobs from unverified
employers are not recommended to workers. Worker-facing payloads expose `employer_verified`.

## Consequences

+ Worker data reaches only verified businesses; badge builds trust for workers.
− Slower activation for new employers (they can post jobs and use hajiri/payroll meanwhile).
− Ops must keep KYB SLA short (SOP in docs/ops/).
