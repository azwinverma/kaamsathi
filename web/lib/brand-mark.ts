/**
 * KaamSathi mark geometry (32×32 grid): a rounded tile, a "K" drawn as a worker's path with
 * round caps, and a coral sun top-right. One source for components/brand.tsx, app/apple-icon.tsx,
 * public/icon.svg and public/brand/*.svg (see public/brand/README.md). Tuned so the sun stays
 * separate from the K's arm at 16px.
 */
export const MARK = {
  radius: 7,
  k: "M10 7.5v17M10 17.5l8-8M14 14l7 10.5",
  strokeWidth: 3.6,
  sun: { cx: 24.25, cy: 7.75, r: 2.75 },
  /** Literal token hex (ImageResponse / static SVG only; components use theme classes). */
  hex: { tile: "#2563EB", k: "#FFFFFF", sun: "#FF6B6B", ink: "#0F172A" },
} as const;
