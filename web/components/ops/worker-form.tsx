"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { Input, PrefixInput, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { BsDatePicker } from "@/components/ui/date";
import { SwitchField } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { DistrictSelect, TradeSelect } from "@/components/shared/selects";
import { tradeOf } from "@/components/shared/worker-summary";
import { handleFormError, zMoney, zPhone } from "@/lib/forms";
import { toLatinDigits } from "@/lib/format";
import type { Gender, NstbLevel, OpsWorker, OpsWorkerInput, PaymentMethod } from "@/lib/api/types";
import { districtCode } from "./helpers";

const NSTB_LEVELS: NstbLevel[] = ["none", "elementary", "level1", "level2", "level3"];
const PAYMENT_METHODS: PaymentMethod[] = ["cash", "bank", "esewa", "khalti"];
const TOP_FIELDS = [
  "full_name",
  "full_name_ne",
  "phone",
  "gender",
  "date_of_birth",
  "current_district",
  "permanent_district",
  "address",
  "citizenship_no",
  "nid_no",
  "expected_monthly_wage",
  "is_available",
  "available_from",
  "payment_method",
  "bank_name",
  "bank_account_no",
  "bank_account_name",
  "wallet_id",
  "ssf_id",
  "notes",
  "skills",
] as const;

function nul(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

export function WorkerForm({
  worker,
  onSubmit,
  submitting,
  submitLabel,
  onCancel,
}: {
  worker?: OpsWorker | null;
  onSubmit: (body: OpsWorkerInput) => Promise<unknown>;
  submitting?: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const tf = useTranslations("ops.worker_form");
  const [formError, setFormError] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(2, t("errors.required")),
        full_name_ne: z.string(),
        phone: zPhone(t("errors.invalid_phone")),
        gender: z.enum(["male", "female", "other"]),
        date_of_birth: z.string(),
        current_district: z.string(),
        permanent_district: z.string(),
        address: z.string(),
        citizenship_no: z.string(),
        nid_no: z.string(),
        expected_monthly_wage: zMoney(t("errors.invalid_number"), { optional: true }),
        is_available: z.boolean(),
        available_from: z.string(),
        payment_method: z.enum(["bank", "esewa", "khalti", "cash"]),
        bank_name: z.string(),
        bank_account_no: z.string(),
        bank_account_name: z.string(),
        wallet_id: z.string(),
        ssf_id: z.string(),
        notes: z.string(),
        skills: z
          .array(
            z.object({
              trade: z.string().min(1, t("errors.required")),
              years_experience: z
                .string()
                .transform((v) => toLatinDigits(v).trim())
                .refine((v) => /^\d{1,2}$/.test(v), tf("invalid_years")),
              nstb_level: z.enum(["none", "elementary", "level1", "level2", "level3"]),
              certificate_no: z.string(),
            }),
          )
          .superRefine((skills, ctx) => {
            const seen = new Set<string>();
            skills.forEach((s, i) => {
              if (s.trade && seen.has(s.trade)) {
                ctx.addIssue({ code: "custom", message: tf("duplicate_trade"), path: [i, "trade"] });
              }
              seen.add(s.trade);
            });
          }),
      }),
    [t, tf],
  );
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const defaults = React.useMemo<FormIn>(
    () => ({
      full_name: worker?.full_name ?? "",
      full_name_ne: worker?.full_name_ne ?? "",
      phone: worker?.phone ?? "",
      gender: (worker?.gender ?? "male") as Gender,
      date_of_birth: worker?.date_of_birth ?? "",
      current_district: districtCode(worker?.current_district),
      permanent_district: districtCode(worker?.permanent_district),
      address: worker?.address ?? "",
      citizenship_no: worker?.citizenship_no ?? "",
      nid_no: worker?.nid_no ?? "",
      expected_monthly_wage: worker?.expected_monthly_wage ? String(Number(worker.expected_monthly_wage)) : "",
      is_available: worker?.is_available ?? true,
      available_from: worker?.available_from ?? "",
      payment_method: worker?.payment_method ?? "cash",
      bank_name: worker?.bank_name ?? "",
      bank_account_no: worker?.bank_account_no ?? "",
      bank_account_name: worker?.bank_account_name ?? "",
      wallet_id: worker?.wallet_id ?? "",
      ssf_id: worker?.ssf_id ?? "",
      notes: worker?.notes ?? "",
      skills: (worker?.skills ?? []).map((s) => ({
        trade: tradeOf(s)?.code ?? "",
        years_experience: String(s.years_experience ?? 0),
        nstb_level: s.nstb_level ?? "none",
        certificate_no: s.certificate_no ?? "",
      })),
    }),
    [worker],
  );

  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { register, control, handleSubmit, formState, watch, reset } = form;
  const errors = formState.errors;
  const skills = useFieldArray({ control, name: "skills" });
  const payment = watch("payment_method");

  // Re-sync with the server record, but never clobber unsaved edits (e.g. after a document upload).
  const lastId = React.useRef(worker?.id);
  const isDirty = formState.isDirty;
  React.useEffect(() => {
    if (lastId.current !== worker?.id || !isDirty) {
      lastId.current = worker?.id;
      reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults, reset]);

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    const body: OpsWorkerInput = {
      full_name: v.full_name.trim(),
      full_name_ne: nul(v.full_name_ne),
      phone: v.phone,
      gender: v.gender,
      date_of_birth: nul(v.date_of_birth),
      current_district: nul(v.current_district),
      permanent_district: nul(v.permanent_district),
      address: nul(v.address),
      citizenship_no: nul(v.citizenship_no),
      nid_no: nul(v.nid_no),
      expected_monthly_wage: v.expected_monthly_wage || null,
      is_available: v.is_available,
      available_from: nul(v.available_from),
      payment_method: v.payment_method,
      bank_name: v.payment_method === "bank" ? nul(v.bank_name) : null,
      bank_account_no: v.payment_method === "bank" ? nul(v.bank_account_no) : null,
      bank_account_name: v.payment_method === "bank" ? nul(v.bank_account_name) : null,
      wallet_id: v.payment_method === "esewa" || v.payment_method === "khalti" ? nul(v.wallet_id) : null,
      ssf_id: nul(v.ssf_id),
      notes: nul(v.notes),
      skills: v.skills.map((s) => ({
        trade: s.trade,
        years_experience: Number(s.years_experience),
        nstb_level: s.nstb_level,
        certificate_no: nul(s.certificate_no),
      })),
    };
    try {
      await onSubmit(body);
      reset(form.getValues());
    } catch (err) {
      const skillFields = v.skills.flatMap((_, i) =>
        ["trade", "years_experience", "nstb_level", "certificate_no"].map((k) => `skills.${i}.${k}`),
      );
      setFormError(
        handleFormError(err, form.setError, t, { fields: [...TOP_FIELDS, ...skillFields], toast: false }),
      );
    }
  });

  const opt = { optional: true, optionalLabel: t("common.optional") };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FormError message={formError} />

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-fg">{tf("section_identity")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="full_name" label={t("term.full_name")} error={errors.full_name?.message}>
            <Input autoComplete="off" {...register("full_name")} />
          </Field>
          <Field id="full_name_ne" label={tf("full_name_ne")} {...opt} error={errors.full_name_ne?.message}>
            <Input lang="ne" autoComplete="off" {...register("full_name_ne")} />
          </Field>
          <Field id="phone" label={t("term.phone")} error={errors.phone?.message}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => <PhoneInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("term.gender")}</span>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Segmented
                  label={t("term.gender")}
                  value={field.value}
                  onChange={field.onChange}
                  className="self-start"
                  options={(["male", "female", "other"] as const).map((g) => ({ value: g, label: t(`term.${g}`) }))}
                />
              )}
            />
          </div>
          <Field id="date_of_birth" label={t("term.date_of_birth")} {...opt} error={errors.date_of_birth?.message}>
            <Controller
              control={control}
              name="date_of_birth"
              render={({ field }) => (
                <DateWithClear value={field.value} onChange={field.onChange} clearLabel={tf("clear_date")} />
              )}
            />
          </Field>
          <Field id="ssf_id" label={t("term.ssf_no")} {...opt} error={errors.ssf_id?.message}>
            <Input className="tabular" {...register("ssf_id")} />
          </Field>
          <Field id="citizenship_no" label={t("term.citizenship")} {...opt} error={errors.citizenship_no?.message}>
            <Input className="tabular" {...register("citizenship_no")} />
          </Field>
          <Field id="nid_no" label={t("term.nid")} {...opt} error={errors.nid_no?.message}>
            <Input className="tabular" {...register("nid_no")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-fg">{tf("section_location")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="current_district" label={tf("current_district")} {...opt} error={errors.current_district?.message}>
            <Controller
              control={control}
              name="current_district"
              render={({ field }) => <DistrictSelect value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field
            id="permanent_district"
            label={tf("permanent_district")}
            {...opt}
            error={errors.permanent_district?.message}
          >
            <Controller
              control={control}
              name="permanent_district"
              render={({ field }) => <DistrictSelect value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field id="address" label={t("term.address")} {...opt} error={errors.address?.message} className="sm:col-span-2">
            <Input {...register("address")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg">{tf("section_skills")}</h2>
            <p className="text-sm text-fg-muted">{tf("skills_hint")}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => skills.append({ trade: "", years_experience: "0", nstb_level: "none", certificate_no: "" })}
          >
            <Plus aria-hidden />
            {tf("add_skill")}
          </Button>
        </div>
        {skills.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
            {tf("no_skills")}
          </p>
        ) : (
          <ul className="space-y-3">
            {skills.fields.map((row, i) => {
              const e = errors.skills?.[i];
              return (
                <li key={row.id} className="rounded-lg border border-border bg-surface-muted/40 p-3.5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_auto] sm:items-start">
                    <Field id={`skills.${i}.trade`} label={t("term.trade")} error={e?.trade?.message}>
                      <Controller
                        control={control}
                        name={`skills.${i}.trade`}
                        render={({ field }) => <TradeSelect value={field.value} onChange={field.onChange} />}
                      />
                    </Field>
                    <Field id={`skills.${i}.years_experience`} label={tf("skill_years")} error={e?.years_experience?.message}>
                      <Input inputMode="numeric" maxLength={2} className="tabular" {...register(`skills.${i}.years_experience`)} />
                    </Field>
                    <Field id={`skills.${i}.nstb_level`} label={tf("skill_nstb")} error={e?.nstb_level?.message}>
                      <NativeSelect
                        {...register(`skills.${i}.nstb_level`)}
                        options={NSTB_LEVELS.map((l) => ({ value: l, label: t(`nstb.${l}`) }))}
                      />
                    </Field>
                    <Field
                      id={`skills.${i}.certificate_no`}
                      label={tf("skill_certificate")}
                      {...opt}
                      error={e?.certificate_no?.message}
                    >
                      <Input className="tabular" {...register(`skills.${i}.certificate_no`)} />
                    </Field>
                    <div className="flex justify-end sm:pt-7">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => skills.remove(i)}
                        aria-label={tf("remove_skill")}
                        title={tf("remove_skill")}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-fg">{tf("section_work")}</h2>
        <Controller
          control={control}
          name="is_available"
          render={({ field }) => (
            <SwitchField
              id="is_available"
              label={tf("available")}
              description={tf("available_hint")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="expected_monthly_wage"
            label={tf("expected_wage")}
            hint={tf("expected_wage_hint")}
            {...opt}
            error={errors.expected_monthly_wage?.message}
          >
            <PrefixInput prefix={t("term.npr")} inputMode="decimal" {...register("expected_monthly_wage")} />
          </Field>
          <Field id="available_from" label={tf("available_from")} {...opt} error={errors.available_from?.message}>
            <Controller
              control={control}
              name="available_from"
              render={({ field }) => (
                <DateWithClear value={field.value} onChange={field.onChange} clearLabel={tf("clear_date")} />
              )}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-fg">{tf("section_payment")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="payment_method" label={tf("payment_method")} error={errors.payment_method?.message}>
            <NativeSelect
              {...register("payment_method")}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`pay.${m}`) }))}
            />
          </Field>
          {payment === "esewa" || payment === "khalti" ? (
            <Field id="wallet_id" label={tf("wallet_id")} {...opt} error={errors.wallet_id?.message}>
              <Input className="tabular" inputMode="numeric" {...register("wallet_id")} />
            </Field>
          ) : null}
          {payment === "bank" ? (
            <>
              <Field id="bank_name" label={tf("bank_name")} {...opt} error={errors.bank_name?.message}>
                <Input {...register("bank_name")} />
              </Field>
              <Field id="bank_account_no" label={tf("bank_account_no")} {...opt} error={errors.bank_account_no?.message}>
                <Input className="tabular" {...register("bank_account_no")} />
              </Field>
              <Field
                id="bank_account_name"
                label={tf("bank_account_name")}
                {...opt}
                error={errors.bank_account_name?.message}
              >
                <Input {...register("bank_account_name")} />
              </Field>
            </>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <Field id="notes" label={tf("notes")} hint={tf("notes_hint")} {...opt} error={errors.notes?.message}>
          <Textarea rows={3} {...register("notes")} />
        </Field>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function DateWithClear({
  value,
  onChange,
  clearLabel,
  id,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  clearLabel: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <BsDatePicker id={id} value={value || null} onChange={onChange} className="flex-1" {...aria} />
      {value ? (
        <Button variant="ghost" size="icon" onClick={() => onChange("")} aria-label={clearLabel} title={clearLabel}>
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
