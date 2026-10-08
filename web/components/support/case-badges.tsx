"use client";
import * as React from "react";
import { AlarmClock, EyeOff, Hourglass, ShieldAlert, Siren } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SupportCase, SupportPriority, SupportStatus } from "@/lib/api/types-support";
import { cn } from "@/lib/utils";
import { compactDuration, slaState } from "./sla";

export const CASE_STATUS_TONE: Record<SupportStatus, BadgeTone> = {
  open: "brand",
  pending_user: "warning",
  resolved: "success",
  closed: "neutral",
};
export const PRIORITY_TONE: Record<SupportPriority, BadgeTone> = {
  urgent: "danger",
  high: "warning",
  normal: "neutral",
  low: "outline",
};

export function CaseStatusBadge({ c, requester }: { c: Pick<SupportCase, "status" | "status_label">; requester?: boolean }) {
  const t = useTranslations("support.status");
  // requesters read "pending_user" as "Waiting for you"; staff as "Waiting on requester"
  const label = requester ? c.status_label || t(c.status) : t(`staff_${c.status}`);
  return (
    <Badge tone={CASE_STATUS_TONE[c.status] ?? "neutral"} dot>
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: SupportPriority }) {
  const t = useTranslations("support.priority");
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{t(priority)}</Badge>;
}

export function SafetyBadges({ c }: { c: Pick<SupportCase, "category" | "emergency" | "confidential" | "anonymous"> }) {
  const t = useTranslations("support.safety");
  if (c.category !== "safety") return null;
  return (
    <>
      {c.emergency ? (
        <Badge tone="danger">
          <Siren aria-hidden />
          {t("emergency_badge")}
        </Badge>
      ) : (
        <Badge tone="danger">
          <ShieldAlert aria-hidden />
          {t("badge")}
        </Badge>
      )}
      {c.anonymous ? (
        <Badge tone="outline">
          <EyeOff aria-hidden />
          {t("anonymous_badge")}
        </Badge>
      ) : null}
    </>
  );
}

/** Re-renders every minute so countdowns stay current. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** SLA countdown: "Due in 5h 10m" / "Overdue 2h" / "Paused" (waiting on requester). */
export function SlaIndicator({ c, className }: { c: Pick<SupportCase, "sla_due_at" | "status">; className?: string }) {
  const t = useTranslations("support.sla");
  const now = useNow();
  const s = slaState(c.sla_due_at, c.status, now);
  if (s.tone === "done") return <span className={cn("text-xs text-fg-subtle", className)}>—</span>;
  const units = { d: t("unit_d"), h: t("unit_h"), m: t("unit_m") };
  const dur = compactDuration(s.minutes, units);
  const Icon = s.tone === "paused" ? Hourglass : AlarmClock;
  const text =
    s.tone === "overdue" ? t("overdue", { duration: dur }) : s.tone === "paused" ? t("paused") : t("due_in", { duration: dur });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular",
        s.tone === "overdue" && "text-danger",
        s.tone === "soon" && "text-warning",
        (s.tone === "ok" || s.tone === "paused") && "text-fg-muted",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  );
}
