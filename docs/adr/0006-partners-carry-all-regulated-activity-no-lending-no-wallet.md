# ADR 0006: Partners carry all regulated activity — no lending, no wallet

- Status: accepted
- Date: 2026-10-07 (recorded 2026-10-08; decision taken earlier in the build)

## Context

Workers need loans, earned-wage access, insurance and payouts. Doing these ourselves would need NRB /
Insurance Authority licences and would mean holding customer funds.

## Decision

KaamSathi never lends, never holds funds and never acts as a wallet. Licensed partners (banks,
MFIs, insurers, wallets) carry the activity; we store offers, consented referrals and statuses only.
Payroll money moves employer → provider → worker. Partner access to worker data requires an
explicit, revocable, purpose-bound `ConsentGrant`, every read is logged and visible to the worker.
Partner revenue (referral fees, training commissions) is invoiced to the partner — never to workers.

## Consequences

+ No financial licence needed; regulatory risk sits with licensed entities.
− Revenue from financial services is limited to referral fees; product depends on partner APIs,
so every integration ships as an adapter with a manual/file fallback.
