import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./feedback";

/**
 * Dense stat (ledger): label + small tone icon on one line, a tabular value below.
 * No coloured icon tiles — the value is the focal point; tone colours only the icon
 * (status is never colour-only: the label carries the meaning).
 */
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
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  loading?: boolean;
  className?: string;
  href?: string;
}) {
  const toneClass = {
    neutral: "text-fg-muted",
    brand: "text-brand-text",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  }[tone];
  const inner = (
    <>
      <p className="flex items-center gap-1.5 text-sm text-fg-muted">
        {Icon ? <Icon className={cn("size-4 shrink-0", toneClass)} aria-hidden /> : null}
        <span className="min-w-0 truncate">{label}</span>
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-fg tabular">{value}</p>
          {delta}
        </div>
      )}
      {hint ? <p className="mt-0.5 text-xs text-fg-muted">{hint}</p> : null}
    </>
  );
  const cls = cn(
    "block rounded-dense border border-border bg-surface px-4 py-3.5",
    href && "transition-colors hover:border-border-strong hover:bg-surface-muted/60",
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
