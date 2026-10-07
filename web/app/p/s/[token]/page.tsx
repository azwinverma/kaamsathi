import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PassportView } from "@/components/credentials/passport-view";
import { fetchPassport, fetchQrDataUri } from "@/components/credentials/passport-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const NOINDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const locale = await getLocale();
  const t = await getTranslations("credentials.passport");
  const p = await fetchPassport("share", token, locale);
  if (!p) return { title: t("not_found_title"), robots: NOINDEX };
  return {
    title: { absolute: t("meta_title", { name: p.name }) },
    robots: NOINDEX,
    // Never leak the share token to third parties via Referer.
    referrer: "no-referrer",
  };
}

/** Skill Passport opened from a worker's time-limited, revocable share link. */
export default async function SharedPassportPage({ params }: Props) {
  const { token } = await params;
  const locale = await getLocale();
  const [payload, qr] = await Promise.all([
    fetchPassport("share", token, locale),
    fetchQrDataUri("share", token),
  ]);
  if (!payload) notFound();
  return <PassportView payload={payload} qr={qr} locale={locale === "ne" ? "ne" : "en"} />;
}
