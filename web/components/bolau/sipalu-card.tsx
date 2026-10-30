"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { SipaluCard as Card } from "@/lib/api/types-bolau";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { InstantBadge, RatingInline, RungChip, SipaluPortrait, useWhenText } from "./bits";

const TILT = [-3, 2.5, -2, 3];
const TAPE = ["yellow", "teal", "coral", "yellow"] as const;

/**
 * Sipalu result row (B · street mural): a cut-paper portrait beside the facts a household needs to
 * decide — trade, ladder rung, rating, jobs done, starting price and the next free slot. Rows are
 * split by hairlines instead of floating cards; the whole row is one link (name is the label), and a
 * Book button above it goes straight to the booking form.
 */
export function SipaluCard({ s, index = 0, headingLevel = 3 }: { s: Card; index?: number; headingLevel?: 2 | 3 }) {
  const t = useTranslations("bolau.card");
  const f = useFormat();
  const when = useWhenText();
  const name = f.locale === "ne" && s.name_ne ? s.name_ne : s.name;
  const headline = f.locale === "ne" && s.headline_ne ? s.headline_ne : s.headline;
  const H = `h${headingLevel}` as "h2" | "h3";
  return (
    <article className="group relative flex gap-4 py-5 sm:gap-5">
      <SipaluPortrait
        name={name}
        photoUrl={s.photo_url}
        rotate={TILT[index % TILT.length]}
        tape={TAPE[index % TAPE.length]}
        className="mt-1"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <H className="text-fg text-lg leading-tight font-bold">
            <Link
              href={`/sipalu/${s.handle}`}
              className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none"
            >
              {name}
            </Link>
          </H>
          {s.instant_booking ? <InstantBadge /> : null}
        </div>
        {headline ? <p className="text-fg-body line-clamp-2 text-sm">{headline}</p> : null}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {s.top_trade ? <span className="text-fg font-semibold">{f.name(s.top_trade)}</span> : null}
          <RungChip level={s.verification_level} />
          <RatingInline avg={s.rating_avg} count={s.rating_count} />
          <span className="text-fg-muted">{t("jobs", { count: s.jobs_completed, countText: f.digits(s.jobs_completed) })}</span>
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-1">
          {s.from_price ? (
            <p className="text-fg text-base font-extrabold tabular">{t("from", { price: f.money(s.from_price) })}</p>
          ) : (
            <span />
          )}
          <p className={cn("text-fg-muted inline-flex items-center gap-1.5 text-sm")}>
            <CalendarClock className="size-4" aria-hidden />
            <span suppressHydrationWarning>
              {s.next_available ? t("next", { when: when(s.next_available) }) : t("next_none")}
            </span>
          </p>
        </div>
        <Link
          href={`/bolau/book/${s.handle}`}
          className="bg-yellow text-on-accent border-on-accent relative z-10 mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-control border-2 px-4 text-sm font-extrabold transition-[filter,transform] hover:brightness-95 active:translate-y-px"
        >
          {t("book")}
          <span className="sr-only"> {name}</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
