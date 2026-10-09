import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SipaluProfileView } from "@/components/bolau/profile-view";
import { bolauLive, fetchPublicSipalu } from "@/lib/bolau/live";
import { mediaSrc } from "@/lib/media";
import { localizeDigits } from "@/lib/format";
import { pickName } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

const NOINDEX: Metadata["robots"] = { index: false, follow: false, googleBot: { index: false, follow: false } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const t = await getTranslations("bolau.meta");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  if (!(await bolauLive())) return { title: t("not_found_title"), robots: NOINDEX };
  const p = await fetchPublicSipalu(handle, locale);
  if (!p) return { title: t("not_found_title"), robots: NOINDEX };
  const name = locale === "ne" && p.name_ne ? p.name_ne : p.name;
  const trade = p.trades[0] ? pickName(p.trades[0], locale) : null;
  const headline = (locale === "ne" && p.headline_ne ? p.headline_ne : p.headline) || trade || "";
  const title = trade ? t("profile_title", { name, trade }) : t("profile_title_no_trade", { name });
  const description = t("profile_description", { name, headline, jobs: localizeDigits(p.jobs_completed, locale) });
  const photo = mediaSrc(p.photo_url);
  return {
    title: { absolute: title },
    description,
    // Indexable only when the Sipalu opted in (CONTRACT-BOLAU §8); noindex by default.
    robots: (p.indexable ?? p.public_indexable) ? { index: true, follow: true } : NOINDEX,
    alternates: { canonical: `/sipalu/${p.handle}` },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `/sipalu/${p.handle}`,
      ...(photo && /^https?:/.test(photo) ? { images: [{ url: photo, alt: name }] } : {}),
    },
  };
}

/** Public Sipalu profile (B · street mural). 404 while `bolau` is off or the handle is unknown. */
export default async function SipaluPage({ params }: Props) {
  const { handle } = await params;
  if (!(await bolauLive())) notFound();
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const p = await fetchPublicSipalu(handle, locale);
  if (!p) notFound();
  return <SipaluProfileView p={p} locale={locale} />;
}
