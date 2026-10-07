"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateText, Money } from "@/components/ui/date";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { usePayrollRuns } from "@/lib/api/hooks/payroll";
import { listResults } from "@/lib/api/client";
import type { PayrollRunListItem } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { CreateRunDialog } from "./create-run-dialog";
import { HowPayrollWorks } from "./how-it-works";
import { PayrollGate } from "./payroll-gate";
import { bsField } from "./utils";

/** List responses may carry totals or flat summary fields; read both. */
function runSummary(run: PayrollRunListItem): { net?: string; workers?: number } {
  const loose = run as PayrollRunListItem & { net_total?: string; workers?: number; workers_count?: number };
  return {
    net: run.totals?.net ?? loose.net_total,
    workers: run.totals?.workers ?? loose.workers ?? loose.workers_count,
  };
}

export function PayrollRunsPage() {
  return (
    <PayrollGate>
      <RunsList />
    </PayrollGate>
  );
}

function RunsList() {
  const t = useTranslations("payroll_page.list");
  const f = useFormat();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, error, refetch } = usePayrollRuns();
  const runs = React.useMemo(
    () =>
      [...listResults(data)].sort((a, b) => b.bs_year - a.bs_year || b.bs_month - a.bs_month),
    [data],
  );

  const newRun = (
    <Button onClick={() => setOpen(true)} disabled={isLoading}>
      <Plus aria-hidden />
      {t("new_run")}
    </Button>
  );

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} actions={newRun} />

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : runs.length === 0 ? (
        <EmptyState icon={Banknote} title={t("empty_title")} description={t("empty_body")} action={newRun} />
      ) : (
        <TableContainer>
          <Table className="min-w-[640px]">
            <THead>
              <tr>
                <Th>{t("col_month")}</Th>
                <Th>{t("col_period")}</Th>
                <Th>{t("col_status")}</Th>
                <Th numeric>{t("col_workers")}</Th>
                <Th numeric>{t("col_net")}</Th>
              </tr>
            </THead>
            <TBody>
              {runs.map((run) => {
                const s = runSummary(run);
                const month = f.bsMonth(run.bs_year, run.bs_month);
                const href = `/app/payroll/${run.id}`;
                return (
                  <Tr key={run.id} interactive onClick={() => router.push(href)}>
                    <RowHeader>
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(href);
                        }}
                        className="font-medium text-fg hover:text-brand hover:underline"
                        aria-label={t("open_run", { month })}
                      >
                        {month}
                      </a>
                      {run.include_festival_allowance ? (
                        <Badge tone="accent" className="ml-2">
                          {t("festival_badge")}
                        </Badge>
                      ) : null}
                    </RowHeader>
                    <Td className="text-xs whitespace-nowrap text-fg-muted">
                      <DateText ad={run.period_start} bs={bsField(run, "period_start")} inline /> –{" "}
                      <DateText ad={run.period_end} bs={bsField(run, "period_end")} inline />
                    </Td>
                    <Td>
                      <StatusBadge status={run.status} ns="payroll" />
                    </Td>
                    <Td numeric>{s.workers !== undefined ? f.number(s.workers) : "—"}</Td>
                    <Td numeric className="font-medium text-fg">
                      <Money value={s.net} />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}

      <HowPayrollWorks className="mt-6" />
      <CreateRunDialog open={open} onOpenChange={setOpen} existingRuns={runs} />
    </div>
  );
}
