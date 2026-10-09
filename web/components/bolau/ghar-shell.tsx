"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMe } from "@/lib/api/hooks/auth";
import { useClientFlags } from "@/lib/api/hooks/flags";
import { ApiError } from "@/lib/api/errors";
import { bolauOnFromFlags } from "@/lib/bolau/flag";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

export const GHAR_NAV = [
  { href: "/ghar", key: "bookings", exact: false, match: ["/ghar", "/ghar/bookings"] },
  { href: "/ghar/requests", key: "requests", match: ["/ghar/requests"] },
  { href: "/ghar/addresses", key: "addresses", match: ["/ghar/addresses"] },
  { href: "/ghar/favourites", key: "favourites", match: ["/ghar/favourites"] },
] as const;

export function gharActive(pathname: string): string {
  let best: string = GHAR_NAV[0].href;
  let len = 0;
  for (const item of GHAR_NAV) {
    for (const m of item.match) {
      const hit = m === "/ghar" ? pathname === "/ghar" : pathname === m || pathname.startsWith(`${m}/`);
      if (hit && m.length > len) {
        best = item.href;
        len = m.length;
      }
    }
  }
  return best;
}

/**
 * Ghardhani area frame (/ghar): requires a session (middleware + here), hidden when the `bolau`
 * flag is off for this user, and a tab bar for bookings · requests · addresses · saved Sipalu.
 */
export function GharShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("bolau.ghar");
  const f = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const flags = useClientFlags();
  const unauth = me.error instanceof ApiError && me.error.status === 401;

  React.useEffect(() => {
    if (unauth) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [unauth, router, pathname]);

  if (me.isLoading || flags.isLoading || unauth) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8" aria-busy>
        <div className="bg-surface-muted h-8 w-48 animate-pulse rounded-dense" />
        <div className="bg-surface-muted mt-6 h-40 animate-pulse rounded-card" />
      </div>
    );
  }
  if (!bolauOnFromFlags(flags.data?.flags)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <h1 className="text-fg text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-fg-body mt-2">{t("off")}</p>
      </div>
    );
  }

  const active = gharActive(pathname);
  const name = me.data?.full_name || (me.data ? f.phone(me.data.phone) : "");
  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-16 sm:px-8 sm:pt-8">
      <p className="text-coral-text text-sm font-bold tracking-wide">
        {t("kicker")} · {t("hello", { name })}
      </p>
      <nav aria-label={t("nav_label")} className="border-border mt-3 border-b">
        <ul className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {GHAR_NAV.map((item) => {
            const on = item.href === active;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap",
                    on ? "border-yellow text-fg" : "text-fg-muted hover:text-fg border-transparent",
                  )}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="pt-6">{children}</div>
    </div>
  );
}
