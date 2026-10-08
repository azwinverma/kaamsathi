"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string;
  /** Left column: BS date first, AD below (use DateText or plain text). */
  when: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  state: "done" | "current" | "upcoming" | "ended";
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/**
 * Employment timeline (direction A signature): a ledger of dated events — date column on the
 * left, event on the right, joined by a hairline rail. The current entry gets the blue node;
 * upcoming entries are dashed; an ended employment closes with a neutral node.
 */
export function EmploymentTimeline({
  entries,
  label,
  className,
}: {
  entries: TimelineEntry[];
  label?: string;
  className?: string;
}) {
  const t = useTranslations("ledger.timeline");
  return (
    <ol aria-label={label ?? t("label")} className={cn("relative", className)}>
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        const Icon = e.icon;
        return (
          <li key={e.id} className="grid grid-cols-[88px_20px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[112px_20px_minmax(0,1fr)]">
            <div className="pt-0.5 text-right text-xs leading-5 text-fg-muted tabular">{e.when}</div>
            <div className="relative flex justify-center">
              {!last ? <span aria-hidden className="absolute top-5 bottom-0 w-px bg-border" /> : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-[1] mt-1 flex size-3 rounded-full",
                  e.state === "done" && "bg-verified",
                  e.state === "current" && "bg-brand ring-4 ring-brand-subtle",
                  e.state === "upcoming" && "border-2 border-dashed border-border-strong bg-surface",
                  e.state === "ended" && "bg-fg-muted",
                )}
              />
            </div>
            <div className={cn("min-w-0", last ? "" : "pb-5")}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                {Icon ? <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden /> : null}
                {e.title}
              </p>
              {e.detail ? <div className="mt-0.5 text-[13px] leading-5 text-fg-muted">{e.detail}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
