import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PassportView } from "@/components/credentials/passport-view";
import { fetchPassport, fetchQrDataUri } from "@/components/credentials/passport-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

const NOINDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const locale = await getLocale();
  const t = await getTranslations("credentials.passport");
  const p = await fetchPassport("code", code, locale);
  if (!p) return { title: t("not_found_title"), robots: NOINDEX };
  return {
    title: { absolute: t("meta_title", { name: p.name }) },
    description: t("meta_description", { name: p.name }),
    robots: NOINDEX,
    referrer: "no-referrer",
  };
}

/** Public Skill Passport — only while the worker has made it public. */
export default async function PublicPassportPage({ params }: Props) {
  const { code } = await params;
  const locale = await getLocale();
  const [payload, qr] = await Promise.all([
    fetchPassport("code", code, locale),
    fetchQrDataUri("code", code),
  ]);
  if (!payload) notFound();
  return <PassportView payload={payload} qr={qr} locale={locale === "ne" ? "ne" : "en"} />;
}
