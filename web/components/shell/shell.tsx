"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  Building2,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import { todayIso } from "@/lib/format";
import { useLogout } from "@/lib/api/hooks/auth";
import { LogoMark } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";
import { useOptionalSession, useSession } from "@/components/providers/session";
import { isActive, type NavGroup } from "./nav";

const COLLAPSE_KEY = "ks-sidebar-collapsed";

export function Shell({
  nav,
  variant,
  children,
}: {
  nav: NavGroup[];
  variant: "app" | "ops";
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  React.useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-brand-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("common.skip_to_content")}
      </a>
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface-muted transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <SidebarContents nav={nav} variant={variant} collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg",
              collapsed && "justify-center px-0",
            )}
            aria-label={t("common.toggle_sidebar")}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
            {!collapsed ? <span>{t("common.toggle_sidebar")}</span> : null}
          </button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-surface-muted p-0" closeLabel={t("common.close")}>
          <DialogTitle className="sr-only">{t("app.name")}</DialogTitle>
          <SidebarContents nav={nav} variant={variant} collapsed={false} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} variant={variant} />
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContents({
  nav,
  variant,
  collapsed,
}: {
  nav: NavGroup[];
  variant: "app" | "ops";
  collapsed: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const session = useOptionalSession();
  const role = session?.role;
  return (
    <>
      <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        <Link href={variant === "ops" ? "/ops" : "/app"} className="flex items-center gap-2.5 rounded-md">
          <LogoMark />
          {!collapsed ? (
            <span className="flex flex-col leading-none">
              <span className="text-[16px] font-semibold tracking-tight text-fg">{t("app.name")}</span>
              {variant === "ops" ? (
                <span className="mt-0.5 text-[11px] font-medium text-accent">{t("nav.ops")}</span>
              ) : null}
            </span>
          ) : null}
        </Link>
      </div>
      {variant === "app" ? (
        <div className={cn("px-3 pb-2", collapsed && "px-2")}>
          <OrgSwitcher collapsed={collapsed} />
        </div>
      ) : null}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2" aria-label={t("app.name")}>
        {nav.map((group, gi) => {
          const items = group.items.filter((i) => !i.roles || (role && i.roles.includes(role)) || variant === "ops");
          if (!items.length) return null;
          return (
            <div key={gi} className="mb-4">
              {group.label && !collapsed ? (
                <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-fg-subtle uppercase">
                  {t(group.label)}
                </p>
              ) : group.label ? (
                <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
              ) : null}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  const link = (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors max-lg:h-11",
                        active
                          ? "bg-surface text-fg shadow-sm ring-1 ring-border"
                          : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon
                        className={cn("size-[18px] shrink-0 stroke-[1.75]", active ? "text-brand" : "")}
                        aria-hidden
                      />
                      {!collapsed ? <span className="truncate">{t(item.label)}</span> : (
                        <span className="sr-only">{t(item.label)}</span>
                      )}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip content={t(item.label)} side="right">
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      {session?.me.is_staff && variant === "app" && !collapsed ? (
        <div className="px-3 pb-3">
          <Link
            href="/ops"
            className="flex h-9 items-center gap-2 rounded-md border border-dashed border-border px-2.5 text-sm text-fg-muted hover:border-border-strong hover:text-fg"
          >
            <ShieldCheck className="size-4" aria-hidden />
            {t("nav.ops")}
          </Link>
        </div>
      ) : null}
    </>
  );
}

function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations();
  const { me, membership, switchOrg } = useSession();
  const router = useRouter();
  const name = membership?.organization.name ?? "—";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface p-2 text-left shadow-sm transition-colors hover:border-border-strong",
            collapsed && "justify-center p-1.5",
          )}
          aria-label={t("shell.switch_org")}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-xs font-semibold text-brand-subtle-fg">
            {name.slice(0, 2).toUpperCase()}
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-fg">{name}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {membership ? t(`role.${membership.role}`) : ""}
                  {membership ? ` · ${t(`industry.${membership.organization.industry}`)}` : ""}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-fg-muted" aria-hidden />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t("shell.organizations")}</DropdownMenuLabel>
        {me.memberships.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => m.organization.id !== membership?.organization.id && switchOrg(m.organization.id)}>
            <Building2 aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{m.organization.name}</span>
              <span className="block text-xs text-fg-muted">{t(`role.${m.role}`)}</span>
            </span>
            {m.organization.id === membership?.organization.id ? (
              <Check className="!text-brand" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          <Plus aria-hidden />
          {t("shell.new_org")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TodayDate() {
  const f = useFormat();
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => setToday(todayIso()), []);
  if (!today) return <span className="h-9 w-40" aria-hidden />;
  const d = f.date(today);
  return (
    <div className="hidden items-baseline gap-2 text-sm sm:flex" aria-label={`${d.bs} (${d.ad})`}>
      <span className="font-medium text-fg tabular">{d.bs}</span>
      <span className="text-xs text-fg-muted tabular">{d.ad}</span>
    </div>
  );
}

function Topbar({ onMenu, variant }: { onMenu: () => void; variant: "app" | "ops" }) {
  const t = useTranslations();
  const session = useOptionalSession();
  const router = useRouter();
  const logout = useLogout();
  const me = session?.me;
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-1 inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover lg:hidden"
        aria-label={t("common.open_menu")}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <TodayDate />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <LanguageToggle compact />
        <ThemeToggle />
        {me ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex items-center gap-2 rounded-full p-0.5 hover:bg-surface-hover sm:rounded-md sm:py-1 sm:pr-2 sm:pl-1"
                aria-label={t("shell.account_menu")}
              >
                <Avatar name={me.full_name || me.phone} size="sm" />
                <span className="hidden max-w-36 truncate text-sm font-medium text-fg md:inline">
                  {me.full_name || me.phone}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-semibold text-fg">{me.full_name || "—"}</p>
                <p className="text-xs text-fg-muted tabular">{me.phone}</p>
              </div>
              <DropdownMenuSeparator />
              {variant === "app" && session?.me.is_staff ? (
                <DropdownMenuItem onSelect={() => router.push("/ops")}>
                  <ShieldCheck aria-hidden />
                  {t("nav.ops")}
                </DropdownMenuItem>
              ) : null}
              {variant === "ops" && (me.memberships?.length ?? 0) > 0 ? (
                <DropdownMenuItem onSelect={() => router.push("/app")}>
                  <ArrowLeftRight aria-hidden />
                  {t("nav.employer_portal")}
                </DropdownMenuItem>
              ) : null}
              {variant === "app" && session?.canManage ? (
                <DropdownMenuItem onSelect={() => router.push("/app/settings")}>
                  <UserRound aria-hidden />
                  {t("nav.settings")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                danger
                onSelect={() =>
                  logout.mutate(undefined, { onSettled: () => router.replace("/login") })
                }
              >
                <LogOut aria-hidden />
                {t("common.sign_out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}

/** Full-screen loading skeleton matching the shell layout. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy>
      <div className="hidden w-64 shrink-0 border-r border-border bg-surface-muted p-4 lg:block">
        <div className="skeleton mb-6 h-8 w-32" />
        <div className="skeleton mb-6 h-12 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton mb-2 h-8 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <div className="h-16 border-b border-border bg-surface" />
        <div className="space-y-4 p-6">
          <div className="skeleton h-8 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-28" />
            ))}
          </div>
          <div className="skeleton h-72" />
        </div>
      </div>
    </div>
  );
}
