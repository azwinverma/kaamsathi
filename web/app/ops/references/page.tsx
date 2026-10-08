"use client";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { ReferenceQueue } from "@/components/experience/reference-queue";

export default function OpsReferencesPage() {
  const t = useTranslations("experience.queue");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ReferenceQueue />
    </>
  );
}
