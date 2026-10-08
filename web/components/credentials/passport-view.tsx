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
  Lock,
  Phone,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle } from "@/components/providers/preferences";
import { PassportCard, type PassportCardChip } from "@/components/signature/passport-card";
import { LADDER_RUNGS, SkillLadder, rungsForLevel } from "@/components/signature/skill-ladder";
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
 * Public "KAAM ID / Skill Passport" (server component, B · street mural). Verified data only — the
 * payload comes from /public/passport/*, which already filters to verified credentials and hides
 * contact unless the worker allowed it. Components: PassportCard (skill gradient, सीप watermark,
 * cut-paper photo), SkillLadder (bars), verified-record timeline.
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
  const tm = await getTranslations("marketing");
  const tApp = await getTranslations("app");
  const d = (n: number | string) => localizeDigits(n, locale);
  const date = (ad: string | null | undefined, bs?: string | null) =>
    formatDateParts(ad, locale, bs).bs;
  const level = Math.max(0, Math.min(5, Math.round(p.verification_level ?? 0)));
  const rungs = rungsForLevel(level);
  const name = locale === "ne" && p.name_ne ? p.name_ne : p.name;
  const altName = locale === "ne" ? (p.name_ne ? p.name : null) : p.name_ne;
  const photo = mediaSrc(p.photo_url);
  const trade = p.trade_primary ? pickName(p.trade_primary, locale) : null;
  const districts = p.districts.map((x) => pickName(x, locale)).join(" · ");
  const checkedOn = p.generated_at.slice(0, 10);
  const verifyHost = p.verify_url.replace(/^https?:\/\//, "");

  const topNstb = p.skills.find((s) => s.nstb_level)?.nstb_level ?? null;
  const chips: PassportCardChip[] = [
    ...(p.identity.citizenship ? [{ label: tl("1") }] : []),
    ...(topNstb ? [{ label: t("nstb", { level: tn(topNstb) }) }] : []),
    { label: tm("passport.chip_ladder", { n: d(rungs) }), accent: true },
  ];

  const nextKey = rungs < 5 ? LADDER_RUNGS[rungs] : null;

  // Verified record timeline: certificates and skill tests with dates, newest first.
  const timeline = [
    ...p.credentials
      .filter((c) => c.issued_on)
      .map((c) => ({
        key: `c-${c.title}-${c.issued_on}`,
        when: c.issued_on as string,
        whenBs: c.issued_on_bs,
        title: c.title,
        sub: `${tm("passport.timeline_issued")} · ${c.issuer}`,
      })),
    ...p.assessments.map((a, i) => ({
      key: `a-${a.trade.code}-${i}`,
      when: a.assessed_on,
      whenBs: a.assessed_on_bs,
      title: `${pickName(a.trade, locale)}${a.level ? ` · ${a.level}` : ""}`,
      sub: tm("passport.timeline_tested"),
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));

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
          <p className="border-border bg-surface text-fg-body mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-dense border px-4 py-2.5 text-sm print:hidden">
            <Link2 className="text-fg-muted size-4" aria-hidden />
            <span className="text-fg font-medium">
              {t("shared_with", { label: p.share.audience_label })}
            </span>
            <span className="text-fg-muted">
              · {t("share_expires", { date: formatDateTime(p.share.expires_at, locale) })}
            </span>
          </p>
        ) : null}

        <article aria-labelledby="passport-name" className="space-y-4 [print-color-adjust:exact]">
          <section aria-label={tm("passport.card_label")}>
            <PassportCard
              brand={t("brand")}
              name={name}
              altName={altName}
              altLang={locale === "ne" ? "en" : "ne"}
              line={[trade, districts].filter(Boolean).join(" · ") || null}
              photoUrl={photo}
              photoLabel={tm("passport.photo_label")}
              initials={initials(p.name)}
              chips={chips}
              verifiedLabel={t("verified_by")}
              headingAs="h1"
              headingId="passport-name"
              className="print:rounded-none"
            />
          </section>

          {/* Ladder + level + QR */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <section
              aria-labelledby="ladder-title"
              className="border-border bg-surface rounded-card border p-4 sm:p-5 [break-inside:avoid]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="ladder-title" className="text-fg text-base font-extrabold">
                  {tm("passport.ladder_title")}
                </h2>
                <p className="text-fg-muted text-xs">
                  <span className="text-fg font-semibold">{tl(String(level))}</span> ·{" "}
                  {t("level_n", { n: d(level) })}
                </p>
              </div>
              <SkillLadder earned={rungs} variant="bars" className="mt-4" />
              <p className="text-fg-body mt-3 text-sm">
                {nextKey
                  ? tm("passport.next_rung", {
                      rung: tm(`ladder.rungs.${nextKey}.label`),
                      hint: tm(`ladder.rungs.${nextKey}.hint`),
                    })
                  : tm("passport.top_rung")}
              </p>
            </section>
            {qr ? (
              <figure className="border-border bg-surface m-0 flex items-center gap-4 rounded-card border p-4 sm:w-44 sm:flex-col sm:gap-1.5 [break-inside:avoid]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={t("scan")} className="size-24 shrink-0 rounded-dense bg-white p-1.5 sm:size-32" />
                <figcaption className="text-fg-muted text-sm leading-snug sm:text-center sm:text-[11px] sm:leading-tight">
                  {t("scan")}
                </figcaption>
              </figure>
            ) : null}
          </div>

          <div className="border-border bg-surface grid gap-x-8 gap-y-7 rounded-card border px-5 py-6 sm:px-7 md:grid-cols-2 print:grid-cols-2">
            {/* Reliability */}
            <Section icon={BadgeCheck} title={t("reliability")} className="md:col-span-2 print:col-span-2">
              {p.reliability_score !== null && p.reliability_score !== undefined ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-fg tabular text-3xl font-extrabold">{d(p.reliability_score)}</span>
                  <span className="text-fg-muted tabular text-sm">/ {d(100)}</span>
                </div>
              ) : (
                <p className="text-fg-body text-sm">{t("reliability_none")}</p>
              )}
              <p className="text-fg-muted mt-1 max-w-md text-xs">{t("reliability_hint")}</p>
            </Section>

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
            <Section icon={Wrench} title={t("skills")}>
              {p.skills.length ? (
                <ul className="space-y-2">
                  {p.skills.map((s) => (
                    <li key={s.trade.code} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-fg font-medium">{pickName(s.trade, locale)}</span>
                      <span className="text-fg-muted flex items-center gap-2 text-xs">
                        {t("years", { count: s.years })}
                        {s.nstb_level ? (
                          <span className="bg-brand-subtle text-brand-subtle-fg rounded-pill px-2 py-0.5 font-semibold">
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
            <Section icon={ShieldCheck} title={t("credentials")} className="md:col-span-2 print:col-span-2">
              {p.credentials.length ? (
                <ul className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                  {p.credentials.map((c, i) => (
                    <li
                      key={`${c.title}-${i}`}
                      className="border-border border-l-teal bg-surface relative rounded-dense border border-l-4 p-4 [break-inside:avoid]"
                    >
                      <p className="text-fg-muted text-xs font-medium">{c.kind_label}</p>
                      <p className="text-fg mt-0.5 font-semibold">
                        {c.title}
                        {c.level ? <span className="text-fg-muted font-normal"> · {c.level}</span> : null}
                      </p>
                      <p className="text-fg-body mt-0.5 text-sm">{c.issuer}</p>
                      <div className="text-fg-muted tabular mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {c.issued_on ? <span>{t("issued", { date: date(c.issued_on, c.issued_on_bs) })}</span> : null}
                        <span>
                          {c.expires_on
                            ? t("valid_until", { date: date(c.expires_on, c.expires_on_bs) })
                            : t("no_expiry")}
                        </span>
                        {c.certificate_no ? <span>{t("certificate_no", { no: c.certificate_no })}</span> : null}
                      </div>
                      <p className="bg-success-subtle text-success mt-3 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold">
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
              <Section icon={ClipboardCheck} title={t("assessments")} className="md:col-span-2 print:col-span-2">
                <ul className="flex flex-wrap gap-2">
                  {p.assessments.map((a, i) => (
                    <li
                      key={`${a.trade.code}-${i}`}
                      className="border-border inline-flex items-center gap-2 rounded-dense border px-3 py-2 text-sm"
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
            <Section icon={Briefcase} title={t("work")} hint={t("work_hint")} className="md:col-span-2 print:col-span-2">
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

            {/* Verified record timeline */}
            <Section
              icon={CalendarCheck}
              title={tm("passport.timeline_title")}
              hint={tm("passport.timeline_hint")}
              className="md:col-span-2 print:col-span-2"
            >
              {timeline.length ? (
                <ol className="space-y-3">
                  {timeline.map((e, i) => (
                    <li key={e.key} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-3 shrink-0 rotate-45 rounded-[3px]",
                          i % 2 === 0 ? "bg-coral" : "bg-teal",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-fg text-sm font-bold">{e.title}</p>
                        <p className="text-fg-muted text-xs">
                          <span className="tabular">{date(e.when, e.whenBs)}</span> · {e.sub}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-fg-muted text-sm">{tm("passport.timeline_empty")}</p>
              )}
            </Section>

            {/* Availability */}
            <Section icon={CalendarCheck} title={t("availability")}>
              <p className="text-fg inline-flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn("size-2 rounded-full", p.availability.is_available ? "bg-success-hue" : "bg-fg-muted")}
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
                  className="border-border text-fg tabular hover:bg-surface-hover inline-flex min-h-11 items-center gap-2 rounded-control border px-3 py-2 text-sm font-semibold"
                >
                  <Phone className="text-brand-text size-4" aria-hidden />
                  {formatPhone(p.contact.phone, locale)}
                </a>
              ) : (
                <p className="text-fg-muted text-sm">{t("contact_hidden")}</p>
              )}
            </Section>
          </div>

          <p className="bg-yellow-subtle text-fg flex items-start gap-3 rounded-card px-4 py-3 text-sm [break-inside:avoid]">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {tm("passport.privacy_note")}
          </p>

          <footer className="text-fg-muted space-y-1.5 px-1 text-xs">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-fg-body font-medium">{t("generated", { date: date(checkedOn) })}</span>
              <span aria-hidden>·</span>
              <span>
                {t("verify_link")}: <span className="text-brand-text tabular break-all">{verifyHost}</span>
              </span>
            </p>
            <p>{t("only_verified")}</p>
            <p>{t("worker_owns")}</p>
          </footer>
        </article>

        <aside className="border-border bg-surface mt-8 flex flex-col items-start gap-2 rounded-card border p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-fg text-sm font-semibold">{t("about")}</p>
            <p className="text-fg-muted text-sm">{t("about_body")}</p>
          </div>
          <Link
            href="/"
            className="text-brand-text inline-flex min-h-11 items-center gap-1 text-sm font-medium hover:underline"
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
      <h2 className="text-fg mb-2.5 flex items-center gap-2 text-sm font-bold">
        <Icon className="text-teal-text size-4" aria-hidden />
        {title}
      </h2>
      {hint ? <p className="text-fg-muted -mt-1 mb-2.5 text-xs">{hint}</p> : null}
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-dense border px-3 py-2.5">
      <dt className="text-fg-muted text-xs">{label}</dt>
      <dd className="text-fg tabular mt-0.5 text-xl font-semibold">{value}</dd>
    </div>
  );
}
