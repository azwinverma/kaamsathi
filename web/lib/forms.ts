"use client";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { isApiError } from "./api/errors";
import { isValidPhone, normalizePhone, toLatinDigits } from "./format";

type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * Route an API error into a react-hook-form: field errors go onto matching fields
 * (with optional key remapping, e.g. {"site_id": "site"}), anything else becomes a toast
 * or the returned banner message.
 */
export function handleFormError<TF extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TF>,
  t: T,
  opts: { fields?: readonly string[]; map?: Record<string, string>; toast?: boolean } = {},
): string | null {
  let message: string | null = null;
  if (isApiError(error)) {
    let applied = 0;
    for (const [key, msgs] of Object.entries(error.fields)) {
      const name = opts.map?.[key] ?? key;
      if (!opts.fields || opts.fields.includes(name)) {
        setError(name as Path<TF>, { type: "server", message: msgs[0] });
        applied++;
      }
    }
    const unapplied = Object.entries(error.fields).filter(([k]) => {
      const name = opts.map?.[k] ?? k;
      return opts.fields && !opts.fields.includes(name);
    });
    if (applied === 0 || unapplied.length) {
      message =
        unapplied.length && error.code === "validation_error"
          ? unapplied.map(([, m]) => m[0]).join(" ")
          : error.message || t(`errors.${error.code}`);
    }
  } else {
    message = t("errors.server_error");
  }
  if (message && opts.toast !== false) toast.error(message);
  return message;
}

/** Toast an arbitrary mutation error. */
export function toastError(error: unknown, t: T) {
  if (isApiError(error)) {
    toast.error(error.message || t(`errors.${error.code}`));
  } else {
    toast.error(t("errors.server_error"));
  }
}

// ---------------------------------------------------------------- zod helpers
export const zPhone = (msg: string) =>
  z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v) => isValidPhone(v), { message: msg });

/** Money/number entered as text (accepts Devanagari digits, commas) → normalised decimal string. */
export const zMoney = (msg: string, opts: { min?: number; optional?: boolean } = {}) => {
  const base = z
    .string()
    .transform((v) => toLatinDigits(v).replace(/[,\s]/g, ""))
    .refine((v) => (opts.optional && v === "") || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= (opts.min ?? 0)), {
      message: msg,
    });
  return base;
};

export const zRequired = (msg: string) => z.string().trim().min(1, { message: msg });
