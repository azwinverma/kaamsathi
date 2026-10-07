"use client";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import * as f from "./format";
import { pickName } from "./utils";

/** Locale-bound formatters for client components. */
export function useFormat() {
  const raw = useLocale();
  const locale: f.Locale = raw === "ne" ? "ne" : "en";
  return useMemo(
    () => ({
      locale,
      money: (v: string | number | null | undefined, opts?: { compact?: boolean; fallback?: string }) =>
        f.formatMoney(v, locale, opts),
      number: (v: string | number | null | undefined, opts?: { decimals?: number; fallback?: string }) =>
        f.formatNumber(v, locale, opts),
      digits: (v: string | number) => f.localizeDigits(v, locale),
      bs: (bs: string | f.YMD | null | undefined) => f.formatBs(bs, locale),
      ad: (ad: string | null | undefined) => f.formatAd(ad, locale),
      date: (ad: string | null | undefined, bs?: string | null) => f.formatDateParts(ad, locale, bs),
      dateText: (ad: string | null | undefined, bs?: string | null) => f.formatDate(ad, locale, bs),
      dateTime: (iso: string | null | undefined) => f.formatDateTime(iso, locale),
      time: (iso: string | null | undefined) => f.formatTime(iso, locale),
      clock: (hhmm: string | null | undefined) => f.formatClock(hhmm, locale),
      phone: (p: string | null | undefined) => f.formatPhone(p, locale),
      bsMonth: (y: number, m: number) => f.formatBsMonth(y, m, locale),
      monthName: (m: number) => f.bsMonthName(m, locale),
      weekday: (i: number, long = false) => f.weekdayName(i, locale, long),
      hours: (h: number | null | undefined) => f.formatHours(h, locale),
      name: (o: { name_en?: string | null; name_ne?: string | null } | null | undefined) =>
        pickName(o, locale),
    }),
    [locale],
  );
}
