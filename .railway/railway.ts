/**
 * KaamSathi backend on Railway — API, Celery worker, Celery beat, Postgres, Redis, media bucket.
 * The web app (web/) runs on Vercel; see docs/deploy/RAILWAY_VERCEL.md for the full walkthrough.
 *
 *   railway login && railway link        # pick the KaamSathi project + environment
 *   cd .railway && npm install           # types for this file (railway/iac)
 *   railway config plan                  # review — values are redacted
 *   railway config apply                 # prompts before anything destructive
 *
 * Secrets never live in this file. Required ones are Railway *shared variables* (Project →
 * Settings → Shared Variables) referenced via ctx.shared; optional integration keys use
 * preserve() so `apply` keeps whatever you typed into the service's Variables tab.
 * Never use ctx.randomString() for secrets: it is a deterministic hash of its label.
 */
import { bucket, database, defineRailway, github, preserve, redis, service } from "railway/iac";

const REPO = "azwinverma/kaamsathi";
// Singapore: the closest Railway region to Nepal. Keep Vercel functions in sin1 next to it.
const REGION = "asia-southeast1-eqsg3a";

export default defineRailway((ctx, project) => {
  // Postgres 16 = the version CI and docker-compose test against (the helper defaults to 18).
  const db = database("postgres", "postgres", {
    image: "ghcr.io/railwayapp-templates/postgres-ssl:16",
    output: "DATABASE_URL",
    defaultMountPath: "/var/lib/postgresql/data",
    region: REGION,
  });
  const cache = redis("redis", { region: REGION });
  // Private S3-compatible bucket: KYC photos, documents, payslips, exports (signed URLs only).
  const media = bucket("media", { region: "sin" });

  const shared = (name: string) => ctx.shared[name];

  const backendEnv = {
    DJANGO_SETTINGS_MODULE: "config.settings.prod",
    // Required secrets — create these shared variables before the first apply.
    DJANGO_SECRET_KEY: shared("DJANGO_SECRET_KEY"),
    JWT_SIGNING_KEY: shared("JWT_SIGNING_KEY"),
    FIELD_ENCRYPTION_KEYS: shared("FIELD_ENCRYPTION_KEYS"), // losing these = encrypted IDs unrecoverable
    FIELD_HASH_KEY: shared("FIELD_HASH_KEY"),
    BFF_PROXY_SECRET: shared("BFF_PROXY_SECRET"), // same value in the Vercel web project
    PUBLIC_WEB_URL: shared("PUBLIC_WEB_URL"), // e.g. https://kaamsathi.vercel.app, later https://kaamsathi.com
    SMS_BACKEND: shared("SMS_BACKEND"), // console (OTP in API logs) until the Sparrow sender ID is approved
    // Optional integrations: set per service in the dashboard when you have them.
    DJANGO_SECRET_KEY_FALLBACKS: preserve(),
    SPARROW_SMS_TOKEN: preserve(),
    AAKASH_SMS_TOKEN: preserve(),
    SENTRY_DSN: preserve(),
    METRICS_TOKEN: preserve(),
    EMAIL_HOST: preserve(),
    EMAIL_HOST_USER: preserve(),
    EMAIL_HOST_PASSWORD: preserve(),
    FCM_PROJECT_ID: preserve(),
    FCM_SERVICE_ACCOUNT_JSON: preserve(),
    PAYOUT_WEBHOOK_SECRETS: preserve(),
    BOLAU_WEBHOOK_SECRETS: preserve(),
    BILLING_SELLER_PAN: preserve(),
    // Data stores (private network).
    DATABASE_URL: db.env.DATABASE_URL,
    REDIS_URL: cache.env.REDIS_URL,
    CELERY_BROKER_URL: "${{redis.REDIS_URL}}/1", // separate Redis db from the cache, as in compose
    CELERY_TASK_ALWAYS_EAGER: "false",
    AWS_STORAGE_BUCKET_NAME: "${{media.BUCKET}}",
    AWS_S3_ENDPOINT_URL: "${{media.ENDPOINT}}",
    AWS_S3_REGION_NAME: "${{media.REGION}}",
    AWS_ACCESS_KEY_ID: "${{media.ACCESS_KEY_ID}}",
    AWS_SECRET_ACCESS_KEY: "${{media.SECRET_ACCESS_KEY}}",
    AWS_S3_ADDRESSING_STYLE: "virtual",
    FILES_S3_REDIRECT: "true",
    // Links the API puts in SMS/push/email/PDFs.
    API_PUBLIC_URL: "https://${{api.RAILWAY_PUBLIC_DOMAIN}}",
    // Railway's edge proxy is the one trusted hop (X-Forwarded-For / -Proto).
    NUM_PROXIES: "1",
    STAFF_MFA_REQUIRED: "true",
    CLAMAV_REQUIRED: "false", // no ClamAV on Railway yet; uploads are still type/size-validated
    LOG_JSON: "true",
    LOG_LEVEL: "INFO",
    SENTRY_ENVIRONMENT: ctx.environment ?? "production",
    RELEASE: "${{RAILWAY_GIT_COMMIT_SHA}}",
  };

  const backendSource = github(REPO, { branch: "main", rootDirectory: "backend" });
  const backendBuild = {
    builder: "DOCKERFILE" as const,
    dockerfilePath: "Dockerfile",
    // Only backend changes redeploy the three backend services.
    watchPatterns: ["/backend/**"],
  };

  const api = service("api", {
    source: backendSource,
    build: backendBuild,
    // Image CMD = gunicorn (binds $PORT). Migrations + reference data run once per deploy,
    // before traffic switches; a failure stops the deploy.
    preDeploy: "sh -c 'python manage.py migrate --noinput && python manage.py seed_reference'",
    healthcheck: "/api/v1/readiness",
    healthcheckTimeout: 120,
    regions: { [REGION]: 1 },
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    env: {
      ...backendEnv,
      // Railway healthchecks use this Host header. Add api.kaamsathi.com here once it is live.
      DJANGO_ALLOWED_HOSTS: "${{RAILWAY_PUBLIC_DOMAIN}},healthcheck.railway.app",
      CSRF_TRUSTED_ORIGINS: "https://${{RAILWAY_PUBLIC_DOMAIN}}",
      // Containers see the host's CPU count; pin workers so memory stays predictable (~150 MB each).
      GUNICORN_WORKERS: "2",
      GUNICORN_THREADS: "4",
    },
  });

  const worker = service("worker", {
    source: backendSource,
    build: backendBuild,
    start: "celery -A config worker -l info --concurrency 2 --max-tasks-per-child 200",
    regions: { [REGION]: 1 },
    deploy: { restartPolicyType: "ALWAYS" },
    env: { ...backendEnv, DJANGO_ALLOWED_HOSTS: "localhost" },
  });

  // Exactly one beat replica, or scheduled jobs run twice.
  const beat = service("beat", {
    source: backendSource,
    build: backendBuild,
    start:
      "celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler --pidfile /tmp/celerybeat.pid",
    regions: { [REGION]: 1 },
    deploy: { restartPolicyType: "ALWAYS" },
    env: { ...backendEnv, DJANGO_ALLOWED_HOSTS: "localhost" },
  });

  return project("kaamsathi", { resources: [db, cache, media, api, worker, beat] });
});
