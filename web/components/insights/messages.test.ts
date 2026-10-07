/**
 * Static check: every literal translation key used in the partners / finance / insights
 * components exists in both locales (template-literal keys are covered by the enum lists below).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import { PARTNER_KINDS, PARTNER_REGULATORS, PARTNER_SCOPES } from "@/lib/api/types-partners";
import { FINANCE_REFERRAL_STATUSES, OFFER_KINDS } from "@/lib/api/types-finance";

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
  for (const area of ["partners", "finance", "insights"]) {
    const dir = join(process.cwd(), "components", area);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, file), "utf8");
      // Declarations are function-scoped; resolve each call to the nearest preceding declaration.
      const decls = [...src.matchAll(/const (\w+) = (?:useTranslations|await getTranslations)\("([\w.]+)"\)/g)].map(
        (m) => ({ v: m[1], ns: m[2], at: m.index ?? 0 }),
      );
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

describe("partners/finance/insights messages", () => {
  const keys = [
    ...usedKeys(),
    ...PARTNER_KINDS.map((k) => `partners.kind.${k}`),
    ...PARTNER_REGULATORS.map((k) => `partners.regulator.${k}`),
    ...PARTNER_SCOPES.map((s) => `partners.scope.${s.replace(".", "_")}`),
    ...OFFER_KINDS.map((k) => `finance.kind.${k}`),
    ...FINANCE_REFERRAL_STATUSES.map((s) => `finance.status.${s}`),
    ...["wages", "demand", "supply", "shortages", "certification_uplift", "origin_districts"].map(
      (r) => `insights.market.report.${r}`,
    ),
  ];

  it("finds keys to check", () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  it.each(["en", "ne"] as const)("all keys exist in %s", (loc) => {
    const tree = (loc === "en" ? en : ne) as unknown as Tree;
    const missing = keys.filter((k) => !has(tree, k));
    expect(missing).toEqual([]);
  });

  it("never calls anything a credit score", () => {
    const text = JSON.stringify({ en: (en as unknown as Tree).finance, p: (en as unknown as Tree).partners });
    expect(text.toLowerCase()).not.toMatch(/(?<!not a )credit score/);
  });
});
