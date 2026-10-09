"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, Home, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api/errors";
import { useLogout, useMe } from "@/lib/api/hooks/auth";
import type { Me } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";

export type AccountLink = { href: string; key: "ghar" | "app" | "ops" | "account" };

/**
 * Where a signed-in user can go from the public site, by what they are: Ghardhani bookings (while
 * Bolau is live — anyone can book), the employer app (has a membership), the ops console (staff),
 * and their account page (employer account, else the staff account).
 */
export function accountLinks(me: Pick<Me, "is_staff" | "memberships">, bolau: boolean): AccountLink[] {
  const member = (me.memberships?.length ?? 0) > 0;
  const out: AccountLink[] = [];
  if (bolau) out.push({ href: "/ghar", key: "ghar" });
  if (member) out.push({ href: "/app", key: "app" });
  if (me.is_staff) out.push({ href: "/ops", key: "ops" });
  if (member) out.push({ href: "/app/account", key: "account" });
  else if (me.is_staff) out.push({ href: "/ops/account", key: "account" });
  return out;
}

const ICON = { ghar: Home, app: Briefcase, ops: ShieldCheck, account: UserRound } as const;

/**
 * Public header account menu, rendered only when a session cookie exists. Shows the user's name
 * + a menu of the areas they can open; falls back to the "Log in" links (`fallback`) when the
 * session turns out to be expired.
 */
export function SiteAccountMenu({ bolau, fallback }: { bolau: boolean; fallback: React.ReactNode }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();

  if (me.error instanceof ApiError && me.error.status === 401) return <>{fallback}</>;
  if (!me.data) {
    return <span className="bg-surface-muted ml-1 inline-block size-9 animate-pulse rounded-full" aria-hidden />;
  }
  const u = me.data;
  const display = u.full_name || f.phone(u.phone);
  const label = (k: AccountLink["key"]) =>
    k === "ghar" ? t("bolau.nav.ghar") : k === "app" ? t("nav.employer_portal") : k === "ops" ? t("nav.ops") : t("nav.account");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-surface-hover ml-1 flex min-h-11 items-center gap-2 rounded-full p-1 sm:rounded-md sm:pr-2.5"
          aria-label={t("shell.account_menu")}
          data-testid="site-account-menu"
        >
          <Avatar name={display} size="sm" />
          <span className="text-fg hidden max-w-36 truncate text-sm font-semibold sm:inline">{display}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <div className="px-2.5 py-2">
          <p className="text-fg truncate text-sm font-semibold">{u.full_name || "—"}</p>
          <p className="text-fg-muted text-xs tabular">{f.phone(u.phone)}</p>
        </div>
        <DropdownMenuSeparator />
        {accountLinks(u, bolau).map((l) => {
          const Icon = ICON[l.key];
          return (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href}>
                <Icon aria-hidden />
                {label(l.key)}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          danger
          onSelect={() => logout.mutate(undefined, { onSettled: () => router.refresh() })}
        >
          <LogOut aria-hidden />
          {t("common.sign_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
