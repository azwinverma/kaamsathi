/**
 * Open Graph card copy (app/opengraph-image.tsx). The words live in the message catalogues
 * (`marketing.og.*`, en + ne). The card renderer (next/og → Satori) cannot shape Devanagari —
 * vowel signs land on the wrong side and conjuncts fall apart — so the Nepali lines are drawn
 * once by a real browser (`pnpm og:text`, scripts/render-og-text.mjs, Noto Sans Devanagari Bold
 * from the repo) into transparent PNGs under assets/og/, listed in assets/og/manifest.json with
 * the exact text and CSS size of each. lib/marketing/og.test.ts fails when a catalogue line no
 * longer matches its image.
 */
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";

export type OgVariant = "bolau" | "employer";
export type OgLine = "title" | "body" | "foot";
export type OgLocale = "en" | "ne";

export const OG_LINES: readonly OgLine[] = ["title", "body", "foot"];

/** Which card: Bolau leads while the `bolau` flag is on, else the employer line. */
export function ogVariant(bolau: boolean): OgVariant {
  return bolau ? "bolau" : "employer";
}

const CATALOGUE = { en: en.marketing.og, ne: ne.marketing.og } as const;

/** The card's three lines in one language. */
export function ogCopy(bolau: boolean, locale: OgLocale = "en"): Record<OgLine, string> {
  const c = CATALOGUE[locale][ogVariant(bolau)];
  return { title: c.title, body: c.body, foot: c.foot };
}

/** The brand word in one language ("KaamSathi" / "कामसाथी"). */
export function ogBrand(locale: OgLocale): string {
  return CATALOGUE[locale].brand;
}

/** Every Nepali string the card can show, keyed as in assets/og/manifest.json. */
export function ogNepaliStrings(): Record<string, string> {
  const out: Record<string, string> = { brand: ogBrand("ne") };
  for (const v of ["bolau", "employer"] as const) {
    const copy = ogCopy(v === "bolau", "ne");
    for (const line of OG_LINES) out[`${v}.${line}`] = copy[line];
  }
  return out;
}
