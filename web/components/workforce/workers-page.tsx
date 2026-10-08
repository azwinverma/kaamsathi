"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { StatusBadge } from "@/components/shared/status-badge";
import { TradeSelect } from "@/components/shared/selects";
import { WorkerIdentity } from "@/components/shared/worker-summary";
import { Button } from "@/components/ui/button";
import { DateText, Money } from "@/components/ui/date";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useEmployments } from "@/lib/api/hooks/workforce";
import type { Employment } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { AddWorkerDialog } from "./add-worker-dialog";
import { ImportDialog } from "./import-dialog";
import { WorkforceSiteSelect } from "./shared";

const PAGE_SIZE = 25;
type StatusFilter = "active" | "ended" | "all";

export function WorkersPage() {
  const t = useTranslations();
  const tw = useTranslations("workforce.workers");
  const f = useFormat();
  const router = useRouter();
  const { canManage } = useSession();

  const [status, setStatus] = React.useState<StatusFilter>("active");
  const [site, setSite] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [wageType, setWageType] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => setPage(1), [status, site, trade, wageType, q]);

  const { data, isLoading, isError, error, refetch, isFetching } = useEmployments({
    status: status === "all" ? undefined : status,
    site: site || undefined,
    trade: trade || undefined,
    wage_type: wageType || undefined,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = data?.results ?? [];
  const filtered = !!(site || trade || wageType || q || status !== "active");

  const clear = () => {
    setStatus("active");
    setSite("");
    setTrade("");
    setWageType("");
    setQ("");
  };

  const wageCell = (e: Employment) =>
    e.wage_type === "hourly" ? (
      <span className="inline-flex flex-col items-end leading-tight">
        <Money value={e.hourly_wage ?? null} />
        <span className="text-fg-muted text-xs">{t("wage_hourly.per_hour")}</span>
      </span>
    ) : e.wage_type === "daily" ? (
      <span className="inline-flex flex-col items-end leading-tight">
        <Money value={e.daily_wage} />
        <span className="text-fg-muted text-xs">{t("common.per_day")}</span>
      </span>
    ) : (
      <span className="inline-flex flex-col items-end leading-tight">
        <Money value={e.monthly_gross ?? e.basic_salary} />
        <span className="text-fg-muted text-xs">{t("common.per_month")}</span>
      </span>
    );

  return (
    <div>
      <PageHeader
        title={t("nav.workers")}
        description={tw("description")}
        meta={
          data ? (
            <span className="text-fg-muted text-sm">
              {t("term.workers_count", { count: data.count })}
            </span>
          ) : null
        }
        actions={
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <FileUp aria-hidden />
                {tw("import")}
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus aria-hidden />
                {tw("add")}
              </Button>
            </>
          ) : null
        }
      />

      <Toolbar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={tw("search_placeholder")}
          label={t("common.search")}
        />
        <Segmented<StatusFilter>
          label={t("common.status")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: t("status.active") },
            { value: "ended", label: t("status.ended") },
            { value: "all", label: t("common.all") },
          ]}
        />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <WorkforceSiteSelect
            value={site}
            onChange={setSite}
            className="sm:w-48"
            aria-label={t("term.site")}
          />
          <div className="sm:w-44">
            <TradeSelect
              value={trade}
              onChange={setTrade}
              allowEmpty
              placeholder={tw("all_trades")}
              aria-label={t("term.trade")}
            />
          </div>
          <div className="sm:w-40">
            <NativeSelect
              value={wageType}
              onChange={(e) => setWageType(e.target.value)}
              aria-label={t("term.wage_type")}
              placeholder={tw("all_wage_types")}
              options={[
                { value: "monthly", label: t("term.monthly") },
                { value: "daily", label: t("term.daily") },
              ]}
            />
          </div>
        </div>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            {t("common.clear_filters")}
          </Button>
        ) : null}
      </Toolbar>

      {isLoading ? (
        <TableSkeleton cols={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Users}
            title={t("common.no_results")}
            action={
              <Button variant="secondary" onClick={clear}>
                {t("common.clear_filters")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title={tw("empty_title")}
            description={canManage ? tw("empty_body") : tw("empty_body_supervisor")}
            action={
              canManage ? (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus aria-hidden />
                  {tw("add")}
                </Button>
              ) : null
            }
          />
        )
      ) : (
        <>
          <TableContainer className={isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table className="min-w-[760px]">
              <THead>
                <Tr>
                  <Th sticky>{tw("col_worker")}</Th>
                  <Th>{t("term.designation")}</Th>
                  <Th>{t("term.site")}</Th>
                  {canManage ? <Th numeric>{tw("col_wage")}</Th> : null}
                  <Th>{t("term.start_date")}</Th>
                  <Th>{t("common.status")}</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((e) => (
                  <Tr key={e.id} interactive onClick={() => router.push(`/app/workers/${e.id}`)}>
                    <RowHeader sticky className="py-2">
                      <Link
                        href={`/app/workers/${e.id}`}
                        onClick={(ev) => ev.stopPropagation()}
                        className="focus-visible:outline-ring block rounded focus-visible:outline-2"
                      >
                        <WorkerIdentity worker={e.worker} size="sm" showPhone={false} />
                      </Link>
                      {e.employee_code ? (
                        <span className="text-fg-muted tabular mt-0.5 block pl-11 text-xs font-normal">
                          {e.employee_code}
                        </span>
                      ) : null}
                    </RowHeader>
                    <Td>
                      <span className="text-fg block">{e.designation || "—"}</span>
                      {e.trade ? (
                        <span className="text-fg-muted text-xs">{f.name(e.trade)}</span>
                      ) : null}
                    </Td>
                    <Td>{e.site?.name ?? <span className="text-fg-muted">—</span>}</Td>
                    {canManage ? <Td numeric>{wageCell(e)}</Td> : null}
                    <Td>
                      <DateText ad={e.start_date} bs={e.start_date_bs} />
                    </Td>
                    <Td>
                      <StatusBadge status={e.status} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}

      {canManage ? (
        <>
          <AddWorkerDialog open={addOpen} onOpenChange={setAddOpen} />
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
        </>
      ) : null}
    </div>
  );
}
