# Deploy for free: Vercel + Neon + Upstash

The $0 path for demos and a free pilot. Everything runs on free tiers:

| Piece | Service (free tier) | What it holds |
| --- | --- | --- |
| Web (`web/`) | Vercel Hobby, project **kaamsathi** | website, employer app, ops console |
| API (`backend/`) | Vercel Hobby, project **kaamsathi-api** | Django as one serverless function (Singapore) |
| Postgres | Neon Free | the database |
| Redis | Upstash Free | cache, OTP limits, rate limits |
| Files | stored in Neon (`MEDIA_STORAGE=database`); optional: Cloudflare R2 | ID photos, documents, payslips (private) |
| Timer | cron-job.org (every 5 min) + GitHub Actions (backup) | the scheduled jobs |

How it differs from the server setups: there is no Celery worker or beat. With `SERVERLESS=true`:
- Background tasks such as sending SMS run inside the request, right after it saves. If one
  fails, it is logged in `/ops/system/failed-tasks`; the user's request still succeeds.
- Reminders scheduled for later (interview reminders) are stored in the database.
- An external timer calls `POST /api/v1/internal/cron`, which runs whatever is due
  (`backend/apps/core/cron.py`). The job list is the same `CELERY_BEAT_SCHEDULE` used everywhere else.

**Limits to know**
- Vercel Hobby is for **non-commercial use**. Before you charge anyone (Bolau fee,
  subscriptions), move to Vercel Pro or to Railway ([RAILWAY_VERCEL.md](RAILWAY_VERCEL.md)).
- Jobs run when the timer fires (every 5 min), not to the second.
- There is no virus scanner. Uploads are still checked for type, size and file signature.
- Upstash Free allows 500K Redis commands/month, enough for roughly 100K API requests.
- Neon Free sleeps when idle; the first request after a quiet spell is ~1 s slower.
- Uploads live in the database (Vercel has no writable disk), so they count toward Neon's free
  storage (a few thousand phone photos). Vercel also rejects uploads over 4.5 MB per request; the
  mobile app shrinks photos to ~0.5 MB, but very large PDFs from the web will fail.

**Secrets rule:** you paste every secret into the provider dashboards yourself. Never commit them
or send them in chat.

---

## 0. Generate secrets (your machine)

```bash
openssl rand -hex 32   # DJANGO_SECRET_KEY
openssl rand -hex 32   # JWT_SIGNING_KEY
openssl rand -hex 32   # FIELD_HASH_KEY
openssl rand -hex 32   # BFF_PROXY_SECRET   (same value in both Vercel projects)
openssl rand -hex 32   # CRON_SECRET        (Vercel API project + cron-job.org + GitHub)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEYS
```

Save them in a password manager. **Back up `FIELD_ENCRYPTION_KEYS` and `FIELD_HASH_KEY`
first**: losing them makes every stored citizenship/NID/PAN/bank number unrecoverable.

## 1. Neon (Postgres)

1. neon.tech → sign up → **New project** `kaamsathi`, Postgres **16**, region
   **AWS Asia Pacific (Singapore)**.
2. Dashboard → **Connect** → turn **Connection pooling ON** → copy the connection string. The host
   contains `-pooler`, and the string ends with `?sslmode=require`. This is `DATABASE_URL`.

## 2. Upstash (Redis)

1. upstash.com → **Create database** `kaamsathi`, type Regional, region **ap-southeast-1
   (Singapore)**, TLS on.
2. Copy the **Redis URL** that starts with `rediss://` (two s). This is `REDIS_URL`.

## 3. Files (nothing to set up)

Uploads are stored in the Neon database (`MEDIA_STORAGE=database`, `backend/apps/core/db_storage.py`),
with the same signed, expiring links as every other storage option. Only if you outgrow Neon's free
storage: create a private Cloudflare R2 bucket and set `AWS_STORAGE_BUCKET_NAME`,
`AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME=auto`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
and `FILES_S3_REDIRECT=true`. They take priority over `MEDIA_STORAGE`. Existing files must then
be copied across.

On a VPS later (RUNBOOK §1), leave `MEDIA_STORAGE` unset: uploads go to the server's disk and into the
nightly encrypted backup.

## 4. Vercel: API project (`kaamsathi-api`)

1. vercel.com → Add New → Project → import `azwinverma/kaamsathi` → **Import single project**.
   Set **Root Directory: `backend`**. The framework shows as Django. Name it `kaamsathi-api`.
2. Before the first deploy, add these Environment Variables, ticking **Production only**.
   Preview builds never run migrations (see `backend/scripts/vercel_build.py`).

   | Name | Value |
   | --- | --- |
   | `DJANGO_SETTINGS_MODULE` | `config.settings.prod` |
   | `SERVERLESS` | `true` |
   | `DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY`, `FIELD_ENCRYPTION_KEYS`, `FIELD_HASH_KEY` | from step 0 |
   | `BFF_PROXY_SECRET`, `CRON_SECRET` | from step 0 |
   | `DJANGO_ALLOWED_HOSTS` | `kaamsathi-api.vercel.app` (the domain Vercel shows for this project) |
   | `CSRF_TRUSTED_ORIGINS` | `https://kaamsathi-api.vercel.app` |
   | `API_PUBLIC_URL` | `https://kaamsathi-api.vercel.app` |
   | `PUBLIC_WEB_URL` | `https://kaamsathi.vercel.app` (the web project's domain, step 5) |
   | `DJANGO_ADMIN_URL` | a private path, e.g. `ks-admin-7f3a/` |
   | `DATABASE_URL` | Neon pooled string (step 1) |
   | `DB_CONN_MAX_AGE` | `0` |
   | `DB_DISABLE_SERVER_SIDE_CURSORS` | `true` |
   | `REDIS_URL` | Upstash `rediss://…` (step 2) |
   | `MEDIA_STORAGE` | `database` |
   | `NUM_PROXIES` | `1` |
   | `SMS_BACKEND` | `console` (OTP codes appear in Vercel → Logs) until Sparrow is approved |
   | `OTP_SHOW_CODE` | `true` **only while testing with demo data**: shows the login code on screen. Remove before real users sign up. |

3. Deploy. The build runs `check --deploy`, `migrate` and `seed_reference` against Neon, then
   collects static files to Vercel's CDN. Function settings are in `backend/vercel.json`: Singapore,
   up to 300 s per request, and a daily Vercel Cron as a last-resort timer.
4. Check: open `https://kaamsathi-api.vercel.app/api/v1/readiness`. It should show
   `{"status":"ok","database":"ok","cache":"ok"}`.

If `kaamsathi-api.vercel.app` is taken, Vercel gives another name. Use that name everywhere
above, then **Redeploy**.

## 5. Vercel: web project (`kaamsathi`)

1. Import the same repo again → **Import single project** → **Root Directory: `web`**, name
   `kaamsathi`.
2. Environment Variables (Production):

   | Name | Value |
   | --- | --- |
   | `API_BASE_URL` | `https://kaamsathi-api.vercel.app/api/v1` |
   | `NEXT_PUBLIC_SITE_URL` | `https://kaamsathi.vercel.app` |
   | `BFF_PROXY_SECRET` | same as the API project |
   | `COOKIE_SECURE` | `true` |

3. Deploy. If the web domain differs from `kaamsathi.vercel.app`, update `PUBLIC_WEB_URL` in the
   API project and redeploy it.

## 6. Timer for scheduled jobs

**Primary: cron-job.org (free, every 5 min)**
1. cron-job.org → sign up → **Create cronjob**.
2. URL: `https://kaamsathi-api.vercel.app/api/v1/internal/cron`. Schedule: every 5 minutes.
3. Advanced → Request method **POST**. Header `Authorization` = `Bearer <CRON_SECRET>`.
   Timeout 300 s. Turn on failure notifications to your email.
4. Test run: the response lists `ran`, `deferred` and `seconds`.

**Backup: GitHub Actions** (`.github/workflows/cron.yml`, every 30 min)
- In the repo, go to Settings → Secrets and variables → Actions.
- Add secret `CRON_SECRET`.
- Add variable `API_URL` = `https://kaamsathi-api.vercel.app/api/v1`.
- GitHub pauses scheduled workflows after 60 days with no commits. The cron-job.org timer keeps
  going anyway.

A daily Vercel Cron call is also built in. All three can overlap safely, because each job is
claimed before it runs.

## 7. First admin and smoke test

1. Sign in on the web with your phone. The OTP is in Vercel → `kaamsathi-api` → **Logs** (search
   `SMS`).
2. Make yourself superadmin. Run these from `backend/` on your machine; the env file stays on
   your machine:

   ```bash
   vercel link            # pick kaamsathi-api
   vercel env pull .env.production.local --environment=production
   set -a; . ./.env.production.local; set +a
   .venv/bin/python manage.py shell -c "from apps.accounts.models import *; u=User.objects.get(phone='98XXXXXXXX'); u.is_staff=True; u.save(); StaffProfile.objects.update_or_create(user=u, defaults={'roles':['superadmin']})"
   rm .env.production.local
   ```

   Then enrol TOTP when `/ops` asks. **Never** run `seed_demo` on this database.
3. Check:
   - `/ops/system/health` shows the beat heartbeat as fresh (the timer works).
   - Your session list shows **your** IP, which proves `BFF_PROXY_SECRET` matches.
   - An uploaded ID photo opens in the app through its signed link, and the link stops working
     after 10 minutes.
4. Bolau stays off until you switch the `bolau` flag on in `/ops/flags`.

## 8. When to leave the free tier

Move when **any** of these happen:
- you start charging;
- Upstash or Vercel warns about usage;
- you need jobs to the minute;
- you need virus scanning.

To move to a VPS (RUNBOOK §1) or Railway ([RAILWAY_VERCEL.md](RAILWAY_VERCEL.md)):
1. Restore a `pg_dump` of Neon into the new database.
2. Leave `MEDIA_STORAGE` and `SERVERLESS` unset there, so disk (or S3) storage and Celery take over.
3. Run `python manage.py export_db_media` (dry run), then `export_db_media --apply`. It copies every
   uploaded file out of the database into the new storage under the same name, so existing links
   keep working.
4. Once a few documents open correctly, delete the database copies (`StoredFile` rows).
