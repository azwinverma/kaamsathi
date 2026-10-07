import { addDays, weekdayOf } from "@/lib/format";
import type { RosterCell, RosterEntryInput, RosterRow } from "@/lib/api/types-scheduling";

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
