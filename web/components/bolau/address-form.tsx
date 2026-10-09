"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { DistrictSelect } from "@/components/shared/selects";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { errorMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useSaveAddress } from "@/lib/api/hooks/bolau";
import { isApiError } from "@/lib/api/errors";
import type { Address, AddressInput, AddressLabel } from "@/lib/api/types-bolau";

/** "House 14, Jhamsikhel Marg, Ward 3, Lalitpur Metropolitan City" */
export function addressText(a: Pick<Address, "line" | "ward" | "municipality" | "district"> | null | undefined, locale: string, wardWord = "Ward") {
  if (!a) return "";
  const district =
    a.district && typeof a.district === "object"
      ? (locale === "ne" ? a.district.name_ne || a.district.name_en : a.district.name_en) ?? ""
      : "";
  return [a.line, a.ward ? `${wardWord} ${a.ward}` : null, a.municipality, district].filter(Boolean).join(", ");
}

export function AddressForm({
  initial,
  onSaved,
  onCancel,
  idPrefix = "addr",
}: {
  initial?: Address | null;
  onSaved: (a: Address) => void;
  onCancel?: () => void;
  idPrefix?: string;
}) {
  const t = useTranslations("bolau.address");
  const tAll = useTranslations();
  const save = useSaveAddress();
  const districtCode =
    initial?.district && typeof initial.district === "object" ? initial.district.code : ((initial?.district as string) ?? "");
  const [v, setV] = React.useState<AddressInput>({
    label: initial?.label ?? "home",
    line: initial?.line ?? "",
    ward: initial?.ward ?? "",
    municipality: initial?.municipality ?? "",
    district: districtCode,
    landmark: initial?.landmark ?? "",
    is_default: initial?.is_default ?? false,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const id = (k: string) => `${idPrefix}-${k}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const req: Record<string, string> = {};
    if (!v.line.trim()) req.line = t("required");
    if (!v.municipality.trim()) req.municipality = t("required");
    if (!v.district) req.district = t("required");
    setErrors(req);
    setFormError(null);
    if (Object.keys(req).length) return;
    const ward = String(v.ward ?? "").replace(/\D/g, "");
    save.mutate(
      { ...v, ward: ward ? Number(ward) : null, id: initial?.id },
      {
        onSuccess: (a) => onSaved(a),
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fields).length) {
            setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, m]) => [k, m[0]])));
          } else setFormError(errorMessage(err, tAll));
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Segmented<AddressLabel>
        label={t("label")}
        value={v.label}
        onChange={(label) => setV({ ...v, label })}
        options={(["home", "office", "other"] as const).map((l) => ({ value: l, label: t(`label_${l}`) }))}
      />
      <Field id={id("line")} label={t("line")} error={errors.line}>
        <Input
          value={v.line}
          onChange={(e) => setV({ ...v, line: e.target.value })}
          placeholder={t("line_placeholder")}
          autoComplete="street-address"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <Field id={id("ward")} label={t("ward")} error={errors.ward}>
          <Input
            inputMode="numeric"
            value={String(v.ward ?? "")}
            onChange={(e) => setV({ ...v, ward: e.target.value.replace(/\D/g, "").slice(0, 2) })}
          />
        </Field>
        <Field id={id("municipality")} label={t("municipality")} error={errors.municipality}>
          <Input
            value={v.municipality}
            onChange={(e) => setV({ ...v, municipality: e.target.value })}
            placeholder={t("municipality_placeholder")}
          />
        </Field>
      </div>
      <Field id={id("district")} label={t("district")} error={errors.district}>
        <DistrictSelect value={v.district} onChange={(district) => setV({ ...v, district })} />
      </Field>
      <Field id={id("landmark")} label={t("landmark")} optional optionalLabel={tAll("common.optional")}>
        <Input
          value={v.landmark ?? ""}
          onChange={(e) => setV({ ...v, landmark: e.target.value })}
          placeholder={t("landmark_placeholder")}
        />
      </Field>
      <label className="flex items-center gap-2.5 text-sm" htmlFor={id("default")}>
        <Checkbox id={id("default")} checked={!!v.is_default} onCheckedChange={(c) => setV({ ...v, is_default: c === true })} />
        {t("default")}
      </label>
      <FormError message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.isPending}>
          {t("save")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tAll("common.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
