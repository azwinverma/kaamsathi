"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { HandHeart, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { MATCH_COMPONENTS, type MatchComponent, type MatchV2 } from "@/lib/api/types-experience";
import type { Match } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** Ordered `[component, points]` rows of a match's `explain` (unknown components last). */
export function explainRows(explain: MatchV2["explain"]): [string, number][] {
  if (!explain) return [];
  const known = MATCH_COMPONENTS.filter((c) => explain[c] !== undefined && explain[c] !== 0).map(
    (c) => [c, explain[c] as number] as [string, number],
  );
  const extra = Object.entries(explain).filter(
    ([k, v]) => !(MATCH_COMPONENTS as readonly string[]).includes(k) && v,
  ) as [string, number][];
  return [...known, ...extra];
}

/** Score breakdown table (used inside the tooltip; exported for tests and other surfaces). */
export function MatchExplainTable({ match }: { match: Match }) {
  const t = useTranslations("experience.match");
  const f = useFormat();
  const rows = explainRows((match as MatchV2).explain);
  const sum = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="min-w-48 space-y-1.5">
      <p className="font-semibold">{t("explain_title")}</p>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-0.5 pr-3">
                {t.has(`component.${k}`) ? t(`component.${k as MatchComponent}`) : k}
              </td>
              <td
                className={cn(
                  "tabular py-0.5 text-right font-medium",
                  v < 0 && "text-danger-on-inverse",
                )}
              >
                {v > 0 ? "+" : "−"}
                {f.digits(Math.abs(v))}
              </td>
            </tr>
          ))}
          <tr className="border-t border-surface/20">
            <td className="pt-1 pr-3 font-semibold">{t("total")}</td>
            <td className="tabular pt-1 text-right font-semibold">{f.digits(match.score)}</td>
          </tr>
        </tbody>
      </table>
      {sum !== match.score ? <p className="opacity-80">{t("clamped")}</p> : null}
    </div>
  );
}

/** Wraps the score meter: hover/focus shows how the score was built (matching v2 `explain`). */
export function MatchExplain({ match, children }: { match: Match; children: React.ReactNode }) {
  const t = useTranslations("experience.match");
  const m = match as MatchV2;
  if (!m.explain || !Object.keys(m.explain).length) return <>{children}</>;
  return (
    <Tooltip content={<MatchExplainTable match={match} />} side="left">
      <button
        type="button"
        className="focus-visible:outline-ring inline-flex cursor-help items-center gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={t("explain_aria", { score: match.score })}
      >
        {children}
        <Info className="text-fg-subtle size-3.5" aria-hidden />
      </button>
    </Tooltip>
  );
}

/** "Interested" pill for workers who asked for this job themselves. */
export function InterestedBadge({ match }: { match: Match }) {
  const t = useTranslations("experience.match");
  if (!(match as MatchV2).interested) return null;
  return (
    <Badge tone="accent" title={t("interested_hint")}>
      <HandHeart aria-hidden />
      {t("interested")}
    </Badge>
  );
}

const GROWTH_REASONS: Record<string, string> = {
  "prefers this area": "prefers_area",
  "stays in jobs": "stays_in_jobs",
  "declined this employer before": "declined_before",
  reliable: "reliable",
};

/** Extends the ops reason translator with the matching v2 reasons. */
export function useMatchReasonLabel(fallback: (r: string) => string) {
  const t = useTranslations("experience.match.reason");
  return React.useCallback(
    (reason: string) => {
      const key = GROWTH_REASONS[reason.trim().toLowerCase()];
      return key ? t(key) : fallback(reason);
    },
    [t, fallback],
  );
}
