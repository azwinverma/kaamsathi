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
  /** `attention`: needs a decision (open dispute, letter out of date) — amber node + icon. */
  state: "done" | "current" | "upcoming" | "ended" | "attention";
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/**
 * Employment timeline (direction A signature): a ledger of dated events — date column on the
 * left, event on the right, joined by a hairline rail. The current entry gets the blue node;
 * upcoming entries are dashed; an ended employment closes with a neutral node; entries that need a
 * decision get an amber node (pair it with an icon + words in the title — never colour alone).
 * `dense` tightens the date column for narrow containers.
 */
export function EmploymentTimeline({
  entries,
  label,
  className,
  dense,
}: {
  entries: TimelineEntry[];
  label?: string;
  className?: string;
  dense?: boolean;
}) {
  const t = useTranslations("ledger.timeline");
  return (
    <ol aria-label={label ?? t("label")} className={cn("relative", className)}>
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        const Icon = e.icon;
        return (
          <li
            key={e.id}
            className={cn(
              "grid grid-cols-[76px_20px_minmax(0,1fr)] gap-x-3",
              !dense && "sm:grid-cols-[112px_20px_minmax(0,1fr)]",
            )}
          >
            <div className="text-fg-muted tabular pt-0.5 text-right text-xs leading-5">
              {e.when}
            </div>
            <div className="relative flex justify-center">
              {!last ? (
                <span aria-hidden className="bg-border absolute top-5 bottom-0 w-px" />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-[1] mt-1 flex size-3 rounded-full",
                  e.state === "done" && "bg-verified",
                  e.state === "current" && "bg-brand ring-brand-subtle ring-4",
                  e.state === "upcoming" &&
                    "border-border-strong bg-surface border-2 border-dashed",
                  e.state === "ended" && "bg-fg-muted",
                  e.state === "attention" && "bg-warning-hue ring-warning-soft ring-4",
                )}
              />
            </div>
            <div className={cn("min-w-0", last ? "" : "pb-5")}>
              <p className="text-fg flex items-start gap-1.5 text-sm font-semibold">
                {Icon ? (
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      e.state === "attention" ? "text-warning" : "text-fg-muted",
                    )}
                    aria-hidden
                  />
                ) : null}
                {e.title}
              </p>
              {e.detail ? (
                <div className="text-fg-muted mt-0.5 text-[13px] leading-5">{e.detail}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
