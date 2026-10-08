"use client";
/** Ops worker detail: languages (E004) and profile completeness (E008). */
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ProfileCompleteness, WorkerLanguage } from "@/lib/api/types-moderation";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { clampPercent, completenessTone, isKnownLanguage } from "./languages";

const BAR: Record<ReturnType<typeof completenessTone>, string> = {
  success: "bg-success",
  brand: "bg-brand",
  warning: "bg-warning",
};

export function LanguageChips({ languages }: { languages: WorkerLanguage[] | undefined }) {
  const tl = useTranslations("moderation.languages");
  if (!languages?.length) return <span className="text-fg-subtle">{tl("none")}</span>;
  return (
    <ul className="flex flex-wrap justify-end gap-1.5" aria-label={tl("title")}>
      {languages.map((l) => (
        <li key={l.language}>
          <Badge tone="outline">
            {l.language_label || (isKnownLanguage(l.language) ? tl(`names.${l.language}`) : l.language)}
            <span className="font-normal text-fg-muted">
              · {l.proficiency_label || tl(`proficiency_options.${l.proficiency}`)}
            </span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function ProfileCompletenessCard({ completeness }: { completeness: ProfileCompleteness | undefined }) {
  const tc = useTranslations("moderation.completeness");
  const f = useFormat();
  if (!completeness) return null;
  const pct = clampPercent(completeness.percent);
  const tone = completenessTone(pct);
  return (
    <Card>
      <CardHeader
        title={tc("title")}
        description={pct >= 100 ? tc("all_done") : tc("hint")}
        action={<span className="text-lg font-semibold text-fg tabular">{f.digits(pct)}%</span>}
      />
      <CardBody className="space-y-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-hover"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={tc("percent_aria", { percent: pct })}
        >
          <div className={cn("h-full rounded-full transition-all", BAR[tone])} style={{ width: `${pct}%` }} />
        </div>
        <ul className="space-y-2">
          {completeness.items.map((it) => (
            <li key={it.key} className="flex items-start gap-2 text-sm">
              {it.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
              )}
              <span className={it.done ? "text-fg" : "text-fg-muted"}>
                {it.label || tc(`items.${it.key}`)}
                <span className="sr-only"> — {it.done ? tc("done") : tc("missing")}</span>
              </span>
              {!it.done ? (
                <Badge tone="warning" className="ml-auto" aria-hidden>
                  {tc("missing")}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
