import type * as React from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export const LADDER_RUNGS = ["phone", "identity", "work", "certificate", "trusted"] as const;
export type LadderRung = (typeof LADDER_RUNGS)[number];

/** Earned rungs (0–5) for a Passport verification level (0 phone … 5 highly trusted). */
export function rungsForLevel(level: number): number {
  const l = Math.max(0, Math.min(5, Math.round(level)));
  // level 3 ("skills assessed") sits between Work and Certificate, so it still shows three rungs.
  return [1, 2, 3, 3, 4, 5][l];
}

/** canvas → teal-subtle → teal → blue → yellow (docs/design/DIRECTION.md §1). Text pairs are AA. */
const FILL = [
  "bg-surface-muted text-fg ring-1 ring-inset ring-border-strong",
  "bg-verified-subtle text-verified",
  "bg-teal text-on-accent",
  "bg-brand text-brand-fg",
  "bg-yellow text-on-accent",
] as const;

const BAR_PX = [22, 34, 46, 58, 70];

/**
 * Skill ladder / सीपको सीढी — the product's visual signature. Five rising rungs; rungs not yet earned
 * are dashed outlines (the next step, never a greyed-out failure). Rungs grow in once when scrolled
 * into view (instant under reduced motion).
 *
 * - `lg`: labelled rungs; a horizontal staircase on phones, rising bars from `sm` up.
 * - `bars`: compact bars with small labels underneath (Passport card).
 */
export async function SkillLadder({
  earned,
  variant = "lg",
  className,
}: {
  earned: number;
  variant?: "lg" | "bars";
  className?: string;
}) {
  const t = await getTranslations("marketing.ladder");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const n = Math.max(0, Math.min(5, Math.round(earned)));
  const label = t("list_label", { earned: localizeDigits(n, locale) });

  if (variant === "bars") {
    return (
      <Reveal
        as="ol"
        variant="grow"
        aria-label={label}
        className={cn("ks-ladder ks-ladder-bars grid grid-cols-5 items-end gap-1.5", className)}
      >
        {LADDER_RUNGS.map((key, i) => {
          const state = i < n ? "earned" : i === n ? "next" : "todo";
          return (
            <li key={key} className="flex min-w-0 flex-col justify-end gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "ks-rung block w-full rounded-[8px_8px_3px_3px]",
                  state === "earned" ? FILL[i] : "border-border-strong border-2 border-dashed",
                )}
                style={{ height: BAR_PX[i], "--ks-i": i } as React.CSSProperties}
              />
              <span
                className={cn(
                  "text-center text-[11px] leading-tight break-words",
                  state === "earned" ? "text-fg font-semibold" : "text-fg-muted",
                )}
              >
                {t(`rungs.${key}.label`)}
                <span className="sr-only">
                  {" — "}
                  {state === "earned" ? t("earned") : state === "next" ? t("next") : t("not_yet")}
                </span>
              </span>
            </li>
          );
        })}
      </Reveal>
    );
  }

  return (
    <Reveal
      as="ol"
      variant="grow"
      aria-label={label}
      className={cn(
        "ks-ladder flex flex-col gap-2 sm:grid sm:h-64 sm:grid-cols-5 sm:items-end sm:gap-2.5 lg:h-72",
        className,
      )}
    >
      {LADDER_RUNGS.map((key, i) => {
        const state = i < n ? "earned" : i === n ? "next" : "todo";
        return (
          <li
            key={key}
            className="w-[var(--ks-w)] min-w-[11rem] sm:h-[var(--ks-h)] sm:w-auto sm:min-w-0"
            style={
              { "--ks-i": i, "--ks-w": `${44 + 14 * i}%`, "--ks-h": `${36 + 16 * i}%` } as React.CSSProperties
            }
          >
            <div
              className={cn(
                "ks-rung flex h-full min-h-12 items-center justify-between gap-2 rounded-[10px] px-3 py-2",
                "sm:flex-col sm:items-start sm:justify-end sm:gap-0.5 sm:rounded-[14px_14px_4px_4px] sm:p-3",
                state === "earned"
                  ? FILL[i]
                  : "border-border-strong text-fg-body border-2 border-dashed bg-transparent",
              )}
            >
              {state === "next" ? (
                <span className="bg-surface text-fg ring-border-strong order-last rounded-pill px-2 py-0.5 text-[11px] font-semibold ring-1 sm:order-first sm:mb-auto">
                  {t("next")}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col sm:gap-0.5">
                <span className="flex items-center gap-1 text-sm leading-tight font-bold break-words">
                  {state === "earned" ? <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden /> : null}
                  {t(`rungs.${key}.label`)}
                </span>
                <span
                  className={cn(
                    "text-xs leading-snug break-words",
                    state === "earned" ? "" : "text-fg-muted",
                  )}
                >
                  {t(`rungs.${key}.hint`)}
                </span>
              </span>
              <span className="sr-only">
                {state === "earned" ? t("earned") : state === "next" ? "" : t("not_yet")}
              </span>
            </div>
          </li>
        );
      })}
    </Reveal>
  );
}
