# KaamSathi — photography & mural brief

Companion to `docs/design/DIRECTION.md` (imagery policy: commission + slots). Every photo position on the
public website, Passport and auth screen is an **art-directed image slot** with a fixed id and aspect
ratio. Until a photo is delivered, the slot shows an illustration from `design/illustrations/`.

**How a photo goes live:** export to the slot's aspect ratio, at least 1600 px on the long edge, sRGB,
WebP (quality ~80), and save as `web/public/images/photos/<slot-id>.webp` (`.jpg` also works). No code
change is needed — `<ImageSlot>` picks it up and the "Illustration" tag disappears from the caption.
Add a line to the release log for the shot (file, photographer, release form reference).

To see each slot's id and shot description on the page, open it with `?slots=1` (always shown in
`next dev`). The code registry is `web/components/marketing/slots.ts`; a unit test keeps it in sync with
this file.

## Non-negotiables (from brand v3)

- Real workers, real workplaces in Nepal, natural light, documentary and candid. No stock, no AI-generated
  people, no staged handshakes or "person smiling at phone".
- Correct PPE for the task in every frame (helmet, harness, gloves, glasses, hair cover). If PPE is wrong,
  the shot is not usable.
- Dignity: no poverty framing, no "charity" compositions, no gloom. Tools, hands, materials, work in progress.
- Local identity from people, language, jobs and places — not temples, mountains or prayer flags.
- No text over busy areas of a photo; leave calm space where captions or overlays sit (noted per shot).

## Web shot list

| Slot id | Subject | Place | Light | Framing | Aspect | Consent / release | Usage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hero-hvac-biratnagar` | HVAC technician, own uniform, manifold gauge set in hand | Cold store, Biratnagar | Morning light from the loading bay | Waist-up portrait, slight low angle, subject left of centre | 4:5 | Named portrait release (see template note). Caption may use first name + trade + years only with written consent | Home hero, cut-paper frame (rotated, ~250 px wide on desktop) |
| `hero-electrician-bhaktapur` | Woman electrician, hard hat on, insulated gloves, at an open distribution board | Housing site, Bhaktapur (brick, not temples) | Overcast daylight | Waist-up, 3/4 profile toward the board | 4:5 | Named portrait release | Home hero, cut-paper frame |
| `passport-hands-phone` | A worker's hands holding a budget Android phone with the Skill Passport on screen | Any worksite break area | Soft shade | Close-up, hands + phone fill the frame; screen replaced in post from a real build | 4:5 | Hands-only release (no face) | Home "For workers" panel, small cut-paper frame |
| `mural-wall-patan` | The commissioned KaamSathi mural (see below) with passers-by for scale | Patan / Kathmandu wall | Overcast, no hard shadows on the wall | Straight-on, wall fills 80% of frame; also shoot detail crops of hands/tools | 4:3 | Property-owner permission + artist credit; passers-by unidentifiable or released | Home "For the site" band; crops reused on content pages |
| `career-welder-visor` | Woman welder lifting her visor after a test weld | CTEVT-affiliated training lab | Booth light + window light | Candid, waist-up, bench in foreground | 4:3 | Named portrait release + institute permission | Home career section, cut-paper frame |
| `employer-supervisor-hajiri` | Site supervisor (40s–50s), white hard hat, hi-vis vest, marking hajiri on a phone | Building site, Lalitpur | Morning | Medium shot, scaffold behind, phone visible but screen not legible | 4:3 | Named portrait release + site owner permission | Home "For employers" card (top image, full width of card) |
| `worker-cook-kitchen` | Cook at work, hair cover + apron, karahi on the burner, pressure cooker beside | Hotel kitchen, Thamel | Kitchen light, avoid harsh overhead | Candid, not looking at camera, waist-up | 4:5 | Named portrait release + hotel permission | Home trades section, cut-paper frame |
| `worker-guard-gate` | Woman security guard in uniform and cap writing in the visitor register | Office compound gate, Kathmandu | Late morning | Medium shot, gate bars as background texture | 4:5 | Named portrait release + employer permission | Home trades section, cut-paper frame |
| `partners-training-lab` | Instructor and trainee at a wiring practice board, safety glasses on | Training institute (any district) | Natural window light | Over-the-shoulder two-shot | 4:3 | Releases for both + institute permission (institute named only after a signed partnership) | Home partner ecosystem (small, 160 px) |
| `auth-solar-roof` | Solar installer on a tin roof, harness clipped to an anchor, helmet with chin strap, fixing a panel | Pokhara or Butwal | Clear sky, sun behind camera | Wide-medium, roof slope as diagonal | 4:5 | Named portrait release; safety supervisor present during the shoot | Login side panel, cut-paper frame |
| `notfound-plumber` | Plumber tightening a joint with a pipe wrench under a rooftop water tank | Rooftop, Kathmandu | Daylight | Medium shot | 4:5 | Portrait release | 404 page (illustration is acceptable long-term) |

### Mobile (filled by the mobile agent)

<!-- Mobile slot ids, one row each, same columns as above. Photos go in mobile/assets/photos/<slot-id>.(jpg|webp). -->

| Slot id | Subject | Place | Light | Framing | Aspect | Consent / release | Usage |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Street-art mural commission (`mural-wall-patan`)

**Goal.** One real painted wall that becomes KaamSathi's visual source: photographed for the website, cropped
for social and the app, and a place workers and partners can actually visit.

- **Location.** A permitted wall in Patan or central Kathmandu on a street with foot traffic (workshops,
  hardware shops, a tole with trades) — roughly 6–10 m wide × 3 m high. Written permission from the owner and
  the ward office; a maintenance plan for 2 years.
- **Artists.** Local street artists / collective from the Kathmandu Valley, paid at a fair commission rate
  with credit on the website (name + link) and in captions. Artists keep moral rights; KaamSathi licenses
  reproduction for brand use.
- **Content.**
  - Hand-lettered Devanagari: **काम** (large), with **सीप** and **साथी** as secondary words. Yellow letters
    with an offset coral/ink shadow on a blue ground — the same treatment as `MuralLettering` on the site.
  - Motif: working **hands and real tools** (pipe wrench, pliers, trowel, welding torch, gauge set, ladle),
    shown accurately. A **five-rung rising ladder** (canvas → teal-subtle → teal → blue → yellow) as the
    skill-ladder signature.
  - Fine spray-dot texture in the blue ground; one or two thick brush swooshes in teal or coral.
  - People, if painted, are abstracted (no portraits of real individuals without consent); diverse genders.
- **Do not include.** Temples, mountains, prayer flags, national symbols, the company logo larger than a
  small signature tag, slogans in English.
- **Palette.** Token colours only: blue `#2563EB`, indigo `#4F46E5`, yellow `#FBBF24`, coral `#FF6B6B`,
  teal `#14B8A6`, ink `#0F172A`, white. Paint matched to these values.
- **Deliverables.** Sketch for approval (2 rounds), finished wall, photographer on the final day: straight-on
  full wall (4:3), three detail crops (hands, ladder, lettering — 4:5 and 1:1), a short process series of
  the artists at work (with their release).

## Portrait consent template — notes

Use the legal team's release form (Nepali and English, read aloud where needed). It must cover:

1. Who is photographed, date, place, photographer, and the specific uses (website, app, social, print) and
   duration (e.g. 3 years), with the right to withdraw for future uses at any time.
2. Whether a name, trade, district or years of experience may appear in a caption — each ticked separately.
   Default is **no name**.
3. That the photo will never be used to imply a testimonial, a placement or a pay figure the person did not
   give, and never alongside invented metrics.
4. Payment or thank-you given (no payment is conditional on hiring through KaamSathi), and that
   participation has no effect on the person's Passport, matching or employment.
5. For minors: do not photograph. For employers' premises: separate location permission.
6. Copies: one for the person (photo of the signed form on their phone is fine), one stored with the
   release log, referenced by slot id.
