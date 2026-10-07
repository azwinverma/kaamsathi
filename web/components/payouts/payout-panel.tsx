"use client";
import * as React from "react";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Landmark,
  Lock,
  Send,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDownloader } from "@/components/payroll/payroll-gate";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Money } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  useCancelPayoutBatch,
  useCreatePayoutBatch,
  useMarkPayoutItem,
  usePayoutBatch,
  useReconcilePayoutBatch,
  useRunPayoutOptions,
  useRunPayouts,
  useSubmitPayoutBatch,
} from "@/lib/api/hooks/payouts";
import type { PayrollRunListItem } from "@/lib/api/types";
import type {
  PayoutBatch,
  PayoutBatchStatus,
  PayoutItem,
  PayoutItemStatus,
  PayoutProviderOption,
} from "@/lib/api/types-payouts";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

const BATCH_TONE: Record<PayoutBatchStatus, BadgeTone> = {
  draft: "neutral",
  submitted: "brand",
  processing: "warning",
  completed: "success",
  partially_failed: "danger",
  cancelled: "neutral",
};
const ITEM_TONE: Record<PayoutItemStatus, BadgeTone> = {
  pending: "neutral",
  sent: "brand",
  paid: "success",
  failed: "danger",
};

/** "Pay out" panel on the payroll run page: batches per provider, bank file, marking and reconcile. */
export function PayoutPanel({
  run,
}: {
  run: Pick<PayrollRunListItem, "id" | "bs_year" | "bs_month" | "status">;
}) {
  const t = useTranslations("payouts");
  const approved = run.status === "approved";
  const batches = useRunPayouts(run.id);
  const options = useRunPayoutOptions(run.id, approved);
  const list = batches.data?.results ?? [];

  if (run.status === "draft") {
    return (
      <Card className="mb-8">
        <CardHeader title={t("title")} />
        <CardBody>
          <p className="bg-surface-muted text-fg-muted flex items-start gap-2 rounded-md px-3 py-2.5 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("approve_first")}
          </p>
        </CardBody>
      </Card>
    );
  }
  if (run.status === "paid" && !batches.isLoading && list.length === 0) return null;

  return (
    <Card className="mb-8">
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody className="space-y-5">
        {approved ? (
          <ProviderOptions
            runId={run.id}
            options={options.data?.providers}
            loading={options.isLoading}
            error={options.error}
            onRetry={() => void options.refetch()}
          />
        ) : null}
        {batches.isLoading ? (
          <Skeleton className="h-20" />
        ) : batches.error ? (
          <ErrorState
            error={batches.error}
            onRetry={() => void batches.refetch()}
            className="py-6"
          />
        ) : list.length ? (
          <div className="space-y-3">
            <h3 className="text-fg text-sm font-semibold">{t("batches")}</h3>
            {list.map((b) => (
              <BatchCard
                key={b.id}
                batch={b}
                defaultOpen={list.length === 1 || b.status !== "completed"}
              />
            ))}
          </div>
        ) : null}
        <p className="text-fg-muted text-xs">{t("never_hold_funds")}</p>
      </CardBody>
    </Card>
  );
}

function ProviderOptions({
  runId,
  options,
  loading,
  error,
  onRetry,
}: {
  runId: string;
  options?: PayoutProviderOption[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("payouts");
  const tAll = useTranslations();
  const create = useCreatePayoutBatch(runId);
  if (loading) return <Skeleton className="h-24" />;
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-6" />;
  if (!options) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const ex = o.excluded;
        return (
          <li key={o.provider} className="border-border flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg flex items-center gap-2 text-sm font-semibold">
                {o.provider === "bank_file" || o.provider === "connectips" ? (
                  <Landmark className="text-fg-muted size-4" aria-hidden />
                ) : (
                  <Wallet className="text-fg-muted size-4" aria-hidden />
                )}
                {t(`provider.${o.provider}`)}
              </span>
              {o.enabled ? null : <Badge tone="neutral">{t("not_enabled")}</Badge>}
            </div>
            <p className="text-fg-body text-sm">
              {t("eligible", { count: o.eligible })} · <Money value={o.amount} />
            </p>
            {o.provider === "bank_file" && (ex.cash || ex.missing_details || ex.already_batched) ? (
              <p className="text-fg-muted text-xs">
                {[
                  ex.cash ? t("excluded_cash", { count: ex.cash }) : null,
                  ex.missing_details ? t("excluded_missing", { count: ex.missing_details }) : null,
                  ex.already_batched ? t("excluded_batched", { count: ex.already_batched }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <Button
              size="sm"
              variant={o.provider === "bank_file" ? "primary" : "secondary"}
              className="mt-auto self-start"
              disabled={!o.enabled || o.eligible === 0}
              loading={create.isPending && create.variables === o.provider}
              onClick={() =>
                create.mutate(o.provider, {
                  onSuccess: (b) => toast.success(t("created_toast", { count: b.totals.items })),
                  onError: (e) => toastError(e, tAll),
                })
              }
            >
              {t("create_batch")}
            </Button>
            {!o.enabled && o.eligible > 0 ? (
              <p className="text-fg-muted text-xs">{t("use_bank_file")}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function BatchCard({ batch, defaultOpen }: { batch: PayoutBatch; defaultOpen: boolean }) {
  const t = useTranslations("payouts");
  const tAll = useTranslations();
  const f = useFormat();
  const [open, setOpen] = React.useState(defaultOpen);
  const detail = usePayoutBatch(open ? batch.id : undefined);
  const b = detail.data ?? batch;
  const submit = useSubmitPayoutBatch();
  const cancel = useCancelPayoutBatch();
  const { download, pending } = useDownloader();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reconcileOpen, setReconcileOpen] = React.useState(false);
  const stem = `bank-transfer-${b.run.bs_year}-${String(b.run.bs_month).padStart(2, "0")}`;
  const live = b.status !== "draft" && b.status !== "cancelled" && b.status !== "completed";

  return (
    <div className="border-border rounded-md border">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronUp className="text-fg-muted size-4" aria-hidden />
          ) : (
            <ChevronDown className="text-fg-muted size-4" aria-hidden />
          )}
          <span className="text-fg text-sm font-semibold">{t(`provider.${b.provider}`)}</span>
          <Badge tone={BATCH_TONE[b.status]} dot>
            {t(`status.${b.status}`)}
          </Badge>
          <span className="text-fg-muted text-xs">
            {t("paid_of", { paid: f.digits(b.totals.paid_count), total: f.digits(b.totals.items) })}{" "}
            · <Money value={b.totals.amount} />
          </span>
        </button>
        <div className="flex flex-wrap gap-2">
          {b.provider === "bank_file" && b.status !== "cancelled" ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                loading={pending === `/org/payouts/${b.id}/file.csv`}
                onClick={() => void download(`/org/payouts/${b.id}/file.csv`, `${stem}.csv`)}
              >
                <FileSpreadsheet aria-hidden />
                CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={pending === `/org/payouts/${b.id}/file.xlsx`}
                onClick={() => void download(`/org/payouts/${b.id}/file.xlsx`, `${stem}.xlsx`)}
              >
                XLSX
              </Button>
            </>
          ) : null}
          {b.status === "draft" ? (
            <Button
              size="sm"
              onClick={() =>
                submit.mutate(b.id, {
                  onSuccess: () => toast.success(t("submitted_toast")),
                  onError: (e) => toastError(e, tAll),
                })
              }
              loading={submit.isPending}
            >
              <Send aria-hidden />
              {b.provider === "bank_file" ? t("submit_bank") : t("submit")}
            </Button>
          ) : null}
          {b.provider === "bank_file" && live ? (
            <Button size="sm" variant="secondary" onClick={() => setReconcileOpen(true)}>
              <Upload aria-hidden />
              {t("reconcile")}
            </Button>
          ) : null}
          {(b.status === "draft" || b.status === "submitted") && b.totals.paid_count === 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>
              <Ban aria-hidden />
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="border-border border-t p-3">
          {b.status === "draft" && b.provider === "bank_file" ? (
            <p className="text-fg-muted mb-3 text-xs">{t("bank_steps")}</p>
          ) : null}
          {detail.isLoading ? (
            <Skeleton className="h-24" />
          ) : detail.error ? (
            <ErrorState
              error={detail.error}
              onRetry={() => void detail.refetch()}
              className="py-6"
            />
          ) : (
            <ItemsTable batch={b} />
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("cancel_title")}
        description={t("cancel_body")}
        confirmLabel={t("cancel")}
        danger
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(b.id, {
            onSuccess: () => setCancelOpen(false),
            onError: (e) => toastError(e, tAll),
          })
        }
      />
      <ReconcileDialog batchId={b.id} open={reconcileOpen} onOpenChange={setReconcileOpen} />
    </div>
  );
}

function ItemsTable({ batch }: { batch: PayoutBatch }) {
  const t = useTranslations("payouts");
  const items = batch.items ?? [];
  const canMark = batch.status !== "draft" && batch.status !== "cancelled";
  const [failing, setFailing] = React.useState<PayoutItem | null>(null);
  if (!items.length) return <p className="text-fg-muted text-sm">{t("no_items")}</p>;
  return (
    <TableContainer>
      <Table>
        <THead>
          <tr>
            <Th>{t("col_worker")}</Th>
            <Th>{t("col_destination")}</Th>
            <Th numeric>{t("col_amount")}</Th>
            <Th>{t("col_status")}</Th>
            {canMark ? <Th className="text-right">{t("col_mark")}</Th> : null}
          </tr>
        </THead>
        <TBody>
          {items.map((i) => (
            <ItemRow
              key={i.id}
              batch={batch}
              item={i}
              canMark={canMark}
              onFail={() => setFailing(i)}
            />
          ))}
        </TBody>
      </Table>
      <FailDialog batchId={batch.id} item={failing} onOpenChange={(o) => !o && setFailing(null)} />
    </TableContainer>
  );
}

function ItemRow({
  batch,
  item,
  canMark,
  onFail,
}: {
  batch: PayoutBatch;
  item: PayoutItem;
  canMark: boolean;
  onFail: () => void;
}) {
  const t = useTranslations("payouts");
  const tAll = useTranslations();
  const mark = useMarkPayoutItem();
  return (
    <Tr>
      <RowHeader>{item.worker.full_name}</RowHeader>
      <Td className="text-fg-muted text-xs">
        {item.method === "bank"
          ? [item.bank_name, item.account_no_masked].filter(Boolean).join(" · ")
          : [tAll(`pay.${item.method}`), item.wallet_id].filter(Boolean).join(" · ")}
      </Td>
      <Td numeric>
        <Money value={item.amount} />
      </Td>
      <Td>
        <Badge tone={ITEM_TONE[item.status]} dot>
          {t(`item_status.${item.status}`)}
        </Badge>
        {item.failure_reason ? (
          <p className="text-danger mt-0.5 text-xs">{item.failure_reason}</p>
        ) : null}
        {item.provider_ref && item.status === "paid" ? (
          <p className="text-fg-muted tabular mt-0.5 text-xs">{item.provider_ref}</p>
        ) : null}
      </Td>
      {canMark ? (
        <Td>
          {item.status !== "paid" ? (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="secondary"
                loading={mark.isPending}
                onClick={() =>
                  mark.mutate(
                    { batchId: batch.id, itemId: item.id, status: "paid" },
                    { onError: (e) => toastError(e, tAll) },
                  )
                }
              >
                <CheckCircle2 aria-hidden />
                {t("mark_paid")}
              </Button>
              {item.status !== "failed" ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={onFail}
                  aria-label={t("mark_failed")}
                >
                  <XCircle aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}
        </Td>
      ) : null}
    </Tr>
  );
}

function FailDialog({
  batchId,
  item,
  onOpenChange,
}: {
  batchId: string;
  item: PayoutItem | null;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("payouts");
  const tAll = useTranslations();
  const mark = useMarkPayoutItem();
  const [reason, setReason] = React.useState("");
  React.useEffect(() => setReason(""), [item]);
  if (!item) return null;
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent size="sm" closeLabel={tAll("common.close")}>
        <DialogHeader title={t("fail_title", { name: item.worker.full_name })} />
        <DialogBody>
          <Field id="payout-fail-reason" label={t("fail_reason")}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tAll("common.cancel")}
          </Button>
          <Button
            variant="danger"
            loading={mark.isPending}
            onClick={() =>
              mark.mutate(
                { batchId, itemId: item.id, status: "failed", failure_reason: reason || null },
                { onSuccess: () => onOpenChange(false), onError: (e) => toastError(e, tAll) },
              )
            }
          >
            {t("mark_failed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({
  batchId,
  open,
  onOpenChange,
}: {
  batchId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("payouts");
  const tAll = useTranslations();
  const reconcile = useReconcilePayoutBatch();
  const [file, setFile] = React.useState<File | null>(null);
  React.useEffect(() => {
    if (open) setFile(null);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tAll("common.close")}>
        <DialogHeader title={t("reconcile_title")} description={t("reconcile_body")} />
        <DialogBody className="space-y-3">
          <Field id="payout-reconcile-file" label={t("result_file")} hint={t("result_hint")}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-fg file:border-border file:bg-surface block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tAll("common.cancel")}
          </Button>
          <Button
            disabled={!file}
            loading={reconcile.isPending}
            onClick={() =>
              file &&
              reconcile.mutate(
                { id: batchId, file },
                {
                  onSuccess: (b) => {
                    const r = b.reconcile;
                    toast.success(
                      t("reconciled_toast", {
                        paid: r?.paid ?? 0,
                        failed: r?.failed ?? 0,
                        unmatched: r?.unmatched.length ?? 0,
                      }),
                    );
                    onOpenChange(false);
                  },
                  onError: (e) => toastError(e, tAll),
                },
              )
            }
          >
            <Upload aria-hidden />
            {t("reconcile")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
