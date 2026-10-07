"use client";
import * as React from "react";
import { BarChart3, Clock, ShieldCheck, TrendingDown, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { NoAccess } from "@/components/org/no-access";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { StatCard } from "@/components/ui/stat-card";
import { useOrgAnalytics } from "@/lib/api/hooks/insights";
import type { AnalyticsMonth, OrgAnalytics } from "@/lib/api/types-insights";
import { useFormat } from "@/lib/use-format";
import { ChartCard, ChartEmpty, ColumnChart, HBarList, LineChart, type Datum } from "./charts";

const RANGES = ["3", "6", "12"] as const;
type Range = (typeof RANGES)[number];

export function OrgAnalyticsView() {
  const { canManage } = useSession();
  if (!canManage) return <NoAccess />;
  return <AnalyticsInner />;
}

function AnalyticsInner() {
  const t = useTranslations("insights.org");
  const [range, setRange] = React.useState<Range>("6");
  const query = useOrgAnalytics(Number(range));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Segmented
            label={t("range_label")}
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: t("range_months", { count: Number(r) }) }))}
          />
        }
      />
      {query.isLoading ? (
        <AnalyticsSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <div className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
          <Body data={query.data} />
        </div>
      ) : null}
    </>
  );
}

/** Rate axis: 100% on top, floor a little under the lowest value (never a misleading 0–100 flatline). */
function rateDomain(data: Datum[]): [number, number] {
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (!vals.length) return [0, 100];
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 10) / 10) * 10);
  return [lo, 100];
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function useMonthLabel() {
  const f = useFormat();
  return (m: AnalyticsMonth) => `${f.monthName(m.bs_month).slice(0, f.locale === "ne" ? 6 : 3)} ${f.digits(String(m.bs_year).slice(2))}`;
}

function Body({ data }: { data: OrgAnalytics }) {
  const t = useTranslations("insights.org");
  const tc = useTranslations("insights.chart");
  const f = useFormat();
  const monthLabel = useMonthLabel();
  const fullMonth = (m: AnalyticsMonth) => f.bsMonth(m.bs_year, m.bs_month);
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${f.number(v, { decimals: 1 })}%`);

  const headcount: Datum[] = data.headcount_trend.map((m) => ({
    key: m.month,
    label: monthLabel(m),
    value: m.active,
    display: f.number(m.active),
    hint: t("joined_left", { joined: f.number(m.joined), left: f.number(m.left) }),
  }));
  const attendance: Datum[] = data.attendance_rate_trend.map((m) => ({
    key: m.month,
    label: monthLabel(m),
    value: m.rate,
    display: pct(m.rate),
    suppressed: m.suppressed,
  }));
  const overtime: Datum[] = data.overtime_hours_trend.map((m) => ({
    key: m.month,
    label: monthLabel(m),
    value: m.hours,
    display: m.hours === null ? "—" : f.hours(m.hours),
    suppressed: m.suppressed,
  }));
  const wages: Datum[] = data.wage_bill_trend.map((m) => ({
    key: m.month,
    label: monthLabel(m),
    value: m.employer_cost === null ? null : Number(m.employer_cost),
    display: f.money(m.employer_cost, { compact: true }),
    hint: m.gross ? t("gross_net", { gross: f.money(m.gross), net: f.money(m.net) }) : undefined,
    suppressed: m.suppressed,
  }));
  const sites: Datum[] = data.absenteeism_by_site.map((s, i) => ({
    key: s.site?.id ?? `none-${i}`,
    label: s.site?.name ?? t("no_site"),
    value: s.absence_rate,
    display: pct(s.absence_rate),
    hint: s.workers !== null ? t("workers_n", { count: s.workers }) : undefined,
    suppressed: s.suppressed,
  }));
  const weekdays: Datum[] = data.top_absence_weekdays.map((w) => ({
    key: String(w.weekday),
    label: f.weekday(w.weekday, true),
    value: w.absences,
    display: f.number(w.absences),
    hint: w.absence_rate !== null ? t("rate_of_days", { rate: pct(w.absence_rate) }) : undefined,
  }));

  const hasPayroll = data.wage_bill_trend.some((m) => m.employer_cost !== null || m.suppressed);
  const hasAttendance = data.attendance_rate_trend.some((m) => m.rate !== null || m.suppressed);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("active_now")} value={f.number(data.active_now)} icon={Users} tone="brand" />
        <StatCard
          label={t("attrition")}
          value={pct(data.attrition_rate)}
          icon={TrendingDown}
          hint={t("attrition_hint", { months: f.number(data.months) })}
          tone={data.attrition_rate !== null && data.attrition_rate > 20 ? "warning" : "neutral"}
        />
        <StatCard
          label={t("avg_tenure")}
          value={data.avg_tenure_months === null ? "—" : t("months_value", { value: f.number(data.avg_tenure_months, { decimals: 1 }) })}
          icon={ShieldCheck}
        />
        <StatCard
          label={t("cost_per_hire")}
          value={data.cost_per_hire ? f.money(data.cost_per_hire) : "—"}
          icon={UserPlus}
          hint={t("hires_n", { count: data.hires })}
        />
        <StatCard
          label={t("time_to_shortlist")}
          value={data.time_to_shortlist_hours_avg === null ? "—" : f.hours(data.time_to_shortlist_hours_avg)}
          icon={Clock}
          className="col-span-1"
        />
        <StatCard
          label={t("time_to_fill")}
          value={
            data.time_to_fill_days_avg === null ? "—" : t("days_value", { value: f.number(data.time_to_fill_days_avg, { decimals: 1 }) })
          }
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("headcount_title")}
          description={t("headcount_desc")}
          table={{
            columns: [
              { key: "month", label: tc("month") },
              { key: "active", label: t("active"), numeric: true },
              { key: "joined", label: t("joined"), numeric: true },
              { key: "left", label: t("left"), numeric: true },
            ],
            rows: data.headcount_trend.map((m) => ({
              month: fullMonth(m),
              active: f.number(m.active),
              joined: f.number(m.joined),
              left: f.number(m.left),
            })),
          }}
        >
          <ColumnChart data={headcount} ariaLabel={t("headcount_title")} formatTick={(v) => f.number(v)} />
        </ChartCard>

        <ChartCard
          title={t("attendance_title")}
          description={t("attendance_desc")}
          table={{
            columns: [
              { key: "month", label: tc("month") },
              { key: "rate", label: t("attendance_rate"), numeric: true },
            ],
            rows: data.attendance_rate_trend.map((m) => ({
              month: fullMonth(m),
              rate: m.suppressed ? tc("suppressed_short") : pct(m.rate),
            })),
          }}
        >
          {hasAttendance ? (
            <LineChart data={attendance} ariaLabel={t("attendance_title")} domain={rateDomain(attendance)} formatTick={(v) => `${f.number(v)}%`} />
          ) : (
            <ChartEmpty>{t("no_attendance")}</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title={t("wage_bill_title")}
          description={t("wage_bill_desc")}
          table={{
            columns: [
              { key: "month", label: tc("month") },
              { key: "gross", label: t("gross"), numeric: true },
              { key: "net", label: t("net"), numeric: true },
              { key: "employer_cost", label: t("employer_cost"), numeric: true },
            ],
            rows: data.wage_bill_trend.map((m) => ({
              month: fullMonth(m),
              gross: m.suppressed ? tc("suppressed_short") : f.money(m.gross),
              net: m.suppressed ? tc("suppressed_short") : f.money(m.net),
              employer_cost: m.suppressed ? tc("suppressed_short") : f.money(m.employer_cost),
            })),
          }}
        >
          {hasPayroll ? (
            <ColumnChart data={wages} ariaLabel={t("wage_bill_title")} formatTick={(v) => f.money(v, { compact: true })} />
          ) : (
            <ChartEmpty>{t("no_payroll")}</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title={t("overtime_title")}
          description={t("overtime_desc")}
          table={{
            columns: [
              { key: "month", label: tc("month") },
              { key: "hours", label: t("overtime_hours"), numeric: true },
            ],
            rows: data.overtime_hours_trend.map((m) => ({
              month: fullMonth(m),
              hours: m.suppressed ? tc("suppressed_short") : m.hours === null ? "—" : f.hours(m.hours),
            })),
          }}
        >
          {hasAttendance ? (
            <ColumnChart data={overtime} ariaLabel={t("overtime_title")} formatTick={(v) => f.number(v)} />
          ) : (
            <ChartEmpty>{t("no_attendance")}</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title={t("absence_by_site_title")}
          description={t("absence_by_site_desc")}
          table={{
            columns: [
              { key: "site", label: t("site") },
              { key: "rate", label: t("absence_rate"), numeric: true },
              { key: "workers", label: t("workers"), numeric: true },
            ],
            rows: data.absenteeism_by_site.map((s) => ({
              site: s.site?.name ?? t("no_site"),
              rate: s.suppressed ? tc("suppressed_short") : pct(s.absence_rate),
              workers: s.workers === null ? tc("suppressed_short") : f.number(s.workers),
            })),
          }}
        >
          <HBarList rows={sites} ariaLabel={t("absence_by_site_title")} emptyLabel={t("no_attendance")} />
        </ChartCard>

        <ChartCard
          title={t("absence_weekday_title")}
          description={t("absence_weekday_desc")}
          table={{
            columns: [
              { key: "day", label: t("weekday") },
              { key: "absences", label: t("absences"), numeric: true },
              { key: "rate", label: t("absence_rate"), numeric: true },
            ],
            rows: data.top_absence_weekdays.map((w) => ({
              day: f.weekday(w.weekday, true),
              absences: f.number(w.absences),
              rate: pct(w.absence_rate),
            })),
          }}
        >
          <HBarList rows={weekdays} ariaLabel={t("absence_weekday_title")} emptyLabel={t("weekday_hidden")} />
        </ChartCard>
      </div>
      <p className="text-xs text-fg-muted">{t("privacy_note", { k: f.number(data.k_anonymity) })}</p>
    </div>
  );
}
