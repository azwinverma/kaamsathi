# Contributing to KaamSathi

This covers how we branch, commit, review and release. Setup is in the [README](README.md); the
API and data model live in [docs/CONTRACT.md](docs/CONTRACT.md) and its companion contracts.

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Always deployable. Every merge deploys to **staging** (see `docs/RUNBOOK.md` §13). |
| `feat/<area>-<short-name>` | New behaviour, e.g. `feat/payroll-pay-groups` |
| `fix/<area>-<short-name>` | Bug fixes, e.g. `fix/hajiri-offline-dupes` |
| `chore/…`, `docs/…`, `refactor/…` | Tooling, documentation, internal changes |
| `hotfix/<version>` | Urgent fix cut from the last release tag, merged back into `main` |

- Branch from `main`, keep branches short-lived (days, not weeks), rebase on `main` before review.
- `<area>` is the Django app or product area: `payroll`, `hiring`, `workforce`, `ops`, `mobile`, `web`, …
- Never push directly to `main`; every change goes through a pull request.

## Commit messages — Conventional Commits

```
<type>(<scope>): <summary in the imperative, ≤ 72 chars>

<why, not what — wrap at 100>

BREAKING CHANGE: <what clients must change>   (only when it applies)
```

- **type**: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.
- **scope**: the app or area (`payroll`, `accounts`, `web`, `mobile`, `deploy`, …).
- Examples: `feat(payroll): pay groups with one run per group per BS month` ·
  `fix(accounts): server-side OTP resend cooldown` · `docs(runbook): restore drill`.
- A change to an API response shape that clients depend on is a `BREAKING CHANGE` footer and needs
  a contract update in the same PR.
- `CHANGELOG.md` is updated from these messages at release time.

## Pre-commit hooks

```bash
pipx install pre-commit        # or: pip install pre-commit
pre-commit install             # once per clone
pre-commit run --all-files     # optional: check everything now
```

Hooks (`.pre-commit-config.yaml`): ruff + ruff-format (backend), prettier (web), web message
bundle check, `makemigrations --check` when a `models.py` changes, gitleaks (secrets),
whitespace/EOF/YAML/JSON checks, and `dart format` for `mobile/` when Flutter is installed.
CI runs the full linters and test suites regardless.

## Pull request checklist

Copy into the PR description and tick what applies:

- [ ] **Contract** — endpoint/field changes are documented in `docs/CONTRACT*.md` (request and
      response shapes, error codes) so web and mobile can follow.
- [ ] **Migrations** — generated with `makemigrations <app>` for the app that owns the model only,
      reviewed by hand, reversible where possible, no data loss; `makemigrations --check` is clean.
- [ ] **Tests** — new behaviour has tests (payroll maths: hand-computed expectations in the test);
      `pytest`, `pnpm test`, `flutter test` pass locally.
- [ ] **Permissions** — org endpoints use `OrgScopedMixin` role rules; ops endpoints are covered by
      `apps/accounts/staff_roles.py` `ROUTE_ROLES`; IDOR test (`tests/test_security_idor.py`) still passes.
- [ ] **Audit** — create/update/delete of org data and every ops action writes an `AuditLog` row.
- [ ] **Translations** — every user-facing string exists in English and Nepali: web
      `web/messages/src/<area>.{en,ne}.json` (run `node scripts/merge-messages.mjs`), backend
      `gettext`/`pgettext` + `backend/locale/ne/LC_MESSAGES/django.po` (`compilemessages -l ne`),
      mobile ARB files.
- [ ] **Privacy** — no PII in logs, telemetry properties or error messages; identifiers stay encrypted.
- [ ] **Docs** — runbook/SOP updated for anything ops staff must do differently; new env settings
      added to `deploy/.env.prod.example` with a comment.
- [ ] **Screenshots** for UI changes (English and Nepali, phone width for mobile/web).

Reviews: one approval minimum; payroll, auth, permissions and migrations need a second reviewer.
Squash-merge with a Conventional Commit title.

## Releases

- Versions follow [SemVer](https://semver.org): `vMAJOR.MINOR.PATCH`.
- Tag from `main` once staging is verified: `git tag -a v1.4.0 -m "v1.4.0" && git push origin v1.4.0`.
  A `v*` tag deploys to **production** (`docs/RUNBOOK.md` §13).
- Before tagging: move the `Unreleased` section of `CHANGELOG.md` under the new version and date,
  and note required env changes and migrations.
- Hotfix: branch `hotfix/v1.4.1` from the `v1.4.0` tag, fix, tag `v1.4.1`, merge back into `main`.
- Payroll rule changes (minimum wage, tax slabs, SSF rates) ship as data with a release note that
  names the effective date.

## Feature flags

Runtime switches live in **Ops → Feature flags** (`/ops/flags`, superadmin; `apps/core/flags.py`).
With no flag row the matching settings value applies (`KYB_REQUIRED_FOR_SHORTLIST`,
`IRD_CBMS_ENABLED`, `TELEMETRY_ENABLED`, `PAYOUT_PROVIDERS`, `KYC_FOUR_EYES`). Use
`flags.is_enabled("key", organization=org)` in backend code; mark a flag `client_visible` to expose
it to web/mobile through `GET /api/v1/flags`. Remove a flag (code and row) once it is fully rolled out.

## Local S3 with MinIO

Media is stored on the local filesystem by default. To exercise the S3 path (presigned URLs,
private bucket) locally:

```bash
docker compose --profile s3 up -d minio minio-init   # API :9000, console :9001
```

Then add to `.env` (or `backend/.env`) and restart the backend:

```
AWS_STORAGE_BUCKET_NAME=kaamsathi-media
AWS_PRIVATE_BUCKET_NAME=kaamsathi-private
AWS_S3_ENDPOINT_URL=http://localhost:9000        # http://minio:9000 when the backend runs in Docker
AWS_ACCESS_KEY_ID=kaamsathi
AWS_SECRET_ACCESS_KEY=kaamsathi-secret
AWS_S3_REGION_NAME=us-east-1
```

The console at <http://localhost:9001> (`kaamsathi` / `kaamsathi-secret`) shows uploaded objects.
Presigned URLs embed the endpoint host, so when the backend runs inside Docker the browser cannot
open `http://minio:9000/...` links — run the backend locally, or add `127.0.0.1 minio` to
`/etc/hosts`. Unset `AWS_STORAGE_BUCKET_NAME` to go back to filesystem storage.
