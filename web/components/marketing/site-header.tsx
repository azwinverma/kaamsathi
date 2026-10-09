import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";
import { buttonVariants } from "@/components/ui/button";
import { bolauLive } from "@/lib/bolau/live";
import { cn } from "@/lib/utils";

/**
 * Public website header: calm surface bar, one strong CTA, no-JS disclosure menu on phones.
 * "Bolau a Sipalu" appears only while the `bolau` flag is on.
 */
export async function SiteHeader({ home = false }: { home?: boolean }) {
  const t = await getTranslations();
  const base = home ? "" : "/";
  const bolau = await bolauLive();
  const links = [
    ...(bolau ? [{ href: "/bolau", label: t("bolau.nav.link") }] : []),
    { href: `${base}#employers`, label: t("marketing.nav.employers") },
    { href: `${base}#workers`, label: t("marketing.nav.workers") },
    { href: `${base}#passport`, label: t("marketing.nav.passport") },
    { href: "/help", label: t("marketing.nav.help") },
  ];
  return (
    <header className="border-border bg-surface/90 sticky top-0 z-30 border-b backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-8">
        <Logo name={t("app.name")} />
        <nav aria-label={t("marketing.nav.label")} className="ml-6 hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-fg-body hover:text-fg text-[15px] font-medium">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LanguageToggle compact />
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
          >
            {t("marketing.nav.login")}
          </Link>
          <Link href="/login" className={cn(buttonVariants(), "hidden md:inline-flex")}>
            {t("marketing.nav.cta")}
          </Link>
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
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-fg hover:bg-surface-hover flex min-h-11 items-center rounded-sm px-3 text-[15px] font-medium"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link
                  href="/login"
                  className="text-fg hover:bg-surface-hover flex min-h-11 items-center rounded-sm px-3 text-[15px] font-medium"
                >
                  {t("marketing.nav.login")}
                </Link>
                <Link href="/login" className={cn(buttonVariants(), "mt-1 min-h-11")}>
                  {t("marketing.nav.cta")}
                </Link>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
