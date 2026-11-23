import { describe, expect, it } from "vitest";
import type { Me } from "@/lib/api/types";
import { routeAfterLogin } from "./login-flow";

const base: Me = {
  id: "u1",
  phone: "9800000020",
  full_name: "",
  email: null,
  preferred_language: "en",
  is_staff: false,
  worker_id: null,
  memberships: [],
};
const membership = {
  id: "m1",
  role: "owner",
  organization: { id: "o1" },
  site_ids: [],
} as unknown as Me["memberships"][number];

describe("routeAfterLogin", () => {
  it("lets people without an organization pick (household, Sipalu or new business)", () => {
    expect(routeAfterLogin(base, null)).toBe("choose");
    expect(routeAfterLogin({ ...base, worker_id: "w1" }, null)).toBe("choose");
  });

  it("keeps a safe next target", () => {
    expect(routeAfterLogin(base, "/ghar/bookings")).toBe("/ghar/bookings");
    expect(routeAfterLogin(base, "//evil.example")).toBe("choose");
    expect(routeAfterLogin(base, "/app")).toBe("choose"); // no organization yet
  });

  it("sends members to the app and staff to ops", () => {
    expect(routeAfterLogin({ ...base, memberships: [membership] }, null)).toBe("/app");
    expect(routeAfterLogin({ ...base, is_staff: true }, null)).toBe("/ops");
    expect(routeAfterLogin({ ...base, is_staff: true, memberships: [membership] }, null)).toBe(
      "choose",
    );
  });
});
