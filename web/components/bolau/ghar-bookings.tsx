"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyBookings } from "@/lib/api/hooks/bolau";
import type { Booking } from "@/lib/api/types-bolau";
import { useFormat } from "@/lib/use-format";
import { BookingStatusBadge, SipaluPortrait, useWhenText } from "./bits";

export const UPCOMING = "requested,accepted,on_the_way,arrived,in_progress,completed";
export const PAST = "confirmed,cancelled,declined,expired,no_show,disputed";
type Tab = "upcoming" | "past" | "all";
const TAB_STATUS: Record<Tab, string | undefined> = { upcoming: UPCOMING, past: PAST, all: undefined };
const PAGE_SIZE = 10;

export function bookingTitle(b: Pick<Booking, "service" | "trade" | "description">, locale: string): string {
  if (b.service) return locale === "ne" && b.service.title_ne ? b.service.title_ne : b.service.title;
  if (b.trade) return (locale === "ne" ? b.trade.name_ne : b.trade.name_en) || b.trade.name_en;
  return b.description.slice(0, 60);
}

function BookingRow({ b }: { b: Booking }) {
  const t = useTranslations("bolau.ghar");
  const f = useFormat();
  const when = useWhenText();
  const name = f.locale === "ne" && b.sipalu.name_ne ? b.sipalu.name_ne : b.sipalu.name;
  return (
    <article className="relative flex items-center gap-4 py-4">
      <SipaluPortrait name={name} photoUrl={b.sipalu.photo_url} size="sm" rotate={-2} tape="none" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-fg text-base font-bold">
            <Link href={`/ghar/bookings/${b.id}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">
              {bookingTitle(b, f.locale)}
            </Link>
          </h2>
          <BookingStatusBadge status={b.status} />
        </div>
        <p className="text-fg-body mt-0.5 text-sm">{t("with", { name })}</p>
        <p className="text-fg-muted mt-0.5 flex flex-wrap items-center gap-x-3 text-sm">
          <span className="inline-flex items-center gap-1" suppressHydrationWarning>
            <CalendarClock className="size-4" aria-hidden />
            {when(b.scheduled_start)}
          </span>
          <span className="tabular">{b.code}</span>
        </p>
      </div>
      <ArrowRight className="text-fg-muted size-5 shrink-0" aria-hidden />
    </article>
  );
}

/** Ghardhani bookings: upcoming / past / all, newest first. */
export function GharBookings() {
  const t = useTranslations("bolau");
  const [tab, setTab] = React.useState<Tab>("upcoming");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [tab]);
  const q = useMyBookings({ status: TAB_STATUS[tab], page, page_size: PAGE_SIZE });
  const rows = q.data?.results ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-fg text-2xl font-extrabold">{t("ghar.title")}</h1>
        <div className="flex gap-2">
          <Link
            href="/bolau"
            className="bg-yellow text-on-accent inline-flex min-h-11 items-center rounded-control px-4 text-sm font-bold hover:brightness-95"
          >
            {t("ghar.find")}
          </Link>
          <Link
            href="/bolau/request"
            className="border-border-strong text-fg hover:bg-surface-hover inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-semibold"
          >
            {t("ghar.new_request")}
          </Link>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-5">
        <TabsList>
          {(["upcoming", "past", "all"] as const).map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`ghar.tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mt-2">
        {q.isLoading ? (
          <div className="space-y-3 pt-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-dense" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("ghar.empty_bookings")}
            description={t("ghar.empty_bookings_body")}
            action={
              <Button asChild>
                <Link href="/bolau">{t("ghar.find")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((b) => (
              <li key={b.id}>
                <BookingRow b={b} />
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.count > PAGE_SIZE ? (
          <Pagination page={page} pageSize={PAGE_SIZE} count={q.data.count} onPageChange={setPage} />
        ) : null}
      </div>
    </div>
  );
}
