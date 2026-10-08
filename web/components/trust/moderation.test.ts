import { describe, expect, it } from "vitest";
import en from "@/messages/src/moderation.en.json";
import ne from "@/messages/src/moderation.ne.json";
import { ALIAS_LANGUAGES } from "@/lib/api/types-moderation";
import {
  canAddEvidence,
  daysUntil,
  evidenceFileError,
  isDisputeDecided,
  MAX_EVIDENCE_BYTES,
  parseYearMonth,
  RATINGS_TABS,
  ratingsTabParams,
} from "./moderation";

function keys(o: object, p = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
  );
}

describe("dispute evidence", () => {
  it("allows uploads only while open, responded or appealed, up to 10 files", () => {
    expect(canAddEvidence("open", 0)).toBe(true);
    expect(canAddEvidence("employer_responded", null)).toBe(true);
    expect(canAddEvidence("appealed", 9)).toBe(true);
    expect(canAddEvidence("appealed", 10)).toBe(false);
    expect(canAddEvidence("resolved", 0)).toBe(false);
    expect(canAddEvidence("appeal_resolved", 0)).toBe(false);
  });

  it("validates file type and size", () => {
    expect(evidenceFileError(null)).toBe("required");
    expect(evidenceFileError({ type: "image/png", size: 1000 })).toBeNull();
    expect(evidenceFileError({ type: "application/pdf", size: MAX_EVIDENCE_BYTES })).toBeNull();
    expect(evidenceFileError({ type: "image/heic", size: 1000 })).toBe("type");
    expect(evidenceFileError({ type: "image/jpeg", size: MAX_EVIDENCE_BYTES + 1 })).toBe("size");
  });

  it("knows which statuses are decided", () => {
    expect(isDisputeDecided("resolved")).toBe(true);
    expect(isDisputeDecided("appeal_resolved")).toBe(true);
    expect(isDisputeDecided("appealed")).toBe(false);
  });
});

describe("appeal deadline", () => {
  const now = new Date("2026-10-08T10:00:00+05:45");
  it("counts whole days left and never goes negative", () => {
    expect(daysUntil("2026-10-10T10:00:00+05:45", now)).toBe(2);
    expect(daysUntil("2026-10-08T12:00:00+05:45", now)).toBe(1);
    expect(daysUntil("2026-10-01T10:00:00+05:45", now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("nonsense", now)).toBeNull();
  });
});

describe("rating moderation", () => {
  it("maps tabs to query params", () => {
    expect(ratingsTabParams("flagged")).toEqual({ status: "flagged", voided: "false" });
    expect(ratingsTabParams("hidden")).toEqual({ status: "hidden", voided: "false" });
    expect(ratingsTabParams("voided")).toEqual({ voided: "true" });
    expect(ratingsTabParams("all")).toEqual({});
  });

  it("parses month-only dates", () => {
    expect(parseYearMonth("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseYearMonth("2026-13")).toBeNull();
    expect(parseYearMonth("2026-09-01")).toBeNull();
  });

  it("has copy for every tab, alias language and in both locales", () => {
    for (const tab of RATINGS_TABS) {
      expect(en.moderation.ratings[`tab_${tab}`]).toBeTruthy();
      expect(en.moderation.ratings[`empty_${tab}`]).toBeTruthy();
    }
    for (const l of ALIAS_LANGUAGES) expect(ne.moderation.aliases.languages[l]).toBeTruthy();
    expect(keys(ne).sort()).toEqual(keys(en).sort());
  });

  it("explains that voided ratings stop counting toward reliability", () => {
    expect(en.moderation.ratings.void_explain).toMatch(/reliability/);
    expect(ne.moderation.ratings.void_explain).toMatch(/भरपर्दोपन/);
  });
});
