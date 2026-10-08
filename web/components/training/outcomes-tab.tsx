"use client";
import * as React from "react";
import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateText } from "@/components/ui/date";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Toolbar } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { TradeSelect } from "@/components/shared/selects";
import { useOpsProviders, useTrainingOutcomes } from "@/lib/api/hooks/training";
import type { CourseOutcome } from "@/lib/api/types-training";
import { useFormat } from "@/lib/use-format";
import { formatPct } from "./utils";

/** T010 — per-course outcomes funnel with k-anonymity suppression. */
export function OutcomesTab() {
  const t = useTranslations("training.outcomes");
  const tCourses = useTranslations("training.courses");
  const f = useFormat();
  const [provider, setProvider] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const providers = useOpsProviders({ page_size: 100 });
  const query = useTrainingOutcomes({
    provider: provider || undefined,
    trade: trade || undefined,
  });
  const rows = query.data?.courses ?? [];
  const k = query.data?.k_anonymity ?? 5;
  const hidden = t("hidden", { k: f.digits(k) });

  const count = (v: number | null) => (v === null ? <HiddenValue label={hidden} /> : f.digits(v));
  const pct = (v: number | null) => {
    const s = formatPct(v);
    return s === null ? <HiddenValue label={hidden} /> : f.digits(s);
  };
  const money = (v: string | null) => (v === null ? <HiddenValue label={hidden} /> : f.money(v));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-fg text-lg font-semibold">{t("title")}</h2>
        <p className="text-fg-muted text-sm">
          {t("subtitle", {
            days: f.digits(query.data?.placement_window_days ?? 90),
            retention: f.digits(query.data?.retention_days ?? 90),
            k: f.digits(k),
          })}
        </p>
      </div>
      <Toolbar>
        <NativeSelect
          aria-label={tCourses("provider")}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder={tCourses("all_providers")}
          className="sm:w-56"
          options={(providers.data?.results ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <div className="sm:w-56">
          <TradeSelect
            value={trade}
            onChange={setTrade}
            placeholder={t("all_trades")}
            aria-label={tCourses("trade")}
          />
        </div>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={9} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={TrendingUp} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
          <Table className="min-w-[1100px]">
            <THead>
              <tr>
                <Th sticky>{t("course")}</Th>
                <Th numeric>{t("enrolled")}</Th>
                <Th numeric>{t("completed")}</Th>
                <Th numeric>{t("placed")}</Th>
                <Th numeric>{t("retained")}</Th>
                <Th numeric>{t("completion_rate")}</Th>
                <Th numeric>{t("placement_rate")}</Th>
                <Th numeric>{t("retention_rate")}</Th>
                <Th numeric>{t("wage_before")}</Th>
                <Th numeric>{t("wage_after")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r: CourseOutcome) => (
                <Tr key={r.course.id}>
                  <RowHeader sticky className="min-w-56">
                    <span className="block">{r.course.title}</span>
                    <span className="text-fg-muted mt-0.5 flex flex-wrap items-center gap-1 text-xs font-normal">
                      {r.course.provider.name} · {f.name(r.course.trade)} ·{" "}
                      <DateText ad={r.course.starts_on} bs={r.course.starts_on_bs} inline />
                    </span>
                  </RowHeader>
                  <Td numeric>{count(r.enrolled)}</Td>
                  <Td numeric>{count(r.completed)}</Td>
                  <Td numeric>{count(r.placed_90d)}</Td>
                  <Td numeric>{count(r.retained_90d)}</Td>
                  <Td numeric>{pct(r.completion_rate)}</Td>
                  <Td numeric>{pct(r.placement_rate)}</Td>
                  <Td numeric>{pct(r.retention_rate)}</Td>
                  <Td numeric>{money(r.median_wage_before)}</Td>
                  <Td numeric>{money(r.median_wage_after)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

/** "—" with a tooltip explaining k-anonymity suppression (keyboard-focusable). */
function HiddenValue({ label }: { label: string }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className="text-fg-subtle focus-visible:ring-ring cursor-help rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        aria-label={label}
      >
        —
      </button>
    </Tooltip>
  );
}
