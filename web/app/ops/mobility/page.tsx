import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MobilityPage } from "@/components/mobility/mobility-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mobility");
  return { title: t("title") };
}

export default function OpsMobilityRoute() {
  return <MobilityPage />;
}
