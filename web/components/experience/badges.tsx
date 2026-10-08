"use client";
import { useTranslations } from "next-intl";
import { HandHeart, MessageCircleQuestion, ThumbsDown, ThumbsUp, UserCheck } from "lucide-react";
import { Badge, TONE_ICON, type BadgeTone } from "@/components/ui/badge";
import type {
  ApplicationGrowthFields,
  WorkHistoryStatus,
  WorkerResponse,
} from "@/lib/api/types-experience";

export const WORK_HISTORY_TONE: Record<WorkHistoryStatus, BadgeTone> = {
  self_reported: "neutral",
  reference_pending: "warning",
  verified: "verified",
  unverifiable: "neutral",
  rejected: "danger",
};

const RESPONSE_TONE: Record<WorkerResponse, BadgeTone> = {
  pending: "warning",
  interested: "success",
  declined: "danger",
};

export function WorkHistoryStatusBadge({
  status,
  label,
  className,
}: {
  status: WorkHistoryStatus;
  label?: string | null;
  className?: string;
}) {
  const t = useTranslations("experience.status");
  const tone = WORK_HISTORY_TONE[status] ?? "neutral";
  const Icon = TONE_ICON[tone];
  return (
    <Badge tone={tone} className={className}>
      <Icon aria-hidden />
      {t.has(status) ? t(status) : (label ?? status)}
    </Badge>
  );
}

/** Worker's own answer to a shortlist ("Awaiting worker" / "Interested" / "Declined"). */
export function WorkerResponseBadge({
  response,
  className,
}: {
  response: WorkerResponse | null | undefined;
  className?: string;
}) {
  const t = useTranslations("experience.response");
  if (!response) return null;
  const Icon =
    response === "interested"
      ? ThumbsUp
      : response === "declined"
        ? ThumbsDown
        : MessageCircleQuestion;
  return (
    <Badge tone={RESPONSE_TONE[response]} className={className} title={t(`${response}_hint`)}>
      <Icon aria-hidden />
      {t(response)}
    </Badge>
  );
}

/** Where the candidate came from — only shown when it isn't the default KaamSathi match. */
export function SourceBadge({
  source,
  className,
}: {
  source: ApplicationGrowthFields["source"];
  className?: string;
}) {
  const t = useTranslations("experience.source");
  if (!source || source === "ops") return null;
  const Icon = source === "worker_interest" ? HandHeart : UserCheck;
  return (
    <Badge tone="accent" className={className}>
      <Icon aria-hidden />
      {t(source)}
    </Badge>
  );
}

/** Source + worker response badges for an application (pipeline cards, candidate rows, drawer). */
export function ApplicationGrowthBadges({
  application,
  className,
}: {
  application: ApplicationGrowthFields;
  className?: string;
}) {
  if ((!application.source || application.source === "ops") && !application.worker_response) {
    return null;
  }
  return (
    <span className={className ?? "flex flex-wrap items-center gap-1"}>
      <SourceBadge source={application.source} />
      <WorkerResponseBadge response={application.worker_response} />
    </span>
  );
}
