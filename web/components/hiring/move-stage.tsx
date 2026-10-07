"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { RefreshCcw } from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { SiteSelect } from "@/components/shared/selects";
import { useJob, useMoveApplication } from "@/lib/api/hooks/hiring";
import type { Application, ApplicationDetail, MoveInput, Stage, WageType } from "@/lib/api/types";
import { addDays, todayIso } from "@/lib/format";
import { handleFormError, toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { Bind } from "./bind";
import {
  STAGES_WITH_DIALOG,
  canMove,
  ktmDate,
  ktmDateTime,
  parseAmount,
  splitMonthly,
  toMoneyString,
} from "./lib";
import { useWageCheck } from "./wage";

type MovableApp = Pick<Application | ApplicationDetail, "id" | "stage" | "job" | "interview_at"> & {
  worker: { full_name: string };
};

/** CONTRACT §Billing: placement charge on joining. */
const PLACEMENT_FEE = 5000;
const REPLACEMENT_DAYS = 30;

interface FormValues {
  interview_date: string;
  interview_time: string;
  rejection_reason: string;
  note: string;
  start_date: string;
  site_id: string;
  designation: string;
  wage_type: WageType;
  basic_salary: string;
  dearness_allowance: string;
  daily_wage: string;
  ssf_enrolled: boolean;
}

const SERVER_MAP: Record<string, string> = {
  interview_at: "interview_date",
  "employment.start_date": "start_date",
  "employment.site_id": "site_id",
  "employment.designation": "designation",
  "employment.wage_type": "wage_type",
  "employment.basic_salary": "basic_salary",
  "employment.dearness_allowance": "dearness_allowance",
  "employment.daily_wage": "daily_wage",
  employment: "start_date",
};
const FORM_FIELDS = [
  "interview_date",
  "rejection_reason",
  "note",
  "start_date",
  "site_id",
  "designation",
  "wage_type",
  "basic_salary",
  "dearness_allowance",
  "daily_wage",
] as const;

/**
 * Stage moves: stages that need input (interview, rejected, dropped, joined) open the dialog;
 * shortlisted / selected move straight away.
 */
export function useStageMove() {
  const t = useTranslations();
  const move = useMoveApplication();
  const [target, setTarget] = React.useState<{ app: MovableApp; stage: Stage } | null>(null);

  const request = React.useCallback(
    (app: MovableApp, stage: Stage) => {
      if (!canMove(app.stage, stage)) return;
      if (STAGES_WITH_DIALOG.includes(stage)) {
        setTarget({ app, stage });
        return;
      }
      move.mutate(
        { id: app.id, stage },
        {
          onSuccess: () =>
            toast.success(
              t("hiring.move.moved_toast", {
                name: app.worker.full_name,
                stage: t(`stage.${stage}`),
              }),
            ),
          onError: (e) => toastError(e, t),
        },
      );
    },
    [move, t],
  );

  const dialog = (
    <MoveStageDialog
      app={target?.app ?? null}
      stage={target?.stage ?? null}
      onOpenChange={(o) => !o && setTarget(null)}
    />
  );
  return { request, dialog, pendingId: move.isPending ? move.variables?.id : undefined };
}

export function MoveStageDialog({
  app,
  stage,
  onOpenChange,
}: {
  app: MovableApp | null;
  stage: Stage | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const tm = useTranslations("hiring.move");
  const f = useFormat();
  const router = useRouter();
  const move = useMoveApplication();
  const wage = useWageCheck();
  const { data: job } = useJob(stage === "joined" ? app?.job.id : undefined);
  const [formError, setFormError] = React.useState<string | null>(null);
  const open = !!app && !!stage;

  const form = useForm<FormValues>({
    defaultValues: {
      interview_date: "",
      interview_time: "10:00",
      rejection_reason: "",
      note: "",
      start_date: todayIso(),
      site_id: "",
      designation: "",
      wage_type: "monthly",
      basic_salary: "",
      dearness_allowance: "",
      daily_wage: "",
      ssf_enrolled: false,
    },
  });
  const { register, control, handleSubmit, reset, setError, watch, setValue, formState } = form;
  const errors = formState.errors;

  // Reset on open; prefill employment terms from the job once it's loaded.
  const jobReady = !!job;
  React.useEffect(() => {
    if (!open) return;
    setFormError(null);
    const existing = app?.interview_at;
    const wt: WageType = job?.wage_type ?? "monthly";
    const amount = parseAmount(job?.wage_amount) ?? 0;
    const split = wt === "monthly" && amount ? splitMonthly(amount, wage.mw) : null;
    const today = todayIso();
    reset({
      interview_date: (existing && ktmDate(existing)) || "",
      interview_time: existing
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kathmandu",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(existing))
        : "10:00",
      rejection_reason: "",
      note: "",
      start_date: job?.start_date && job.start_date > today ? job.start_date : today,
      site_id: job?.site?.id ?? "",
      designation: job?.title ?? "",
      wage_type: wt,
      basic_salary: split ? String(split.basic) : "",
      dearness_allowance: split ? String(split.da) : "",
      daily_wage: wt === "daily" && amount ? String(amount) : "",
      ssf_enrolled: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app?.id, stage, jobReady]);

  const wt = watch("wage_type");
  const basic = parseAmount(watch("basic_salary"));
  const da = parseAmount(watch("dearness_allowance"));
  const daily = parseAmount(watch("daily_wage"));
  const monthlyTotal = basic !== null || da !== null ? (basic ?? 0) + (da ?? 0) : null;
  const liveBelow =
    wt === "monthly" ? wage.below("monthly", monthlyTotal) : wage.below("daily", daily);
  const startDate = watch("start_date");

  if (!app || !stage) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }
  const name = app.worker.full_name;
  const stageLabel = t(`stage.${stage}`);

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const body: MoveInput = { stage, note: v.note.trim() || undefined };
    let ok = true;
    const req = (field: keyof FormValues, cond: boolean, msg = t("errors.required")) => {
      if (!cond) {
        setError(field, { type: "required", message: msg });
        ok = false;
      }
    };
    if (stage === "interview") {
      req("interview_date", !!v.interview_date && !!v.interview_time, tm("interview_required"));
      if (v.interview_date)
        body.interview_at = ktmDateTime(v.interview_date, v.interview_time || "10:00");
    }
    if (stage === "rejected") body.rejection_reason = v.rejection_reason.trim() || undefined;
    if (stage === "joined") {
      req("start_date", !!v.start_date);
      if (v.wage_type === "monthly") {
        const b = parseAmount(v.basic_salary);
        const d = parseAmount(v.dearness_allowance);
        req("basic_salary", b !== null && b > 0, t("errors.invalid_number"));
        req("dearness_allowance", d !== null, t("errors.invalid_number"));
        const below = b !== null && d !== null ? wage.below("monthly", b + d) : undefined;
        if (below) req("basic_salary", false, below);
        if (ok)
          body.employment = {
            start_date: v.start_date,
            site_id: v.site_id || null,
            designation: v.designation.trim() || undefined,
            wage_type: "monthly",
            basic_salary: toMoneyString(b!),
            dearness_allowance: toMoneyString(d!),
            ssf_enrolled: v.ssf_enrolled,
          };
      } else {
        const w = parseAmount(v.daily_wage);
        req("daily_wage", w !== null && w > 0, t("errors.invalid_number"));
        const below = w !== null ? wage.below("daily", w) : undefined;
        if (below) req("daily_wage", false, below);
        if (ok)
          body.employment = {
            start_date: v.start_date,
            site_id: v.site_id || null,
            designation: v.designation.trim() || undefined,
            wage_type: "daily",
            daily_wage: toMoneyString(w!),
            ssf_enrolled: v.ssf_enrolled,
          };
      }
    }
    if (!ok) return;
    move.mutate(
      { id: app.id, ...body },
      {
        onSuccess: (res) => {
          if (stage === "joined") {
            toast.success(tm("joined_toast", { name }), {
              action: res?.employment_id
                ? { label: tm("view_workers"), onClick: () => router.push(`/app/workers/${res.employment_id}`) }
                : undefined,
            });
          } else {
            toast.success(tm("moved_toast", { name, stage: stageLabel }));
          }
          onOpenChange(false);
        },
        onError: (err) =>
          setFormError(
            handleFormError(err, setError, t, {
              fields: FORM_FIELDS,
              map: SERVER_MAP,
              toast: false,
            }),
          ),
      },
    );
  });

  const replacementUntil = startDate ? addDays(startDate, REPLACEMENT_DAYS) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !move.isPending && onOpenChange(o)}>
      <DialogContent size={stage === "joined" ? "lg" : "md"} closeLabel={t("common.close")}>
        <DialogHeader
          title={tm("title", { name })}
          description={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <StatusBadge status={app.stage} ns="stage" />
              <span aria-hidden>→</span>
              <StatusBadge status={stage} ns="stage" />
              <span className="sr-only">
                {tm("description", { from: t(`stage.${app.stage}`), to: stageLabel })}
              </span>
            </span>
          }
        />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            <FormError message={formError} />

            {stage === "interview" ? (
              <div className="space-y-2">
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <Field
                    id="mv-int-date"
                    label={tm("interview_date")}
                    error={errors.interview_date?.message}
                  >
                    <Bind
                      render={(a) => (
                        <Controller
                          control={control}
                          name="interview_date"
                          render={({ field }) => (
                            <BsDatePicker
                              {...a}
                              value={field.value}
                              onChange={field.onChange}
                              min={todayIso()}
                            />
                          )}
                        />
                      )}
                    />
                  </Field>
                  <Field id="mv-int-time" label={tm("interview_time")}>
                    <Input type="time" step={300} {...register("interview_time")} />
                  </Field>
                </div>
                <p className="text-fg-muted text-xs">{tm("interview_hint")}</p>
              </div>
            ) : null}

            {stage === "rejected" ? (
              <Field
                id="mv-reason"
                label={tm("rejection_reason")}
                optional
                optionalLabel={t("common.optional")}
                error={errors.rejection_reason?.message}
              >
                <Textarea
                  rows={2}
                  placeholder={tm("rejection_placeholder")}
                  {...register("rejection_reason")}
                />
              </Field>
            ) : null}

            {stage === "joined" ? (
              <>
                <Fieldset legend={tm("employment_heading")} description={tm("employment_hint")}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="mv-start"
                      label={t("term.start_date")}
                      error={errors.start_date?.message}
                    >
                      <Bind
                        render={(a) => (
                          <Controller
                            control={control}
                            name="start_date"
                            render={({ field }) => (
                              <BsDatePicker {...a} value={field.value} onChange={field.onChange} />
                            )}
                          />
                        )}
                      />
                    </Field>
                    <Field id="mv-site" label={t("term.site")} error={errors.site_id?.message}>
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
                                allLabel={t("hiring.form.site_none")}
                              />
                            )}
                          />
                        )}
                      />
                    </Field>
                    <Field
                      id="mv-designation"
                      label={t("term.designation")}
                      error={errors.designation?.message}
                      className="sm:col-span-2"
                    >
                      <Input {...register("designation")} />
                    </Field>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-fg text-sm font-medium">{t("term.wage_type")}</span>
                      <Controller
                        control={control}
                        name="wage_type"
                        render={({ field }) => (
                          <Segmented<WageType>
                            label={t("term.wage_type")}
                            value={field.value}
                            onChange={(v) => {
                              field.onChange(v);
                              // carry the amount across so the user doesn't retype
                              if (v === "daily" && !form.getValues("daily_wage")) {
                                const min = wage.min("daily");
                                if (min) setValue("daily_wage", String(min));
                              }
                              if (v === "monthly" && !form.getValues("basic_salary")) {
                                const s = splitMonthly(wage.min("monthly") ?? 19550, wage.mw);
                                setValue("basic_salary", String(s.basic));
                                setValue("dearness_allowance", String(s.da));
                              }
                            }}
                            options={[
                              { value: "monthly", label: t("term.monthly") },
                              { value: "daily", label: t("term.daily") },
                            ]}
                          />
                        )}
                      />
                    </div>
                    {wt === "monthly" ? (
                      <>
                        <Field
                          id="mv-basic"
                          label={t("term.basic_salary")}
                          error={errors.basic_salary?.message ?? liveBelow}
                        >
                          <PrefixInput
                            prefix={t("term.npr")}
                            inputMode="decimal"
                            {...register("basic_salary")}
                          />
                        </Field>
                        <Field
                          id="mv-da"
                          label={t("term.dearness_allowance")}
                          error={errors.dearness_allowance?.message}
                        >
                          <PrefixInput
                            prefix={t("term.npr")}
                            inputMode="decimal"
                            {...register("dearness_allowance")}
                          />
                        </Field>
                        <p className="text-fg-muted text-xs sm:col-span-2">
                          {monthlyTotal !== null ? (
                            <span className="text-fg font-medium">
                              {tm("monthly_total", { amount: f.money(monthlyTotal) })}
                            </span>
                          ) : null}{" "}
                          {wage.hint("monthly")}
                        </p>
                      </>
                    ) : (
                      <Field
                        id="mv-daily"
                        label={t("term.daily_wage")}
                        error={errors.daily_wage?.message ?? liveBelow}
                        hint={wage.hint("daily")}
                        className="sm:col-span-2"
                      >
                        <PrefixInput
                          prefix={t("term.npr")}
                          suffix={t("common.per_day")}
                          inputMode="decimal"
                          {...register("daily_wage")}
                        />
                      </Field>
                    )}
                  </div>
                  <Controller
                    control={control}
                    name="ssf_enrolled"
                    render={({ field }) => (
                      <SwitchField
                        id="mv-ssf"
                        label={t("term.ssf")}
                        description={tm("ssf_hint")}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </Fieldset>
                <div className="border-success/30 bg-success-subtle flex gap-3 rounded-lg border p-3.5 text-sm">
                  <RefreshCcw className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-fg font-semibold">{tm("replacement_title")}</p>
                    <p className="text-fg-body">
                      {tm("replacement_body", { date: f.date(replacementUntil).bs })}
                    </p>
                    <p className="text-fg-muted text-xs">
                      {tm("fee_note", { amount: f.money(PLACEMENT_FEE) })}
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            <Field
              id="mv-note"
              label={t("common.note")}
              optional
              optionalLabel={t("common.optional")}
            >
              <Textarea rows={2} placeholder={tm("note_placeholder")} {...register("note")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={move.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant={stage === "rejected" || stage === "dropped" ? "danger" : "primary"}
              loading={move.isPending}
            >
              {stage === "joined" ? tm("confirm_join") : tm("submit", { stage: stageLabel })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
