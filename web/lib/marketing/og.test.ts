import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/assets/og/manifest.json";
import { ogBrand, ogCopy, ogNepaliStrings, ogVariant } from "./og";

const pngSize = (file: string) => {
  const buf = readFileSync(join(process.cwd(), "assets", "og", file));
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

describe("Open Graph card copy", () => {
  it("follows the bolau flag in both languages", () => {
    expect(ogVariant(true)).toBe("bolau");
    expect(ogVariant(false)).toBe("employer");
    expect(ogCopy(true).title).toMatch(/Bolau/);
    expect(ogCopy(false).title).not.toMatch(/Bolau|Sipalu/);
    expect(ogCopy(true, "ne").title).toMatch(/सिपालु/);
    expect(ogCopy(false, "ne").title).not.toMatch(/सिपालु|बोलाउ/);
    expect(ogBrand("ne")).toBe("कामसाथी");
  });

  it("every Nepali line has a pre-shaped image that shows exactly the catalogue text (else run `pnpm og:text`)", () => {
    const strings = ogNepaliStrings();
    expect(Object.keys(manifest.items).sort()).toEqual(Object.keys(strings).sort());
    for (const [key, text] of Object.entries(strings)) {
      const item = manifest.items[key as keyof typeof manifest.items];
      expect(item.text, key).toBe(text);
      const { width, height } = pngSize(item.file);
      expect(Math.abs(width - item.width * manifest.scale), key).toBeLessThanOrEqual(
        manifest.scale,
      );
      expect(Math.abs(height - item.height * manifest.scale), key).toBeLessThanOrEqual(
        manifest.scale,
      );
      expect(item.width, key).toBeLessThanOrEqual(1040); // fits inside the card's 80 px side padding
    }
  });
});
