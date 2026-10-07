import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE } from "@/lib/cookies";
import { defaultLocale, isLocale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : defaultLocale;
  return {
    locale,
    timeZone: "Asia/Kathmandu",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
