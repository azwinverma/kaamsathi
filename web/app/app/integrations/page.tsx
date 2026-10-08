import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { IntegrationsPage } from "@/components/integrations/integrations-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("integrations");
  return { title: t("meta_title") };
}

export default function Page() {
  return <IntegrationsPage />;
}
