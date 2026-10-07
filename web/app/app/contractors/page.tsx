import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContractorsPage } from "@/components/compliance/contractors-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compliance.contractors");
  return { title: t("title") };
}

export default function Page() {
  return <ContractorsPage />;
}
