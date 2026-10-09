import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ChevronDown, Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";
import { buttonVariants } from "@/components/ui/button";
import { bolauLive } from "@/lib/bolau/live";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";
import { headerNav } from "@/lib/marketing/home-layout";
import { cn } from "@/lib/utils";
import { SiteAccountMenu } from "./site-account-menu";

const MENU_ITEM = "text-fg hover:bg-surface-hover flex min-h-11 items-center rounded-sm px-3 text-[15px] font-medium";

/**
 * Public website header: calm surface bar, one strong CTA, no-JS disclosure menus.
 *
 * - Bolau ON: "Bolau a Sipalu" is the one primary button (yellow on ink, visible on phones too, next
 *   to the menu), "Become a Sipalu" is a plain link and the employer links live under "For
 *   businesses".
 * - Bolau OFF: the classic employer header (Employers / Workers / Skill Passport / Help + "Hire
 *   verified workers").
 *
 * With a session cookie the "Log in" links give way to the signed-in user's menu.
 */
export async function SiteHeader({ home = false }: { home?: boolean }) {
  const t = await getTranslations();
  const base = home ? "" : "/";
  const bolau = await bolauLive();
  const nav = headerNav(bolau, base);
  const store = await cookies();
  const hasSession = store.has(ACCESS_COOKIE) || store.has(REFRESH_COOKIE);
  const links = nav.links.map((l) => ({ href: l.href, label: t(l.label) }));
  const business = nav.business.map((l) => ({ href: l.href, label: t(l.label) }));
  const loginLinks = (
    <>
      <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
        {t("marketing.nav.login")}
      </Link>
      {nav.employerCta ? (
        <Link href="/login" className={cn(buttonVariants(), "hidden md:inline-flex")}>
          {t("marketing.nav.cta")}
        </Link>
      ) : null}
    </>
  );
  return (
    <header className="border-border bg-surface/90 sticky top-0 z-30 border-b backdrop-blur print:hidden">
      <div className={cn("mx-auto flex h-16 max-w-[1240px] items-center px-4 sm:px-8", nav.primary ? "gap-2 sm:gap-3" : "gap-3")}>
        <Logo name={t("app.name")} />
        <nav aria-label={t("marketing.nav.label")} className="ml-6 hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-fg-body hover:text-fg text-[15px] font-medium">
              {l.label}
            </Link>
          ))}
          {business.length ? (
            <details className="group relative">
              <summary className="text-fg-body hover:text-fg flex min-h-11 cursor-pointer list-none items-center gap-1 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                {t("marketing.nav.businesses")}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="border-border bg-surface absolute top-12 left-0 w-60 rounded-dense border p-2 shadow-floating">
                {business.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={MENU_ITEM}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </nav>
        <div className={cn("ml-auto flex items-center", nav.primary ? "gap-1 sm:gap-1.5" : "gap-1.5")}>
          <LanguageToggle compact />
          <span className={cn("contents", nav.primary && "max-sm:hidden")}>
            <ThemeToggle />
          </span>
          {hasSession ? <SiteAccountMenu bolau={bolau} fallback={loginLinks} /> : loginLinks}
          {nav.primary ? (
            <Link
              href={nav.primary.href}
              className="bg-yellow text-on-accent border-on-accent inline-flex min-h-10 items-center gap-1.5 rounded-control border-2 px-3 text-[15px] font-extrabold whitespace-nowrap hover:brightness-95 sm:px-4"
            >
              <span className="sm:hidden">{t("marketing.nav.bolau_short")}</span>
              <span className="max-sm:hidden">{t(nav.primary.label)}</span>
              <ArrowRight className="size-4 max-sm:hidden" aria-hidden />
            </Link>
          ) : null}
          <details className="group relative lg:hidden">
            <summary
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
              )}
              aria-label={t("marketing.nav.menu")}
            >
              <Menu aria-hidden />
            </summary>
            <div className="border-border bg-surface absolute top-12 right-0 w-64 rounded-dense border p-2 shadow-floating">
              <nav aria-label={t("marketing.nav.label")} className="flex flex-col">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className={MENU_ITEM}>
                    {l.label}
                  </Link>
                ))}
                {business.length ? (
                  <>
                    <p className="text-fg-muted mt-2 border-border border-t px-3 pt-3 pb-1 text-xs font-bold tracking-wide uppercase">
                      {t("marketing.nav.businesses")}
                    </p>
                    {business.map((l) => (
                      <Link key={l.href} href={l.href} className={MENU_ITEM}>
                        {l.label}
                      </Link>
                    ))}
                  </>
                ) : null}
                {nav.primary ? (
                  <div className="border-border mt-2 flex items-center justify-between border-t px-3 pt-2 sm:hidden">
                    <span className="text-fg-muted text-sm">{t("common.theme")}</span>
                    <ThemeToggle />
                  </div>
                ) : null}
                {hasSession ? null : (
                  <>
                    <Link href="/login" className={MENU_ITEM}>
                      {t("marketing.nav.login")}
                    </Link>
                    {nav.employerCta ? (
                      <Link href="/login" className={cn(buttonVariants(), "mt-1 min-h-11")}>
                        {t("marketing.nav.cta")}
                      </Link>
                    ) : null}
                  </>
                )}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
