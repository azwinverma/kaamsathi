"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/feedback";

export interface AttentionItem {
  id: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: React.ReactNode;
  hint?: React.ReactNode;
  href: string;
  /** urgent = due/overdue (warning soft fill); danger = failed/rejected; normal = bordered row. */
  tone: "urgent" | "danger" | "normal";
}

/**
 * "Needs your attention" list (direction A dashboard). Urgent items sit on the warning soft
 * background with the AA warning text icon; the rest are quiet bordered rows. Every row is a
 * link to the screen that resolves it.
 */
export function AttentionList({
  title,
  items,
  loading,
  emptyText,
  className,
  headingId,
}: {
  title: React.ReactNode;
  items: AttentionItem[];
  loading?: boolean;
  emptyText: React.ReactNode;
  className?: string;
  headingId?: string;
}) {
  const id = React.useId();
  const hid = headingId ?? `attention-${id}`;
  return (
    <section
      aria-labelledby={hid}
      className={cn("flex flex-col gap-3 rounded-dense border border-border bg-surface px-5 py-4", className)}
    >
      <h2 id={hid} className="text-[17px] font-semibold">
        {title}
      </h2>
      {loading && !items.length ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-14 rounded-dense" />
          <Skeleton className="h-14 rounded-dense" />
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-fg-muted">
          <CircleCheck className="size-4 text-success" aria-hidden />
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-dense p-2.5 transition-colors",
                    it.tone === "urgent" && "bg-warning-soft hover:brightness-[0.98]",
                    it.tone === "danger" && "bg-danger-soft hover:brightness-[0.98]",
                    it.tone === "normal" && "border border-border hover:border-border-strong hover:bg-surface-muted/60",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-5 shrink-0 stroke-[1.75]",
                      it.tone === "urgent" ? "text-warning" : it.tone === "danger" ? "text-danger" : "text-fg-body",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">{it.title}</span>
                    {it.hint ? (
                      <span className={cn("block text-[13px]", it.tone === "normal" ? "text-fg-muted" : "text-fg-body")}>
                        {it.hint}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-muted group-hover:text-fg" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
