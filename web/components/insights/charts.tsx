"use client";
/**
 * Small, dependency-free chart primitives (CSS + inline SVG) for analytics pages.
 *
 * Follows the dataviz method: thin marks (≤24px bars, 4px rounded data-end, 2px lines, ≥8px dots),
 * recessive hairline axes, selective direct labels, hover/focus tooltips on every mark, a table
 * view for every chart, and text in text tokens (never the series colour).
 * Series 1 = brand blue; series 2 = orange (#eb6834 light / #d95926 dark) — validated pair
 * (CVD ΔE ≥ 28, normal-vision ΔE ≥ 31, ≥ 3:1 contrast on both surfaces).
 * Suppressed cells (k-anonymity) render as a dashed stub, never as zero.
 */
import * as React from "react";
import { Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const SERIES_1 = "bg-brand";
export const SERIES_2 = "bg-[#eb6834] dark:bg-[#d95926]";
const STROKE_1 = "stroke-brand";

export interface Datum {
  key: string;
  label: string;
  value: number | null;
  /** formatted value for labels/tooltips */
  display?: string;
  /** extra tooltip line */
  hint?: string;
  suppressed?: boolean;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

// ------------------------------------------------------------------ frame + table view
export interface TableSpec {
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, React.ReactNode>[];
}

/** Card with title, optional actions, the chart, and a "view as table" toggle. */
export function ChartCard({
  title,
  description,
  action,
  table,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  table?: TableSpec;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("insights.chart");
  const [showTable, setShowTable] = React.useState(false);
  const id = React.useId();
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <>
            {action}
            {table ? (
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showTable}
                aria-controls={id}
                onClick={() => setShowTable((v) => !v)}
              >
                <Table2 aria-hidden />
                <span className="max-sm:sr-only">{showTable ? t("show_chart") : t("show_table")}</span>
              </Button>
            ) : null}
          </>
        }
      />
      <CardBody id={id}>
        {showTable && table ? <DataTable spec={table} /> : children}
      </CardBody>
    </Card>
  );
}

export function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <TableContainer className="shadow-none">
      <Table>
        <THead>
          <tr>
            {spec.columns.map((c) => (
              <Th key={c.key} numeric={c.numeric}>
                {c.label}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {spec.rows.map((r, i) => (
            <Tr key={i}>
              {spec.columns.map((c) => (
                <Td key={c.key} numeric={c.numeric} className="h-10">
                  {r[c.key] ?? "—"}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

function SuppressedStub({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-[4px] border border-dashed border-border-strong bg-surface-muted", className)}
      aria-hidden
    />
  );
}

export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-fg-muted">
      {children}
    </p>
  );
}

// ------------------------------------------------------------------ column chart
/** Single-series column chart (one bar per month). */
export function ColumnChart({
  data,
  ariaLabel,
  height = 168,
  formatTick,
}: {
  data: Datum[];
  ariaLabel: string;
  height?: number;
  formatTick?: (v: number) => string;
}) {
  const t = useTranslations("insights.chart");
  const max = niceMax(Math.max(0, ...data.map((d) => d.value ?? 0)));
  const lastIdx = data.map((d) => d.value !== null).lastIndexOf(true);
  return (
    <figure aria-label={ariaLabel} className="min-w-0 pt-5">
      <div className="relative" style={{ height }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" aria-hidden />
        <span className="pointer-events-none absolute top-0 left-0 -translate-y-full pb-0.5 text-[11px] text-fg-subtle tabular">
          {formatTick ? formatTick(max) : max}
        </span>
        <div className="absolute inset-0 flex items-end gap-1 border-b border-border-strong sm:gap-2">
          {data.map((d, i) => {
            const label = `${d.label}: ${d.suppressed ? t("suppressed") : (d.display ?? "—")}${d.hint ? ` · ${d.hint}` : ""}`;
            return (
              <Tooltip key={d.key} content={label}>
                <div
                  tabIndex={0}
                  aria-label={label}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-sm outline-none hover:bg-surface-hover/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {i === lastIdx && d.value !== null ? (
                    <span className="mb-1 text-[11px] font-medium text-fg tabular">{d.display}</span>
                  ) : null}
                  {d.value !== null ? (
                    <div
                      className={cn("w-full max-w-6 rounded-t-[4px]", SERIES_1)}
                      style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 1.5 : 0)}%` }}
                    />
                  ) : d.suppressed ? (
                    <SuppressedStub className="h-3 w-full max-w-6" />
                  ) : null}
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <XLabels data={data} />
    </figure>
  );
}

function XLabels({ data }: { data: Datum[] }) {
  const step = data.length > 8 ? 2 : 1;
  return (
    <div className="mt-1.5 flex gap-1 sm:gap-2" aria-hidden>
      {data.map((d, i) => (
        <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-fg-muted">
          {i % step === 0 || i === data.length - 1 ? d.label : ""}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ line chart
/** Single-series line (e.g. a rate over months) with markers and per-point hover. */
export function LineChart({
  data,
  ariaLabel,
  height = 168,
  domain,
  formatTick,
}: {
  data: Datum[];
  ariaLabel: string;
  height?: number;
  domain?: [number, number];
  formatTick?: (v: number) => string;
}) {
  const t = useTranslations("insights.chart");
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const lo = domain?.[0] ?? 0;
  const hi = domain?.[1] ?? niceMax(Math.max(1, ...values));
  const n = data.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 100;
  // break the line at suppressed / missing points
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  data.forEach((d, i) => {
    if (d.value === null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push({ i, v: d.value });
  });
  if (cur.length) segments.push(cur);
  const lastIdx = data.map((d) => d.value !== null).lastIndexOf(true);

  return (
    <figure aria-label={ariaLabel} className="min-w-0 pt-5">
      <div className="relative mx-1" style={{ height }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" aria-hidden />
        <span className="pointer-events-none absolute top-0 left-0 -translate-y-full pb-0.5 text-[11px] text-fg-subtle tabular">
          {formatTick ? formatTick(hi) : hi}
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-b border-border-strong" aria-hidden />
        {lo > 0 ? (
          <span className="pointer-events-none absolute bottom-1 left-0 text-[11px] text-fg-subtle tabular" aria-hidden>
            {formatTick ? formatTick(lo) : lo}
          </span>
        ) : null}
        <svg
          className="absolute inset-0 size-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {segments.map((seg, k) =>
            seg.length > 1 ? (
              <polyline
                key={k}
                points={seg.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
                fill="none"
                className={STROKE_1}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </svg>
        {data.map((d, i) =>
          d.value !== null ? (
            <span
              key={d.key}
              className={cn("pointer-events-none absolute size-2.5 -translate-1/2 rounded-full ring-2 ring-surface", SERIES_1)}
              style={{ left: `${x(i)}%`, top: `${y(d.value)}%` }}
              aria-hidden
            />
          ) : d.suppressed ? (
            <span
              key={d.key}
              className="pointer-events-none absolute bottom-0 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border border-dashed border-border-strong bg-surface"
              style={{ left: `${x(i)}%` }}
              aria-hidden
            />
          ) : null,
        )}
        {lastIdx >= 0 && data[lastIdx].value !== null ? (
          <span
            className="pointer-events-none absolute -translate-x-full -translate-y-[160%] text-[11px] font-medium text-fg tabular"
            style={{ left: `${Math.max(x(lastIdx), 8)}%`, top: `${y(data[lastIdx].value as number)}%` }}
          >
            {data[lastIdx].display}
          </span>
        ) : null}
        {/* hit areas: one per point, wider than the mark */}
        <div className="absolute inset-0 flex">
          {data.map((d) => {
            const label = `${d.label}: ${d.suppressed ? t("suppressed") : (d.display ?? "—")}${d.hint ? ` · ${d.hint}` : ""}`;
            return (
              <Tooltip key={d.key} content={label}>
                <div
                  tabIndex={0}
                  aria-label={label}
                  className="h-full min-w-0 flex-1 outline-none hover:bg-surface-hover/40 focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Tooltip>
            );
          })}
        </div>
      </div>
      <XLabels data={data} />
    </figure>
  );
}

// ------------------------------------------------------------------ horizontal bars
export function HBarList({
  rows,
  ariaLabel,
  max: maxProp,
  emptyLabel,
}: {
  rows: Datum[];
  ariaLabel: string;
  max?: number;
  emptyLabel?: string;
}) {
  const t = useTranslations("insights.chart");
  const max = maxProp ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  if (!rows.length) return <ChartEmpty>{emptyLabel ?? t("no_data")}</ChartEmpty>;
  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {rows.map((r) => {
        const label = `${r.label}: ${r.suppressed ? t("suppressed") : (r.display ?? "—")}${r.hint ? ` · ${r.hint}` : ""}`;
        return (
          <li key={r.key}>
            <Tooltip content={label}>
              <div
                tabIndex={0}
                aria-label={label}
                className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
              >
                <span className="truncate text-sm text-fg-body">{r.label}</span>
                <span className="relative h-3" aria-hidden>
                  {r.value !== null ? (
                    <span
                      className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", SERIES_1)}
                      style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 1 : 0)}%` }}
                    />
                  ) : r.suppressed ? (
                    <SuppressedStub className="absolute inset-y-0 left-0 w-6" />
                  ) : null}
                </span>
                <span className="min-w-12 text-right text-sm font-medium text-fg tabular">
                  {r.suppressed ? <span className="text-xs font-normal text-fg-subtle">{t("suppressed_short")}</span> : r.display}
                </span>
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ paired bars (2 series)
export function PairedBars({
  rows,
  seriesLabels,
  ariaLabel,
}: {
  rows: { key: string; label: string; a: number | null; b: number | null; aDisplay: string; bDisplay: string }[];
  seriesLabels: [string, string];
  ariaLabel: string;
}) {
  const t = useTranslations("insights.chart");
  const max = Math.max(1, ...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]));
  if (!rows.length) return <ChartEmpty>{t("no_data")}</ChartEmpty>;
  return (
    <div className="space-y-3">
      <Legend items={[{ label: seriesLabels[0], className: SERIES_1 }, { label: seriesLabels[1], className: SERIES_2 }]} />
      <ul aria-label={ariaLabel} className="space-y-3">
        {rows.map((r) => {
          const label = `${r.label}: ${seriesLabels[0]} ${r.aDisplay}, ${seriesLabels[1]} ${r.bDisplay}`;
          return (
            <li key={r.key}>
              <Tooltip content={label}>
                <div
                  tabIndex={0}
                  aria-label={label}
                  className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,12rem)_1fr]"
                >
                  <span className="truncate text-sm text-fg-body">{r.label}</span>
                  <span className="flex flex-col gap-0.5" aria-hidden>
                    {(
                      [
                        [r.a, r.aDisplay, SERIES_1],
                        [r.b, r.bDisplay, SERIES_2],
                      ] as const
                    ).map(([v, disp, cls], k) => (
                      <span key={k} className="flex items-center gap-2">
                        <span className="relative h-2.5 flex-1">
                          {v !== null ? (
                            <span
                              className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", cls)}
                              style={{ width: `${Math.max((v / max) * 100, v > 0 ? 1 : 0)}%` }}
                            />
                          ) : (
                            <SuppressedStub className="absolute inset-y-0 left-0 w-5" />
                          )}
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs whitespace-nowrap text-fg-muted tabular">{disp}</span>
                      </span>
                    ))}
                  </span>
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", it.className)} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ range bars (p25–p75 + median)
export function RangeBars({
  rows,
  ariaLabel,
}: {
  rows: {
    key: string;
    label: string;
    sublabel?: string;
    p25: number | null;
    median: number | null;
    p75: number | null;
    display: string;
    tooltip: string;
  }[];
  ariaLabel: string;
}) {
  const t = useTranslations("insights.chart");
  const vals = rows.flatMap((r) => [r.p25, r.p75]).filter((v): v is number => v !== null);
  if (!rows.length) return <ChartEmpty>{t("no_data")}</ChartEmpty>;
  const lo = vals.length ? Math.min(...vals) * 0.9 : 0;
  const hi = vals.length ? Math.max(...vals) * 1.05 : 1;
  const pos = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <Tooltip content={r.tooltip}>
            <div
              tabIndex={0}
              aria-label={r.tooltip}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-fg-body">{r.label}</span>
                {r.sublabel ? <span className="block truncate text-xs text-fg-muted">{r.sublabel}</span> : null}
              </span>
              <span className="relative h-3 rounded-full bg-surface-muted" aria-hidden>
                {r.p25 !== null && r.p75 !== null && r.median !== null ? (
                  <>
                    <span
                      className="absolute inset-y-0 rounded-[4px] bg-brand/30"
                      style={{ left: `${pos(r.p25)}%`, width: `${Math.max(pos(r.p75) - pos(r.p25), 1)}%` }}
                    />
                    <span
                      className={cn("absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full ring-2 ring-surface", SERIES_1)}
                      style={{ left: `${pos(r.median)}%` }}
                    />
                  </>
                ) : (
                  <SuppressedStub className="absolute inset-y-0 left-0 w-6" />
                )}
              </span>
              <span className="min-w-20 text-right text-sm font-medium text-fg tabular">
                {r.median === null ? (
                  <span className="text-xs font-normal text-fg-subtle">{t("suppressed_short")}</span>
                ) : (
                  r.display
                )}
              </span>
            </div>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
