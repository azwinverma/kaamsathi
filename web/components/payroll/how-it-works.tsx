"use client";
import { BadgeCheck, CalendarCheck, FileSpreadsheet, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "attendance", icon: CalendarCheck },
  { key: "sheet", icon: FileSpreadsheet },
  { key: "approve", icon: BadgeCheck },
  { key: "pay", icon: Wallet },
] as const;

/** Four-step explainer: hajiri → wage sheet → approve → mark paid. */
export function HowPayrollWorks({ className }: { className?: string }) {
  const t = useTranslations("payroll_page.how");
  return (
    <section aria-labelledby="how-payroll-title" className={cn("rounded-dense border border-border bg-surface p-5 shadow-sm", className)}>
      <h2 id="how-payroll-title" className="text-sm font-semibold text-fg">
        {t("title")}
      </h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ key, icon: Icon }, i) => (
          <li key={key} className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-text">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-fg">
                <span className="sr-only">{i + 1}. </span>
                {t(`${key}_title`)}
              </p>
              <p className="text-xs leading-relaxed text-fg-muted">{t(`${key}_body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
