import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowRight } from "lucide-react";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { DotTexture } from "@/components/signature/dot-texture";
import { ImageSlot, slotPhoto } from "@/components/signature/image-slot";
import { MuralLettering } from "@/components/signature/mural-lettering";
import type { SlotId } from "./slots";

/**
 * Mural hero band: hero gradient over deep ink, dot grain, काम lettering + teal brush stroke, and two
 * cut-paper portrait slots (illustrated until the commissioned portraits exist).
 * White text on the gradient (90% over hero #172554) is ≥ 5.5:1 at every stop.
 */
export async function HomeHero() {
  const t = await getTranslations("marketing");
  const portrait = (slot: SlotId) => ({
    slot,
    alt: t(`slots.${slot}.alt`),
    caption: t(`slots.${slot}.caption`),
    tag: slotPhoto(slot) ? undefined : t("illustration"),
  });
  const a = portrait("hero-hvac-biratnagar");
  const b = portrait("hero-electrician-bhaktapur");

  return (
    <section aria-labelledby="hero-title" className="bg-hero text-hero-fg relative isolate overflow-hidden">
      <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
      <DotTexture className="-z-10" />
      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 pt-12 pb-20 sm:px-8 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pt-20 lg:pb-28">
        <div className="flex flex-col gap-5 lg:col-span-6">
          <p className="text-hero-fg text-sm font-semibold tracking-wide">{t("hero.kicker")}</p>
          <div className="flex items-end gap-2" aria-hidden>
            <MuralLettering word="काम" size="lg" rotate={-3} />
            <BrushStroke variant="swoosh" tone="teal" className="mb-4 h-12 w-24 sm:h-16 sm:w-32" />
          </div>
          <h1
            id="hero-title"
            className="text-hero-fg max-w-[15ch] text-[34px] leading-[42px] font-extrabold tracking-tight sm:text-5xl sm:leading-[56px] lg:text-[52px] lg:leading-[60px]"
          >
            {t("hero.title")}
          </h1>
          <p className="max-w-[34rem] text-lg text-white/90 sm:text-xl sm:leading-[30px]">{t("hero.body")}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              className="bg-yellow text-on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-bold transition-[filter] hover:brightness-95"
            >
              {t("hero.cta_employer")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href="#workers"
              className="text-hero-fg inline-flex min-h-12 items-center justify-center gap-2 rounded-control border-2 border-white px-5 text-base font-semibold transition-colors hover:bg-white/10"
            >
              {t("hero.cta_worker")}
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        </div>

        {/* Cut-paper portrait collage */}
        <div className="relative h-[440px] sm:h-[460px] lg:col-span-6">
          <CutPaperFrame
            caption={a.caption}
            tag={a.tag}
            tape="yellow"
            rotate={-5}
            className="absolute top-2 left-[2%] z-10 w-[52%] max-w-[250px] sm:left-[6%]"
          >
            <ImageSlot slot={a.slot} alt={a.alt} priority sizes="(min-width: 1024px) 250px, 52vw" />
          </CutPaperFrame>
          <CutPaperFrame
            caption={b.caption}
            tag={b.tag}
            tape="teal"
            rotate={4}
            tapeRotate={-6}
            className="absolute top-[22%] right-[2%] w-[52%] max-w-[260px] sm:right-[8%]"
          >
            <ImageSlot slot={b.slot} alt={b.alt} priority sizes="(min-width: 1024px) 260px, 52vw" />
          </CutPaperFrame>
          <p className="bg-coral text-on-accent absolute bottom-0 left-0 max-w-[10rem] rotate-[5deg] sm:max-w-[12rem] rounded-[14px] px-4 py-3 text-[15px] leading-snug font-bold sm:top-0 sm:right-0 sm:bottom-auto sm:left-auto">
            {t("hero.sticker")}
          </p>
        </div>
      </div>
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        aria-hidden
        className="fill-bg absolute inset-x-0 bottom-0 block h-10 w-full sm:h-[60px]"
      >
        <path d="M0 60V22c120 16 240-18 380-4s260 30 420 8 300-34 420-12 160 20 220 8v38z" />
      </svg>
    </section>
  );
}
