import { describe, expect, it } from "vitest";
import type { RosterRow } from "@/lib/api/types-scheduling";
import { cellValue, editKey, editsToEntries, isActiveOn, OFF, weekStartOf } from "./utils";

const row: RosterRow = {
  employment_id: "e1",
  worker_name: "Ram",
  designation: "Cook",
  site_id: "s1",
  default_shift_id: "day",
  start_date: "2026-01-01",
  end_date: "2026-10-08",
  cells: {
    "2026-10-04": { shift_id: "day", site_id: "s1", is_off: false },
    "2026-10-05": { shift_id: null, site_id: null, is_off: true },
    "2026-10-06": null,
  },
};

describe("roster utils", () => {
  it("finds the Sunday week start", () => {
    expect(weekStartOf("2026-10-07")).toBe("2026-10-04"); // Wednesday
    expect(weekStartOf("2026-10-04")).toBe("2026-10-04"); // Sunday
    expect(weekStartOf("2026-10-10")).toBe("2026-10-04"); // Saturday
  });

  it("encodes cells", () => {
    expect(cellValue(row.cells["2026-10-04"])).toBe("day");
    expect(cellValue(row.cells["2026-10-05"])).toBe(OFF);
    expect(cellValue(null)).toBe("");
  });

  it("checks employment dates", () => {
    expect(isActiveOn(row, "2026-10-08")).toBe(true);
    expect(isActiveOn(row, "2026-10-09")).toBe(false);
  });

  it("only sends changed cells", () => {
    const entries = editsToEntries([row], {
      [editKey("e1", "2026-10-04")]: "day", // unchanged
      [editKey("e1", "2026-10-05")]: "night",
      [editKey("e1", "2026-10-06")]: OFF,
      [editKey("e1", "2026-10-04x")]: "",
    });
    expect(entries).toEqual([
      { employment_id: "e1", date: "2026-10-05", is_off: false, shift_id: "night", site_id: null },
      { employment_id: "e1", date: "2026-10-06", is_off: true, shift_id: null, site_id: null },
    ]);
  });
});
