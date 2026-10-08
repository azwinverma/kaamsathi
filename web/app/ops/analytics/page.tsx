import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OpsAnalyticsPage } from "@/components/billing/ops-analytics-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ops_analytics");
  return { title: t("title") };
}

export default function OpsAnalyticsRoute() {
  return <OpsAnalyticsPage />;
}
