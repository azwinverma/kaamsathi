"use client";
import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { KybStatus } from "@/lib/api/types-risk";
import { cn } from "@/lib/utils";

export const KYB_TONE: Record<KybStatus, BadgeTone> = {
  unverified: "neutral",
  pending: "warning",
  verified: "success",
  rejected: "danger",
};

const KYB_ICON = { unverified: ShieldQuestion, pending: Clock, verified: BadgeCheck, rejected: ShieldAlert };

export function KybStatusBadge({ status, className }: { status: KybStatus; className?: string }) {
  const t = useTranslations("risk.kyb.status");
  const Icon = KYB_ICON[status] ?? ShieldQuestion;
  return (
    <Badge tone={KYB_TONE[status] ?? "neutral"} className={className}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}

/**
 * "Verified employer" mark shown next to an employer name. Renders nothing unless the
 * organisation passed KYB, so callers can drop it in wherever a name renders.
 */
export function VerifiedEmployerBadge({
  status,
  compact,
  className,
}: {
  status: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("risk.kyb");
  if (status !== "verified") return null;
  if (compact) {
    return (
      <Tooltip content={t("verified_tooltip")}>
        <span
          className={cn("inline-flex align-middle text-success", className)}
          role="img"
          aria-label={t("verified_employer")}
          tabIndex={0}
        >
          <BadgeCheck className="size-4" aria-hidden />
        </span>
      </Tooltip>
    );
  }
  return (
    <Badge tone="success" className={className}>
      <BadgeCheck aria-hidden />
      {t("verified_employer")}
    </Badge>
  );
}
