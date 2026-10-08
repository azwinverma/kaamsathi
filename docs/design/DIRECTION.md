# KaamSathi — approved visual direction (2026-10-08)

Approved by the founder from the directions board (https://claude.ai/artifact/QskExj9LuiAFRVUp1mzRDZ).
Binding together with `docs/BRAND_GUIDELINES_V3_HUMAN_CRAFTED.md`, `docs/HUMAN_CRAFTED_UI_GUARDRAILS.json`
and the tokens in `design/tokens.json`. Where they disagree, v3 wins.

## The blend

| Surface | Direction | Feel |
| --- | --- | --- |
| Public website (`/`, `/help`, `/developers`, `/partners/docs`, `/privacy`, `/terms`) | **B · Street mural** | joyful, editorial, human |
| Public Skill Passport (`/p/...`) and the mobile Passport | **B · Street mural** | proud, shareable, verified |
| Flutter worker app | **B · Street mural** (most expressive surface) | encouraging, simple, energetic |
| Employer web app (`/app`) | **A · Documentary ledger** | fast, calm, operational |
| Ops console (`/ops`) | **A · Documentary ledger**, most restrained | precise, dense, safe |
| Flutter supervisor mode | **A** (operational) inside the B shell | calm, quick |

## Signature elements (product-specific, never generic)

1. **Skill ladder / सीपको सीढी** — five rising rungs (Phone → Identity → Work → Certificate → Highly trusted)
   in canvas → teal-subtle → teal → blue → yellow. The visual signature: hero, Passport, worker home,
   trust screens. Rungs not yet earned are dashed outlines, never greyed-out failure.
2. **Mural lettering** — hand-lettered Devanagari words (काम, सीप, साथी) in yellow with offset coral/ink
   shadow, slightly rotated, on blue grounds with a fine dot texture (spray-paint grain). Decorative only:
   `aria-hidden`, never carries meaning alone, max one per view.
3. **Brush strokes** — thick rounded teal/yellow/coral strokes with 1–2 spray dots, as accents in hero
   bands and app headers. Max two per view.
4. **Cut-paper portrait frames** — white-bordered photo frames, rotated ±4–6°, with a strip of coloured
   "tape". Used ONLY for real commissioned portraits of consenting workers (or clearly-labelled
   illustration placeholders until those exist). Never fake people, never testimonials without consent.
5. **Verification ladder (A)** — vertical timeline with filled teal nodes for dashboards and ops.
6. **Site roster strip, match reason card, employment timeline, credential card** — shared components
   (see each surface's component folder).

## Imagery policy (approved: commission + slots)

- No stock photos, no AI-generated faces or people. Illustrations are original, geometric, with real
  tools and correct PPE — one consistent style (see `design/illustrations/`).
- Every photo position is an **art-directed image slot**: a component with a fixed aspect ratio, an
  illustrated fallback, alt text and a shot description; the real photo drops in from
  `web/public/images/photos/<slot-id>.(jpg|webp)` / `mobile/assets/photos/` when commissioned.
- Shot list for the photographer and the street-art commission: `docs/design/PHOTOGRAPHY_BRIEF.md`.
- No fake metrics or testimonials anywhere — `[PLACEHOLDER]` text until real pilot data exists.

## Motion

Explains state; 150/200/280/360 ms, easing `cubic-bezier(0.2,0,0,1)`. Allowed: section reveal on
scroll (once, short translate + fade), ladder rungs growing in, score ring filling, checkmark on
verification, small celebration on real milestones (first verified credential, first placement,
profile 100%, training completed). Never: infinite gradients, floating blobs, parallax everywhere.
Everything collapses to instant under `prefers-reduced-motion` / disableAnimations.

## Deferred by decision

Agency foreign-job publication (ADR 0007) — vault + licensed-agency sharing only.
