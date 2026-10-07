"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useMinimumWage } from "@/lib/api/hooks/ref";
import type { WageType } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { minimumFor } from "./lib";

/** Live minimum-wage check against GET /ref/minimum-wage. */
export function useWageCheck() {
  const t = useTranslations("hiring.wage");
  const f = useFormat();
  const { data: mw, isLoading } = useMinimumWage();
  return React.useMemo(
    () => ({
      mw,
      isLoading,
      min: (wt: WageType) => minimumFor(mw, wt),
      /** Hint text describing the applicable minimum. */
      hint: (wt: WageType): string | undefined => {
        if (!mw) return isLoading ? t("loading") : undefined;
        const date = f.bs(mw.effective_from_bs) || f.ad(mw.effective_from);
        return wt === "monthly"
          ? t("minimum_monthly", {
              amount: f.money(mw.monthly_total),
              basic: f.money(mw.monthly_basic),
              da: f.money(mw.monthly_da),
              date,
            })
          : t("minimum_daily", { amount: f.money(mw.daily), date });
      },
      /** Error message when `amount` is below the minimum for the wage type. */
      below: (wt: WageType, amount: number | null): string | undefined => {
        const m = minimumFor(mw, wt);
        if (m === null || amount === null) return undefined;
        return amount < m ? t("below", { amount: f.money(m) }) : undefined;
      },
    }),
    [mw, isLoading, t, f],
  );
}
