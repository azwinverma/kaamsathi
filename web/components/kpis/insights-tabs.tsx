"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeatmapView } from "./heatmap";

/** /ops/insights: existing labour-market view + the district heatmap tab. */
export function InsightsTabs({ market }: { market: React.ReactNode }) {
  const t = useTranslations("kpis.heatmap");
  const [tab, setTab] = React.useState("market");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-6">
        <TabsTrigger value="market">{t("tab_market")}</TabsTrigger>
        <TabsTrigger value="heatmap">{t("tab_heatmap")}</TabsTrigger>
      </TabsList>
      <TabsContent value="market">{market}</TabsContent>
      <TabsContent value="heatmap">{tab === "heatmap" ? <HeatmapView /> : null}</TabsContent>
    </Tabs>
  );
}
