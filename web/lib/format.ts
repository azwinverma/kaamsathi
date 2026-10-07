/**
 * Nepal-specific formatting (docs/DESIGN.md → "Formatting rules").
 *
 * - Money:  Rs. 1,23,456  /  रु. १,२३,४५६   (lakh grouping, decimals only when paisa ≠ 0)
 * - Dates:  BS first ("21 Ashwin 2083"), AD secondary ("7 Oct 2026")
 * - Phone:  +977 98X-XXX-XXXX
 * - Nepali locale uses Devanagari numerals everywhere.
 */
import NepaliDate, { dateConfigMap } from "nepali-date-converter";

export type Locale = "en" | "ne";

const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toDevanagariDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]);
}

export function toLatinDigits(input: string): string {
  return input.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/** Apply Devanagari digits when locale is ne. */
export function localizeDigits(input: string | number, locale: Locale): string {
  return locale === "ne" ? toDevanagariDigits(input) : String(input);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Group an integer string the South-Asian way: 1,23,45,678 */
function groupLakh(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

export function formatNumber(
  value: string | number | null | undefined,
  locale: Locale = "en",
  opts: { decimals?: number; fallback?: string } = {},
): string {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? "—";
  const negative = n < 0;
  const abs = Math.abs(n);
  let fixed: string;
  if (opts.decimals !== undefined) {
    fixed = abs.toFixed(opts.decimals);
  } else {
    fixed = Number.isInteger(abs) ? String(abs) : String(Math.round(abs * 100) / 100);
  }
  const [intPart, frac] = fixed.split(".");
  const out = (negative ? "-" : "") + groupLakh(intPart) + (frac ? "." + frac : "");
  return localizeDigits(out, locale);
}

/**
 * Format NPR money. Accepts the contract's decimal strings ("19550.00").
 * `Rs. 19,550` · `Rs. 1,23,456.50` · `रु. १९,५५०`
 */
export function formatMoney(
  value: string | number | null | undefined,
  locale: Locale = "en",
  opts: { fallback?: string; compact?: boolean } = {},
): string {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? "—";
  const prefix = locale === "ne" ? "रु." : "Rs.";
  const abs = Math.abs(n);
  if (opts.compact && abs >= 100000) {
    const isCrore = abs >= 10000000;
    const v = isCrore ? abs / 10000000 : abs / 100000;
    const unit =
      locale === "ne" ? (isCrore ? " करोड" : " लाख") : isCrore ? " Cr" : " L";
    const num = localizeDigits(String(Math.round(v * 100) / 100), locale);
    return `${n < 0 ? "-" : ""}${prefix} ${num}${unit}`;
  }
  const rounded = Math.round(abs * 100) / 100;
  const hasPaisa = Math.round(rounded * 100) % 100 !== 0;
  const body = formatNumber(rounded, locale, { decimals: hasPaisa ? 2 : 0 });
  return `${n < 0 ? "-" : ""}${prefix} ${body}`;
}

// ---------------------------------------------------------------------------
// Bikram Sambat
// ---------------------------------------------------------------------------

export const BS_MONTHS_EN = [
  "Baishakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

export const BS_MONTHS_NE = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कात्तिक",
  "मंसिर",
  "पुस",
  "माघ",
  "फागुन",
  "चैत",
] as const;

const AD_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"];
const WEEKDAYS_LONG_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAYS_LONG_NE = [
  "आइतबार",
  "सोमबार",
  "मंगलबार",
  "बुधबार",
  "बिहिबार",
  "शुक्रबार",
  "शनिबार",
];

export function bsMonthName(month: number, locale: Locale = "en"): string {
  const list = locale === "ne" ? BS_MONTHS_NE : BS_MONTHS_EN;
  return list[month - 1] ?? "";
}

export function weekdayName(index: number, locale: Locale = "en", long = false): string {
  if (long) return (locale === "ne" ? WEEKDAYS_LONG_NE : WEEKDAYS_LONG_EN)[index] ?? "";
  return (locale === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN)[index] ?? "";
}

export interface YMD {
  year: number;
  month: number; // 1-12
  day: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseIsoDate(iso: string): YMD | null {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function toIsoDate({ year, month, day }: YMD): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Convert an AD ISO date (YYYY-MM-DD) to BS parts. Timezone-safe (uses calendar parts only). */
export function adToBs(adIso: string): YMD | null {
  const p = parseIsoDate(adIso);
  if (!p) return null;
  try {
    // Noon local time avoids DST / offset edge cases.
    const nd = new NepaliDate(new Date(p.year, p.month - 1, p.day, 12));
    return { year: nd.getYear(), month: nd.getMonth() + 1, day: nd.getDate() };
  } catch {
    return null;
  }
}

/** Convert BS parts to AD ISO date. */
export function bsToAd(bs: YMD): string | null {
  try {
    const nd = new NepaliDate(bs.year, bs.month - 1, bs.day);
    const js = nd.toJsDate();
    return toIsoDate({ year: js.getFullYear(), month: js.getMonth() + 1, day: js.getDate() });
  } catch {
    return null;
  }
}

const CONFIG_KEYS = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

/** Number of days in a BS month (1-12). */
export function bsMonthLength(year: number, month: number): number {
  const cfg = dateConfigMap[String(year)];
  if (!cfg) return 30;
  return cfg[CONFIG_KEYS[month - 1]];
}

/** Today's date as AD ISO in Asia/Kathmandu. */
export function todayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA → YYYY-MM-DD
}

export function todayBs(now: Date = new Date()): YMD {
  return adToBs(todayIso(now)) as YMD;
}

/** Shift an AD ISO date by n days. */
export function addDays(iso: string, n: number): string {
  const p = parseIsoDate(iso);
  if (!p) return iso;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return toIsoDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

/** Weekday index (0=Sun) for an AD ISO date. */
export function weekdayOf(iso: string): number {
  const p = parseIsoDate(iso);
  if (!p) return 0;
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** "21 Ashwin 2083" / "२१ असोज २०८३". Accepts a BS ISO string or parts. */
export function formatBs(bs: string | YMD | null | undefined, locale: Locale = "en"): string {
  if (!bs) return "—";
  const p = typeof bs === "string" ? parseIsoDate(bs) : bs;
  if (!p) return "—";
  return localizeDigits(`${p.day} ${bsMonthName(p.month, locale)} ${p.year}`, locale);
}

/** "Ashwin 2083" */
export function formatBsMonth(year: number, month: number, locale: Locale = "en"): string {
  return `${bsMonthName(month, locale)} ${localizeDigits(year, locale)}`;
}

/** "7 Oct 2026" (Nepali: "७ Oct २०२६" — AD month names stay Latin, digits localised). */
export function formatAd(adIso: string | null | undefined, locale: Locale = "en"): string {
  if (!adIso) return "—";
  const p = parseIsoDate(adIso);
  if (!p) return "—";
  return localizeDigits(`${p.day} ${AD_MONTHS_SHORT[p.month - 1]} ${p.year}`, locale);
}

/**
 * BS-first display for an AD date (optionally with the server-provided `_bs`).
 * Returns { bs: "21 Ashwin 2083", ad: "7 Oct 2026" }.
 */
export function formatDateParts(
  adIso: string | null | undefined,
  locale: Locale = "en",
  bsIso?: string | null,
): { bs: string; ad: string } {
  if (!adIso) return { bs: "—", ad: "" };
  const bs = bsIso ? parseIsoDate(bsIso) : adToBs(adIso);
  return { bs: formatBs(bs, locale), ad: formatAd(adIso, locale) };
}

/** Single-string "21 Ashwin 2083 (7 Oct 2026)". */
export function formatDate(
  adIso: string | null | undefined,
  locale: Locale = "en",
  bsIso?: string | null,
): string {
  if (!adIso) return "—";
  const { bs, ad } = formatDateParts(adIso, locale, bsIso);
  return `${bs} (${ad})`;
}

/** 12-hour time from an ISO datetime, in Asia/Kathmandu: "9:05 AM" / "९:०५ AM". */
export function formatTime(isoDateTime: string | null | undefined, locale: Locale = "en"): string {
  if (!isoDateTime) return "—";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "—";
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return localizeDigits(s, locale);
}

/** "HH:MM[:SS]" (shift times) → "9:00 AM". */
export function formatClock(hhmm: string | null | undefined, locale: Locale = "en"): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return localizeDigits(`${h12}:${String(m || 0).padStart(2, "0")} ${suffix}`, locale);
}

/** Datetime: BS date + time. */
export function formatDateTime(isoDateTime: string | null | undefined, locale: Locale = "en"): string {
  if (!isoDateTime) return "—";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "—";
  const ad = todayIso(d);
  return `${formatBs(adToBs(ad), locale)}, ${formatTime(isoDateTime, locale)}`;
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export const PHONE_RE = /^9[78]\d{8}$/;

/** Strip +977 / 977 / spaces / dashes and Devanagari digits → "98XXXXXXXX". */
export function normalizePhone(input: string): string {
  let digits = toLatinDigits(input).replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("977")) digits = digits.slice(3);
  return digits;
}

export function isValidPhone(input: string): boolean {
  return PHONE_RE.test(normalizePhone(input));
}

/** "9812345678" → "+977 981-234-5678". Masked numbers ("98XXXXX123") are shown as-is. */
export function formatPhone(input: string | null | undefined, locale: Locale = "en"): string {
  if (!input) return "—";
  const raw = input.replace(/^\+?977[\s-]?/, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(raw)) return localizeDigits(`+977 ${raw}`, locale);
  const out = `+977 ${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
  return localizeDigits(out, locale);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** "36h" / "2d 4h" for hours_open. */
export function formatHours(hours: number | null | undefined, locale: Locale = "en"): string {
  if (hours === null || hours === undefined) return "—";
  const h = Math.max(0, Math.round(hours));
  const out =
    h < 48 ? `${h}${locale === "ne" ? " घण्टा" : "h"}` : `${Math.floor(h / 24)}${locale === "ne" ? " दिन " : "d "}${h % 24}${locale === "ne" ? " घण्टा" : "h"}`;
  return localizeDigits(out, locale);
}

/** Fiscal year for a BS date: Shrawan (4) starts a new FY → "2083/84". */
export function fiscalYear(bs: YMD): string {
  const start = bs.month >= 4 ? bs.year : bs.year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
