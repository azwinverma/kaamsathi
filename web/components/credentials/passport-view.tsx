import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  Fingerprint,
  Home,
  Link2,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle } from "@/components/providers/preferences";
import {
  formatDateParts,
  formatDateTime,
  formatMoney,
  formatPhone,
  initials,
  localizeDigits,
  type Locale,
} from "@/lib/format";
import type { PassportPayload } from "@/lib/api/types-credentials";
import { mediaSrc } from "@/lib/media";
import { cn, pickName } from "@/lib/utils";
import { PrintButton } from "./passport-actions";

/**
 * Public "KAAM ID / Skill Passport" (server component). Verified data only — the payload comes
 * from /public/passport/*, which already filters to verified credentials and hides contact
 * unless the worker allowed it.
 */
export async function PassportView({
  payload: p,
  qr,
  locale,
}: {
  payload: PassportPayload;
  qr: string | null;
  locale: Locale;
}) {
  const t = await getTranslations("credentials.passport");
  const tl = await getTranslations("credentials.level");
  const tn = await getTranslations("nstb");
  const tApp = await getTranslations("app");
  const d = (n: number | string) => localizeDigits(n, locale);
  const date = (ad: string | null | undefined, bs?: string | null) =>
    formatDateParts(ad, locale, bs).bs;
  const level = Math.max(0, Math.min(5, Math.round(p.verification_level ?? 0)));
  const name = locale === "ne" && p.name_ne ? p.name_ne : p.name;
  const altName = locale === "ne" ? (p.name_ne ? p.name : null) : p.name_ne;
  const photo = mediaSrc(p.photo_url);
  const trade = p.trade_primary ? pickName(p.trade_primary, locale) : null;
  const districts = p.districts.map((x) => pickName(x, locale)).join(" · ");
  const checkedOn = p.generated_at.slice(0, 10);
  const verifyHost = p.verify_url.replace(/^https?:\/\//, "");

  return (
    <div className="bg-bg min-h-dvh print:bg-white">
      <header className="border-border bg-surface/90 border-b backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Logo name={tApp("name")} />
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageToggle compact />
            <PrintButton label={t("print")} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-6 sm:py-10 print:max-w-none print:p-0">
        {p.share ? (
          <p className="border-border bg-surface text-fg-body mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-4 py-2.5 text-sm print:hidden">
            <Link2 className="text-fg-muted size-4" aria-hidden />
            <span className="text-fg font-medium">
              {t("shared_with", { label: p.share.audience_label })}
            </span>
            <span className="text-fg-muted">
              · {t("share_expires", { date: formatDateTime(p.share.expires_at, locale) })}
            </span>
          </p>
        ) : null}

        <article
          className="border-border bg-surface overflow-hidden rounded-2xl border shadow-sm [print-color-adjust:exact] print:rounded-none print:border-0 print:shadow-none"
          aria-labelledby="passport-name"
        >
          {/* Identity band */}
          <div className="bg-hero relative overflow-hidden px-5 pt-5 pb-6 text-hero-fg sm:px-8 sm:pt-7">
            <div
              className="absolute inset-0 opacity-[0.08]"
              aria-hidden
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage: "radial-gradient(ellipse at 85% 0%, black 15%, transparent 70%)",
              }}
            />
            <div className="bg-coral absolute inset-x-0 bottom-0 h-1" aria-hidden />
            <div className="relative flex items-center justify-between gap-3">
              <p className="text-hero-muted text-xs font-semibold tracking-[0.18em] uppercase">
                {t("brand")} <span className="text-hero-muted mx-1">·</span>
                <span className="tracking-normal normal-case">{t("title")}</span>
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-hero-fg ring-1 ring-white/20">
                <ShieldCheck className="size-3.5 text-hero-fg" aria-hidden />
                {t("verified_by")}
              </span>
            </div>

            <div className="relative mt-5 flex items-start gap-4 sm:gap-5">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="size-20 shrink-0 rounded-xl object-cover ring-2 ring-white/30 sm:size-24"
                />
              ) : (
                <span
                  className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl font-semibold text-hero-fg ring-2 ring-white/20 sm:size-24"
                  aria-hidden
                >
                  {initials(p.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h1
                  id="passport-name"
                  className="text-2xl leading-tight font-semibold text-hero-fg sm:text-3xl"
                >
                  {name}
                </h1>
                {altName ? (
                  <p
                    className="text-hero-muted mt-0.5 text-base"
                    lang={locale === "ne" ? "en" : "ne"}
                  >
                    {altName}
                  </p>
                ) : null}
                {trade ? <p className="mt-2 text-base font-medium text-hero-fg">{trade}</p> : null}
                {districts ? (
                  <p className="text-hero-muted mt-1 inline-flex items-center gap-1 text-sm">
                    <MapPin className="size-3.5" aria-hidden />
                    {districts}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Level + reliability + QR */}
          <div className="border-border grid gap-5 border-b px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-8">
            <div className="space-y-4">
              <div>
                <p className="text-fg-muted text-xs font-medium">{t("level_label")}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="bg-success-subtle text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
                    <BadgeCheck className="size-4" aria-hidden />
                    {tl(String(level))}
                  </span>
                  <span className="text-fg-muted tabular text-sm">
                    {t("level_n", { n: d(level) })}
                  </span>
                </div>
                <ol className="mt-2.5 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <li
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        i <= level ? "bg-success" : "bg-surface-hover",
                      )}
                    />
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-fg-muted text-xs font-medium">{t("reliability")}</p>
                {p.reliability_score !== null && p.reliability_score !== undefined ? (
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-fg tabular text-3xl font-semibold">
                      {d(p.reliability_score)}
                    </span>
                    <span className="text-fg-muted tabular text-sm">/ {d(100)}</span>
                  </div>
                ) : (
                  <p className="text-fg-body mt-1 text-sm">{t("reliability_none")}</p>
                )}
                <p className="text-fg-muted mt-1 max-w-md text-xs">{t("reliability_hint")}</p>
              </div>
            </div>
            {qr ? (
              <figure className="flex flex-col items-center gap-1.5 self-start sm:w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt={t("scan")}
                  className="border-border size-32 rounded-lg border bg-white p-1.5"
                />
                <figcaption className="text-fg-muted text-center text-[11px] leading-tight">
                  {t("scan")}
                </figcaption>
              </figure>
            ) : null}
          </div>

          <div className="grid gap-x-8 gap-y-7 px-5 py-6 sm:px-8 md:grid-cols-2 print:grid-cols-2">
            {/* Identity checks */}
            <Section icon={Fingerprint} title={t("identity")}>
              <ul className="space-y-2">
                {(
                  [
                    ["citizenship", p.identity.citizenship],
                    ["phone", p.identity.phone],
                    ["address", p.identity.address],
                  ] as const
                ).map(([key, ok]) => (
                  <li key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-fg-body">{t(key)}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold",
                        ok ? "text-success" : "text-fg-subtle",
                      )}
                    >
                      {ok ? <BadgeCheck className="size-3.5" aria-hidden /> : null}
                      {ok ? t("verified") : t("not_verified")}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Skills */}
            <Section icon={Sparkles} title={t("skills")}>
              {p.skills.length ? (
                <ul className="space-y-2">
                  {p.skills.map((s) => (
                    <li
                      key={s.trade.code}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-fg font-medium">{pickName(s.trade, locale)}</span>
                      <span className="text-fg-muted flex items-center gap-2 text-xs">
                        {t("years", { count: s.years })}
                        {s.nstb_level ? (
                          <span className="bg-brand-subtle text-brand-subtle-fg rounded-full px-2 py-0.5 font-semibold">
                            {t("nstb", { level: tn(s.nstb_level) })}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted text-sm">—</p>
              )}
            </Section>

            {/* Credentials */}
            <Section
              icon={ShieldCheck}
              title={t("credentials")}
              className="md:col-span-2 print:col-span-2"
            >
              {p.credentials.length ? (
                <ul className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                  {p.credentials.map((c, i) => (
                    <li
                      key={`${c.title}-${i}`}
                      className="border-border bg-surface relative [break-inside:avoid] rounded-xl border p-4"
                    >
                      <p className="text-fg-muted text-xs font-medium">{c.kind_label}</p>
                      <p className="text-fg mt-0.5 font-semibold">
                        {c.title}
                        {c.level ? (
                          <span className="text-fg-muted font-normal"> · {c.level}</span>
                        ) : null}
                      </p>
                      <p className="text-fg-body mt-0.5 text-sm">{c.issuer}</p>
                      <div className="text-fg-muted tabular mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {c.issued_on ? (
                          <span>{t("issued", { date: date(c.issued_on, c.issued_on_bs) })}</span>
                        ) : null}
                        <span>
                          {c.expires_on
                            ? t("valid_until", { date: date(c.expires_on, c.expires_on_bs) })
                            : t("no_expiry")}
                        </span>
                        {c.certificate_no ? (
                          <span>{t("certificate_no", { no: c.certificate_no })}</span>
                        ) : null}
                      </div>
                      <p className="bg-success-subtle text-success mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        <BadgeCheck className="size-3" aria-hidden />
                        {t("verified_by")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted text-sm">{t("no_credentials")}</p>
              )}
            </Section>

            {p.assessments.length ? (
              <Section
                icon={ClipboardCheck}
                title={t("assessments")}
                className="md:col-span-2 print:col-span-2"
              >
                <ul className="flex flex-wrap gap-2">
                  {p.assessments.map((a, i) => (
                    <li
                      key={`${a.trade.code}-${i}`}
                      className="border-border inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <BadgeCheck className="text-success size-4" aria-hidden />
                      <span className="text-fg font-medium">{pickName(a.trade, locale)}</span>
                      {a.level ? <span className="text-fg-muted">· {a.level}</span> : null}
                      <span className="text-fg-muted text-xs">
                        {t("assessed_on", { date: date(a.assessed_on, a.assessed_on_bs) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* Work record */}
            <Section
              icon={Briefcase}
              title={t("work")}
              hint={t("work_hint")}
              className="md:col-span-2 print:col-span-2"
            >
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
                <Stat label={t("employers")} value={d(p.work.verified_employers)} />
                <Stat label={t("months")} value={d(p.work.total_months)} />
                <Stat label={t("completed_jobs")} value={d(p.work.completed_jobs)} />
                <Stat
                  label={t("attendance")}
                  value={
                    p.work.attendance_rate !== null
                      ? `${d(Math.round(p.work.attendance_rate * 100))}%`
                      : t("not_enough_data")
                  }
                />
              </dl>
            </Section>

            {/* Availability */}
            <Section icon={CalendarCheck} title={t("availability")}>
              <p className="text-fg inline-flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    p.availability.is_available ? "bg-success-hue" : "bg-fg-muted",
                  )}
                  aria-hidden
                />
                {p.availability.is_available ? t("available") : t("not_available")}
              </p>
              {p.availability.expected_monthly_wage ? (
                <p className="text-fg-body mt-1.5 text-sm">
                  {t("expected_wage")}:{" "}
                  <span className="text-fg tabular font-semibold">
                    {formatMoney(p.availability.expected_monthly_wage, locale)}
                  </span>
                </p>
              ) : null}
            </Section>

            {/* Contact */}
            <Section icon={Phone} title={t("contact")}>
              {p.contact ? (
                <a
                  href={`tel:+977${p.contact.phone}`}
                  className="border-border text-fg tabular hover:bg-surface-hover inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold"
                >
                  <Phone className="text-brand-text size-4" aria-hidden />
                  {formatPhone(p.contact.phone, locale)}
                </a>
              ) : (
                <p className="text-fg-muted text-sm">{t("contact_hidden")}</p>
              )}
            </Section>
          </div>

          <footer className="border-border bg-surface-muted/60 text-fg-muted space-y-1.5 border-t px-5 py-4 text-xs sm:px-8">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-fg-body font-medium">
                {t("generated", { date: date(checkedOn) })}
              </span>
              <span aria-hidden>·</span>
              <span>
                {t("verify_link")}:{" "}
                <span className="text-brand-text tabular break-all">{verifyHost}</span>
              </span>
            </p>
            <p>{t("only_verified")}</p>
            <p>{t("worker_owns")}</p>
          </footer>
        </article>

        <aside className="border-border bg-surface mt-6 flex flex-col items-start gap-2 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-fg text-sm font-semibold">{t("about")}</p>
            <p className="text-fg-muted text-sm">{t("about_body")}</p>
          </div>
          <Link
            href="/"
            className="text-brand-text inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <Home className="size-4" aria-hidden />
            {t("home")}
          </Link>
        </aside>
      </main>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 [break-inside:avoid]", className)}>
      <h2 className="text-fg mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <span className="bg-brand-subtle text-brand-text flex size-7 items-center justify-center rounded-md">
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      {hint ? <p className="text-fg-muted -mt-1 mb-2.5 text-xs">{hint}</p> : null}
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-lg border px-3 py-2.5">
      <dt className="text-fg-muted text-xs">{label}</dt>
      <dd className="text-fg tabular mt-0.5 text-xl font-semibold">{value}</dd>
    </div>
  );
}
