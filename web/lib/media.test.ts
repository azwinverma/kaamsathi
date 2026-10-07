import { mediaSrc } from "./media";

describe("mediaSrc", () => {
  it("is null-safe", () => {
    expect(mediaSrc(null)).toBeNull();
    expect(mediaSrc(undefined)).toBeNull();
    expect(mediaSrc("")).toBeNull();
  });

  it("rewrites absolute signed file URLs to the same-origin proxy", () => {
    expect(mediaSrc("https://api.kaamsathi.com/api/v1/files/abc_DEF-12:x.y")).toBe(
      "/api/proxy/files/abc_DEF-12:x.y",
    );
    expect(mediaSrc("http://localhost:8000/api/v1/files/tok123/")).toBe("/api/proxy/files/tok123");
  });

  it("keeps the query string", () => {
    expect(mediaSrc("https://api.example.com/api/v1/files/tok?download=1")).toBe(
      "/api/proxy/files/tok?download=1",
    );
  });

  it("rewrites relative and protocol-relative URLs", () => {
    expect(mediaSrc("/api/v1/files/tok")).toBe("/api/proxy/files/tok");
    expect(mediaSrc("//api.example.com/api/v1/files/tok")).toBe("/api/proxy/files/tok");
  });

  it("handles a path prefix before /api/v1", () => {
    expect(mediaSrc("https://example.com/backend/api/v1/files/tok")).toBe("/api/proxy/files/tok");
  });

  it("leaves other URLs unchanged", () => {
    const urls = [
      "https://cdn.example.com/media/photo.jpg",
      "/api/proxy/files/tok",
      "/icon.svg",
      "data:image/png;base64,AAAA",
      "blob:http://localhost:3000/123",
      "https://api.example.com/api/v1/files/",
      "https://api.example.com/api/v1/files/a/b",
      "https://api.example.com/api/v1/files/bad%20token",
    ];
    for (const u of urls) expect(mediaSrc(u)).toBe(u);
  });
});
