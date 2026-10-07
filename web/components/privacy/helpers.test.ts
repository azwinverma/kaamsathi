import { canProcess, exportFileState, privacyDownloadHref, validateProcessNote } from "./helpers";

const base = {
  kind: "export" as const,
  status: "completed" as const,
  file_available: true,
  file_expires_at: "2026-10-08T00:00:00Z",
};
const now = new Date("2026-10-07T12:00:00Z");

describe("canProcess", () => {
  it("allows only open requests", () => {
    const r = { kind: "correction" as const, handled_by: null };
    expect(canProcess({ ...r, status: "received" })).toBe(true);
    expect(canProcess({ ...r, status: "in_progress" })).toBe(true);
    expect(canProcess({ ...r, status: "completed" })).toBe(false);
    expect(canProcess({ ...r, status: "rejected" })).toBe(false);
  });
  it("treats an approved export being generated as handled", () => {
    const handled_by = { id: "u1", full_name: "Ops" };
    expect(canProcess({ kind: "export", status: "in_progress", handled_by })).toBe(false);
    expect(canProcess({ kind: "export", status: "in_progress", handled_by: null })).toBe(true);
    expect(canProcess({ kind: "deletion", status: "in_progress", handled_by })).toBe(true);
  });
});

describe("exportFileState", () => {
  it("is ready when the file exists and has not expired", () => {
    expect(exportFileState(base, now)).toBe("ready");
    expect(exportFileState({ ...base, file_expires_at: null }, now)).toBe("ready");
  });
  it("is expired past file_expires_at or when the file was purged", () => {
    expect(exportFileState({ ...base, file_expires_at: "2026-10-07T00:00:00Z" }, now)).toBe(
      "expired",
    );
    expect(exportFileState({ ...base, file_available: false }, now)).toBe("expired");
  });
  it("is preparing while in progress", () => {
    expect(
      exportFileState(
        { ...base, status: "in_progress", file_available: false, file_expires_at: null },
        now,
      ),
    ).toBe("preparing");
  });
  it("is none for other kinds, rejected or untouched requests", () => {
    expect(exportFileState({ ...base, kind: "deletion" }, now)).toBe("none");
    expect(exportFileState({ ...base, status: "rejected" }, now)).toBe("none");
    expect(
      exportFileState(
        { ...base, status: "received", file_available: false, file_expires_at: null },
        now,
      ),
    ).toBe("none");
  });
});

describe("privacyDownloadHref", () => {
  it("points at the same-origin proxy", () => {
    expect(privacyDownloadHref("3f2a-uuid")).toBe(
      "/api/proxy/ops/privacy-requests/3f2a-uuid/download",
    );
  });
});

describe("validateProcessNote", () => {
  it("requires a note to reject", () => {
    expect(validateProcessNote("reject", "   ")).toEqual({ ok: false });
    expect(validateProcessNote("reject", " Not the account holder ")).toEqual({
      ok: true,
      note: "Not the account holder",
    });
  });
  it("lets approve omit the note", () => {
    expect(validateProcessNote("approve", "  ")).toEqual({ ok: true, note: undefined });
  });
});
