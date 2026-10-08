import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicFrame } from "@/components/legal/legal-document";
import { HelpIndex, fetchHelpArticles } from "@/components/support/help-public";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("support.help");
  return { title: t("title"), description: t("subtitle"), alternates: { canonical: "/help" } };
}

type Props = { searchParams: Promise<{ audience?: string; q?: string }> };

/** Public help center (no login). */
export default async function HelpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const audience = sp.audience === "worker" || sp.audience === "employer" ? sp.audience : "all";
  const q = (sp.q ?? "").slice(0, 100);
  const locale = await getLocale();
  const articles = await fetchHelpArticles(locale, { audience, q });
  return (
    <PublicFrame accent="help">
      <HelpIndex articles={articles} audience={audience} q={q} />
    </PublicFrame>
  );
}
