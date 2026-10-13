#!/usr/bin/env node
/**
 * Draws the Nepali lines of the Open Graph card (lib/marketing/og.ts) into transparent PNGs.
 *
 * Why: next/og (Satori) has no complex-script shaping, so Devanagari comes out wrong (ि after the
 * consonant, broken conjuncts such as प्र / क्ष). A real browser shapes it correctly, so each line is
 * rendered once by Playwright's Chromium with Noto Sans Devanagari Bold read from this repo (no
 * network) and committed under assets/og/. The card embeds them as images.
 *
 *   pnpm og:text            → (re)write assets/og/*.png + assets/og/manifest.json
 *
 * Re-run after changing any `marketing.og.*` Nepali string; `lib/marketing/og.test.ts` fails until
 * the images match the catalogue again. Needs `pnpm e2e:install` (Chromium) once.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(web, "assets", "og");
const FONT = join(web, "..", "mobile", "assets", "fonts", "NotoSansDevanagari-Bold.ttf");
const SCALE = 2;

// Keep in step with lib/marketing/og.ts (OG_TEXT_STYLE and ogNepaliStrings).
const STYLE = {
  brand: { fontSize: 64, maxWidth: 600, lineHeight: 1.3 },
  title: { fontSize: 64, maxWidth: 1040, lineHeight: 1.35 },
  body: { fontSize: 32, maxWidth: 1040, lineHeight: 1.45 },
  foot: { fontSize: 26, maxWidth: 1000, lineHeight: 1.4 },
};
const og = JSON.parse(readFileSync(join(web, "messages", "ne.json"), "utf8")).marketing.og;
const strings = { brand: og.brand };
for (const v of ["bolau", "employer"])
  for (const l of ["title", "body", "foot"]) strings[`${v}.${l}`] = og[v][l];

const font = readFileSync(FONT).toString("base64");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: SCALE,
  viewport: { width: 1200, height: 630 },
});
const manifest = { font: "NotoSansDevanagari-Bold.ttf", scale: SCALE, items: {} };
for (const [key, text] of Object.entries(strings)) {
  const s = STYLE[key.split(".").pop()];
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: "NSD"; src: url(data:font/ttf;base64,${font}) format("truetype"); font-weight: 700; }
    html, body { margin: 0; background: transparent; }
    #t { display: inline-block; max-width: ${s.maxWidth}px; font: 700 ${s.fontSize}px/${s.lineHeight} "NSD";
         color: #ffffff; white-space: pre-wrap; -webkit-font-smoothing: antialiased; }
  </style></head><body lang="ne"><span id="t"></span></body></html>`);
  await page.locator("#t").evaluate((el, value) => (el.textContent = value), text);
  await page.evaluate(() => document.fonts.ready);
  const el = page.locator("#t");
  const box = await el.boundingBox();
  const file = `ne-${key.replace(".", "-")}.png`;
  await el.screenshot({ path: join(outDir, file), omitBackground: true });
  manifest.items[key] = {
    file,
    text,
    sha1: createHash("sha1").update(text).digest("hex").slice(0, 12),
    width: Math.ceil(box.width),
    height: Math.ceil(box.height),
  };
  console.log(`  ${file}  ${Math.ceil(box.width)}×${Math.ceil(box.height)}  ${text}`);
}
await browser.close();
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`og text: ${Object.keys(strings).length} images → assets/og/`);
