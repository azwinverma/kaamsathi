import { describe, expect, it } from "vitest";
import type { MinimumWage } from "@/lib/api/types";
import { checkMinimumWage } from "./utils";

const MW: MinimumWage = {
  effective_from: "2025-07-17",
  effective_from_bs: "2082-04-01",
  monthly_basic: "12170.00",
  monthly_da: "7380.00",
  monthly_total: "19550.00",
  daily: "754.00",
  hourly: "101.00",
  hourly_part_time: "107.00",
};

describe("checkMinimumWage — hourly (R005)", () => {
  it("uses the hourly minimum for full-time staff", () => {
    expect(checkMinimumWage({ wage_type: "hourly", hourly_wage: "100" }, MW)).toEqual({
      ok: false,
      amount: 100,
      minimum: 101,
    });
    expect(checkMinimumWage({ wage_type: "hourly", hourly_wage: "101" }, MW).ok).toBe(true);
  });

  it("uses the higher part-time minimum", () => {
    expect(checkMinimumWage({ wage_type: "hourly", hourly_wage: "105", part_time: true }, MW)).toEqual({
      ok: false,
      amount: 105,
      minimum: 107,
    });
    expect(checkMinimumWage({ wage_type: "hourly", hourly_wage: "107", part_time: true }, MW).ok).toBe(true);
  });

  it("is undecided without an amount", () => {
    expect(checkMinimumWage({ wage_type: "hourly", hourly_wage: "" }, MW).ok).toBeNull();
  });
});
