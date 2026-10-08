import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PublicFrame } from "@/components/legal/legal-document";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { ImageSlot } from "@/components/signature/image-slot";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("legal.error");
  return { title: t("not_found_title"), robots: { index: false } };
}

export default async function NotFound() {
  const t = await getTranslations("legal.error");
  const tm = await getTranslations("marketing");
  return (
    <PublicFrame>
      <div className="mx-auto grid max-w-4xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <p className="text-coral-text tabular text-sm font-bold">404 · {tm("notfound.kicker")}</p>
          <h1 className="text-fg mt-2 text-3xl font-extrabold">{t("not_found_title")}</h1>
          <p className="text-fg-body mt-3 max-w-md text-lg">{t("not_found_body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={buttonVariants({ size: "lg" })}>
              {t("go_home")}
            </Link>
            <Link href="/help" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {tm("nav.help")}
            </Link>
          </div>
        </div>
        <CutPaperFrame tape="teal" rotate={4} className="mx-auto w-56 md:w-full">
          <ImageSlot slot="notfound-plumber" alt={tm("slots.notfound-plumber.alt")} sizes="260px" />
        </CutPaperFrame>
      </div>
    </PublicFrame>
  );
}
