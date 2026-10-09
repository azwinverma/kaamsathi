import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck } from "lucide-react";
import { BolauChrome, WRAP } from "@/components/bolau/chrome";
import { SipaluOnboarding } from "@/components/bolau/sipalu-onboarding";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { DotTexture } from "@/components/signature/dot-texture";
import { MuralLettering } from "@/components/signature/mural-lettering";
import { bolauLive } from "@/lib/bolau/live";
import { localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bolau.meta");
  if (!(await bolauLive())) return { title: t("not_found_title"), robots: { index: false, follow: false } };
  return {
    title: { absolute: t("join_title") },
    description: t("join_description"),
    alternates: { canonical: "/sipalu/join" },
    openGraph: { title: t("join_title"), description: t("join_description"), url: "/sipalu/join" },
  };
}

/**
 * Sipalu web entry (B · street mural): explainer + save-and-resume onboarding. The mobile app is
 * the primary place to run Bolau jobs; every onboarding step also works here.
 */
export default async function SipaluJoinPage() {
  if (!(await bolauLive())) notFound();
  const t = await getTranslations("bolau.join");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const points = t.raw("points") as string[];
  const needs = t.raw("steps") as string[];
  return (
    <BolauChrome>
      <section aria-labelledby="join-title" className="bg-hero text-hero-fg relative isolate overflow-hidden">
        <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
        <DotTexture className="-z-10" />
        <div className={cn(WRAP, "grid gap-10 pt-10 pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-8 lg:pb-20")}>
          <div className="lg:col-span-7">
            <p className="text-sm font-semibold tracking-wide">{t("kicker")}</p>
            <div className="mt-3 flex items-end gap-2" aria-hidden>
              <MuralLettering word="सीप" size="md" rotate={-5} />
              <BrushStroke variant="swoosh" tone="teal" className="mb-3 h-10 w-20" />
            </div>
            <h1 id="join-title" className="text-hero-fg mt-3 max-w-[20ch] text-[30px] leading-[38px] font-extrabold sm:text-[42px] sm:leading-[50px]">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-[38rem] text-lg text-white/90">{t("body")}</p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2 font-medium">
                  <BadgeCheck className="text-yellow mt-0.5 size-5 shrink-0" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <a
              href="#start"
              className="bg-yellow text-on-accent mt-8 inline-flex min-h-12 items-center rounded-control px-6 text-base font-bold hover:brightness-95"
            >
              {t("start")}
            </a>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <div className="bg-surface text-fg -rotate-1 rounded-card p-5 shadow-floating">
              <h2 className="text-fg text-base font-extrabold">{t("steps_title")}</h2>
              <ol className="mt-3 space-y-3">
                {needs.map((n, i) => (
                  <li key={n} className="flex gap-3 text-sm">
                    <span
                      aria-hidden
                      className="bg-fg text-yellow flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                    >
                      {localizeDigits(i + 1, locale)}
                    </span>
                    {n}
                  </li>
                ))}
              </ol>
              <p className="text-fg-muted border-border mt-4 border-t pt-3 text-xs">{t("app_note")}</p>
            </div>
          </div>
        </div>
      </section>
      <section id="start" aria-label={t("start")} className={cn(WRAP, "scroll-mt-20 py-10 pb-20")}>
        <SipaluOnboarding />
      </section>
    </BolauChrome>
  );
}
