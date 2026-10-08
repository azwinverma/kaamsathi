import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LabourMarketView } from "@/components/insights/labour-market";
import { InsightsTabs } from "@/components/kpis/insights-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("insights.market");
  return { title: t("title") };
}

export default function OpsInsightsRoute() {
  return <InsightsTabs market={<LabourMarketView />} />;
}
