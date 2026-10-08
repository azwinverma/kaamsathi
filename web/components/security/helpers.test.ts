import { ApiError } from "@/lib/api/errors";
import {
  compactFilters,
  describeUserAgent,
  formatSecret,
  hasStaffRole,
  isMfaRequiredError,
  needsLegalAcceptance,
  needsMfaEnrolment,
  recoveryCodesText,
} from "./helpers";

describe("describeUserAgent", () => {
  it("recognises common browsers and platforms", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Windows" });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "Safari", os: "iOS" });
    expect(
      describeUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0"),
    ).toEqual({ browser: "Edge", os: "Linux" });
    expect(describeUserAgent("okhttp/4.12.0")).toEqual({ browser: "KaamSathi app", os: null });
  });
  it("handles empty values", () => {
    expect(describeUserAgent("")).toEqual({ browser: null, os: null });
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
  });
});

describe("formatSecret", () => {
  it("groups in fours", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(formatSecret("ABCDEF")).toBe("ABCD EF");
  });
});

describe("recoveryCodesText", () => {
  it("numbers each code", () => {
    const txt = recoveryCodesText(["aaaa-bbbb", "cccc-dddd"], { title: "Codes", note: "Keep safe", account: "+977 98…" });
    expect(txt).toContain(" 1. aaaa-bbbb");
    expect(txt).toContain(" 2. cccc-dddd");
    expect(txt.startsWith("Codes\n+977 98…\n")).toBe(true);
    expect(txt).toContain("Keep safe");
  });
});

describe("MFA gate helpers", () => {
  it("detects the mfa_required 403", () => {
    expect(isMfaRequiredError(new ApiError(403, "mfa_required", "x"))).toBe(true);
    expect(isMfaRequiredError(new ApiError(403, "permission_denied", "x"))).toBe(false);
    expect(isMfaRequiredError(new Error("x"))).toBe(false);
  });
  it("needs enrolment only for staff with policy on and MFA off", () => {
    expect(needsMfaEnrolment({ is_staff: true, mfa_required: true, mfa_enabled: false })).toBe(true);
    expect(needsMfaEnrolment({ is_staff: true, mfa_required: true, mfa_enabled: true })).toBe(false);
    expect(needsMfaEnrolment({ is_staff: true, mfa_required: false, mfa_enabled: false })).toBe(false);
    expect(needsMfaEnrolment({ is_staff: false, mfa_required: true, mfa_enabled: false })).toBe(false);
    expect(needsMfaEnrolment({ is_staff: true })).toBe(false);
  });
});

describe("hasStaffRole", () => {
  it("checks roles with superadmin override and old-backend fallback", () => {
    expect(hasStaffRole({ staff_roles: ["support"] }, ["superadmin"])).toBe(false);
    expect(hasStaffRole({ staff_roles: ["superadmin"] }, ["finance_ops"])).toBe(true);
    expect(hasStaffRole({ staff_roles: ["support", "verifier"] }, ["verifier"])).toBe(true);
    expect(hasStaffRole({}, ["superadmin"])).toBe(true);
  });
});

describe("compactFilters", () => {
  it("drops empty values and trims strings", () => {
    expect(compactFilters({ a: " x ", b: "", c: undefined, d: 2, e: "  " })).toEqual({ a: "x", d: 2 });
  });
});

describe("needsLegalAcceptance", () => {
  const doc = { id: "d1", kind: "terms" as const, version: 3, url: "https://kaamsathi.com/terms" };
  it("is true while current documents are pending", () => {
    expect(needsLegalAcceptance({ pending_legal: [doc] })).toBe(true);
    expect(needsLegalAcceptance({ pending_legal: [doc] }, "/app/workers")).toBe(true);
    expect(needsLegalAcceptance({ pending_legal: [doc] }, "/ops")).toBe(true);
  });
  it("is false when nothing is pending or the backend doesn't send the field", () => {
    expect(needsLegalAcceptance({ pending_legal: [] })).toBe(false);
    expect(needsLegalAcceptance({})).toBe(false);
    expect(needsLegalAcceptance(null)).toBe(false);
  });
  it("never covers the legal pages or login", () => {
    for (const p of ["/terms", "/privacy", "/privacy/v2", "/login"]) {
      expect(needsLegalAcceptance({ pending_legal: [doc] }, p)).toBe(false);
    }
    expect(needsLegalAcceptance({ pending_legal: [doc] }, "/termsheet")).toBe(true);
  });
});
