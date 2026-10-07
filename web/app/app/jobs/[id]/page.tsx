import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JobDetailPage } from "@/components/hiring/job-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("jobs") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailPage id={id} />;
}
