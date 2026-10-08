"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ListChecks, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fieldset } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { NativeSelect } from "@/components/ui/select";
import { TradeSelect } from "@/components/shared/selects";
import {
  MAX_REQUIREMENTS,
  REQUIREMENT_CREDENTIAL_KINDS,
  REQUIREMENT_NSTB_LEVELS,
  type JobRequirement,
  type RequirementCredentialKind,
  type RequirementNstbLevel,
} from "@/lib/api/types-pipeline";
import { cn } from "@/lib/utils";
import { newRequirementRow, type RequirementRow } from "./pipeline-lib";

/** "Extra requirements" repeater for the job form (J002). Up to 10 rows. */
export function RequirementsEditor({
  rows,
  onChange,
  errors,
  jobTradeName,
}: {
  rows: RequirementRow[];
  onChange: (rows: RequirementRow[]) => void;
  /** Per-row error messages, keyed by row index. */
  errors?: Record<number, string | undefined>;
  /** Display name of the job's trade (default when a row leaves trade blank). */
  jobTradeName?: string | null;
}) {
  const t = useTranslations("pipeline.requirements");
  const full = rows.length >= MAX_REQUIREMENTS;

  const patch = (i: number, p: Partial<RequirementRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <Fieldset legend={t("title")} description={t("hint")}>
      {rows.length ? (
        <ol className="space-y-3">
          {rows.map((row, i) => {
            const id = `req-${row.key}`;
            const err = errors?.[i];
            return (
              <li
                key={row.key}
                className={cn(
                  "border-border bg-surface-muted/40 space-y-3 rounded-dense border p-3",
                  err && "border-danger/50",
                )}
                aria-label={t("row_label", { n: i + 1 })}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${id}-trade`} className="text-fg text-sm font-medium">
                      {t("trade")}
                    </label>
                    <TradeSelect
                      id={`${id}-trade`}
                      value={row.trade}
                      onChange={(v) => patch(i, { trade: v })}
                      placeholder={
                        jobTradeName
                          ? t("trade_default_named", { trade: jobTradeName })
                          : t("trade_default")
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${id}-kind`} className="text-fg text-sm font-medium">
                      {t("kind")}
                    </label>
                    <NativeSelect
                      id={`${id}-kind`}
                      value={row.credential_kind}
                      onChange={(e) =>
                        patch(i, {
                          credential_kind: e.target.value as RequirementCredentialKind | "",
                        })
                      }
                      placeholder={t("any")}
                      options={REQUIREMENT_CREDENTIAL_KINDS.map((k) => ({
                        value: k,
                        label: t(`kinds.${k}`),
                      }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${id}-nstb`} className="text-fg text-sm font-medium">
                      {t("nstb")}
                    </label>
                    <NativeSelect
                      id={`${id}-nstb`}
                      value={row.nstb_level_min}
                      onChange={(e) =>
                        patch(i, { nstb_level_min: e.target.value as RequirementNstbLevel | "" })
                      }
                      placeholder={t("any")}
                      options={REQUIREMENT_NSTB_LEVELS.map((l) => ({
                        value: l,
                        label: t(`levels.${l}`),
                      }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${id}-years`} className="text-fg text-sm font-medium">
                      {t("years")}
                    </label>
                    <Input
                      id={`${id}-years`}
                      inputMode="numeric"
                      placeholder={t("years_placeholder")}
                      value={row.min_years}
                      onChange={(e) => patch(i, { min_years: e.target.value })}
                      aria-invalid={err ? true : undefined}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Segmented<"required" | "preferred">
                    size="sm"
                    label={t("importance", { n: i + 1 })}
                    value={row.required ? "required" : "preferred"}
                    onChange={(v) => patch(i, { required: v === "required" })}
                    options={[
                      { value: "required", label: t("required") },
                      { value: "preferred", label: t("preferred") },
                    ]}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label={t("remove", { n: i + 1 })}
                  >
                    <Trash2 aria-hidden />
                    {t("remove_short")}
                  </Button>
                </div>
                {err ? (
                  <p
                    role="alert"
                    className="text-danger flex items-start gap-1 text-xs font-medium"
                  >
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                    {err}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rows, newRequirementRow()])}
          disabled={full}
        >
          <Plus aria-hidden />
          {t("add")}
        </Button>
        <span className="text-fg-muted text-xs">
          {full ? t("limit", { max: MAX_REQUIREMENTS }) : t("required_hint")}
        </span>
      </div>
    </Fieldset>
  );
}

/** Requirement chips (job detail, ops job). Required rows are emphasised. */
export function RequirementChips({
  requirements,
  className,
}: {
  requirements: JobRequirement[] | undefined;
  className?: string;
}) {
  const t = useTranslations("pipeline.requirements");
  if (!requirements?.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={t("title")}>
      {requirements.map((r) => (
        <li key={r.id}>
          <Badge
            tone={r.required ? "brand" : "outline"}
            title={r.required ? t("required") : t("preferred")}
          >
            <ListChecks aria-hidden />
            {r.label}
            <span className="sr-only"> ({r.required ? t("required") : t("preferred")})</span>
            {!r.required ? (
              <span className="text-fg-muted font-normal" aria-hidden>
                · {t("preferred")}
              </span>
            ) : null}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
