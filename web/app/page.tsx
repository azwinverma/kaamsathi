import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomeHero } from "@/components/marketing/home-hero";
import {
  AudienceSection,
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
import { BolauHomeBand } from "@/components/bolau/home-band";
import { bolauLive } from "@/lib/bolau/live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.meta");
  return { title: { absolute: t("title") }, description: t("description"), alternates: { canonical: "/" } };
}

type Props = { searchParams: Promise<{ slots?: string | string[] }> };

/**
 * Public home (B · street mural). Narrative per docs/BRAND_GUIDELINES_V3_HUMAN_CRAFTED.md
 * "Public website": problem → scenario → product demo (real UI fragments) → Passport/ladder →
 * workforce → career → trust → trades → employers/workers → outcomes + partners → pricing/CTA.
 * Components: SiteHeader, HomeHero (MuralLettering, BrushStroke, CutPaperFrame, ImageSlot,
 * DotTexture), PassportCard, RosterStrip, SkillLadder, Reveal, SiteFooter.
 */
export default async function Home({ searchParams }: Props) {
  enableSlotBriefs((await searchParams).slots);
  const t = await getTranslations();
  const bolau = await bolauLive();
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
        <HomeHero />
        <ProblemSection />
        <DemoSection />
        <LadderSection />
        <WorkforceSection />
        <CareerSection />
        <TrustSection />
        <TradesSection />
        {bolau ? <BolauHomeBand /> : null}
        <AudienceSection />
        <ProofSection />
        <PricingBand />
      </main>
      <SiteFooter />
    </div>
  );
}
