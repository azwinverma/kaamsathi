"use client";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { parseIsoDate, weekdayOf } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import type { Dashboard } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Day = Dashboard["attendance_14d"][number];

const SERIES = [
  { key: "present", className: "bg-success" },
  { key: "leave", className: "bg-primary-400" },
  { key: "absent", className: "bg-danger" },
] as const;

/** 14-day stacked bar chart (present / leave / absent) in plain CSS. */
export function AttendanceChart({ days, today }: { days: Day[]; today?: string }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const max = Math.max(1, ...days.map((d) => d.present + d.absent + d.leave));
  const hasData = days.some((d) => d.present + d.absent + d.leave > 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", s.className)} aria-hidden />
            {t(`chart_${s.key}`)}
          </span>
        ))}
      </div>
      {!hasData ? (
        <p className="flex h-44 items-center justify-center rounded-md border border-dashed border-border text-sm text-fg-muted">
          {t("chart_empty")}
        </p>
      ) : (
        <>
          <div
            className="flex h-44 items-end gap-1 border-b border-border sm:gap-1.5"
            role="img"
            aria-label={t("chart_aria")}
          >
            {days.map((d) => {
              const total = d.present + d.absent + d.leave;
              const label = `${f.bs(d.date_bs)} · ${t("chart_tooltip", {
                present: f.digits(d.present),
                leave: f.digits(d.leave),
                absent: f.digits(d.absent),
              })}`;
              return (
                <Tooltip key={d.date} content={label}>
                  <div
                    className={cn(
                      "flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      d.date === today && "bg-brand-subtle/60",
                    )}
                    tabIndex={0}
                    aria-label={label}
                  >
                    <div
                      className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px]"
                      style={{ height: `${(total / max) * 100}%` }}
                    >
                      {SERIES.map((s) =>
                        d[s.key] > 0 ? (
                          <div
                            key={s.key}
                            className={s.className}
                            style={{ height: `${(d[s.key] / total) * 100}%` }}
                          />
                        ) : null,
                      )}
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1 sm:gap-1.5" aria-hidden>
            {days.map((d) => {
              const bsDay = parseIsoDate(d.date_bs)?.day ?? 0;
              const sat = weekdayOf(d.date) === 6;
              return (
                <span
                  key={d.date}
                  className={cn(
                    "min-w-0 flex-1 text-center text-[10px] text-fg-muted tabular sm:text-[11px]",
                    sat && "text-danger",
                    d.date === today && "font-semibold text-fg",
                  )}
                >
                  {f.digits(bsDay)}
                </span>
              );
            })}
          </div>
        </>
      )}
      <table className="sr-only">
        <caption>{t("chart_aria")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("chart_date")}</th>
            <th scope="col">{t("chart_present")}</th>
            <th scope="col">{t("chart_leave")}</th>
            <th scope="col">{t("chart_absent")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{f.bs(d.date_bs)}</th>
              <td>{f.digits(d.present)}</td>
              <td>{f.digits(d.leave)}</td>
              <td>{f.digits(d.absent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
