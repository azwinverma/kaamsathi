"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredentialQueue } from "@/components/credentials/verification-queue";
import { AssessmentsPanel } from "@/components/credentials/assessments";

export default function OpsCredentialsPage() {
  return (
    <React.Suspense fallback={null}>
      <CredentialsPage />
    </React.Suspense>
  );
}

function CredentialsPage() {
  const t = useTranslations("credentials.queue");
  const params = useSearchParams();
  const router = useRouter();
  const workerId = params.get("worker");
  const [tab, setTab] = React.useState("queue");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="queue">{t("tab_queue")}</TabsTrigger>
          <TabsTrigger value="assessments">{t("tab_assessments")}</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <CredentialQueue
            key={workerId ?? "all"}
            workerId={workerId}
            onClearWorker={() => router.replace("/ops/credentials")}
          />
        </TabsContent>
        <TabsContent value="assessments">
          <AssessmentsPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}
