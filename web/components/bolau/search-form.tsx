"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { DistrictSelect } from "@/components/shared/selects";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, PrefixInput } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { addDays, adToBs, formatBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { SEARCH_LANGS, TIME_BANDS, activeFilterCount, searchHref, type SearchValues } from "@/lib/bolau/search";
import { TradeIcon } from "./trade-icon";
import { track } from "@/lib/telemetry";
import { startNavProgress } from "@/lib/nav-progress";

export type { SearchValues };

function Chip({
  name,
  value,
  checked,
  onChange,
  onReselect,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  /** Clicking the chip that is already picked (radios don't fire onChange then). */
  onReselect?: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border-2 px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors select-none",
        "has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
        checked
          ? "border-on-accent bg-yellow text-on-accent"
          : "border-border-strong bg-surface text-fg hover:border-fg hover:bg-surface-hover",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        onClick={() => (checked ? onReselect?.() : undefined)}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/**
 * Bolau search on the mural hero (shared by `/` and `/bolau`, see BolauHero). A solid "paper" panel
 * with a yellow offset edge, so the form never sits on the gradient. Plain GET form to /bolau (works
 * without JS).
 *
 * - `hero` (home): "What needs doing?" trade chips with icons, area, day, and one big Bolau button.
 *   Nothing navigates until Bolau is pressed.
 * - `full` (/bolau): adds the free-text box and "More filters"; chips and selects search at once.
 */
export function BolauSearchForm({
  trades,
  initial,
  variant = "full",
  maxTrades,
}: {
  trades: { code: string; name_en: string; name_ne: string }[];
  initial: SearchValues;
  variant?: "hero" | "full";
  maxTrades?: number;
}) {
  const t = useTranslations("bolau.search");
  const tc = useTranslations("common");
  const tl = useTranslations("bolau.lang");
  const f = useFormat();
  const router = useRouter();
  const [v, setV] = React.useState<SearchValues>(initial);
  React.useEffect(() => setV(initial), [initial]);
  const full = variant === "full";
  // Pending until the new results have rendered (the page re-renders on the server).
  const [searching, startSearch] = React.useTransition();

  // Chips and selects on /bolau refresh the results in place; the Bolau button (submit) always
  // jumps to #results, otherwise on /bolau the update happens below the fold and looks like nothing.
  const go = (next: SearchValues, jump = !full) => {
    // Never the free-text query: only the trade code and how many filters are set.
    track("search_performed", { source: "bolau", trade: next.trade || null, count: activeFilterCount(next) });
    const href = searchHref(next);
    if (href.split("#")[0] === window.location.pathname + window.location.search) {
      // Same search again: nothing to load, just show the results.
      if (jump) document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    startNavProgress();
    startSearch(() => router.push(href, { scroll: jump }));
  };
  const set = (k: keyof SearchValues, val: string, submit = false) => {
    const next = { ...v, [k]: val };
    setV(next);
    if (submit && full) go(next);
  };

  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const dayLabel = (iso: string, i: number) => {
    const bs = formatBs(adToBs(iso), f.locale).split(" ").slice(0, 2).join(" ");
    if (i === 0) return `${t("today")} · ${bs}`;
    if (i === 1) return `${t("tomorrow")} · ${bs}`;
    const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return `${f.weekday(wd)} · ${bs}`;
  };
  const filters = activeFilterCount(v);
  const shown = trades.slice(0, maxTrades ?? (full ? 10 : 8));

  return (
    <form
      action="/bolau"
      method="get"
      role="search"
      aria-label={full ? t("form_label") : t("hero_form_label")}
      aria-busy={searching || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        go(v, true);
      }}
      className="bg-surface text-fg space-y-5 rounded-card p-4 shadow-[6px_8px_0_0_var(--color-yellow)] sm:p-6"
    >
      {full ? (
        <div className="relative">
          <label htmlFor="bolau-q" className="sr-only">
            {t("q_label")}
          </label>
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
      ) : null}

      <fieldset>
        <legend className={cn("text-fg mb-3 font-extrabold", full ? "text-base" : "text-lg sm:text-xl")}>
          {t("what_label")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {full ? (
            <Chip name="trade" value="" checked={!v.trade} onChange={(x) => set("trade", x, true)}>
              {t("any_trade")}
            </Chip>
          ) : null}
          {shown.map((tr) => (
            <Chip
              key={tr.code}
              name="trade"
              value={tr.code}
              checked={v.trade === tr.code}
              onChange={(x) => set("trade", x, true)}
              onReselect={full ? undefined : () => set("trade", "")}
            >
              <TradeIcon code={tr.code} className="size-[18px] shrink-0" />
              {f.name(tr)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="bolau-district" className="text-fg text-sm font-bold">
            {t("where_label")}
          </label>
          <DistrictSelect
            id="bolau-district"
            value={v.district ?? ""}
            onChange={(x) => set("district", x, true)}
            placeholder={t("district_any")}
          />
          <input type="hidden" name="district" value={v.district ?? ""} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="bolau-date" className="text-fg text-sm font-bold">
            {t("when_label")}
          </label>
          <NativeSelect
            id="bolau-date"
            name="date"
            value={v.date ?? ""}
            onChange={(e) => set("date", e.target.value, true)}
            placeholder={t("date_any")}
            options={days.map((d, i) => ({ value: d, label: dayLabel(d, i) }))}
            suppressHydrationWarning
          />
        </div>
        <button
          type="submit"
          className="bg-yellow text-on-accent border-on-accent col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-control border-2 px-7 text-lg font-extrabold sm:col-span-1 transition-[filter,transform] hover:brightness-95 active:translate-y-px aria-busy:cursor-progress"
          aria-busy={searching || undefined}
        >
          {searching ? tc("searching") : t("bolau")}
          {searching ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-5" aria-hidden />
          )}
        </button>
      </div>

      {full ? (
        <details className="group" open={filters > 0 ? true : undefined}>
          <summary className="text-fg inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-control text-sm font-semibold underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("filters")}
            {filters ? (
              <span className="bg-yellow text-on-accent rounded-pill px-2 py-0.5 text-xs">
                {t("filters_active", { count: filters })}
              </span>
            ) : null}
          </summary>
          <div className="border-border mt-3 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  go({}, false);
                }}
              >
                {t("clear")}
              </button>
            </div>
          </div>
        </details>
      ) : null}
    </form>
  );
}
