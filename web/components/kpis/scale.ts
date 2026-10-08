/**
 * Pure helpers for the district heatmap and KPI meters (unit-tested in scale.test.ts).
 *
 * Sequential encoding = one hue (blue), light→dark, 5 ordinal bins. Ramp steps come from the
 * dataviz reference palette and pass the validator in --ordinal mode on both surfaces:
 *   light #86b6ef #5598e7 #2a78d6 #1c5cab #0d366b (light end 2.06:1 on #fcfcfb)
 *   dark  #184f95 #256abf #3987e5 #6da7ec #b7d3f6 (dark end 2.15:1 on #1a1a19; higher = brighter)
 * Zero renders as the neutral surface, suppressed cells as a dashed stub — never as a colour.
 */
import type { HeatmapCell, Phase1ExitRow } from "@/lib/api/types-mobility";

export const BIN_CLASSES = [
  "bg-[#86b6ef] dark:bg-[#184f95]",
  "bg-[#5598e7] dark:bg-[#256abf]",
  "bg-[#2a78d6] dark:bg-[#3987e5]",
  "bg-[#1c5cab] dark:bg-[#6da7ec]",
  "bg-[#0d366b] dark:bg-[#b7d3f6]",
] as const;
export const BINS = BIN_CLASSES.length;

export type CellState = "value" | "zero" | "suppressed" | "no_data";

export function numericValue(v: HeatmapCell["value"]): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function cellState(c: Pick<HeatmapCell, "value" | "suppressed">): CellState {
  if (c.suppressed) return "suppressed";
  const n = numericValue(c.value);
  if (n === null) return "no_data";
  return n === 0 ? "zero" : "value";
}

/** Equal-width bins over (0, max]; returns 0..BINS-1, or null for zero/negative/missing. */
export function binIndex(value: number | null, max: number | null): number | null {
  if (value === null || max === null || value <= 0 || max <= 0) return null;
  const i = Math.ceil((value / max) * BINS) - 1;
  return Math.min(BINS - 1, Math.max(0, i));
}

/** Upper bound of each bin, for the legend ("≤ 12"). */
export function binEdges(max: number | null): number[] {
  if (max === null || max <= 0) return [];
  return Array.from({ length: BINS }, (_, i) => (max * (i + 1)) / BINS);
}

export interface ProvinceGroup {
  code: number;
  name_en: string;
  name_ne: string;
  cells: HeatmapCell[];
}

/** Cells grouped by province, provinces in code order, districts in API order. */
export function groupByProvince(cells: HeatmapCell[]): ProvinceGroup[] {
  const map = new Map<number, ProvinceGroup>();
  for (const c of cells) {
    const p = c.district.province;
    if (!map.has(p.code)) map.set(p.code, { ...p, cells: [] });
    map.get(p.code)!.cells.push(c);
  }
  return [...map.values()].sort((a, b) => a.code - b.code);
}

/** 0–1 progress toward a phase-1 exit target. For "lt" (lower is better) targets, any value under the
 * target is complete and values above shrink proportionally. */
export function exitProgress(row: Phase1ExitRow): number {
  const { actual, target, comparator } = row;
  if (actual === null || actual === undefined || target <= 0) return 0;
  if (comparator === "lt") {
    if (actual < target) return 1;
    return Math.max(0, Math.min(1, target / Math.max(actual, 1e-9)));
  }
  return Math.max(0, Math.min(1, actual / target));
}
