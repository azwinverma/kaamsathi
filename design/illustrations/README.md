# KaamSathi illustration kit (v1)

Original, hand-authored SVGs in one geometric style. They are **interim fallbacks** for the
art-directed photo slots (`web/components/marketing/slots.ts`) and for empty/error states. They are not
a replacement for commissioned photography (see `docs/design/PHOTOGRAPHY_BRIEF.md`).

The canonical files live here. The website uses copies in `web/public/illustrations/` — re-copy after
editing (`cp design/illustrations/*.svg web/public/illustrations/`).

## Files

| File | Scene | Aspect | Used by slot |
| --- | --- | --- | --- |
| `hvac-gauge.svg` | HVAC technician reading a manifold gauge set at a condenser unit | 4:5 | `hero-hvac-biratnagar` |
| `electrician-board.svg` | Woman electrician (hard hat, insulated gloves) testing a breaker in a distribution board, brick wall | 4:5 | `hero-electrician-bhaktapur` |
| `welder-visor.svg` | Woman welder lifting her helmet after a test weld, booth curtain, MIG torch | 4:3 | `career-welder-visor` |
| `plumber-wrench.svg` | Plumber with a pipe wrench under a rooftop water tank | 4:5 | `notfound-plumber` |
| `cook-kitchen.svg` | Cook (hair cover, apron) at a karahi, pressure cooker beside | 4:5 | `worker-cook-kitchen` |
| `security-gate.svg` | Woman security guard at a compound gate with the visitor register | 4:5 | `worker-guard-gate` |
| `solar-roof.svg` | Solar installer on a tin roof, harness clipped to an anchor, helmet with chin strap | 4:5 | `auth-solar-roof` |
| `supervisor-hajiri.svg` | Older site supervisor (white hard hat, hi-vis vest) marking hajiri on a phone, scaffold behind | 4:3 | `employer-supervisor-hajiri` |
| `training-lab.svg` | Instructor and trainee (safety glasses) at a wiring practice board | 4:3 | `partners-training-lab` |
| `passport-phone.svg` | Hands holding a phone showing the Skill Passport (card, ladder, timeline) | 4:5 | `passport-hands-phone` |
| `mural-wall.svg` | Painted mural on a brick wall: hand with wrench, five-rung ladder, stone paving | 4:3 | `mural-wall-patan` |

Canvas: portrait scenes are `400×500`, wide scenes `480×360`. Slots crop with `object-fit: cover`, so
keep the subject inside the central 80%.

## Shape grammar (follow it for every new illustration)

1. **Ground.** One flat tinted rectangle (a token "subtle" colour), one large geometric shape behind the
   subject (disc or arch, white at 70% or a second tint), and the spray-dot texture: a 14px pattern of
   1.4px ink dots at 9% opacity over part of the scene. Patterns for real surfaces only (brick, tiles,
   corrugated tin, stone paving).
2. **People are flat, never outlined.** Head = circle r≈34, featureless (no eyes, mouth or nose). Hair is
   one ink silhouette (braid, bun, short, greying). Torso = rounded rectangle (rx≈26). Limbs are thick
   round-capped strokes (arms 24–26, legs 34); hands are circles r≈12–13. Sleeves one shade darker than
   the torso so arms read against the body.
3. **Tools, PPE and objects are outlined.** 3px ink (`#0F172A`) stroke, round joins. This contrast — soft
   people, crisp tools — is the kit's signature: the work and its safety gear are the hero.
4. **Correct PPE, always.** Hard hat with brim on sites (white for supervisors), chin strap at height,
   harness + lanyard to an anchor on roofs, insulated gloves at electrical boards, safety glasses at
   benches and with refrigerant, welding helmet and leather gauntlets for welding, hair cover in kitchens.
5. **Camera.** Author the scene on the canonical stage, then frame it with one
   `<g transform="translate(..) scale(1.15–1.45)">` group — editorial crops (waist-up, objects cut by the
   edge), not full-figure clip art.
6. **Accents.** At most three accent hues per scene. Finish with one pair of spray dots (r 7 + r 4) in an
   accent near a corner. No sparkles, stars, blobs or 3D.
7. **Nepal context from work, not tourism.** Brick walls, black rooftop water tanks, tin roofs, karahi
   and pressure cooker, visitor registers, steel scaffolds, stone paving. No temples, mountains or flags.
8. **Diversity.** Mix genders and ages across the set (four of eleven scenes lead with women; one older
   supervisor). Skin tones rotate through the illustration-only set below.
9. **No text inside SVGs.** Devanagari in `<img>` SVGs would render with fallback fonts. Lettering is
   added in HTML (`MuralLettering`) when needed.
10. **Accessibility.** Each file has a `<title>`. On the page the `<img>` gets alt text from messages
    (`marketing.slots.<id>.alt`), which describes the subject for both illustration and future photo.

## Palette

Only token colours from `design/tokens.json`:

- Ink / neutrals: `#0F172A`, `#334155`, `#5A6679`, `#CBD5E1`, `#E2E8F0`, `#F1F5F9`, `#F8FAFC`, `#FFFFFF`
- Blue: `#2563EB`, `#1D4ED8`, `#DBEAFE`, `#EFF6FF`; indigo `#4F46E5`
- Teal: `#14B8A6`, `#0F766E`, `#CCFBF1`, `#F0FDFA`
- Yellow: `#FBBF24`, `#FEF9E7` · Coral: `#FF6B6B`, `#C2410C`, `#FFF1F1`

Illustration-only skin tones (not UI colours; never used in product UI): `#8D5A3B`, `#B07A52`, `#6B4430`.
