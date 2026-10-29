import { describe, expect, it } from "vitest";
import { pageTemplate } from "./telemetry-page";

describe("pageTemplate", () => {
  it("keeps static routes", () => {
    expect(pageTemplate("/")).toBe("/");
    expect(pageTemplate("/app/payroll")).toBe("/app/payroll");
    expect(pageTemplate("/sipalu/join")).toBe("/sipalu/join");
  });

  it("replaces record ids", () => {
    expect(pageTemplate("/app/workers/3f2b8c1e-1d2a-4b5c-9d8e-7f6a5b4c3d2e")).toBe("/app/workers/:id");
    expect(pageTemplate("/app/payroll/2083/7")).toBe("/app/payroll/:n/:n");
  });

  it("never sends a person's public handle", () => {
    expect(pageTemplate("/p/ram-bhanse")).toBe("/p/:handle");
    expect(pageTemplate("/sipalu/suman-electric")).toBe("/sipalu/:handle");
    expect(pageTemplate("/bolau/book/suman-electric")).toBe("/bolau/book/:handle");
    expect(pageTemplate("/p/s/Zx81-share-token")).toBe("/p/:handle/:handle");
  });

  it("drops query strings and fragments", () => {
    expect(pageTemplate("/bolau?q=plumber&district=kathmandu#results")).toBe("/bolau");
  });
});
