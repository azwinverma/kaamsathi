import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FinancePage } from "@/components/finance/finance-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance");
  return { title: t("title") };
}

export default function OpsFinanceRoute() {
  return <FinancePage />;
}
