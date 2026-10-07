import { describe, expect, it } from "vitest";
import en from "@/messages/src/trust.en.json";
import ne from "@/messages/src/trust.ne.json";
import { reliabilityTone } from "./trust-badges";

describe("reliabilityTone", () => {
  it("bands the 0–100 reliability score", () => {
    expect(reliabilityTone(95)).toBe("success");
    expect(reliabilityTone(80)).toBe("success");
    expect(reliabilityTone(79)).toBe("brand");
    expect(reliabilityTone(60)).toBe("brand");
    expect(reliabilityTone(59)).toBe("warning");
  });
});

describe("trust copy", () => {
  it("never calls the reliability score a credit score (except to say it is not one)", () => {
    expect(en.trust.reliability_tooltip).toMatch(/not a credit score/);
    expect(ne.trust.reliability_tooltip).toMatch(/कर्जा अंक होइन/);
    expect(JSON.stringify(en).match(/credit score/g)).toHaveLength(1);
  });
  it("has a label for every verification level", () => {
    for (const lvl of ["0", "1", "2", "3", "4", "5"] as const) {
      expect(en.trust.level[lvl]).toBeTruthy();
      expect(ne.trust.level[lvl]).toBeTruthy();
    }
  });
});
