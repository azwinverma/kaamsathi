"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { BsDatePicker } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, Fieldset, FormError } from "@/components/ui/field";
import { Input, PrefixInput, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { SiteSelect, TradeSelect } from "@/components/shared/selects";
import { listResults } from "@/lib/api/client";
import { useCreateJob, usePublishJob, useUpdateJob } from "@/lib/api/hooks/hiring";
import { useShifts } from "@/lib/api/hooks/org";
import { useTrades } from "@/lib/api/hooks/ref";
import { isApiError } from "@/lib/api/errors";
import type { Job, JobInput, WageType } from "@/lib/api/types";
import { toLatinDigits, todayIso } from "@/lib/format";
import { handleFormError, zMoney } from "@/lib/forms";
import { Bind } from "./bind";
import { parseAmount } from "./lib";
import { requirementToRow, rowProblem, rowToInput, type RequirementRow } from "./pipeline-lib";
import { RequirementsEditor } from "./requirements";
import { useFormat } from "@/lib/use-format";
import { useWageCheck } from "./wage";

const FIELDS = [
  "title",
  "trade",
  "description",
  "site_id",
  "shift",
  "openings_count",
  "wage_type",
  "wage_amount",
  "food_provided",
  "accommodation_provided",
  "start_date",
  "min_experience_years",
] as const;

function shiftId(shift: Job["shift"]): string {
  if (!shift) return "";
  return typeof shift === "string" ? shift : shift.id;
}

function intField(msg: string, min: number, max: number) {
  return z
    .string()
    .transform((v) => toLatinDigits(v).trim())
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, { message: msg });
}

/** Create (job = undefined) or edit a job opening. */
export function JobFormDialog({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Job;
}) {
  const t = useTranslations();
  const tf = useTranslations("hiring.form");
  const tr = useTranslations("pipeline.requirements");
  const fmt = useFormat();
  const trades = useTrades();
  const router = useRouter();
  const create = useCreateJob();
  const update = useUpdateJob();
  const publish = usePublishJob();
  const wage = useWageCheck();
  const shifts = useShifts();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [reqRows, setReqRows] = React.useState<RequirementRow[]>([]);
  const [reqErrors, setReqErrors] = React.useState<Record<number, string | undefined>>({});
  const publishAfter = React.useRef(false);
  const isEdit = !!job;

  const schema = React.useMemo(
    () =>
      z.object({
        title: z.string().trim().min(2, t("errors.required")),
        trade: z.string().min(1, t("errors.required")),
        description: z.string(),
        site_id: z.string(),
        shift: z.string(),
        openings_count: intField(tf("openings_invalid"), 1, 1000),
        wage_type: z.enum(["monthly", "daily", "hourly"]),
        wage_amount: zMoney(t("errors.invalid_number"), { min: 1 }),
        food_provided: z.boolean(),
        accommodation_provided: z.boolean(),
        start_date: z.string().min(1, t("errors.required")),
        min_experience_years: intField(tf("experience_invalid"), 0, 50),
      }),
    [t, tf],
  );
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const defaults = React.useCallback(
    (): FormIn => ({
      title: job?.title ?? "",
      trade: job?.trade?.code ?? "",
      description: job?.description ?? "",
      site_id: job?.site?.id ?? "",
      shift: shiftId(job?.shift ?? null),
      openings_count: String(job?.openings_count ?? 1),
      wage_type: job?.wage_type ?? "monthly",
      wage_amount: job ? String(parseAmount(job.wage_amount) ?? "") : "",
      food_provided: job?.food_provided ?? false,
      accommodation_provided: job?.accommodation_provided ?? false,
      start_date: job?.start_date ?? "",
      min_experience_years: String(job?.min_experience_years ?? 0),
    }),
    [job],
  );

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });
  const { register, control, handleSubmit, formState, watch, reset, setError } = form;
  const errors = formState.errors;

  React.useEffect(() => {
    if (open) {
      reset(defaults());
      setFormError(null);
      setReqRows((job?.requirements ?? []).map(requirementToRow));
      setReqErrors({});
    }
  }, [open, reset, defaults, job]);

  const tradeCode = watch("trade");
  const jobTrade = (trades.data ?? []).find((tr) => tr.code === tradeCode);
  const wageType = watch("wage_type") as WageType;
  const wageAmount = parseAmount(watch("wage_amount"));
  const liveBelow = wage.below(wageType, wageAmount);
  const pending = create.isPending || update.isPending || publish.isPending;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const problems: Record<number, string | undefined> = {};
    reqRows.forEach((row, i) => {
      const p = rowProblem(row);
      if (p) problems[i] = p === "empty" ? tr("empty_error") : tr("years_error");
    });
    setReqErrors(problems);
    if (Object.keys(problems).length) return;
    const below = wage.below(v.wage_type, Number(v.wage_amount));
    if (below) {
      setError("wage_amount", { type: "min_wage", message: below });
      return;
    }
    const body: JobInput = {
      title: v.title,
      trade: v.trade,
      description: v.description,
      site_id: v.site_id || null,
      shift: v.shift || null,
      openings_count: Number(v.openings_count),
      wage_type: v.wage_type,
      wage_amount: Number(v.wage_amount).toFixed(2),
      food_provided: v.food_provided,
      accommodation_provided: v.accommodation_provided,
      start_date: v.start_date,
      min_experience_years: Number(v.min_experience_years),
      requirements: reqRows.map(rowToInput),
    };
    const onError = (err: unknown) => {
      if (isApiError(err)) {
        const rowErrs: Record<number, string | undefined> = {};
        for (const [key, msgs] of Object.entries(err.fields)) {
          const m = /^requirements\.(\d+)/.exec(key);
          if (m) rowErrs[Number(m[1])] = msgs[0];
        }
        setReqErrors(rowErrs);
      }
      setFormError(
        handleFormError(err, setError, t, {
          fields: FIELDS,
          map: { site: "site_id", shift_id: "shift" },
          toast: false,
        }),
      );
    };
    if (isEdit && job) {
      update.mutate(
        { id: job.id, ...body },
        {
          onSuccess: () => {
            toast.success(t("common.changes_saved"));
            onOpenChange(false);
          },
          onError,
        },
      );
      return;
    }
    create.mutate(body, {
      onSuccess: (created) => {
        if (publishAfter.current) {
          publish.mutate(created.id, {
            onSuccess: () => toast.success(tf("created_published_toast")),
            onError: () => toast.error(tf("created_not_published")),
            onSettled: () => {
              onOpenChange(false);
              router.push(`/app/jobs/${created.id}`);
            },
          });
        } else {
          toast.success(tf("created_toast"));
          onOpenChange(false);
          router.push(`/app/jobs/${created.id}`);
        }
      },
      onError,
    });
  });

  const submitWith = (pub: boolean) => () => {
    publishAfter.current = pub;
  };

  const shiftOptions = listResults(shifts.data).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`,
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="lg" closeLabel={t("common.close")}>
        <DialogHeader
          title={isEdit ? tf("edit_title") : tf("create_title")}
          description={isEdit ? undefined : tf("create_description")}
        />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-6">
            <FormError message={formError} />
            <Fieldset legend={tf("section_role")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="job-title"
                  label={tf("title_label")}
                  error={errors.title?.message}
                  className="sm:col-span-2"
                >
                  <Input placeholder={tf("title_placeholder")} {...register("title")} />
                </Field>
                <Field id="job-trade" label={t("term.trade")} error={errors.trade?.message}>
                  <Bind
                    render={(a) => (
                      <Controller
                        control={control}
                        name="trade"
                        render={({ field }) => (
                          <TradeSelect {...a} value={field.value} onChange={field.onChange} />
                        )}
                      />
                    )}
                  />
                </Field>
                <Field
                  id="job-openings"
                  label={tf("openings_label")}
                  error={errors.openings_count?.message}
                >
                  <Input inputMode="numeric" {...register("openings_count")} />
                </Field>
                <Field
                  id="job-desc"
                  label={tf("description_label")}
                  optional
                  optionalLabel={t("common.optional")}
                  error={errors.description?.message}
                  className="sm:col-span-2"
                >
                  <Textarea
                    rows={3}
                    placeholder={tf("description_placeholder")}
                    {...register("description")}
                  />
                </Field>
              </div>
            </Fieldset>

            <Fieldset legend={tf("section_pay")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-fg text-sm font-medium">{t("term.wage_type")}</span>
                  <Controller
                    control={control}
                    name="wage_type"
                    render={({ field }) => (
                      <Segmented<WageType>
                        label={t("term.wage_type")}
                        value={field.value as WageType}
                        onChange={field.onChange}
                        options={[
                          { value: "monthly", label: t("term.monthly") },
                          { value: "daily", label: t("term.daily") },
                          { value: "hourly", label: t("wage_hourly.hourly") },
                        ]}
                      />
                    )}
                  />
                </div>
                <Field
                  id="job-wage"
                  label={
                    wageType === "monthly"
                      ? tf("wage_monthly_label")
                      : wageType === "hourly"
                        ? t("wage_hourly.hourly_wage")
                        : t("term.daily_wage")
                  }
                  error={errors.wage_amount?.message ?? liveBelow}
                  hint={wage.hint(wageType)}
                >
                  <PrefixInput
                    prefix={t("term.npr")}
                    inputMode="decimal"
                    suffix={
                      wageType === "monthly"
                        ? t("common.per_month")
                        : wageType === "hourly"
                          ? t("wage_hourly.per_hour")
                          : t("common.per_day")
                    }
                    {...register("wage_amount")}
                  />
                </Field>
                <Field
                  id="job-start"
                  label={t("term.start_date")}
                  error={errors.start_date?.message}
                >
                  <Bind
                    render={(a) => (
                      <Controller
                        control={control}
                        name="start_date"
                        render={({ field }) => (
                          <BsDatePicker
                            {...a}
                            value={field.value}
                            onChange={field.onChange}
                            min={isEdit ? undefined : todayIso()}
                          />
                        )}
                      />
                    )}
                  />
                </Field>
                <Field
                  id="job-exp"
                  label={tf("min_experience_label")}
                  error={errors.min_experience_years?.message}
                >
                  <Input inputMode="numeric" {...register("min_experience_years")} />
                </Field>
              </div>
            </Fieldset>

            <Fieldset legend={tf("section_place")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="job-site" label={t("term.site")} error={errors.site_id?.message}>
                  <Bind
                    render={(a) => (
                      <Controller
                        control={control}
                        name="site_id"
                        render={({ field }) => (
                          <SiteSelect
                            {...a}
                            value={field.value}
                            onChange={field.onChange}
                            allLabel={tf("site_none")}
                          />
                        )}
                      />
                    )}
                  />
                </Field>
                <Field id="job-shift" label={t("term.shift")} error={errors.shift?.message}>
                  <Bind
                    render={(a) => (
                      <Controller
                        control={control}
                        name="shift"
                        render={({ field }) => (
                          <Select
                            {...a}
                            value={field.value}
                            onValueChange={field.onChange}
                            allowEmpty
                            emptyLabel={tf("shift_none")}
                            placeholder={tf("shift_none")}
                            disabled={shifts.isLoading}
                            options={shiftOptions}
                          />
                        )}
                      />
                    )}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="food_provided"
                  render={({ field }) => (
                    <SwitchField
                      id="job-food"
                      label={tf("food_label")}
                      description={tf("food_hint")}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="accommodation_provided"
                  render={({ field }) => (
                    <SwitchField
                      id="job-room"
                      label={tf("accommodation_label")}
                      description={tf("accommodation_hint")}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </Fieldset>

            <RequirementsEditor
              rows={reqRows}
              onChange={(rows) => {
                setReqRows(rows);
                setReqErrors({});
              }}
              errors={reqErrors}
              jobTradeName={jobTrade ? fmt.name(jobTrade) : null}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            {isEdit ? (
              <Button type="submit" loading={pending}>
                {t("common.save_changes")}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  variant="secondary"
                  onClick={submitWith(false)}
                  disabled={pending}
                >
                  {tf("save_draft")}
                </Button>
                <Button type="submit" onClick={submitWith(true)} loading={pending}>
                  {tf("save_publish")}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
