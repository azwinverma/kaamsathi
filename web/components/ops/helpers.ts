"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useDistricts } from "@/lib/api/hooks/ref";
import { useFormat } from "@/lib/use-format";
import type { DistrictRef, Paginated } from "@/lib/api/types";

/** SLA targets (hours) for the ops console. */
export const SHORTLIST_SLA_HOURS = 48;
export const SLA_WARN_HOURS = 24;

export type SlaTone = "success" | "warning" | "danger";

export function slaTone(hours: number | null | undefined): SlaTone {
  const h = hours ?? 0;
  if (h < SLA_WARN_HOURS) return "success";
  if (h <= SHORTLIST_SLA_HOURS) return "warning";
  return "danger";
}

export const SLA_TEXT: Record<SlaTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/** "2026-10-07T10:00:00+05:45" → "2026-10-07" (local calendar date as sent by the API). */
export function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

/** Hours elapsed since an ISO datetime. */
export function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, (Date.now() - d) / 36e5);
}

/** Show only the last 4 characters of a sensitive value. */
export function maskTail(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/\s/g, "");
  if (s.length <= 4) return s;
  return `•••• ${s.slice(-4)}`;
}

/** Count for list endpoints that may be paginated or plain arrays. */
export function listCount<T>(data: Paginated<T> | T[] | undefined | null): number {
  if (!data) return 0;
  return Array.isArray(data) ? data.length : (data.count ?? data.results?.length ?? 0);
}

/** Code of a district that may arrive as a code string or a {code, name_*} object. */
export function districtCode(d: string | DistrictRef | null | undefined): string {
  if (!d) return "";
  return typeof d === "string" ? d : (d.code ?? "");
}

/** Resolve a district (code string or object) to a localized name. */
export function useDistrictLabel() {
  const f = useFormat();
  const { data } = useDistricts();
  const byCode = React.useMemo(() => {
    const m = new Map<string, DistrictRef>();
    for (const d of data ?? []) m.set(d.code, d);
    return m;
  }, [data]);
  return React.useCallback(
    (d: string | DistrictRef | null | undefined): string => {
      if (!d) return "";
      if (typeof d === "string") {
        const hit = byCode.get(d);
        return hit ? f.name(hit) : d.charAt(0).toUpperCase() + d.slice(1).replace(/_/g, " ");
      }
      return f.name(d) || d.code;
    },
    [byCode, f],
  );
}

const REASON_KEYS: Record<string, string> = {
  "trade match": "trade_match",
  "same district": "same_district",
  verified: "verified",
  "experienced": "experienced",
  "wage above offer": "wage_above_offer",
  "expects higher wage": "wage_above_offer",
};

/** Translate the match reason strings the API returns (falls back to the raw text). */
export function useReasonLabel() {
  const t = useTranslations("ops.reason");
  const tr = useTranslations();
  return React.useCallback(
    (reason: string): string => {
      const key = REASON_KEYS[reason.trim().toLowerCase()];
      if (key) return t(key);
      const yrs = /^(\d+)\s*yrs?\s+experience$/i.exec(reason.trim());
      if (yrs) return t("years_experience", { count: Number(yrs[1]) });
      const nstb = /^nstb\s+(.+)$/i.exec(reason.trim());
      if (nstb) {
        const lvl = nstb[1].toLowerCase().replace(/\s+/g, "");
        const k = `nstb.${lvl}`;
        if (tr.has(k)) return t("nstb", { level: tr(k) });
      }
      return reason;
    },
    [t, tr],
  );
}
