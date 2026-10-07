import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CompliancePage } from "@/components/compliance/compliance-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compliance");
  return { title: t("title") };
}

export default function Page() {
  return <CompliancePage />;
}
