import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JobsPage } from "@/components/hiring/jobs-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("jobs") };
}

export default function Page() {
  return <JobsPage />;
}
