import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Banknote, KeyRound, ShieldCheck } from "lucide-react";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { DotTexture } from "@/components/signature/dot-texture";
import { ImageSlot, slotPhoto } from "@/components/signature/image-slot";
import { MuralLettering } from "@/components/signature/mural-lettering";
import type { SlotId } from "@/components/marketing/slots";
import type { SearchValues } from "@/lib/bolau/search";
import { localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WRAP } from "./chrome";
import { BolauSearchForm } from "./search-form";

type TradeOpt = { code: string; name_en: string; name_ne: string };

/**
 * The Bolau mural hero, shared by the home page (flag on) and /bolau so the journey reads as one:
 * hero gradient + dot grain, बोलाउ lettering with a teal brush stroke, the headline, the search
 * panel (BolauSearchForm `hero` on `/`, `full` on /bolau), the Kaam-request link and three trust
 * lines. On wide screens a cut-paper collage (illustrated slots until the portraits are
 * commissioned) carries the arrival-code sticker — the 4-digit chip the Ghardhani reads out.
 * White text on the gradient (90% over hero #172554) stays ≥ 5.5:1.
 */
export async function BolauHero({
  trades,
  initial = {},
  variant,
  maxOffers = 3,
}: {
  trades: TradeOpt[];
  initial?: SearchValues;
  variant: "hero" | "full";
  maxOffers?: number;
}) {
  const t = await getTranslations("bolau.home.hero");
  const tm = await getTranslations("marketing");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const portrait = (slot: SlotId) => ({
    slot,
    alt: tm(`slots.${slot}.alt`),
    caption: tm(`slots.${slot}.caption`),
    tag: slotPhoto(slot) ? undefined : tm("illustration"),
  });
  const a = portrait("hero-electrician-bhaktapur");
  const b = portrait("notfound-plumber");
  const trust = t.raw("trust") as string[];
  const trustIcons = [ShieldCheck, Banknote, KeyRound];

  return (
    <section aria-labelledby="bolau-hero-title" className="bg-hero text-hero-fg relative isolate overflow-hidden">
      <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
      <DotTexture className="-z-10" />
      <div className={cn(WRAP, "grid gap-8 pt-8 pb-16 sm:pt-12 lg:grid-cols-12 lg:gap-10 lg:pt-14 lg:pb-24")}>
        <div className="min-w-0 lg:col-span-7">
          <p className="text-sm font-semibold tracking-wide">{t("kicker")}</p>
          <div className="mt-2 flex items-end justify-between gap-3 lg:justify-start" aria-hidden>
            <div className="flex items-end gap-2">
              <MuralLettering word="बोलाउ" size="md" rotate={-4} />
              <BrushStroke variant="swoosh" tone="teal" className="mb-3 h-10 w-20 sm:h-12 sm:w-28" />
            </div>
            {/* Phones: one small taped print beside the lettering keeps the mural feel without pushing the search down. */}
            <CutPaperFrame tape="yellow" rotate={5} padding="sm" className="mr-1 w-[84px] shrink-0 sm:w-24 lg:hidden">
              <ImageSlot slot={a.slot} alt="" sizes="96px" />
            </CutPaperFrame>
          </div>
          <h1
            id="bolau-hero-title"
            className="text-hero-fg mt-3 max-w-[20ch] text-[30px] leading-[38px] font-extrabold tracking-tight sm:text-[42px] sm:leading-[50px] lg:text-[48px] lg:leading-[56px]"
          >
            {t("title")}
          </h1>
          {variant === "hero" ? (
            <p className="mt-3 hidden max-w-[38rem] text-lg text-white/90 sm:block">{t("body")}</p>
          ) : null}

          <div className="mt-6 sm:mt-8">
            <BolauSearchForm trades={trades} initial={initial} variant={variant} />
          </div>

          <p className="mt-6 text-[15px] leading-7 sm:text-base">
            <span className="text-white/90">{t("request_lead")} </span>
            <Link
              href="/bolau/request"
              className="text-hero-fg decoration-yellow font-bold underline decoration-2 underline-offset-4 hover:decoration-[3px]"
            >
              {t("request", { max: localizeDigits(maxOffers, locale) })}
              <ArrowRight className="ml-1 inline size-4 align-[-2px]" aria-hidden />
            </Link>
          </p>

          <ul aria-label={t("trust_label")} className="mt-4 flex flex-col gap-2 text-[15px] font-semibold sm:flex-row sm:flex-wrap sm:gap-x-6">
            {trust.map((line, i) => {
              const Icon = trustIcons[i] ?? ShieldCheck;
              return (
                <li key={line} className="flex items-center gap-2">
                  <Icon className="text-yellow size-[18px] shrink-0" aria-hidden />
                  {line}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Wide screens: cut-paper collage + the arrival-code sticker (decorative; the steps below explain it). */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <CutPaperFrame
            caption={a.caption}
            tag={a.tag}
            tape="yellow"
            rotate={-4}
            className="absolute top-6 left-[4%] w-[58%] max-w-[270px]"
          >
            <ImageSlot slot={a.slot} alt={a.alt} priority sizes="270px" />
          </CutPaperFrame>
          <CutPaperFrame
            caption={b.caption}
            tag={b.tag}
            tape="teal"
            rotate={5}
            tapeRotate={-6}
            className="absolute top-[38%] right-[2%] w-[54%] max-w-[250px]"
          >
            <ImageSlot slot={b.slot} alt={b.alt} sizes="250px" />
          </CutPaperFrame>
          <div
            aria-hidden
            className="bg-yellow text-on-accent border-on-accent absolute bottom-[6%] left-[6%] rotate-[-6deg] rounded-[12px] border-2 px-4 py-3 shadow-[4px_5px_0_0_rgba(15,23,42,0.45)]"
          >
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
              <KeyRound className="size-3.5" />
              {t("code_label")}
            </p>
            <p className="font-mono text-[40px] leading-none font-extrabold tracking-[0.25em]">
              {localizeDigits("4827", locale)}
            </p>
            <p className="mt-1 text-[13px] font-semibold">{t("code_note")}</p>
          </div>
        </div>
      </div>
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        aria-hidden
        className="fill-bg absolute inset-x-0 bottom-0 block h-8 w-full sm:h-12"
      >
        <path d="M0 60V26c160 18 300-20 460-6s300 28 460 6 300-30 380-10 100 16 140 8v36z" />
      </svg>
    </section>
  );
}
