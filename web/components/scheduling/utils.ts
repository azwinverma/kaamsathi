import { addDays, weekdayOf } from "@/lib/format";
import type {
  RosterCell,
  RosterEntryInput,
  RosterRow,
  RosterWarning,
  RosterWarningCode,
} from "@/lib/api/types-scheduling";

/** Sunday that starts the week containing `iso` (Nepal's week runs Sunday–Saturday). */
export function weekStartOf(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

export const OFF = "off";

/** Encode a roster cell as a select value: "" (not rostered), "off", or a shift id. */
export function cellValue(cell: RosterCell | null | undefined): string {
  if (!cell) return "";
  if (cell.is_off) return OFF;
  return cell.shift_id ?? "";
}

export function isActiveOn(row: Pick<RosterRow, "start_date" | "end_date">, date: string): boolean {
  return row.start_date <= date && (!row.end_date || row.end_date >= date);
}

/** Pending edits keyed `${employment_id}|${date}` → select value. */
export type RosterEdits = Record<string, string>;

export function editKey(employmentId: string, date: string): string {
  return `${employmentId}|${date}`;
}

/** Turn edits that differ from the server grid into PUT entries. */
export function editsToEntries(rows: RosterRow[], edits: RosterEdits): RosterEntryInput[] {
  const out: RosterEntryInput[] = [];
  const byId = new Map(rows.map((r) => [r.employment_id, r]));
  for (const [key, value] of Object.entries(edits)) {
    const [employmentId, date] = key.split("|");
    const row = byId.get(employmentId);
    if (!row || cellValue(row.cells[date]) === value) continue;
    out.push({
      employment_id: employmentId,
      date,
      is_off: value === OFF,
      shift_id: value && value !== OFF ? value : null,
      site_id: row.cells[date]?.site_id ?? null,
    });
  }
  return out;
}

/** O005: human text for a cell's warnings, using the server's labels (falls back to the code). */
export function cellWarningText(
  row: Pick<RosterRow, "warnings">,
  date: string,
  labels: Partial<Record<RosterWarningCode, string>> | undefined,
): string[] {
  const codes = row.warnings?.[date] ?? [];
  return codes.map((c) => labels?.[c] || c);
}

export interface WarningSummary {
  employment_id: string;
  name: string;
  date: string;
  messages: string[];
}

/**
 * O005: group PUT /org/roster warnings into one line per worker-day, ordered by worker name then
 * date, de-duplicating repeated messages. Unknown employments fall back to `unknownName`.
 */
export function summariseWarnings(
  warnings: RosterWarning[] | undefined,
  rows: Pick<RosterRow, "employment_id" | "worker_name">[],
  unknownName = "—",
): WarningSummary[] {
  if (!warnings?.length) return [];
  const names = new Map(rows.map((r) => [r.employment_id, r.worker_name]));
  const byKey = new Map<string, WarningSummary>();
  for (const w of warnings) {
    const key = editKey(w.employment_id, w.date);
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        employment_id: w.employment_id,
        name: names.get(w.employment_id) ?? unknownName,
        date: w.date,
        messages: [],
      };
      byKey.set(key, entry);
    }
    if (!entry.messages.includes(w.message)) entry.messages.push(w.message);
  }
  return [...byKey.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date),
  );
}
