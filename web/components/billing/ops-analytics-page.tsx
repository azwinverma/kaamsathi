"use client";
/** Ops product analytics: sequential funnels with step-conversion bars + weekly retention cohorts. */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { FUNNEL_NAMES, useFunnel, useRetention, type FunnelName, type FunnelStep } from "@/lib/api/hooks/analytics";
import { useFormat } from "@/lib/use-format";

const DAY_OPTIONS = [7, 30, 90, 365];

export function OpsAnalyticsPage() {
  const t = useTranslations("ops_analytics");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="mb-4 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-fg-muted">
        <Info className="mt-px size-4 shrink-0 text-brand" aria-hidden />
        {t("privacy_note")}
      </p>
      <div className="space-y-6">
        <FunnelCard />
        <RetentionCard />
      </div>
    </>
  );
}

export function pct(v: number | null, digits = 1): string {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

function FunnelCard() {
  const t = useTranslations("ops_analytics");
  const f = useFormat();
  const [name, setName] = React.useState<FunnelName>("worker_onboarding");
  const [days, setDays] = React.useState(30);
  const { data, isLoading, error, refetch, isPlaceholderData } = useFunnel(name, days);
  return (
    <Card>
      <CardHeader
        title={t("funnels")}
        description={t(`funnel_desc.${name}`)}
        action={
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              aria-label={t("funnel")}
              value={name}
              onChange={(e) => setName(e.target.value as FunnelName)}
              options={FUNNEL_NAMES.map((n) => ({ value: n, label: t(`funnel_name.${n}`) }))}
            />
            <NativeSelect
              aria-label={t("window")}
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              options={DAY_OPTIONS.map((d) => ({ value: String(d), label: t("last_days", { days: d }) }))}
            />
          </div>
        }
      />
      <CardBody>
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading || !data ? (
          <TableSkeleton rows={5} cols={3} />
        ) : (
          <ol className={isPlaceholderData ? "space-y-3 opacity-60" : "space-y-3"} aria-label={t(`funnel_name.${name}`)}>
            {data.steps.map((s, i) => (
              <FunnelBar key={s.key} step={s} index={i} first={data.steps[0]?.count ?? null} format={f.number} />
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function FunnelBar({
  step,
  index,
  first,
  format,
}: {
  step: FunnelStep;
  index: number;
  first: number | null;
  format: (v: number) => string;
}) {
  const t = useTranslations("ops_analytics");
  const width = step.count !== null && first ? Math.max(2, Math.round((step.count / first) * 100)) : 0;
  return (
    <li>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-fg">
          {index + 1}. {t.has(`step.${step.key}`) ? t(`step.${step.key}`) : step.key}
        </span>
        <span className="tabular text-fg-muted">
          {step.suppressed ? t("suppressed") : format(step.count ?? 0)}
          {index > 0 ? ` · ${t("from_previous", { pct: pct(step.conversion_from_previous) })}` : null}
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-label={t.has(`step.${step.key}`) ? t(`step.${step.key}`) : step.key}
      >
        <div
          className={step.suppressed ? "h-full rounded-full bg-border-strong" : "h-full rounded-full bg-brand"}
          style={{ width: step.suppressed ? "100%" : `${width}%`, opacity: step.suppressed ? 0.35 : 1 }}
        />
      </div>
    </li>
  );
}

function RetentionCard() {
  const t = useTranslations("ops_analytics");
  const f = useFormat();
  const [weeks, setWeeks] = React.useState(8);
  const { data, isLoading, error, refetch } = useRetention(weeks);
  const maxCols = data ? Math.max(1, ...data.rows.map((r) => r.weeks.length)) : 0;
  return (
    <Card>
      <CardHeader
        title={t("retention")}
        description={t("retention_desc")}
        action={
          <NativeSelect
            aria-label={t("cohorts")}
            value={String(weeks)}
            onChange={(e) => setWeeks(Number(e.target.value))}
            options={[4, 8, 12, 26].map((w) => ({ value: String(w), label: t("last_weeks", { weeks: w }) }))}
          />
        }
      />
      <CardBody>
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading || !data ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <TableContainer className="shadow-none">
            <Table>
              <THead>
                <tr>
                  <Th>{t("cohort_week")}</Th>
                  <Th numeric>{t("users")}</Th>
                  {Array.from({ length: maxCols }).map((_, i) => (
                    <Th key={i} numeric>
                      {t("week_n", { n: i })}
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {data.rows.map((r) => (
                  <Tr key={r.cohort_start}>
                    <RowHeader className="whitespace-nowrap tabular">{f.date(r.cohort_start).bs}</RowHeader>
                    <Td numeric>{r.suppressed ? t("suppressed_short") : f.number(r.size ?? 0)}</Td>
                    {Array.from({ length: maxCols }).map((_, i) => {
                      const w = r.weeks[i];
                      const rate = w?.rate ?? null;
                      return (
                        <Td
                          key={i}
                          numeric
                          className="tabular"
                          style={rate !== null ? { backgroundColor: `color-mix(in oklab, var(--color-brand) ${Math.round(rate * 45)}%, transparent)` } : undefined}
                        >
                          {w ? pct(rate, 0) : ""}
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <p className="mt-3 text-xs text-fg-muted">{t("k_note", { k: data?.k_anonymity ?? 5 })}</p>
      </CardBody>
    </Card>
  );
}
