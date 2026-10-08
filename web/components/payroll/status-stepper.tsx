"use client";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PayrollRun, PayrollStatus } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const ORDER: PayrollStatus[] = ["draft", "approved", "paid"];

/** draft → approved → paid, with the timestamp of each completed step. */
export function StatusStepper({ run, className }: { run: PayrollRun; className?: string }) {
  const t = useTranslations("payroll_page.steps");
  const tp = useTranslations("payroll");
  const f = useFormat();
  const currentIdx = ORDER.indexOf(run.status);
  const when: Record<PayrollStatus, string | null | undefined> = {
    draft: run.created_at,
    approved: run.approved_at,
    paid: run.paid_at,
  };

  return (
    <ol aria-label={t("label")} className={cn("flex items-start", className)}>
      {ORDER.map((step, i) => {
        const done = i < currentIdx || (i === currentIdx && step === "paid");
        const current = i === currentIdx && !done;
        const reached = i <= currentIdx;
        const at = when[step];
        return (
          <li
            key={step}
            className="relative flex flex-1 flex-col items-center text-center"
            aria-current={current ? "step" : undefined}
          >
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2",
                  reached ? "bg-brand" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold tabular",
                done && "border-brand bg-brand text-brand-fg",
                current && "border-brand bg-surface text-brand-text",
                !reached && "border-border bg-surface text-fg-muted",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : f.digits(i + 1)}
            </span>
            <span className={cn("mt-2 text-sm font-medium", reached ? "text-fg" : "text-fg-muted")}>
              {tp(step)}
            </span>
            <span className="sr-only">
              {done ? t("complete") : current ? t("current") : t("pending")}
            </span>
            <span className="mt-0.5 text-xs text-fg-muted tabular">
              {reached && at ? t(`${step}_hint`, { date: f.dateTime(at) }) : reached ? "" : t("pending")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
