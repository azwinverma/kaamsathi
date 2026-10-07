import { describe, expect, it } from "vitest";
import type { PayrollRunListItem } from "@/lib/api/types";
import type { ComplianceItem, SSFFiling } from "@/lib/api/types-compliance";
import { filingRows, scoreTone, sortItems } from "./utils";

const run = (
  id: string,
  y: number,
  m: number,
  status: PayrollRunListItem["status"],
): PayrollRunListItem => ({
  id,
  bs_year: y,
  bs_month: m,
  status,
  period_start: "2026-07-17",
  period_end: "2026-08-16",
});

describe("compliance utils", () => {
  it("bands the score", () => {
    expect(scoreTone(100)).toBe("success");
    expect(scoreTone(85)).toBe("success");
    expect(scoreTone(70)).toBe("warning");
    expect(scoreTone(10)).toBe("danger");
  });

  it("puts action items first", () => {
    const items = [
      { key: "a", status: "ok" },
      { key: "b", status: "warning" },
      { key: "c", status: "action" },
      { key: "d", status: "ok" },
    ] as unknown as ComplianceItem[];
    expect(sortItems(items).map((i) => i.key)).toEqual(["c", "b", "a", "d"]);
  });

  it("merges approved/paid runs with filings", () => {
    const filing = {
      id: "f1",
      run: { id: "r1", bs_year: 2083, bs_month: 5, status: "paid" },
    } as SSFFiling;
    const orphan = {
      id: "f0",
      run: { id: "r0", bs_year: 2082, bs_month: 12, status: "paid" },
    } as SSFFiling;
    const rows = filingRows(
      [run("r2", 2083, 6, "draft"), run("r1", 2083, 5, "paid"), run("r3", 2083, 4, "approved")],
      [filing, orphan],
    );
    expect(rows.map((r) => [r.run.id, r.filing?.id ?? null])).toEqual([
      ["r1", "f1"],
      ["r3", null],
      ["r0", "f0"],
    ]);
  });
});
