import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ledger page header: optional back link and eyebrow (date / context line), one bold title as the
 * page's focal point, a muted description and meta chips; actions sit right on wide screens.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  /** Small context line above the title (e.g. today's BS date). */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-2", className)}>
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 inline-flex items-center gap-1 rounded-sm px-1 text-sm text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <div className="text-sm text-fg-muted">{eyebrow}</div> : null}
          <h1 className="text-2xl font-bold text-fg sm:text-[28px] sm:leading-9">{title}</h1>
          {description ? <p className="max-w-3xl text-sm text-fg-muted">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Horizontal filter/action bar above tables. */
export function Toolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}
      {...props}
    />
  );
}

/**
 * Ledger filter bar: filters on the left, an optional result summary ("Showing 24") and bulk
 * actions on the right. Same layout contract as Toolbar so pages can switch without markup churn.
 */
export function FilterBar({
  className,
  children,
  summary,
  actions,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  /** Accessible name for the filter group. */
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "mb-4 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
      {summary || actions ? (
        <div className="flex items-center gap-3 sm:ml-auto">
          {summary ? <span className="text-sm text-fg-muted tabular">{summary}</span> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
