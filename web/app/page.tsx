import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck,
  FileSpreadsheet,
  HeartHandshake,
  MapPin,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserSearch,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: { absolute: `${t("app.name")} — ${t("landing.headline")}` }, description: t("landing.subhead") };
}

export default async function Home() {
  const t = await getTranslations();

  const sections: {
    id: string;
    eyebrow: string;
    title: string;
    body: string;
    points: { icon: LucideIcon; text: string }[];
  }[] = [
    {
      id: "hire",
      eyebrow: t("nav.hire"),
      title: t("landing.hire_title"),
      body: t("landing.hire_body"),
      points: [
        { icon: BadgeCheck, text: t("landing.hire_p1") },
        { icon: UserSearch, text: t("landing.hire_p2") },
        { icon: HeartHandshake, text: t("landing.hire_p3") },
      ],
    },
    {
      id: "manage",
      eyebrow: t("nav.manage"),
      title: t("landing.manage_title"),
      body: t("landing.manage_body"),
      points: [
        { icon: QrCode, text: t("landing.manage_p1") },
        { icon: MapPin, text: t("landing.manage_p2") },
        { icon: CalendarCheck, text: t("landing.manage_p3") },
      ],
    },
    {
      id: "payroll",
      eyebrow: t("nav.pay"),
      title: t("landing.payroll_title"),
      body: t("landing.payroll_body"),
      points: [
        { icon: FileSpreadsheet, text: t("landing.payroll_p1") },
        { icon: ShieldCheck, text: t("landing.payroll_p2") },
        { icon: Wallet, text: t("landing.payroll_p3") },
      ],
    },
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-brand-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("common.skip_to_content")}
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo name={t("app.name")} />
          <nav className="ml-6 hidden items-center gap-5 text-sm text-fg-muted md:flex" aria-label={t("app.name")}>
            <a href="#hire" className="hover:text-fg">{t("nav.hire")}</a>
            <a href="#manage" className="hover:text-fg">{t("nav.manage")}</a>
            <a href="#payroll" className="hover:text-fg">{t("nav.payroll")}</a>
            <a href="#pricing" className="hover:text-fg">{t("nav.pricing")}</a>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageToggle compact />
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "ml-1 max-sm:hidden")}>
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary-900 text-white">
          <div
            className="absolute inset-0 opacity-[0.1]"
            aria-hidden
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at 30% 30%, black 20%, transparent 75%)",
            }}
          />
          <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary-600/40 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-primary-100 ring-1 ring-white/15">
              <span className="size-1.5 rounded-full bg-accent-500" aria-hidden />
              {t("landing.eyebrow")}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold text-white sm:text-5xl sm:leading-[56px]">
              {t("landing.headline")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-primary-100/85">{t("landing.subhead")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary-800 hover:bg-primary-50")}>
                {t("landing.cta_employer")}
                <ArrowRight aria-hidden />
              </Link>
              <a
                href="#workers"
                className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "text-white ring-1 ring-white/25 hover:bg-white/10 hover:text-white")}
              >
                {t("nav.for_workers")}
              </a>
            </div>
            <ul className="mt-12 grid max-w-3xl grid-cols-1 gap-4 text-sm text-primary-100/85 sm:grid-cols-3">
              {[t("landing.stat_1"), t("landing.stat_2"), t("landing.stat_3")].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <BadgeCheck className="size-4 shrink-0 text-white" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Hire / Manage / Payroll */}
        <div className="mx-auto max-w-6xl space-y-20 px-4 py-20 sm:px-6">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-20">
              <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={cn("space-y-3", i % 2 === 1 && "lg:order-2")}>
                  <p className="text-sm font-semibold text-accent">{s.eyebrow}</p>
                  <h2 id={`${s.id}-title`} className="text-3xl font-semibold text-fg">
                    {s.title}
                  </h2>
                  <p className="text-base text-fg-muted">{s.body}</p>
                </div>
                <ul className="space-y-3">
                  {s.points.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="pt-2 text-sm text-fg-body">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        {/* Pricing */}
        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-y border-border bg-surface-muted">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="pricing-title" className="text-3xl font-semibold text-fg">
              {t("landing.pricing_title")}
            </h2>
            <p className="mt-2 max-w-2xl text-fg-muted">{t("landing.pricing_body")}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <UserSearch className="size-6 text-brand" aria-hidden />
                <p className="mt-3 text-sm font-medium text-fg-muted">{t("landing.price_hire_label")}</p>
                <p className="mt-1 text-3xl font-semibold text-fg tabular">{t("landing.price_hire")}</p>
                <p className="mt-2 text-sm text-fg-muted">{t("landing.price_hire_note")}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <Banknote className="size-6 text-brand" aria-hidden />
                <p className="mt-3 text-sm font-medium text-fg-muted">{t("landing.price_manage_label")}</p>
                <p className="mt-1 text-3xl font-semibold text-fg tabular">{t("landing.price_manage")}</p>
                <p className="mt-2 text-sm text-fg-muted">{t("landing.price_manage_note")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Workers */}
        <section id="workers" aria-labelledby="workers-title" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 sm:px-6 md:grid-cols-[auto_1fr]">
            <span className="flex size-14 items-center justify-center rounded-xl bg-success-subtle text-success">
              <Smartphone className="size-7" aria-hidden />
            </span>
            <div className="space-y-2">
              <h2 id="workers-title" className="text-2xl font-semibold text-fg">
                {t("landing.workers_title")}
              </h2>
              <p className="max-w-3xl text-fg-muted">{t("landing.workers_body")}</p>
              <p className="inline-flex rounded-full bg-success-subtle px-3 py-1 text-sm font-semibold text-success">
                {t("landing.workers_free")}
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 rounded-xl bg-brand px-6 py-10 text-brand-fg sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">{t("landing.cta_title")}</h2>
              <p className="opacity-85">{t("landing.cta_body")}</p>
            </div>
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary-800 hover:bg-primary-50")}>
              {t("landing.cta_employer")}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:justify-between sm:px-6">
          <span>© KaamSathi · {t("landing.footer_place")}</span>
          <span>{t("app.tagline")}</span>
        </div>
      </footer>
    </div>
  );
}
