import { describe, expect, it } from "vitest";
import { attendanceSummary, formatPct, parsePct, toTimeInput } from "./utils";

describe("training utils", () => {
  it("formats percentages and hides missing values", () => {
    expect(formatPct(62.5)).toBe("62.5%");
    expect(formatPct(100)).toBe("100%");
    expect(formatPct(33.333)).toBe("33.3%");
    expect(formatPct(66.6, 0)).toBe("67%");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(null)).toBeNull();
    expect(formatPct(undefined)).toBeNull();
    expect(formatPct(Number.NaN)).toBeNull();
  });

  it("summarises enrolment attendance", () => {
    expect(attendanceSummary({ sessions: 10, present: 8, pct: 80 })).toBe("8/10 (80%)");
    expect(attendanceSummary({ sessions: 3, present: 2, pct: null })).toBe("2/3 (67%)");
    expect(attendanceSummary({ sessions: 0, present: 0, pct: null })).toBeNull();
    expect(attendanceSummary(undefined)).toBeNull();
  });

  it("normalises time inputs", () => {
    expect(toTimeInput("09:30:00")).toBe("09:30");
    expect(toTimeInput("9:05")).toBe("09:05");
    expect(toTimeInput(null)).toBe("");
  });

  it("parses percentage inputs", () => {
    expect(parsePct("")).toBe(0);
    expect(parsePct("75")).toBe(75);
    expect(parsePct("७५")).toBe(75);
    expect(parsePct("101")).toBeNull();
    expect(parsePct("7.5")).toBeNull();
    expect(parsePct("-1")).toBeNull();
  });
});
