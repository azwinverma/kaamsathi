"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type RungState = "done" | "next" | "todo" | "blocked";

export interface LadderRung {
  key: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  state: RungState;
  /** Optional right-aligned detail (date, who verified). */
  meta?: React.ReactNode;
}

/**
 * Verification ladder (direction A signature): a vertical teal timeline. Earned rungs are filled
 * teal nodes joined by a teal rail; the next rung is outlined in blue; rungs not yet earned are
 * dashed outlines (never a grey "failure"). A blocked rung (rejected) shows a red cross + label.
 * State is always spoken (sr-only) and, for next/blocked, shown as text.
 */
export function VerificationLadder({
  rungs,
  label,
  className,
  dense,
}: {
  rungs: LadderRung[];
  label?: string;
  className?: string;
  dense?: boolean;
}) {
  const t = useTranslations("ledger.ladder");
  return (
    <ol aria-label={label ?? t("label")} className={cn("relative", className)}>
      {rungs.map((r, i) => {
        const last = i === rungs.length - 1;
        const railDone = r.state === "done" && rungs[i + 1]?.state === "done";
        return (
          <li
            key={r.key}
            className={cn("relative flex gap-3", last ? "" : dense ? "pb-3" : "pb-4")}
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 bottom-0 left-[7px] w-0.5",
                  railDone ? "bg-verified" : "bg-border",
                )}
              />
            ) : null}
            <Node state={r.state} />
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    r.state === "done"
                      ? "text-fg"
                      : r.state === "blocked"
                        ? "text-danger"
                        : "text-fg-body",
                  )}
                >
                  {r.title}
                  <span className="sr-only">
                    {" — "}
                    {r.state === "done"
                      ? t("reached")
                      : r.state === "next"
                        ? t("next")
                        : r.state === "blocked"
                          ? t("rejected")
                          : t("not_yet")}
                  </span>
                </p>
                {r.meta ? <span className="text-fg-muted tabular text-xs">{r.meta}</span> : null}
              </div>
              {r.hint ? <p className="text-fg-muted text-[13px] leading-5">{r.hint}</p> : null}
              {r.state === "next" ? (
                <p className="text-brand-text mt-0.5 text-xs font-semibold" aria-hidden>
                  {t("next")}
                </p>
              ) : r.state === "blocked" ? (
                <p className="text-danger mt-0.5 text-xs font-semibold" aria-hidden>
                  {t("rejected")}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Verification ladder, horizontal (direction A): the same rungs as a single row of nodes joined by
 * a rail — for header bands where the vertical ladder would be a second focal point. Rung titles
 * show from `md`; on phones a one-line summary ("4 of 6 · Next: Highly trusted") carries the state.
 */
export function LadderStrip({
  rungs,
  label,
  className,
}: {
  rungs: LadderRung[];
  label?: string;
  className?: string;
}) {
  const t = useTranslations("ledger.ladder");
  const done = rungs.filter((r) => r.state === "done").length;
  const next = rungs.find((r) => r.state === "next" || r.state === "blocked");
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-fg-muted mb-2 text-xs md:hidden" aria-hidden>
        {t("strip_summary", { done, total: rungs.length })}
        {next ? (
          <>
            {" · "}
            <span
              className={cn(
                "font-semibold",
                next.state === "blocked" ? "text-danger" : "text-brand-text",
              )}
            >
              {next.state === "blocked"
                ? t("rejected")
                : t("strip_next", { step: String(next.title) })}
            </span>
          </>
        ) : null}
      </p>
      <ol aria-label={label ?? t("label")} className="flex items-start">
        {rungs.map((r, i) => {
          const last = i === rungs.length - 1;
          const railDone = r.state === "done" && rungs[i + 1]?.state === "done";
          return (
            <li key={r.key} className={cn("min-w-0", last ? "shrink-0 md:flex-1" : "flex-1")}>
              <div className="flex items-center">
                <Node state={r.state} />
                {!last ? (
                  <span
                    aria-hidden
                    className={cn("mx-1 h-0.5 flex-1", railDone ? "bg-verified" : "bg-border")}
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-1.5 pr-3 text-xs leading-4 max-md:sr-only",
                  r.state === "done"
                    ? "text-fg-body"
                    : r.state === "next"
                      ? "text-brand-text font-semibold"
                      : r.state === "blocked"
                        ? "text-danger font-semibold"
                        : "text-fg-muted",
                )}
              >
                {r.title}
                <span className="sr-only">
                  {" — "}
                  {r.state === "done"
                    ? t("reached")
                    : r.state === "next"
                      ? t("next")
                      : r.state === "blocked"
                        ? t("rejected")
                        : t("not_yet")}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Node({ state }: { state: RungState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-[1] mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-verified text-fg-inverse",
        state === "next" && "border-brand bg-surface border-2",
        state === "todo" && "border-border-strong bg-surface border-2 border-dashed",
        state === "blocked" && "bg-danger text-fg-inverse",
      )}
    >
      {state === "done" ? <Check className="size-2.5 stroke-[3.5]" /> : null}
      {state === "blocked" ? <X className="size-2.5 stroke-[3.5]" /> : null}
    </span>
  );
}

/** Worker trust level 0–5 (apps.trust) → six rungs. `rejected` marks identity as blocked. */
export function useWorkerLadder(
  level: number | null | undefined,
  opts?: { rejected?: boolean; dense?: boolean },
): LadderRung[] {
  const t = useTranslations("ledger.ladder");
  const lvl = Math.max(0, Math.min(5, Math.round(level ?? 0)));
  return [0, 1, 2, 3, 4, 5].map((n) => {
    let state: RungState = n <= lvl ? "done" : n === lvl + 1 ? "next" : "todo";
    if (opts?.rejected && n === 1) state = "blocked";
    else if (opts?.rejected && n > 1) state = "todo";
    return {
      key: `rung-${n}`,
      title: t(`rung_${n}`),
      hint: opts?.dense ? undefined : t(`rung_${n}_hint`),
      state,
    };
  });
}

/** Employer KYB (unverified / pending / verified / rejected) → four rungs. */
export function useKybLadder(
  status: "unverified" | "pending" | "verified" | "rejected" | string | null | undefined,
  hasDocs?: boolean,
): LadderRung[] {
  const t = useTranslations("ledger.ladder");
  const docs = status === "pending" || status === "verified" || !!hasDocs;
  const states: RungState[] =
    status === "verified"
      ? ["done", "done", "done", "done"]
      : status === "rejected"
        ? ["done", "done", "blocked", "todo"]
        : status === "pending"
          ? ["done", "done", "next", "todo"]
          : ["done", docs ? "done" : "next", docs ? "next" : "todo", "todo"];
  return states.map((state, n) => ({
    key: `kyb-${n}`,
    title: t(`kyb_${n}`),
    hint: t(`kyb_${n}_hint`),
    state,
  }));
}
