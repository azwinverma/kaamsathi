"use client";
import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgenciesPanel } from "./agencies-panel";
import { DocumentQueue } from "./document-queue";

/** /ops/mobility — foreign-employment document queue + recruitment-agency licence compliance. */
export function MobilityPage() {
  const t = useTranslations("mobility");
  const [tab, setTab] = React.useState("documents");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="border-border bg-surface-muted text-fg-body mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
        <ShieldAlert className="text-brand-text mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t("rule")}</span>
      </p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="documents">{t("tab_documents")}</TabsTrigger>
          <TabsTrigger value="agencies">{t("tab_agencies")}</TabsTrigger>
        </TabsList>
        <TabsContent value="documents">
          <DocumentQueue />
        </TabsContent>
        <TabsContent value="agencies">{tab === "agencies" ? <AgenciesPanel /> : null}</TabsContent>
      </Tabs>
    </>
  );
}
