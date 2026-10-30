import { BOLAU_HOME, EMPLOYER_HOME, headerNav, homeMetaKeys, homeSections } from "./home-layout";

describe("home layout by the bolau flag", () => {
  it("flag off keeps the employer-first page exactly as before", () => {
    expect(homeSections(false)).toEqual([
      "hero",
      "problem",
      "demo",
      "ladder",
      "workforce",
      "career",
      "trust",
      "trades",
      "audience",
      "proof",
      "pricing",
    ]);
    expect(homeSections(false).some((s) => s.startsWith("bolau") || s.includes("sipalu"))).toBe(false);
  });

  it("flag on leads with Bolau and puts businesses after the Sipalu sections", () => {
    const s = homeSections(true);
    expect(s).toBe(BOLAU_HOME);
    expect(s[0]).toBe("bolau-hero");
    expect(s[1]).toBe("sipalu-near");
    expect(s.indexOf("businesses")).toBeGreaterThan(s.indexOf("become-sipalu"));
    expect(s.indexOf("become-sipalu")).toBeGreaterThan(s.indexOf("bolau-trust"));
    expect(s.at(-1)).toBe("pricing");
    expect(s).not.toContain("hero");
    expect(EMPLOYER_HOME).not.toContain("bolau-hero");
  });

  it("metadata follows the flag", () => {
    expect(homeMetaKeys(false)).toEqual({ title: "title", description: "description" });
    expect(homeMetaKeys(true)).toEqual({ title: "bolau_title", description: "bolau_description" });
  });

  it("header: classic employer nav when off", () => {
    const n = headerNav(false, "");
    expect(n.primary).toBeNull();
    expect(n.employerCta).toBe(true);
    expect(n.business).toEqual([]);
    expect(n.links.map((l) => l.href)).toEqual(["#employers", "#workers", "#passport", "/help"]);
  });

  it("header: Bolau is the primary CTA, employer links move under For businesses when on", () => {
    const n = headerNav(true, "/");
    expect(n.primary).toEqual({ href: "/bolau", label: "bolau.nav.link" });
    expect(n.employerCta).toBe(false);
    expect(n.links.map((l) => l.href)).toEqual(["/bolau#results", "/sipalu/join", "/help"]);
    expect(n.links.map((l) => l.href)).not.toContain("/#employers");
    expect(n.business.map((l) => l.href)).toEqual(["/login", "/#businesses", "/#pricing", "/developers"]);
  });
});
