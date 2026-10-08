"use client";
import { useTranslations } from "next-intl";
import type { MatchReason } from "@/components/ledger";
import type { Job, WorkerCard } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { tradeOf } from "@/components/shared/worker-summary";

/**
 * "Why this match" for an employer pipeline card, derived only from facts we hold about the
 * worker and the job (verification, experience vs the job's minimum, NSTB level in the job's
 * trade, employer ratings, earlier placements, district). Nothing is invented.
 */
export function useCandidateReasons() {
  const t = useTranslations("ledger.match");
  const tn = useTranslations("nstb");
  const f = useFormat();
  return (worker: WorkerCard, job?: Pick<Job, "trade" | "min_experience_years"> | null): MatchReason[] => {
    const out: MatchReason[] = [];
    if (worker.verification_status === "verified") out.push({ label: t("verified"), tone: "positive" });
    const years = worker.total_experience_years ?? 0;
    const need = job?.min_experience_years ?? 0;
    if (need > 0 && years < need) {
      out.push({ label: t("experience_short", { need: f.digits(need), years: f.digits(years) }), tone: "negative" });
    } else if (years > 0) {
      out.push({ label: t("experience", { years }), tone: "positive" });
    }
    const skill =
      worker.skills?.find((s) => job && tradeOf(s)?.code === job.trade?.code) ?? worker.skills?.[0];
    if (skill?.nstb_level && skill.nstb_level !== "none") {
      out.push({ label: t("nstb", { level: tn(skill.nstb_level) }), tone: "positive" });
    }
    if (worker.rating_avg !== null && worker.rating_avg !== undefined) {
      out.push({
        label: t("rated", { rating: f.number(Math.round(worker.rating_avg * 10) / 10, { decimals: 1 }) }),
        tone: worker.rating_avg >= 3.5 ? "positive" : "neutral",
      });
    }
    if (worker.placements_count) out.push({ label: t("placements", { count: worker.placements_count }), tone: "neutral" });
    if (worker.district) out.push({ label: t("district", { district: f.name(worker.district) }), tone: "neutral" });
    return out.slice(0, 4);
  };
}
