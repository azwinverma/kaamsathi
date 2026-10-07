import type { PayrollRunListItem } from "@/lib/api/types";
import type { ComplianceItem, ComplianceItemStatus, SSFFiling } from "@/lib/api/types-compliance";

export type Tone = "success" | "warning" | "danger";

/** Score → colour band (85+ good, 60+ needs attention, else act now). */
export function scoreTone(score: number): Tone {
  if (score >= 85) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

const RANK: Record<ComplianceItemStatus, number> = { action: 0, warning: 1, ok: 2 };

/** Action items first, then warnings, then the all-good ones (stable within a group). */
export function sortItems(items: ComplianceItem[]): ComplianceItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => RANK[a.item.status] - RANK[b.item.status] || a.i - b.i)
    .map((x) => x.item);
}

export interface FilingRow {
  run: Pick<PayrollRunListItem, "id" | "bs_year" | "bs_month" | "status">;
  filing: SSFFiling | null;
}

/**
 * One row per approved/paid payroll run (newest first), with its SSF filing if prepared.
 * Filings whose run is not in the run list (older pages) are still shown.
 */
export function filingRows(runs: PayrollRunListItem[], filings: SSFFiling[]): FilingRow[] {
  const byRun = new Map(filings.map((f) => [f.run.id, f]));
  const rows: FilingRow[] = runs
    .filter((r) => r.status === "approved" || r.status === "paid")
    .map((r) => ({ run: r, filing: byRun.get(r.id) ?? null }));
  const seen = new Set(rows.map((r) => r.run.id));
  for (const f of filings) {
    if (!seen.has(f.run.id)) rows.push({ run: f.run, filing: f });
  }
  return rows.sort((a, b) => b.run.bs_year - a.run.bs_year || b.run.bs_month - a.run.bs_month);
}

export function filingStem(run: { bs_year: number; bs_month: number }): string {
  return `ssf-filing-${run.bs_year}-${String(run.bs_month).padStart(2, "0")}`;
}
