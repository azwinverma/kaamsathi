import { estimateToSipalu, feeLine, freeCancelUntil, insideFreeWindow, priceLabel, ratingText } from "./price";

describe("priceLabel", () => {
  it("formats fixed and hourly prices with lakh grouping", () => {
    expect(priceLabel({ price_type: "fixed", price: "600.00" }, "en")).toEqual({
      key: "fixed",
      values: { price: "Rs. 600", visit_fee: "" },
    });
    expect(priceLabel({ price_type: "hourly", price: "1250" }, "en").values.price).toBe("Rs. 1,250");
    expect(priceLabel({ price_type: "hourly", price: "350" }, "en").key).toBe("hourly");
  });
  it("uses Devanagari digits in Nepali", () => {
    expect(priceLabel({ price_type: "fixed", price: "600" }, "ne").values.price).toBe("रु. ६००");
  });
  it("visit-then-quote shows the visit fee, or a free visit", () => {
    expect(priceLabel({ price_type: "visit_then_quote", price: "0", visit_fee: "200" }, "en")).toEqual({
      key: "visit_then_quote",
      values: { price: "Rs. 0", visit_fee: "Rs. 200" },
    });
    expect(priceLabel({ price_type: "visit_then_quote", price: null, visit_fee: null }, "en").key).toBe("visit_free");
  });
  it("falls back to 'price on request' without a price", () => {
    expect(priceLabel({ price_type: "fixed", price: null }, "en").key).toBe("ask");
  });
});

describe("estimateToSipalu", () => {
  it("fixed is the price", () => {
    expect(estimateToSipalu({ price_type: "fixed", price: "600" }, 240)).toBe(600);
  });
  it("hourly rounds up to the half hour, minimum one hour", () => {
    expect(estimateToSipalu({ price_type: "hourly", price: "300" }, 30)).toBe(300);
    expect(estimateToSipalu({ price_type: "hourly", price: "300" }, 90)).toBe(450);
    expect(estimateToSipalu({ price_type: "hourly", price: "300" }, 100)).toBe(600);
  });
  it("visit-then-quote is just the visit fee", () => {
    expect(estimateToSipalu({ price_type: "visit_then_quote", price: "0", visit_fee: "200" })).toBe(200);
  });
});

describe("feeLine (KaamSathi booking fee, paid by the Ghardhani only)", () => {
  it("shows the fee when charged", () => {
    expect(feeLine("49.00", "pending", "en")).toEqual({ key: "fee", amount: "Rs. 49" });
    expect(feeLine("49.00", "enabled", "ne")).toEqual({ key: "fee", amount: "रु. ४९" });
  });
  it("says waived while the gateway is off or the fee is zero", () => {
    expect(feeLine("49.00", "waived", "en").key).toBe("waived");
    expect(feeLine("49.00", "disabled", "en").key).toBe("waived");
    expect(feeLine("0", "pending", "en").key).toBe("waived");
  });
  it("reports refunds", () => {
    expect(feeLine("49", "refunded", "en")).toEqual({ key: "refunded", amount: "Rs. 49" });
  });
});

describe("free cancellation window", () => {
  const start = "2026-10-10T14:00:00+05:45";
  it("ends two hours before the start by default", () => {
    expect(freeCancelUntil(start).toISOString()).toBe("2026-10-10T06:15:00.000Z");
  });
  it("is open before and closed after", () => {
    expect(insideFreeWindow(start, new Date("2026-10-10T06:00:00Z"))).toBe(true);
    expect(insideFreeWindow(start, new Date("2026-10-10T06:30:00Z"))).toBe(false);
    expect(insideFreeWindow(start, new Date("2026-10-10T04:30:00Z"), 4)).toBe(false);
  });
});

describe("ratingText", () => {
  it("one decimal, null when unrated", () => {
    expect(ratingText("4.75", 12)).toBe("4.8");
    expect(ratingText(5, 1)).toBe("5.0");
    expect(ratingText(null, 0)).toBeNull();
    expect(ratingText("4.5", 0)).toBeNull();
  });
});
