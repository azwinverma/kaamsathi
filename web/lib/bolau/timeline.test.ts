import type { BookingEvent } from "@/lib/api/types-bolau";
import {
  BOOKING_TONE,
  MAIN_PATH,
  bookingTimeline,
  canCancel,
  canDispute,
  canMarkPaid,
  canReportNoShow,
  contactWindow,
  disputeText,
  showArrivalCode,
} from "./timeline";

const ev = (to: BookingEvent["to_status"], at: string): BookingEvent => ({ from_status: null, to_status: to, at });

describe("bookingTimeline", () => {
  it("lists the seven main steps in order", () => {
    expect(bookingTimeline("requested").steps.map((s) => s.status)).toEqual([
      "requested",
      "accepted",
      "on_the_way",
      "arrived",
      "in_progress",
      "completed",
      "confirmed",
    ]);
  });

  it("marks done / current / todo around the live status, with event times", () => {
    const tl = bookingTimeline("on_the_way", [ev("requested", "2026-10-09T04:00:00Z"), ev("accepted", "2026-10-09T04:10:00Z")]);
    expect(tl.stoppedAt).toBeNull();
    expect(tl.steps.map((s) => s.state)).toEqual(["done", "done", "current", "todo", "todo", "todo", "todo"]);
    expect(tl.steps[1].at).toBe("2026-10-09T04:10:00Z");
  });

  it("a confirmed booking is fully done", () => {
    expect(bookingTimeline("confirmed").steps.every((s) => s.state === "done")).toBe(true);
  });

  it("a cancelled booking keeps what happened and skips the rest", () => {
    const tl = bookingTimeline("cancelled", [ev("requested", "a"), ev("accepted", "b"), ev("cancelled", "c")]);
    expect(tl.stoppedAt).toBe("cancelled");
    expect(tl.steps.map((s) => s.state)).toEqual(["done", "done", "skipped", "skipped", "skipped", "skipped", "skipped"]);
  });

  it("declined/expired without events still shows the request as done", () => {
    const tl = bookingTimeline("expired");
    expect(tl.stoppedAt).toBe("expired");
    expect(tl.steps[0].state).toBe("done");
    expect(tl.steps[1].state).toBe("skipped");
  });

  it("every status has a tone", () => {
    for (const s of [...MAIN_PATH, "declined", "expired", "cancelled", "no_show", "disputed"] as const) {
      expect(BOOKING_TONE[s]).toBeTruthy();
    }
  });
});

describe("Ghardhani rules", () => {
  it("cancel until arrival", () => {
    expect(canCancel("requested")).toBe(true);
    expect(canCancel("on_the_way")).toBe(true);
    expect(canCancel("arrived")).toBe(false);
  });
  it("contact only between acceptance and confirmation", () => {
    expect(contactWindow("requested")).toBe(false);
    expect(contactWindow("accepted")).toBe(true);
    expect(contactWindow("confirmed")).toBe(true);
    expect(contactWindow("cancelled")).toBe(false);
  });
  it("arrival code shows only before check-in", () => {
    expect(showArrivalCode("accepted", "4827")).toBe(true);
    expect(showArrivalCode("on_the_way", "4827")).toBe(true);
    expect(showArrivalCode("arrived", "4827")).toBe(false);
    expect(showArrivalCode("accepted", null)).toBe(false);
  });
  it("no-show only 30 minutes after the start", () => {
    const start = "2026-10-09T10:00:00+05:45";
    expect(canReportNoShow("accepted", start, new Date("2026-10-09T04:30:00Z"))).toBe(false);
    expect(canReportNoShow("accepted", start, new Date("2026-10-09T04:50:00Z"))).toBe(true);
    expect(canReportNoShow("arrived", start, new Date("2026-10-09T06:00:00Z"))).toBe(false);
  });
  it("mark paid after the work, once", () => {
    expect(canMarkPaid("completed", null)).toBe(true);
    expect(canMarkPaid("confirmed", "2026-10-09T08:00:00Z")).toBe(false);
    expect(canMarkPaid("in_progress", null)).toBe(false);
  });
});

describe("booking disputes", () => {
  it("can be raised once the job has started or ended, not while only requested / disputed", () => {
    expect(canDispute("completed")).toBe(true);
    expect(canDispute("no_show")).toBe(true);
    expect(canDispute("requested")).toBe(false);
    expect(canDispute("disputed")).toBe(false);
  });
  it("strips the stored booking prefix", () => {
    expect(disputeText("[BK-AB12 · raised by ghardhani] Charged more")).toBe("Charged more");
    expect(disputeText("Plain")).toBe("Plain");
  });
});
