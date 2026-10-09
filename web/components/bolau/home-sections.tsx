import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Check, EyeOff, KeyRound, Phone, ShieldAlert } from "lucide-react";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { DotTexture } from "@/components/signature/dot-texture";
import { ImageSlot, slotPhoto } from "@/components/signature/image-slot";
import { Reveal } from "@/components/signature/reveal";
import type { BolauTrade, SipaluCard as Card } from "@/lib/api/types-bolau";
import { tradeFromPrice } from "@/lib/bolau/trades";
import { formatMoney, localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WRAP } from "./chrome";
import { SipaluCard } from "./sipalu-card";
import { TradeIcon } from "./trade-icon";

function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-coral-text text-sm font-bold tracking-wide", className)}>{children}</p>;
}

/**
 * "Sipalu near you": real, bookable Sipalu straight from `GET /bolau/search` (the API's own ranking),
 * as the same hairline rows used on /bolau. Six on wide screens, four on phones, then "See all".
 */
export async function SipaluNearSection({ cards, ok }: { cards: Card[]; ok: boolean }) {
  const t = await getTranslations("bolau.home.near");
  const tl = await getTranslations("bolau.landing");
  const tr = await getTranslations("bolau.request_cta");
  return (
    <section id="sipalu-near" aria-labelledby="near-title" className="bg-bg scroll-mt-20">
      <div className={cn(WRAP, "pt-10 pb-14 sm:pt-14 lg:pb-20")}>
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <Kicker>{t("kicker")}</Kicker>
            <h2 id="near-title" className="text-fg mt-2 text-3xl leading-tight font-extrabold sm:text-4xl">
              {t("title")}
            </h2>
            <p className="text-fg-body mt-2 max-w-2xl text-lg">{t("body")}</p>
          </div>
          {cards.length ? (
            <p className="lg:col-span-5 lg:text-right">
              <Link
                href="/bolau#results"
                className="text-brand-text inline-flex min-h-11 items-center gap-1.5 font-bold underline-offset-4 hover:underline"
              >
                {t("see_all")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </p>
          ) : null}
        </div>

        {cards.length ? (
          <ul className="border-border mt-6 grid border-t sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
            {cards.map((s, i) => (
              <li key={s.handle} className={cn("border-border border-b", i >= 4 && "max-sm:hidden")}>
                <SipaluCard s={s} index={i} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-yellow mt-6 max-w-2xl border-l-[6px] pl-5">
            <p className="text-fg-body text-lg">{ok ? t("empty") : tl("unavailable")}</p>
            <Link
              href="/bolau/request"
              className="bg-fg text-fg-inverse mt-4 inline-flex min-h-12 items-center gap-2 rounded-control px-5 font-bold hover:opacity-90"
            >
              {tr("cta")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Trades as a painted sign-board list (ruled rows, plain line icons, no cards): each row goes to
 * /bolau?trade=…, with the real Sipalu count and a "from" price only when the API publishes it
 * (k-anonymity). A taped cook print breaks the grid on wide screens.
 */
export async function BolauTradesSection({ trades }: { trades: BolauTrade[] }) {
  if (!trades.length) return null;
  const t = await getTranslations("bolau.home.trades");
  const tm = await getTranslations("marketing");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const cook = {
    alt: tm("slots.worker-cook-kitchen.alt"),
    caption: tm("slots.worker-cook-kitchen.caption"),
    tag: slotPhoto("worker-cook-kitchen") ? undefined : tm("illustration"),
  };
  const ink = ["text-brand-text", "text-coral-text", "text-teal-text"];
  return (
    <section aria-labelledby="trades-title" className="border-border bg-surface border-y">
      <div className={cn(WRAP, "grid gap-10 py-14 lg:grid-cols-12 lg:gap-8 lg:py-20")}>
        <div className="lg:col-span-8">
          <Kicker>{t("kicker")}</Kicker>
          <h2 id="trades-title" className="text-fg mt-2 text-3xl leading-tight font-extrabold">
            {t("title")}
          </h2>
          <p className="text-fg-body mt-2 max-w-xl">{t("body")}</p>
          <ul className="mt-8 grid sm:grid-cols-2 sm:gap-x-8">
            {trades.map((tr, i) => {
              const name = locale === "ne" ? tr.name_ne || tr.name_en : tr.name_en;
              const other = locale === "ne" ? tr.name_en : tr.name_ne;
              const from = tradeFromPrice(tr);
              return (
                <li key={tr.code} className="border-border border-b">
                  <Link
                    href={`/bolau?trade=${encodeURIComponent(tr.code)}#results`}
                    aria-label={t("see", { trade: name })}
                    className="group hover:bg-surface-hover -mx-2 flex min-h-[76px] items-center gap-4 rounded-sm px-2 py-3"
                  >
                    <TradeIcon code={tr.code} className={cn("size-8 shrink-0", ink[i % ink.length])} />
                    <span className="min-w-0 flex-1">
                      <span className="text-fg block text-lg leading-snug font-bold">{name}</span>
                      {other && other !== name ? (
                        <span lang={locale === "ne" ? "en" : "ne"} className="text-fg-muted block text-sm">
                          {other}
                        </span>
                      ) : null}
                      <span className="text-fg-body mt-0.5 block text-sm">
                        {typeof tr.sipalu_count === "number" ? t("count", { count: tr.sipalu_count }) : null}
                        {from ? (
                          <>
                            {" · "}
                            <span className="text-fg font-semibold">
                              {t(from.per === "fixed" ? "from_fixed" : "from_hourly", {
                                price: formatMoney(from.amount, locale),
                              })}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <ArrowRight
                      className="text-fg-muted group-hover:text-fg size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="hidden lg:col-span-4 lg:block lg:pt-16">
          <CutPaperFrame caption={cook.caption} tag={cook.tag} tape="coral" rotate={4} tapeRotate={-5} className="mx-auto max-w-[280px]">
            <ImageSlot slot="worker-cook-kitchen" alt={cook.alt} sizes="280px" />
          </CutPaperFrame>
        </div>
      </div>
    </section>
  );
}

/**
 * Safety & trust: who checks what (a ledger-like table, as on the B2B story) beside three real UI
 * fragments — the masked number, the arrival code, the report button — and the 100 line.
 */
export async function BolauTrustSection() {
  const t = await getTranslations("bolau.home.trust");
  const ts = await getTranslations("bolau.safety");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const rows = t.raw("rows") as { what: string; how: string; who: string }[];
  return (
    <section aria-labelledby="trust-title" className="bg-bg">
      <div className={cn(WRAP, "grid gap-12 py-14 lg:grid-cols-12 lg:gap-8 lg:py-20")}>
        <div className="lg:col-span-7">
          <Kicker>{t("kicker")}</Kicker>
          <h2 id="trust-title" className="text-fg mt-2 max-w-2xl text-3xl leading-tight font-extrabold">
            {t("title")}
          </h2>
          <p className="text-fg-body mt-2">{t("body")}</p>
          <table className="mt-6 w-full border-collapse text-left">
            <thead className="max-sm:sr-only">
              <tr className="border-fg border-b-2 text-sm">
                <th scope="col" className="text-fg py-2 pr-4 font-semibold sm:w-32">{t("col_what")}</th>
                <th scope="col" className="text-fg py-2 pr-4 font-semibold">{t("col_how")}</th>
                <th scope="col" className="text-fg py-2 font-semibold sm:w-48">{t("col_who")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.what} className="border-border flex flex-col gap-1 border-b py-4 sm:table-row sm:py-0">
                  <th scope="row" className="text-fg font-bold sm:py-4 sm:pr-4 sm:align-top">
                    <span className="inline-flex items-center gap-2">
                      <Check className="text-teal-text size-4" strokeWidth={3} aria-hidden />
                      {r.what}
                    </span>
                  </th>
                  <td className="text-fg-body sm:py-4 sm:pr-4 sm:align-top">{r.how}</td>
                  <td className="sm:py-4 sm:align-top">
                    <span className="text-teal-text text-sm font-semibold">{r.who}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Reveal as="ul" className="space-y-8 lg:col-span-4 lg:col-start-9 lg:pt-12">
          <li>
            <p
              aria-hidden
              className="border-border-strong bg-surface text-fg inline-flex items-center gap-2 rounded-dense border px-3 py-2 font-mono text-lg font-bold tracking-wider"
            >
              <EyeOff className="text-fg-muted size-4" />
              {t("masked_sample")}
            </p>
            <h3 className="text-fg mt-3 font-bold">{t("masked_title")}</h3>
            <p className="text-fg-body mt-1 text-[15px]">{t("masked_body")}</p>
          </li>
          <li>
            <p
              aria-hidden
              className="bg-yellow text-on-accent border-on-accent inline-flex -rotate-2 items-center gap-2 rounded-[10px] border-2 px-3 py-1.5"
            >
              <KeyRound className="size-4" />
              <span className="font-mono text-2xl font-extrabold tracking-[0.3em]">{localizeDigits("4827", locale)}</span>
            </p>
            <h3 className="text-fg mt-3 font-bold">{t("code_title")}</h3>
            <p className="text-fg-body mt-1 text-[15px]">{t("code_body")}</p>
          </li>
          <li className="border-coral border-l-[6px] pl-4">
            <h3 className="text-fg flex items-center gap-2 font-bold">
              <ShieldAlert className="text-coral-text size-5" aria-hidden />
              {t("report_title")}
            </h3>
            <p className="text-fg-body mt-1 text-[15px]">{t("report_body")}</p>
            <a
              href="tel:100"
              className="border-fg text-fg hover:bg-surface-hover mt-3 inline-flex min-h-12 items-center gap-2 rounded-control border-2 px-4 font-bold"
            >
              <Phone className="size-4" aria-hidden />
              {ts("emergency")}
            </a>
          </li>
        </Reveal>
      </div>
    </section>
  );
}

/** Become a Sipalu: blue mural band, the never-a-cut promise, Passport print, one yellow CTA. */
export async function BecomeSipaluSection() {
  const t = await getTranslations("bolau.home.join");
  const tm = await getTranslations("marketing");
  const points = t.raw("points") as string[];
  const phone = {
    alt: tm("slots.passport-hands-phone.alt"),
    caption: tm("slots.passport-hands-phone.caption"),
    tag: slotPhoto("passport-hands-phone") ? undefined : tm("illustration"),
  };
  return (
    <section id="sipalu" aria-labelledby="join-title" className="bg-hero text-hero-fg relative isolate scroll-mt-20 overflow-hidden">
      <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
      <DotTexture className="-z-10" />
      <div className={cn(WRAP, "grid items-center gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
        <div className="lg:col-span-7">
          <p className="text-sm font-bold tracking-wide">{t("kicker")}</p>
          <h2 id="join-title" className="text-hero-fg mt-3 max-w-[22ch] text-3xl leading-tight font-extrabold sm:text-[40px] sm:leading-[48px]">
            {t("title")}
          </h2>
          <BrushStroke variant="underline" tone="yellow" className="mt-3 h-4 w-32" />
          <p className="mt-5 max-w-xl text-lg text-white/90">{t("body")}</p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[17px] font-semibold">
                <Check className="text-yellow mt-1 size-5 shrink-0" strokeWidth={3} aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/sipalu/join"
              className="bg-yellow text-on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 text-base font-bold hover:brightness-95"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/help?audience=worker"
              className="text-hero-fg inline-flex min-h-12 items-center justify-center rounded-control border-2 border-white/80 px-5 font-semibold hover:bg-white/10"
            >
              {t("secondary")}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[340px] lg:col-span-4 lg:col-start-9">
          <CutPaperFrame caption={phone.caption} tag={phone.tag} tape="teal" rotate={-4} tapeRotate={6}>
            <ImageSlot slot="passport-hands-phone" alt={phone.alt} sizes="340px" />
          </CutPaperFrame>
          <p className="bg-coral text-on-accent absolute -top-5 -right-2 max-w-[11rem] rotate-[6deg] rounded-[14px] px-4 py-3 text-[15px] leading-snug font-bold sm:-right-8">
            {t("sticker")}
          </p>
        </div>
      </div>
    </section>
  );
}
