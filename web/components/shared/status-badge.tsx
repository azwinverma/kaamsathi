"use client";
import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/api/types";

/**
 * Translated status pill. `ns` picks the message namespace:
 * status (jobs/employment/leave/charges), stage (pipeline), payroll, verification.
 */
export function StatusBadge({
  status,
  ns = "status",
  label,
  className,
}: {
  status: string;
  ns?: "status" | "stage" | "payroll";
  label?: string;
  className?: string;
}) {
  const t = useTranslations();
  const key = `${ns}.${status}`;
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot className={className}>
      {label ?? (t.has(key) ? t(key) : status)}
    </Badge>
  );
}

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const t = useTranslations("status");
  const Icon =
    status === "verified" ? BadgeCheck : status === "pending" ? Clock : status === "rejected" ? ShieldAlert : ShieldQuestion;
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} className={className}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}
