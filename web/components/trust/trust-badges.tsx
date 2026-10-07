"use client";
import { Gauge, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { WorkerTrustFields } from "@/lib/api/types-trust";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

function levelTone(level: number): BadgeTone {
  if (level >= 4) return "success";
  if (level >= 2) return "brand";
  return "neutral";
}

export function reliabilityTone(score: number): BadgeTone {
  if (score >= 80) return "success";
  if (score >= 60) return "brand";
  return "warning";
}

/** Verification level 0–5 ("L2 · Employment verified"). */
export function VerificationLevelBadge({
  level,
  compact,
  className,
}: {
  level: number | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("trust");
  const f = useFormat();
  if (level === null || level === undefined) return null;
  const lvl = Math.max(0, Math.min(5, Math.round(level)));
  const name = t(`level.${lvl}`);
  return (
    <Tooltip content={t("level_tooltip", { level: f.digits(lvl), name })}>
      <Badge tone={levelTone(lvl)} className={className} aria-label={t("level_aria", { level: lvl, name })}>
        <ShieldCheck aria-hidden />
        {compact ? t("level_short", { level: f.digits(lvl) }) : `${t("level_short", { level: f.digits(lvl) })} · ${name}`}
      </Badge>
    </Tooltip>
  );
}

/** Reliability score 0–100 (never a credit score). Renders nothing until the worker has worked somewhere. */
export function ReliabilityBadge({
  score,
  compact,
  className,
}: {
  score: number | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("trust");
  const f = useFormat();
  if (score === null || score === undefined) return null;
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <Tooltip content={t("reliability_tooltip")}>
      <Badge tone={reliabilityTone(s)} className={cn("tabular", className)} aria-label={t("reliability_aria", { score: s })}>
        <Gauge aria-hidden />
        {compact ? f.digits(s) : t("reliability_value", { score: f.digits(s) })}
      </Badge>
    </Tooltip>
  );
}

/** Both badges for a WorkerCard. */
export function TrustBadges({
  worker,
  compact,
  className,
}: {
  worker: WorkerTrustFields;
  compact?: boolean;
  className?: string;
}) {
  if (worker.verification_level === undefined && worker.reliability_score === undefined) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <VerificationLevelBadge level={worker.verification_level} compact={compact} />
      <ReliabilityBadge score={worker.reliability_score} compact={compact} />
    </span>
  );
}
