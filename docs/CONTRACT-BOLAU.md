# KaamSathi — Bolau contract (Sipalu self-profiles + Ghardhani bookings)

Decided by the founder on 2026-10-08. Supersedes the "no consumer household services marketplace"
non-goal (MASTER_PRODUCT_SPEC §32 / strategy) for this module only — see `docs/adr/0011-bolau.md`.
All conventions of CONTRACT.md, CONTRACT-ECOSYSTEM.md, CONTRACT-EXTENSIONS.md apply (auth, errors,
request ids, idempotency, page pagination, BS dates, money strings, signed private files, audit,
notify(), consent, encryption). The whole module is behind feature flag **`bolau`** (server
`apps.core.flags.is_enabled("bolau")`, client-visible) — off by default so the B2B pilot is unaffected.

## Words (use everywhere, both languages — add to docs/GLOSSARY.md)

| Concept | English UI | नेपाली UI | Notes |
| --- | --- | --- | --- |
| Skilled person offering work | **Sipalu** (pl. Sipalu) | **सिपालु** | "skilled, capable person". Replaces "worker" in worker-facing and public copy. Employer/ops screens keep "workers / कामदार" for employees. |
| Person/household who books | **Ghardhani** | **घरधनी** | "householder". Never "boss/malik". |
| The booking service | **Bolau** | **बोलाउ** | "call someone over": "Bolau a Sipalu" / "सिपालु बोलाउनुहोस्". |
| A posted job asking for offers | **Kaam request** | **कामको अनुरोध** | |
| A Sipalu's reply to a request | **Offer** | **प्रस्ताव** | |
| Code shown to the Sipalu on arrival | **Arrival code** | **आगमन कोड** | 4 digits |

## Guiding rules (hard requirements)

1. **Sipalu never pay.** No fee, commission or deduction on a Sipalu, ever. Only the Ghardhani pays a booking fee.
2. **KaamSathi never holds the Sipalu's money.** The Ghardhani pays the Sipalu directly (cash, or eSewa/Khalti/bank to the Sipalu's own account). The booking fee is KaamSathi's own revenue, collected through a payment-gateway adapter (disabled until a merchant agreement exists; while disabled the fee is waived and recorded as waived).
3. **Only identity-verified Sipalu are bookable** (`verification_status=verified`) and only while `bolau_enabled` is on in their profile. Minimum hourly rate ≥ `MinimumWage.hourly` (part-time rate 107) — "fair by default".
4. **Privacy & safety:** a Ghardhani's exact address and phone are revealed to the Sipalu only after the booking is accepted, and hidden again 48 h after completion. A Sipalu's phone is masked to Ghardhani until accepted; both talk through the app until then. No live location tracking is stored beyond a coarse "on the way" status. Every booking has the confidential safety report entry point (existing support `safety` category) and an emergency line (100 police) in both languages.
5. Ratings are two-way, only between parties of a completed booking, once each, moderated (existing moderation).
6. Consumer protection: clear price before booking, free cancellation window, no hidden fees. Legal review item: Consumer Protection Act 2075, platform/intermediary status, independent-worker status of Sipalu (add to PRODUCTION_CHECKLIST 🔴).

## 1. Sipalu self-registration & complete profile

Any user can become a Sipalu from the app or web (`/sipalu/join`), not only via employers/ops. Progressive onboarding (save-and-resume): phone OTP → name (en + ne) → photo → primary trade + other skills (multi, years, NSTB level) → languages → district/municipality + service area → availability → rates & services → payment details (own eSewa/Khalti/bank) → ID upload for verification → consent. Existing `Worker` model is reused (one person = one Worker); new fields live in `bolau.SipaluProfile`.

**`SipaluProfile(worker OneToOne, handle unique slug [a-z0-9-]{3,30} (auto from name, editable once/30 days), headline (≤80), headline_ne, bio (≤600), bio_ne, bolau_enabled bool, instant_booking bool, service_districts M2M District, service_radius_km, base_lat/lng? (coarse, 2 decimals; never shown), gender_visible bool (default False), years_total, response_time_minutes (computed), jobs_completed (computed), rating_avg/rating_count (computed from bolau ratings), created_at, updated_at)`**.
**`SipaluService(id, profile, trade, title, title_ne, description?, price_type fixed|hourly|visit_then_quote, price (fixed or hourly ≥ min hourly), visit_fee? (for visit_then_quote), estimated_minutes?, is_active, order)`** — e.g. electrician: "Ceiling fan installation — Rs 600 fixed".
**`AvailabilityRule(profile, weekday 0–6, start_time, end_time)`** + **`TimeOff(profile, from_date, to_date, note?)`**.
**`PortfolioItem(profile, image (private storage, validate_upload, served via signed/public-thumbnail per consent), caption, caption_ne, trade?, created_at)`** — max 12; worker consents to public display.
Profile completeness for Sipalu adds: headline, services ≥1, availability, service area, portfolio ≥1 (optional), payment details.

Endpoints (Sipalu = authenticated user with a Worker):
- `GET|PATCH /me/sipalu` (creates SipaluProfile lazily) · `POST /me/sipalu/onboarding-step {step, data}` (idempotent, returns `{completed_steps, next_step, completeness}`)
- CRUD `/me/sipalu/services`, `/me/sipalu/availability` (bulk PUT of rules), `/me/sipalu/time-off`, `/me/sipalu/portfolio` (multipart)
- `POST /me/sipalu/handle {handle}` (validates uniqueness + reserved words)
Public (no auth, throttled `public`, flag `bolau`): `GET /public/sipalu/{handle}` → `{handle, name, name_ne, photo_url, headline(_ne), bio(_ne), trades[{code,name_en,name_ne,years,nstb_level}], languages, verification_level, verified_badges[], rating_avg, rating_count, jobs_completed, response_time_minutes, services[], service_districts[], availability_summary, portfolio[{thumb_url, caption}], reviews[{score, comment, month_bs}] (latest 10, moderated, first names only), passport_url?}` — never phone, address, ID or exact location.

## 2. Ghardhani

Any user can act as a Ghardhani (no organization needed). **`GhardhaniProfile(user OneToOne, display_name, preferred_language, created_at)`**; **`Address(id, ghardhani, label home|office|other, line, ward, municipality, district, landmark?, lat?, lng?, is_default)`** — address lines EncryptedCharField; lat/lng stored, shared only per rule 4.
Endpoints: `GET|PATCH /me/ghardhani` · CRUD `/me/addresses` · `GET|POST|DELETE /me/favourites` (Sipalu handles).

## 3. Discovery

`GET /bolau/search?trade=&district=&q=&date=&time=&max_price=&instant=1&min_rating=&language=&gender=` (public, flag) → paginated Sipalu cards `{handle, name, photo_url, headline, top_trade, rating_avg, rating_count, jobs_completed, verification_level, from_price, next_available, distance_band?, instant_booking}`. Ranking: availability for the asked slot, trade match, district/radius, rating (Bayesian), completed jobs, response time, reliability score. Uses trade aliases (Nepali + romanised) for `q`. `GET /bolau/trades` → trades with ≥1 bookable Sipalu and typical services/prices (k-anon 5 for price stats).

## 4. Bookings (book a specific Sipalu)

**`Booking(id, code "BK-7Q4M", ghardhani, sipalu (Worker), service? (SipaluService), trade, description, address (FK, snapshot json at accept), scheduled_start (aware dt), estimated_minutes, price_type, quoted_price, visit_fee?, final_price?, booking_fee, booking_fee_status waived|pending|paid|refunded, status requested|accepted|declined|expired|on_the_way|arrived|in_progress|completed|confirmed|cancelled|no_show|disputed, cancelled_by ghardhani|sipalu|ops?, cancel_reason?, arrival_code (4 digits, hashed), arrival_verified_at?, started_at?, completed_at?, confirmed_at?, payment_method_to_sipalu cash|esewa|khalti|bank|null, paid_to_sipalu_marked_by?, paid_to_sipalu_at?, source direct|request, request? (KaamRequest), created_at, updated_at)`** + `BookingEvent(booking, from_status, to_status, by, note, at)`.

Lifecycle & rules:
- `POST /bolau/bookings {sipalu_handle, service_id?, trade, description, address_id, scheduled_start, estimated_minutes?, idempotency}` → `requested` (or `accepted` immediately if `instant_booking` and the slot is free). Validates availability, time-off, overlapping bookings (no double-booking), lead time ≥ 60 min, within service area.
- Sipalu: `POST /me/bolau/bookings/{id}/accept|decline {reason?}`; auto-`expired` if not answered within 30 min (or 15 min before start).
- Sipalu: `on_the_way` → `arrived` requires the **arrival code** the Ghardhani reads out (`POST .../arrive {code}`; 5 tries) → `start` → `complete {final_price?, note?}` (final ≤ quoted unless visit_then_quote, where the Sipalu quotes after the visit and the Ghardhani must `approve-quote` before work starts).
- Ghardhani: `confirm` (or auto-confirm 24 h after `completed`), `cancel {reason}` (free until 2 h before start; later cancellations flagged, still no charge to the Sipalu), `report-no-show`.
- Either party: `POST .../paid {method}` marks the direct payment to the Sipalu (both sides see it; dispute if they disagree).
- Ratings: `POST /bolau/bookings/{id}/rate {score 1–5, comment?, tags[on_time,clean_work,polite,fair_price,…]}` from each side once after `confirmed`; Sipalu rates the Ghardhani (respectful, paid as agreed, clear instructions). Feeds Sipalu rating + reliability score (new trust component weight for bookings, documented).
- Disputes: reuse `trust.Dispute` with `kind=booking` (+ `booking` FK), evidence and appeals as existing.
- Contact masking: `GET /bolau/bookings/{id}/contact` returns the other party's phone only in accepted…confirmed(+48h).
- Notifications: every transition → `notify()` (sms=True for request/accept/decline/cancel/arrival-near) using templates.
- Endpoints lists: Ghardhani `GET /me/bolau/bookings?status=`; Sipalu `GET /me/bolau/jobs?status=` (incoming + upcoming); detail `GET /bolau/bookings/{id}` (party-scoped; ops via ops route).

## 5. Kaam requests & offers (post a job, get offers)

**`KaamRequest(id, code "KR-…", ghardhani, trade, title, description, photos (≤4, private), address, preferred_window_start, preferred_window_end, budget_max?, status open|offers_received|booked|expired|cancelled, expires_at (+24 h), created_at)`**; **`Offer(id, request, sipalu, price_type, price, visit_fee?, message, proposed_start, status pending|accepted|rejected|withdrawn|expired, created_at)`** — max **3 offers** per request (first three verified, in-area Sipalu; further attempts get `request_full`), one per Sipalu.
- Ghardhani: `POST /bolau/requests`, `GET /me/bolau/requests`, `POST /bolau/requests/{id}/offers/{offer_id}/accept` → creates a `Booking(source=request)` in `accepted`; other offers → `rejected`; `cancel`.
- Sipalu: `GET /me/bolau/requests/nearby?trade=` (open requests in their trades + service area, without exact address — ward/municipality only), `POST /me/bolau/requests/{id}/offers`, `withdraw`.
- New request notifies up to 20 best-matching available Sipalu (instant notify, rate-limited per Sipalu).

## 6. Booking fee (KaamSathi revenue, paid by the Ghardhani only)

`BOLAU_BOOKING_FEE` (setting, default Rs 49; flag `bolau_fee` default off → fee `waived`). Collected at booking acceptance through `apps/bolau/payments.py` gateway adapter (eSewa ePay / Khalti KPG stubs raising NotConfigured; webhook HMAC like payouts). Refund if the Sipalu declines/expires/no-shows or the Ghardhani cancels inside the free window. Recorded in billing as `Charge(kind=booking_fee, payer_user=…)` (billing gains nullable `payer_user` FK — workers are never payers; DB check that payer_user has no Worker-only role is NOT required, but `kind=booking_fee` must reference a Ghardhani user). Invoices for fees are not needed (receipt PDF per paid fee instead, bilingual).

## 7. Ops

`/ops/bolau`: bookings & requests search, disputes/no-shows, Sipalu bolau-suspension (`bolau_enabled=false` + reason, audited), price/abuse flags (risk detectors: many cancellations, off-platform payment solicitation reports, fake reviews from same device/address), KPIs (bookings/day, acceptance rate, time-to-accept, completion, cancellation, repeat Ghardhani, avg rating), fee ledger. Staff role: `support` + new `ops/bolau` route → support.

## 8. Clients

- **Web (public, B direction):** `/bolau` landing + search (trade chips, area, date), `/sipalu/[handle]` public profile (book button, services, availability, portfolio, reviews, badges), booking flow (login via OTP inline), `/bolau/request` (post a Kaam request), Ghardhani account pages under `/ghar` (bookings, requests, addresses, favourites), `/sipalu/join` (web onboarding entry; mobile is primary), ops `/ops/bolau` (A direction). SEO: public Sipalu profiles indexable only when the Sipalu opts in (`public_indexable`, default off → noindex).
- **Mobile:** mode switch — a user can be Sipalu, Ghardhani, and/or employee/supervisor. Sipalu: onboarding wizard, Bolau tab inside Jobs (incoming bookings, nearby requests, offers), availability & services editor, earnings from bookings (amounts the Sipalu marked paid), arrival-code flow, ratings. Ghardhani: a home tab with search by trade, Sipalu profile, book flow, post request, offers compare, booking tracking (status timeline), arrival code display, pay-direct confirmation, rate, safety/report. Both languages; the B (street mural) direction.

## 9. Not in scope now

Live GPS tracking, in-app chat (use masked call/SMS + booking notes), subscriptions for Ghardhani, KaamSathi-held escrow, tipping via KaamSathi.

## Implementation notes (backend, 2026-10-09)

Code: `backend/apps/bolau/` (models, `profiles`/`onboarding`/`availability`/`bookings`/`kaam`/`payments`/`search`/`ops`/`risk`/`notify` services, `views.py`, `ops_views.py`, `payloads.py` = every response shape), tests `backend/tests/test_bolau_*.py`, demo `apps/bolau/demo.py`.

### Endpoint list (all under `/api/v1`, trailing slash optional)

| Who | Endpoints |
| --- | --- |
| Sipalu (any signed-in user; Worker + profile created lazily) | `GET\|PATCH /me/sipalu` · `POST /me/sipalu/onboarding-step` · `POST /me/sipalu/handle` · `GET\|POST /me/sipalu/services`, `GET\|PATCH\|DELETE /me/sipalu/services/{id}` (delete = deactivate) · `GET\|PUT /me/sipalu/availability` (`{rules:[{weekday,start_time,end_time}]}`) · `GET\|POST /me/sipalu/time-off`, `DELETE /me/sipalu/time-off/{id}` · `GET\|POST /me/sipalu/portfolio` (multipart `image`, `caption`, `caption_ne`, `trade`), `PATCH\|DELETE /me/sipalu/portfolio/{id}` |
| Public (no auth, throttle `public`, flag) | `GET /public/sipalu/{handle}` · `GET /bolau/search` · `GET /bolau/trades` · `GET /bolau/config` |
| Ghardhani | `GET\|PATCH /me/ghardhani` · `GET\|POST /me/addresses`, `GET\|PATCH\|DELETE /me/addresses/{id}` (delete = soft) · `GET\|POST /me/favourites` (`{handle}`), `DELETE /me/favourites/{handle}` (flag) · booking disputes `GET /me/booking-disputes?status=`, `GET /me/booking-disputes/{id}`, `GET\|POST /me/booking-disputes/{id}/evidence`, `POST /me/booking-disputes/{id}/appeal` (see 9) |
| Bookings (flag) | `POST /bolau/bookings` (Idempotency-Key) · `GET /bolau/bookings/{id}` · `GET /bolau/bookings/{id}/contact` · Ghardhani `POST /bolau/bookings/{id}/approve-quote\|reject-quote\|confirm\|cancel\|report-no-show` · either party `POST /bolau/bookings/{id}/paid\|rate\|dispute\|safety-report\|report` · `GET /bolau/bookings/{id}/dispute` (either party) · `POST /bolau/bookings/{id}/fee/pay {provider}` · `GET /bolau/bookings/{id}/receipt.pdf` · `POST /bolau/ratings/{id}/flag {reason}` (rated party) · Ghardhani list `GET /me/bolau/bookings?status=a,b` · Sipalu list `GET /me/bolau/jobs?scope=incoming\|upcoming\|past&status=` · Sipalu `POST /me/bolau/bookings/{id}/accept\|decline\|on-the-way\|arrive\|quote\|start\|complete\|cancel` |
| Kaam requests (flag) | `POST /bolau/requests` (JSON or multipart with `photos` ≤ 4; Idempotency-Key) · `GET /bolau/requests/{id}` (with `offers`) · `POST /bolau/requests/{id}/cancel` · `POST /bolau/requests/{id}/offers/{offer_id}/accept` → Booking · `GET /me/bolau/requests?status=` · Sipalu `GET /me/bolau/requests/nearby?trade=` · `GET /me/bolau/requests/{id}` · `POST /me/bolau/requests/{id}/offers` · `GET /me/bolau/offers` · `POST /me/bolau/offers/{id}/withdraw` |
| Gateway | `POST /webhooks/bolau/{esewa\|khalti}` — `X-Timestamp` (unix s, ±300 s) + `X-Signature: sha256=<hex HMAC(secret, ts + "." + body)>`, replay → 409 `webhook_replayed`; body `{reference: "BK-…", status: paid\|refunded, transaction_id, amount}` |
| Ops (`support` role via `ops/bolau` in `staff_roles.py`) | `GET /ops/bolau/bookings?q=&status=&from=&to=&fee_status=` · `GET /ops/bolau/bookings/{id}` (+ ratings, reports, disputes) · `POST /ops/bolau/bookings/{id}/cancel {reason}` · `POST /ops/bolau/bookings/{id}/reset-arrival {note?}` · `GET /ops/bolau/requests?q=&status=` · `GET /ops/bolau/sipalu?q=&suspended=1` · `POST /ops/bolau/sipalu/{handle}/suspend {reason}` / `unsuspend {note?}` · `GET /ops/bolau/ratings?status=&side=&voided=` · `POST /ops/bolau/ratings/{id}/hide\|restore {note?}` / `void {reason}` · `GET /ops/bolau/reports?reason=` · `GET /ops/bolau/flags?status=` · `GET /ops/bolau/kpis?days=` · `GET /ops/bolau/fees?status=` (+ `totals`) |

Key shapes: `booking` = `{id, code, status, status_label, source, request_id, trade{code,name_en,name_ne}, service{id,title,title_ne}|null, description, address, address_revealed, scheduled_start, scheduled_end, estimated_minutes, price_type(+_label), quoted_price, visit_fee, quote_amount, quote_status none|proposed|approved|rejected, final_price, booking_fee, booking_fee_status(+_label), cancelled_by, cancel_reason, late_cancellation, expires_at, accepted_at, arrival_verified_at, arrival_attempts_left, started_at, completed_at, confirmed_at, free_cancel_until, payment_to_sipalu{method, ghardhani_marked_at, ghardhani_method, sipalu_marked_at, sipalu_method, agreed}, contact_visible, contact_visible_until, sipalu{worker_id, handle, name, photo_url, phone_masked, phone|null, rating_avg}, ghardhani{user_id, name (first name until revealed), phone_masked, phone|null, rating{avg,count}}, my_role, safety{emergency_line "100", en, ne}, arrival_code (Ghardhani only, accepted/on_the_way), my_rating, can_rate, events[] (detail)}`. Before acceptance the Sipalu's `address` is `{ward, municipality, district}` only. Search card adds `score` and `indexable` (= `public_indexable`, so the web sitemap needn't fetch each profile); `GET /bolau/config` = `{booking_fee "49.00", booking_fee_enabled (flag `bolau_fee`), free_cancel_hours, accept_timeout_minutes, min_hourly_rate, max_offers 3, emergency_line "100"}` from settings — clients render the pre-booking fee line and free-cancel copy from it, never hard-coded; `distance_band` is `under_3_km|3_10_km|over_10_km` when `lat`/`lng` are passed. Onboarding-step body: `{step, data:{…}}` (JSON) or multipart with the step's fields + files (`photo`; `id_front`, `id_back`) next to `step`; response `{completed_steps, next_step, completeness{percent, missing, items[{key, done, optional, label}]}}`.

New error codes: `slot_taken` (409), `arrival_code_invalid` (400, `fields.attempts_left`), `arrival_code_locked` (423), `request_full` (400), `provider_not_configured`, `invalid_signature` (403), `webhook_replayed` (409); otherwise `invalid_state` / `validation_error` / `below_minimum_wage` / `duplicate`.

### Deviations and decisions

1. **Minimum rate**: the floor is `max(MinimumWage.hourly, hourly_part_time)` (Rs 107). A fixed price must also cover 107 × its estimated hours; visit-then-quote needs a visit fee.
2. **Ghardhani identity**: `Booking.ghardhani`, `Address.ghardhani`, `KaamRequest.ghardhani` and `Favourite.ghardhani` point at the `User` (the `GhardhaniProfile` only holds display name + language).
3. **Becoming a Sipalu**: the new Worker starts with `verification_status=pending` (as specified) even before an ID is uploaded; an unlinked Worker with the same phone is linked instead of duplicated. The `consent` step records `data_processing` + `profile_share` consents and sets `public_consent_at`; a public profile also needs `bolau_enabled`, `verified` and no suspension. `public_indexable` → `X-Robots-Tag: index, follow`, else `noindex`.
4. **Weekdays** use the contract convention 0 = Sunday … 6 = Saturday. Bookings may not span midnight; slots are on a 30-minute grid for `next_available`.
5. **Arrival code** is derived (HMAC of booking id + nonce) so the Ghardhani's app can show it; only an HMAC hash is stored. 5 wrong tries → locked (423); ops `reset-arrival` unlocks. Arrival is allowed from `accepted` too (if the Sipalu skipped "on the way").
6. **visit_then_quote**: `arrived` → Sipalu `quote {amount}` → Ghardhani `approve-quote` (then `start`) or `reject-quote` (→ `completed` with `final_price = visit_fee`). Hourly bookings may complete above the estimate up to rate × time worked; fixed/quoted never above the quote.
7. **Cancellation**: Ghardhani free while `requested`, and until 2 h before start once accepted (fee refunded/waived); later = `late_cancellation` (fee kept, risk-checked). Sipalu may cancel after accepting (fee refunded, counts against reliability). Ops may cancel any active booking. No-show can be reported 30 min after start.
8. **Booking fee**: opened at acceptance as `billing.Charge(kind=booking_fee, payer_user=Ghardhani)` — `waived` while flag `bolau_fee` is off. `Charge` gained `payer_user` (nullable), status `refunded`, and DB checks (`booking_fee` ⇒ `payer_user` set and no organization). User-paid charges are excluded from org invoicing. The fee does not block the booking while `pending`. Gateway refunds are not automatic yet: the booking is marked `refunded` with `fee_refund_manual=true` for ops.
9. **Disputes**: `trust.Dispute(kind=booking, booking FK, worker = Sipalu, organization = null)`; raised via `POST /bolau/bookings/{id}/dispute` (one open dispute per booking; `/me/disputes` rejects `kind=booking`). The Ghardhani can view it (`can_view_dispute`). Booking keeps `status_before_dispute`. **Ghardhani access (2026-10-09)**: `GET /bolau/bookings/{id}/dispute` → the booking's latest dispute for either party (404 when none or not a party; flag-gated like the booking); `GET /me/booking-disputes?status=` (paginated) and `GET /me/booking-disputes/{id}` → disputes on bookings where the caller is the Ghardhani (never the Sipalu's other disputes; anything else 404; not flag-gated so a household can always follow up); `GET|POST /me/booking-disputes/{id}/evidence` (multipart `file` + `note`, evidence `party=ghardhani`) and `POST /me/booking-disputes/{id}/appeal {reason}` (once, 14 days after the decision, `appeal.party=ghardhani`). The Sipalu keeps using `/me/disputes/{id}` (+ `/evidence`, `/appeal`, party `worker`). Shape = the shared dispute payload (`DisputeSerializer`).
10. **Safety**: `POST /bolau/bookings/{id}/safety-report {safety_kind, description, emergency?, anonymous?}` creates a confidential support case (category `safety`) whose subject/description carry the booking code (no support schema change).
11. **Ratings** live in `bolau.BookingRating` (one per side, DB unique) with their own moderation fields mirroring employment ratings (flag by the rated party → ops hide/restore/void); allowed only after `confirmed`. Tags are validated per side.
12. **Reliability**: `apps/trust/services.py` adds a `bookings` component once a Sipalu has ≥ 3 finished bookings: `0.6 × completed share + 0.4 × rating/5`; blended 80/20 with the existing score, or `0.7 × bookings + 0.3 × skills` when there is no employment. Workers without bookings are unchanged; the payload shows `breakdown.bookings` only when it applies.
13. **Risk**: `FraudFlag` gained subject types `user`, `booking` and kinds `booking_cancellations`, `off_platform_payment`, `review_fraud` (risk migration 0003). Reports come from `POST /bolau/bookings/{id}/report {reason: off_platform_payment|abusive|fake_profile|other}`. Review fraud compares hashed device (IP + user agent) and address fingerprints.
14. **Notifications**: bilingual templates in `apps/bolau/notify.py` (kind `bolau_<event>`), not DB `NotificationTemplate` rows. SMS for request/instant/accept/decline/cancel/on-the-way/offer-accepted. Reminder 1 h before start. A new Kaam request notifies ≤ 20 Sipalu, ≤ 5 request alerts per Sipalu per hour.
15. **Kaam requests**: offers are capped by `slot` 1–3 (unique per request); a withdrawn offer keeps its slot. Accepting an offer creates the booking directly in `accepted` (fee opened, arrival code issued). Request photos are private, signed URLs for the owner, ops and eligible Sipalu.
16. **Periodic**: beat `bolau-expire-and-confirm` (every 5 min: expiry, request expiry, auto-confirm after 24 h, reminders) and `bolau-risk-scan` (nightly).
17. **Telemetry** server events: `bolau_sipalu_joined`, `bolau_onboarding_step`, `bolau_booking_requested`, `bolau_booking_status_changed`, `bolau_request_posted`, `bolau_offer_sent`, `bolau_offer_accepted`, `bolau_rating_submitted` (new allowed properties: `booking_id`, `request_id`, `from_status`, `to_status`, `price_type`, `instant`, `score`).
18. **Flag off**: public, search, trades, bookings, requests, favourites and Sipalu job/offer lists 404; `/me/sipalu*`, `/me/ghardhani`, `/me/addresses`, ops and the webhook keep working.
