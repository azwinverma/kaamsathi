"use client";
import { MapPin, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useFormat } from "@/lib/use-format";
import type { TradeRef, WorkerCard, WorkerSkill } from "@/lib/api/types";
import type { WorkerTrustFields } from "@/lib/api/types-trust";
import { ReliabilityBadge, TrustBadges, VerificationLevelBadge } from "@/components/trust/trust-badges";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "./status-badge";

export function tradeOf(skill: WorkerSkill): TradeRef | null {
  if (!skill.trade) return null;
  return typeof skill.trade === "string" ? { code: skill.trade, name_en: skill.trade, name_ne: skill.trade } : skill.trade;
}

export function SkillChips({ skills, max = 3 }: { skills: WorkerSkill[]; max?: number }) {
  const f = useFormat();
  const t = useTranslations();
  if (!skills?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {skills.slice(0, max).map((s, i) => {
        const tr = tradeOf(s);
        return (
          <Badge key={i} tone="outline">
            {f.name(tr)}
            {s.years_experience ? (
              <span className="text-fg-muted">· {t("term.years", { count: s.years_experience })}</span>
            ) : null}
            {s.nstb_level && s.nstb_level !== "none" ? (
              <span className="text-brand-text">· NSTB {t(`nstb.${s.nstb_level}`)}</span>
            ) : null}
          </Badge>
        );
      })}
      {skills.length > max ? <Badge tone="neutral">+{f.digits(skills.length - max)}</Badge> : null}
    </div>
  );
}

export function RatingStars({ value, className }: { value: number | null | undefined; className?: string }) {
  const f = useFormat();
  if (value === null || value === undefined) return <span className={cn("text-xs text-fg-subtle", className)}>—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-fg tabular", className)}>
      <Star className="size-3.5 fill-warning text-warning" aria-hidden />
      {f.number(Math.round(value * 10) / 10, { decimals: 1 })}
    </span>
  );
}

/** Compact worker identity row: avatar, name, verification, district, masked phone. */
export function WorkerIdentity({
  worker,
  size = "md",
  showPhone = true,
  showTrust = true,
  className,
}: {
  worker: Pick<WorkerCard, "full_name" | "photo" | "verification_status" | "district" | "phone_masked"> &
    WorkerTrustFields;
  size?: "sm" | "md" | "lg";
  showPhone?: boolean;
  /** Verification level + reliability score badges (apps.trust). */
  showTrust?: boolean;
  className?: string;
}) {
  const f = useFormat();
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Avatar name={worker.full_name} src={worker.photo} size={size === "lg" ? "lg" : size === "sm" ? "sm" : "md"} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("truncate font-medium text-fg", size === "lg" && "text-lg font-semibold")}>
            {worker.full_name}
          </span>
          {worker.verification_status === "verified" ? (
            <VerificationBadge status="verified" className="max-sm:hidden" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          {worker.district ? (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" aria-hidden />
              {f.name(worker.district)}
            </span>
          ) : null}
          {showPhone && worker.phone_masked ? <span className="tabular">{worker.phone_masked}</span> : null}
          {showTrust && size !== "lg" ? (
            <span className="inline-flex items-center gap-1">
              {(worker.verification_level ?? 0) >= 2 ? (
                <VerificationLevelBadge level={worker.verification_level} compact className="px-1.5 py-0" />
              ) : null}
              <ReliabilityBadge score={worker.reliability_score} compact className="px-1.5 py-0" />
            </span>
          ) : null}
        </div>
        {showTrust && size === "lg" ? <TrustBadges worker={worker} className="mt-1.5" /> : null}
      </div>
    </div>
  );
}

/** Card for a WorkerCard (pipeline cards, matches). */
export function WorkerCardView({
  worker,
  footer,
  className,
}: {
  worker: WorkerCard & WorkerTrustFields;
  footer?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  const f = useFormat();
  return (
    <div className={cn("space-y-2.5", className)}>
      <WorkerIdentity worker={worker} size="sm" showTrust={false} />
      <SkillChips skills={worker.skills} max={2} />
      <TrustBadges worker={worker} />
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <span>
          {t("term.experience")}: {t("term.years", { count: worker.total_experience_years ?? 0 })}
        </span>
        <RatingStars value={worker.rating_avg} />
        {worker.placements_count ? (
          <span>
            {t("term.placements")}: {f.digits(worker.placements_count)}
          </span>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
