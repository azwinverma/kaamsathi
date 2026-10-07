import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/components/legal/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/privacy" },
  };
}

export default function PrivacyPolicyPage() {
  return <LegalDocument doc="privacy" />;
}
