import type { PayrollRunListItem, PayrollTotals, Payslip } from "@/lib/api/types";

/** Parse a decimal string / number safely. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 dp (money). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sumBy(rows: Payslip[], key: keyof Payslip): number {
  return round2(rows.reduce((acc, r) => acc + num(r[key] as string | number), 0));
}

/** ssf_employee + tds + advance + other. */
export function totalDeductions(t: Partial<PayrollTotals> | undefined | null): number {
  if (!t) return 0;
  return round2(num(t.ssf_employee) + num(t.tds) + num(t.advance_recovery) + num(t.other_deductions));
}

/** Read an optional `<field>_bs` companion that the contract promises but types may omit. */
export function bsField(obj: object, field: string): string | undefined {
  const v = (obj as Record<string, unknown>)[`${field}_bs`];
  return typeof v === "string" ? v : undefined;
}

export function runFileStem(run: Pick<PayrollRunListItem, "bs_year" | "bs_month">): string {
  return `${run.bs_year}-${String(run.bs_month).padStart(2, "0")}`;
}

/** Ashwin (6) & Kartik (7) — when Dashain allowance is usually paid. */
export function isFestivalMonth(month: number): boolean {
  return month === 6 || month === 7;
}
