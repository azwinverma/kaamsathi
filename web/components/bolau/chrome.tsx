import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/** Public Bolau page frame (B · street mural): skip link, the site header/footer, one <main>. */
export async function BolauChrome({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  const t = await getTranslations("common");
  return (
    <div className="bg-bg min-h-dvh">
      <a
        href="#main"
        className="bg-brand text-brand-fg sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skip_to_content")}
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      {footer ? <SiteFooter /> : null}
    </div>
  );
}

export const WRAP = "mx-auto max-w-[1240px] px-4 sm:px-8";
