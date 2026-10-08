import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DeveloperDocs } from "@/components/integrations/developer-docs";
import { PublicFrame } from "@/components/legal/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("developers");
  return { title: t("title"), description: t("intro"), alternates: { canonical: "/developers" } };
}

export default function DevelopersPage() {
  return (
    <PublicFrame>
      <DeveloperDocs />
    </PublicFrame>
  );
}
