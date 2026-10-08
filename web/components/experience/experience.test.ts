import { describe, expect, it } from "vitest";
import en from "@/messages/src/experience.en.json";
import ne from "@/messages/src/experience.ne.json";
import { explainRows } from "./match-explain";
import { offerDefaults } from "./offer-dialog";
import type { JobOfferSummary } from "@/lib/api/types-experience";

function keys(o: object, p = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );
}

describe("explainRows", () => {
  it("orders known components, drops zeros, keeps unknown ones last", () => {
    expect(
      explainRows({ wage: -10, trade: 50, verified: 10, nstb: 0, ...({ bonus: 2 } as object) }),
    ).toEqual([
      ["trade", 50],
      ["verified", 10],
      ["wage", -10],
      ["bonus", 2],
    ]);
    expect(explainRows(undefined)).toEqual([]);
  });
});

describe("offerDefaults", () => {
  it("maps an accepted offer onto the join form", () => {
    const offer = {
      start_date: "2026-11-01",
      site: { id: "s1", name: "Main" },
      designation: "Cook",
      wage_type: "monthly",
      basic_salary: "13000.00",
      dearness_allowance: "7380.00",
      daily_wage: null,
    } as unknown as JobOfferSummary;
    expect(offerDefaults(offer)).toMatchObject({
      start_date: "2026-11-01",
      site_id: "s1",
      basic_salary: "13000.00",
      daily_wage: "",
    });
    expect(offerDefaults(null)).toEqual({});
  });
});

describe("experience messages", () => {
  it("has the same keys in en and ne", () => {
    expect(keys(ne).sort()).toEqual(keys(en).sort());
  });
});
