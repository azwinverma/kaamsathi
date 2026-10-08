import { describe, expect, it } from "vitest";
import { hoursToMinutes, isActionable, minutesToHours, timesheetWeekOf, weekDates } from "./utils";

describe("timesheet utils", () => {
  it("finds the Sunday of a week", () => {
    expect(timesheetWeekOf("2026-07-22")).toBe("2026-07-19"); // Wednesday → Sunday
    expect(timesheetWeekOf("2026-07-19")).toBe("2026-07-19");
    expect(timesheetWeekOf("2026-07-25")).toBe("2026-07-19"); // Saturday
  });

  it("converts minutes and hours", () => {
    expect(minutesToHours(480)).toBe(8);
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(null)).toBe(0);
    expect(hoursToMinutes("2.5")).toBe(150);
    expect(hoursToMinutes("1,5")).toBe(90);
    expect(Number.isNaN(hoursToMinutes("-1"))).toBe(true);
    expect(Number.isNaN(hoursToMinutes("abc"))).toBe(true);
  });

  it("lists week dates and actionable states", () => {
    expect(weekDates("2026-07-26")).toEqual([
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
    expect(isActionable({ status: "draft" })).toBe(true);
    expect(isActionable({ status: "submitted" })).toBe(true);
    expect(isActionable({ status: "approved" })).toBe(false);
    expect(isActionable({ status: "rejected" })).toBe(false);
  });
});
