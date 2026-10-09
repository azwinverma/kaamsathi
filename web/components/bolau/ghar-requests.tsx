"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ClipboardList, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton, errorMessage } from "@/components/ui/feedback";
import { useAcceptOffer, useBolauConfig, useCancelRequest, useKaamRequest, useMyRequests } from "@/lib/api/hooks/bolau";
import type { KaamRequest, Offer, OfferStatus, RequestStatus } from "@/lib/api/types-bolau";
import { mediaSrc } from "@/lib/media";
import { useFormat } from "@/lib/use-format";
import { FeeLine, PriceText, RatingInline, RungChip, SipaluPortrait, useWhenText } from "./bits";

const REQUEST_TONE: Record<RequestStatus, BadgeTone> = {
  open: "warning",
  offers_received: "brand",
  booked: "success",
  expired: "neutral",
  cancelled: "neutral",
};
const OFFER_TONE: Record<OfferStatus, BadgeTone> = {
  pending: "warning",
  accepted: "success",
  rejected: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
};

function RequestBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations("bolau.request.status");
  return (
    <Badge tone={REQUEST_TONE[status]} dot>
      {t(status)}
    </Badge>
  );
}

/** Ghardhani's Kaam requests, newest first. */
export function GharRequests() {
  const t = useTranslations("bolau");
  const f = useFormat();
  const q = useMyRequests({ page_size: 50 });
  const rows = q.data?.results ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-fg text-2xl font-extrabold">{t("ghar.requests_title")}</h1>
        <Link
          href="/bolau/request"
          className="bg-yellow text-on-accent inline-flex min-h-11 items-center rounded-control px-4 text-sm font-bold hover:brightness-95"
        >
          {t("ghar.new_request")}
        </Link>
      </div>
      <div className="mt-4">
        {q.isLoading ? (
          <Skeleton className="h-24 rounded-dense" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t("ghar.empty_requests")} description={t("request.body")} />
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((r) => (
              <li key={r.id} className="relative flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-fg text-base font-bold">
                      <Link href={`/ghar/requests/${r.id}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">
                        {r.title}
                      </Link>
                    </h2>
                    <RequestBadge status={r.status} />
                  </div>
                  <p className="text-fg-muted mt-0.5 text-sm">
                    {[r.trade ? f.name(r.trade) : null, r.code, t("request.offers_count", { count: r.offers_count ?? r.offers?.length ?? 0 })]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ArrowRight className="text-fg-muted size-5 shrink-0" aria-hidden />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function offerName(o: Offer, locale: string) {
  const s = o.sipalu as { name: string; name_ne?: string | null };
  return locale === "ne" && s.name_ne ? s.name_ne : s.name;
}

/**
 * Offers compare view: at most three offers side by side (stacked on phones) with the facts that
 * matter — price, when they can start, rating, jobs done, ladder rung and their message.
 */
function OffersCompare({ r }: { r: KaamRequest }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const when = useWhenText();
  const router = useRouter();
  const accept = useAcceptOffer();
  const config = useBolauConfig().data;
  const [picked, setPicked] = React.useState<Offer | null>(null);
  const offers = (r.offers ?? []).slice(0, 3);
  const canAccept = r.status === "open" || r.status === "offers_received";

  if (!offers.length) {
    return (
      <p className="text-fg-body bg-surface-muted flex items-start gap-2 rounded-dense px-4 py-3">
        <Hourglass className="text-fg-muted mt-0.5 size-4 shrink-0" aria-hidden />
        {t("request.offers_waiting")}
      </p>
    );
  }
  return (
    <>
      <ul className="grid gap-4 md:grid-cols-3">
        {offers.map((o, i) => {
          const s = o.sipalu as {
            handle?: string | null;
            photo_url?: string | null;
            rating_avg?: number | string | null;
            rating_count?: number;
            jobs_completed?: number;
            verification_level?: number;
          };
          const name = offerName(o, f.locale);
          return (
            <li key={o.id} className="border-border bg-surface flex flex-col rounded-card border p-4">
              <div className="flex items-center gap-3">
                <SipaluPortrait name={name} photoUrl={s.photo_url} size="sm" rotate={i % 2 ? 2 : -2} tape="none" />
                <div className="min-w-0">
                  <h3 className="text-fg font-bold">
                    {s.handle ? (
                      <Link href={`/sipalu/${s.handle}`} className="hover:underline">
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </h3>
                  <Badge tone={OFFER_TONE[o.status]} className="mt-1">
                    {t(`request.offer_status.${o.status}`)}
                  </Badge>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{t("request.offer_price")}</dt>
                  <dd className="text-fg text-right font-extrabold">
                    <PriceText p={{ price_type: o.price_type, price: o.price, visit_fee: o.visit_fee }} />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{t("request.offer_start")}</dt>
                  <dd className="text-fg text-right" suppressHydrationWarning>
                    {o.proposed_start ? when(o.proposed_start) : "—"}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RatingInline avg={s.rating_avg} count={s.rating_count ?? 0} />
                  {typeof s.verification_level === "number" ? <RungChip level={s.verification_level} /> : null}
                </div>
                {typeof s.jobs_completed === "number" ? (
                  <p className="text-fg-muted">{t("card.jobs", { count: s.jobs_completed })}</p>
                ) : null}
              </dl>
              {o.message ? (
                <blockquote className="border-yellow text-fg-body mt-3 border-l-4 pl-3 text-sm">{o.message}</blockquote>
              ) : null}
              {canAccept && o.status === "pending" ? (
                <div className="mt-auto pt-4">
                  <Button className="w-full" onClick={() => setPicked(o)}>
                    {t("request.offer_accept", { name: name.split(/\s+/)[0] })}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!picked}
        onOpenChange={(o) => !o && setPicked(null)}
        title={picked ? t("request.offer_accept", { name: offerName(picked, f.locale) }) : ""}
        description={picked ? t("request.offer_accept_confirm", { name: offerName(picked, f.locale) }) : ""}
        confirmLabel={tAll("common.confirm")}
        loading={accept.isPending}
        onConfirm={() => {
          if (!picked) return;
          accept.mutate(
            { requestId: r.id, offerId: picked.id },
            {
              onSuccess: (b) => {
                toast.success(t("request.offer_accepted"));
                setPicked(null);
                if (b?.id) router.push(`/ghar/bookings/${b.id}`);
              },
              onError: (e) => toast.error(errorMessage(e, tAll)),
            },
          );
        }}
      >
        {config ? (
          <FeeLine
            fee={config.booking_fee}
            status={config.booking_fee_enabled ? "enabled" : "disabled"}
            className="border-yellow bg-yellow-subtle rounded-dense border-l-4 px-4 py-3"
          />
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export function RequestDetail({ id }: { id: string }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const when = useWhenText();
  const q = useKaamRequest(id);
  const cancel = useCancelRequest();
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  if (q.isLoading) return <Skeleton className="h-64 rounded-card" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const offersN = r.offers?.length ?? r.offers_count ?? 0;
  return (
    <div className="space-y-6">
      <Link href="/ghar/requests" className="text-fg-muted hover:text-fg inline-flex min-h-10 items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden />
        {t("ghar.requests_title")}
      </Link>
      <header className="space-y-1">
        <p className="text-fg-muted text-sm tabular">
          {r.code}
          {r.trade ? ` · ${f.name(r.trade)}` : ""}
        </p>
        <h1 className="text-fg text-2xl font-extrabold">{r.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <RequestBadge status={r.status} />
          {r.status === "open" || r.status === "offers_received" ? (
            <span className="text-fg-muted text-sm" suppressHydrationWarning>
              {t("request.expires", { when: when(r.expires_at) })}
            </span>
          ) : null}
        </div>
        <p className="text-fg-body pt-2 whitespace-pre-line">{r.description}</p>
        {r.photos?.length ? (
          <ul className="flex flex-wrap gap-2 pt-2">
            {r.photos.map((p, i) => {
              const src = mediaSrc(typeof p === "string" ? p : p.thumb_url || p.url);
              return src ? (
                <li key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${r.title} ${f.digits(i + 1)}`} className="size-24 rounded-dense object-cover" />
                </li>
              ) : null;
            })}
          </ul>
        ) : null}
        {r.budget_max ? (
          <p className="text-fg-muted text-sm">
            {t("request.budget")}: <span className="text-fg font-semibold">{f.money(r.budget_max)}</span>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="offers-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="offers-title" className="text-fg text-xl font-extrabold">
            {t("request.compare")}
          </h2>
          <span className="text-fg-muted text-sm">{t("request.offers_count", { count: offersN })}</span>
        </div>
        <OffersCompare r={r} />
        <p className="text-fg-muted text-xs">{t("request.max3")}</p>
      </section>

      {r.booking_id ? (
        <Link href={`/ghar/bookings/${r.booking_id}`} className="text-brand-text inline-flex min-h-11 items-center gap-1 font-semibold hover:underline">
          {t("book.view_booking")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      {r.status === "open" || r.status === "offers_received" ? (
        <Button variant="danger-outline" onClick={() => setConfirmCancel(true)}>
          {t("request.cancel")}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("request.cancel")}
        description={t("request.cancel_confirm")}
        confirmLabel={t("request.cancel")}
        danger
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(r.id, {
            onSuccess: () => {
              toast.success(t("request.cancelled"));
              setConfirmCancel(false);
              q.refetch();
            },
            onError: (e) => toast.error(errorMessage(e, tAll)),
          })
        }
      />
    </div>
  );
}
