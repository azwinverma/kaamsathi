"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BsDatePicker } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { NativeSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { useCreateEmployment } from "@/lib/api/hooks/workforce";
import { useMinimumWage } from "@/lib/api/hooks/ref";
import { isApiError } from "@/lib/api/errors";
import type { EmploymentCreate, Gender } from "@/lib/api/types";
import { isValidPhone, normalizePhone, todayIso } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { EmploymentPicker } from "./employment-picker";
import { WorkforceSiteSelect } from "./shared";
import { refineWage, WageFields, wagePayload, wageShape, type WageFormValues } from "./wage-fields";

type Mode = "new" | "existing";

const FIELDS = [
  "phone",
  "full_name",
  "gender",
  "citizenship_no",
  "worker_id",
  "site_id",
  "designation",
  "start_date",
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

export function AddWorkerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const tw = useTranslations("workforce.add");
  const f = useFormat();
  const router = useRouter();
  const { data: minWage } = useMinimumWage();
  const create = useCreateEmployment();
  const [mode, setMode] = React.useState<Mode>("new");
  const [formError, setFormError] = React.useState<string | null>(null);
  /** Ended employment picked in "existing worker" mode (for the combobox label). */
  const [pickedEmployment, setPickedEmployment] = React.useState("");

  const schema = React.useMemo(
    () =>
      z
        .object({
          mode: z.enum(["new", "existing"]),
          phone: z.string(),
          full_name: z.string(),
          gender: z.string(),
          citizenship_no: z.string(),
          worker_id: z.string(),
          site_id: z.string(),
          designation: z.string().trim().min(1, t("errors.required")),
          start_date: z.string().min(1, t("errors.required")),
          employee_code: z.string(),
          ...wageShape,
        })
        .superRefine((v, ctx) => {
          if (v.mode === "new") {
            if (!isValidPhone(v.phone))
              ctx.addIssue({ code: "custom", path: ["phone"], message: t("errors.invalid_phone") });
            if (v.full_name.trim().length < 2)
              ctx.addIssue({ code: "custom", path: ["full_name"], message: t("errors.required") });
          } else if (!v.worker_id) {
            ctx.addIssue({
              code: "custom",
              path: ["worker_id"],
              message: tw("pick_worker_required"),
            });
          }
          refineWage(v as WageFormValues, ctx, minWage, t, (n) => f.money(n));
        }),
    [t, tw, minWage, f],
  );
  type FormValues = z.input<typeof schema>;

  const defaults: FormValues = React.useMemo(
    () => ({
      mode: "new",
      phone: "",
      full_name: "",
      gender: "",
      citizenship_no: "",
      worker_id: "",
      site_id: "",
      designation: "",
      start_date: todayIso(),
      employee_code: "",
      wage_type: "monthly",
      basic_salary: "",
      dearness_allowance: "",
      other_allowance: "",
      daily_wage: "",
      hourly_wage: "",
      part_time: false,
      ssf_enrolled: false,
    }),
    [],
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { register, control, handleSubmit, formState, setValue, setError, reset } = form;
  const errors = formState.errors;

  React.useEffect(() => {
    if (open) {
      reset(defaults);
      setMode("new");
      setPickedEmployment("");
      setFormError(null);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setValue("mode", m);
  };

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const body: EmploymentCreate = {
      ...(v.mode === "new"
        ? {
            worker: {
              phone: normalizePhone(v.phone),
              full_name: v.full_name.trim(),
              gender: (v.gender || undefined) as Gender | undefined,
              citizenship_no: v.citizenship_no.trim() || undefined,
            },
          }
        : { worker_id: v.worker_id }),
      site_id: v.site_id || null,
      designation: v.designation.trim(),
      start_date: v.start_date,
      employee_code: v.employee_code.trim() || undefined,
      ...wagePayload(v as WageFormValues),
    };
    create.mutate(body, {
      onSuccess: (emp) => {
        toast.success(tw("created", { name: emp.worker?.full_name ?? v.full_name }));
        onOpenChange(false);
        if (emp?.id) router.push(`/app/workers/${emp.id}`);
      },
      onError: (err) => {
        if (isApiError(err) && err.code === "below_minimum_wage") {
          setFormError(err.message || t("errors.below_minimum_wage"));
          return;
        }
        if (isApiError(err) && err.code === "duplicate") {
          setFormError(err.message || tw("duplicate"));
          return;
        }
        const msg = handleFormError(err, setError, t, {
          fields: FIELDS,
          map: {
            "worker.phone": "phone",
            "worker.full_name": "full_name",
            "worker.citizenship_no": "citizenship_no",
            "worker.gender": "gender",
          },
          toast: false,
        });
        setFormError(msg);
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={t("common.close")}>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={tw("title")} description={tw("description")} />
          <DialogBody className="space-y-6">
            <FormError message={formError} />
            <section className="space-y-4">
              <h3 className="text-fg text-sm font-semibold">{tw("worker_section")}</h3>
              <Segmented<Mode>
                label={tw("worker_section")}
                value={mode}
                onChange={switchMode}
                options={[
                  { value: "new", label: tw("mode_new") },
                  { value: "existing", label: tw("mode_existing") },
                ]}
              />
              {mode === "new" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="aw-phone"
                    label={t("term.phone")}
                    error={errors.phone?.message}
                    hint={tw("phone_hint")}
                  >
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <PhoneInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </Field>
                  <Field id="aw-name" label={t("term.full_name")} error={errors.full_name?.message}>
                    <Input autoComplete="off" {...register("full_name")} />
                  </Field>
                  <Field
                    id="aw-gender"
                    label={t("term.gender")}
                    optional
                    optionalLabel={t("common.optional")}
                  >
                    <NativeSelect
                      {...register("gender")}
                      placeholder={t("common.select")}
                      options={(["male", "female", "other"] as const).map((g) => ({
                        value: g,
                        label: t(`term.${g}`),
                      }))}
                    />
                  </Field>
                  <Field
                    id="aw-citizenship"
                    label={t("term.citizenship")}
                    optional
                    optionalLabel={t("common.optional")}
                    error={errors.citizenship_no?.message}
                  >
                    <Input {...register("citizenship_no")} />
                  </Field>
                </div>
              ) : (
                <Field
                  id="aw-existing"
                  label={tw("existing_label")}
                  hint={tw("existing_hint")}
                  error={errors.worker_id?.message}
                >
                  <EmploymentPicker
                    status="ended"
                    value={pickedEmployment}
                    onChange={(id, emp) => {
                      setPickedEmployment(id);
                      setValue("worker_id", emp?.worker.id ?? "", {
                        shouldValidate: formState.isSubmitted,
                      });
                    }}
                    placeholder={tw("existing_placeholder")}
                  />
                </Field>
              )}
            </section>

            <section className="space-y-4">
              <h3 className="text-fg text-sm font-semibold">{tw("job_section")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="aw-designation"
                  label={t("term.designation")}
                  error={errors.designation?.message}
                >
                  <Input placeholder={tw("designation_placeholder")} {...register("designation")} />
                </Field>
                <Field
                  id="aw-site"
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
                  id="aw-start"
                  label={t("term.start_date")}
                  error={errors.start_date?.message}
                >
                  <Controller
                    control={control}
                    name="start_date"
                    render={({ field }) => (
                      <BsDatePicker value={field.value} onChange={field.onChange} />
                    )}
                  />
                </Field>
                <Field
                  id="aw-code"
                  label={t("term.employee_code")}
                  optional
                  optionalLabel={t("common.optional")}
                >
                  <Input {...register("employee_code")} />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-fg text-sm font-semibold">{tw("wage_section")}</h3>
              <WageFields form={form} minWage={minWage} idPrefix="aw" />
            </section>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {tw("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
