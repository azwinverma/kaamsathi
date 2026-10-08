# ADR 0005: Field-level encryption with blind indexes

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

We store citizenship/NID numbers, bank account numbers, PANs and reference phone numbers. A database
dump or backup leak must not expose them, but we still need exact-match lookups (duplicate
identity detection, PAN lookup).

## Decision

`apps/core/crypto.py`: `EncryptedCharField` (Fernet/MultiFernet with key rotation via
`FIELD_ENCRYPTION_KEYS`, `manage.py rotate_field_keys`) for the value, plus a keyed HMAC
`blind_index(value, purpose)` (`FIELD_HASH_KEY`) stored in a separate `*_hash` column for equality
search. `mask()` for display. Production refuses to start without keys (`FIELD_KEYS_REQUIRED`).

## Consequences

+ Leaked dumps/backups don't reveal identifiers; duplicate detection still works.
− No partial/LIKE search on encrypted fields; ordering by them is meaningless.
− Losing the keys loses the data — keys are backed up separately (RUNBOOK §6).
