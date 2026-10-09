import { render } from "@testing-library/react";

/**
 * Home page branches by the `bolau` flag: every section component is stubbed with a marker so the
 * test checks which sections render, in which order, and the metadata — not their content.
 */
const { flag, stub } = vi.hoisted(() => ({
  flag: { on: false },
  stub: (name: string) => () => <div data-section={name} />,
}));

vi.mock("@/lib/bolau/live", () => ({
  bolauLive: async () => flag.on,
  fetchBolauTrades: async () => [{ code: "electrician", name_en: "Electrician", name_ne: "इलेक्ट्रिसियन", sipalu_count: 2 }],
  fetchBolauSearch: async () => ({ ok: true, data: { count: 0, next: null, previous: null, results: [] } }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
  getLocale: async () => "en",
}));
vi.mock("@/components/signature/slot-briefs", () => ({ enableSlotBriefs: () => undefined }));

vi.mock("@/components/marketing/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("@/components/marketing/site-footer", () => ({ SiteFooter: () => <footer /> }));
vi.mock("@/components/marketing/home-hero", () => ({ HomeHero: stub("hero") }));
vi.mock("@/components/marketing/home-sections", () => ({
  ProblemSection: stub("problem"),
  DemoSection: stub("demo"),
  LadderSection: stub("ladder"),
  WorkforceSection: stub("workforce"),
  CareerSection: stub("career"),
  TrustSection: stub("trust"),
  TradesSection: stub("trades"),
  AudienceSection: stub("audience"),
  ProofSection: stub("proof"),
  PricingBand: stub("pricing"),
  BusinessesSection: stub("businesses"),
}));
vi.mock("@/components/bolau/bolau-hero", () => ({ BolauHero: stub("bolau-hero") }));
vi.mock("@/components/bolau/home-sections", () => ({
  SipaluNearSection: stub("sipalu-near"),
  BolauTradesSection: stub("bolau-trades"),
  BolauTrustSection: stub("bolau-trust"),
  BecomeSipaluSection: stub("become-sipalu"),
}));
vi.mock("@/components/bolau/landing-sections", () => ({ HowBolauWorks: stub("bolau-how") }));

import Home, { generateMetadata } from "./page";

async function sections() {
  const ui = await Home({ searchParams: Promise.resolve({}) });
  const { container } = render(ui);
  return [...container.querySelectorAll("[data-section]")].map((n) => n.getAttribute("data-section"));
}

describe("home page", () => {
  it("flag off: renders the employer-first page, no Bolau sections", async () => {
    flag.on = false;
    expect(await sections()).toEqual([
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
    ]);
    const meta = await generateMetadata();
    expect(meta.title).toEqual({ absolute: "marketing.meta.title" });
    expect(meta.description).toBe("marketing.meta.description");
  });

  it("flag on: Bolau hero first, Sipalu near you, … then businesses and pricing", async () => {
    flag.on = true;
    expect(await sections()).toEqual([
      "bolau-hero",
      "sipalu-near",
      "bolau-trades",
      "bolau-how",
      "bolau-trust",
      "become-sipalu",
      "businesses",
      "pricing",
    ]);
    const meta = await generateMetadata();
    expect(meta.title).toEqual({ absolute: "marketing.meta.bolau_title" });
    expect(meta.openGraph?.description).toBe("marketing.meta.bolau_description");
  });
});
