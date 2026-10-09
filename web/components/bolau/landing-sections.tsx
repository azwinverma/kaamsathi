import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, KeyRound, Phone, ShieldAlert } from "lucide-react";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { Reveal } from "@/components/signature/reveal";
import { localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WRAP } from "./chrome";

/**
 * "How Bolau works": three numbered statements on a ruled line (not three cards), with the
 * arrival code drawn as the real 4-digit chip the Ghardhani reads out.
 */
export async function HowBolauWorks() {
  const t = await getTranslations("bolau.how");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const steps = t.raw("steps") as { title: string; body: string }[];
  return (
    <section aria-labelledby="how-title" className="border-border bg-surface border-y">
      <div className={cn(WRAP, "grid gap-10 py-14 lg:grid-cols-12 lg:gap-8 lg:py-20")}>
        <div className="lg:col-span-4">
          <p className="text-coral-text text-sm font-bold tracking-wide">{t("kicker")}</p>
          <h2 id="how-title" className="text-fg mt-3 text-2xl leading-tight font-extrabold sm:text-3xl">
            {t("title")}
          </h2>
          <div
            aria-hidden
            className="border-fg bg-yellow text-on-accent mt-8 inline-flex -rotate-2 items-center gap-3 rounded-[10px] border-2 px-4 py-3"
          >
            <KeyRound className="size-5" />
            <span className="font-mono text-3xl font-extrabold tracking-[0.3em]">{localizeDigits("4827", locale)}</span>
          </div>
        </div>
        <Reveal as="ol" className="relative space-y-9 lg:col-span-7 lg:col-start-6">
          <span aria-hidden className="bg-border-strong absolute top-3 bottom-3 left-[15px] w-0.5" />
          {steps.map((s, i) => (
            <li key={s.title} className="relative pl-12">
              <span
                aria-hidden
                className="bg-fg text-yellow absolute top-0 left-0 flex size-8 items-center justify-center rounded-full text-sm font-extrabold"
              >
                {localizeDigits(i + 1, locale)}
              </span>
              <h3 className="text-fg text-lg font-bold">{s.title}</h3>
              <p className="text-fg-body mt-1">{s.body}</p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/** Safety line: confidential report + emergency number, always both languages' copy via t(). */
export async function SafetyBand() {
  const t = await getTranslations("bolau.safety");
  return (
    <section aria-labelledby="safety-title" className="bg-bg">
      <div className={cn(WRAP, "py-12")}>
        <div className="border-coral flex flex-col gap-4 border-l-[6px] pl-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 id="safety-title" className="text-fg flex items-center gap-2 text-lg font-bold">
              <ShieldAlert className="text-coral-text size-5" aria-hidden />
              {t("title")}
            </h2>
            <p className="text-fg-body mt-1">{t("body")}</p>
          </div>
          <a
            href="tel:100"
            className="border-fg text-fg hover:bg-surface-hover inline-flex min-h-12 shrink-0 items-center gap-2 self-start rounded-control border-2 px-4 font-bold sm:self-auto"
          >
            <Phone className="size-4" aria-hidden />
            {t("emergency")}
          </a>
        </div>
      </div>
    </section>
  );
}

/** Two calls to action side by side: post a Kaam request (Ghardhani) / become a Sipalu. */
export async function BolauCtas() {
  const t = await getTranslations("bolau");
  return (
    <section aria-label={t("nav.section_label")} className="bg-bg">
      <div className={cn(WRAP, "grid gap-6 pb-16 md:grid-cols-2 lg:pb-24")}>
        <div className="bg-yellow-subtle relative overflow-hidden rounded-card p-6 sm:p-8">
          <h2 className="text-fg text-xl font-extrabold">{t("request_cta.title")}</h2>
          <p className="text-fg-body mt-2 max-w-md">{t("request_cta.body")}</p>
          <Link
            href="/bolau/request"
            className="bg-fg text-fg-inverse mt-5 inline-flex min-h-12 items-center gap-2 rounded-control px-5 font-bold hover:opacity-90"
          >
            {t("request_cta.cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="bg-hero text-hero-fg relative overflow-hidden rounded-card p-6 sm:p-8">
          <BrushStroke variant="arc" tone="teal" className="absolute -right-2 -bottom-4 size-24 opacity-90" />
          <h2 className="text-hero-fg text-xl font-extrabold">{t("join_cta.title")}</h2>
          <p className="mt-2 max-w-md text-white/90">{t("join_cta.body")}</p>
          <Link
            href="/sipalu/join"
            className="bg-yellow text-on-accent relative mt-5 inline-flex min-h-12 items-center gap-2 rounded-control px-5 font-bold hover:brightness-95"
          >
            {t("join_cta.cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
