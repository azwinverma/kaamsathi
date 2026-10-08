"use client";
import * as React from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BsDatePicker, DateText } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import {
  useEndEmployment,
  useRateEmployment,
  useUpdateEmployment,
} from "@/lib/api/hooks/workforce";
import { useMinimumWage } from "@/lib/api/hooks/ref";
import { isApiError } from "@/lib/api/errors";
import type { Employment, EndReason } from "@/lib/api/types";
import { todayIso } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { Notice, WorkforceSiteSelect } from "./shared";
import {
  moneyInput,
  refineWage,
  WageFields,
  wagePayload,
  wageShape,
  type WageFormValues,
} from "./wage-fields";

type Open = { open: boolean; onOpenChange: (o: boolean) => void; employment: Employment };

// ------------------------------------------------------------------ edit employment / wage
const EDIT_FIELDS = [
  "designation",
  "site_id",
  "employee_code",
  "wage_type",
  "basic_salary",
  "dearness_allowance",
  "other_allowance",
  "daily_wage",
  "hourly_wage",
  "part_time",
  "ssf_enrolled",
] as const;

export function EditEmploymentDialog({ open, onOpenChange, employment }: Open) {
  const t = useTranslations();
  const te = useTranslations("workforce.edit");
  const f = useFormat();
  const { data: minWage } = useMinimumWage();
  const update = useUpdateEmployment();
  const [formError, setFormError] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      z
        .object({
          designation: z.string().trim().min(1, t("errors.required")),
          site_id: z.string(),
          employee_code: z.string(),
          ...wageShape,
        })
        .superRefine((v, ctx) =>
          refineWage(v as WageFormValues, ctx, minWage, t, (n) => f.money(n)),
        ),
    [t, minWage, f],
  );
  type FormValues = z.input<typeof schema>;

  const defaults = React.useCallback(
    (): FormValues => ({
      designation: employment.designation ?? "",
      site_id: employment.site?.id ?? "",
      employee_code: employment.employee_code ?? "",
      wage_type: employment.wage_type,
      basic_salary: moneyInput(employment.basic_salary),
      dearness_allowance: moneyInput(employment.dearness_allowance),
      other_allowance: moneyInput(employment.other_allowance),
      daily_wage: moneyInput(employment.daily_wage),
      hourly_wage: moneyInput(employment.hourly_wage),
      part_time: !!employment.part_time,
      ssf_enrolled: employment.ssf_enrolled,
    }),
    [employment],
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const { register, control, handleSubmit, formState, reset, setError } = form;

  React.useEffect(() => {
    if (open) {
      reset(defaults());
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(
      {
        id: employment.id,
        designation: v.designation.trim(),
        site_id: v.site_id || null,
        employee_code: v.employee_code.trim(),
        ...wagePayload(v as WageFormValues),
      },
      {
        onSuccess: () => {
          toast.success(t("common.changes_saved"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err) && err.code === "below_minimum_wage") {
            setFormError(err.message || t("errors.below_minimum_wage"));
            return;
          }
          setFormError(handleFormError(err, setError, t, { fields: EDIT_FIELDS, toast: false }));
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={t("common.close")}>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={te("title")}
            description={te("description", { name: employment.worker.full_name })}
          />
          <DialogBody className="space-y-6">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="ee-designation"
                label={t("term.designation")}
                error={formState.errors.designation?.message}
              >
                <Input {...register("designation")} />
              </Field>
              <Field
                id="ee-site"
                label={t("term.site")}
                optional
                optionalLabel={t("common.optional")}
              >
                <Controller
                  control={control}
                  name="site_id"
                  render={({ field }) => (
                    <WorkforceSiteSelect
                      value={field.value}
                      onChange={field.onChange}
                      allowAll={false}
                    />
                  )}
                />
              </Field>
              <Field
                id="ee-code"
                label={t("term.employee_code")}
                optional
                optionalLabel={t("common.optional")}
              >
                <Input {...register("employee_code")} />
              </Field>
            </div>
            <WageFields form={form} minWage={minWage} idPrefix="ee" />
            <p className="text-fg-muted text-xs">{te("payroll_hint")}</p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {t("common.save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ end employment
const END_REASONS: EndReason[] = ["resigned", "terminated", "contract_end", "absconded", "other"];

export function EndEmploymentDialog({ open, onOpenChange, employment }: Open) {
  const t = useTranslations();
  const tn = useTranslations("workforce.end");
  const end = useEndEmployment();
  const [endDate, setEndDate] = React.useState(todayIso());
  const [reason, setReason] = React.useState<EndReason | "">("");
  const [errors, setErrors] = React.useState<{ end_date?: string; end_reason?: string }>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const today = todayIso();
  const inWindow =
    !!employment.replacement_eligible_until && employment.replacement_eligible_until >= today;

  React.useEffect(() => {
    if (open) {
      setEndDate(todayIso());
      setReason("");
      setErrors({});
      setFormError(null);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!endDate) next.end_date = t("errors.required");
    else if (endDate < employment.start_date) next.end_date = tn("before_start");
    if (!reason) next.end_reason = t("errors.required");
    setErrors(next);
    if (Object.keys(next).length) return;
    setFormError(null);
    end.mutate(
      { id: employment.id, end_date: endDate, end_reason: reason as EndReason },
      {
        onSuccess: () => {
          toast.success(tn("done", { name: employment.worker.full_name }));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err)) {
            setErrors({
              end_date: err.fieldError("end_date"),
              end_reason: err.fieldError("end_reason"),
            });
            setFormError(err.message || t(`errors.${err.code}`));
          } else setFormError(t("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={tn("title")}
            description={tn("description", { name: employment.worker.full_name })}
          />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            {inWindow ? (
              <Notice tone="info" title={tn("replacement_title")}>
                {tn.rich("replacement_body", {
                  date: () => <DateText ad={employment.replacement_eligible_until} inline />,
                })}
              </Notice>
            ) : null}
            <Field id="end-date" label={t("term.end_date")} error={errors.end_date}>
              <BsDatePicker value={endDate} onChange={setEndDate} min={employment.start_date} />
            </Field>
            <Field id="end-reason" label={tn("reason")} error={errors.end_reason}>
              <NativeSelect
                value={reason}
                onChange={(e) => setReason(e.target.value as EndReason)}
                placeholder={t("common.select")}
                options={END_REASONS.map((r) => ({ value: r, label: t(`end_reason.${r}`) }))}
              />
            </Field>
            <p className="text-fg-muted text-xs">{tn("hint")}</p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={end.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={end.isPending}>
              {tn("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ rate
function StarInput({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const f = useFormat();
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      className="flex gap-1"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="hover:bg-surface-hover has-[:focus-visible]:outline-ring inline-flex size-10 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:outline-2"
          onMouseEnter={() => setHover(n)}
        >
          <input
            type="radio"
            name={id}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
            aria-label={`${label}: ${f.digits(n)} / ${f.digits(5)}`}
          />
          <Star
            className={cn(
              "size-6",
              n <= shown ? "fill-warning text-warning" : "text-border-strong",
            )}
            aria-hidden
          />
        </label>
      ))}
    </div>
  );
}

export function RateDialog({ open, onOpenChange, employment }: Open) {
  const t = useTranslations();
  const tr = useTranslations("workforce.rate");
  const rate = useRateEmployment();
  const [a, setA] = React.useState(0);
  const [b, setB] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setA(0);
      setB(0);
      setComment("");
      setError(null);
      setTouched(false);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!a || !b) return;
    setError(null);
    rate.mutate(
      { id: employment.id, score_a: a, score_b: b, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(tr("done"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err) && err.code === "duplicate") setError(tr("already_rated"));
          else if (isApiError(err)) setError(err.message || t(`errors.${err.code}`));
          else setError(t("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={tr("title", { name: employment.worker.full_name })}
            description={tr("description")}
          />
          <DialogBody className="space-y-5">
            <FormError message={error} />
            <div className="space-y-1.5">
              <p id="rate-a-label" className="text-fg text-sm font-medium">
                {tr("score_a")}
              </p>
              <p className="text-fg-muted text-xs">{tr("score_a_hint")}</p>
              <StarInput id="rate-a" value={a} onChange={setA} label={tr("score_a")} />
              {touched && !a ? (
                <p className="text-danger text-xs font-medium">{t("errors.required")}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p id="rate-b-label" className="text-fg text-sm font-medium">
                {tr("score_b")}
              </p>
              <p className="text-fg-muted text-xs">{tr("score_b_hint")}</p>
              <StarInput id="rate-b" value={b} onChange={setB} label={tr("score_b")} />
              {touched && !b ? (
                <p className="text-danger text-xs font-medium">{t("errors.required")}</p>
              ) : null}
            </div>
            <Field
              id="rate-comment"
              label={tr("comment")}
              optional
              optionalLabel={t("common.optional")}
            >
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
              />
            </Field>
            <Notice tone="locked">{tr("privacy")}</Notice>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={rate.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={rate.isPending}>
              {tr("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
