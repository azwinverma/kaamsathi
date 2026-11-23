import { describe, expect, it } from "vitest";
import { isWorkerRequested } from "./utils";

describe("isWorkerRequested", () => {
  it("flags leave the worker asked for from the app", () => {
    expect(isWorkerRequested({ source: "worker" })).toBe(true);
  });

  it("treats employer-entered and older rows without a source as employer leave", () => {
    expect(isWorkerRequested({ source: "employer" })).toBe(false);
    expect(isWorkerRequested({})).toBe(false);
  });
});
