import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RosterPage } from "@/components/scheduling/roster-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scheduling");
  return { title: t("title") };
}

export default function Page() {
  return <RosterPage />;
}
