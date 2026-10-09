import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { bolauLive } from "@/lib/bolau/live";

/**
 * Public footer: three short columns, place, and one quiet brush accent. With Bolau on, the product
 * column leads with Bolau / Become a Sipalu and groups employers under "For businesses".
 */
export async function SiteFooter() {
  const t = await getTranslations();
  const bolau = await bolauLive();
  const cols = [
    {
      title: t("marketing.footer.product"),
      links: bolau
        ? [
            { href: "/bolau", label: t("bolau.nav.link") },
            { href: "/sipalu/join", label: t("marketing.nav.become_sipalu") },
            { href: "/#businesses", label: t("marketing.nav.businesses") },
          ]
        : [
            { href: "/#employers", label: t("marketing.nav.employers") },
            { href: "/#workers", label: t("marketing.nav.workers") },
            { href: "/#passport", label: t("marketing.nav.passport") },
          ],
    },
    {
      title: t("marketing.footer.support"),
      links: [
        { href: "/help", label: t("marketing.footer.help") },
        { href: "/developers", label: t("marketing.footer.developers") },
        { href: "/partners/docs", label: t("marketing.footer.partner_api") },
      ],
    },
    {
      title: t("marketing.footer.legal"),
      links: [
        { href: "/privacy", label: t("marketing.footer.privacy") },
        { href: "/terms", label: t("marketing.footer.terms") },
      ],
    },
  ];
  return (
    <footer className="border-border bg-surface border-t print:hidden">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Logo name={t("app.name")} />
          <p className="text-fg-body max-w-sm text-sm">{t("marketing.footer.note")}</p>
          <BrushStroke variant="underline" tone="coral" className="h-5 w-36" />
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="text-fg text-sm font-semibold">{c.title}</p>
              <ul className="mt-3 space-y-1">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-fg-muted hover:text-fg inline-flex min-h-8 items-center text-sm">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-border border-t">
        <p className="text-fg-muted mx-auto flex max-w-[1240px] flex-col gap-1 px-4 py-5 text-xs sm:flex-row sm:justify-between sm:px-8">
          <span>© KaamSathi · {t("marketing.footer.place")}</span>
          <span>{t("app.tagline")}</span>
        </p>
      </div>
    </footer>
  );
}
