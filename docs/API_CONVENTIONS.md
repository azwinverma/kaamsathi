# KaamSathi — API conventions

These rules apply to every KaamSathi API surface:
- the user API (web BFF and Flutter app)
- the partner API
- the enterprise API
- webhooks

Endpoint lists live in [CONTRACT.md](CONTRACT.md), [CONTRACT-ECOSYSTEM.md](CONTRACT-ECOSYSTEM.md) and
[CONTRACT-EXTENSIONS.md](CONTRACT-EXTENSIONS.md). If those contracts and this file disagree, the
contracts win, and this file should be fixed. Live schema: `https://<API_DOMAIN>/api/docs/` (staff
only in production).

Items marked **(in progress)** are being built under CONTRACT-EXTENSIONS. Clients may send the
headers now; the server ignores what it doesn't support yet.

---

## 1. Base URL and format

| Environment | Base URL |
| --- | --- |
| Production | `https://api.<domain>/api/v1` (e.g. `https://api.kaamsathi.com/api/v1`) |
| Staging | `https://api.staging.<domain>/api/v1` (per `deploy/.env.staging`) |
| Local | `http://localhost:8000/api/v1` (Android emulator: `http://10.0.2.2:8000/api/v1`) |
| Web BFF (browser only) | `https://<domain>/api/proxy/<path>` → forwards to the API with cookies turned into headers |

- JSON in and out with `snake_case` keys. Exports (`.xlsx`, `.csv`, `.pdf`, `.png`) are the only non-JSON responses.
- Trailing slashes are optional (`/org/jobs` and `/org/jobs/` both work).
- IDs are UUID strings. Exceptions: reference codes (`district: "kathmandu"`, `trade: "electrician"`) and BS/fiscal labels.
- Datetimes are ISO 8601 with offset, in Asia/Kathmandu (`2026-10-07T09:15:00+05:45`).
- Language: send `Accept-Language: en` or `ne`. The server localises `message` and every `*_label` field. Data values (codes, names) are never translated.
- Phones are 10-digit Nepali mobiles matching `^9[78]\d{8}$`. Send them without `+977` or spaces. Masked form: `98XXXXX123`.

## 2. Authentication schemes

| Scheme | Header | Who | Notes |
| --- | --- | --- | --- |
| User JWT | `Authorization: Bearer <access>` | worker / employer / staff apps | Get it from `POST /auth/otp/request {phone}` then `POST /auth/otp/verify {phone, code}` → `{access, refresh, user}`. Access lasts 30 min. Refresh lasts 30 days and rotates on every `POST /auth/token/refresh` (the old one is blacklisted). `POST /auth/logout {refresh}` blacklists it. |
| Staff MFA step **(in progress)** | none (body token) | ops staff | `otp/verify` returns `{mfa_required: true, mfa_token}`. Then `POST /auth/mfa/verify {mfa_token, code}` returns tokens. |
| Org scoping | `X-Org-Id: <organization uuid>` | every `/org/*` call | The user must have an active `Membership` there, else 403 `org_forbidden`. Not used on `/me/*`, `/ops/*`, `/partner/*`, `/enterprise/*`. |
| Partner key | `Authorization: Partner ks_<8-char prefix>_<secret>` | licensed partners on `/partner/*` | Issued once by ops (`POST /ops/partners/{id}/keys {scopes}`). Scopes: `profile.read`, `earnings.read`, `passport.read`, `referrals.write` (+ `mobility.read` in progress). Each worker read also needs an active `ConsentGrant` from that worker. Revoked keys and inactive partners get 401. |
| Org API key **(in progress)** | `Authorization: Org ks_org_<prefix>_<secret>` | employer systems on `/enterprise/*` | Created by owner/admin at `/org/api-keys` and shown once. Scopes include `jobs.read`, `jobs.write`, `workforce.read`, `attendance.read`, `attendance.write`, `payroll.read`, `timesheets.read`. The org comes from the key, so there's no `X-Org-Id`. |
| Signed file URL | none (token in path) | anyone holding a link the API just issued | `GET /api/v1/files/<token>` expires after `FILE_URL_TTL_SECONDS` (600 s). The server re-checks on download that the user is still active and still allowed. If the request carries a different user's JWT, it is refused. Never store these URLs; ask the API for a new one. |
| Metrics **(in progress)** | `Authorization: Bearer <METRICS_TOKEN>` | Prometheus | `/metrics` returns 404 when the token is unset. |

Keys and tokens are secrets. Never put them in URLs (except signed file tokens), logs, crash
reports or screenshots. On the web, tokens live only in HttpOnly cookies, and the BFF refuses to
proxy token-issuing endpoints.

## 3. Errors and request IDs

Every failure, including 404 and 500, uses one envelope:

```json
{
  "error": {
    "code": "below_minimum_wage",
    "message": "Wage is below the legal minimum (Rs. 19,550/month).",
    "fields": {"wage_amount": ["Must be at least 19550.00"]},
    "request_id": "6f1c2a0e-3c1e-4c55-9a43-2f3b8a1d9e10"
  }
}
```

- Branch on `code`. `message` is localised text for people and may change between releases.
- `fields` maps field paths to messages. Nested paths look like `employment.basic_salary` or `records.3.date`.
- `request_id` **(in progress)**: send `X-Request-ID` (≤ 64 chars `[A-Za-z0-9._-]`) or the server generates one. It comes back in the `X-Request-ID` response header and in the error envelope, and it is attached to logs and Sentry. Quote it in every support case.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `validation_error` | bad input; see `fields` |
| 400 | `below_minimum_wage` | job/employment wage under `hiring.MinimumWage` |
| 400 | `invalid_state` | transition not allowed (pipeline stage, approved payroll month locked, unverified employer shortlist) |
| 400 | `outside_geofence` | QR check-in farther than the site radius |
| 400 | `duplicate` | already exists (payroll run for the month, …) |
| 400 | `otp_invalid` / `otp_expired` | login code wrong or older than 5 min |
| 400 | `upload_rejected` **(in progress)** | file type/size/content refused, or malware found |
| 401 | `not_authenticated` | missing/expired token or key |
| 403 | `permission_denied` | role or scope doesn't allow it |
| 403 | `org_forbidden` | no membership for `X-Org-Id` |
| 403 | `mfa_required` **(in progress)** | staff must enrol or verify MFA |
| 404 | `not_found` | also used for "exists but not yours" (we don't leak existence) |
| 409 | `idempotency_conflict` **(in progress)** | same `Idempotency-Key`, different body |
| 429 | `otp_rate_limited` / `throttled` | rate limit; honour `Retry-After` |
| 500 | `server_error` | our bug; retry later with the same `Idempotency-Key` |

Rate limits (defaults, env-tunable):

| Limit | Default |
| --- | --- |
| anonymous | 120/min |
| user | 600/min |
| OTP endpoint | 30/hour/IP |
| OTP per phone | 5/hour |
| public passport | 60/min |
| files | 240/min |
| privacy | 10/hour |

## 4. Idempotency

Mobile networks in Nepal drop requests. Clients must make retries safe.

1. **Attendance (built).** Every record in `POST /org/attendance/bulk` and every
   `/me/attendance/check-in|out` carries a client-generated `client_uuid`. The server upserts on
   `(employment, date)` and reports per-record `saved` and `errors`. Resending a whole queue is safe.
   The Flutter supervisor app keeps an offline queue on this basis.
2. **Natural uniqueness (built).** Creating a second payroll run for the same BS month returns
   `duplicate`. Shortlisting an already-pipelined worker is a no-op.
3. **`Idempotency-Key` header (in progress).** Send a fresh UUID per logical operation (≤ 100 chars) on these POSTs:
   - payroll-run create
   - payout create/submit
   - ops shortlist
   - offer apply
   - member invite
   - employment create
   - privacy-request create
   - partner referral status
   - enterprise attendance bulk

   The server stores the response for 24 h, keyed by caller, method, path and key. A replay
   returns the same status and body with `Idempotent-Replayed: true`. The same key with a different
   body returns 409 `idempotency_conflict`. Reuse the key only when retrying that exact request.

```http
POST /api/v1/org/payroll-runs
Authorization: Bearer eyJ...
X-Org-Id: 4b7f...e2
Idempotency-Key: 0b8d3c8e-6a52-4b8e-9a4c-1f0d2c9e7b11
Content-Type: application/json

{"bs_year": 2083, "bs_month": 6, "include_festival_allowance": true}
```

## 5. Pagination: page numbers on purpose

List endpoints take `?page=1&page_size=25` (max 100) and return:

```json
{"count": 132, "next": "https://api.../org/employments?page=2", "previous": null, "results": [ ... ]}
```

Small reference lists (`/ref/*`) are not paginated.

**Why not cursor pagination** (the reference design suggests cursors):
- **Data is small per tenant.** A pilot org has 20–500 workers, and ops queues have hundreds of
  rows. Offset cost doesn't matter at this size.
- **The UIs need totals and jumps.** Ops queues show "page 3 of 7". Employers jump to a page in a
  worker list, and supervisors see counts. Cursors make that awkward.
- **Every client already uses it.** The Next.js tables, the Flutter lists and the published
  partner docs all use page numbers. Changing would break shipped mobile builds, which stay on old
  versions for months.

Known trade-off: rows can shift between pages if records are added while paging. For
**synchronisation**, don't walk pages. Use the time-window filters the endpoints provide:
- `GET /enterprise/attendance?from=&to=`
- `GET /me/attendance?bs_year=&bs_month=`
- the payroll runs for a month

If a high-volume feed ever needs it (e.g. an enterprise attendance stream > 10k rows/day), we'll
add a cursor variant on that single endpoint and keep page numbers elsewhere.

Ordering: `?ordering=field` or `?ordering=-field` where the endpoint allows it. Filters are listed per endpoint.

## 6. Dates: AD on the wire, BS alongside

Nepal works in Bikram Sambat (BS), but storage and inputs use AD so date maths stays correct.

- Store and send AD ISO dates (`2026-10-07`). Every date field `x` in a response also has
  `x_bs` (`"2083-06-21"`, zero-padded BS). Clients **display** BS (e.g. "21 Ashwin 2083" /
  "२१ असोज २०८३") and **send** AD.
- Payroll, registers and SSF are keyed by BS month: `bs_year`, `bs_month` (1 = Baishakh … 12 = Chaitra).
  BS months have 29–32 days, so never assume 30. Get `days_in_month` from the API.
- Fiscal year runs Shrawan 1 → Asar end and is written `"2083/84"`.
- Converters (no auth):
  - `GET /ref/calendar/today`
  - `GET /ref/calendar/convert?ad=YYYY-MM-DD` or `?bs=YYYY-MM-DD`
  - `GET /ref/calendar/month?bs_year=&bs_month=`

  Don't hand-roll BS conversion in clients; use these or the same `nepali-datetime` tables.
- The one exception for input: the employment import file accepts BS dates when the `date_system` column says `bs`.
- Week (roster, timesheets) starts on **Sunday**. The default weekly off is Saturday (`weekly_off_day = 6`).

## 7. Money

- NPR only. Amounts are **decimal strings with 2 places**: `"19550.00"`. Never send or parse floats.
- Rounding: 2 dp, `ROUND_HALF_UP`. TDS is rounded to the whole rupee.
- Display: `Rs. 1,95,500.00` with lakh grouping (`रु. १,९५,५००` in Nepali UI). See [DESIGN.md](DESIGN.md).
- Workers are never charged. No endpoint creates a charge against a worker.

## 8. Versioning and change policy

- The version is in the path: `/api/v1`. Within v1 we only make **additive** changes:
  - new endpoints
  - new optional request fields
  - new response fields
  - new enum values, documented in the contract first
- Clients must ignore unknown fields. They must treat unknown enum values as "other" and show `*_label`.
- Breaking changes (removing or renaming a field, changing a type or meaning, tightening validation
  on existing fields) need `/api/v2` for the affected surface, or a new endpoint.
- Deprecation for external integrators (partner and enterprise APIs): at least **6 months'
  notice** by email, the changelog in `/partners/docs` (and `/developers`, in progress), and
  `Deprecation` / `Sunset` response headers on the old route.
- Mobile apps: field users update slowly. Keep every v1 behaviour that the oldest supported app
  build relies on. Before removing anything, check the `User-Agent` / app version in logs.
- Contract-first: change `docs/CONTRACT*.md` in the same PR as the code.

## 9. Webhooks

### 9.1 Outbound (we → you): partner and enterprise webhooks

- **Partner webhooks** are built: `referral.created` and other referral events go to `Partner.webhook_url`.
  The secret is shown once when ops sets the URL and can be rotated from the ops console.
- **Enterprise webhooks (in progress)** go to `/org/webhooks` endpoints. Events:
  - `application.stage_changed`
  - `employment.started` / `employment.ended`
  - `payroll.run_approved` / `payroll.run_paid`
  - `timesheet.approved`
  - `dispute.raised`
  - `support_case.updated`

  Use `/org/webhooks/{id}/test` to send a test event.

Request:
```http
POST <your url>
Content-Type: application/json
User-Agent: KaamSathi-Webhooks/1.0
X-KaamSathi-Timestamp: 1791370800
X-KaamSathi-Signature: sha256=5d1f0c...e9

{"created_at":"2026-10-07T10:20:00+05:45","data":{...},"event":"referral.created"}
```

Signature = hex HMAC-SHA256 with your webhook secret over `timestamp + "." + raw_body`.

To verify:
1. Compute the HMAC over the **raw bytes**. Don't re-serialise the JSON.
2. Compare in constant time.
3. Reject timestamps more than **5 minutes** from your clock, to stop replays.
4. Respond 2xx within 5 s and do the heavy work asynchronously.

Delivery is at-least-once. Enterprise deliveries retry at 1 m, 5 m, 30 m, 2 h and 12 h, so
de-duplicate on the event's id/data. Partner referral webhooks retry 3 times, 60 s apart (`partners.tasks.send_referral_webhook`). Ops can see `partner_notified_at` on the referral.

**Python (Flask / Django-style):**
```python
import hashlib, hmac, time

TOLERANCE_SECONDS = 300

def verify_kaamsathi(secret: str, raw_body: bytes, timestamp: str, signature: str) -> bool:
    if not timestamp or not signature:
        return False
    try:
        if abs(time.time() - int(timestamp)) > TOLERANCE_SECONDS:
            return False
    except ValueError:
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())

# Django view
def kaamsathi_webhook(request):
    ok = verify_kaamsathi(
        settings.KAAMSATHI_WEBHOOK_SECRET,
        request.body,                                   # raw bytes
        request.headers.get("X-KaamSathi-Timestamp", ""),
        request.headers.get("X-KaamSathi-Signature", ""),
    )
    if not ok:
        return HttpResponse(status=401)
    event = json.loads(request.body)
    enqueue_processing(event)                           # do work async, reply fast
    return HttpResponse(status=204)
```

**Node.js (Express):**
```js
const crypto = require("crypto");
const express = require("express");
const app = express();
const TOLERANCE_SECONDS = 300;

function verifyKaamSathi(secret, rawBody, timestamp, signature) {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// express.raw keeps the exact bytes; do NOT use express.json() on this route
app.post("/webhooks/kaamsathi", express.raw({ type: "application/json" }), (req, res) => {
  const ok = verifyKaamSathi(
    process.env.KAAMSATHI_WEBHOOK_SECRET,
    req.body, // Buffer
    req.get("X-KaamSathi-Timestamp"),
    req.get("X-KaamSathi-Signature"),
  );
  if (!ok) return res.sendStatus(401);
  const event = JSON.parse(req.body.toString("utf8"));
  queue.add(event); // process asynchronously
  res.sendStatus(204);
});
```

### 9.2 Inbound (provider → us): payout status webhooks

`POST /api/v1/webhooks/payouts/{provider}` (provider = `esewa|khalti|connectips`) is disabled
unless the provider is listed in `PAYOUT_PROVIDERS` and has a secret in `PAYOUT_WEBHOOK_SECRETS`.

- Header `X-Signature` is the hex HMAC-SHA256 of the **raw body**. A `sha256=` prefix is accepted.
- Body: `{"items": [{"reference", "status", "provider_ref?", "reason?"}]}`. Code: [apps/payouts/providers.py](../backend/apps/payouts/providers.py).
- This scheme has no timestamp, so it doesn't protect against replays (see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md), "Known gaps"). When a real provider contract is signed, adopt the provider's own
  signature scheme in that adapter.

## 10. Client checklist

- [ ] Send `Accept-Language`, plus `X-Org-Id` on `/org/*` and `X-Request-ID` (when available).
- [ ] Retry only idempotent calls automatically: GETs, attendance with `client_uuid`, and POSTs with `Idempotency-Key`. Use exponential backoff and honour `Retry-After`.
- [ ] Refresh the access token on 401 once, then send the user to login.
- [ ] Show BS dates and `Rs.` amounts. Never compute payroll on the client.
- [ ] Never cache signed file URLs or put personal data in analytics or crash logs.
