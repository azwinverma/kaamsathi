import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./feedback";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  tone = "neutral",
  loading,
  className,
  href,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  hint?: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  loading?: boolean;
  className?: string;
  href?: string;
}) {
  const toneClass = {
    neutral: "bg-surface-muted text-fg-muted",
    brand: "bg-brand-subtle text-brand",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-danger-subtle text-danger",
  }[tone];
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-fg-muted">{label}</p>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-md", toneClass)}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-fg tabular">{value}</p>
          {delta}
        </div>
      )}
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </>
  );
  const cls = cn(
    "block rounded-lg border border-border bg-surface p-4 shadow-sm",
    href && "transition-colors hover:border-border-strong hover:bg-surface-hover/40",
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
