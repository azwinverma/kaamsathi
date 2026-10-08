import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayrollSettingsPage } from "@/components/payroll/payroll-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payroll_config");
  return { title: t("title") };
}

export default function Page() {
  return <PayrollSettingsPage />;
}
