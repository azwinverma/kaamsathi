import { describe, expect, it } from "vitest";
import type { HeatmapCell } from "@/lib/api/types-mobility";
import { binEdges, binIndex, cellState, exitProgress, groupByProvince } from "./scale";

const cell = (
  code: string,
  prov: number,
  value: HeatmapCell["value"],
  suppressed = false,
): HeatmapCell => ({
  district: {
    code,
    name_en: code,
    name_ne: code,
    province: { code: prov, name_en: `P${prov}`, name_ne: `P${prov}` },
  },
  value,
  sample: null,
  suppressed,
});

describe("heatmap scale", () => {
  it("bins values over (0, max]", () => {
    expect(binIndex(10, 10)).toBe(4);
    expect(binIndex(1, 10)).toBe(0);
    expect(binIndex(2, 10)).toBe(0);
    expect(binIndex(2.1, 10)).toBe(1);
    expect(binIndex(0, 10)).toBeNull();
    expect(binIndex(null, 10)).toBeNull();
    expect(binIndex(5, 0)).toBeNull();
    expect(binEdges(10)).toEqual([2, 4, 6, 8, 10]);
  });

  it("never colours suppressed or missing cells", () => {
    expect(cellState(cell("a", 1, null, true))).toBe("suppressed");
    expect(cellState(cell("a", 1, null))).toBe("no_data");
    expect(cellState(cell("a", 1, 0))).toBe("zero");
    expect(cellState(cell("a", 1, "19550.00"))).toBe("value");
  });

  it("groups by province in code order", () => {
    const g = groupByProvince([cell("x", 3, 1), cell("y", 1, 2), cell("z", 3, 0)]);
    expect(g.map((p) => p.code)).toEqual([1, 3]);
    expect(g[1].cells.map((c) => c.district.code)).toEqual(["x", "z"]);
  });
});

describe("exit progress", () => {
  it("handles gte and lt targets", () => {
    expect(
      exitProgress({ key: "workers", target: 1000, actual: 250, comparator: "gte", met: false }),
    ).toBe(0.25);
    expect(
      exitProgress({ key: "workers", target: 1000, actual: 1500, comparator: "gte", met: true }),
    ).toBe(1);
    expect(
      exitProgress({ key: "median_fill_days", target: 14, actual: 7, comparator: "lt", met: true }),
    ).toBe(1);
    expect(
      exitProgress({
        key: "median_fill_days",
        target: 14,
        actual: 28,
        comparator: "lt",
        met: false,
      }),
    ).toBe(0.5);
    expect(
      exitProgress({
        key: "median_fill_days",
        target: 14,
        actual: null,
        comparator: "lt",
        met: false,
      }),
    ).toBe(0);
  });
});
