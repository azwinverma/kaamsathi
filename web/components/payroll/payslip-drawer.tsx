"use client";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/date";
import { DialogDescription, DialogTitle, Sheet, SheetContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { PrefixInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { useUpdatePayslip } from "@/lib/api/hooks/payroll";
import type { PaymentMethod, PayrollRun, Payslip } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "./mark-paid-dialog";
import { useDownloader } from "./payroll-gate";
import { num, round2, runFileStem } from "./utils";

export function PayslipDrawer({
  run,
  payslip,
  open,
  onOpenChange,
}: {
  run: PayrollRun;
  payslip: Payslip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("payroll_page.payslip");
  const tAll = useTranslations();
  const f = useFormat();
  const { download, pending } = useDownloader();
  const month = f.bsMonth(run.bs_year, run.bs_month);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tAll("common.close")} className="max-w-lg">
        {payslip ? (
          <>
            <div className="border-border space-y-2 border-b px-6 pt-5 pr-14 pb-4">
              <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                {t("title")}
              </p>
              <DialogTitle className="text-fg text-lg font-semibold">
                {payslip.worker.full_name}
              </DialogTitle>
              <DialogDescription className="text-fg-muted text-sm">
                {t("subtitle", { month, designation: payslip.designation || "—" })}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="outline">{tAll(`term.${payslip.wage_type}`)}</Badge>
                <StatusBadge status={payslip.payment_status} />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <Section title={t("days")}>
                <dl className="grid grid-cols-3 gap-2">
                  <DayStat label={t("days_present")} value={f.number(payslip.present_days)} />
                  <DayStat label={t("days_leave")} value={f.number(payslip.paid_leave_days)} />
                  <DayStat label={t("days_holiday")} value={f.number(payslip.holiday_days)} />
                  <DayStat label={t("days_weekly_off")} value={f.number(payslip.weekly_off_days)} />
                  <DayStat
                    label={t("days_absent")}
                    value={f.number(payslip.absent_days)}
                    tone={num(payslip.absent_days) > 0 ? "danger" : undefined}
                  />
                  {payslip.wage_type === "hourly" ? (
                    <DayStat
                      label={tAll("wage_hourly.regular_hours")}
                      value={f.number(payslip.regular_hours ?? 0)}
                    />
                  ) : null}
                  <DayStat label={t("ot_hours")} value={f.number(payslip.overtime_hours)} />
                </dl>
                <p className="bg-brand-subtle mt-3 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                  <span className="text-brand-subtle-fg">{t("days_payable")}</span>
                  <span className="text-fg tabular font-semibold">
                    {t("payable_of", {
                      payable: f.number(payslip.payable_days),
                      total: f.number(payslip.days_in_month),
                    })}
                  </span>
                </p>
              </Section>

              <Section title={t("earnings")}>
                <Lines
                  rows={[
                    [t("basic"), payslip.basic_earned],
                    [t("da"), payslip.da_earned],
                    [t("allowance"), payslip.allowance_earned],
                    [t("ot_pay"), payslip.overtime_pay],
                    [t("festival"), payslip.festival_allowance],
                  ]}
                  total={[t("gross"), payslip.gross_pay]}
                />
              </Section>

              <Section title={t("deductions")}>
                <Lines
                  negative
                  rows={[
                    [t("ssf_employee"), payslip.ssf_employee],
                    [t("tds"), payslip.tds],
                    [t("advance"), payslip.advance_recovery],
                    [t("other"), payslip.other_deductions],
                  ]}
                  total={[
                    t("total_deductions"),
                    round2(
                      num(payslip.ssf_employee) +
                        num(payslip.tds) +
                        num(payslip.advance_recovery) +
                        num(payslip.other_deductions),
                    ),
                  ]}
                />
              </Section>

              <div className="border-success/30 bg-success-subtle flex items-center justify-between rounded-dense border px-4 py-3">
                <span className="text-success text-sm font-semibold">{t("net")}</span>
                <Money value={payslip.net_pay} className="text-fg text-xl font-semibold" />
              </div>

              <Section title={t("employer")}>
                <Lines rows={[[t("ssf_employer"), payslip.ssf_employer]]} />
                <p className="text-fg-muted mt-1 text-xs">{t("ssf_employer_hint")}</p>
              </Section>

              <Section title={t("payment")}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Item label={t("payment_method")} value={tAll(`pay.${payslip.payment_method}`)} />
                  <Item
                    label={t("payment_status")}
                    value={<StatusBadge status={payslip.payment_status} />}
                  />
                  {payslip.paid_at ? (
                    <Item label={t("paid_at")} value={f.dateTime(payslip.paid_at)} />
                  ) : null}
                  {payslip.payment_ref ? (
                    <Item label={t("payment_ref")} value={payslip.payment_ref} />
                  ) : null}
                  {payslip.note ? <Item label={t("note")} value={payslip.note} full /> : null}
                </dl>
              </Section>

              {run.status === "draft" ? (
                <EditPayslipForm
                  key={payslip.id + payslip.net_pay}
                  runId={run.id}
                  payslip={payslip}
                />
              ) : (
                <p className="bg-surface-muted text-fg-muted flex items-start gap-2 rounded-md px-3 py-2.5 text-xs">
                  <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t("locked", { status: tAll(`payroll.${run.status}`) })}
                </p>
              )}
            </div>

            <div className="border-border bg-surface-muted/60 flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="secondary"
                loading={pending === pdfPath(payslip.id)}
                onClick={() =>
                  download(
                    pdfPath(payslip.id),
                    `payslip-${runFileStem(run)}-${slug(payslip.worker.full_name)}.pdf`,
                  )
                }
              >
                <Download aria-hidden />
                {t("download_pdf")}
              </Button>
            </div>
          </>
        ) : (
          <div className="p-6">
            <DialogTitle className="sr-only">{t("title")}</DialogTitle>
            <EmptyState title={t("not_found")} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const pdfPath = (id: string) => `/org/payslips/${id}/payslip.pdf`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "worker";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-fg-muted mb-2 text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}

function DayStat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="border-border rounded-md border px-3 py-2">
      <dt className="text-fg-muted truncate text-xs">{label}</dt>
      <dd
        className={cn(
          "text-fg tabular text-base font-semibold",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Lines({
  rows,
  total,
  negative,
}: {
  rows: [string, string | number][];
  total?: [string, string | number];
  negative?: boolean;
}) {
  const f = useFormat();
  return (
    <dl className="divide-border border-border divide-y rounded-md border text-sm">
      {rows.map(([label, v]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="text-fg-body">{label}</dt>
          <dd className={cn("tabular", num(v) === 0 && "text-fg-muted")}>
            {negative && num(v) !== 0 ? "− " : ""}
            {f.money(v)}
          </dd>
        </div>
      ))}
      {total ? (
        <div className="bg-surface-muted text-fg flex items-center justify-between gap-4 px-3 py-2 font-semibold">
          <dt>{total[0]}</dt>
          <dd className="tabular">
            {negative && num(total[1]) !== 0 ? "− " : ""}
            {f.money(total[1])}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function Item({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("min-w-0", full && "col-span-2")}>
      <dt className="text-fg-muted text-xs">{label}</dt>
      <dd className="text-fg mt-0.5 break-words">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- edit (draft only)

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const clean = (v: string) => toLatinDigits(v).replace(/[,\s]/g, "");

function EditPayslipForm({ runId, payslip }: { runId: string; payslip: Payslip }) {
  const t = useTranslations("payroll_page.payslip");
  const tAll = useTranslations();
  const f = useFormat();
  const update = useUpdatePayslip(runId);
  // Net without the current "other" deduction = the most that can be deducted.
  const netBeforeOther = round2(num(payslip.net_pay) + num(payslip.other_deductions));

  const schema = React.useMemo(
    () =>
      z.object({
        other_deductions: z
          .string()
          .refine((v) => clean(v) === "" || AMOUNT_RE.test(clean(v)), {
            message: t("invalid_amount"),
          })
          .refine((v) => num(clean(v)) <= netBeforeOther, { message: t("too_large") }),
        note: z.string().max(500),
        payment_method: z.enum(["bank", "esewa", "khalti", "cash"]),
      }),
    [t, netBeforeOther],
  );
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      other_deductions: num(payslip.other_deductions) ? String(num(payslip.other_deductions)) : "",
      note: payslip.note ?? "",
      payment_method: payslip.payment_method,
    },
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isDirty },
  } = form;

  const other = clean(watch("other_deductions") ?? "");
  const preview =
    AMOUNT_RE.test(other) || other === "" ? round2(netBeforeOther - num(other)) : null;

  const onSubmit = handleSubmit((v) => {
    update.mutate(
      {
        id: payslip.id,
        other_deductions: num(clean(v.other_deductions)).toFixed(2),
        note: v.note.trim(),
        payment_method: v.payment_method as PaymentMethod,
      },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (err) =>
          handleFormError(err, setError, tAll, {
            fields: ["other_deductions", "note", "payment_method"],
          }),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="border-border space-y-4 rounded-dense border p-4" noValidate>
      <div className="space-y-0.5">
        <h3 className="text-fg text-sm font-semibold">{t("edit_title")}</h3>
        <p className="text-fg-muted text-xs">{t("edit_hint")}</p>
      </div>
      <Field
        id="ps-other"
        label={t("other_label")}
        hint={t("other_hint")}
        error={errors.other_deductions?.message}
      >
        <PrefixInput
          prefix={tAll("term.npr")}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          {...register("other_deductions")}
        />
      </Field>
      {preview !== null && num(other) !== num(payslip.other_deductions) ? (
        <p className="text-fg-body tabular text-sm" aria-live="polite">
          {t("new_net", { amount: f.money(preview) })}
        </p>
      ) : null}
      <Field id="ps-method" label={t("method_label")} error={errors.payment_method?.message}>
        <Controller
          control={control}
          name="payment_method"
          render={({ field }) => (
            <Select
              id="ps-method"
              aria-invalid={errors.payment_method ? true : undefined}
              value={field.value}
              onValueChange={field.onChange}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: tAll(`pay.${m}`) }))}
            />
          )}
        />
      </Field>
      <Field
        id="ps-note"
        label={t("note_label")}
        optional
        optionalLabel={tAll("common.optional")}
        error={errors.note?.message}
      >
        <Textarea rows={2} placeholder={t("note_placeholder")} {...register("note")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
