import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayrollRunsPage } from "@/components/payroll/runs-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payroll_page");
  return { title: t("meta_title") };
}

export default function PayrollPage() {
  return <PayrollRunsPage />;
}
