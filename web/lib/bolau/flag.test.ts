import { APP_NAV, OPS_NAV, filterNavByFlags } from "@/components/shell/nav";
import { BOLAU_PUBLIC_PATHS, DISALLOWED_PATHS, PUBLIC_PATHS, indexableSipaluPaths } from "@/lib/site";
import { BOLAU_FLAG, bolauOnFromFlags, bolauOnFromStatus } from "./flag";

const hrefs = (nav: typeof OPS_NAV) => nav.flatMap((g) => g.items.map((i) => i.href));

describe("bolau flag (hidden entirely when off)", () => {
  it("public endpoint status → on only for 2xx", () => {
    expect(bolauOnFromStatus(200)).toBe(true);
    expect(bolauOnFromStatus(404)).toBe(false);
    expect(bolauOnFromStatus(502)).toBe(false);
  });

  it("client flags → off unless explicitly true", () => {
    expect(bolauOnFromFlags({ [BOLAU_FLAG]: true })).toBe(true);
    expect(bolauOnFromFlags({ [BOLAU_FLAG]: false })).toBe(false);
    expect(bolauOnFromFlags({})).toBe(false);
    expect(bolauOnFromFlags(undefined)).toBe(false);
  });

  it("the ops nav hides /ops/bolau when the flag is off and shows it when on", () => {
    expect(hrefs(filterNavByFlags(OPS_NAV, {}))).not.toContain("/ops/bolau");
    expect(hrefs(filterNavByFlags(OPS_NAV, undefined))).not.toContain("/ops/bolau");
    expect(hrefs(filterNavByFlags(OPS_NAV, { bolau: true }))).toContain("/ops/bolau");
  });

  it("flag filtering leaves unflagged items and the employer nav alone", () => {
    const withoutBolau = hrefs(OPS_NAV).filter((h) => h !== "/ops/bolau");
    expect(hrefs(filterNavByFlags(OPS_NAV, {}))).toEqual(withoutBolau);
    expect(filterNavByFlags(APP_NAV, {})).toEqual(APP_NAV);
  });

  it("the Bolau ops page is a support-staff page", () => {
    const item = OPS_NAV.flatMap((g) => g.items).find((i) => i.href === "/ops/bolau");
    expect(item?.staffRoles).toEqual(["support"]);
    expect(item?.flag).toBe("bolau");
  });
});

describe("crawling", () => {
  it("never crawls the Ghardhani area or the booking forms", () => {
    const d: readonly string[] = DISALLOWED_PATHS;
    expect(d).toContain("/ghar");
    expect(d).toContain("/bolau/book/");
    expect(d).toContain("/bolau/request");
  });
  it("Bolau pages are not in the always-public list (sitemap adds them only while live)", () => {
    for (const p of BOLAU_PUBLIC_PATHS) expect(PUBLIC_PATHS as readonly string[]).not.toContain(p);
  });
  it("lists only opted-in Sipalu profiles", () => {
    expect(
      indexableSipaluPaths([
        { handle: "ram-electric", indexable: true },
        { handle: "sita-plumber", indexable: false },
        { handle: "hari" },
        { handle: "maya", indexable: true },
        { handle: "maya", indexable: true },
      ]),
    ).toEqual(["/sipalu/ram-electric", "/sipalu/maya"]);
  });
});
