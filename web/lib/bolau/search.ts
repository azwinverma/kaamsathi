/** Bolau search helpers shared by the server page and the client form (pure). */
export interface SearchValues {
  q?: string;
  trade?: string;
  district?: string;
  date?: string;
  time?: string;
  max_price?: string;
  instant?: string;
  min_rating?: string;
  language?: string;
  gender?: string;
  page?: string;
}

export const TIME_BANDS = [
  { value: "08:00", key: "time_morning" },
  { value: "12:00", key: "time_midday" },
  { value: "16:00", key: "time_evening" },
] as const;

export const SEARCH_LANGS = ["ne", "en", "hi", "mai", "bho", "new", "tha", "tam", "mgp", "gvr", "lim"] as const;

/** Count of the "more filters" that are on (for the disclosure summary). */
export function activeFilterCount(v: SearchValues): number {
  return ["max_price", "instant", "min_rating", "language", "gender"].filter((k) => !!v[k as keyof SearchValues]).length;
}

/** Clean query string for /bolau (drops empty values). */
export function searchHref(v: SearchValues): string {
  const sp = new URLSearchParams();
  for (const [k, val] of Object.entries(v)) if (val) sp.set(k, String(val));
  const s = sp.toString();
  return s ? `/bolau?${s}#results` : "/bolau#results";
}

