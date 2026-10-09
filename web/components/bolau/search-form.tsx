"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, SlidersHorizontal } from "lucide-react";
import { DistrictSelect } from "@/components/shared/selects";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, PrefixInput } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { addDays, adToBs, formatBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SEARCH_LANGS, TIME_BANDS, activeFilterCount, searchHref, type SearchValues } from "@/lib/bolau/search";

export type { SearchValues };

function Chip({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-10 cursor-pointer items-center rounded-pill border-2 px-3.5 text-sm font-semibold whitespace-nowrap transition-colors select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
        checked ? "border-yellow bg-yellow text-on-accent" : "border-white/70 text-hero-fg hover:bg-white/10",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/**
 * Bolau search, sitting on the mural hero. A plain GET form (works without JS); with JS, trade and
 * day chips search immediately. Filters live in a disclosure so the first view stays calm.
 */
export function BolauSearchForm({
  trades,
  initial,
}: {
  trades: { code: string; name_en: string; name_ne: string }[];
  initial: SearchValues;
}) {
  const t = useTranslations("bolau.search");
  const tl = useTranslations("bolau.lang");
  const f = useFormat();
  const router = useRouter();
  const [v, setV] = React.useState<SearchValues>(initial);
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => setV(initial), [initial]);

  const set = (k: keyof SearchValues, val: string, submit = false) => {
    const next = { ...v, [k]: val };
    setV(next);
    if (submit) router.push(searchHref(next), { scroll: false });
  };

  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const dayLabel = (iso: string, i: number) => {
    if (i === 0) return f.locale === "ne" ? "आज" : "Today";
    if (i === 1) return f.locale === "ne" ? "भोलि" : "Tomorrow";
    const bs = formatBs(adToBs(iso), f.locale).split(" ").slice(0, 2).join(" ");
    const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return `${f.weekday(wd)} ${bs}`;
  };
  const filters = activeFilterCount(v);

  return (
    <form
      ref={formRef}
      action="/bolau"
      method="get"
      role="search"
      aria-label={t("form_label")}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(searchHref(v), { scroll: false });
      }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="bolau-q" className="sr-only">
          {t("q_label")}
        </label>
        <div className="relative flex-1">
          <Search className="text-fg-muted pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" aria-hidden />
          <Input
            id="bolau-q"
            name="q"
            value={v.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
            placeholder={t("q_placeholder")}
            className="h-12 rounded-control pl-11 text-base shadow-none"
            enterKeyHint="search"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="bg-yellow text-on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 text-base font-bold hover:brightness-95"
        >
          {t("submit")}
        </button>
      </div>

      <fieldset>
        <legend className="text-hero-fg mb-2 text-sm font-semibold">{t("trade_label")}</legend>
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          <Chip name="trade" value="" checked={!v.trade} onChange={(x) => set("trade", x, true)}>
            {t("any_trade")}
          </Chip>
          {trades.slice(0, 10).map((tr) => (
            <Chip key={tr.code} name="trade" value={tr.code} checked={v.trade === tr.code} onChange={(x) => set("trade", x, true)}>
              {f.name(tr)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bolau-district" className="text-hero-fg text-sm font-semibold">
            {t("district_label")}
          </label>
          <DistrictSelect
            id="bolau-district"
            value={v.district ?? ""}
            onChange={(x) => set("district", x, true)}
            placeholder={t("district_any")}
          />
          <input type="hidden" name="district" value={v.district ?? ""} />
        </div>
        <fieldset className="min-w-0">
          <legend className="text-hero-fg mb-2 text-sm font-semibold">{t("date_label")}</legend>
          <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Chip name="date" value="" checked={!v.date} onChange={(x) => set("date", x, true)}>
              {t("date_any")}
            </Chip>
            {days.map((d, i) => (
              <Chip key={d} name="date" value={d} checked={v.date === d} onChange={(x) => set("date", x, true)}>
                {dayLabel(d, i)}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <details className="group text-hero-fg" open={filters > 0 ? true : undefined}>
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-control text-sm font-semibold underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("filters")}
          {filters ? <span className="bg-yellow text-on-accent rounded-pill px-2 py-0.5 text-xs">{t("filters_active", { count: filters })}</span> : null}
        </summary>
        <div className="bg-surface text-fg mt-3 grid gap-4 rounded-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bolau-time" className="text-sm font-medium">
              {t("time_label")}
            </label>
            <NativeSelect
              id="bolau-time"
              name="time"
              value={v.time ?? ""}
              onChange={(e) => set("time", e.target.value)}
              placeholder={t("time_any")}
              options={TIME_BANDS.map((b) => ({ value: b.value, label: t(b.key) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bolau-max" className="text-sm font-medium">
              {t("max_price")}
            </label>
            <PrefixInput
              id="bolau-max"
              name="max_price"
              prefix={f.locale === "ne" ? "रु." : "Rs."}
              inputMode="numeric"
              value={v.max_price ?? ""}
              onChange={(e) => set("max_price", e.target.value.replace(/\D/g, ""))}
              aria-describedby="bolau-max-hint"
            />
            <p id="bolau-max-hint" className="text-fg-muted text-xs">
              {t("max_price_hint")}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bolau-rating" className="text-sm font-medium">
              {t("min_rating")}
            </label>
            <NativeSelect
              id="bolau-rating"
              name="min_rating"
              value={v.min_rating ?? ""}
              onChange={(e) => set("min_rating", e.target.value)}
              placeholder={t("rating_any")}
              options={[
                { value: "4", label: t("rating_4") },
                { value: "4.5", label: t("rating_45") },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bolau-lang" className="text-sm font-medium">
              {t("language")}
            </label>
            <NativeSelect
              id="bolau-lang"
              name="language"
              value={v.language ?? ""}
              onChange={(e) => set("language", e.target.value)}
              placeholder={t("language_any")}
              options={SEARCH_LANGS.map((l) => ({ value: l, label: tl(l) }))}
            />
          </div>
          <div className="flex items-start gap-2.5 sm:pt-7">
            <Checkbox
              id="bolau-instant"
              checked={v.instant === "1"}
              onCheckedChange={(c) => set("instant", c === true ? "1" : "")}
              aria-describedby="bolau-instant-hint"
            />
            {v.instant === "1" ? <input type="hidden" name="instant" value="1" /> : null}
            <div>
              <label htmlFor="bolau-instant" className="text-sm font-medium">
                {t("instant")}
              </label>
              <p id="bolau-instant-hint" className="text-fg-muted text-xs">
                {t("instant_hint")}
              </p>
            </div>
          </div>
          <fieldset className="sm:col-span-2 lg:col-span-1">
            <legend className="mb-1.5 text-sm font-medium">{t("gender")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(["", "female", "male"] as const).map((g) => (
                <label key={g || "any"} className="inline-flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={(v.gender ?? "") === g}
                    onChange={() => set("gender", g)}
                    className="accent-brand size-4"
                  />
                  {g === "" ? t("gender_any") : g === "female" ? t("gender_female") : t("gender_male")}
                </label>
              ))}
            </div>
            <p className="text-fg-muted mt-1 text-xs">{t("gender_hint")}</p>
          </fieldset>
          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="bg-brand text-brand-fg hover:bg-brand-hover inline-flex min-h-11 items-center rounded-control px-5 text-sm font-semibold"
            >
              {t("submit")}
            </button>
            <button
              type="button"
              className="text-fg-body min-h-11 px-2 text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => {
                setV({});
                router.push("/bolau#results", { scroll: false });
              }}
            >
              {t("clear")}
            </button>
          </div>
        </div>
      </details>
    </form>
  );
}
