import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContractorDetailPage } from "@/components/compliance/contractor-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compliance.contractors");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractorDetailPage id={id} />;
}
