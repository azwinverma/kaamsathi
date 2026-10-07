import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-hover text-fg-body",
        brand: "bg-brand-subtle text-brand-subtle-fg",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        danger: "bg-danger-subtle text-danger",
        accent: "bg-accent-subtle text-accent",
        outline: "border border-border bg-surface text-fg-body",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  dot,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Status → tone maps used across the app. */
export const STATUS_TONE: Record<string, BadgeTone> = {
  // jobs
  draft: "neutral",
  open: "brand",
  filled: "success",
  closed: "neutral",
  // employment
  active: "success",
  ended: "neutral",
  // approval
  pending: "warning",
  approved: "brand",
  rejected: "danger",
  // payroll / charges
  paid: "success",
  unpaid: "warning",
  waived: "neutral",
  // verification
  verified: "success",
  unverified: "neutral",
  // stages
  sourced: "neutral",
  shortlisted: "brand",
  interview: "warning",
  selected: "accent",
  joined: "success",
  dropped: "neutral",
  // attendance
  present: "success",
  absent: "danger",
  half_day: "warning",
  leave: "brand",
  holiday: "neutral",
  weekly_off: "neutral",
};
