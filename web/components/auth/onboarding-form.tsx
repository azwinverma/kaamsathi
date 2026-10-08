"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Factory,
  HardHat,
  HeartPulse,
  Hotel,
  ShieldCheck,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { useCreateOrg } from "@/lib/api/hooks/org";
import { useMe } from "@/lib/api/hooks/auth";
import { qk } from "@/lib/api/keys";
import type { Industry } from "@/lib/api/types";
import { handleFormError, zPhone } from "@/lib/forms";
import { toLatinDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DistrictSelect, ProvinceSelect } from "@/components/shared/selects";

const INDUSTRIES: { value: Industry; icon: LucideIcon }[] = [
  { value: "hospitality", icon: Hotel },
  { value: "construction", icon: HardHat },
  { value: "security", icon: ShieldCheck },
  { value: "healthcare", icon: HeartPulse },
  { value: "manufacturing", icon: Factory },
  { value: "retail", icon: ShoppingBag },
  { value: "other", icon: Building2 },
];

const FIELDS = ["name", "pan_no", "industry", "district", "municipality", "ward", "address", "phone", "email"] as const;

export function OnboardingForm() {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const createOrg = useCreateOrg();
  const [formError, setFormError] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t("errors.required")),
        pan_no: z
          .string()
          .transform((v) => toLatinDigits(v).trim())
          .refine((v) => v === "" || /^\d{9}$/.test(v), t("onboarding.pan_invalid")),
        industry: z.enum(["hospitality", "healthcare", "security", "construction", "manufacturing", "retail", "other"], {
          message: t("errors.required"),
        }),
        province: z.string().min(1, t("errors.required")),
        district: z.string().min(1, t("errors.required")),
        municipality: z.string().trim().min(1, t("errors.required")),
        ward: z
          .string()
          .transform((v) => toLatinDigits(v).trim())
          .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 35), t("onboarding.ward_invalid")),
        address: z.string().trim().min(2, t("errors.required")),
        phone: zPhone(t("errors.invalid_phone")),
        email: z.union([z.literal(""), z.string().trim().email(t("onboarding.email_invalid"))]),
      }),
    [t],
  );
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      pan_no: "",
      industry: undefined,
      province: "",
      district: "",
      municipality: "",
      ward: "",
      address: "",
      phone: "",
      email: "",
    },
  });
  const { register, handleSubmit, control, formState, setValue, watch } = form;
  const errors = formState.errors;
  const province = watch("province");

  React.useEffect(() => {
    if (me?.phone && !form.getValues("phone")) setValue("phone", me.phone);
  }, [me, setValue, form]);

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    createOrg.mutate(
      {
        name: v.name,
        pan_no: v.pan_no || undefined,
        industry: v.industry,
        district: v.district,
        municipality: v.municipality,
        ward: v.ward ? Number(v.ward) : null,
        address: v.address,
        phone: v.phone,
        email: v.email || undefined,
      },
      {
        onSuccess: async (org) => {
          await fetch("/api/auth/org", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ org_id: org.id }),
          });
          await qc.invalidateQueries({ queryKey: qk.me });
          qc.removeQueries({ queryKey: ["org"] });
          toast.success(t("onboarding.created", { name: org.name }));
          router.replace("/app");
        },
        onError: (err) => {
          setFormError(handleFormError(err, form.setError, t, { fields: FIELDS, toast: false }));
        },
      },
    );
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-brand-text">{t("onboarding.step")}</p>
        <h1 className="text-3xl font-semibold">{t("onboarding.title")}</h1>
        <p className="max-w-xl text-fg-muted">{t("onboarding.subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base font-semibold">{t("onboarding.section_business")}</h2>
          <Field id="name" label={t("onboarding.org_name")} error={errors.name?.message} hint={t("onboarding.org_name_hint")}>
            <Input autoComplete="organization" {...register("name")} />
          </Field>
          <Field
            id="pan_no"
            label={t("term.pan")}
            optional
            optionalLabel={t("common.optional")}
            error={errors.pan_no?.message}
            hint={t("onboarding.pan_hint")}
          >
            <Input inputMode="numeric" maxLength={9} className="tabular sm:max-w-60" {...register("pan_no")} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg">{t("onboarding.industry")}</legend>
            <Controller
              control={control}
              name="industry"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-invalid={!!errors.industry || undefined}>
                  {INDUSTRIES.map(({ value, icon: Icon }) => {
                    const checked = field.value === value;
                    return (
                      <label
                        key={value}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                          checked
                            ? "border-brand bg-brand-subtle text-brand-subtle-fg"
                            : "border-border bg-surface text-fg-body hover:border-border-strong",
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={value}
                          checked={checked}
                          onChange={() => field.onChange(value)}
                          className="sr-only"
                        />
                        <Icon className={cn("size-4 shrink-0", checked ? "text-brand-text" : "text-fg-muted")} aria-hidden />
                        {t(`industry.${value}`)}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.industry ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                {errors.industry.message}
              </p>
            ) : null}
          </fieldset>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base font-semibold">{t("onboarding.section_location")}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="province" label={t("term.province")} error={errors.province?.message}>
              <Controller
                control={control}
                name="province"
                render={({ field }) => (
                  <ProvinceSelect
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      setValue("district", "");
                    }}
                  />
                )}
              />
            </Field>
            <Field id="district" label={t("term.district")} error={errors.district?.message}>
              <Controller
                control={control}
                name="district"
                render={({ field }) => (
                  <DistrictSelect
                    value={field.value}
                    onChange={field.onChange}
                    province={province || null}
                    placeholder={province ? undefined : t("onboarding.pick_province_first")}
                  />
                )}
              />
            </Field>
            <Field id="municipality" label={t("term.municipality")} error={errors.municipality?.message}>
              <Input autoComplete="address-level2" {...register("municipality")} />
            </Field>
            <Field id="ward" label={t("term.ward")} optional optionalLabel={t("common.optional")} error={errors.ward?.message}>
              <Input inputMode="numeric" maxLength={2} className="tabular sm:max-w-32" {...register("ward")} />
            </Field>
          </div>
          <Field id="address" label={t("term.address")} error={errors.address?.message} hint={t("onboarding.address_hint")}>
            <Textarea rows={2} autoComplete="street-address" {...register("address")} />
          </Field>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base font-semibold">{t("onboarding.section_contact")}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="phone" label={t("term.phone")} error={errors.phone?.message}>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => <PhoneInput value={field.value} onChange={field.onChange} name="phone" />}
              />
            </Field>
            <Field id="email" label={t("term.email")} optional optionalLabel={t("common.optional")} error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...register("email")} />
            </Field>
          </div>
        </Card>

        <FormError message={formError} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-muted">{t("onboarding.footnote")}</p>
          <Button type="submit" size="lg" loading={createOrg.isPending}>
            {t("onboarding.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
