import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  BadgeCheck,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Status chip (pill radius is reserved for chips/status). Tone text is always the AA-safe
 * *.text token on its *.soft background; status meaning must also carry an icon + label
 * (see TONE_ICON / StatusBadge) — never colour alone.
 */
export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-surface-hover text-fg-body",
        brand: "bg-brand-subtle text-brand-subtle-fg",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        verified: "bg-verified-soft text-verified",
        accent: "bg-coral-subtle text-coral-text",
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

/** Default status icon per tone, so status is never conveyed by colour alone. */
export const TONE_ICON: Record<BadgeTone, LucideIcon> = {
  neutral: Circle,
  brand: CircleDot,
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: Info,
  verified: BadgeCheck,
  accent: CircleDot,
  outline: Circle,
};

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
  verified: "verified",
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
