import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rungsForLevel } from "@/components/signature/skill-ladder";
import { SLOTS, SLOT_IDS, slotAspect } from "./slots";

const root = path.resolve(__dirname, "../..");

describe("image slots", () => {
  it("every slot has an illustrated fallback in public/illustrations and the design kit", () => {
    for (const id of SLOT_IDS) {
      const file = `${SLOTS[id].fallback}.svg`;
      expect(existsSync(path.join(root, "public/illustrations", file)), `${id} → ${file}`).toBe(true);
      expect(existsSync(path.join(root, "../design/illustrations", file)), `${id} → kit ${file}`).toBe(true);
    }
  });

  it("every slot id is documented in the photography brief", () => {
    const brief = readFileSync(path.join(root, "../docs/design/PHOTOGRAPHY_BRIEF.md"), "utf8");
    for (const id of SLOT_IDS) expect(brief, id).toContain(`\`${id}\``);
  });

  it("every slot has alt text and a caption in both locales", () => {
    for (const locale of ["en", "ne"]) {
      const m = JSON.parse(readFileSync(path.join(root, `messages/src/marketing.${locale}.json`), "utf8"));
      for (const id of SLOT_IDS) {
        expect(m.marketing.slots[id]?.alt, `${locale} ${id} alt`).toBeTruthy();
        expect(m.marketing.slots[id]?.caption, `${locale} ${id} caption`).toBeTruthy();
      }
    }
  });

  it("formats aspect ratios for CSS", () => {
    expect(slotAspect("hero-hvac-biratnagar")).toBe("4 / 5");
  });
});

describe("skill ladder", () => {
  it("maps verification levels to earned rungs", () => {
    expect([0, 1, 2, 3, 4, 5].map(rungsForLevel)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(rungsForLevel(-2)).toBe(1);
    expect(rungsForLevel(9)).toBe(5);
  });
});
