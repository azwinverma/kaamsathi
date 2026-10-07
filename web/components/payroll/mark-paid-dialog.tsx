"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BsDatePicker, Money } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useMarkPayrollPaid } from "@/lib/api/hooks/payroll";
import type { PaymentMethod, PayrollRun } from "@/lib/api/types";
import { todayIso } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

export const PAYMENT_METHODS: PaymentMethod[] = ["bank", "esewa", "khalti", "cash"];

export function MarkPaidDialog({
  run,
  open,
  onOpenChange,
}: {
  run: PayrollRun;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("payroll_page.mark_paid");
  const tAll = useTranslations();
  const f = useFormat();
  const mark = useMarkPayrollPaid();
  const today = todayIso();
  const [paidOn, setPaidOn] = React.useState(today);
  const [method, setMethod] = React.useState<PaymentMethod | "">("");

  React.useEffect(() => {
    if (open) {
      setPaidOn(todayIso());
      setMethod("");
      mark.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mark.mutate(
      { id: run.id, body: { paid_on: paidOn, ...(method ? { method } : {}) } },
      {
        onSuccess: () => {
          toast.success(t("success"));
          onOpenChange(false);
        },
        onError: (err) => toastError(err, tAll),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader
            title={t("title", { month: f.bsMonth(run.bs_year, run.bs_month) })}
            description={t("description")}
          />
          <DialogBody className="space-y-5">
            <div className="flex items-center justify-between rounded-md bg-surface-muted px-4 py-3">
              <span className="text-sm text-fg-muted">{t("total")}</span>
              <Money value={run.totals.net} className="text-lg font-semibold text-fg" />
            </div>
            <Field id="paid-on" label={t("paid_on")}>
              <BsDatePicker value={paidOn} onChange={setPaidOn} max={today} min={run.period_start} />
            </Field>
            <Field id="paid-method" label={t("method")} hint={t("method_hint")}>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod | "")}
                allowEmpty
                emptyLabel={t("method_keep")}
                placeholder={t("method_keep")}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: tAll(`pay.${m}`) }))}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mark.isPending}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={mark.isPending} disabled={!paidOn}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
