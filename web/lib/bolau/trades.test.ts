import { orderTrades, tradeFromPrice } from "./trades";

const tr = (code: string) => ({ code, name_en: code, name_ne: code });

describe("bolau trades", () => {
  it("puts household trades first in the picker order, others keep API order", () => {
    const out = orderTrades([tr("welder"), tr("cook"), tr("driver"), tr("electrician"), tr("plumber")]);
    expect(out.map((t) => t.code)).toEqual(["electrician", "plumber", "cook", "welder", "driver"]);
    expect(orderTrades([tr("cook"), tr("electrician")], 1).map((t) => t.code)).toEqual(["electrician"]);
  });

  it("from-price: lowest fixed, else hourly, else hidden (k-anonymity)", () => {
    const s = (min: string) => ({ min, median: min, max: min });
    expect(tradeFromPrice({ price: { fixed: s("500.00"), hourly: s("300.00") } })).toEqual({ amount: "500.00", per: "fixed" });
    expect(tradeFromPrice({ price: { fixed: null, hourly: s("300.00") } })).toEqual({ amount: "300.00", per: "hourly" });
    expect(tradeFromPrice({ price: { fixed: null, hourly: null } })).toBeNull();
    expect(tradeFromPrice({})).toBeNull();
  });
});
