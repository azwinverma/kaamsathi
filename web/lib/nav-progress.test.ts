import { describe, expect, it, vi } from "vitest";
import {
  doneNavProgress,
  isNavigatingClick,
  navProgressActive,
  startNavProgress,
  subscribeNavProgress,
} from "./nav-progress";

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const here = { origin: "https://kaamsathi.test", pathname: "/bolau", search: "?trade=plumber" };
const a = (href: string, attrs: { target?: string; download?: boolean } = {}) => ({
  href,
  target: attrs.target ?? "",
  hasAttribute: (n: string) => n === "download" && !!attrs.download,
});

describe("isNavigatingClick", () => {
  it("starts for another page or another query on this site", () => {
    expect(isNavigatingClick(click, a("/sipalu/ram"), here)).toBe(true);
    expect(isNavigatingClick(click, a("/bolau?trade=cook"), here)).toBe(true);
    expect(isNavigatingClick(click, a("https://kaamsathi.test/help"), here)).toBe(true);
  });

  it("ignores hash jumps, new tabs, modifier clicks, downloads, other sites and API routes", () => {
    expect(isNavigatingClick(click, a("/bolau?trade=plumber#results"), here)).toBe(false);
    expect(isNavigatingClick(click, a("/help", { target: "_blank" }), here)).toBe(false);
    expect(isNavigatingClick({ ...click, metaKey: true }, a("/help"), here)).toBe(false);
    expect(isNavigatingClick({ ...click, button: 1 }, a("/help"), here)).toBe(false);
    expect(isNavigatingClick({ ...click, defaultPrevented: true }, a("/help"), here)).toBe(false);
    expect(isNavigatingClick(click, a("/files/x.pdf", { download: true }), here)).toBe(false);
    expect(isNavigatingClick(click, a("https://esewa.com.np/"), here)).toBe(false);
    expect(isNavigatingClick(click, a("/api/auth/logout"), here)).toBe(false);
  });
});

describe("nav progress store", () => {
  it("notifies once per change", () => {
    const seen = vi.fn();
    const off = subscribeNavProgress(seen);
    startNavProgress();
    startNavProgress();
    expect(navProgressActive()).toBe(true);
    doneNavProgress();
    expect(seen.mock.calls).toEqual([[true], [false]]);
    off();
  });
});
