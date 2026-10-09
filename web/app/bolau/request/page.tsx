import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BolauChrome, WRAP } from "@/components/bolau/chrome";
import { KaamRequestForm } from "@/components/bolau/request-form";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { DotTexture } from "@/components/signature/dot-texture";
import { bolauLive } from "@/lib/bolau/live";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ trade?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bolau");
  return {
    title: t("meta.request_title"),
    description: t("request.body"),
    robots: { index: false, follow: true },
  };
}

/** Post a Kaam request (B header strip + calm form). 404 while `bolau` is off. */
export default async function KaamRequestPage({ searchParams }: Props) {
  if (!(await bolauLive())) notFound();
  const t = await getTranslations("bolau.request");
  const sp = await searchParams;
  const trade = Array.isArray(sp.trade) ? sp.trade[0] : sp.trade;
  return (
    <BolauChrome footer={false}>
      <section aria-labelledby="req-title" className="bg-hero text-hero-fg relative isolate overflow-hidden">
        <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
        <DotTexture className="-z-10" />
        <BrushStroke variant="underline" tone="yellow" className="absolute right-6 bottom-6 hidden h-6 w-40 sm:block" />
        <div className={cn(WRAP, "max-w-3xl! py-8 sm:py-10")}>
          <h1 id="req-title" className="text-hero-fg text-3xl font-extrabold">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-white/90">{t("body")}</p>
        </div>
      </section>
      <div className={cn(WRAP, "max-w-3xl! py-8 pb-16")}>
        <KaamRequestForm initialTrade={trade} />
      </div>
    </BolauChrome>
  );
}
