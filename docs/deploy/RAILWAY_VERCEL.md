# Deploy: web on Vercel, backend on Railway

The managed-hosting path. The self-hosted alternative (one VPS, `deploy/docker-compose.prod.yml`)
stays in [RUNBOOK §1](../RUNBOOK.md#1-first-deploy). Both use the same images and settings.

```
browser ──▶ Vercel (web/, Next.js, region sin1)
               │  BFF calls  https://<api>.up.railway.app/api/v1   (+ user IP, BFF_PROXY_SECRET)
mobile app ────┼──────────────────────────────▶ Railway · api     (gunicorn, Singapore)
               │                                 Railway · worker  (celery worker)
               │                                 Railway · beat    (celery beat, exactly 1)
               │                                 Railway · postgres 16 · redis · bucket "media"
```

Railway is defined as code in [`.railway/railway.ts`](../../.railway/railway.ts) (Railway
Infrastructure as Code, **beta**). Vercel needs only the dashboard plus [`web/vercel.json`](../../web/vercel.json).

**Secrets rule:** paste secrets into the Railway/Vercel dashboards yourself. Never commit them,
never paste them into chat or issues.

## 0. Before you start

- Vercel **Pro** for production (Hobby is non-commercial only; it is fine for a private preview).
- Railway **Hobby** or **Pro** plan; the backend needs ~1.5 GB RAM across api + worker + beat.
- Generate secrets locally (one per line, keep them in your password manager):

  ```bash
  openssl rand -hex 32   # DJANGO_SECRET_KEY
  openssl rand -hex 32   # JWT_SIGNING_KEY
  openssl rand -hex 32   # FIELD_HASH_KEY
  openssl rand -hex 32   # BFF_PROXY_SECRET
  python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEYS
  ```

  **Back up `FIELD_ENCRYPTION_KEYS` and `FIELD_HASH_KEY` before the first deploy.** Losing them makes
  every encrypted citizenship/NID/PAN/bank number unrecoverable.

## 1. Railway: backend

1. railway.com → New Project → **Empty project**, name it `kaamsathi`. Install the GitHub app for
   `azwinverma/kaamsathi` when asked (Railway deploys from `main`).
2. Project → Settings → **Shared Variables** (environment `production`), add:

   | Name | Value |
   | --- | --- |
   | `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY`, `FIELD_ENCRYPTION_KEYS`, `FIELD_HASH_KEY`, `BFF_PROXY_SECRET` | from step 0 |
   | `PUBLIC_WEB_URL` | `https://kaamsathi.vercel.app` for now (your Vercel URL; later `https://kaamsathi.com`) |
   | `SMS_BACKEND` | `console` until the Sparrow sender ID is approved, then `sparrow` |

3. Apply the infrastructure (Railway CLI ≥ 5.42.1, Node ≥ 22):

   ```bash
   npm i -g @railway/cli        # or: brew install railway
   railway login
   railway link                  # choose kaamsathi / production
   cd .railway && npm install && cd ..
   railway config plan           # read it: 6 resources, no deletions
   railway config apply
   ```

   This creates `postgres` (16), `redis`, the private bucket `media`, and three services built from
   `backend/Dockerfile`: `api` (runs `migrate` + `seed_reference` before each deploy, health check
   `/api/v1/readiness`), `worker` and `beat`. Only changes under `backend/` redeploy them.

   *If the CLI rejects the file* (IaC is beta): create the same pieces in the dashboard. Add Postgres,
   Redis and a Bucket. Add three services from the GitHub repo with root directory `backend`. Set the
   start commands, pre-deploy command, health check and variables exactly as in `.railway/railway.ts`.

4. `api` → Settings → Networking → **Generate Domain** (target port: the one gunicorn logs,
   normally `8080`). Note the URL, e.g. `https://kaamsathi-api.up.railway.app`.
5. Wait for all three deploys to go green, then check:

   ```bash
   curl https://<api-domain>/api/v1/readiness      # {"status":"ok","database":"ok","cache":"ok",…}
   ```

6. Optional keys, when you have them, go in each backend service's **Variables** tab (api, worker,
   beat): `SPARROW_SMS_TOKEN`, `SENTRY_DSN`, `EMAIL_HOST*`, `FCM_*`, `METRICS_TOKEN`,
   `PAYOUT_WEBHOOK_SECRETS`, `BOLAU_WEBHOOK_SECRETS`, `BILLING_SELLER_PAN`. They are marked
   `preserve()` in the file, so `railway config apply` never overwrites them.
7. First ops admin: `railway ssh --service api`, then follow [RUNBOOK §11](../RUNBOOK.md#11-security--platform-operations-docscontract-extensionsmd-1)
   (create the user, `StaffProfile` with `superadmin`, enrol TOTP). **Never** run `seed_demo` here.

## 2. Vercel: web

1. vercel.com → Add New → Project → import `azwinverma/kaamsathi` → **Import single project**
   for `web` (not the multi-service option). Root Directory: `web`. Framework: Next.js (auto).
   pnpm and Node 22 are picked up from `package.json`.
2. Environment Variables (Production, and Preview if you want previews to work):

   | Name | Value |
   | --- | --- |
   | `API_BASE_URL` | `https://<api-domain>/api/v1` |
   | `NEXT_PUBLIC_SITE_URL` | `https://kaamsathi.vercel.app` (later your domain) |
   | `BFF_PROXY_SECRET` | the same value as on Railway |
   | `COOKIE_SECURE` | `true` |

3. Deploy. `web/vercel.json` pins functions to `sin1` (Singapore, next to the API) and skips builds
   when a commit does not touch `web/`.
4. Back on Railway, set the shared variable `PUBLIC_WEB_URL` to the final Vercel URL if it differs.

## 3. Smoke test (same as RUNBOOK §1.6)

1. Open the site, request an OTP. With `SMS_BACKEND=console`, the code is in the Railway **api**
   logs. With `sparrow`, it arrives by SMS.
2. Sign in, open `/app` and `/ops` (staff + TOTP), and upload a worker ID photo. It must open only
   through the app's signed link. A direct bucket URL must be denied.
3. Your active sessions (account security settings) and `/ops/audit` must show **your** IP, not a
   Vercel address. That proves `BFF_PROXY_SECRET` matches on both sides.
4. Bolau stays off until you switch the `bolau` flag on in `/ops/flags`.

## 4. Custom domains (when ready)

- Vercel: add `kaamsathi.com` + `www`. Then update `NEXT_PUBLIC_SITE_URL` and Railway's `PUBLIC_WEB_URL`.
- Railway `api`: add `api.kaamsathi.com`. Then add it to `DJANGO_ALLOWED_HOSTS` and
  `CSRF_TRUSTED_ORIGINS` in `.railway/railway.ts`, apply, and set Vercel's `API_BASE_URL` to
  `https://api.kaamsathi.com/api/v1`.
- Mobile release builds: `flutter build … --dart-define=API_BASE_URL=https://api.kaamsathi.com/api/v1`.

## 5. Day-2 notes

- **Deploys:** pushing to `main` redeploys whatever changed (Railway watches `backend/**`, Vercel
  watches `web/**`). The SSH jobs in `.github/workflows/deploy.yml` stay skipped while no SSH
  secrets are set.
- **Migrations** run in the api pre-deploy step. A failing migration stops the deploy and the old
  version keeps serving. Write backwards-compatible migrations (RUNBOOK §4), because worker/beat
  may briefly run old code against the new schema.
- **Rollback:** Railway → service → Deployments → previous → *Redeploy*. Vercel → Deployments →
  *Promote to Production*. Database migrations are not rolled back automatically (RUNBOOK §3).
- **Backups:** enable Railway volume backups on `postgres` (daily). Also keep an off-site encrypted
  `pg_dump` (RUNBOOK §5), because the database contains ID numbers.
- **Not on Railway:** ClamAV (`CLAMAV_REQUIRED=false`; uploads are still type/size/magic-byte
  validated). The `deploy/backup` and `deploy/monitoring` containers are VPS-only.
- **Scaling:** raise `api` replicas freely. Keep `beat` at exactly 1. Add `worker` replicas for
  queue backlog.
