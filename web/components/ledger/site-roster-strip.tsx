"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type RosterTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface RosterCell {
  /** Short visible code: P, ½, A, L, PH… */
  code: string;
  /** Full spoken label ("Present"). */
  label: string;
  tone: RosterTone;
}

export interface RosterDay {
  date: string;
  /** "Sun 19" */
  label: React.ReactNode;
  /** Weekly off / holiday column. */
  off?: boolean;
  today?: boolean;
}

export interface RosterRow {
  id: string;
  name: string;
  meta?: string;
  href?: string;
  cells: Record<string, RosterCell | null | undefined>;
}

const TONE: Record<RosterTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-muted text-fg-muted",
};

/**
 * Site roster strip (direction A signature): one site, a week of days, one row per worker with
 * P / ½ / A / L chips on their soft status backgrounds. A real table (caption, column + row headers)
 * so screen readers hear "Ram B. Thapa, Tue 21: Half day". First column sticks on narrow screens.
 */
export function SiteRosterStrip({
  site,
  days,
  rows,
  maxRows,
  moreHref,
  className,
  emptyText,
  legend,
}: {
  site: React.ReactNode;
  days: RosterDay[];
  rows: RosterRow[];
  maxRows?: number;
  moreHref?: string;
  className?: string;
  emptyText?: React.ReactNode;
  legend?: { code: string; label: string; tone: RosterTone }[];
}) {
  const t = useTranslations("ledger.roster");
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  const hidden = rows.length - shown.length;
  const siteText = typeof site === "string" ? site : undefined;
  return (
    <div className={cn("overflow-hidden rounded-dense border border-border bg-surface", className)}>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">{t("label", { site: siteText ?? "" })}</caption>
          <thead>
            <tr className="bg-surface-muted">
              <th
                scope="col"
                className="sticky left-0 z-[2] w-[34%] border-b border-border bg-surface-muted px-4 py-2.5 text-left text-sm font-semibold text-fg"
              >
                {site}
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  scope="col"
                  className={cn(
                    "border-b border-border px-2 py-2.5 text-left font-medium whitespace-nowrap text-fg-muted",
                    d.today && "text-fg",
                  )}
                >
                  {d.today ? <span className="border-b-2 border-brand pb-0.5">{d.label}</span> : d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={days.length + 1} className="px-4 py-6 text-center text-sm text-fg-muted">
                  {emptyText ?? t("empty")}
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.id} className="[&:last-child>*]:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] border-b border-border bg-surface px-4 py-2 text-left font-medium text-fg"
                  >
                    {r.href ? (
                      <Link href={r.href} className="hover:text-brand-text hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                    {r.meta ? <span className="font-normal text-fg-muted"> · {r.meta}</span> : null}
                  </th>
                  {days.map((d) => {
                    const c = r.cells[d.date];
                    return (
                      <td key={d.date} className="border-b border-border px-2 py-2">
                        {c ? (
                          <span
                            className={cn(
                              "relative inline-flex min-w-7 justify-center rounded-sm px-1.5 py-0.5 font-semibold tabular",
                              TONE[c.tone],
                            )}
                            title={c.label}
                          >
                            <span aria-hidden>{c.code}</span>
                            <span className="sr-only">{c.label}</span>
                          </span>
                        ) : d.off ? (
                          <span className="text-fg-muted">{t("off")}</span>
                        ) : (
                          <span className="text-fg-muted" aria-label="—">
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {legend?.length || (hidden > 0 && moreHref) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-fg-muted">
          {legend?.length ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="sr-only">{t("legend")}:</span>
              {legend.map((l) => (
                <span key={l.code} className="inline-flex items-center gap-1">
                  <span className={cn("rounded-sm px-1 font-semibold", TONE[l.tone])} aria-hidden>
                    {l.code}
                  </span>
                  {l.label}
                </span>
              ))}
            </span>
          ) : null}
          {hidden > 0 && moreHref ? (
            <Link href={moreHref} className="ml-auto font-medium text-brand-text hover:underline">
              {t("more_rows", { count: hidden })}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
