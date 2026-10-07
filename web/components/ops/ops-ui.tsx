"use client";
import * as React from "react";
import { AlertTriangle, Clock, ExternalLink, ImageOff, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { useFormat } from "@/lib/use-format";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import { SHORTLIST_SLA_HOURS, slaTone } from "./helpers";

/** Hours a job has been open, coloured against the 48h shortlist SLA. */
export function HoursOpenBadge({ hours, className }: { hours: number | null | undefined; className?: string }) {
  const f = useFormat();
  const t = useTranslations("ops.common");
  const tone = slaTone(hours);
  const over = (hours ?? 0) > SHORTLIST_SLA_HOURS;
  return (
    <Badge
      tone={tone}
      className={cn("tabular", className)}
      title={over ? t("over_sla", { hours: f.digits(SHORTLIST_SLA_HOURS) }) : undefined}
    >
      {over ? <AlertTriangle aria-hidden /> : <Clock aria-hidden />}
      {f.hours(hours)}
      {over ? <span className="sr-only">{t("over_sla", { hours: SHORTLIST_SLA_HOURS })}</span> : null}
    </Badge>
  );
}

export function AvailabilityBadge({ available, className }: { available: boolean; className?: string }) {
  const t = useTranslations("ops.common");
  return (
    <Badge tone={available ? "success" : "neutral"} dot className={className}>
      {available ? t("available") : t("not_available")}
    </Badge>
  );
}

/** 0–100 match score with a small bar. */
export function ScoreMeter({ score, className }: { score: number; className?: string }) {
  const f = useFormat();
  const t = useTranslations("ops.common");
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const tone = s >= 70 ? "bg-success" : s >= 50 ? "bg-brand" : "bg-warning";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-hover"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={s}
        aria-label={t("score")}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${s}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-semibold text-fg tabular">{f.digits(s)}</span>
    </div>
  );
}

/** Thumbnail of an identity document / photo; click to view full size. */
export function DocImage({
  src,
  label,
  className,
  tall,
}: {
  src: string | null | undefined;
  label: string;
  className?: string;
  tall?: boolean;
}) {
  src = mediaSrc(src);
  const t = useTranslations("ops.common");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const box = cn(
    "relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted",
    tall ? "aspect-[3/4]" : "aspect-[4/3]",
  );
  return (
    <figure className={cn("min-w-0 space-y-1.5", className)}>
      {src ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(box, "group cursor-zoom-in focus-visible:outline-2 focus-visible:outline-ring")}
          aria-label={t("view_document", { name: label })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="size-full object-contain" loading="lazy" />
          <span className="absolute right-2 bottom-2 inline-flex size-7 items-center justify-center rounded-md bg-surface/90 text-fg-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn className="size-4" aria-hidden />
          </span>
        </button>
      ) : (
        <div className={cn(box, "flex-col gap-1.5 border-dashed text-fg-subtle")}>
          <ImageOff className="size-5" aria-hidden />
          <span className="text-xs">{t("not_uploaded")}</span>
        </div>
      )}
      <figcaption className="text-xs font-medium text-fg-muted">{label}</figcaption>
      {src ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="xl" closeLabel={tc("close")}>
            <DialogHeader title={label} />
            <DialogBody className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={label} className="max-h-[70dvh] w-auto max-w-full rounded-md object-contain" />
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden />
                {t("open_original")}
              </a>
            </DialogBody>
          </DialogContent>
        </Dialog>
      ) : null}
    </figure>
  );
}

/** Small label/value line used in dense review panels. */
export function InfoRow({ label, value, mono }: { label: React.ReactNode; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="shrink-0 text-sm text-fg-muted">{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm break-words text-fg", mono && "font-medium tabular tracking-wide")}>
        {value === null || value === undefined || value === "" ? <span className="text-fg-subtle">—</span> : value}
      </dd>
    </div>
  );
}
