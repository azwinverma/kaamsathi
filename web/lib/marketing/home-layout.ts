/**
 * Public home layout per the `bolau` flag (pure, unit-tested in home-layout.test.ts).
 *
 * Flag OFF → the employer-first home exactly as it was before Bolau (problem → demo → ladder →
 * workforce → career → trust → trades → audience → proof → pricing).
 * Flag ON  → Bolau leads: Bolau hero with search → Sipalu near you → trades → how it works →
 * safety & trust → become a Sipalu → the B2B story condensed under "For businesses" → pricing.
 */
export const EMPLOYER_HOME = [
  "hero",
  "problem",
  "demo",
  "ladder",
  "workforce",
  "career",
  "trust",
  "trades",
  "audience",
  "proof",
  "pricing",
] as const;

export const BOLAU_HOME = [
  "bolau-hero",
  "sipalu-near",
  "bolau-trades",
  "bolau-how",
  "bolau-trust",
  "become-sipalu",
  "businesses",
  "pricing",
] as const;

export type HomeSection = (typeof EMPLOYER_HOME)[number] | (typeof BOLAU_HOME)[number];

export function homeSections(bolau: boolean): readonly HomeSection[] {
  return bolau ? BOLAU_HOME : EMPLOYER_HOME;
}

/** Message keys (namespace `marketing.meta`) for the home title/description. */
export function homeMetaKeys(bolau: boolean): { title: string; description: string } {
  return bolau
    ? { title: "bolau_title", description: "bolau_description" }
    : { title: "title", description: "description" };
}

export interface NavLink {
  href: string;
  /** Message key (full path). */
  label: string;
}

export interface HeaderNav {
  /** The one strong CTA on the right (always visible, also on phones). Null = the classic header. */
  primary: NavLink | null;
  /** Inline links (desktop) / menu links (phones). */
  links: NavLink[];
  /** Employer links grouped under "For businesses" (empty in the classic header). */
  business: NavLink[];
  /** The classic "Hire verified workers" button next to "Log in" (flag off only). */
  employerCta: boolean;
}

/** Header navigation. `base` is "" on the home page (plain #anchors) and "/" elsewhere. */
export function headerNav(bolau: boolean, base: string): HeaderNav {
  if (!bolau) {
    return {
      primary: null,
      links: [
        { href: `${base}#employers`, label: "marketing.nav.employers" },
        { href: `${base}#workers`, label: "marketing.nav.workers" },
        { href: `${base}#passport`, label: "marketing.nav.passport" },
        { href: "/help", label: "marketing.nav.help" },
      ],
      business: [],
      employerCta: true,
    };
  }
  return {
    primary: { href: "/bolau", label: "bolau.nav.link" },
    links: [
      { href: "/bolau#results", label: "marketing.nav.browse_sipalu" },
      { href: "/sipalu/join", label: "marketing.nav.become_sipalu" },
      { href: "/help", label: "marketing.nav.help" },
    ],
    business: [
      { href: "/login", label: "marketing.nav.biz_hire" },
      { href: `${base}#businesses`, label: "marketing.nav.biz_hajiri" },
      { href: `${base}#pricing`, label: "marketing.nav.biz_pricing" },
      { href: "/developers", label: "marketing.nav.biz_api" },
    ],
    employerCta: false,
  };
}
