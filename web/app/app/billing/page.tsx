import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BillingView } from "@/components/org/billing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

export default function BillingPage() {
  return <BillingView />;
}
