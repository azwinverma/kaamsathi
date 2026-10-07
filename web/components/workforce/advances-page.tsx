"use client";
import * as React from "react";
import Link from "next/link";
import { HandCoins, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { DateText, Money } from "@/components/ui/date";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Segmented } from "@/components/ui/segmented";
import { StatCard } from "@/components/ui/stat-card";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listResults } from "@/lib/api/client";
import { useAdvances } from "@/lib/api/hooks/workforce";
import type { Advance } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { CreateAdvanceDialog, EditAdvanceDialog, outstandingOf } from "./advance-dialogs";
import { RecoveryBar } from "./employment-detail";
import { EmploymentPicker } from "./employment-picker";
import { NoAccess } from "./shared";
import { employmentIdOf, parseAmount, workerNameOf } from "./utils";

const PAGE_SIZE = 25;
type Show = "outstanding" | "all";

export function AdvancesPage() {
  const { canManage } = useSession();
  if (!canManage) return <NoAccess />;
  return <AdvancesInner />;
}

function AdvancesInner() {
  const t = useTranslations();
  const ta = useTranslations("workforce.advances");
  const f = useFormat();
  const [employment, setEmployment] = React.useState("");
  const [show, setShow] = React.useState<Show>("outstanding");
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Advance | null>(null);

  React.useEffect(() => setPage(1), [employment]);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdvances({
    employment: employment || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const all = listResults(data);
  const count = data && !Array.isArray(data) ? data.count : all.length;
  const rows = show === "outstanding" ? all.filter((a) => outstandingOf(a) > 0) : all;

  const totals = React.useMemo(() => {
    let given = 0;
    let recovered = 0;
    for (const a of all) {
      given += parseAmount(a.amount) ?? 0;
      recovered += parseAmount(a.recovered_amount) ?? 0;
    }
    return { given, recovered, outstanding: Math.max(0, given - recovered) };
  }, [all]);

  return (
    <div>
      <PageHeader
        title={t("nav.advance")}
        description={ta("description")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden />
            {ta("create")}
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={ta("total_given")} value={f.money(totals.given)} loading={isLoading} icon={HandCoins} tone="brand" />
        <StatCard label={ta("recovered")} value={f.money(totals.recovered)} loading={isLoading} tone="success" />
        <StatCard label={ta("outstanding")} value={f.money(totals.outstanding)} loading={isLoading} tone="warning" />
      </div>

      <Toolbar>
        <div className="w-full sm:w-72">
          <EmploymentPicker
            value={employment}
            onChange={(id) => setEmployment(id)}
            placeholder={ta("filter_worker")}
            aria-label={ta("filter_worker")}
          />
        </div>
        <Segmented<Show>
          label={ta("show")}
          value={show}
          onChange={setShow}
          options={[
            { value: "outstanding", label: ta("show_outstanding") },
            { value: "all", label: t("common.all") },
          ]}
        />
        {employment ? (
          <Button variant="ghost" size="sm" onClick={() => setEmployment("")}>
            {t("common.clear_filters")}
          </Button>
        ) : null}
      </Toolbar>

      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={all.length ? ta("empty_outstanding") : ta("empty")}
          description={all.length ? undefined : ta("empty_body")}
          action={
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {ta("create")}
            </Button>
          }
        />
      ) : (
        <>
          <TableContainer className={isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table className="min-w-[860px]">
              <THead>
                <Tr>
                  <Th sticky>{ta("worker")}</Th>
                  <Th>{ta("given_on")}</Th>
                  <Th numeric>{t("common.amount")}</Th>
                  <Th numeric>{ta("recover_per_month")}</Th>
                  <Th numeric>{ta("recovered")}</Th>
                  <Th numeric>{ta("outstanding")}</Th>
                  <Th className="w-40">{ta("progress")}</Th>
                  <Th className="text-right">
                    <span className="sr-only">{t("common.actions")}</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((a) => {
                  const empId = employmentIdOf(a);
                  const name = workerNameOf(a) || "—";
                  const out = outstandingOf(a);
                  return (
                    <Tr key={a.id}>
                      <RowHeader sticky>
                        {empId ? (
                          <Link href={`/app/workers/${empId}`} className="hover:underline">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                        {a.note ? <span className="block max-w-56 truncate text-xs font-normal text-fg-muted">{a.note}</span> : null}
                      </RowHeader>
                      <Td>
                        <DateText ad={a.given_on} bs={a.given_on_bs} />
                      </Td>
                      <Td numeric>
                        <Money value={a.amount} />
                      </Td>
                      <Td numeric>
                        <Money value={a.recover_per_month} />
                      </Td>
                      <Td numeric className="text-success">
                        <Money value={a.recovered_amount} />
                      </Td>
                      <Td numeric className={out > 0 ? "font-semibold text-fg" : "text-fg-muted"}>
                        <Money value={out} />
                      </Td>
                      <Td>
                        <RecoveryBar advance={a} />
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(a)}
                          aria-label={ta("edit_for", { name })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}

      <CreateAdvanceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditAdvanceDialog
        advance={editing}
        workerName={editing ? workerNameOf(editing) : ""}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
