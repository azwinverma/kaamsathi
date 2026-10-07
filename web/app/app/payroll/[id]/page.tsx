import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayrollRunPage } from "@/components/payroll/run-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payroll_page");
  return { title: t("meta_run_title") };
}

export default async function PayrollRunRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayrollRunPage id={id} />;
}
