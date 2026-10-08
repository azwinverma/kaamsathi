"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChartCard, Legend, SERIES_1, SERIES_2 } from "@/components/insights/charts";
import { Tooltip } from "@/components/ui/tooltip";
import type { RiskSummary } from "@/lib/api/types-risk";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** Upper axis bound: the smallest "nice" number ≥ v (1, 2, 5 × 10ⁿ). */
export function niceCeil(v: number): number {
  if (v <= 1) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** 30-day trend of flags raised vs resolved per day — paired columns, table view for screen readers. */
export function RiskTrendBars({ trend }: { trend: RiskSummary["trend"] }) {
  const t = useTranslations("risk.flags");
  const f = useFormat();
  const max = niceCeil(Math.max(0, ...trend.flatMap((d) => [d.created, d.resolved])));
  const series: [string, string] = [t("trend_raised"), t("trend_resolved")];
  const short = (iso: string) => f.ad(iso).replace(/,?\s*\d{4}$/, "");
  return (
    <ChartCard
      title={t("trend_title")}
      description={t("trend_description")}
      table={{
        columns: [
          { key: "date", label: t("trend_date") },
          { key: "created", label: series[0], numeric: true },
          { key: "resolved", label: series[1], numeric: true },
        ],
        rows: trend.map((d) => ({ date: f.ad(d.date), created: f.number(d.created), resolved: f.number(d.resolved) })),
      }}
    >
      <div className="space-y-3">
        <Legend
          items={[
            { label: series[0], className: SERIES_1 },
            { label: series[1], className: SERIES_2 },
          ]}
        />
        <figure aria-label={t("trend_title")} className="min-w-0 pt-4">
          <div className="relative h-36">
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" aria-hidden />
            <span className="pointer-events-none absolute top-0 left-0 -translate-y-full pb-0.5 text-[11px] text-fg-subtle tabular">
              {f.number(max)}
            </span>
            <div className="absolute inset-0 flex items-end gap-px border-b border-border-strong sm:gap-0.5">
              {trend.map((d) => {
                const label = `${f.ad(d.date)}: ${series[0]} ${f.number(d.created)}, ${series[1]} ${f.number(d.resolved)}`;
                return (
                  <Tooltip key={d.date} content={label}>
                    <div
                      tabIndex={0}
                      aria-label={label}
                      className="flex h-full min-w-0 flex-1 items-end justify-center gap-px rounded-sm outline-none hover:bg-surface-hover/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {[
                        [d.created, SERIES_1],
                        [d.resolved, SERIES_2],
                      ].map(([v, cls], i) => (
                        <span
                          key={i}
                          aria-hidden
                          className={cn("w-full max-w-2 rounded-t-[2px]", cls as string)}
                          style={{ height: `${Math.max(((v as number) / max) * 100, (v as number) > 0 ? 2 : 0)}%` }}
                        />
                      ))}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-fg-muted" aria-hidden>
            <span>{trend.length ? short(trend[0].date) : ""}</span>
            <span>{trend.length ? short(trend[Math.floor(trend.length / 2)].date) : ""}</span>
            <span>{trend.length ? short(trend[trend.length - 1].date) : ""}</span>
          </div>
        </figure>
      </div>
    </ChartCard>
  );
}
