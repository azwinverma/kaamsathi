import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";
import { compactDuration, slaState } from "./sla";

const NOW = Date.parse("2026-10-07T10:00:00Z");
const units = { d: "d", h: "h", m: "m" };

describe("slaState", () => {
  it("marks open cases past due as overdue", () => {
    expect(slaState("2026-10-07T09:30:00Z", "open", NOW)).toEqual({ tone: "overdue", minutes: -30 });
  });
  it("warns within two hours", () => {
    expect(slaState("2026-10-07T11:00:00Z", "open", NOW).tone).toBe("soon");
    expect(slaState("2026-10-08T11:00:00Z", "open", NOW).tone).toBe("ok");
  });
  it("pauses while waiting on the requester and stops when resolved", () => {
    expect(slaState("2026-10-07T09:00:00Z", "pending_user", NOW).tone).toBe("paused");
    expect(slaState("2026-10-07T09:00:00Z", "resolved", NOW).tone).toBe("done");
  });
});

describe("compactDuration", () => {
  it("uses the two largest units", () => {
    expect(compactDuration(3 * 1440 + 4 * 60 + 5, units)).toBe("3d 4h");
    expect(compactDuration(310, units)).toBe("5h 10m");
    expect(compactDuration(-12, units)).toBe("12m");
    expect(compactDuration(1440, units)).toBe("1d");
  });
});

describe("parseMarkdown", () => {
  it("parses paragraphs, lists and tables", () => {
    const blocks = parseMarkdown("Intro **bold**\n\n- a\n- b\n\n1. one\n2. two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ul", "ol", "table"]);
    expect(blocks[3]).toEqual({ kind: "table", head: ["A", "B"], rows: [["1", "2"]] });
  });
  it("reads Devanagari numbered lists", () => {
    expect(parseMarkdown("१. पहिलो\n२. दोस्रो")[0]).toEqual({ kind: "ol", items: ["पहिलो", "दोस्रो"] });
  });
});
