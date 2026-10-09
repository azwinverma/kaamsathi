import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BolauChrome, WRAP } from "@/components/bolau/chrome";
import { BolauCtas, HowBolauWorks, SafetyBand } from "@/components/bolau/landing-sections";
import { BolauSearchForm } from "@/components/bolau/search-form";
import { searchHref, type SearchValues } from "@/lib/bolau/search";
import { SipaluCard } from "@/components/bolau/sipalu-card";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { DotTexture } from "@/components/signature/dot-texture";
import { MuralLettering } from "@/components/signature/mural-lettering";
import { backendJson } from "@/lib/server/session";
import { bolauLive, fetchBolauSearch, fetchBolauTrades } from "@/lib/bolau/live";
import type { Trade } from "@/lib/api/types";
import { localizeDigits } from "@/lib/format";
import { cn, pickName } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS = ["q", "trade", "district", "date", "time", "max_price", "instant", "min_rating", "language", "gender"] as const;
const PAGE_SIZE = 12;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function clean(raw: Record<string, string | string[] | undefined>): SearchValues & { page?: string } {
  const out: Record<string, string> = {};
  for (const k of [...KEYS, "page"]) {
    const v = raw[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    if (s) out[k] = s.slice(0, 80);
  }
  return out;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bolau.meta");
  if (!(await bolauLive())) return { title: t("not_found_title"), robots: { index: false, follow: false } };
  return {
    title: { absolute: t("landing_title") },
    description: t("landing_description"),
    alternates: { canonical: "/bolau" },
    openGraph: { title: t("landing_title"), description: t("landing_description"), url: "/bolau" },
  };
}

/**
 * Bolau landing + search (B · street mural). Components: BolauChrome (SiteHeader/SiteFooter),
 * DotTexture, MuralLettering (बोलाउ, the one per view), BrushStroke, BolauSearchForm, SipaluCard
 * (CutPaperFrame portrait), HowBolauWorks, SafetyBand, BolauCtas. Hidden (404) while `bolau` is off.
 */
export default async function BolauPage({ searchParams }: Props) {
  if (!(await bolauLive())) notFound();
  const t = await getTranslations("bolau");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const values = clean(await searchParams);
  const page = Math.max(1, Number(values.page) || 1);
  const { page: _p, ...filters } = values;

  const [bolauTrades, refTrades, result] = await Promise.all([
    fetchBolauTrades(locale),
    backendJson("/ref/trades", { lang: locale }).then((r) => (Array.isArray(r.data) ? (r.data as Trade[]) : [])),
    fetchBolauSearch({ ...filters, page: String(page), page_size: String(PAGE_SIZE) }, locale),
  ]);
  const trades = bolauTrades.length ? bolauTrades : refTrades;
  const searched = Object.keys(filters).length > 0;
  const tradeName = filters.trade
    ? pickName([...bolauTrades, ...refTrades].find((x) => x.code === filters.trade), locale) || filters.trade
    : null;
  const what = filters.q || tradeName;
  const { count, results } = result.data;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <BolauChrome>
      <section aria-labelledby="bolau-title" className="bg-hero text-hero-fg relative isolate overflow-hidden">
        <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
        <DotTexture className="-z-10" />
        <div className={cn(WRAP, "grid gap-8 pt-10 pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:pb-20")}>
          <div className="lg:col-span-5">
            <p className="text-sm font-semibold tracking-wide">{t("landing.kicker")}</p>
            <div className="mt-3 flex items-end gap-2" aria-hidden>
              <MuralLettering word="बोलाउ" size="md" rotate={-4} />
              <BrushStroke variant="swoosh" tone="teal" className="mb-3 h-10 w-20 sm:h-12 sm:w-24" />
            </div>
            <h1
              id="bolau-title"
              className="text-hero-fg mt-3 max-w-[18ch] text-[30px] leading-[38px] font-extrabold tracking-tight sm:text-[40px] sm:leading-[48px]"
            >
              {t("landing.title")}
            </h1>
            <p className="mt-4 max-w-[36rem] text-lg text-white/90">{t("landing.body")}</p>
          </div>
          <div className="lg:col-span-7 lg:pt-4">
            <BolauSearchForm
              trades={trades.map((x) => ({ code: x.code, name_en: x.name_en, name_ne: x.name_ne }))}
              initial={filters}
            />
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

      <section id="results" aria-labelledby="results-title" className={cn(WRAP, "scroll-mt-20 py-10 sm:py-14")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="results-title" className="text-fg text-2xl font-extrabold">
            {searched ? t("landing.results_heading") : t("landing.results_heading_all")}
          </h2>
          {result.ok ? (
            <p className="text-fg-muted text-sm" aria-live="polite">
              <span className="text-fg font-semibold">{t("search.results_count", { count })}</span>
              {what ? ` ${t("search.results_for", { what })}` : ""}
            </p>
          ) : null}
        </div>

        {!result.ok ? (
          <p className="text-fg-body border-warning bg-warning-subtle mt-6 rounded-dense border-l-4 px-4 py-3">
            {t("landing.unavailable")}
          </p>
        ) : results.length === 0 ? (
          <div className="mt-8 max-w-xl">
            <p className="text-fg text-lg font-bold">{t("search.empty_title")}</p>
            <p className="text-fg-body mt-1">{t("search.empty_body")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/bolau/request"
                className="bg-brand text-brand-fg hover:bg-brand-hover inline-flex min-h-11 items-center gap-2 rounded-control px-4 font-semibold"
              >
                {t("request_cta.cta")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              {searched ? (
                <Link
                  href="/bolau#results"
                  className="text-fg-body inline-flex min-h-11 items-center px-2 font-medium underline-offset-4 hover:underline"
                >
                  {t("search.clear")}
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <ul className="mt-4 grid lg:grid-cols-2 lg:gap-x-12">
            {results.map((s, i) => (
              <li key={s.handle} className="border-border border-b">
                <SipaluCard s={s} index={i} />
              </li>
            ))}
          </ul>
        )}

        {result.ok && pages > 1 ? (
          <nav aria-label={t("search.page", { page: localizeDigits(page, locale) })} className="mt-8 flex items-center gap-3">
            {page > 1 ? (
              <Link
                href={searchHref({ ...filters, ...(page - 1 > 1 ? { page: String(page - 1) } : {}) } as SearchValues)}
                className="text-fg border-border-strong inline-flex min-h-11 items-center gap-1 rounded-control border px-4 font-medium"
              >
                <ArrowLeft className="size-4" aria-hidden />
                {t("search.prev")}
              </Link>
            ) : null}
            <span className="text-fg-muted text-sm tabular">
              {localizeDigits(`${page} / ${pages}`, locale)}
            </span>
            {page < pages ? (
              <Link
                href={searchHref({ ...filters, page: String(page + 1) } as SearchValues)}
                className="text-fg border-border-strong inline-flex min-h-11 items-center gap-1 rounded-control border px-4 font-medium"
              >
                {t("search.next")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <HowBolauWorks />
      <SafetyBand />
      <BolauCtas />
    </BolauChrome>
  );
}
