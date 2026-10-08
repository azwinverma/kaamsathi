# ADR 0010: Bikram Sambat for display, AD for storage

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

Nepal runs on the Bikram Sambat calendar: wages are monthly by BS month, fiscal years start on
Shrawan 1, holidays are BS dates. Libraries, databases and partners work in AD (Gregorian).

## Decision

All dates are stored and sent as AD ISO dates; every date field `x` in API responses has an
`x_bs` twin, and UIs show BS first with AD secondary. BS-native concepts are stored as
`(bs_year, bs_month)` integers (payroll runs, subscription charges, invoice periods). Conversion
lives in `apps/core/bs.py` (backend) and `lib/format.ts` (web). Fiscal years ("2083/84") are
derived from BS dates — e.g. invoice numbers restart every Shrawan 1.

## Consequences

+ Correct sorting/arithmetic in AD; correct business periods in BS; one conversion layer each side.
− The BS calendar table must be kept current each year (RUNBOOK §9); every new date field needs
its `_bs` twin in serializers.
