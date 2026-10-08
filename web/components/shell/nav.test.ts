import { OPS_NAV, canSeeStaffItem, filterNavForStaff, type NavItem } from "./nav";
import type { StaffRole } from "@/lib/api/types-security";

const hrefs = (roles: StaffRole[] | undefined) =>
  filterNavForStaff(OPS_NAV, roles).flatMap((g) => g.items.map((i) => i.href));
const ALL = OPS_NAV.flatMap((g) => g.items.map((i) => i.href));
const OPEN = ["/ops", "/ops/insights", "/ops/kpis", "/ops/analytics", "/ops/account"];

describe("canSeeStaffItem", () => {
  const item = (staffRoles?: StaffRole[]): NavItem => ({
    href: "/ops/x",
    label: "x",
    icon: (() => null) as unknown as NavItem["icon"],
    staffRoles,
  });

  it("shows unrestricted items to any staff", () => {
    expect(canSeeStaffItem(item(), [])).toBe(true);
    expect(canSeeStaffItem(item(), ["support"])).toBe(true);
  });
  it("shows everything when roles are unknown (older backend)", () => {
    expect(canSeeStaffItem(item(["superadmin"]), undefined)).toBe(true);
  });
  it("requires an overlapping role", () => {
    expect(canSeeStaffItem(item(["verifier", "support"]), ["support"])).toBe(true);
    expect(canSeeStaffItem(item(["verifier"]), ["support"])).toBe(false);
    expect(canSeeStaffItem(item(["verifier"]), [])).toBe(false);
  });
  it("lets superadmin see everything", () => {
    expect(canSeeStaffItem(item(["finance_ops"]), ["superadmin"])).toBe(true);
  });
});

describe("filterNavForStaff on OPS_NAV", () => {
  it("superadmin and unknown roles see the full nav", () => {
    expect(hrefs(["superadmin"])).toEqual(ALL);
    expect(hrefs(undefined)).toEqual(ALL);
  });

  it("staff without roles see only the open pages, and empty groups disappear", () => {
    expect(hrefs([])).toEqual(OPEN);
    const groups = filterNavForStaff(OPS_NAV, []);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("verifier sees verification work + shared queues, not admin or finance", () => {
    const v = hrefs(["verifier"]);
    for (const h of ["/ops/workers", "/ops/verification", "/ops/credentials", "/ops/employers", "/ops/references", "/ops/mobility", "/ops/jobs", "/ops/organizations", "/ops/crews", "/ops/training"]) {
      expect(v).toContain(h);
    }
    for (const h of ["/ops/disputes", "/ops/finance", "/ops/partners", "/ops/risk", "/ops/audit", "/ops/staff", "/ops/system", "/ops/taxonomy"]) {
      expect(v).not.toContain(h);
    }
    for (const h of OPEN) expect(v).toContain(h);
  });

  it("support sees disputes, support and privacy plus shared queues", () => {
    const s = hrefs(["support"]);
    for (const h of ["/ops/disputes", "/ops/support", "/ops/privacy", "/ops/jobs", "/ops/crews"]) {
      expect(s).toContain(h);
    }
    expect(s).not.toContain("/ops/workers");
    expect(s).not.toContain("/ops/audit");
  });

  it.each([
    ["finance_ops", ["/ops/finance", "/ops/billing"]],
    ["partner_manager", ["/ops/partners"]],
    ["risk_analyst", ["/ops/risk"]],
  ] as const)("%s sees only its pages (plus open pages)", (role, pages) => {
    expect(hrefs([role])).toEqual(expect.arrayContaining([...OPEN, ...pages]));
    expect(hrefs([role])).toHaveLength(OPEN.length + pages.length);
  });

  it("combines multiple roles", () => {
    const h = hrefs(["finance_ops", "risk_analyst"]);
    expect(h).toContain("/ops/finance");
    expect(h).toContain("/ops/risk");
    expect(h).not.toContain("/ops/partners");
  });

  it("keeps the admin-only pages superadmin-only", () => {
    const admin = ["/ops/audit", "/ops/staff", "/ops/taxonomy", "/ops/system"];
    const nonSuper: StaffRole[] = ["verifier", "support", "finance_ops", "partner_manager", "risk_analyst"];
    for (const h of admin) expect(hrefs(nonSuper)).not.toContain(h);
  });
});
