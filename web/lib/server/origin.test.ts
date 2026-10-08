// @vitest-environment node
import {
  isCrossSiteRequest,
  parseAllowedOrigins,
  rejectCrossSite,
  resolveRequestId,
  type OriginCheckInput,
} from "./origin";

const base: OriginCheckInput = {
  method: "POST",
  origin: "https://app.kaamsathi.com",
  secFetchSite: "same-origin",
  host: "app.kaamsathi.com",
};

describe("isCrossSiteRequest", () => {
  it("allows same-origin browser requests", () => {
    expect(isCrossSiteRequest(base)).toBe(false);
  });

  it("never blocks safe methods", () => {
    expect(isCrossSiteRequest({ ...base, method: "GET", secFetchSite: "cross-site" })).toBe(false);
    expect(isCrossSiteRequest({ ...base, method: "HEAD", origin: "https://evil.test" })).toBe(false);
  });

  it("allows non-browser clients that send neither header", () => {
    expect(isCrossSiteRequest({ ...base, origin: null, secFetchSite: null })).toBe(false);
  });

  it.each(["cross-site", "same-site", "none"])("blocks Sec-Fetch-Site=%s", (site) => {
    expect(isCrossSiteRequest({ ...base, secFetchSite: site })).toBe(true);
    expect(isCrossSiteRequest({ ...base, origin: null, secFetchSite: site })).toBe(true);
  });

  it.each(["DELETE", "patch", "PUT"])("checks %s", (method) => {
    expect(isCrossSiteRequest({ ...base, method, origin: "https://evil.test" })).toBe(true);
  });

  it("blocks a foreign Origin even without Sec-Fetch-Site", () => {
    expect(isCrossSiteRequest({ ...base, secFetchSite: null, origin: "https://evil.test" })).toBe(true);
  });

  it("compares ports", () => {
    expect(
      isCrossSiteRequest({ ...base, origin: "http://localhost:3001", host: "localhost:3000" }),
    ).toBe(true);
    expect(
      isCrossSiteRequest({ ...base, origin: "http://localhost:3000", host: "localhost:3000" }),
    ).toBe(false);
  });

  it("is case-insensitive on host", () => {
    expect(isCrossSiteRequest({ ...base, host: "APP.KaamSathi.com" })).toBe(false);
  });

  it("prefers X-Forwarded-Host (first value) behind a proxy", () => {
    const behindProxy = { ...base, host: "web:3000", forwardedHost: "app.kaamsathi.com, internal" };
    expect(isCrossSiteRequest(behindProxy)).toBe(false);
    expect(isCrossSiteRequest({ ...behindProxy, forwardedHost: "other.example" })).toBe(true);
  });

  it("blocks opaque, malformed and non-http origins", () => {
    expect(isCrossSiteRequest({ ...base, origin: "null" })).toBe(true);
    expect(isCrossSiteRequest({ ...base, origin: "not a url" })).toBe(true);
    expect(isCrossSiteRequest({ ...base, origin: "file:///etc" })).toBe(true);
  });

  it("blocks when the Origin is present but Host is missing", () => {
    expect(isCrossSiteRequest({ ...base, host: null })).toBe(true);
  });

  it("honours the allow-list (full origins or bare hosts)", () => {
    const allowed = parseAllowedOrigins(" https://admin.kaamsathi.com/ , partner.example:8443 ");
    expect(allowed).toEqual(["https://admin.kaamsathi.com", "partner.example:8443"]);
    expect(
      isCrossSiteRequest({ ...base, origin: "https://admin.kaamsathi.com", secFetchSite: "same-site", allowed }),
    ).toBe(false);
    expect(
      isCrossSiteRequest({ ...base, origin: "https://partner.example:8443", secFetchSite: null, allowed }),
    ).toBe(false);
    expect(
      isCrossSiteRequest({ ...base, origin: "http://admin.kaamsathi.com", secFetchSite: null, allowed }),
    ).toBe(true);
    expect(isCrossSiteRequest({ ...base, origin: "https://evil.test", allowed })).toBe(true);
  });

  it("parses an empty allow-list", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins(" , ")).toEqual([]);
  });
});

describe("rejectCrossSite", () => {
  const req = (headers: Record<string, string>, method = "POST") => ({
    method,
    headers: new Headers(headers),
  });

  it("returns a 403 envelope for cross-site requests", async () => {
    const res = rejectCrossSite(
      req({ host: "app.kaamsathi.com", origin: "https://evil.test", "sec-fetch-site": "cross-site" }),
    );
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: { code: "permission_denied", message: "Cross-site request blocked." },
    });
  });

  it("returns null for same-origin and header-less requests", () => {
    expect(
      rejectCrossSite(
        req({ host: "app.kaamsathi.com", origin: "https://app.kaamsathi.com", "sec-fetch-site": "same-origin" }),
      ),
    ).toBeNull();
    expect(rejectCrossSite(req({ host: "app.kaamsathi.com" }))).toBeNull();
  });
});

describe("resolveRequestId", () => {
  it("keeps safe ids", () => {
    expect(resolveRequestId("abc-123_X.y")).toBe("abc-123_X.y");
  });
  it("replaces missing, unsafe or overlong ids", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(resolveRequestId(null)).toMatch(uuid);
    expect(resolveRequestId("")).toMatch(uuid);
    expect(resolveRequestId("bad id\nX-Injected: 1")).toMatch(uuid);
    expect(resolveRequestId("a".repeat(65))).toMatch(uuid);
    expect(resolveRequestId("a".repeat(64))).toBe("a".repeat(64));
  });
});
