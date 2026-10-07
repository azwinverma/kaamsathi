import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { PublicFrame } from "@/components/legal/legal-document";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("legal.error");
  return { title: t("not_found_title"), robots: { index: false } };
}

export default async function NotFound() {
  const t = await getTranslations("legal.error");
  return (
    <PublicFrame>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:py-32">
        <span className="bg-surface-muted text-fg-muted flex size-14 items-center justify-center rounded-full">
          <FileQuestion className="size-7" aria-hidden />
        </span>
        <p className="text-brand tabular mt-6 text-sm font-semibold">404</p>
        <h1 className="text-fg mt-1 text-2xl font-semibold">{t("not_found_title")}</h1>
        <p className="text-fg-muted mt-2">{t("not_found_body")}</p>
        <Link href="/" className={buttonVariants({ className: "mt-8" })}>
          {t("go_home")}
        </Link>
      </div>
    </PublicFrame>
  );
}
