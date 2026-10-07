#!/usr/bin/env node
/**
 * Builds messages/en.json and messages/ne.json from messages/src/<area>.<locale>.json.
 * Each area owns its own top-level namespaces; collisions are reported as errors.
 * Also verifies en and ne have identical key sets.
 *   node scripts/merge-messages.mjs           → write
 *   node scripts/merge-messages.mjs --check   → verify generated files are up to date
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const srcDir = join(root, "src");
const check = process.argv.includes("--check");

function deepMerge(target, source, path, file, errors) {
  for (const [k, v] of Object.entries(source)) {
    const p = path ? `${path}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (target[k] !== undefined && (typeof target[k] !== "object" || target[k] === null)) {
        errors.push(`${file}: "${p}" conflicts with a string key`);
        continue;
      }
      target[k] = target[k] ?? {};
      deepMerge(target[k], v, p, file, errors);
    } else {
      if (target[k] !== undefined && target[k] !== v) errors.push(`${file}: duplicate key "${p}"`);
      target[k] = v;
    }
  }
}

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, prefix ? `${prefix}.${k}` : k) : [prefix ? `${prefix}.${k}` : k],
  );
}

const errors = [];
const out = { en: {}, ne: {} };
const files = readdirSync(srcDir).filter((f) => f.endsWith(".json")).sort((a, b) =>
  a.startsWith("core.") ? -1 : b.startsWith("core.") ? 1 : a.localeCompare(b),
);
for (const f of files) {
  const m = /^(.+)\.(en|ne)\.json$/.exec(f);
  if (!m) continue;
  let data;
  try {
    data = JSON.parse(readFileSync(join(srcDir, f), "utf8"));
  } catch (e) {
    errors.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  deepMerge(out[m[2]], data, "", f, errors);
}

const en = new Set(keys(out.en));
const ne = new Set(keys(out.ne));
for (const k of en) if (!ne.has(k)) errors.push(`missing in ne: ${k}`);
for (const k of ne) if (!en.has(k)) errors.push(`missing in en: ${k}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

for (const loc of ["en", "ne"]) {
  const file = join(root, `${loc}.json`);
  const content = JSON.stringify(out[loc], null, 2) + "\n";
  if (check) {
    let current = "";
    try {
      current = readFileSync(file, "utf8");
    } catch {}
    if (current !== content) {
      console.error(`messages/${loc}.json is out of date — run: node scripts/merge-messages.mjs`);
      process.exit(1);
    }
  } else {
    writeFileSync(file, content);
  }
}
console.log(`messages: ${en.size} keys ${check ? "verified" : "written"} (en/ne)`);
