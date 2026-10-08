import { describe, expect, it } from "vitest";
import type { RosterRow } from "@/lib/api/types-scheduling";
import {
  cellValue,
  cellWarningText,
  editKey,
  editsToEntries,
  isActiveOn,
  OFF,
  summariseWarnings,
  weekStartOf,
} from "./utils";

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

describe("roster warnings (O005)", () => {
  it("maps cell warning codes to labels", () => {
    expect(
      cellWarningText(
        { warnings: { "2026-10-04": ["on_leave", "conflict_elsewhere"] } },
        "2026-10-04",
        { on_leave: "On approved leave" },
      ),
    ).toEqual(["On approved leave", "conflict_elsewhere"]);
    expect(cellWarningText({}, "2026-10-04", {})).toEqual([]);
  });

  it("groups save warnings per worker-day, sorted by name then date", () => {
    const rows = [
      { employment_id: "e1", worker_name: "Sita" },
      { employment_id: "e2", worker_name: "Hari" },
    ];
    const out = summariseWarnings(
      [
        { employment_id: "e1", date: "2026-10-05", code: "holiday", message: "Public holiday" },
        { employment_id: "e1", date: "2026-10-05", code: "on_leave", message: "On leave" },
        { employment_id: "e1", date: "2026-10-05", code: "on_leave", message: "On leave" },
        { employment_id: "e2", date: "2026-10-06", code: "weekly_off", message: "Weekly off" },
        {
          employment_id: "e1",
          date: "2026-10-04",
          code: "conflict_elsewhere",
          message: "Elsewhere",
        },
        { employment_id: "zz", date: "2026-10-04", code: "holiday", message: "Public holiday" },
      ],
      rows,
      "?",
    );
    expect(out.map((w) => [w.name, w.date, w.messages])).toEqual([
      ["?", "2026-10-04", ["Public holiday"]],
      ["Hari", "2026-10-06", ["Weekly off"]],
      ["Sita", "2026-10-04", ["Elsewhere"]],
      ["Sita", "2026-10-05", ["Public holiday", "On leave"]],
    ]);
    expect(summariseWarnings(undefined, rows)).toEqual([]);
  });
});
