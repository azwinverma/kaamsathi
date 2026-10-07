// @vitest-environment node
import {
  adToBs,
  bsMonthLength,
  bsToAd,
  fiscalYear,
  formatBs,
  formatMoney,
  isValidPhone,
  normalizePhone,
  toDevanagariDigits,
  toLatinDigits,
  todayIso,
} from "./format";

describe("digits", () => {
  it("round-trips Devanagari numerals", () => {
    expect(toDevanagariDigits("2083-06-21")).toBe("२०८३-०६-२१");
    expect(toLatinDigits("२०८३-०६-२१")).toBe("2083-06-21");
  });
});

describe("money", () => {
  it("groups the South Asian way and shows the rupee prefix", () => {
    const en = formatMoney("1250000.00", "en");
    expect(en).toContain("12,50,000");
    const ne = formatMoney("19550.00", "ne");
    expect(ne).toContain("१९,५५०");
  });
});

describe("BS calendar", () => {
  it("matches the contract example: 7 Oct 2026 = 21 Ashwin 2083", () => {
    expect(adToBs("2026-10-07")).toEqual({ year: 2083, month: 6, day: 21 });
    expect(bsToAd({ year: 2083, month: 6, day: 21 })).toBe("2026-10-07");
    expect(formatBs("2083-06-21", "en")).toContain("Ashwin");
  });

  it("round-trips every day of a BS year", () => {
    for (let month = 1; month <= 12; month++) {
      const days = bsMonthLength(2083, month);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(32);
      for (let day = 1; day <= days; day++) {
        const ad = bsToAd({ year: 2083, month, day });
        expect(ad).not.toBeNull();
        expect(adToBs(ad!)).toEqual({ year: 2083, month, day });
      }
    }
  });

  it("computes the Nepali fiscal year (starts in Shrawan)", () => {
    expect(fiscalYear({ year: 2083, month: 4, day: 1 })).toBe("2083/84");
    expect(fiscalYear({ year: 2083, month: 3, day: 32 })).toBe("2082/83");
  });

  it("uses Nepal time (UTC+05:45) for today", () => {
    // 20:00 UTC on 6 Oct is already 7 Oct in Kathmandu.
    expect(todayIso(new Date("2026-10-06T20:00:00Z"))).toBe("2026-10-07");
  });
});

describe("phone", () => {
  it("accepts 97/98 ten-digit mobiles after normalising", () => {
    expect(normalizePhone("+977-9841000001")).toBe("9841000001");
    expect(isValidPhone("9841000001")).toBe(true);
    expect(isValidPhone("9612345678")).toBe(false);
    expect(isValidPhone("98410000")).toBe(false);
  });
});
