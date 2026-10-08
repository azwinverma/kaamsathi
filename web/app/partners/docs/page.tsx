import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicFrame } from "@/components/legal/legal-document";
import { PartnerApiDocs } from "@/components/partners/api-docs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partners.docs");
  return { title: t("title"), description: t("intro"), alternates: { canonical: "/partners/docs" } };
}

export default function PartnerDocsPage() {
  return (
    <PublicFrame accent="api">
      <PartnerApiDocs />
    </PublicFrame>
  );
}
