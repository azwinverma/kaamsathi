import { describe, expect, it } from "vitest";
import { previousBsMonth } from "./utils";

describe("payroll utils", () => {
  it("defaults a new run to the last completed BS month", () => {
    expect(previousBsMonth({ year: 2083, month: 8 })).toEqual({ year: 2083, month: 7 });
    expect(previousBsMonth({ year: 2083, month: 1 })).toEqual({ year: 2082, month: 12 });
  });
});
