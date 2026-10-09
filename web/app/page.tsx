import type { Metadata } from "next";
import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { HomeHero } from "@/components/marketing/home-hero";
import {
  AudienceSection,
  BusinessesSection,
  CareerSection,
  DemoSection,
  LadderSection,
  PricingBand,
  ProblemSection,
  ProofSection,
  TradesSection,
  TrustSection,
  WorkforceSection,
} from "@/components/marketing/home-sections";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { enableSlotBriefs } from "@/components/signature/slot-briefs";
import { BolauHero } from "@/components/bolau/bolau-hero";
import {
  BecomeSipaluSection,
  BolauTradesSection,
  BolauTrustSection,
  SipaluNearSection,
} from "@/components/bolau/home-sections";
import { HowBolauWorks } from "@/components/bolau/landing-sections";
import { bolauLive, fetchBolauSearch, fetchBolauTrades } from "@/lib/bolau/live";
import { orderTrades } from "@/lib/bolau/trades";
import { homeMetaKeys, homeSections, type HomeSection } from "@/lib/marketing/home-layout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.meta");
  const keys = homeMetaKeys(await bolauLive());
  const title = t(keys.title);
  const description = t(keys.description);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, url: "/" },
  };
}

type Props = { searchParams: Promise<{ slots?: string | string[] }> };

/** Number of real Sipalu cards in "Sipalu near you". */
const NEAR_COUNT = 6;

/**
 * Public home (B · street mural), two layouts by the `bolau` flag (lib/marketing/home-layout.ts):
 *
 * - Bolau ON — Bolau leads: BolauHero (shared with /bolau: MuralLettering बोलाउ, BrushStroke,
 *   CutPaperFrame + ImageSlot, BolauSearchForm) → SipaluNearSection (real SipaluCard rows from
 *   /bolau/search) → BolauTradesSection (/bolau/trades) → HowBolauWorks → BolauTrustSection →
 *   BecomeSipaluSection → BusinessesSection (RosterStrip) → PricingBand.
 * - Bolau OFF — the employer-first narrative per docs/BRAND_GUIDELINES_V3_HUMAN_CRAFTED.md "Public
 *   website", unchanged: problem → demo → ladder → workforce → career → trust → trades → audience
 *   → proof → pricing.
 */
export default async function Home({ searchParams }: Props) {
  enableSlotBriefs((await searchParams).slots);
  const t = await getTranslations();
  const bolau = await bolauLive();
  const sections = homeSections(bolau);

  let render: Renderers = EMPLOYER_RENDER;
  if (bolau) {
    const locale = (await getLocale()) === "ne" ? "ne" : "en";
    const [trades, near] = await Promise.all([
      fetchBolauTrades(locale),
      fetchBolauSearch({ page_size: String(NEAR_COUNT) }, locale),
    ]);
    const picker = orderTrades(trades).map((x) => ({ code: x.code, name_en: x.name_en, name_ne: x.name_ne }));
    render = {
      ...EMPLOYER_RENDER,
      "bolau-hero": () => <BolauHero variant="hero" trades={picker} />,
      "sipalu-near": () => <SipaluNearSection cards={near.data.results.slice(0, NEAR_COUNT)} ok={near.ok} />,
      "bolau-trades": () => <BolauTradesSection trades={orderTrades(trades)} />,
      "bolau-how": () => <HowBolauWorks />,
      "bolau-trust": () => <BolauTrustSection />,
      "become-sipalu": () => <BecomeSipaluSection />,
      businesses: () => <BusinessesSection />,
    };
  }

  return (
    <div className="bg-bg min-h-dvh">
      <a
        href="#main"
        className="bg-brand text-brand-fg sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("common.skip_to_content")}
      </a>
      <SiteHeader home />
      <main id="main">
        {sections.map((s) => (
          <Fragment key={s}>{render[s]?.()}</Fragment>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}

/** The employer-first sections (flag off renders exactly these, in EMPLOYER_HOME order). */
type Renderers = Partial<Record<HomeSection, () => React.ReactNode>>;

const EMPLOYER_RENDER: Renderers = {
  hero: () => <HomeHero />,
  problem: () => <ProblemSection />,
  demo: () => <DemoSection />,
  ladder: () => <LadderSection />,
  workforce: () => <WorkforceSection />,
  career: () => <CareerSection />,
  trust: () => <TrustSection />,
  trades: () => <TradesSection />,
  audience: () => <AudienceSection />,
  proof: () => <ProofSection />,
  pricing: () => <PricingBand />,
};
