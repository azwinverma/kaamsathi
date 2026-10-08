# CLAUDE — START HERE

You are implementing a production-grade Nepal Workforce OS.

Read in this order:
1. `MASTER_PRODUCT_SPEC.md`
2. `DETAILED_TASK_CHECKLIST.md`
3. `BRAND_GUIDELINES.md`

## Your first objective
Build Phase 0 + Phase 1A + Phase 1B before moving to recruitment.

### Deliverable 1 — Architecture confirmation
Before coding, output:
- Repository structure
- Module structure
- Environment strategy
- Database plan
- Authentication strategy
- RBAC matrix
- File storage strategy
- Logging/monitoring strategy
- Testing strategy

### Deliverable 2 — Backend foundation
Implement:
- Django + DRF
- PostgreSQL
- Redis
- Celery
- Docker
- OpenAPI
- health/readiness endpoints
- structured logging
- request IDs
- standard errors
- CI tests

### Deliverable 3 — Auth & RBAC
Implement:
- phone OTP
- JWT access/refresh rotation
- device sessions
- admin MFA
- platform and organization roles
- object-level permission tests

### Deliverable 4 — Worker Passport
Implement:
- worker onboarding
- worker profile
- skills
- documents
- credentials
- experience
- availability
- verification states
- QR/public profile
- admin verification queues

## Coding rules
- No business logic directly in serializers/views if it belongs in domain services.
- Use transactions for multi-record state transitions.
- Add indexes for search/filter columns.
- Every state transition must validate allowed previous states.
- Every sensitive mutation must create an audit event.
- Every organization-owned object must enforce organization scope server-side.
- Every endpoint must have tests for unauthorized and cross-organization access.
- No secrets committed.
- No public object-storage buckets for worker identity documents.
- Prefer UUIDs for public API identifiers.
- Add database constraints, not only application validation.
- Add idempotency for critical create/submit endpoints.

## Definition of done for each task
1. Data model/migration complete.
2. API implemented.
3. Permission rules implemented.
4. Validation complete.
5. Audit event added if needed.
6. Unit/integration tests passing.
7. OpenAPI updated.
8. UI states added if task includes UI.
9. Error/empty/loading states handled.
10. Documentation/task checklist updated.

## Never do these without explicit approval
- Add lending/credit underwriting.
- Add crypto/blockchain.
- Replace modular monolith with microservices.
- Publish sensitive worker data.
- Build government integration assumptions without a confirmed API.
- Build foreign-employment bypass workflows.
- Mark legal/compliance logic final without Nepal legal/accounting review.

## Development sequence
1. Foundation
2. Auth
3. RBAC
4. Worker Passport
5. Verification
6. Employer organizations
7. Recruitment
8. Matching
9. Placement
10. Reviews/disputes
11. Workforce management
12. Attendance/timesheets
13. Payroll
14. Training
15. Billing
16. Partners/finance referrals
17. Foreign-employment passport
18. Advanced analytics

## Output expectations during implementation
At the end of every coding session, return:
- completed task IDs
- modified files
- migrations created
- tests added/passed
- known issues
- next recommended task IDs
