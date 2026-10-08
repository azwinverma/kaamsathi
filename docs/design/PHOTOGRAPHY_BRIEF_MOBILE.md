# KaamSathi mobile app: photography brief (photo slots)

Companion to `docs/design/PHOTOGRAPHY_BRIEF.md` (website) and `docs/design/DIRECTION.md`
(imagery policy: commission + slots). This file lists every art-directed photo slot in the
Flutter worker app, so the photographer, the people we photograph and the developers all work
from the same list.

## How slots work in the app

- Each slot is a `PhotoSlot` in `mobile/lib/core/widgets/signature/image_slot.dart`, with a fixed
  aspect ratio, an illustrated fallback and required alt text (English and Nepali in the ARB files).
- Delivered photo: `mobile/assets/photos/<slot-id>.webp`. The folder is already bundled
  (`pubspec.yaml`); once the file is there the app shows it in place of the illustration. No
  code change.
- Every mobile slot sits in a **cut-paper frame**: a white border about 5 px wide, turned 4 to 5
  degrees, with a strip of coloured tape at the top. Keep the subject well inside the frame. The
  outer 6% of each edge is covered by the border.
- Export: WebP, quality 80, sRGB, longest edge 960 px (the app shows them at 64 to 96 dp wide, so
  960 px is enough at 3x density with room to crop). Keep files under 120 KB.

## Rules for every shot

- Real workers in Nepal, photographed at their real workplace, with **signed consent** for use in
  the app (and the website if the same photo is reused). Keep the consent form with the release
  log. No stock photos, AI-generated people or composites.
- Documentary and candid: natural light, work in progress, real tools, correct PPE for the task
  (hard hat and boots on site, apron and cap in kitchens, gloves where the trade needs them).
- People are doing their trade, not posing with a phone. Do not use handshakes, thumbs-up or
  staged smiles.
- Local identity comes from people, language, tools and places, not temples, mountains or
  prayer flags.
- Show a range of workers: women and men, different ages (including over 45), different
  communities and regions. A worker who is visibly a beginner is fine and encouraged.
- No legible ID cards, citizenship numbers, phone numbers or payslip amounts in frame.
- Each slot must still read at about 72 dp wide. Choose one clear subject and a simple
  background.

## Slots

| Slot id | Where in the app | Aspect | Alt text (en / ne) | Illustrated fallback |
| --- | --- | --- | --- | --- |
| `mobile-learn-workshop` | Learn tab, header, cut-paper frame with teal tape, top right | 4:5 portrait | "Training at a workshop bench" / "कार्यशालामा तालिम" | Workbench with a hard hat and a wrench |
| `mobile-career-step` | Home, "Grow your earnings" card, small frame with coral tape | 1:1 square | "A worker moving up a trade level" / "पेसामा माथिल्लो तहमा पुगेका कामदार" | Five rising steps with a flag (echoes the skill ladder) |
| `mobile-welcome-hajiri` | First-run language screen, next to the logo, frame with yellow tape | 4:5 portrait | "A worker scanning the hajiri QR code" (shown in both languages before a language is chosen) | Phone with a QR code beside a hard hat |

### `mobile-learn-workshop`: training at a workshop bench

- **Scene:** a short practical session at a CTEVT or NSTB-style workshop, or at an employer's
  training corner, in Kathmandu valley, Butwal or Biratnagar. A trainer shows one trainee a task
  at the bench, such as wiring a distribution board, fitting a pipe joint or checking a weld.
- **Framing:** waist-up, the trainee in front and the trainer partly in frame. Hands and the tool
  are the focal point and sit in the middle third. Leave plain space above their heads, because
  the tape covers the top centre.
- **Light:** workshop daylight from a window or door. No flash.
- **Avoid:** classroom rows facing a whiteboard, certificates held up to the camera, laptops.

### `mobile-career-step`: a worker who moved up a level

- **Scene:** a worker who has recently moved up in their trade, for example a helper who is now a
  mason, or a commis now working as cook, doing the more skilled part of the job. Examples are
  setting a level line on a wall, plating at the pass, or terminating a cable on a solar install
  in Pokhara.
- **Framing:** square and tight: head, shoulders and hands at work. The subject faces into the
  frame. The image is shown about 64 dp wide, so details must be bold.
- **Story check:** the photo should hint at progress through the task and the tools, not a
  trophy or certificate.
- **Avoid:** arms crossed in front of a building, pointing at a chart.

### `mobile-welcome-hajiri`: scanning the hajiri QR

- **Scene:** the start of a shift at a real site (hotel back entrance, construction site gate or
  factory floor). A worker in work clothes holds an Android phone up to the printed site QR code
  on a post or noticeboard. A supervisor can be out of focus in the background.
- **Framing:** portrait, phone and QR in the upper half. The worker's face is in three-quarter
  profile, natural and mid-action. The phone screen does not need to be legible. Do not fake a UI
  on it.
- **Light:** early morning (shifts start around 6:00). Warm low sun is good.
- **Avoid:** close-ups of a phone screen with an invented app, smiling at the camera, gloves
  and PPE missing on a construction site.

## Not slots (do not commission)

- **Worker's own photo** (Skill Passport card, Profile header): the worker's verified profile
  photo from their KaamSathi record, shown in a cut-paper frame. If there is none, the worker's
  initials are shown on plain paper. Never replace it with a sample or stock face.
- **Empty states** use the in-app illustration kit (`IllustratedIcon`, `KsIllustration`), not
  photos.
- **Supervisor mode** (documentary ledger) uses no photography or mural elements. The small
  brand mark is the only brand element there.

## Delivery checklist

1. File named exactly `<slot-id>.webp` and placed in `mobile/assets/photos/`.
2. Consent form signed, filed and listed in the release log with the slot id and the worker's
   name. The worker is told which screen the photo appears on.
3. Checked at 360 px phone width in English and Nepali, with the frame border and tape not
   covering the subject.
4. Alt text still matches the photo. If not, update `slotLearnWorkshopAlt` /
   `slotCareerStepAlt` in both ARB files, or the language-screen label.
