# ADR 0001: Django modular monolith

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

KaamSathi needs hiring, attendance, BS-month payroll, an ops console, worker self-service and a growing
partner ecosystem, built by a very small team, deployed on one or two servers in or near Nepal.

## Decision

One Django 5 + DRF project (`backend/`) split into apps with clear ownership (`accounts`, `orgs`,
`workers`, `hiring`, `workforce`, `payroll`, `billing`, `trust`, `partners`, `telemetry`, …), one
PostgreSQL database, Redis + Celery for background work. Each app owns its models, services, urls
and tests; cross-app calls go through `services.py` functions (often lazily imported) rather than
reaching into another app's views. Web (Next.js BFF) and mobile (Flutter) are separate clients of
the same `/api/v1`.

## Consequences

+ One deploy unit, one transaction boundary (payroll + attendance + billing stay consistent), cheap
to operate, easy local setup (`make up`).
+ Apps can be extracted later along existing seams (e.g. partner API, telemetry) if load demands it.
− Discipline needed to keep app boundaries (shared-file edits such as `config/api_urls.py` are kept
to one `include()` line per app).
− A bad migration or hot path affects everything — mitigated by CI migration checks and the
backward-compatible migration rule (RUNBOOK §4).
