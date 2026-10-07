"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase } from "lucide-react";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Money } from "@/components/ui/date";
import { TradeSelect } from "@/components/shared/selects";
import { HoursOpenBadge } from "@/components/ops/ops-ui";
import { SHORTLIST_SLA_HOURS } from "@/components/ops/helpers";
import { useOpsJobs } from "@/lib/api/hooks/ops";
import { listResults } from "@/lib/api/client";
import type { OpsJob } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";

type Scope = "all" | "overdue" | "no_shortlist";

function shortlistedCount(j: OpsJob): number {
  const c = j.counts;
  if (!c) return 0;
  return (c.shortlisted ?? 0) + (c.interview ?? 0) + (c.selected ?? 0) + (c.joined ?? 0);
}

export default function OpsJobsPage() {
  const t = useTranslations();
  const tj = useTranslations("ops.jobs");
  const f = useFormat();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [scope, setScope] = React.useState<Scope>("all");

  const query = useOpsJobs({ status: "open", q, trade, page_size: 100 });
  const all = React.useMemo(
    () => [...listResults(query.data)].sort((a, b) => (b.hours_open ?? 0) - (a.hours_open ?? 0)),
    [query.data],
  );
  const overdue = all.filter((j) => (j.hours_open ?? 0) > SHORTLIST_SLA_HOURS).length;
  const rows = all.filter((j) =>
    scope === "overdue"
      ? (j.hours_open ?? 0) > SHORTLIST_SLA_HOURS
      : scope === "no_shortlist"
        ? !j.first_shortlist_at && shortlistedCount(j) === 0
        : true,
  );
  const filtersActive = !!(q || trade || scope !== "all");

  return (
    <>
      <PageHeader
        title={tj("title")}
        description={tj("subtitle", { hours: f.digits(SHORTLIST_SLA_HOURS) })}
        meta={
          query.data ? (
            <>
              <Badge tone="brand">{tj("open_count", { count: all.length })}</Badge>
              {overdue ? <Badge tone="danger">{tj("overdue_count", { count: overdue })}</Badge> : null}
            </>
          ) : null
        }
      />

      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={tj("search_placeholder")} />
        <div className="sm:w-48">
          <TradeSelect value={trade} onChange={setTrade} allowEmpty placeholder={tj("all_trades")} aria-label={t("term.trade")} />
        </div>
        <Segmented
          label={tj("scope_label")}
          value={scope}
          onChange={setScope}
          className="self-start"
          options={[
            { value: "all", label: t("common.all") },
            { value: "overdue", label: tj("scope_overdue") },
            { value: "no_shortlist", label: tj("scope_no_shortlist") },
          ]}
        />
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <EmptyState
            title={t("common.no_results")}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ("");
                  setTrade("");
                  setScope("all");
                }}
              >
                {t("common.clear_filters")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Briefcase} title={tj("empty_title")} description={tj("empty_body")} />
        )
      ) : (
        <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
          <Table>
            <THead>
              <tr>
                <Th>{tj("job")}</Th>
                <Th className="max-md:hidden">{tj("organization")}</Th>
                <Th>{tj("hours_open")}</Th>
                <Th numeric>{tj("openings")}</Th>
                <Th numeric className="max-sm:hidden">{tj("shortlisted")}</Th>
                <Th numeric className="max-lg:hidden">{tj("wage")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((j) => {
                const over = (j.hours_open ?? 0) > SHORTLIST_SLA_HOURS;
                const sl = shortlistedCount(j);
                return (
                  <Tr
                    key={j.id}
                    interactive
                    onClick={() => router.push(`/ops/jobs/${j.id}`)}
                    className={over ? "[&>*]:bg-danger-subtle/40" : undefined}
                  >
                    <RowHeader className="min-w-52">
                      <Link
                        href={`/ops/jobs/${j.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="block truncate font-medium text-fg">{j.title}</span>
                        <span className="block truncate text-xs font-normal text-fg-muted">
                          {f.name(j.trade)}
                          <span className="md:hidden"> · {j.organization?.name}</span>
                        </span>
                      </Link>
                    </RowHeader>
                    <Td className="max-md:hidden">
                      <Link
                        href={`/ops/organizations/${j.organization?.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {j.organization?.name}
                      </Link>
                    </Td>
                    <Td>
                      <HoursOpenBadge hours={j.hours_open} />
                    </Td>
                    <Td numeric>{f.number(j.openings_count)}</Td>
                    <Td numeric className="max-sm:hidden">
                      {sl ? f.number(sl) : <span className="text-fg-subtle">—</span>}
                    </Td>
                    <Td numeric className="max-lg:hidden">
                      <Money value={j.wage_amount} />
                      <span className="ml-1 text-xs text-fg-muted">
                        {j.wage_type === "daily" ? t("common.per_day") : t("common.per_month")}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
