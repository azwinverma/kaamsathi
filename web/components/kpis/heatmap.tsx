"use client";
/**
 * District heatmap (/ops/insights → "District heatmap"). No map library: a province-grouped grid of
 * district tiles. Each tile = a sequential-blue swatch (5 ordinal bins, see scale.ts) + name + value
 * in text tokens, so identity never rests on colour alone. Zero = neutral swatch, k-anonymity-
 * suppressed = dashed stub. Hover/focus tooltip on every tile; table view via ChartCard.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChartCard, ChartEmpty, type TableSpec } from "@/components/insights/charts";
import { TradeSelect } from "@/components/shared/selects";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip } from "@/components/ui/tooltip";
import { useHeatmap } from "@/lib/api/hooks/mobility";
import { HEATMAP_METRICS, type HeatmapCell, type HeatmapMetric } from "@/lib/api/types-mobility";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { BIN_CLASSES, binEdges, binIndex, cellState, groupByProvince, numericValue } from "./scale";

export function HeatmapView() {
  const t = useTranslations("kpis.heatmap");
  const f = useFormat();
  const [metric, setMetric] = React.useState<HeatmapMetric>("demand");
  const [trade, setTrade] = React.useState("");
  const query = useHeatmap(metric, trade || undefined);
  const data = query.data;
  const k = data?.k_anonymity ?? 5;

  const fmt = React.useCallback(
    (v: HeatmapCell["value"]) => {
      const n = numericValue(v);
      if (n === null) return "—";
      return metric === "median_wage" ? f.money(n, { compact: true }) : f.number(n);
    },
    [metric, f],
  );

  const groups = React.useMemo(() => groupByProvince(data?.cells ?? []), [data]);
  const top = React.useMemo(() => {
    const vals = (data?.cells ?? []).filter((c) => cellState(c) === "value");
    return (
      vals.sort((a, b) => (numericValue(b.value) ?? 0) - (numericValue(a.value) ?? 0))[0] ?? null
    );
  }, [data]);

  const table: TableSpec | undefined = data
    ? {
        columns: [
          { key: "district", label: t("district") },
          { key: "province", label: t("province") },
          { key: "value", label: t(`metric.${metric}`), numeric: true },
        ],
        rows: data.cells.map((c) => ({
          district: f.name(c.district),
          province: f.name(c.district.province),
          value: c.suppressed ? t("suppressed", { k }) : fmt(c.value),
        })),
      }
    : undefined;

  const hasAny = (data?.cells ?? []).some((c) => cellState(c) !== "no_data");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { k })} />
      <Toolbar>
        <Segmented
          label={t("metric_label")}
          value={metric}
          onChange={setMetric}
          size="sm"
          className="max-w-full overflow-x-auto"
          options={HEATMAP_METRICS.map((m) => ({ value: m, label: t(`metric.${m}`) }))}
        />
        <div className="w-full sm:w-56">
          <TradeSelect
            value={trade}
            onChange={setTrade}
            allowEmpty
            placeholder={t("all_trades")}
            aria-label={t("trade")}
          />
        </div>
      </Toolbar>

      {query.isLoading ? (
        <Skeleton className="h-[480px] rounded-dense" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : data ? (
        <ChartCard
          title={t(`metric.${metric}`)}
          description={
            <>
              {t(`metric_hint.${metric}`)}
              {top ? (
                <> · {t("top", { name: f.name(top.district), value: fmt(top.value) })}</>
              ) : null}
            </>
          }
          table={table}
        >
          {!hasAny ? (
            <ChartEmpty>{t("empty")}</ChartEmpty>
          ) : (
            <div className="space-y-5">
              <Legend max={data.max} format={(n) => fmt(n)} k={k} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((g) => (
                  <section key={g.code} aria-label={f.name(g)} className="min-w-0">
                    <h3 className="text-fg-muted mb-2 text-xs font-semibold tracking-wide uppercase">
                      {f.name(g)}
                    </h3>
                    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
                      {g.cells.map((c) => (
                        <DistrictTile
                          key={c.district.code}
                          cell={c}
                          max={data.max}
                          k={k}
                          format={fmt}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      ) : null}
    </>
  );
}

function Swatch({
  state,
  bin,
  className,
}: {
  state: ReturnType<typeof cellState>;
  bin: number | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-[4px]",
        state === "value" && bin !== null && BIN_CLASSES[bin],
        state === "zero" && "border-border-strong bg-surface-muted border",
        state === "suppressed" && "border-border-strong bg-surface border border-dashed",
        state === "no_data" && "border-border bg-surface border",
        className,
      )}
    />
  );
}

function DistrictTile({
  cell,
  max,
  k,
  format,
}: {
  cell: HeatmapCell;
  max: number | null;
  k: number;
  format: (v: HeatmapCell["value"]) => string;
}) {
  const t = useTranslations("kpis.heatmap");
  const f = useFormat();
  const state = cellState(cell);
  const bin = binIndex(numericValue(cell.value), max);
  const name = f.name(cell.district);
  const valueText =
    state === "suppressed"
      ? t("legend_suppressed", { k })
      : state === "no_data"
        ? t("no_data")
        : format(cell.value);
  return (
    <li>
      <Tooltip
        content={
          <span>
            <span className="font-semibold">{name}</span> · {f.name(cell.district.province)}
            <br />
            {state === "suppressed" ? t("suppressed", { k }) : valueText}
            {cell.sample ? ` · n=${f.digits(cell.sample)}` : ""}
          </span>
        }
      >
        <button
          type="button"
          className="border-border bg-surface hover:bg-surface-hover focus-visible:outline-ring flex w-full min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-2"
          aria-label={`${name}: ${valueText}`}
        >
          <Swatch state={state} bin={bin} />
          <span className="text-fg-body min-w-0 flex-1 truncate text-xs">{name}</span>
          <span
            className={cn(
              "tabular text-xs",
              state === "value" ? "text-fg font-semibold" : "text-fg-muted",
            )}
          >
            {state === "suppressed"
              ? "<" + f.digits(k)
              : state === "no_data"
                ? "—"
                : format(cell.value)}
          </span>
        </button>
      </Tooltip>
    </li>
  );
}

function Legend({
  max,
  format,
  k,
}: {
  max: number | null;
  format: (n: number) => string;
  k: number;
}) {
  const t = useTranslations("kpis.heatmap");
  const edges = binEdges(max);
  return (
    <div
      className="text-fg-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
      aria-label={t("legend")}
    >
      <span className="text-fg-body font-medium">{t("legend")}</span>
      {edges.length ? (
        <span className="flex items-center gap-1">
          {edges.map((e, i) => (
            <span key={i} className="flex flex-col items-center gap-0.5">
              <Swatch state="value" bin={i} className="h-3 w-8" />
              <span className="tabular">≤{format(e)}</span>
            </span>
          ))}
        </span>
      ) : null}
      <span className="flex items-center gap-1.5">
        <Swatch state="zero" bin={null} />
        {t("legend_zero")}
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch state="suppressed" bin={null} />
        {t("legend_suppressed", { k })}
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch state="no_data" bin={null} />
        {t("legend_no_data")}
      </span>
    </div>
  );
}
