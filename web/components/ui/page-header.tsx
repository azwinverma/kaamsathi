import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {back ? (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
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
