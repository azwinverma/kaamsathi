"use client";
import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import {
  adToBs,
  bsMonthLength,
  bsToAd,
  todayIso,
  weekdayOf,
  parseIsoDate,
  type YMD,
} from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { inputClass } from "./input";
import { Tooltip } from "./tooltip";

/** BS date with AD in muted text (DESIGN.md: BS first, AD secondary). */
export function DateText({
  ad,
  bs,
  inline = false,
  className,
}: {
  ad: string | null | undefined;
  bs?: string | null;
  inline?: boolean;
  className?: string;
}) {
  const f = useFormat();
  if (!ad) return <span className={cn("text-fg-muted", className)}>—</span>;
  const d = f.date(ad, bs);
  if (inline) {
    return (
      <Tooltip content={d.ad}>
        <span className={cn("whitespace-nowrap tabular", className)}>
          <time dateTime={ad}>{d.bs}</time>
        </span>
      </Tooltip>
    );
  }
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      <time dateTime={ad} className="whitespace-nowrap text-fg tabular">
        {d.bs}
      </time>
      <span className="text-xs whitespace-nowrap text-fg-muted tabular">{d.ad}</span>
    </span>
  );
}

export function Money({
  value,
  className,
  compact,
  muted,
}: {
  value: string | number | null | undefined;
  className?: string;
  compact?: boolean;
  muted?: boolean;
}) {
  const f = useFormat();
  return (
    <span className={cn("whitespace-nowrap tabular", muted && "text-fg-muted", className)}>
      {f.money(value, { compact })}
    </span>
  );
}

// ---------------------------------------------------------------------------

function firstWeekday(y: number, m: number): number {
  const ad = bsToAd({ year: y, month: m, day: 1 });
  return ad ? weekdayOf(ad) : 0;
}

/** BS calendar grid. Value in AD ISO. */
export function BsCalendar({
  value,
  onSelect,
  min,
  max,
  initialMonth,
}: {
  value?: string | null;
  onSelect: (adIso: string) => void;
  min?: string;
  max?: string;
  initialMonth?: { year: number; month: number };
}) {
  const t = useTranslations("common");
  const f = useFormat();
  const today = todayIso();
  const selectedBs = value ? adToBs(value) : null;
  const start = initialMonth ?? selectedBs ?? adToBs(today)!;
  const [view, setView] = React.useState({ year: start.year, month: start.month });
  const len = bsMonthLength(view.year, view.month);
  const offset = firstWeekday(view.year, view.month);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: len }, (_, i) => i + 1),
  ];
  const shift = (delta: number) => {
    setView((v) => {
      let m = v.month + delta;
      let y = v.year;
      if (m < 1) {
        m = 12;
        y--;
      } else if (m > 12) {
        m = 1;
        y++;
      }
      return { year: y, month: m };
    });
  };
  const firstAd = bsToAd({ year: view.year, month: view.month, day: 1 });
  const lastAd = bsToAd({ year: view.year, month: view.month, day: len });

  return (
    <div className="w-[300px] select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover"
          aria-label={t("prev_month")}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-fg" aria-live="polite">
            {f.bsMonth(view.year, view.month)}
          </p>
          <p className="text-[11px] text-fg-muted tabular">
            {f.ad(firstAd)} – {f.ad(lastAd)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover"
          aria-label={t("next_month")}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center" role="grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={cn("py-1 text-[11px] font-medium text-fg-muted", i === 6 && "text-danger")}
            role="columnheader"
          >
            {f.weekday(i)}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const ad = bsToAd({ year: view.year, month: view.month, day: d })!;
          const disabled = (min && ad < min) || (max && ad > max);
          const isSel = value === ad;
          const isToday = ad === today;
          const adDay = parseIsoDate(ad)?.day;
          return (
            <button
              key={d}
              type="button"
              disabled={!!disabled}
              onClick={() => onSelect(ad)}
              aria-pressed={isSel}
              aria-label={`${f.bs({ year: view.year, month: view.month, day: d })} (${f.ad(ad)})`}
              className={cn(
                "flex h-10 flex-col items-center justify-center rounded-md text-sm tabular transition-colors disabled:opacity-30",
                isSel ? "bg-brand text-brand-fg" : "text-fg hover:bg-surface-hover",
                !isSel && isToday && "ring-1 ring-brand ring-inset",
                !isSel && i % 7 === 6 && "text-danger",
              )}
            >
              <span className="leading-none font-medium">{f.digits(d)}</span>
              <span className={cn("mt-0.5 text-[9px] leading-none", isSel ? "opacity-80" : "text-fg-subtle")}>
                {adDay}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end border-t border-border pt-2">
        <button
          type="button"
          className="rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand-subtle"
          onClick={() => onSelect(today)}
        >
          {t("today")}
        </button>
      </div>
    </div>
  );
}

/** Date input: shows BS (with AD), picks in a BS calendar. Value/onChange use AD ISO strings. */
export const BsDatePicker = React.forwardRef<
  HTMLButtonElement,
  {
    id?: string;
    value?: string | null;
    onChange: (adIso: string) => void;
    min?: string;
    max?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    "aria-label"?: string;
  }
>(({ id, value, onChange, min, max, placeholder, disabled, className, ...aria }, ref) => {
  const [open, setOpen] = React.useState(false);
  const f = useFormat();
  const t = useTranslations("common");
  const d = value ? f.date(value) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          className={cn(inputClass, "flex items-center gap-2 text-left", className)}
          {...aria}
        >
          <CalendarDays className="size-4 shrink-0 text-fg-muted" aria-hidden />
          {d ? (
            <span className="flex min-w-0 items-baseline gap-2 truncate">
              <span className="text-fg tabular">{d.bs}</span>
              <span className="truncate text-xs text-fg-muted tabular">{d.ad}</span>
            </span>
          ) : (
            <span className="text-fg-subtle">{placeholder ?? t("select_date")}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <BsCalendar
          value={value}
          min={min}
          max={max}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
});
BsDatePicker.displayName = "BsDatePicker";

/** BS month picker: ‹ Ashwin 2083 › with a 12-month popover grid. */
export function BsMonthPicker({
  value,
  onChange,
  className,
  max,
}: {
  value: { year: number; month: number };
  onChange: (v: { year: number; month: number }) => void;
  className?: string;
  max?: { year: number; month: number };
}) {
  const t = useTranslations("common");
  const f = useFormat();
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(value.year);
  React.useEffect(() => setYear(value.year), [value.year]);
  const shift = (delta: number) => {
    let m = value.month + delta;
    let y = value.year;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    onChange({ year: y, month: m });
  };
  const isAfterMax = (y: number, m: number) => !!max && (y > max.year || (y === max.year && m > max.month));
  return (
    <div className={cn("inline-flex items-center rounded-md border border-border-strong bg-surface shadow-sm", className)}>
      <button
        type="button"
        onClick={() => shift(-1)}
        className="inline-flex size-10 items-center justify-center rounded-l-md text-fg-muted hover:bg-surface-hover"
        aria-label={t("prev_month")}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-10 min-w-36 border-x border-border px-3 text-sm font-medium text-fg tabular hover:bg-surface-hover"
            aria-label={t("pick_month")}
          >
            {f.bsMonth(value.year, value.month)}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-hover"
              aria-label={t("previous")}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="text-sm font-semibold tabular">{f.digits(year)}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-hover"
              aria-label={t("next")}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1;
              const sel = year === value.year && m === value.month;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isAfterMax(year, m)}
                  onClick={() => {
                    onChange({ year, month: m });
                    setOpen(false);
                  }}
                  className={cn(
                    "h-9 rounded-md text-sm disabled:opacity-30",
                    sel ? "bg-brand text-brand-fg" : "hover:bg-surface-hover",
                  )}
                >
                  {f.monthName(m)}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={max ? isAfterMax(value.month === 12 ? value.year + 1 : value.year, value.month === 12 ? 1 : value.month + 1) : false}
        className="inline-flex size-10 items-center justify-center rounded-r-md text-fg-muted hover:bg-surface-hover disabled:opacity-30"
        aria-label={t("next_month")}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export type { YMD };
