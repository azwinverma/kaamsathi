import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Check, EyeOff, History, Link2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { DotTexture } from "@/components/signature/dot-texture";
import { ImageSlot, slotPhoto } from "@/components/signature/image-slot";
import { PassportCard } from "@/components/signature/passport-card";
import { Reveal } from "@/components/signature/reveal";
import { SkillLadder } from "@/components/signature/skill-ladder";
import { cn } from "@/lib/utils";
import { RosterStrip } from "./roster-strip";
import type { SlotId } from "./slots";

const WRAP = "mx-auto max-w-[1240px] px-4 sm:px-8";

function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-coral-text text-sm font-bold tracking-wide", className)}>{children}</p>;
}

async function slotText(slot: SlotId) {
  const t = await getTranslations("marketing");
  return {
    alt: t(`slots.${slot}.alt`),
    caption: t(`slots.${slot}.caption`),
    tag: slotPhoto(slot) ? undefined : t("illustration"),
  };
}

/* 1 · The real problem — quiet, text-led, a three-step timeline of how hiring goes today. */
export async function ProblemSection() {
  const t = await getTranslations("marketing.problem");
  const steps = t.raw("steps") as { day: string; title: string; body: string }[];
  const marks = ["bg-coral", "bg-yellow", "bg-fg"];
  return (
    <section aria-labelledby="problem-title" className="bg-bg">
      <div className={cn(WRAP, "grid gap-12 pt-14 pb-16 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24")}>
        <Reveal className="lg:col-span-6">
          <Kicker>{t("kicker")}</Kicker>
          <h2
            id="problem-title"
            className="text-fg mt-4 text-2xl leading-[1.35] font-semibold sm:text-[28px] lg:text-[32px]"
          >
            {t("title")}
          </h2>
        </Reveal>
        <Reveal as="ol" className="relative space-y-8 lg:col-span-5 lg:col-start-8 lg:pt-10">
          <span aria-hidden className="bg-border-strong absolute top-2 bottom-2 left-[5px] w-0.5" />
          {steps.map((s, i) => (
            <li key={s.day} className="relative pl-9">
              <span
                aria-hidden
                className={cn("absolute top-1.5 left-0 size-3 rotate-45 rounded-[3px]", marks[i])}
              />
              <p className="text-fg-muted text-xs font-bold tracking-wider uppercase">{s.day}</p>
              <p className="text-fg mt-1 text-lg font-semibold">{s.title}</p>
              <p className="text-fg-body mt-0.5">{s.body}</p>
            </li>
          ))}
        </Reveal>
        <Reveal className="lg:col-span-10">
          <p className="border-yellow text-fg border-l-[6px] pl-5 text-xl leading-relaxed font-medium sm:text-2xl">
            {t("scenario")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* 2 · Product demonstration with real UI fragments (demo data, labelled as such). */
export async function DemoSection() {
  const t = await getTranslations("marketing");
  const callouts = t.raw("demo.callouts") as string[];
  const Marker = ({ n, className }: { n: number; className?: string }) => (
    <span
      aria-hidden
      className={cn(
        "bg-fg text-yellow ring-surface absolute z-10 flex size-7 items-center justify-center rounded-full text-sm font-extrabold ring-4",
        className,
      )}
    >
      {n}
    </span>
  );
  return (
    <section aria-labelledby="demo-title" className="border-border bg-surface border-y">
      <div className={cn(WRAP, "py-16 lg:py-24")}>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Kicker>{t("demo.kicker")}</Kicker>
            <h2 id="demo-title" className="text-fg mt-3 text-3xl leading-tight font-extrabold sm:text-4xl">
              {t("demo.title")}
            </h2>
          </div>
          <p className="text-fg-body text-lg lg:col-span-6 lg:col-start-7 lg:self-end">{t("demo.body")}</p>
        </div>

        <Reveal className="mt-12 grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="relative lg:col-span-5">
            <Marker n={1} className="-top-3 -left-2" />
            <Marker n={2} className="-right-2 -bottom-3" />
            <PassportCard
              brand={t("demo.card.brand")}
              code={t("demo.card.code")}
              name={t("demo.card.name")}
              altName={t("demo.card.alt_name")}
              line={t("demo.card.trade")}
              initials="RT"
              photoLabel={t("passport.photo_label")}
              chips={[
                { label: t("demo.card.chip_identity") },
                { label: t("demo.card.chip_nstb") },
                { label: t("demo.card.chip_ladder"), accent: true },
              ]}
            />
          </div>
          <div className="relative lg:col-span-7">
            <Marker n={3} className="-top-3 -left-2" />
            <RosterStrip />
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <ol className="grid gap-5 sm:grid-cols-3 lg:col-span-9">
            {callouts.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="bg-fg text-yellow flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
                  {i + 1}
                </span>
                <span className="text-fg-body pt-0.5 text-[15px]">{c}</span>
              </li>
            ))}
          </ol>
          <p className="text-fg-muted text-xs lg:col-span-3 lg:text-right">{t("demo.sample")}</p>
        </div>
      </div>
    </section>
  );
}

/* 3 · Worker Passport + the skill ladder (the signature). */
export async function LadderSection() {
  const t = await getTranslations("marketing.ladder");
  const locale = await getLocale();
  const points = t.raw("points") as string[];
  const icons = [Link2, History, EyeOff];
  return (
    <section id="passport" aria-labelledby="ladder-title" className="bg-bg scroll-mt-20">
      <div className={cn(WRAP, "grid gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
        <div className="flex flex-col gap-4 lg:col-span-5">
          {locale !== "ne" ? (
            <span aria-hidden lang="ne" className="font-nepali text-coral-text text-[28px] font-extrabold">
              {t("deco")}
            </span>
          ) : null}
          <h2 id="ladder-title" className="text-fg text-3xl leading-tight font-extrabold sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-fg-body text-lg">{t("body")}</p>
          <ul className="mt-2 space-y-3">
            {points.map((p, i) => {
              const Icon = icons[i];
              return (
                <li key={p} className="text-fg flex items-start gap-3 font-medium">
                  <Icon className="text-teal-text mt-0.5 size-5 shrink-0" aria-hidden />
                  {p}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="lg:col-span-7 lg:pt-6">
          <SkillLadder earned={4} />
          <p className="text-fg-muted mt-4 text-sm">{t("example")}</p>
        </div>
      </div>
    </section>
  );
}

/* 4 · Workforce management — tinted band, mural wall slot. */
export async function WorkforceSection() {
  const t = await getTranslations("marketing.workforce");
  const items = t.raw("items") as { title: string; body: string }[];
  const bars = ["border-brand", "border-teal", "border-coral"];
  const mural = await slotText("mural-wall-patan");
  return (
    <section aria-labelledby="workforce-title" className="bg-yellow-subtle">
      <div className={cn(WRAP, "grid items-center gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
        <Reveal as="figure" className="m-0 lg:col-span-5">
          <ImageSlot
            slot="mural-wall-patan"
            alt={mural.alt}
            className="rounded-card"
            sizes="(min-width: 1024px) 480px, 92vw"
          />
          <figcaption className="text-fg-muted mt-2 text-xs">
            {mural.tag ? `${mural.tag} · ` : ""}
            {mural.caption}
          </figcaption>
        </Reveal>
        <div className="lg:col-span-7">
          <Kicker>{t("kicker")}</Kicker>
          <h2 id="workforce-title" className="text-fg mt-3 text-3xl leading-tight font-extrabold sm:text-[34px]">
            {t("title")}
          </h2>
          <p className="text-fg-body mt-3 max-w-2xl text-lg">{t("body")}</p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3 sm:gap-4">
            {items.map((it, i) => (
              <li key={it.title} className={cn("border-t-[6px] pt-3", bars[i])}>
                <p className="text-fg font-bold">{it.title}</p>
                <p className="text-fg-body mt-1 text-sm">{it.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* 5 · Career progression rail + training slot. */
export async function CareerSection() {
  const t = await getTranslations("marketing.career");
  const steps = t.raw("steps") as { title: string; body: string }[];
  const welder = await slotText("career-welder-visor");
  const nodes = ["bg-verified-subtle", "bg-teal", "bg-brand", "bg-yellow"];
  return (
    <section aria-labelledby="career-title" className="bg-bg">
      <div className={cn(WRAP, "grid items-center gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
        <div className="lg:col-span-7">
          <Kicker>{t("kicker")}</Kicker>
          <h2 id="career-title" className="text-fg mt-3 max-w-2xl text-3xl leading-tight font-extrabold sm:text-4xl">
            {t("title")}
          </h2>
          <Reveal as="ol" className="relative mt-10 grid gap-6 sm:grid-cols-4 sm:gap-4">
            <span aria-hidden className="bg-border-strong absolute top-5 bottom-5 left-[19px] w-0.5 sm:top-[19px] sm:right-[calc(25%-2rem)] sm:bottom-auto sm:left-5 sm:h-0.5 sm:w-auto" />
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 sm:flex-col sm:gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "ring-bg relative flex size-10 shrink-0 items-center justify-center rounded-full ring-4",
                    nodes[i],
                    i === 3 ? "text-on-accent" : i === 2 ? "text-brand-fg" : i === 1 ? "text-on-accent" : "text-verified",
                  )}
                >
                  <span className="text-sm font-extrabold">{i + 1}</span>
                </span>
                <span>
                  <span className="text-fg block font-bold">{s.title}</span>
                  <span className={cn("block text-sm", s.body.startsWith("[") ? "text-warning font-medium" : "text-fg-body")}>
                    {s.body}
                  </span>
                </span>
              </li>
            ))}
          </Reveal>
          <p className="text-fg-body mt-10 max-w-2xl text-lg">{t("body")}</p>
        </div>
        <div className="lg:col-span-5">
          <CutPaperFrame caption={welder.caption} tag={welder.tag} tape="coral" rotate={3} tapeRotate={-5} className="mx-auto max-w-md">
            <ImageSlot slot="career-welder-visor" alt={welder.alt} sizes="(min-width: 1024px) 420px, 90vw" />
          </CutPaperFrame>
        </div>
      </div>
    </section>
  );
}

/* 6 · Trust and verification — dense, ledger-like table of who checks what. */
export async function TrustSection() {
  const t = await getTranslations("marketing.trust");
  const rows = t.raw("rows") as { what: string; how: string; who: string }[];
  return (
    <section aria-labelledby="trust-title" className="border-border bg-surface border-y">
      <div className={cn(WRAP, "grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20")}>
        <div className="lg:col-span-4">
          <Kicker>{t("kicker")}</Kicker>
          <h2 id="trust-title" className="text-fg mt-3 text-3xl leading-tight font-extrabold">
            {t("title")}
          </h2>
          <p className="text-fg-body mt-3">{t("body")}</p>
        </div>
        <div className="lg:col-span-8">
          <table className="w-full border-collapse text-left">
            <thead className="max-sm:sr-only">
              <tr className="border-fg border-b-2 text-sm">
                <th scope="col" className="text-fg py-2 pr-4 font-semibold sm:w-36">{t("col_what")}</th>
                <th scope="col" className="text-fg py-2 pr-4 font-semibold">{t("col_how")}</th>
                <th scope="col" className="text-fg py-2 font-semibold sm:w-56">{t("col_who")}</th>
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
      </div>
    </section>
  );
}

/* 7 · Trades (bilingual chips) with two worker portrait slots. */
export async function TradesSection() {
  const t = await getTranslations("marketing.trades");
  const locale = await getLocale();
  const list = t.raw("list") as { en: string; ne: string }[];
  const tones = [
    "bg-brand-subtle text-brand-subtle-fg",
    "bg-teal-subtle text-teal-text",
    "bg-coral-subtle text-coral-text",
    "bg-yellow-subtle text-fg",
  ];
  const cook = await slotText("worker-cook-kitchen");
  const guard = await slotText("worker-guard-gate");
  return (
    <section aria-labelledby="trades-title" className="bg-bg">
      <div className={cn(WRAP, "grid items-center gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
        <div className="lg:col-span-7">
          <h2 id="trades-title" className="text-fg text-3xl leading-tight font-extrabold">
            {t("title")}
          </h2>
          <p className="text-fg-body mt-3 max-w-xl">{t("body")}</p>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {list.map((tr, i) => {
              const first = locale === "ne" ? tr.ne : tr.en;
              const second = locale === "ne" ? tr.en : tr.ne;
              return (
                <li key={tr.en} className={cn("rounded-pill px-4 py-2.5 text-[15px] font-semibold", tones[i % 4])}>
                  {first}
                  <span className="font-normal" lang={locale === "ne" ? "en" : "ne"}>
                    {" · "}
                    {second}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="relative mx-auto h-[400px] w-full max-w-[420px] sm:h-[470px] lg:col-span-5">
          <CutPaperFrame caption={cook.caption} tag={cook.tag} tape="teal" rotate={-4} className="absolute top-0 left-0 w-[50%]">
            <ImageSlot slot="worker-cook-kitchen" alt={cook.alt} sizes="220px" />
          </CutPaperFrame>
          <CutPaperFrame
            caption={guard.caption}
            tag={guard.tag}
            tape="yellow"
            rotate={5}
            tapeRotate={-4}
            className="absolute right-0 bottom-0 w-[50%]"
          >
            <ImageSlot slot="worker-guard-gate" alt={guard.alt} sizes="220px" />
          </CutPaperFrame>
        </div>
      </div>
    </section>
  );
}

/* 8 · Employers and workers — asymmetric split, different weights on purpose. */
export async function AudienceSection() {
  const t = await getTranslations("marketing");
  const ePoints = t.raw("employers.points") as string[];
  const wPoints = t.raw("workers.points") as string[];
  const sup = await slotText("employer-supervisor-hajiri");
  const phone = await slotText("passport-hands-phone");
  return (
    <section aria-label={`${t("employers.kicker")} · ${t("workers.kicker")}`} className="bg-bg pb-16 lg:pb-24">
      <div className={cn(WRAP, "grid gap-6 lg:grid-cols-12")}>
        <article id="employers" aria-labelledby="employers-title" className="border-border bg-surface scroll-mt-20 overflow-hidden rounded-card border lg:col-span-7">
          <ImageSlot slot="employer-supervisor-hajiri" alt={sup.alt} sizes="(min-width: 1024px) 700px, 92vw" />
          <div className="p-6 sm:p-8">
            <Kicker>{t("employers.kicker")}</Kicker>
            <h2 id="employers-title" className="text-fg mt-2 text-2xl leading-tight font-extrabold sm:text-3xl">
              {t("employers.title")}
            </h2>
            <p className="text-fg-body mt-3">{t("employers.body")}</p>
            <ul className="mt-5 space-y-2.5">
              {ePoints.map((p) => (
                <li key={p} className="text-fg flex items-start gap-2.5 text-[15px]">
                  <Check className="text-brand-text mt-0.5 size-4 shrink-0" strokeWidth={3} aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "mt-7")}>
              {t("employers.cta")}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </article>

        <article
          id="workers"
          aria-labelledby="workers-title"
          className="bg-verified-subtle relative isolate scroll-mt-20 overflow-hidden rounded-card p-6 sm:p-8 lg:col-span-5"
        >
          <DotTexture tone="ink" className="-z-10" />
          <Kicker className="text-teal-text">{t("workers.kicker")}</Kicker>
          <h2 id="workers-title" className="text-fg mt-2 text-2xl leading-tight font-extrabold sm:text-3xl">
            {t("workers.title")}
          </h2>
          <p className="text-fg-body mt-3">{t("workers.body")}</p>
          <ul className="mt-5 space-y-2.5">
            {wPoints.map((p) => (
              <li key={p} className="text-fg flex items-start gap-2.5 text-[15px]">
                <Check className="text-teal-text mt-0.5 size-4 shrink-0" strokeWidth={3} aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-6">
            <Link
              href="/help?audience=worker"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "whitespace-normal")}
            >
              {t("workers.cta")}
            </Link>
            <CutPaperFrame tape="coral" rotate={6} padding="sm" className="mr-2 w-28 shrink-0 sm:w-40">
              <ImageSlot slot="passport-hands-phone" alt={phone.alt} sizes="160px" />
            </CutPaperFrame>
          </div>
        </article>
      </div>
    </section>
  );
}

/* 9 · Outcomes (placeholders until pilot data) + partner ecosystem (no logos). */
export async function ProofSection() {
  const t = await getTranslations("marketing.proof");
  const metrics = t.raw("metrics") as string[];
  const partners = t.raw("partners") as { title: string; body: string }[];
  const lab = await slotText("partners-training-lab");
  return (
    <section aria-labelledby="outcomes-title" className="border-border bg-surface border-t">
      <div className={cn(WRAP, "grid gap-14 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20")}>
        <div className="lg:col-span-5">
          <h2 id="outcomes-title" className="text-fg text-2xl font-extrabold">
            {t("outcomes_title")}
          </h2>
          <p className="text-fg-body mt-2">{t("outcomes_body")}</p>
          <dl className="border-border divide-border mt-6 divide-y border-y">
            {metrics.map((m) => (
              <div key={m} className="flex items-baseline justify-between gap-4 py-3.5">
                <dt className="text-fg font-medium">{m}</dt>
                <dd className="border-warning/40 bg-warning-soft text-warning tabular shrink-0 rounded-sm border border-dashed px-2 py-0.5 text-xs font-semibold">
                  {t("placeholder")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <h2 className="text-fg text-2xl font-extrabold">{t("partners_title")}</h2>
          <p className="text-fg-body mt-2">{t("partners_body")}</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_160px]">
            <ul className="space-y-4">
              {partners.map((p) => (
                <li key={p.title}>
                  <p className="text-fg font-semibold">{p.title}</p>
                  <p className="text-fg-body text-sm">{p.body}</p>
                </li>
              ))}
            </ul>
            <figure className="m-0 hidden sm:block">
              <ImageSlot slot="partners-training-lab" alt={lab.alt} className="rounded-dense" sizes="160px" />
            </figure>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <Link href="/developers" className="text-brand-text inline-flex min-h-8 items-center gap-1 hover:underline">
              {t("developers")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/partners/docs" className="text-brand-text inline-flex min-h-8 items-center gap-1 hover:underline">
              {t("partner_api")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* 10 · Pricing + CTA band. */
export async function PricingBand() {
  const t = await getTranslations("marketing.pricing");
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-hero text-hero-fg relative isolate scroll-mt-20 overflow-hidden">
      <DotTexture className="-z-10" />
      <BrushStroke variant="arc" tone="yellow" className="absolute -top-2 right-6 -z-10 hidden h-28 w-28 sm:block" />
      <div className={cn(WRAP, "flex flex-col gap-8 py-14 lg:flex-row lg:items-center lg:justify-between lg:py-16")}>
        <div className="max-w-3xl">
          <h2 id="pricing-title" className="text-hero-fg text-2xl leading-tight font-extrabold sm:text-[34px] sm:leading-[42px]">
            {t("title")}
          </h2>
          <p className="text-hero-muted mt-3">{t("body")}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="bg-yellow text-on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 font-bold hover:brightness-95"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/help"
            className="text-hero-fg inline-flex min-h-12 items-center justify-center rounded-control border-2 border-white/80 px-6 font-semibold hover:bg-white/10"
          >
            {t("secondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
