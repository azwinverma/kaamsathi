"use client";
import * as React from "react";
import {
  BadgeCheck,
  Banknote,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Info,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateText } from "@/components/ui/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { DenseStatRow } from "@/components/ledger";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  useApprovePayroll,
  usePayrollRun,
  usePayslips,
  useRecalculatePayroll,
} from "@/lib/api/hooks/payroll";
import { listResults } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { PayrollRun, Payslip } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { SSFFilingButton } from "@/components/compliance/ssf-filings";
import { PayoutPanel } from "@/components/payouts/payout-panel";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { PayrollGate, useDownloader } from "./payroll-gate";
import { PayslipDrawer } from "./payslip-drawer";
import { StatusStepper } from "./status-stepper";
import { bsField, runFileStem, totalDeductions } from "./utils";
import { WageSheet } from "./wage-sheet";

export function PayrollRunPage({ id }: { id: string }) {
  return (
    <PayrollGate>
      <RunDetail id={id} />
    </PayrollGate>
  );
}

function RunDetail({ id }: { id: string }) {
  const t = useTranslations("payroll_page");
  const { data: run, isLoading, error, refetch } = usePayrollRun(id);

  if (isLoading) return <DetailSkeleton />;
  if (error || !run) {
    const notFound = isApiError(error) && (error.status === 404 || error.code === "not_found");
    return (
      <div>
        <PageHeader title={t("meta_run_title")} back={{ href: "/app/payroll", label: t("detail.back") }} />
        <ErrorState
          error={error}
          title={notFound ? t("detail.not_found") : undefined}
          onRetry={notFound ? undefined : () => void refetch()}
        />
      </div>
    );
  }
  return <RunView run={run} />;
}

function RunView({ run }: { run: PayrollRun }) {
  const t = useTranslations("payroll_page");
  const tAll = useTranslations();
  const f = useFormat();
  const month = f.bsMonth(run.bs_year, run.bs_month);

  const [q, setQ] = React.useState("");
  const payslips = usePayslips(run.id, q || undefined);
  const rows = listResults<Payslip>(payslips.data);

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // Read the payslip from the live list so edits/recalculations show immediately.
  const selected = rows.find((p) => p.id === openId) ?? null;

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [paidOpen, setPaidOpen] = React.useState(false);
  const recalc = useRecalculatePayroll();
  const approve = useApprovePayroll();
  const { download, pending } = useDownloader();

  const totals = run.totals;
  const stem = runFileStem(run);
  const exports = [
    { path: `/org/payroll-runs/${run.id}/wage-sheet.xlsx`, name: `wage-sheet-${stem}.xlsx`, label: t("actions.wage_sheet_xlsx"), icon: FileSpreadsheet },
    { path: `/org/payroll-runs/${run.id}/bank-transfer.csv`, name: `bank-transfer-${stem}.csv`, label: t("actions.bank_csv"), icon: Landmark },
    { path: `/org/payroll-runs/${run.id}/ssf.csv`, name: `ssf-${stem}.csv`, label: t("actions.ssf_csv"), icon: ShieldCheck },
  ];

  const doRecalc = () =>
    recalc.mutate(
      { id: run.id },
      { onSuccess: () => toast.success(t("actions.recalculated")), onError: (e) => toastError(e, tAll) },
    );
  const doApprove = () =>
    approve.mutate(
      { id: run.id },
      {
        onSuccess: () => {
          toast.success(t("actions.approved"));
          setApproveOpen(false);
        },
        onError: (e) => toastError(e, tAll),
      },
    );

  const actions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" loading={!!pending}>
            {pending ? null : <Download aria-hidden />}
            {t("actions.downloads")}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {exports.map((x) => (
            <DropdownMenuItem key={x.path} disabled={!!pending} onSelect={() => void download(x.path, x.name)}>
              <x.icon aria-hidden />
              {x.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {run.status === "draft" ? (
        <>
          <Button variant="secondary" onClick={doRecalc} loading={recalc.isPending}>
            {recalc.isPending ? null : <RefreshCw aria-hidden />}
            {t("actions.recalculate")}
          </Button>
          <Button onClick={() => setApproveOpen(true)} disabled={recalc.isPending}>
            <BadgeCheck aria-hidden />
            {t("actions.approve")}
          </Button>
        </>
      ) : null}
      <SSFFilingButton run={run} />
      {run.status === "approved" ? (
        <Button onClick={() => setPaidOpen(true)}>
          <Wallet aria-hidden />
          {t("actions.mark_paid")}
        </Button>
      ) : null}
    </>
  );

  const note =
    run.status === "draft"
      ? t("detail.draft_note")
      : run.status === "approved"
        ? t("detail.approved_note")
        : t("detail.paid_note", { date: run.paid_at ? f.dateTime(run.paid_at) : "—" });

  return (
    <div>
      <PageHeader
        back={{ href: "/app/payroll", label: t("detail.back") }}
        title={t("detail.title", { month })}
        actions={actions}
        meta={
          <>
            <StatusBadge status={run.status} ns="payroll" />
            <span className="text-sm text-fg-muted">
              <DateText ad={run.period_start} bs={bsField(run, "period_start")} inline /> –{" "}
              <DateText ad={run.period_end} bs={bsField(run, "period_end")} inline />
            </span>
            {run.days_in_month ? (
              <span className="text-sm text-fg-muted">
                · {t("detail.days_in_month", { days: f.number(run.days_in_month) })}
              </span>
            ) : null}
            {run.include_festival_allowance ? <Badge tone="accent">{t("detail.festival_included")}</Badge> : null}
          </>
        }
      />

      <Card className="mb-6 p-5">
        <StatusStepper run={run} />
        <p className="mt-5 flex items-start gap-2 rounded-dense bg-surface-muted px-3 py-2.5 text-sm text-fg-body">
          <Info className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
          {note}
        </p>
      </Card>

      <DenseStatRow
        className="mb-8"
        label={t("sheet.title")}
        items={[
          {
            key: "net",
            label: t("detail.stat_net"),
            value: f.money(totals.net),
            icon: Wallet,
            tone: "success",
            hint: t("detail.stat_net_hint"),
            focal: true,
          },
          { key: "workers", label: t("detail.stat_workers"), value: f.number(totals.workers), icon: Users },
          { key: "gross", label: t("detail.stat_gross"), value: f.money(totals.gross), icon: Banknote },
          {
            key: "deductions",
            label: t("detail.stat_deductions"),
            value: f.money(totalDeductions(totals)),
            icon: Landmark,
            tone: "warning",
            hint: t("detail.stat_deductions_hint", {
              ssf: f.money(totals.ssf_employee),
              tds: f.money(totals.tds),
              advance: f.money(totals.advance_recovery),
              other: f.money(totals.other_deductions),
            }),
          },
          {
            key: "employer",
            label: t("detail.stat_employer_cost"),
            value: f.money(run.employer_cost),
            icon: ShieldCheck,
            hint: t("detail.stat_employer_cost_hint", { ssf: f.money(totals.ssf_employer) }),
          },
        ]}
      />

      <PayoutPanel run={run} />

      <section aria-labelledby="wage-sheet-title">
        <Toolbar className="sm:justify-between">
          <h2 id="wage-sheet-title" className="text-lg font-semibold text-fg">
            {t("sheet.title")}
          </h2>
          <SearchInput value={q} onChange={setQ} placeholder={t("sheet.search")} />
        </Toolbar>
        <WageSheet
          rows={rows}
          isLoading={payslips.isLoading}
          error={payslips.error}
          onRetry={() => void payslips.refetch()}
          query={q}
          selectedId={drawerOpen ? openId : null}
          onOpen={(p) => {
            setOpenId(p.id);
            setDrawerOpen(true);
          }}
        />
      </section>

      <PayslipDrawer run={run} payslip={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={t("actions.approve_title", { month })}
        description={t("actions.approve_body", { month })}
        confirmLabel={t("actions.approve_confirm")}
        onConfirm={doApprove}
        loading={approve.isPending}
      />
      <MarkPaidDialog run={run} open={paidOpen} onOpenChange={setPaidOpen} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-28 w-full rounded-dense" />
      <Skeleton className="h-24 w-full rounded-dense" />
      <Skeleton className="h-80 w-full rounded-dense" />
    </div>
  );
}
