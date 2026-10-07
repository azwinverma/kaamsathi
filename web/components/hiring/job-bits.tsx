"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { BedDouble, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Job, StageCounts } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "./lib";

/** "Rs. 19,550 per month" */
export function JobWage({
  job,
  className,
}: {
  job: Pick<Job, "wage_amount" | "wage_type">;
  className?: string;
}) {
  const t = useTranslations("common");
  const f = useFormat();
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      <span className="text-fg font-medium">{f.money(job.wage_amount)}</span>{" "}
      <span className="text-fg-muted">
        {job.wage_type === "monthly" ? t("per_month") : t("per_day")}
      </span>
    </span>
  );
}

export function JobBenefits({
  job,
}: {
  job: Pick<Job, "food_provided" | "accommodation_provided">;
}) {
  const t = useTranslations("hiring.form");
  if (!job.food_provided && !job.accommodation_provided) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {job.food_provided ? (
        <Badge tone="outline">
          <UtensilsCrossed aria-hidden />
          {t("food_label")}
        </Badge>
      ) : null}
      {job.accommodation_provided ? (
        <Badge tone="outline">
          <BedDouble aria-hidden />
          {t("accommodation_label")}
        </Badge>
      ) : null}
    </span>
  );
}

/** Compact per-stage counts strip for a job. */
export function PipelineCounts({
  counts,
  className,
}: {
  counts: StageCounts | undefined;
  className?: string;
}) {
  const t = useTranslations();
  const f = useFormat();
  return (
    <dl
      className={cn("grid grid-cols-5 gap-1", className)}
      aria-label={t("hiring.jobs.pipeline_label")}
    >
      {PIPELINE_STAGES.map((s) => {
        const n = counts?.[s] ?? 0;
        return (
          <div
            key={s}
            className={cn(
              "min-w-0 rounded-md px-2 py-1.5 text-center",
              n > 0
                ? s === "joined"
                  ? "bg-success-subtle"
                  : "bg-brand-subtle"
                : "bg-surface-muted",
            )}
          >
            <dd
              className={cn(
                "tabular text-base leading-tight font-semibold",
                n > 0
                  ? s === "joined"
                    ? "text-success"
                    : "text-brand-subtle-fg"
                  : "text-fg-subtle",
              )}
            >
              {f.digits(n)}
            </dd>
            <dt className="text-fg-muted truncate text-[11px]">{t(`stage.${s}`)}</dt>
          </div>
        );
      })}
    </dl>
  );
}

/** Joined / openings progress. */
export function FillProgress({ job }: { job: Pick<Job, "counts" | "openings_count"> }) {
  const t = useTranslations("hiring.jobs");
  const f = useFormat();
  const joined = job.counts?.joined ?? 0;
  const pct = Math.min(100, Math.round((joined / Math.max(1, job.openings_count)) * 100));
  return (
    <div className="min-w-28 space-y-1">
      <p className="text-fg-muted tabular text-xs">
        {t("filled_of", { joined: f.digits(joined), total: f.digits(job.openings_count) })}
      </p>
      <div
        className="bg-surface-muted h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={job.openings_count}
        aria-valuenow={joined}
      >
        <div className="bg-success h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
