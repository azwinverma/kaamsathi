"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarOff, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * Today strip (direction A dashboard): hajiri progress as the focal number, then present /
 * absent / on leave / not marked in their AA *.text colours, each with an icon and a label.
 */
export function TodayStrip({
  total,
  present,
  absent,
  leave,
  notMarked,
  markHref = "/app/attendance",
  className,
}: {
  total: number;
  present: number;
  absent: number;
  leave: number;
  notMarked: number;
  markHref?: string;
  className?: string;
}) {
  const t = useTranslations();
  const tt = useTranslations("ledger.today");
  const f = useFormat();
  const marked = Math.max(0, total - notMarked);
  const pct = Math.round((marked / Math.max(1, total)) * 100);
  const cols = [
    { key: "present", label: t("term.present"), value: present, icon: CircleCheck, cls: "text-success" },
    { key: "absent", label: t("term.absent"), value: absent, icon: CircleX, cls: "text-danger" },
    { key: "leave", label: t("term.on_leave"), value: leave, icon: CalendarOff, cls: "text-info" },
    {
      key: "not_marked",
      label: t("term.not_marked"),
      value: notMarked,
      icon: CircleDashed,
      cls: notMarked > 0 ? "text-warning" : "text-fg-muted",
    },
  ];
  return (
    <section
      aria-label={tt("region")}
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-5 rounded-dense border border-border bg-surface px-5 py-4 sm:grid-cols-4 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] lg:items-center lg:px-6",
        className,
      )}
    >
      <div className="col-span-2 space-y-2 sm:col-span-4 lg:col-span-1">
        <p className="text-sm text-fg-muted">{tt("marked")}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-[32px] leading-none font-bold text-fg tabular">{f.digits(marked)}</span>
          <span className="text-[15px] text-fg-muted">{tt("of_workers", { total: f.digits(total) })}</span>
        </p>
        <div
          className="h-2 overflow-hidden rounded-pill bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={tt("progress_label", { pct: f.digits(pct) })}
        >
          <div className={cn("h-full", pct === 100 ? "bg-success-hue" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
        {notMarked > 0 ? (
          <Link href={markHref} className="inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">
            {tt("mark_rest", { count: f.digits(notMarked) })}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <p className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <CircleCheck className="size-4" aria-hidden />
            {tt("all_marked")}
          </p>
        )}
      </div>
      {cols.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.key} className="lg:border-l lg:border-border lg:pl-6">
            <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
              <Icon className={cn("size-4", c.cls)} aria-hidden />
              {c.label}
            </p>
            <p className={cn("mt-0.5 text-2xl font-bold tabular", c.value > 0 ? c.cls : "text-fg-muted")}>
              {f.digits(c.value)}
            </p>
          </div>
        );
      })}
    </section>
  );
}
