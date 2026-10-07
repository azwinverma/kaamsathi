import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** RFC4122 v4 UUID (used for attendance client_uuid). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Read a cookie in the browser. */
export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Localised name pick for {name_en, name_ne} objects. */
export function pickName(
  obj: { name_en?: string | null; name_ne?: string | null } | null | undefined,
  locale: string,
): string {
  if (!obj) return "";
  return (locale === "ne" ? obj.name_ne || obj.name_en : obj.name_en || obj.name_ne) ?? "";
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
