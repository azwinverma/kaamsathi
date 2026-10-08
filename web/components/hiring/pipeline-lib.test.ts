import { describe, expect, it } from "vitest";
import type { MatchingWeightKey, MatchingWeights } from "@/lib/api/types-pipeline";
import {
  addTag,
  changedWeights,
  extractShareToken,
  invalidWeights,
  ktmParts,
  newRequirementRow,
  normalizeTag,
  rowProblem,
  rowToInput,
} from "./pipeline-lib";

const TOKEN = "Ab3_dEf-GhIjKlMnOpQrStUvWxYz0123";

describe("extractShareToken", () => {
  it("reads the token from a share link", () => {
    expect(extractShareToken(`https://kaamsathi.com/p/s/${TOKEN}`)).toBe(TOKEN);
    expect(extractShareToken(`  https://x.np/en/p/s/${TOKEN}/?utm=1#top `)).toBe(TOKEN);
    expect(extractShareToken(`kaamsathi.com/p/s/${TOKEN}?ref=sms`)).toBe(TOKEN);
  });
  it("accepts a bare token", () => {
    expect(extractShareToken(TOKEN)).toBe(TOKEN);
  });
  it("rejects junk", () => {
    expect(extractShareToken("")).toBeNull();
    expect(extractShareToken(null)).toBeNull();
    expect(extractShareToken("hello")).toBeNull();
    expect(extractShareToken("https://kaamsathi.com/p/abc")).toBeNull();
    expect(extractShareToken("has spaces in it but long enough")).toBeNull();
  });
});

describe("tags", () => {
  it("normalises", () => {
    expect(normalizeTag("  Night   Shift ")).toBe("night shift");
  });
  it("adds, rejecting empty / duplicate / too long / over the limit", () => {
    expect(addTag([], " Urgent ")).toEqual({ ok: true, tags: ["urgent"] });
    expect(addTag(["urgent"], "URGENT")).toEqual({ ok: false, reason: "duplicate" });
    expect(addTag([], "   ")).toEqual({ ok: false, reason: "empty" });
    expect(addTag([], "x".repeat(31))).toEqual({ ok: false, reason: "too_long" });
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(addTag(ten, "new")).toEqual({ ok: false, reason: "limit" });
  });
});

describe("requirement rows", () => {
  it("flags empty rows and bad years", () => {
    expect(rowProblem(newRequirementRow())).toBe("empty");
    expect(rowProblem(newRequirementRow({ min_years: "abc" }))).toBe("years_invalid");
    expect(rowProblem(newRequirementRow({ min_years: "51" }))).toBe("years_invalid");
    expect(rowProblem(newRequirementRow({ credential_kind: "safety" }))).toBeNull();
    expect(rowProblem(newRequirementRow({ min_years: "३" }))).toBeNull();
  });
  it("converts to the API shape", () => {
    expect(
      rowToInput(
        newRequirementRow({
          trade: "cook",
          nstb_level_min: "level2",
          min_years: "३",
          required: false,
        }),
      ),
    ).toEqual({
      trade: "cook",
      credential_kind: null,
      nstb_level_min: "level2",
      min_years: 3,
      required: false,
    });
  });
});

describe("ktmParts", () => {
  it("splits an ISO datetime in Kathmandu time", () => {
    expect(ktmParts("2026-10-08T04:15:00Z")).toEqual({ date: "2026-10-08", time: "10:00" });
    expect(ktmParts("2026-10-08T23:00:00+05:45")).toEqual({ date: "2026-10-08", time: "23:00" });
    expect(ktmParts(null)).toBeNull();
  });
});

describe("matching weights", () => {
  const saved = {
    trade: 50,
    district: 20,
    verified: 10,
    nstb_per_level: 5,
    experience_per_year: 2,
    experience_max: 10,
    reliability_max: 10,
    preferred_district: 5,
    outcomes_max: 10,
    requirement_met: 5,
    wage_penalty: 15,
    declined_penalty: 20,
  } satisfies MatchingWeights;
  const draft = Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)])) as Record<
    MatchingWeightKey,
    string
  >;
  it("returns only changed keys", () => {
    expect(changedWeights(saved, draft)).toEqual({});
    expect(changedWeights(saved, { ...draft, trade: "६०", district: "x" })).toEqual({ trade: 60 });
  });
  it("checks limits", () => {
    expect(invalidWeights({ ...draft, trade: "200" }, { trade: { min: 0, max: 100 } })).toEqual([
      "trade",
    ]);
    expect(invalidWeights({ ...draft, verified: "" }, {})).toEqual(["verified"]);
  });
});
