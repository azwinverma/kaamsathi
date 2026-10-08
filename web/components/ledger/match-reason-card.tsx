"use client";
import * as React from "react";
import { AlertTriangle, Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface MatchReason {
  label: React.ReactNode;
  tone: "positive" | "negative" | "neutral";
}

/**
 * Match reason card (direction A signature): who the worker is, then a short "why this match"
 * list — each reason with a teal check (fits), amber warning (gap) or neutral dash. The score is
 * a quiet number, not a gauge; the reasons carry the decision.
 */
export function MatchReasonCard({
  identity,
  score,
  scoreLabel,
  reasons,
  children,
  footer,
  aside,
  selected,
  className,
  compact,
}: {
  identity: React.ReactNode;
  score?: number | null;
  scoreLabel?: React.ReactNode;
  reasons: MatchReason[];
  /** Extra rows between identity and reasons (skills, requirement checks). */
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Top-right slot (checkbox, rank, badges). */
  aside?: React.ReactNode;
  selected?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("ledger.match");
  return (
    <div
      className={cn(
        "rounded-dense border bg-surface transition-colors",
        selected ? "border-brand bg-brand-subtle/50" : "border-border hover:border-border-strong",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{identity}</div>
        {aside ?? (score !== null && score !== undefined ? (
          <span className="shrink-0 text-right">
            <span className="block text-lg leading-6 font-bold text-fg tabular">{scoreLabel ?? score}</span>
            <span className="block text-[11px] text-fg-muted">{t("score_caption")}</span>
          </span>
        ) : null)}
      </div>
      {children ? <div className="mt-2 space-y-2">{children}</div> : null}
      <div className={cn("border-t border-border", compact ? "mt-2 pt-2" : "mt-3 pt-3")}>
        <p className="mb-1.5 text-xs font-semibold text-fg-muted">{t("why")}</p>
        {reasons.length ? (
          <ul className={cn("grid gap-x-4 gap-y-1", !compact && "sm:grid-cols-2")}>
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[13px] leading-5 text-fg-body">
                {r.tone === "positive" ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 stroke-[2.5] text-verified" aria-hidden />
                ) : r.tone === "negative" ? (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                ) : (
                  <Minus className="mt-0.5 size-3.5 shrink-0 text-fg-muted" aria-hidden />
                )}
                <span className="min-w-0">{r.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-fg-muted">{t("no_reasons")}</p>
        )}
      </div>
      {footer ? <div className={cn(compact ? "mt-2" : "mt-3")}>{footer}</div> : null}
    </div>
  );
}
