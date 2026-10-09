import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { Reveal } from "@/components/signature/reveal";

/**
 * Calm home-page band for Bolau (rendered only while the `bolau` flag is on): one sentence, two
 * links, a yellow ruled edge — no second hero. Sits after the trades section.
 */
export async function BolauHomeBand() {
  const t = await getTranslations("bolau.home_band");
  return (
    <section aria-labelledby="bolau-band-title" className="bg-bg">
      <Reveal className="mx-auto max-w-[1240px] px-4 py-12 sm:px-8 lg:py-16">
        <div className="border-yellow relative flex flex-col gap-6 border-l-[6px] pl-5 sm:pl-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-coral-text text-sm font-bold tracking-wide">{t("kicker")}</p>
            <h2 id="bolau-band-title" className="text-fg mt-2 text-2xl leading-tight font-extrabold sm:text-3xl">
              {t("title")}
            </h2>
            <p className="text-fg-body mt-2 text-lg">{t("body")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/bolau"
              className="bg-brand text-brand-fg hover:bg-brand-hover inline-flex min-h-12 items-center gap-2 rounded-control px-5 font-semibold"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/sipalu/join"
              className="text-fg inline-flex min-h-12 items-center px-2 font-semibold underline-offset-4 hover:underline"
            >
              {t("cta_join")}
            </Link>
          </div>
          <BrushStroke variant="underline" tone="yellow" className="absolute -bottom-5 left-5 h-4 w-28 sm:left-8" />
        </div>
      </Reveal>
    </section>
  );
}
