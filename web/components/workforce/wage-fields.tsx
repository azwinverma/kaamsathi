"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { PrefixInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import type { MinimumWage, WageType } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { checkMinimumWage, moneyOrNull, parseAmount } from "./utils";

type T = ReturnType<typeof useTranslations>;

export interface WageFormValues {
  wage_type: WageType;
  basic_salary: string;
  dearness_allowance: string;
  other_allowance: string;
  daily_wage: string;
  ssf_enrolled: boolean;
}

export const wageShape = {
  wage_type: z.enum(["monthly", "daily"]),
  basic_salary: z.string(),
  dearness_allowance: z.string(),
  other_allowance: z.string(),
  daily_wage: z.string(),
  ssf_enrolled: z.boolean(),
};

/** zod superRefine body: required amounts per wage type + minimum-wage check. */
export function refineWage(v: WageFormValues, ctx: z.RefinementCtx, mw: MinimumWage | undefined, t: T, money: (n: number) => string) {
  const bad = (path: keyof WageFormValues, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  const num = (s: string) => parseAmount(s);
  const checkNum = (k: keyof WageFormValues, required: boolean) => {
    const raw = String(v[k] ?? "").trim();
    if (!raw) {
      if (required) bad(k, t("errors.required"));
      return;
    }
    const n = num(raw);
    if (n === null || n < 0) bad(k, t("errors.invalid_number"));
  };
  if (v.wage_type === "monthly") {
    checkNum("basic_salary", true);
    checkNum("dearness_allowance", false);
  } else {
    checkNum("daily_wage", true);
  }
  checkNum("other_allowance", false);
  const check = checkMinimumWage(v, mw);
  if (check.ok === false && check.minimum !== null) {
    bad(
      v.wage_type === "monthly" ? "basic_salary" : "daily_wage",
      t("workforce.wage.below_minimum", { min: money(check.minimum) }),
    );
  }
}

/** API payload for the wage part of an employment. */
export function wagePayload(v: WageFormValues) {
  const monthly = v.wage_type === "monthly";
  return {
    wage_type: v.wage_type,
    basic_salary: monthly ? moneyOrNull(v.basic_salary) : null,
    dearness_allowance: monthly ? (moneyOrNull(v.dearness_allowance) ?? "0.00") : null,
    other_allowance: moneyOrNull(v.other_allowance) ?? "0.00",
    daily_wage: monthly ? null : moneyOrNull(v.daily_wage),
    ssf_enrolled: v.ssf_enrolled,
  };
}

/** Strip trailing ".00" from API money for editing. */
export function moneyInput(v: string | null | undefined): string {
  if (!v) return "";
  const n = parseAmount(v);
  return n === null ? "" : String(Number.isInteger(n) ? n : n.toFixed(2));
}

/** Wage type toggle, amount inputs, minimum-wage hint and SSF switch. */
export function WageFields<TF extends FieldValues>({
  form,
  minWage,
  idPrefix,
}: {
  form: UseFormReturn<TF>;
  minWage: MinimumWage | undefined;
  idPrefix: string;
}) {
  const t = useTranslations();
  const f = useFormat();
  const p = (k: keyof WageFormValues) => k as unknown as Path<TF>;
  const { register, watch, setValue, formState } = form;
  const errs = formState.errors as Partial<Record<keyof WageFormValues, { message?: string }>>;
  const values = watch() as unknown as WageFormValues;
  const check = checkMinimumWage(values, minWage);
  const set = (k: keyof WageFormValues, v: unknown) =>
    setValue(p(k), v as PathValue<TF, Path<TF>>, { shouldDirty: true, shouldValidate: formState.isSubmitted });

  const fillMinimum = () => {
    if (!minWage) return;
    if (values.wage_type === "monthly") {
      set("basic_salary", moneyInput(minWage.monthly_basic));
      set("dearness_allowance", moneyInput(minWage.monthly_da));
    } else {
      set("daily_wage", moneyInput(minWage.daily));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg" id={`${idPrefix}-wage-type`}>
          {t("term.wage_type")}
        </span>
        <Segmented<WageType>
          label={t("term.wage_type")}
          value={values.wage_type}
          onChange={(v) => set("wage_type", v)}
          options={[
            { value: "monthly", label: t("term.monthly") },
            { value: "daily", label: t("term.daily") },
          ]}
          className="self-start"
        />
      </div>

      {values.wage_type === "monthly" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-basic`} label={t("term.basic_salary")} error={errs.basic_salary?.message}>
            <PrefixInput prefix={t("term.npr")} inputMode="decimal" {...register(p("basic_salary"))} />
          </Field>
          <Field
            id={`${idPrefix}-da`}
            label={t("term.dearness_allowance")}
            error={errs.dearness_allowance?.message}
          >
            <PrefixInput prefix={t("term.npr")} inputMode="decimal" {...register(p("dearness_allowance"))} />
          </Field>
        </div>
      ) : (
        <Field id={`${idPrefix}-daily`} label={t("term.daily_wage")} error={errs.daily_wage?.message}>
          <PrefixInput
            prefix={t("term.npr")}
            suffix={t("common.per_day")}
            inputMode="decimal"
            {...register(p("daily_wage"))}
          />
        </Field>
      )}

      <Field
        id={`${idPrefix}-other`}
        label={t("workforce.wage.other_allowance")}
        optional
        optionalLabel={t("common.optional")}
        error={errs.other_allowance?.message}
      >
        <PrefixInput prefix={t("term.npr")} inputMode="decimal" {...register(p("other_allowance"))} />
      </Field>

      {minWage ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-fg-body">
              {values.wage_type === "monthly"
                ? t("workforce.wage.min_monthly", {
                    total: f.money(minWage.monthly_total),
                    basic: f.money(minWage.monthly_basic),
                    da: f.money(minWage.monthly_da),
                  })
                : t("workforce.wage.min_daily", { amount: f.money(minWage.daily) })}
            </p>
            {check.ok === true && check.amount !== null ? (
              <p className="font-medium text-success">
                {t("workforce.wage.meets_minimum", { amount: f.money(check.amount) })}
              </p>
            ) : check.ok === false && check.amount !== null && check.minimum !== null ? (
              <p className="font-medium text-danger">
                {t("workforce.wage.short_by", { amount: f.money(check.minimum - check.amount) })}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={fillMinimum} className="self-start sm:self-auto">
            {t("workforce.wage.use_minimum")}
          </Button>
        </div>
      ) : null}

      <SwitchField
        id={`${idPrefix}-ssf`}
        label={t("term.ssf")}
        description={t("workforce.wage.ssf_hint")}
        checked={!!values.ssf_enrolled}
        onCheckedChange={(v) => set("ssf_enrolled", v)}
      />
    </div>
  );
}
