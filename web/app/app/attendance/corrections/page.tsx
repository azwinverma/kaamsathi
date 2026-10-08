import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CorrectionsPage } from "@/components/workforce/corrections-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("corrections");
  return { title: t("title") };
}

export default function Page() {
  return <CorrectionsPage />;
}
