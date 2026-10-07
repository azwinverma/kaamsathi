import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TableSkeleton } from "@/components/ui/feedback";
import { CandidatesPage } from "@/components/hiring/candidates-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("candidates") };
}

export default function Page() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={5} />}>
      <CandidatesPage />
    </Suspense>
  );
}
