"use client";
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/feedback";

export interface DenseStat {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "verified";
  href?: string;
  /** Emphasise this stat (one focal number per strip). */
  focal?: boolean;
}

const TONE = {
  neutral: "text-fg-muted",
  brand: "text-brand-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  verified: "text-verified",
} as const;

/**
 * Dense stat row (direction A): several numbers in ONE bordered strip, split by hairlines, instead
 * of a grid of floating cards. Wraps to 2 columns on phones.
 */
export function DenseStatRow({
  items,
  label,
  loading,
  className,
}: {
  items: DenseStat[];
  label?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-dense border border-border bg-surface sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]",
        className,
      )}
    >
      {items.map((s) => {
        const Icon = s.icon;
        const body = (
          <>
            <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
              {Icon ? <Icon className={cn("size-4 shrink-0", TONE[s.tone ?? "neutral"])} aria-hidden /> : null}
              <span className="min-w-0 truncate">{s.label}</span>
            </p>
            {loading ? (
              <Skeleton className="mt-1.5 h-6 w-16" />
            ) : (
              <p className={cn("mt-0.5 font-bold text-fg tabular", s.focal ? "text-[26px] leading-9 whitespace-nowrap" : "text-lg whitespace-nowrap sm:text-xl")}>
                {s.value}
              </p>
            )}
            {s.hint ? <p className="text-xs text-fg-muted">{s.hint}</p> : null}
          </>
        );
        const cls = cn(
          "-mb-px -ml-px block min-w-0 border-b border-l border-border px-4 py-3",
          s.focal && "col-span-2 sm:col-span-2",
        );
        return s.href ? (
          <Link key={s.key} href={s.href} className={cn(cls, "transition-colors hover:bg-surface-muted/60")}>
            {body}
          </Link>
        ) : (
          <div key={s.key} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
