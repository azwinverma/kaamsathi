# ADR 0002: Page-number pagination over cursor pagination

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

List endpoints must be easy for three clients (web tables with page numbers, Flutter lists, partner
integrations). Data volumes per organization are modest (hundreds to low thousands of rows).

## Decision

All list endpoints use `?page=&page_size=` (max 100) returning `{count, next, previous, results}`
(`apps.core.pagination.StandardPagination`). Cursor pagination is not used, even where the
reference architecture suggested it (docs/CONTRACT-EXTENSIONS.md keeps this deliberately).

## Consequences

+ Every existing client already handles it; totals (`count`) power "1–25 of 312" UI.
− `COUNT(*)` and deep `OFFSET`s get slower on very large tables and pages can shift while new rows
arrive. Revisit for append-heavy feeds (audit log, telemetry, notifications) if they exceed ~1M rows
per scope — those can switch to cursor pagination individually without breaking the convention
elsewhere.
