# KaamSathi — Design system (foundations v2)

Source of truth: **`design/tokens.json`** (v2.0.0). Mandatory reading: `docs/BRAND_GUIDELINES_V3_HUMAN_CRAFTED.md`
and `docs/HUMAN_CRAFTED_UI_GUARDRAILS.json`; background in `docs/BRAND_GUIDELINES_V2.md`.
Web implements the tokens as CSS variables in `web/app/globals.css` (`--ks-*`, switched for light/dark) mapped
to Tailwind utilities through `@theme`. Flutter maps the same tokens to `ThemeData` + a `ThemeExtension`.

Feel: optimistic, modern, trustworthy. Neutral surfaces carry the product, Horizon Blue carries action,
accents (coral, yellow, teal) add warmth in small doses. Numbers use tabular figures.

> **What changed (Oct 2026).** The crimson accent and the older `#2647C4` blue are retired. Devanagari moved
> from **Mukta → Noto Sans Devanagari**. Status colours now come in pairs: the raw brand hue (for icons, dots,
> chart marks) and an AA-safe `*.text` variant for text. The raw hues **fail as text**: success `#16A34A`
> (3.30:1 on white), warning `#D97706` (3.19:1), info `#0284C7` (4.10:1). Use `text-success` / `text-warning` /
> `text-info`, which already point at the `*.text` values. Tailwind's default palette is **disabled**:
> `bg-blue-600`, `text-emerald-700`, `primary-800` and similar classes no longer generate CSS. Use semantic tokens only.

## Hard rules
1. **Do not hard-code colours** in feature code. Use the semantic utilities below. The only exceptions are
   `ImageResponse` images (OG, apple-icon), `global-error.tsx` (renders without our CSS) and validated
   data-viz ramps. Those use literal token hex values.
2. **Status is never colour-only.** Pair the colour with an icon and a label. `StatusBadge`, `VerificationBadge`
   and `WorkHistoryStatusBadge` add a tone icon automatically (`TONE_ICON` in `components/ui/badge.tsx`).
   Notices, form errors and toasts always show an icon.
3. **Status text goes on its soft background.** Write `bg-success-soft text-success`, never a raw hue as text.
4. **Text on an accent fill** (coral, yellow, teal) uses `text-on-accent` (`#0F172A`), never white.
5. **70 / 20 / 10.** About 70% neutral surfaces, 20% primary blue and its tints, 10% accents. Use at most 3 accents
   per screen, and at most 2 vibrant accents per marketing section.
6. **Gradients only on** marketing hero and campaign strips, onboarding, and milestone celebrations. Never put them
   behind tables, forms or long text. Never use them as gradient text, on every card, or animated.
7. Focus is always visible: 2px `ring` outline with a 2px offset. Touch targets are at least 44px.

## Colour tokens

Contrast ratios are WCAG 2.x. They were computed for the pairs used in the UI, and axe runs in E2E.
"surface" = `#FFFFFF` light / `#0F172A` dark. "muted" = `#F1F5F9` / `#1E293B`.

### Neutrals & text
| Tailwind / CSS var | tokens.json | Light | Dark | Contrast (light · dark) |
| --- | --- | --- | --- | --- |
| `bg` / `--ks-bg` | surface.canvas | `#F8FAFC` | `#020617` | page background |
| `surface` | surface.default | `#FFFFFF` | `#0F172A` | cards, inputs |
| `surface-muted` | surface.muted | `#F1F5F9` | `#1E293B` | table header, sidebar |
| `surface-hover` | *(derived)* | `#E9EEF4` | `#273449` | row hover |
| `border` | border.default | `#E2E8F0` | `#1E293B` | hairlines |
| `border-strong` | border.strong | `#CBD5E1` | `#334155` | input borders |
| `fg` | text.primary | `#0F172A` | `#F1F5F9` | 17.85 · 16.30 on surface |
| `fg-body` | text.secondary | `#334155` | `#CBD5E1` | 10.35 · 12.02 |
| `fg-muted` | text.muted | `#5A6679` | `#94A3B8` | 5.81 / 5.31 muted / 4.98 hover · 6.96 / 5.71 / 4.89 |
| `fg-subtle` | = text.muted | `#5A6679` | `#94A3B8` | alias kept for existing code (placeholders, meta) |
| `fg-inverse` | text.inverse | `#FFFFFF` | `#0F172A` | text on solid status fills |

### Action / brand
| Tailwind | tokens.json | Light | Dark | Contrast |
| --- | --- | --- | --- | --- |
| `brand` (fills, borders, icons) | action.primary | `#2563EB` | `#3B82F6` | white on it 5.17 · `#0B1220` on it 5.09 |
| `brand-hover` | action.primary.hover | `#1D4ED8` | `#60A5FA` | white 6.70 · 7.36 |
| `brand-fg` | action.primary.fg | `#FFFFFF` | `#0B1220` | |
| `brand-text` (links, text) | action.primary | `#2563EB` | `#60A5FA`* | 5.17 surface / 4.72 muted · 5.75 on muted |
| `brand-subtle` | action.primary.subtle | `#EFF6FF` | `#172554` | |
| `brand-subtle-hover` | *(derived)* | `#DBEAFE` | `#1E3A8A` | subtle-fg on it 5.49 · 7.29 |
| `brand-subtle-fg` | action.primary.subtle.fg | `#1D4ED8` | `#BFDBFE` | 6.16 · 10.34 on subtle |
| `indigo` / `indigo-subtle` | brand.indigo(.subtle) | `#4F46E5` / `#EEF2FF` | `#A5B4FC` / indigo 20% | 5.62 · 6.38 |
| `ring` | focus.ring | `#2563EB` | `#3B82F6` | |

\* In dark mode, `#3B82F6` is only 3.98:1 on `surface.muted`. Text and links therefore use `brand-text`, which is `#60A5FA` in dark mode.
`text-brand` was renamed to `text-brand-text` throughout.

### Accents (fills / illustration / highlights)
| Tailwind | tokens.json | Light | Dark | Notes |
| --- | --- | --- | --- | --- |
| `coral` | accent.coral | `#FF6B6B` | same | fill only (2.78:1 on white). `on-accent` text on it 6.43 |
| `coral-text` (= legacy `accent`) | accent.coral.text | `#C2410C` | `#FF8A8A` | 5.18 surface, 4.71 on subtle · 5.32 |
| `coral-subtle` (= legacy `accent-subtle`) | accent.coral.subtle | `#FFF1F1` | coral 14% | |
| `yellow` / `yellow-subtle` | accent.yellow(.subtle) | `#FBBF24` / `#FEF9E7` | same / 14% | fill only. `on-accent` text on it 10.69 |
| `teal` | accent.teal | `#14B8A6` | same | fill only (2.49:1). `on-accent` text on it 7.17 |
| `teal-text` / `teal-subtle` | accent.teal.text(.subtle) | `#0F766E` / `#F0FDFA` | `#2DD4BF` / 14% | 5.25 · 6.21 |
| `on-accent` | accent.onFill | `#0F172A` | `#0F172A` | the only text colour on accent fills |

### Status — text on soft (AA) + raw hue for icons
| Status | Text (`text-*`) | Soft bg (`bg-*-soft` = `bg-*-subtle`) | Raw hue (`*-hue`, icons/marks only) | Text/soft contrast (light · dark) |
| --- | --- | --- | --- | --- |
| success | `#15803D` · `#4ADE80` | `#DCFCE7` · green 16% | `#16A34A` (3.30 on white, **fails as text**) | 4.57 · 6.78 |
| warning | `#A14A07` · `#FBBF24` | `#FEF3C7` · amber 18% | `#D97706` (3.19, **fails**) | 5.39 · 6.96 |
| danger (error) | `#B91C1C` · `#F87171` | `#FEE2E2` · red 18% | `#DC2626` (4.83) | 5.30 · 4.79 |
| info | `#0369A1` · `#38BDF8` | `#E0F2FE` · sky 18% | `#0284C7` (4.10, **fails**) | 5.17 · 5.56 |
| verified | `#0F766E` · `#2DD4BF` | `#CCFBF1` · teal 24% | `#0F766E` / `#14B8A6` | 4.86 · 6.37 |

Solid status fills (attendance cells, the notification count) use `bg-success text-fg-inverse`: white on `#15803D` is 5.02,
white on `#A14A07` is 6.00 and white on `#B91C1C` is 6.47. In dark mode `#0F172A` on the dark text tones is ≥ 6.45.
`danger-on-inverse` (`#F87171` light / `#B91C1C` dark) is for negative numbers inside inverse tooltips (`bg-fg text-surface`).

### Fixed (theme-independent) tokens
| Tailwind | Value | Use |
| --- | --- | --- |
| `hero` / `hero-fg` / `hero-muted` | `#172554` / `#FFFFFF` / `#BFDBFE` | deep brand panels: landing hero, auth side panel, passport header (14.69 / 10.34) |
| `hero-cta-fg` / `hero-cta-hover` | `#1D4ED8` / `#EFF6FF` | white CTA on a hero panel (6.70) |
| `scrim` | `#0F172A` | dialog overlay (`bg-scrim/50`) |
| `white` / `black` | | overlays on hero panels (`bg-white/10`), QR code backgrounds |

Hero panels intentionally stay solid deep blue for now. Art direction comes later, and the hero gradient can replace them then.

### Gradients (CSS vars + utilities)
| Var / utility | Value | Allowed on |
| --- | --- | --- |
| `--ks-gradient-hero` / `bg-hero-gradient` | `135deg, #2563EB 0%, #4F46E5 55%, #7C3AED 100%` | marketing hero, campaign strip, CTA band, OG image. White text on each stop ≥ 5.17 |
| `--ks-gradient-joy` / `bg-joy-gradient` | `135deg, #FF6B6B 0%, #F59E0B 100%` | milestone celebrations (text `on-accent`) |
| `--ks-gradient-skill` / `bg-skill-gradient` | `135deg, #14B8A6 0%, #2563EB 100%` | onboarding, skill-growth moments |

### Data-viz palettes (kept as validated literals)
`components/insights/charts.tsx` series 2 (`#EB6834` / `#D95926`) and the `components/kpis/scale.ts` sequential blue ramp
were validated as chart palettes (distinct in both themes, CVD-safe against `brand`). They stay as arbitrary values
until a chart token set is added to `tokens.json`.

## Typography
- Latin: **Inter** (variable, 400–800). Devanagari: **Noto Sans Devanagari** (variable). Both load via `next/font/google`
  in `web/app/layout.tsx` (`subsets: latin + devanagari`, `display: swap`, CSS vars `--font-inter` and
  `--font-noto-devanagari`). Stack: `Inter, Noto Sans Devanagari, ui-sans-serif, system-ui, sans-serif`.
  The `font-nepali` utility puts Noto first. Mukta is no longer used. Flutter uses `fontFamilyFallback: ['Noto Sans Devanagari']`.
- Weights: 400 body · 500 labels/controls · 600 card titles/nav · 700 page titles/hero · 800 limited marketing.
- Body text is never below 14px for primary information. Use `tabular` for money and tables.
- **Nepali (`html[lang="ne"]`)**: every Tailwind line-height step is multiplied by **1.1** (`tokens.type.devanagariLineHeightBoost`),
  body line-height is 1.65, and headings get no negative tracking.

| Tailwind | size / line-height (px) | tokens.json |
| --- | --- | --- |
| text-xs | 12/16 | caption |
| text-sm | 14/20 | bodyS: dense UI, tables |
| text-base | 16/24 | body |
| text-lg | 18/28 | bodyL, card titles |
| text-xl | 20/28 | h4 |
| text-2xl | 24/32 | h3, page titles |
| text-3xl | 30/38 | h2 |
| text-4xl | 36/44 | h1 |
| text-5xl | 48/56 | display |
| text-6xl | 56/64 | displayXl |

## Shape
| Role | Utility | Radius |
| --- | --- | --- |
| Controls: buttons, inputs, selects, OTP, notices | `rounded-control` (= `rounded-md`) | 12px |
| Standard cards | `rounded-card` (= `rounded-lg`) | 16px |
| Dense data cards, tables, stat cards, menus, popovers | `rounded-dense` | 10px |
| Dialogs, sheets | `rounded-sheet` (= `rounded-xl`) | 22px |
| Marketing tiles | `rounded-2xl` | 24px |
| Tiny marks, menu items, skeleton bars | `rounded-sm` | 6px |
| Chips, status badges, avatars, switches **only** | `rounded-pill` / `rounded-full` | 999px |

Do not make ordinary UI into pills. Spacing follows the 4/8 grid: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96`.

## Elevation
Use borders more often than shadows.
| Utility | Value | Use |
| --- | --- | --- |
| `shadow-sm` | `0 1px 2px rgba(15,23,42,.06)` | controls, table containers (hairline) |
| `shadow-card` (= `shadow-md`) | `0 1px 2px rgba(15,23,42,.06), 0 6px 18px rgba(15,23,42,.06)` | cards |
| `shadow-floating` (= `shadow-lg`) | `0 12px 32px rgba(15,23,42,.12)` | dialogs, popovers, menus, tooltips |

## Motion
| Token | Duration | Use |
| --- | --- | --- |
| `--ks-motion-control` | 150ms | hover/press, colour transitions (Tailwind default `transition-*` duration), fade-in |
| `--ks-motion-base` | 200ms | popovers, menus, dialogs (`animate-pop-in`) |
| `--ks-motion-slow` | 280ms | sheets (`animate-slide-in-*`) |
| `--ks-motion-content` | 360ms | content entrances, progress completion |

Easing: `cubic-bezier(0.2, 0, 0, 1)` (`--ks-ease`, Tailwind `ease-standard` and the default transition timing).
Motion should explain state. Do not use continuous animation on dashboards or infinite gradients.
`@media (prefers-reduced-motion: reduce)` sets the motion tokens to 0 and cuts all transitions and animations to about 0ms.
It also stops the skeleton shimmer. Only the loading spinner keeps turning.

## Components (both platforms)
- Buttons: primary (`bg-brand text-brand-fg`), secondary (surface + border), ghost, subtle, danger (`bg-danger text-fg-inverse`),
  accent (`bg-coral text-on-accent`). Height 40 web (44 on small screens) / 48 mobile. Radius 12.
- Status badges: pill, 12px/600, `bg-<status>-soft text-<status>` + tone icon. Tones: neutral, brand, success, warning,
  danger, info, verified, accent (coral). `verified` uses the teal verified tokens.
- Notices / alerts: `rounded-control`, `border-<status>/30 bg-<status>-soft text-<status>`, leading icon, title + body in `fg-body`.
- Toasts (sonner, `richColors`): the toaster's CSS variables are mapped to the same soft/text pairs in `globals.css`. Sonner shows the type icon.
- Tables: `rounded-dense` container, sticky `surface-muted` header, 52px rows, money right-aligned in tabular numerals.
- Stat cards: dense radius; label `text-sm fg-muted`, value `text-2xl 600 fg`, tone icon tile on the soft background.
- Tooltips: inverse (`bg-fg text-surface`), `shadow-floating`.
- Avatars (initials): brand / coral / teal / indigo / neutral subtle pairs.
- Empty states: simple line icon, one sentence, one primary action.
- Icons: Lucide, 20px (16 in dense UI), stroke 1.75. No decorative sparkle icons.

## Formatting rules (Nepal)
- Money: `Rs. 1,23,456` (Indian/Nepali lakh grouping, `en-IN`), no decimals unless non-zero paisa. Nepali locale: `रु. १,२३,४५६` (Devanagari numerals).
- Dates: BS first, AD secondary — `21 Ashwin 2083` with `7 Oct 2026` in muted text/tooltip. Nepali: `२१ असोज २०८३`.
- Phone: `98XXXXXXXX` (10 digits, starts 97/98), displayed `+977 98X-XXX-XXXX`.
- Time: 12-hour with `AM/PM` in English, `बिहान/दिउँसो/बेलुका` not needed — use `९:०० AM` style digits in Nepali.
