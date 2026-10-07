import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrgAnalyticsView } from "@/components/insights/org-analytics";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("insights.org");
  return { title: t("title") };
}

export default function AnalyticsPage() {
  return <OrgAnalyticsView />;
}
