import { DISALLOWED_PATHS, PUBLIC_PATHS, siteUrl } from "./site";

describe("siteUrl", () => {
  it("falls back to localhost", () => {
    expect(siteUrl("")).toBe("http://localhost:3000");
    expect(siteUrl("   ")).toBe("http://localhost:3000");
    expect(siteUrl("not a url")).toBe("http://localhost:3000");
  });
  it("normalises to an origin", () => {
    expect(siteUrl("https://kaamsathi.com/")).toBe("https://kaamsathi.com");
    expect(siteUrl("https://kaamsathi.com/some/path")).toBe("https://kaamsathi.com");
    expect(siteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });
});

describe("public paths", () => {
  it("never lists a disallowed path as public", () => {
    const disallowed: readonly string[] = DISALLOWED_PATHS;
    for (const p of PUBLIC_PATHS as readonly string[]) {
      expect(disallowed.some((d) => p === d || p.startsWith(d.endsWith("/") ? d : `${d}/`))).toBe(
        false,
      );
    }
  });
});
