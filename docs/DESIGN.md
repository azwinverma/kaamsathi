# KaamSathi — Design system

Clean, calm, trustworthy. Lots of white space, one strong blue, crimson used
sparingly as an accent (nod to the Nepal flag), numbers in tabular figures.
Same tokens on web (CSS variables / Tailwind theme) and mobile (Flutter ThemeData).

## Typography
- Latin UI: **Inter** (400, 500, 600, 700). Enable `font-feature-settings: "cv11", "ss01", "tnum"` for tables/money.
- Devanagari: **Mukta** (400, 500, 600, 700) — the most familiar web Devanagari face in Nepal.
- Stack: `Inter, Mukta, ui-sans-serif, system-ui, sans-serif`. Flutter: `GoogleFonts.inter` with `fontFamilyFallback: ['Mukta']`.
- When locale is `ne`, increase line-height by ~10% (Devanagari has tall matras).
- Headings: weight 600, letter-spacing -0.02em (Latin only; 0 for Nepali).

| token | size/line-height (px) | use |
| --- | --- | --- |
| text-xs | 12/16 | captions, table meta |
| text-sm | 14/20 | body in dense UI, tables |
| text-base | 16/24 | body |
| text-lg | 18/28 | card titles |
| text-xl | 20/28 | section titles |
| text-2xl | 24/32 | page titles |
| text-3xl | 30/38 | marketing h2 |
| text-5xl | 48/56 | marketing hero |

## Colour (light)
| token | hex | use |
| --- | --- | --- |
| primary-50 | #EEF3FF | selected rows, subtle fills |
| primary-100 | #DCE6FF | |
| primary-200 | #B9CCFF | |
| primary-300 | #8AA8FA | |
| primary-400 | #5B80F0 | |
| primary-500 | #3A5FE0 | focus ring |
| primary-600 | #2647C4 | **brand / primary buttons / links** |
| primary-700 | #1F399D | hover |
| primary-800 | #1D327D | |
| primary-900 | #1B2C63 | dark hero bg |
| accent-50 | #FFF0F3 | |
| accent-500 | #DC2B4B | accent marks, badges "New", hero underline |
| accent-600 | #C21D3D | |
| neutral-0 | #FFFFFF | surface |
| neutral-25 | #FBFBFC | app background |
| neutral-50 | #F6F7F9 | sidebar, table header |
| neutral-100 | #EDEFF3 | hover rows |
| neutral-200 | #DDE1E8 | borders |
| neutral-300 | #C4CAD4 | input borders |
| neutral-400 | #959DAB | placeholders and decorative only — never body text (use #687080 `fg-subtle` for small text) |
| neutral-500 | #5F6776 | secondary text (darkened from #6B7383 for WCAG AA 4.5:1) |
| neutral-600 | #4D5465 | |
| neutral-700 | #373D4C | body text |
| neutral-900 | #161A26 | headings |
| success-50/600 | #E8F7F0 / #0F7352 | present, paid, verified (AA on the 50 tint) |
| warning-50/600 | #FFF4E5 / #9A5107 | half day, pending (AA on the 50 tint) |
| danger-50/600 | #FDECEC / #C8302B | absent, errors |

Dark mode: background #0D1018, surface #161A26, border #2A3040, text #E6E9EF,
secondary text #9AA3B2, primary-400 for links/buttons.

## Shape, space, elevation
- 4 px grid. Page padding 24 (desktop) / 16 (mobile).
- Radius: sm 6, md 8 (inputs, buttons), lg 12 (cards), xl 16 (modals, hero cards), full (pills).
- Borders 1px neutral-200; cards use border + `shadow-sm` (0 1px 2px rgba(16,24,40,.06)).
- Focus: 2px ring primary-500, 2px offset. Never remove focus outlines.
- Touch targets ≥ 44px on mobile.

## Components (both platforms)
- Buttons: primary (filled primary-600), secondary (white + border), ghost, danger. Height 40 (web) / 48 (mobile).
- Status badges: pill, 12px/600, tinted bg-50 + text-600 of the status colour.
- Tables: sticky header neutral-50, 14px rows of 52px, money right-aligned in tabular nums.
- Stat cards: label (text-sm neutral-500), value (text-2xl 600 neutral-900), delta badge.
- Empty states: simple line icon, one sentence, one primary action.
- Icons: Lucide (web: lucide-react; Flutter: lucide_icons), 20px, stroke 1.75.

## Formatting rules (Nepal)
- Money: `Rs. 1,23,456` (Indian/Nepali lakh grouping, `en-IN`), no decimals unless non-zero paisa. Nepali locale: `रु. १,२३,४५६` (Devanagari numerals).
- Dates: BS first, AD secondary — `21 Ashwin 2083` with `7 Oct 2026` in muted text/tooltip. Nepali: `२१ असोज २०८३`.
- Phone: `98XXXXXXXX` (10 digits, starts 97/98), displayed `+977 98X-XXX-XXXX`.
- Time: 12-hour with `AM/PM` in English, `बिहान/दिउँसो/बेलुका` not needed — use `९:०० AM` style digits in Nepali.
