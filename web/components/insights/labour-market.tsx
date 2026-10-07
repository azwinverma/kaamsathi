"use client";
import * as React from "react";
import { Download, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DistrictSelect, TradeSelect } from "@/components/shared/selects";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { downloadFile } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useLabourMarket } from "@/lib/api/hooks/insights";
import type { InsightsRef, InsightsReport, LabourMarket } from "@/lib/api/types-insights";
import { useFormat } from "@/lib/use-format";
import { ChartCard, HBarList, PairedBars, RangeBars, type Datum } from "./charts";

const REPORTS: InsightsReport[] = ["wages", "demand", "supply", "shortages", "certification_uplift", "origin_districts"];

function useRefName() {
  const f = useFormat();
  return (r: InsightsRef | string | null | undefined, fallback = "—") => {
    if (!r) return fallback;
    if (typeof r === "string") return r;
    return r.name_en || r.name_ne ? f.name({ name_en: r.name_en, name_ne: r.name_ne }) : r.code;
  };
}

export function LabourMarketView() {
  const t = useTranslations("insights.market");
  const tc = useTranslations("common");
  const [district, setDistrict] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const params = { district: district || undefined, trade: trade || undefined };
  const query = useLabourMarket(params);
  const [exporting, setExporting] = React.useState(false);

  async function exportCsv(report: InsightsReport) {
    setExporting(true);
    try {
      await downloadFile("/ops/insights/export.csv", `kaamsathi-${report}.csv`, { report, ...params });
    } catch (err) {
      toast.error(t("export_failed"), { description: isApiError(err) ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" loading={exporting}>
                <Download aria-hidden />
                {t("export_csv")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {REPORTS.map((r) => (
                <DropdownMenuItem key={r} onSelect={() => exportCsv(r)}>
                  {t(`report.${r}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Toolbar>
        <div className="w-full sm:w-56">
          <DistrictSelect
            value={district}
            onChange={setDistrict}
            placeholder={t("all_districts")}
            aria-label={t("district")}
          />
        </div>
        <div className="w-full sm:w-56">
          <TradeSelect value={trade} onChange={setTrade} allowEmpty placeholder={t("all_trades")} aria-label={t("trade")} />
        </div>
        {district || trade ? (
          <Button
            variant="ghost"
            onClick={() => {
              setDistrict("");
              setTrade("");
            }}
          >
            {tc("clear_filters")}
          </Button>
        ) : null}
      </Toolbar>
      <p className="mb-4 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-fg-muted">
        <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />
        {t("privacy_note", { k: 5 })}
      </p>
      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <div className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
          <MarketBody data={query.data} />
        </div>
      ) : null}
    </>
  );
}

function MarketBody({ data }: { data: LabourMarket }) {
  const t = useTranslations("insights.market");
  const tc = useTranslations("insights.chart");
  const f = useFormat();
  const name = useRefName();
  const n = (v: number | null | undefined) => (v === null || v === undefined ? tc("suppressed_short") : f.number(v));

  // demand vs supply: join by trade code
  const supplyBy = new Map(data.supply.map((s) => [s.trade.code, s]));
  const demandBy = new Map(data.demand.map((d) => [d.trade.code, d]));
  const tradeCodes = Array.from(new Set([...data.demand.map((d) => d.trade.code), ...data.supply.map((s) => s.trade.code)]));
  const pairRows = tradeCodes
    .map((code) => {
      const d = demandBy.get(code);
      const s = supplyBy.get(code);
      return {
        key: code,
        label: name(d?.trade ?? s?.trade),
        a: d?.open_positions ?? 0,
        b: s ? s.available : 0,
        aDisplay: f.number(d?.open_positions ?? 0),
        bDisplay: s ? n(s.available) : f.number(0),
      };
    })
    .filter((r) => r.a > 0 || r.b !== 0)
    .sort((x, y) => y.a - x.a || (y.b ?? 0) - (x.b ?? 0))
    .slice(0, 12);

  const shortageRows: Datum[] = data.shortages
    .filter((s) => Number(s.shortage ?? 0) > 0)
    .slice(0, 12)
    .map((s, i) => ({
    key: typeof s.trade === "string" ? s.trade : (s.trade?.code ?? String(i)),
    label: name(s.trade as InsightsRef | string),
    value: Number(s.shortage ?? 0),
    display: f.number(Number(s.shortage ?? 0)),
    hint: t("shortage_hint", { demand: f.number(Number(s.demand ?? 0)), supply: f.number(Number(s.supply ?? 0)) }),
  }));

  const wageRows = data.wages.map((w) => ({
    key: `${w.trade.code}-${w.district.code}`,
    label: name(w.trade),
    sublabel: name(w.district),
    p25: w.p25 === null ? null : Number(w.p25),
    median: w.median_monthly === null ? null : Number(w.median_monthly),
    p75: w.p75 === null ? null : Number(w.p75),
    display: f.money(w.median_monthly, { compact: true }),
    tooltip: w.suppressed
      ? `${name(w.trade)} · ${name(w.district)}: ${tc("suppressed")}`
      : t("wage_tooltip", {
          trade: name(w.trade),
          district: name(w.district),
          median: f.money(w.median_monthly),
          p25: f.money(w.p25),
          p75: f.money(w.p75),
          sample: f.number(w.sample ?? 0),
        }),
  }));
  const shownWages = wageRows.filter((w) => w.median !== null);
  const hiddenWages = wageRows.length - shownWages.length;

  const uplift: Datum[] = data.certification_uplift.map((u) => ({
    key: u.kind_or_level,
    label: upliftLabel(u.kind_or_level, t),
    value: u.uplift_pct === null ? null : Math.max(u.uplift_pct, 0),
    display: u.uplift_pct === null ? "—" : `${u.uplift_pct > 0 ? "+" : ""}${f.number(u.uplift_pct, { decimals: 1 })}%`,
    hint: u.suppressed
      ? undefined
      : t("uplift_hint", { with: f.money(u.median_net_with), without: f.money(u.median_net_without) }),
    suppressed: u.suppressed,
  }));

  const origin: Datum[] = data.origin_districts.map((o, i) => ({
    key: o.district?.code ?? `pooled-${i}`,
    label: o.district ? name(o.district) : t("pooled_districts"),
    value: o.workers,
    display: f.number(o.workers),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        className="lg:col-span-2"
        title={t("wages_title")}
        description={
          hiddenWages > 0 ? `${t("wages_desc")} ${t("hidden_cells", { count: hiddenWages })}` : t("wages_desc")
        }
        table={{
          columns: [
            { key: "trade", label: t("trade") },
            { key: "district", label: t("district") },
            { key: "p25", label: "P25", numeric: true },
            { key: "median", label: t("median"), numeric: true },
            { key: "p75", label: "P75", numeric: true },
            { key: "sample", label: t("sample"), numeric: true },
          ],
          rows: data.wages.map((w) => ({
            trade: name(w.trade),
            district: name(w.district),
            p25: w.suppressed ? tc("suppressed_short") : f.money(w.p25),
            median: w.suppressed ? tc("suppressed_short") : f.money(w.median_monthly),
            p75: w.suppressed ? tc("suppressed_short") : f.money(w.p75),
            sample: n(w.sample),
          })),
        }}
      >
        {shownWages.length ? (
          <RangeBars rows={shownWages.slice(0, 15)} ariaLabel={t("wages_title")} />
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
            {t("wages_all_hidden")}
          </p>
        )}
      </ChartCard>

      <ChartCard
        title={t("demand_supply_title")}
        description={t("demand_supply_desc")}
        table={{
          columns: [
            { key: "trade", label: t("trade") },
            { key: "open_positions", label: t("open_positions"), numeric: true },
            { key: "filled_90d", label: t("filled_90d"), numeric: true },
            { key: "days", label: t("avg_days_to_fill"), numeric: true },
            { key: "registered", label: t("registered"), numeric: true },
            { key: "verified", label: t("verified"), numeric: true },
            { key: "available", label: t("available"), numeric: true },
          ],
          rows: tradeCodes.map((code) => {
            const d = demandBy.get(code);
            const s = supplyBy.get(code);
            return {
              trade: name(d?.trade ?? s?.trade),
              open_positions: f.number(d?.open_positions ?? 0),
              filled_90d: f.number(d?.filled_90d ?? 0),
              days: d?.avg_days_to_fill == null ? "—" : f.number(d.avg_days_to_fill, { decimals: 1 }),
              registered: s ? n(s.registered) : f.number(0),
              verified: s ? n(s.verified) : f.number(0),
              available: s ? n(s.available) : f.number(0),
            };
          }),
        }}
      >
        <PairedBars rows={pairRows} seriesLabels={[t("open_positions"), t("available")]} ariaLabel={t("demand_supply_title")} />
      </ChartCard>

      <ChartCard
        title={t("shortages_title")}
        description={t("shortages_desc")}
        table={{
          columns: [
            { key: "trade", label: t("trade") },
            { key: "demand", label: t("demand"), numeric: true },
            { key: "supply", label: t("supply"), numeric: true },
            { key: "shortage", label: t("shortage"), numeric: true },
          ],
          rows: data.shortages.map((s) => ({
            trade: name(s.trade as InsightsRef | string),
            demand: f.number(Number(s.demand ?? 0)),
            supply: f.number(Number(s.supply ?? 0)),
            shortage: f.number(Number(s.shortage ?? 0)),
          })),
        }}
      >
        <HBarList rows={shortageRows} ariaLabel={t("shortages_title")} emptyLabel={t("no_shortages")} />
      </ChartCard>

      <ChartCard
        title={t("uplift_title")}
        description={t("uplift_desc")}
        table={{
          columns: [
            { key: "group", label: t("certification") },
            { key: "with", label: t("median_with"), numeric: true },
            { key: "without", label: t("median_without"), numeric: true },
            { key: "uplift", label: t("uplift"), numeric: true },
            { key: "sample", label: t("sample"), numeric: true },
          ],
          rows: data.certification_uplift.map((u) => ({
            group: upliftLabel(u.kind_or_level, t),
            with: u.suppressed ? tc("suppressed_short") : f.money(u.median_net_with),
            without: u.suppressed ? tc("suppressed_short") : f.money(u.median_net_without),
            uplift: u.uplift_pct === null ? "—" : `${f.number(u.uplift_pct, { decimals: 1 })}%`,
            sample: n(u.sample),
          })),
        }}
      >
        <HBarList rows={uplift} ariaLabel={t("uplift_title")} emptyLabel={t("no_payslips")} />
      </ChartCard>

      <ChartCard
        title={t("origin_title")}
        description={t("origin_desc")}
        table={{
          columns: [
            { key: "district", label: t("district") },
            { key: "workers", label: t("workers"), numeric: true },
          ],
          rows: origin.map((o) => ({ district: o.label, workers: o.display })),
        }}
      >
        <HBarList rows={origin} ariaLabel={t("origin_title")} />
      </ChartCard>
    </div>
  );
}

function upliftLabel(key: string, t: ReturnType<typeof useTranslations>) {
  if (key.startsWith("credential_")) return t("uplift_credential", { kind: key.slice("credential_".length).replace(/_/g, " ") });
  const known = ["nstb_any", "nstb_level1", "nstb_level2", "nstb_level3"];
  return known.includes(key) ? t(`uplift_group.${key}`) : key;
}
