import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OpsBillingPage } from "@/components/billing/ops-billing-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ops_billing");
  return { title: t("title") };
}

export default function OpsBillingRoute() {
  return <OpsBillingPage />;
}
