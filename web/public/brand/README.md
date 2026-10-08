# KaamSathi logo files

The mark is a rounded blue tile with a "K" drawn as a worker's path (round caps) and a coral sun
in the top-right corner. Geometry is defined once in `web/lib/brand-mark.ts` and reused by
`components/brand.tsx` (`Logo`, `LogoMark`), `public/icon.svg`, `app/apple-icon.tsx`,
`app/opengraph-image.tsx` and `app/global-error.tsx`. If you change the mark, change it there and
regenerate these files. Don't edit one file on its own.

| File | What it is | Use on |
| --- | --- | --- |
| `logo-mark.svg` | Full-colour mark (blue `#2563EB`, white K, coral `#FF6B6B` sun) | App icons, favicons, avatars, small UI |
| `logo-horizontal.svg` | Full-colour mark + "KaamSathi" wordmark (Inter SemiBold, outlined, ink `#0F172A`) | Light backgrounds: documents, website header, partner decks |
| `logo-mono-dark.svg` | Single-colour lockup in ink `#0F172A`. The K and sun are cut out of the tile | Light backgrounds where colour isn't available: print, fax, stamps, black-and-white payslips, letterheads |
| `logo-mono-light.svg` | Single-colour lockup in white. The K and sun are cut out | Dark or brand-blue backgrounds, photos with a calm flat area, embossing/foil |
| `logo-mark-mono-dark.svg` / `logo-mark-mono-light.svg` | Mark only, single colour | Same as above, small square spaces |

The wordmark is outlined (paths), so these files render the same without Inter installed.

## Clear space

Keep empty space around the logo equal to **half the mark's height** on every side. For a 32px mark,
that's 16px. Nothing (text, edges, other logos) goes inside that zone.

## Minimum size

- Mark: **16px** for favicons only. **24px** is the smallest size for UI, where the sun must read as a
  separate dot. Below 16px, don't use the mark.
- Horizontal lockup: **24px tall** minimum (the wordmark gets too thin to read below that). Use the mark
  alone when you have less space.
- Print: mark 6mm, lockup 8mm tall.

The 16/24/32px renders were checked at 1× device pixels: the sun stays separate from the K's arm,
and the K's three strokes stay distinct.

## Don't

- **Don't recolour.** Only the full-colour version or a single colour (ink or white) is allowed.
  No gradients, no coral or yellow tiles, no outlines, and no colour on just the sun in the mono files.
- **Don't place it on busy photos.** If there's no calm, even area with strong contrast, use
  a solid ink, white or brand-blue panel behind it.
- Don't stretch, skew, rotate, add shadows or glow, or redraw the wordmark in another font.
- Don't move the sun or rebuild the K. It is part of the mark, not decoration.
- Don't use the mark in place of a government seal, or next to one in a way that suggests endorsement.
- Don't put the full-colour mark on brand blue (the tile disappears). Use `logo-mono-light.svg` there.
