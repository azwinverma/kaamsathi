import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PartnersPage } from "@/components/partners/partners-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partners");
  return { title: t("title") };
}

export default function OpsPartnersRoute() {
  return <PartnersPage />;
}
