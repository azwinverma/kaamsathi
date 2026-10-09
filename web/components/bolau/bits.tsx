"use client";
/**
 * Small Bolau building blocks shared by public pages, /ghar and ops: price text, fee line,
 * star rating, ladder chip, "when" text, booking status badge and the cut-paper portrait.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Star, Zap } from "lucide-react";
import { Badge, TONE_ICON } from "@/components/ui/badge";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { rungsForLevelPure } from "@/lib/bolau/ladder";
import { estimateToSipalu, feeLine, priceLabel, ratingText, type Priced } from "@/lib/bolau/price";
import { BOOKING_TONE } from "@/lib/bolau/timeline";
import { whenParts } from "@/lib/bolau/when";
import type { BookingFeeStatus, BookingStatus } from "@/lib/api/types-bolau";
import { initials } from "@/lib/format";
import { mediaSrc } from "@/lib/media";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

export function PriceText({ p, className }: { p: Priced; className?: string }) {
  const t = useTranslations("bolau.price");
  const f = useFormat();
  const { key, values } = priceLabel(p, f.locale);
  return <span className={cn("tabular", className)}>{t(key, values)}</span>;
}

export function EstimateText({ p, minutes }: { p: Priced; minutes?: number | null }) {
  const t = useTranslations("bolau.book");
  const f = useFormat();
  const est = estimateToSipalu(p, minutes);
  if (est === null || p.price_type !== "hourly") return null;
  return <span className="text-fg-muted tabular text-sm">{t("review_estimate", { amount: f.money(est) })}</span>;
}

export function FeeLine({
  fee,
  status,
  className,
  withPayDirect = true,
}: {
  fee: string | number | null | undefined;
  status: BookingFeeStatus | "enabled" | "disabled" | null | undefined;
  className?: string;
  withPayDirect?: boolean;
}) {
  const t = useTranslations("bolau.fee");
  const f = useFormat();
  const { key, amount } = feeLine(fee, status, f.locale);
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {withPayDirect ? <p className="text-fg font-medium">{t("pay_direct")}</p> : null}
      <p className="text-fg-body tabular">{t(key, { amount })}</p>
      {key === "waived" ? <p className="text-fg-muted text-xs">{t("waived_note")}</p> : null}
    </div>
  );
}

/** "★ 4.8 (23)" — or "New on Bolau" when unrated. Screen readers get the full sentence. */
export function RatingInline({
  avg,
  count,
  className,
}: {
  avg: string | number | null | undefined;
  count: number;
  className?: string;
}) {
  const t = useTranslations("bolau.card");
  const f = useFormat();
  const r = ratingText(avg, count);
  if (!r) return <span className={cn("text-fg-muted text-sm", className)}>{t("new")}</span>;
  return (
    <span className={cn("text-fg inline-flex items-center gap-1 text-sm font-semibold", className)}>
      <Star className="fill-yellow stroke-on-accent size-4" strokeWidth={1.5} aria-hidden />
      <span aria-hidden className="tabular">
        {f.digits(r)} <span className="text-fg-muted font-normal">({f.digits(count)})</span>
      </span>
      <span className="sr-only">{t("rating", { rating: f.digits(r), count })}</span>
    </span>
  );
}

/** Verification ladder chip: "Rung 2 of 5" with five tiny rungs. */
export function RungChip({ level, className }: { level: number; className?: string }) {
  const t = useTranslations("bolau.card");
  const f = useFormat();
  const n = rungsForLevelPure(level);
  const fills = ["bg-fg-muted", "bg-verified", "bg-teal", "bg-brand", "bg-yellow"];
  return (
    <span
      className={cn(
        "bg-surface text-fg ring-border inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-semibold ring-1",
        className,
      )}
    >
      <span aria-hidden className="flex items-end gap-[2px]">
        {fills.map((c, i) => (
          <span
            key={c}
            className={cn("w-[3px] rounded-[1px]", i < n ? c : "bg-border-strong")}
            style={{ height: 4 + i * 2 }}
          />
        ))}
      </span>
      {t("rung", { n: f.digits(n) })}
    </span>
  );
}

export function InstantBadge({ className }: { className?: string }) {
  const t = useTranslations("bolau.card");
  return (
    <Badge tone="accent" className={className}>
      <Zap aria-hidden />
      {t("instant")}
    </Badge>
  );
}

/** "today, 2:00 PM" text. Relative words depend on "now", so they switch on after mount. */
export function useWhenText() {
  const t = useTranslations("bolau.when");
  const f = useFormat();
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);
  return React.useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return "";
      const { key, values } = whenParts(iso, f.locale, now ?? new Date(iso));
      return now ? t(key, values) : t("other", values);
    },
    [t, f.locale, now],
  );
}

export function WhenText({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const when = useWhenText();
  if (!iso) return null;
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {when(iso)}
    </time>
  );
}

export function NextAvailable({ iso, className }: { iso: string; className?: string }) {
  const t = useTranslations("bolau.profile");
  const when = useWhenText();
  return (
    <p className={className} suppressHydrationWarning>
      {t("next_available", { when: when(iso) })}
    </p>
  );
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const t = useTranslations("bolau.status");
  const tone = BOOKING_TONE[status] ?? "neutral";
  const Icon = TONE_ICON[tone];
  return (
    <Badge tone={tone} className={className}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}

/** Cut-paper portrait: the real photo when the Sipalu added one, otherwise their initials. */
export function SipaluPortrait({
  name,
  photoUrl,
  size = "md",
  rotate = -3,
  tape = "yellow",
  className,
}: {
  name: string;
  photoUrl: string | null | undefined;
  size?: "sm" | "md" | "lg";
  rotate?: number;
  tape?: "yellow" | "teal" | "coral" | "none";
  className?: string;
}) {
  const t = useTranslations("bolau.card");
  const src = mediaSrc(photoUrl);
  const box = size === "lg" ? "size-36 sm:size-44" : size === "sm" ? "size-16" : "size-20 sm:size-24";
  const text = size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <CutPaperFrame tape={tape} rotate={rotate} padding="sm" className={cn("w-fit shrink-0 self-start", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={t("photo_alt", { name })} className={cn(box, "block object-cover")} loading="lazy" />
      ) : (
        <span
          role="img"
          aria-label={t("initials_label", { name })}
          className={cn(box, text, "bg-brand-subtle text-brand-subtle-fg flex items-center justify-center font-extrabold")}
        >
          {initials(name)}
        </span>
      )}
    </CutPaperFrame>
  );
}
