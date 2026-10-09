import { describe, expect, it } from "vitest";
import { accountLinks } from "./site-account-menu";

const org = { id: "m1", role: "owner", organization: { id: "o1", name: "Org", logo: null, industry: "construction" }, site_ids: [] };

describe("accountLinks (public header menu)", () => {
  it("a Ghardhani-only user gets their bookings while Bolau is live", () => {
    expect(accountLinks({ is_staff: false, memberships: [] }, true).map((l) => l.href)).toEqual(["/ghar"]);
    expect(accountLinks({ is_staff: false, memberships: [] }, false)).toEqual([]);
  });
  it("an employer gets the app and the employer account page", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(accountLinks({ is_staff: false, memberships: [org as any] }, true).map((l) => l.href)).toEqual([
      "/ghar",
      "/app",
      "/app/account",
    ]);
  });
  it("staff without a membership get ops + the ops account page", () => {
    expect(accountLinks({ is_staff: true, memberships: [] }, false).map((l) => l.href)).toEqual(["/ops", "/ops/account"]);
  });
});
