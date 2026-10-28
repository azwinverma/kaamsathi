import { describe, expect, it } from "vitest";
import { clientIpFrom, clientIpRelayHeaders } from "./client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIpFrom", () => {
  it("uses the entry our edge appended (rightmost x-forwarded-for)", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("falls back to x-real-ip, else null", () => {
    expect(clientIpFrom(h({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIpFrom(h({ "x-forwarded-for": " , " }))).toBeNull();
    expect(clientIpFrom(h({}))).toBeNull();
  });
});

describe("clientIpRelayHeaders", () => {
  it("relays the IP with the shared secret", () => {
    expect(clientIpRelayHeaders(h({ "x-forwarded-for": "198.51.100.9" }), "k")).toEqual({
      "X-KaamSathi-Client-IP": "198.51.100.9",
      "X-KaamSathi-Proxy-Secret": "k",
    });
  });

  it("sends nothing without a secret or an IP", () => {
    expect(clientIpRelayHeaders(h({ "x-forwarded-for": "198.51.100.9" }), "")).toEqual({});
    expect(clientIpRelayHeaders(h({ "x-forwarded-for": "198.51.100.9" }), undefined)).toEqual({});
    expect(clientIpRelayHeaders(h({}), "k")).toEqual({});
  });
});
