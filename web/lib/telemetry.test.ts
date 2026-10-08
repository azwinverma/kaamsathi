import { afterEach, describe, expect, it, vi } from "vitest";
import { _queued, _reset, flush, MAX_BATCH, sanitize, track } from "./telemetry";

describe("telemetry", () => {
  afterEach(() => {
    _reset();
    vi.restoreAllMocks();
  });

  it("drops non-allowlisted keys and PII-looking values", () => {
    expect(
      sanitize({
        method: "otp",
        phone: "9812345678",
        full_name: "Ram",
        source: "call 9801234567",
        via: "a@b.com",
        page: "/app/jobs?x=1",
        count: 3,
      }),
    ).toEqual({ method: "otp", page: "/app/jobs", count: 3 });
  });

  it("batches events and flushes at most 50 per request", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < MAX_BATCH - 1; i++) track("page_view", { page: "/app" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(_queued()).toHaveLength(MAX_BATCH - 1);
    track("login_success", { method: "otp" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(MAX_BATCH);
    expect(body.events[MAX_BATCH - 1]).toMatchObject({ name: "login_success", platform: "web" });
    track("job_created");
    flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/proxy/telemetry/events");
  });
});
