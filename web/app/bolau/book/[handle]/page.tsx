import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { BookingFlow } from "@/components/bolau/booking-flow";
import { RatingInline, SipaluPortrait } from "@/components/bolau/bits";
import { BolauChrome, WRAP } from "@/components/bolau/chrome";
import { DotTexture } from "@/components/signature/dot-texture";
import { bolauLive, fetchPublicSipalu } from "@/lib/bolau/live";
import { cn, pickName } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ service?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const t = await getTranslations("bolau.meta");
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const p = (await bolauLive()) ? await fetchPublicSipalu(handle, locale) : null;
  const name = p ? (locale === "ne" && p.name_ne ? p.name_ne : p.name) : null;
  return {
    title: name ? t("book_title", { name }) : t("not_found_title"),
    robots: { index: false, follow: false },
  };
}

/** Booking flow page (B header strip, calm form surface). 404 while `bolau` is off. */
export default async function BookPage({ params, searchParams }: Props) {
  const { handle } = await params;
  if (!(await bolauLive())) notFound();
  const locale = (await getLocale()) === "ne" ? "ne" : "en";
  const p = await fetchPublicSipalu(handle, locale);
  if (!p) notFound();
  const t = await getTranslations("bolau");
  const sp = await searchParams;
  const service = Array.isArray(sp.service) ? sp.service[0] : sp.service;
  const name = locale === "ne" && p.name_ne ? p.name_ne : p.name;
  const trade = p.trades[0] ? pickName(p.trades[0], locale) : null;
  const firstName = name.split(/\s+/)[0] ?? name;

  return (
    <BolauChrome footer={false}>
      <section aria-labelledby="book-title" className="bg-hero text-hero-fg relative isolate overflow-hidden">
        <span aria-hidden className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
        <DotTexture className="-z-10" />
        <div className={cn(WRAP, "max-w-3xl! py-6 sm:py-8")}>
          <Link
            href={`/sipalu/${p.handle}`}
            className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-white/90 hover:text-white hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {name}
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <SipaluPortrait name={name} photoUrl={p.photo_url} size="sm" rotate={-4} tape="teal" />
            <div className="min-w-0">
              <h1 id="book-title" className="text-hero-fg text-2xl font-extrabold sm:text-3xl">
                {t("book.title", { name: firstName })}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
                {trade ? <span className="font-semibold text-white">{trade}</span> : null}
                <span className="bg-surface text-fg rounded-pill px-2 py-0.5">
                  <RatingInline avg={p.rating_avg} count={p.rating_count} />
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className={cn(WRAP, "max-w-3xl! py-8 pb-16")}>
        {p.bookable === false ? (
          <p className="text-fg-body">{t("profile.not_bookable", { name: firstName })}</p>
        ) : (
          <BookingFlow p={p} initialService={service} />
        )}
      </div>
    </BolauChrome>
  );
}
