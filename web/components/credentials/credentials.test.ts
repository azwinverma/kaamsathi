import { describe, expect, it } from "vitest";
import en from "@/messages/src/credentials.en.json";
import ne from "@/messages/src/credentials.ne.json";
import tEn from "@/messages/src/training.en.json";
import tNe from "@/messages/src/training.ne.json";
import { CREDENTIAL_KINDS, VERIFICATION_METHODS } from "@/lib/api/types-credentials";
import {
  COURSE_LEVELS,
  COURSE_MODES,
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  PROVIDER_KINDS,
} from "@/lib/api/types-training";
import { ENROLLMENT_NEXT } from "@/components/training/shared";

describe("credentials copy", () => {
  it("labels every kind, status and method in both languages", () => {
    for (const k of CREDENTIAL_KINDS) {
      expect(en.credentials.kind[k]).toBeTruthy();
      expect(ne.credentials.kind[k]).toBeTruthy();
    }
    for (const m of VERIFICATION_METHODS) {
      expect(en.credentials.method[m]).toBeTruthy();
      expect(ne.credentials.method_hint[m]).toBeTruthy();
    }
    for (const lvl of ["0", "1", "2", "3", "4", "5"] as const) {
      expect(ne.credentials.level[lvl]).toBeTruthy();
    }
  });

  it("calls the score a reliability score, never a credit score", () => {
    expect(en.credentials.passport.reliability).toBe("Reliability score");
    expect(en.credentials.passport.reliability_hint).toMatch(/Not a credit score/);
    expect(JSON.stringify(en).match(/credit score/gi)).toHaveLength(1);
    expect(ne.credentials.passport.reliability_hint).toMatch(/कर्जा अंक होइन/);
  });

  it("marks verified items clearly", () => {
    expect(en.credentials.passport.verified_by).toBe("Verified by KaamSathi");
    expect(ne.credentials.passport.verified_by).toContain("प्रमाणित");
  });
});

describe("training", () => {
  it("labels every enum in both languages", () => {
    const pairs: [Record<string, string>, Record<string, string>, readonly string[]][] = [
      [tEn.training.kind, tNe.training.kind, PROVIDER_KINDS],
      [tEn.training.level, tNe.training.level, COURSE_LEVELS],
      [tEn.training.mode, tNe.training.mode, COURSE_MODES],
      [tEn.training.course_status, tNe.training.course_status, COURSE_STATUSES],
      [tEn.training.enrollment_status, tNe.training.enrollment_status, ENROLLMENT_STATUSES],
    ];
    for (const [a, b, keys] of pairs) {
      for (const k of keys) {
        expect(a[k]).toBeTruthy();
        expect(b[k]).toBeTruthy();
      }
    }
  });

  it("mirrors the backend enrolment transitions (completed is terminal)", () => {
    expect(ENROLLMENT_NEXT.completed).toEqual([]);
    expect(ENROLLMENT_NEXT.applied).toContain("enrolled");
    expect(ENROLLMENT_NEXT.enrolled).toEqual(["completed", "dropped"]);
    for (const next of Object.values(ENROLLMENT_NEXT)) {
      for (const s of next)
        expect(
          tEn.training.enrollments.to[s as keyof typeof tEn.training.enrollments.to],
        ).toBeTruthy();
    }
  });

  it("states that KaamSathi never charges for training", () => {
    expect(tEn.training.employer.fee_note).toMatch(/does not charge/);
  });
});
