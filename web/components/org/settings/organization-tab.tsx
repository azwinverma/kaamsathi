"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useOrg, useUpdateOrg } from "@/lib/api/hooks/org";
import type { Industry, Organization } from "@/lib/api/types";
import { handleFormError, zPhone } from "@/lib/forms";
import { toLatinDigits } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { SwitchField } from "@/components/ui/checkbox";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { DistrictSelect } from "@/components/shared/selects";

const INDUSTRIES: Industry[] = [
  "hospitality",
  "healthcare",
  "security",
  "construction",
  "manufacturing",
  "retail",
  "other",
];
const FIELDS = [
  "name",
  "name_ne",
  "pan_no",
  "vat_registered",
  "ssf_employer_no",
  "industry",
  "district",
  "municipality",
  "ward",
  "address",
  "phone",
  "email",
  "weekly_off_day",
] as const;

function districtCode(d: Organization["district"]): string {
  if (!d) return "";
  return typeof d === "string" ? d : d.code;
}

export function OrganizationTab() {
  const { data, isLoading, error, refetch } = useOrg();
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) {
    return (
      <Card className="space-y-5 p-5 sm:p-6" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </Card>
    );
  }
  return <OrganizationForm org={data} />;
}

function OrganizationForm({ org }: { org: Organization }) {
  const t = useTranslations();
  const f = useFormat();
  const { isAdmin } = useSession();
  const update = useUpdateOrg();
  const [formError, setFormError] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t("errors.required")),
        name_ne: z.string().trim(),
        pan_no: z
          .string()
          .transform((v) => toLatinDigits(v).trim())
          .refine((v) => v === "" || /^\d{9}$/.test(v), t("settings.pan_invalid")),
        vat_registered: z.boolean(),
        ssf_employer_no: z.string().transform((v) => toLatinDigits(v).trim()),
        industry: z.enum(INDUSTRIES as [Industry, ...Industry[]], { message: t("errors.required") }),
        district: z.string().min(1, t("errors.required")),
        municipality: z.string().trim(),
        ward: z
          .string()
          .transform((v) => toLatinDigits(v).trim())
          .refine(
            (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 35),
            t("settings.ward_invalid"),
          ),
        address: z.string().trim().min(2, t("errors.required")),
        phone: zPhone(t("errors.invalid_phone")),
        email: z.union([z.literal(""), z.string().trim().email(t("settings.email_invalid"))]),
        weekly_off_day: z.string(),
      }),
    [t],
  );
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const defaults = React.useCallback(
    (o: Organization): FormIn => ({
      name: o.name ?? "",
      name_ne: o.name_ne ?? "",
      pan_no: o.pan_no ?? "",
      vat_registered: !!o.vat_registered,
      ssf_employer_no: o.ssf_employer_no ?? "",
      industry: o.industry,
      district: districtCode(o.district),
      municipality: o.municipality ?? "",
      ward: o.ward ? String(o.ward) : "",
      address: o.address ?? "",
      phone: o.phone ?? "",
      email: o.email ?? "",
      weekly_off_day: String(o.weekly_off_day ?? 6),
    }),
    [],
  );

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: defaults(org),
  });
  const { register, control, handleSubmit, formState, reset } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(
      {
        name: v.name,
        name_ne: v.name_ne || null,
        pan_no: v.pan_no || null,
        vat_registered: v.vat_registered,
        ssf_employer_no: v.ssf_employer_no || null,
        industry: v.industry,
        district: v.district,
        municipality: v.municipality || null,
        ward: v.ward ? Number(v.ward) : null,
        address: v.address,
        phone: v.phone,
        email: v.email || null,
        weekly_off_day: Number(v.weekly_off_day),
      },
      {
        onSuccess: (saved) => {
          reset(defaults(saved));
          toast.success(t("common.changes_saved"));
        },
        onError: (err) => setFormError(handleFormError(err, form.setError, t, { fields: FIELDS, toast: false })),
      },
    );
  });

  const opt = { optional: true, optionalLabel: t("common.optional") };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {!isAdmin ? (
        <p className="flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("settings.org_readonly")}
        </p>
      ) : null}
      <fieldset disabled={!isAdmin} className="min-w-0 space-y-6">
        <Card>
          <div className="space-y-5 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-fg">{t("settings.section_business")}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="org-name" label={t("settings.org_name")} error={errors.name?.message}>
                <Input autoComplete="organization" {...register("name")} />
              </Field>
              <Field id="org-name-ne" label={t("settings.org_name_ne")} error={errors.name_ne?.message} {...opt}>
                <Input lang="ne" className="font-nepali" {...register("name_ne")} />
              </Field>
              <Field id="org-industry" label={t("settings.industry")} error={errors.industry?.message}>
                <Controller
                  control={control}
                  name="industry"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!isAdmin}
                      options={INDUSTRIES.map((i) => ({ value: i, label: t(`industry.${i}`) }))}
                    />
                  )}
                />
              </Field>
              <Field
                id="org-weekly-off"
                label={t("term.weekly_off")}
                hint={t("settings.weekly_off_hint")}
                error={errors.weekly_off_day?.message}
              >
                <Controller
                  control={control}
                  name="weekly_off_day"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!isAdmin}
                      options={Array.from({ length: 7 }, (_, i) => ({ value: String(i), label: f.weekday(i, true) }))}
                    />
                  )}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-fg">{t("settings.section_tax")}</h2>
              <p className="text-sm text-fg-muted">{t("settings.section_tax_hint")}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="org-pan" label={t("term.pan")} error={errors.pan_no?.message} hint={t("settings.pan_hint")} {...opt}>
                <Input inputMode="numeric" maxLength={9} className="tabular" {...register("pan_no")} />
              </Field>
              <Field id="org-ssf" label={t("settings.ssf_employer_no")} error={errors.ssf_employer_no?.message} {...opt}>
                <Input className="tabular" {...register("ssf_employer_no")} />
              </Field>
            </div>
            <Controller
              control={control}
              name="vat_registered"
              render={({ field }) => (
                <SwitchField
                  id="org-vat"
                  label={t("settings.vat_registered")}
                  description={t("settings.vat_hint")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!isAdmin}
                />
              )}
            />
          </div>
        </Card>

        <Card>
          <div className="space-y-5 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-fg">{t("settings.section_location")}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="org-district" label={t("term.district")} error={errors.district?.message}>
                <Controller
                  control={control}
                  name="district"
                  render={({ field }) => <DistrictSelect value={field.value} onChange={field.onChange} />}
                />
              </Field>
              <Field id="org-municipality" label={t("term.municipality")} error={errors.municipality?.message} {...opt}>
                <Input autoComplete="address-level2" {...register("municipality")} />
              </Field>
              <Field id="org-ward" label={t("term.ward")} error={errors.ward?.message} {...opt}>
                <Input inputMode="numeric" maxLength={2} className="tabular sm:max-w-32" {...register("ward")} />
              </Field>
            </div>
            <Field id="org-address" label={t("term.address")} error={errors.address?.message}>
              <Textarea rows={2} autoComplete="street-address" {...register("address")} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="space-y-5 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-fg">{t("settings.section_contact")}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="org-phone" label={t("term.phone")} error={errors.phone?.message}>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => <PhoneInput value={field.value} onChange={field.onChange} name="phone" />}
                />
              </Field>
              <Field id="org-email" label={t("term.email")} error={errors.email?.message} {...opt}>
                <Input type="email" autoComplete="email" {...register("email")} />
              </Field>
            </div>
          </div>
          {isAdmin ? (
            <CardFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => reset(defaults(org))}
                disabled={!formState.isDirty || update.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
                {t("common.save_changes")}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </fieldset>
      <FormError message={formError} />
    </form>
  );
}
