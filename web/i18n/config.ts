export const locales = ["en", "ne"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export function isLocale(v: unknown): v is AppLocale {
  return v === "en" || v === "ne";
}
