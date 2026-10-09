# E2E + accessibility tests (Playwright + axe)

Specs: `employer.spec.ts` (login → dashboard → job with min-wage guard → pipeline → hajiri → payroll),
`ops.spec.ts` (verification queue → verify → credentials → employers KYB), `passport.spec.ts`
(public passport + 404), `a11y.spec.ts` (axe WCAG 2 A/AA on landing, login, dashboard, passport;
fails on serious/critical only), and Bolau (skipped while the `bolau` flag is off):
`bolau-join.spec.ts` (Sipalu onboarding wizard as a fresh random 98000009xx phone),
`bolau.spec.ts` (search → profile → book as Ghardhani 9800000020 → /ghar detail: arrival code,
free-cancel window, cancel; read-only demo dispute; axe), `ops-bolau.spec.ts` (KPIs, suspend +
lift an E2E-made Sipalu with a reason, audit rows; axe). They run serially against seeded demo
data and clean up after themselves: the booking is cancelled (descriptions start with "E2E:") and
the suspension lifted, even when a step fails.

Run locally:

```bash
make db                                   # Postgres :5433 + Redis :6380
cd backend && .venv/bin/python manage.py migrate && .venv/bin/python manage.py seed_demo   # or: make seed
DJANGO_DEBUG=true OTP_DEV_CODE=123456 .venv/bin/python manage.py runserver 8000
# another shell
cd web && API_BASE_URL=http://localhost:8000/api/v1 COOKIE_SECURE=false pnpm dev
# another shell
cd web && pnpm e2e:install && pnpm e2e            # BASE_URL=http://localhost:3010 pnpm e2e to override
```

Or the whole stack in Docker: `make up && make seed`, then `pnpm e2e`. The OTP rate limit is
5 codes per phone per hour — rerunning many times in a row may need `seed_demo` or a Redis flush.
CI runs the same suite in the `e2e` job of `.github/workflows/ci.yml` (report uploaded as an artifact).
