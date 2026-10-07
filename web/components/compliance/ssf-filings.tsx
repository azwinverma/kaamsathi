"use client";
import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDownloader } from "@/components/payroll/payroll-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BsDatePicker, DateText, Money } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listResults } from "@/lib/api/client";
import { usePrepareSSFFiling, useSSFFilings, useUpdateSSFFiling } from "@/lib/api/hooks/compliance";
import { usePayrollRuns } from "@/lib/api/hooks/payroll";
import type { PayrollRunListItem } from "@/lib/api/types";
import type { SSFFiling, SSFFilingStatus } from "@/lib/api/types-compliance";
import { todayIso } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { filingRows, filingStem } from "./utils";

const FILING_TONE: Record<SSFFilingStatus, "warning" | "brand" | "success"> = {
  prepared: "warning",
  submitted: "brand",
  acknowledged: "success",
};

export function FilingStatusBadge({ filing }: { filing: SSFFiling }) {
  const t = useTranslations("compliance.ssf");
  if (filing.is_overdue) {
    return (
      <Badge tone="danger" dot>
        {t("overdue")}
      </Badge>
    );
  }
  return (
    <Badge tone={FILING_TONE[filing.status]} dot>
      {t(`status_${filing.status}`)}
    </Badge>
  );
}

/** SSF filings table on /app/compliance: one row per approved/paid payroll run. */
export function SSFFilingsCard() {
  const t = useTranslations("compliance.ssf");
  const tAll = useTranslations();
  const f = useFormat();
  const runs = usePayrollRuns();
  const filings = useSSFFilings();
  const prepare = usePrepareSSFFiling();
  const { download, pending } = useDownloader();
  const [submitting, setSubmitting] = React.useState<SSFFiling | null>(null);

  const rows = filingRows(
    listResults<PayrollRunListItem>(runs.data),
    listResults<SSFFiling>(filings.data),
  );
  const loading = runs.isLoading || filings.isLoading;
  const error = runs.error ?? filings.error;

  const doPrepare = (runId: string) =>
    prepare.mutate(runId, {
      onSuccess: () => toast.success(t("prepared_toast")),
      onError: (e) => toastError(e, tAll),
    });

  return (
    <Card id="ssf" className="scroll-mt-20">
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody>
        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              void runs.refetch();
              void filings.refetch();
            }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("empty_title")}
            description={t("empty_body")}
            action={
              <Button variant="secondary" asChild>
                <Link href="/app/payroll">{t("go_payroll")}</Link>
              </Button>
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("col_month")}</Th>
                  <Th>{t("col_due")}</Th>
                  <Th>{t("col_status")}</Th>
                  <Th numeric>{t("col_workers")}</Th>
                  <Th numeric>{t("col_total")}</Th>
                  <Th className="text-right">{tAll("common.actions")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map(({ run, filing }) => (
                  <Tr key={run.id}>
                    <RowHeader>
                      <Link href={`/app/payroll/${run.id}`} className="hover:underline">
                        {f.bsMonth(run.bs_year, run.bs_month)}
                      </Link>
                    </RowHeader>
                    <Td>
                      {filing ? <DateText ad={filing.due_date} bs={filing.due_date_bs} /> : "—"}
                    </Td>
                    <Td>
                      {filing ? (
                        <div className="space-y-1">
                          <FilingStatusBadge filing={filing} />
                          {filing.receipt_no ? (
                            <p className="text-fg-muted text-xs">
                              {t("receipt", { no: filing.receipt_no })}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <Badge tone="neutral">{t("not_prepared")}</Badge>
                      )}
                    </Td>
                    <Td numeric>
                      {filing ? (
                        <span>
                          {f.number(filing.summary.rows)}
                          {filing.summary.missing ? (
                            <span className="text-warning block text-xs">
                              {t("missing_ids", { count: filing.summary.missing })}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td numeric>{filing ? <Money value={filing.summary.total_31} /> : "—"}</Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!filing || filing.status === "prepared" ? (
                          <Button
                            size="sm"
                            variant={filing ? "ghost" : "secondary"}
                            onClick={() => doPrepare(run.id)}
                            loading={prepare.isPending && prepare.variables === run.id}
                          >
                            <FileText aria-hidden />
                            {filing ? t("regenerate") : t("prepare")}
                          </Button>
                        ) : null}
                        {filing ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={pending === `/org/ssf-filings/${filing.id}/file.xlsx`}
                              onClick={() =>
                                void download(
                                  `/org/ssf-filings/${filing.id}/file.xlsx`,
                                  `${filingStem(run)}.xlsx`,
                                )
                              }
                            >
                              <FileSpreadsheet aria-hidden />
                              {t("xlsx")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={pending === `/org/ssf-filings/${filing.id}/file.csv`}
                              onClick={() =>
                                void download(
                                  `/org/ssf-filings/${filing.id}/file.csv`,
                                  `${filingStem(run)}.csv`,
                                )
                              }
                            >
                              <Download aria-hidden />
                              {t("csv")}
                            </Button>
                            {filing.status !== "acknowledged" ? (
                              <Button size="sm" onClick={() => setSubmitting(filing)}>
                                <Upload aria-hidden />
                                {filing.status === "prepared"
                                  ? t("mark_submitted")
                                  : t("record_receipt")}
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <p className="text-fg-muted mt-3 text-xs">{t("how")}</p>
      </CardBody>
      <SubmitFilingDialog filing={submitting} onOpenChange={(o) => !o && setSubmitting(null)} />
    </Card>
  );
}

function SubmitFilingDialog({
  filing,
  onOpenChange,
}: {
  filing: SSFFiling | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("compliance.ssf");
  const tAll = useTranslations();
  const f = useFormat();
  const update = useUpdateSSFFiling();
  const [submittedOn, setSubmittedOn] = React.useState(todayIso());
  const [receipt, setReceipt] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (filing) {
      setSubmittedOn(filing.submitted_on ?? todayIso());
      setReceipt(filing.receipt_no ?? "");
      setError(undefined);
    }
  }, [filing]);

  if (!filing) return null;
  const month = f.bsMonth(filing.run.bs_year, filing.run.bs_month);

  const save = () => {
    const status: SSFFilingStatus = receipt.trim() ? "acknowledged" : "submitted";
    update.mutate(
      { id: filing.id, status, submitted_on: submittedOn, receipt_no: receipt.trim() || null },
      {
        onSuccess: () => {
          toast.success(t("saved_toast"));
          onOpenChange(false);
        },
        onError: (e) => {
          setError(undefined);
          toastError(e, tAll);
        },
      },
    );
  };

  return (
    <Dialog open={!!filing} onOpenChange={onOpenChange}>
      <DialogContent size="sm" closeLabel={tAll("common.close")}>
        <DialogHeader title={t("submit_title", { month })} description={t("submit_body")} />
        <DialogBody className="space-y-4">
          <Field id="ssf-submitted-on" label={t("submitted_on")}>
            <BsDatePicker value={submittedOn} onChange={setSubmittedOn} max={todayIso()} />
          </Field>
          <Field
            id="ssf-receipt"
            label={t("receipt_no")}
            optional
            optionalLabel={tAll("common.optional")}
            hint={t("receipt_hint")}
            error={error}
          >
            <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} maxLength={60} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tAll("common.cancel")}
          </Button>
          <Button onClick={save} loading={update.isPending}>
            <CheckCircle2 aria-hidden />
            {tAll("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "SSF filing" button for the payroll run page: prepares (or re-prepares) and downloads the file. */
export function SSFFilingButton({
  run,
}: {
  run: Pick<PayrollRunListItem, "id" | "bs_year" | "bs_month" | "status">;
}) {
  const t = useTranslations("compliance.ssf");
  const tAll = useTranslations();
  const prepare = usePrepareSSFFiling();
  const { download, pending } = useDownloader();
  if (run.status !== "approved" && run.status !== "paid") return null;
  const go = () =>
    prepare.mutate(run.id, {
      onSuccess: (filing) => {
        toast.success(t("prepared_toast"), {
          action: {
            label: t("open_compliance"),
            onClick: () => window.location.assign("/app/compliance#ssf"),
          },
        });
        void download(`/org/ssf-filings/${filing.id}/file.xlsx`, `${filingStem(run)}.xlsx`);
      },
      onError: (e) => toastError(e, tAll),
    });
  return (
    <Button variant="secondary" size="sm" onClick={go} loading={prepare.isPending || !!pending}>
      <ShieldCheck aria-hidden />
      {t("filing_button")}
    </Button>
  );
}
