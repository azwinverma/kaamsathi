import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, Languages, MapPin, Star } from "lucide-react";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { DotTexture } from "@/components/signature/dot-texture";
import { SkillLadder } from "@/components/signature/skill-ladder";
import { rungsForLevelPure } from "@/lib/bolau/ladder";
import { summaryRules, weeklySummary } from "@/lib/bolau/slots";
import type { PublicSipalu } from "@/lib/api/types-bolau";
import { adToBs, formatBs, formatClock, formatMoney, localizeDigits, weekdayName, type Locale } from "@/lib/format";
import { mediaSrc } from "@/lib/media";
import { cn, pickName } from "@/lib/utils";
import { NextAvailable, PriceText, RatingInline, SipaluPortrait } from "./bits";
import { BolauChrome, WRAP } from "./chrome";
import { FavouriteButton } from "./favourite-button";

const SECTION = "border-border border-t pt-8";

function Stars({ score, label }: { score: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          strokeWidth={1.5}
          className={cn("size-4", i <= score ? "fill-yellow stroke-on-accent" : "stroke-border-strong fill-none")}
        />
      ))}
    </span>
  );
}

/**
 * Public Sipalu profile (B · street mural). Components: BolauChrome, mural strip header (DotTexture,
 * BrushStroke, CutPaperFrame portrait via SipaluPortrait), SkillLadder (bars), services with
 * PriceText, weekly availability strip, service areas, portfolio grid, moderated reviews, badges,
 * FavouriteButton and the Bolau CTA (sticky on phones). Never shows phone, address, ID or location.
 */
export async function SipaluProfileView({ p, locale }: { p: PublicSipalu; locale: Locale }) {
  const t = await getTranslations("bolau");
  const tl = await getTranslations("credentials.level");
  const tn = await getTranslations("nstb");
  const d = (n: number | string) => localizeDigits(n, locale);
  const name = locale === "ne" && p.name_ne ? p.name_ne : p.name;
  const altName = locale === "ne" ? (p.name_ne ? p.name : null) : p.name_ne;
  const headline = locale === "ne" && p.headline_ne ? p.headline_ne : p.headline;
  const bio = locale === "ne" && p.bio_ne ? p.bio_ne : p.bio;
  const level = Math.max(0, Math.min(5, Math.round(p.verification_level ?? 0)));
  const bookable = p.bookable !== false;
  const bookHref = `/bolau/book/${p.handle}`;
  const firstName = name.split(/\s+/)[0] ?? name;
  const rules = summaryRules(p.availability_summary);
  const weekly = weeklySummary(rules);
  const dayHours = new Map<number, string>();
  for (const w of weekly) for (const day of w.days) dayHours.set(day, `${formatClock(w.start, locale)}–${formatClock(w.end, locale)}`);
  const resp = p.response_time_minutes;
  const respText =
    resp === null || resp === undefined
      ? null
      : resp < 90
        ? t("profile.response_minutes", { n: d(Math.max(5, Math.round(resp / 5) * 5)) })
        : t("profile.response_hours", { n: d(Math.round(resp / 60)) });
  const services = p.services.filter((s) => s.is_active !== false);
  const fromPrice = p.from_price ?? services.find((s) => s.price)?.price ?? null;

  const bookButton = (className?: string) =>
    bookable ? (
      <Link
        href={bookHref}
        className={cn(
          "bg-yellow text-on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 text-base font-bold hover:brightness-95",
          className,
        )}
      >
        {t("profile.book", { name: firstName })}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    ) : null;

  return (
    <BolauChrome>
      {/* Mural strip header */}
      <section aria-labelledby="sipalu-name" className="bg-hero text-hero-fg relative isolate overflow-hidden">
        <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
        <DotTexture className="-z-10" />
        <BrushStroke variant="zigzag" tone="yellow" className="absolute top-6 right-6 hidden h-10 w-36 opacity-90 md:block" />
        <div className={cn(WRAP, "pt-6 pb-12 sm:pb-14")}>
          <Link
            href="/bolau"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-white/90 hover:text-white hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("profile.back")}
          </Link>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            <SipaluPortrait name={name} photoUrl={p.photo_url} size="lg" rotate={-4} tape="yellow" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h1 id="sipalu-name" className="text-hero-fg text-3xl leading-tight font-extrabold sm:text-[40px] sm:leading-[48px]">
                  {name}
                </h1>
                {altName ? (
                  <p lang={locale === "ne" ? "en" : "ne"} className="text-lg text-white/85">
                    {altName}
                  </p>
                ) : null}
              </div>
              {headline ? <p className="max-w-2xl text-lg text-white/95">{headline}</p> : null}
              <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="bg-verified-subtle text-verified inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 font-semibold">
                  <BadgeCheck className="size-4" aria-hidden />
                  {t("profile.verified")}
                </span>
                <span className="font-semibold">{t("profile.jobs", { count: p.jobs_completed })}</span>
                {respText ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-4" aria-hidden />
                    {t("profile.response", { time: respText })}
                  </span>
                ) : null}
              </p>
              <div className="bg-surface text-fg inline-flex rounded-pill px-3 py-1">
                <RatingInline avg={p.rating_avg} count={p.rating_count} />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {bookable ? (
                bookButton()
              ) : (
                <p className="max-w-xs rounded-dense bg-white/10 px-3 py-2 text-sm">
                  {t("profile.not_bookable", { name: firstName })}
                </p>
              )}
              <FavouriteButton handle={p.handle} name={name} />
            </div>
          </div>
        </div>
      </section>

      <div className={cn(WRAP, "grid gap-10 py-10 lg:grid-cols-12 lg:gap-12")}>
        <div className="space-y-10 lg:col-span-7">
          {bio ? (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="text-fg text-xl font-extrabold">
                {t("profile.about", { name: firstName })}
              </h2>
              <p className="text-fg-body mt-3 text-base leading-relaxed whitespace-pre-line">{bio}</p>
            </section>
          ) : null}

          <section aria-labelledby="services-title" className={bio ? SECTION : undefined}>
            <h2 id="services-title" className="text-fg text-xl font-extrabold">
              {t("profile.services")}
            </h2>
            {services.length ? (
              <ul className="mt-4">
                {services.map((s) => {
                  const title = locale === "ne" && s.title_ne ? s.title_ne : s.title;
                  return (
                    <li
                      key={s.id}
                      className="border-border flex flex-col gap-2 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                    >
                      <div className="min-w-0">
                        <p className="text-fg font-semibold">{title}</p>
                        {s.description ? <p className="text-fg-body mt-0.5 text-sm">{s.description}</p> : null}
                        {s.estimated_minutes ? (
                          <p className="text-fg-muted mt-0.5 text-xs">
                            {s.estimated_minutes < 90
                              ? t("price.minutes", { minutes: d(s.estimated_minutes) })
                              : t("price.hours", { hours: d(Math.round((s.estimated_minutes / 60) * 2) / 2) })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <PriceText p={s} className="text-fg text-base font-extrabold whitespace-nowrap" />
                        {bookable ? (
                          <Link
                            href={`${bookHref}?service=${s.id}`}
                            className="text-brand-text inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
                          >
                            {t("profile.book_service")}
                            <span className="sr-only">: {title}</span>
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-fg-muted mt-3">{t("profile.services_empty")}</p>
            )}
          </section>

          <section aria-labelledby="portfolio-title" className={SECTION}>
            <h2 id="portfolio-title" className="text-fg text-xl font-extrabold">
              {t("profile.portfolio")}
            </h2>
            {p.portfolio.length ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.portfolio.map((item, i) => {
                  const caption = locale === "ne" && item.caption_ne ? item.caption_ne : item.caption;
                  const src = mediaSrc(item.thumb_url);
                  return (
                    <li key={`${item.thumb_url}-${i}`}>
                      <figure className="m-0">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={caption || t("profile.portfolio")}
                            loading="lazy"
                            className="bg-surface-muted aspect-[4/3] w-full rounded-dense object-cover"
                          />
                        ) : null}
                        {caption ? <figcaption className="text-fg-body mt-1.5 text-sm">{caption}</figcaption> : null}
                      </figure>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-fg-muted mt-3">{t("profile.portfolio_empty")}</p>
            )}
          </section>

          <section aria-labelledby="reviews-title" className={SECTION}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="reviews-title" className="text-fg text-xl font-extrabold">
                {t("profile.reviews")}
              </h2>
              <span className="text-fg-muted text-sm">{t("profile.reviews_count", { count: p.rating_count })}</span>
            </div>
            {p.reviews.length ? (
              <ul className="mt-4 space-y-5">
                {p.reviews.map((r, i) => (
                  <li key={i} className="border-yellow border-l-4 pl-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars score={r.score} label={t("profile.rating_stars", { score: d(r.score) })} />
                      <span className="text-fg-muted text-sm">
                        {[r.first_name, r.month_bs ? formatBsMonthText(r.month_bs, locale) : null].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {r.comment ? <p className="text-fg-body mt-1.5">{r.comment}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-fg-muted mt-3">{t("profile.reviews_empty")}</p>
            )}
            <p className="text-fg-muted mt-4 text-xs">{t("profile.reviews_note")}</p>
          </section>
        </div>

        <aside className="space-y-8 lg:col-span-5" aria-label={t("profile.share_hint")}>
          <section aria-labelledby="ladder-title" className="border-border bg-surface rounded-card border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ladder-title" className="text-fg text-base font-extrabold">
                {t("profile.ladder_title")}
              </h2>
              <p className="text-fg-muted text-xs">{t("profile.level", { n: d(level), label: tl(String(level)) })}</p>
            </div>
            <SkillLadder earned={rungsForLevelPure(level)} variant="bars" className="mt-4" />
            {p.passport_url ? (
              <a href={p.passport_url} className="text-brand-text mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline">
                {t("profile.passport")}
                <ArrowRight className="size-4" aria-hidden />
              </a>
            ) : null}
          </section>

          {p.trades.length ? (
            <section aria-labelledby="trades-title">
              <h2 id="trades-title" className="text-fg text-base font-extrabold">
                {t("profile.trades")}
              </h2>
              <ul className="mt-3 space-y-2">
                {p.trades.map((tr) => (
                  <li key={tr.code} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-fg font-medium">{pickName(tr, locale)}</span>
                    <span className="text-fg-muted flex items-center gap-2 text-xs">
                      {tr.years ? t("profile.years", { count: tr.years }) : null}
                      {tr.nstb_level ? (
                        <span className="bg-brand-subtle text-brand-subtle-fg rounded-pill px-2 py-0.5 font-semibold">
                          {t("profile.nstb", { level: tn.has(tr.nstb_level) ? tn(tr.nstb_level) : tr.nstb_level })}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="avail-title">
            <h2 id="avail-title" className="text-fg text-base font-extrabold">
              {t("profile.availability", { name: firstName })}
            </h2>
            {weekly.length ? (
              <ol className="mt-3 grid grid-cols-7 gap-1 text-center">
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const hours = dayHours.get(wd);
                  return (
                    <li
                      key={wd}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-start gap-1 rounded-dense px-0.5 py-2",
                        hours ? "bg-teal-subtle text-fg" : "border-border-strong text-fg-muted border border-dashed",
                      )}
                    >
                      <span className="text-xs font-bold">{weekdayName(wd, locale)}</span>
                      <span className="text-[10px] leading-tight break-words">
                        {hours ? hours.replace("–", "– ") : t("join.day_off")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-fg-muted mt-2 text-sm">{t("profile.availability_none")}</p>
            )}
            {p.availability_summary?.next_available ? (
              <NextAvailable iso={p.availability_summary.next_available} className="text-fg-body mt-3 text-sm" />
            ) : null}
            {(p.availability_summary?.time_off ?? []).slice(0, 2).map((o) => (
              <p key={`${o.from_date}-${o.to_date}`} className="text-fg-muted mt-1 text-xs">
                {t("profile.time_off", { from: formatBs(adToBs(o.from_date), locale), to: formatBs(adToBs(o.to_date), locale) })}
              </p>
            ))}
          </section>

          <section aria-labelledby="areas-title">
            <h2 id="areas-title" className="text-fg flex items-center gap-1.5 text-base font-extrabold">
              <MapPin className="text-fg-muted size-4" aria-hidden />
              {t("profile.areas")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {p.service_districts.map((dist) => (
                <li key={dist.code} className="bg-surface-muted text-fg rounded-pill px-3 py-1 text-sm font-medium">
                  {pickName(dist, locale)}
                </li>
              ))}
            </ul>
          </section>

          {p.languages.length ? (
            <section aria-labelledby="langs-title">
              <h2 id="langs-title" className="text-fg flex items-center gap-1.5 text-base font-extrabold">
                <Languages className="text-fg-muted size-4" aria-hidden />
                {t("profile.languages")}
              </h2>
              <p className="text-fg-body mt-2 text-sm">
                {p.languages
                  .map((l) => {
                    const code = typeof l === "string" ? l : l.language;
                    if (t.has(`lang.${code}`)) return t(`lang.${code}`);
                    return typeof l === "string" ? l : l.language_label || l.language;
                  })
                  .join(" · ")}
              </p>
            </section>
          ) : null}

          {p.verified_badges.length ? (
            <section aria-labelledby="badges-title">
              <h2 id="badges-title" className="text-fg text-base font-extrabold">
                {t("profile.badges")}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {p.verified_badges.map((b) => (
                  <li
                    key={b}
                    className="bg-verified-soft text-verified inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold"
                  >
                    <BadgeCheck className="size-3.5" aria-hidden />
                    {t.has(`badge.${b}`) ? t(`badge.${b}`) : b.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {/* Phone: the Bolau button stays reachable while reading. */}
      {bookable ? (
        <div className="border-border bg-surface/95 sticky bottom-0 z-20 border-t px-4 py-3 backdrop-blur sm:hidden">
          <div className="flex items-center gap-3">
            {fromPrice ? (
              <p className="text-fg min-w-0 flex-1 text-sm font-bold tabular">
                {t("card.from", { price: formatMoney(fromPrice, locale) })}
              </p>
            ) : (
              <span className="flex-1" />
            )}
            {bookButton("min-h-12 px-5")}
          </div>
        </div>
      ) : null}
    </BolauChrome>
  );
}

/** "2083-06" → "Ashwin 2083". */
function formatBsMonthText(monthBs: string, locale: Locale): string {
  const [y, m] = monthBs.split("-").map(Number);
  if (!y || !m) return monthBs;
  return formatBs({ year: y, month: m, day: 1 }, locale).split(" ").slice(1).join(" ");
}
