"use client";
/**
 * /ops/kpis — platform KPI stat tiles (grouped) + phase-1 exit criteria meters + period switch.
 * Meters: the fill carries state (brand = in progress, success = met), the track is a lighter step
 * of the same hue, and every meter has a text label + icon so state is never colour-alone.
 */
import * as React from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { StatCard } from "@/components/ui/stat-card";
import { useKpis } from "@/lib/api/hooks/mobility";
import {
  KPI_PERIODS,
  type KpiPeriod,
  type Kpis,
  type Phase1ExitRow,
} from "@/lib/api/types-mobility";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { exitProgress } from "./scale";

export function KpisPage() {
  const t = useTranslations("kpis");
  const [days, setDays] = React.useState<KpiPeriod>(30);
  const query = useKpis(days);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Segmented
            label={t("period_label")}
            value={String(days) as `${KpiPeriod}`}
            onChange={(v) => setDays(Number(v) as KpiPeriod)}
            options={KPI_PERIODS.map((p) => ({
              value: String(p) as `${KpiPeriod}`,
              label: t(`period.${p}`),
            }))}
          />
        }
      />
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div
          className={cn(
            "space-y-6",
            query.isFetching && !query.isLoading && "opacity-70 transition-opacity",
          )}
        >
          <ExitCriteria data={query.data} loading={query.isLoading} />
          <KpiGroups data={query.data} loading={query.isLoading} />
        </div>
      )}
    </>
  );
}

function KpiGroups({ data, loading }: { data?: Kpis; loading: boolean }) {
  const t = useTranslations("kpis");
  const f = useFormat();
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? t("no_data") : `${f.number(v * 100, { decimals: 0 })}%`;
  const num = (v: number | null | undefined, decimals = 0) =>
    v === null || v === undefined ? t("no_data") : f.number(v, { decimals });
  const days = (v: number | null | undefined) =>
    v === null || v === undefined
      ? t("no_data")
      : t("days_value", { value: f.number(v, { decimals: 1 }) });
  const hours = (v: number | null | undefined) =>
    v === null || v === undefined
      ? t("no_data")
      : t("hours_value", { value: f.number(v, { decimals: 1 }) });
  const d = data;
  const groups: { title: string; items: { label: string; value: string; hint: string }[] }[] = [
    {
      title: t("group_speed"),
      items: [
        {
          label: t("time_to_fill"),
          value: days(d?.time_to_fill_days_median),
          hint: t("time_to_fill_hint"),
        },
        {
          label: t("time_to_shortlist"),
          value: hours(d?.time_to_shortlist_hours_median),
          hint: t("time_to_shortlist_hint"),
        },
        { label: t("fill_rate"), value: pct(d?.fill_rate), hint: t("fill_rate_hint") },
      ],
    },
    {
      title: t("group_volume"),
      items: [
        { label: t("placements"), value: num(d?.placements), hint: t("placements_hint") },
        {
          label: t("revenue"),
          value: d ? f.money(d.placement_revenue) : t("no_data"),
          hint: t("revenue_hint"),
        },
        {
          label: t("verified_added"),
          value: num(d?.verified_workers_added),
          hint: t("verified_added_hint"),
        },
        {
          label: t("activation"),
          value: pct(d?.worker_activation_rate),
          hint: t("activation_hint"),
        },
      ],
    },
    {
      title: t("group_quality"),
      items: [
        {
          label: t("repeat_employers"),
          value: pct(d?.repeat_employer_rate),
          hint: t("repeat_employers_hint"),
        },
        { label: t("dispute_rate"), value: pct(d?.dispute_rate), hint: t("dispute_rate_hint") },
        {
          label: t("rating_workers"),
          value: num(d?.avg_employer_rating_of_workers, 1),
          hint: t("rating_hint"),
        },
        {
          label: t("rating_employers"),
          value: num(d?.avg_worker_rating_of_employers, 1),
          hint: t("rating_hint"),
        },
      ],
    },
  ];
  return (
    <>
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className="text-fg mb-3 text-sm font-semibold">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.items.map((it) => (
              <StatCard
                key={it.label}
                label={it.label}
                value={it.value}
                hint={it.hint}
                loading={loading}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ExitCriteria({ data, loading }: { data?: Kpis; loading: boolean }) {
  const t = useTranslations("kpis");
  const f = useFormat();
  const rows = data?.phase1_exit ?? [];
  const met = rows.filter((r) => r.met).length;
  return (
    <Card>
      <CardHeader
        title={t("exit_title")}
        description={t("exit_subtitle")}
        action={
          data ? (
            <Badge tone={data.phase1_exit_met ? "success" : "brand"}>
              {data.phase1_exit_met
                ? t("exit_all_met")
                : t("exit_progress", { met: f.digits(met), total: f.digits(rows.length) })}
            </Badge>
          ) : null
        }
      />
      <CardBody>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((r) => (
              <ExitMeter key={r.key} row={r} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ExitMeter({ row }: { row: Phase1ExitRow }) {
  const t = useTranslations("kpis");
  const f = useFormat();
  const progress = exitProgress(row);
  const isDays = row.key === "median_fill_days";
  const actual =
    row.actual === null
      ? t("no_data")
      : isDays
        ? t("days_value", { value: f.number(row.actual, { decimals: 1 }) })
        : f.number(row.actual);
  const target =
    row.comparator === "lt"
      ? t("exit_target_lt", { target: f.digits(row.target) })
      : t("exit_target_gte", { target: f.number(row.target) });
  const Icon = row.met ? CheckCircle2 : CircleDashed;
  const labelId = `exit-${row.key}`;
  return (
    <li>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span id={labelId} className="text-fg flex items-center gap-1.5 text-sm font-medium">
          <Icon className={cn("size-4", row.met ? "text-success" : "text-fg-muted")} aria-hidden />
          {t(`exit.${row.key}`)}
        </span>
        <span className="text-fg-muted text-xs">
          <span className="text-fg font-semibold">{actual}</span> · {target} ·{" "}
          <span className={row.met ? "text-success font-medium" : ""}>
            {row.met ? t("met") : t("not_met")}
          </span>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${actual} — ${target}`}
        className={cn(
          "h-2 w-full overflow-hidden rounded-full",
          row.met ? "bg-success-subtle" : "bg-brand-subtle",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            row.met ? "bg-success" : "bg-brand",
          )}
          style={{ width: `${Math.max(progress * 100, row.actual ? 2 : 0)}%` }}
        />
      </div>
    </li>
  );
}
