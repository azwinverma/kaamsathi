import { describe, expect, it } from "vitest";
import en from "@/messages/src/moderation.en.json";
import ne from "@/messages/src/moderation.ne.json";
import {
  LANGUAGE_PROFICIENCIES,
  PROFILE_COMPLETENESS_KEYS,
  WORKER_LANGUAGE_CODES,
} from "@/lib/api/types-moderation";
import {
  clampPercent,
  completenessTone,
  duplicateLanguageIndexes,
  isKnownLanguage,
  toLanguagesPayload,
} from "./languages";

describe("worker languages", () => {
  it("finds repeated languages, ignoring blanks", () => {
    expect(duplicateLanguageIndexes([{ language: "ne" }, { language: "" }, { language: "en" }, { language: "ne" }, { language: "" }])).toEqual([3]);
    expect(duplicateLanguageIndexes([])).toEqual([]);
  });

  it("builds the API payload without blanks or duplicates", () => {
    expect(
      toLanguagesPayload([
        { language: "ne", proficiency: "native" },
        { language: "", proficiency: "basic" },
        { language: "hi", proficiency: "fluent" },
        { language: "ne", proficiency: "basic" },
      ]),
    ).toEqual([
      { language: "ne", proficiency: "native" },
      { language: "hi", proficiency: "fluent" },
    ]);
  });

  it("recognises the supported codes", () => {
    expect(isKnownLanguage("mai")).toBe(true);
    expect(isKnownLanguage("fr")).toBe(false);
  });

  it("labels every language, proficiency and completeness item in both locales", () => {
    for (const c of WORKER_LANGUAGE_CODES) {
      expect(en.moderation.languages.names[c]).toBeTruthy();
      expect(ne.moderation.languages.names[c]).toBeTruthy();
    }
    for (const p of LANGUAGE_PROFICIENCIES) {
      expect(en.moderation.languages.proficiency_options[p]).toBeTruthy();
      expect(ne.moderation.languages.proficiency_options[p]).toBeTruthy();
    }
    for (const k of PROFILE_COMPLETENESS_KEYS) {
      expect(en.moderation.completeness.items[k]).toBeTruthy();
      expect(ne.moderation.completeness.items[k]).toBeTruthy();
    }
  });
});

describe("profile completeness", () => {
  it("clamps and rounds the percent", () => {
    expect(clampPercent(62.5)).toBe(63);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(undefined)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it("bands the bar colour", () => {
    expect(completenessTone(100)).toBe("success");
    expect(completenessTone(75)).toBe("brand");
    expect(completenessTone(50)).toBe("brand");
    expect(completenessTone(49)).toBe("warning");
  });
});
