import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TimesheetsPage } from "@/components/timesheets/timesheets-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("timesheets");
  return { title: t("meta_title") };
}

export default function Page() {
  return <TimesheetsPage />;
}
