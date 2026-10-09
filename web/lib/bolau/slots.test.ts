import { buildSlots, jsWeekday, ruleWeekday, summaryRules, weeklySummary } from "./slots";

// Friday 9 Oct 2026, 10:00 in Kathmandu (04:15 UTC).
const NOW = new Date("2026-10-09T04:15:00Z");
// Sunday = 0 (backend AvailabilityRule). 9 Oct 2026 is a Friday → 5.
const FRI = 5;
const SAT = 6;

describe("weekday mapping (API Sunday = 0)", () => {
  it("is the identity for Sunday-based rules", () => {
    expect(ruleWeekday(0)).toBe(0);
    expect(ruleWeekday(5)).toBe(5);
    expect(jsWeekday(6)).toBe(6);
  });
  it("can map a Monday-based numbering", () => {
    expect(ruleWeekday(0, "mon0")).toBe(6);
    expect(jsWeekday(0, "mon0")).toBe(1);
  });
});

describe("buildSlots", () => {
  const rules = [{ weekday: FRI, start_time: "08:00", end_time: "13:00" }];

  it("skips times inside the 60-minute lead time and fits the job length", () => {
    const [today] = buildSlots({ rules, now: NOW, days: 1 });
    expect(today.date).toBe("2026-10-09");
    // 10:00 now → earliest 11:00; a 60-min job must end by 13:00 → 11:00, 12:00.
    expect(today.slots.map((s) => s.time)).toEqual(["11:00", "12:00"]);
    expect(today.slots[0].start).toBe("2026-10-09T11:00:00+05:45");
  });

  it("longer jobs leave fewer start times", () => {
    const [today] = buildSlots({ rules, now: NOW, days: 1, durationMinutes: 120 });
    expect(today.slots.map((s) => s.time)).toEqual(["11:00"]);
  });

  it("days without a rule, time off and busy windows have no slots", () => {
    const days = buildSlots({
      rules: [...rules, { weekday: SAT, start_time: "09:00", end_time: "11:00" }],
      timeOff: [{ from_date: "2026-10-16", to_date: "2026-10-16" }],
      busy: [{ start: "2026-10-10T09:00:00+05:45", end: "2026-10-10T10:00:00+05:45" }],
      now: NOW,
      days: 8,
    });
    expect(days).toHaveLength(8);
    expect(days[1].date).toBe("2026-10-10");
    expect(days[1].slots.map((s) => s.time)).toEqual(["10:00"]); // 09:00 is booked
    expect(days[2].slots).toEqual([]); // Sunday: no rule
    expect(days[7].date).toBe("2026-10-16");
    expect(days[7].slots).toEqual([]); // Friday on leave
  });

  it("merges split shifts without duplicates", () => {
    const [today] = buildSlots({
      rules: [
        { weekday: FRI, start_time: "14:00", end_time: "16:00" },
        { weekday: FRI, start_time: "11:00", end_time: "13:00" },
      ],
      now: NOW,
      days: 1,
    });
    expect(today.slots.map((s) => s.time)).toEqual(["11:00", "12:00", "14:00", "15:00"]);
  });
});

describe("availability summary", () => {
  it("flattens the API's weekly ranges", () => {
    expect(
      summaryRules({ weekly: [{ weekday: 0, ranges: [["08:00", "12:00"], ["13:00", "17:00"]] }] }),
    ).toEqual([
      { weekday: 0, start_time: "08:00", end_time: "12:00" },
      { weekday: 0, start_time: "13:00", end_time: "17:00" },
    ]);
    expect(summaryRules(null)).toEqual([]);
  });
  it("groups weekdays with the same hours", () => {
    const rules = [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: "08:00:00", end_time: "18:00:00" }));
    expect(weeklySummary([...rules, { weekday: 6, start_time: "10:00", end_time: "14:00" }])).toEqual([
      { days: [0, 1, 2, 3, 4, 5], start: "08:00", end: "18:00" },
      { days: [6], start: "10:00", end: "14:00" },
    ]);
  });
});
