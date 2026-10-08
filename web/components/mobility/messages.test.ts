/**
 * Static check: every literal translation key used in the mobility / kpis components exists in
 * both locales (template-literal keys are covered by the enum lists below).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import {
  AGENCY_COMPLIANCE_STATUSES,
  HEATMAP_METRICS,
  KPI_PERIODS,
  MOBILITY_DOC_STATUSES,
} from "@/lib/api/types-mobility";

type Tree = { [k: string]: string | Tree };

function has(tree: Tree, path: string): boolean {
  let cur: string | Tree | undefined = tree;
  for (const part of path.split(".")) {
    if (!cur || typeof cur === "string") return false;
    cur = cur[part];
  }
  return typeof cur === "string";
}

function usedKeys(): string[] {
  const out: string[] = [];
  for (const area of ["mobility", "kpis"]) {
    const dir = join(process.cwd(), "components", area);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, file), "utf8");
      const decls = [
        ...src.matchAll(/const (\w+) = (?:useTranslations|await getTranslations)\("([\w.]+)"\)/g),
      ].map((m) => ({ v: m[1], ns: m[2], at: m.index ?? 0 }));
      for (const v of new Set(decls.map((d) => d.v))) {
        for (const m of src.matchAll(new RegExp(`\\b${v}\\("([\\w.]+)"`, "g"))) {
          const at = m.index ?? 0;
          const decl = decls.filter((d) => d.v === v && d.at < at).pop();
          if (decl) out.push(`${decl.ns}.${m[1]}`);
        }
      }
    }
  }
  return out;
}

describe("mobility/kpis messages", () => {
  const keys = [
    ...usedKeys(),
    ...MOBILITY_DOC_STATUSES.map((s) => `mobility.status.${s}`),
    ...AGENCY_COMPLIANCE_STATUSES.map((s) => `mobility.agencies.compliance_status.${s}`),
    ...HEATMAP_METRICS.flatMap((m) => [
      `kpis.heatmap.metric.${m}`,
      `kpis.heatmap.metric_hint.${m}`,
    ]),
    ...KPI_PERIODS.map((p) => `kpis.period.${p}`),
    ...["workers", "organizations", "paying_organizations", "placements", "median_fill_days"].map(
      (k) => `kpis.exit.${k}`,
    ),
    "partners.scope.mobility_read",
  ];

  it("finds keys to check", () => {
    expect(keys.length).toBeGreaterThan(60);
  });

  it.each(["en", "ne"] as const)("all keys exist in %s", (loc) => {
    const tree = (loc === "en" ? en : ne) as unknown as Tree;
    expect(keys.filter((k) => !has(tree, k))).toEqual([]);
  });

  it("states we never recruit for jobs abroad", () => {
    expect((en as unknown as { mobility: { rule: string } }).mobility.rule).toMatch(
      /never recruits/,
    );
  });
});
