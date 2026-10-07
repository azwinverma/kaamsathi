"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { NativeSelect, Select } from "@/components/ui/select";
import { useDistricts, useProvinces, useTrades } from "@/lib/api/hooks/ref";
import { useSites } from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import { useFormat } from "@/lib/use-format";

type Aria = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-label"?: string };

export function TradeSelect({
  value,
  onChange,
  placeholder,
  allowEmpty,
  ...aria
}: { value: string; onChange: (v: string) => void; placeholder?: string; allowEmpty?: boolean } & Aria) {
  const t = useTranslations("common");
  const f = useFormat();
  const { data, isLoading } = useTrades();
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      placeholder={placeholder ?? (allowEmpty ? t("all") : t("select"))}
      options={(data ?? []).map((tr) => ({ value: tr.code, label: f.name(tr) }))}
      {...aria}
    />
  );
}

export function ProvinceSelect({
  value,
  onChange,
  ...aria
}: { value: string; onChange: (v: string) => void } & Aria) {
  const t = useTranslations("common");
  const f = useFormat();
  const { data, isLoading } = useProvinces();
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      placeholder={t("select")}
      options={(data ?? []).map((p) => ({ value: String(p.code), label: f.name(p) }))}
      {...aria}
    />
  );
}

/** District select, optionally narrowed to a province. */
export function DistrictSelect({
  value,
  onChange,
  province,
  placeholder,
  ...aria
}: { value: string; onChange: (v: string) => void; province?: string | number | null; placeholder?: string } & Aria) {
  const t = useTranslations("common");
  const f = useFormat();
  const { data, isLoading } = useDistricts(province || undefined);
  const options = React.useMemo(
    () =>
      [...(data ?? [])]
        .sort((a, b) => f.name(a).localeCompare(f.name(b)))
        .map((d) => ({ value: d.code, label: f.name(d) })),
    [data, f],
  );
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      placeholder={placeholder ?? t("select")}
      options={options}
      {...aria}
    />
  );
}

/** Work-site filter/select. Empty string = all / none. */
export function SiteSelect({
  value,
  onChange,
  allLabel,
  className,
  ...aria
}: { value: string; onChange: (v: string) => void; allLabel?: string; className?: string } & Aria) {
  const t = useTranslations("common");
  const { data, isLoading } = useSites();
  const sites = listResults(data);
  return (
    <Select
      value={value}
      onValueChange={onChange}
      allowEmpty
      emptyLabel={allLabel ?? t("all")}
      placeholder={allLabel ?? t("all")}
      disabled={isLoading}
      className={className}
      options={sites.map((s) => ({ value: s.id, label: s.name }))}
      {...aria}
    />
  );
}
