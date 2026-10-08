"use client";
import * as React from "react";
import { AlertTriangle, Inbox, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/api/errors";
import { Button } from "./button";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton h-4", className)} {...props} />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-fg-muted", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Table-shaped skeleton. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-dense border border-border bg-surface shadow-sm" aria-busy>
      <div className="flex h-10 items-center gap-4 border-b border-border bg-surface-muted px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-[52px] items-center gap-4 border-b border-border px-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "max-w-48")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Error panel for failed queries. Shows the localized API message where available. */
export function ErrorState({
  error,
  onRetry,
  className,
  title,
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
  title?: string;
}) {
  const t = useTranslations();
  const message = errorMessage(error, t);
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-fg">{title ?? t("common.error_loading")}</p>
        <p className="text-sm text-fg-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden />
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

/** Human message for any error: API message (already localized by server) or a code-based fallback. */
export function errorMessage(error: unknown, t: T): string {
  if (isApiError(error)) {
    if (error.code === "network_error" || error.code === "server_error") {
      return t(`errors.${error.code}`);
    }
    if (error.message) return error.message;
    const key = `errors.${error.code}`;
    return t.has(key) ? t(key) : t("errors.server_error");
  }
  return t("errors.server_error");
}
