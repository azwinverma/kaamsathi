"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, KeyRound, Lock, Phone, ShieldAlert, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ErrorState, Skeleton, errorMessage } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { BOLAU_DEFAULTS, useBolauConfig, useBooking, useBookingAction, useBookingContact } from "@/lib/api/hooks/bolau";
import { PAY_METHODS, RATING_TAGS, type Booking, type PayMethod } from "@/lib/api/types-bolau";
import { SAFETY_KINDS, type SafetyKind } from "@/lib/api/types-support";
import { freeCancelUntil, insideFreeWindow } from "@/lib/bolau/price";
import {
  canCancel,
  canConfirm,
  canMarkPaid,
  canReportNoShow,
  contactWindow,
  showArrivalCode,
} from "@/lib/bolau/timeline";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { addressText } from "./address-form";
import { BookingStatusBadge, FeeLine, PriceText, SipaluPortrait, useWhenText } from "./bits";
import { bookingTitle } from "./ghar-bookings";
import { StatusTimeline } from "./status-timeline";

const BOX = "border-border bg-surface rounded-card border p-5";

/** Big, readable arrival code: four separate digits, read out at the door. */
export function ArrivalCode({ code, name }: { code: string; name: string }) {
  const t = useTranslations("bolau.ghar");
  const f = useFormat();
  return (
    <section aria-labelledby="arrival-title" className="border-fg bg-yellow text-on-accent rounded-card border-2 p-5">
      <h2 id="arrival-title" className="flex items-center gap-2 text-base font-extrabold">
        <KeyRound className="size-5" aria-hidden />
        {t("arrival_title")}
      </h2>
      <p className="mt-3 flex gap-2 sm:gap-3">
        <span className="sr-only">{t("arrival_label", { code: code.split("").join(" ") })}</span>
        {code.split("").map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="bg-surface text-fg flex h-16 w-14 items-center justify-center rounded-[10px] font-mono text-4xl font-extrabold sm:h-20 sm:w-16 sm:text-5xl"
          >
            {f.digits(d)}
          </span>
        ))}
      </p>
      <p className="mt-3 text-sm font-medium">{t("arrival_body", { name })}</p>
    </section>
  );
}

function ContactBox({ b, name }: { b: Booking; name: string }) {
  const t = useTranslations("bolau.ghar");
  const tAll = useTranslations();
  const f = useFormat();
  const [show, setShow] = React.useState(false);
  const open = b.contact_visible ?? contactWindow(b.status);
  const contact = useBookingContact(b.id, open && show);
  return (
    <section aria-labelledby="contact-title" className={BOX}>
      <h2 id="contact-title" className="text-fg text-base font-bold">
        {t("contact_title")}
      </h2>
      {!open ? (
        <p className="text-fg-body mt-2 flex items-start gap-2 text-sm">
          <Lock className="text-fg-muted mt-0.5 size-4 shrink-0" aria-hidden />
          {t("contact_hidden", { name })}
        </p>
      ) : contact.data && !contact.data.visible ? (
        <p className="text-fg-muted mt-2 text-sm">{t("contact_closed")}</p>
      ) : contact.data?.phone ? (
        <a
          href={`tel:${contact.data.phone.replace(/[^\d+]/g, "")}`}
          className="bg-brand text-brand-fg hover:bg-brand-hover mt-3 inline-flex min-h-12 items-center gap-2 rounded-control px-4 font-semibold"
        >
          <Phone className="size-4" aria-hidden />
          {t("contact_call", { phone: f.phone(contact.data.phone) })}
        </a>
      ) : contact.isError ? (
        <p className="text-fg-muted mt-2 text-sm">{errorMessage(contact.error, tAll) || t("contact_closed")}</p>
      ) : (
        <Button variant="secondary" className="mt-3" loading={contact.isFetching} onClick={() => setShow(true)}>
          <Phone aria-hidden />
          {t("contact_show", { name })}
        </Button>
      )}
    </section>
  );
}

function SafetyBox({ b, name }: { b: Booking; name: string }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const create = useBookingAction(b.id);
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<SafetyKind>("unsafe_workplace");
  const [details, setDetails] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <section aria-labelledby="safety-title" className="border-coral rounded-card border-2 border-dashed p-5">
      <h2 id="safety-title" className="text-fg flex items-center gap-2 text-base font-bold">
        <ShieldAlert className="text-coral-text size-5" aria-hidden />
        {t("ghar.report_title")}
      </h2>
      <p className="text-fg-body mt-1 text-sm">{t("ghar.report_body", { name })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="danger-outline" onClick={() => setOpen(true)}>
          {t("ghar.report_open")}
        </Button>
        <a
          href="tel:100"
          className="border-fg text-fg hover:bg-surface-hover inline-flex min-h-10 items-center gap-2 rounded-control border-2 px-3 text-sm font-bold max-sm:min-h-11"
        >
          <Phone className="size-4" aria-hidden />
          {t("safety.call_police")}
        </a>
      </div>
      <p className="text-fg-muted mt-2 text-xs">{t("safety.emergency")}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tAll("common.close")}>
          <DialogHeader title={t("ghar.report_title")} description={t("ghar.report_body", { name })} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (details.trim().length < 5) {
                setError(t("address.required"));
                return;
              }
              create.mutate(
                { action: "safety-report", report: { safety_kind: kind, description: details.trim() } },
                {
                  onSuccess: () => {
                    toast.success(t("ghar.report_sent"));
                    setOpen(false);
                    setDetails("");
                  },
                  onError: (err) => setError(errorMessage(err, tAll)),
                },
              );
            }}
          >
            <DialogBody className="space-y-4">
              <fieldset>
                <legend className="text-fg text-sm font-medium">{t("ghar.report_kind")}</legend>
                <div className="mt-2 space-y-1">
                  {SAFETY_KINDS.map((k) => (
                    <label key={k} className="flex min-h-10 items-center gap-2.5 text-sm">
                      <input
                        type="radio"
                        name="safety-kind"
                        checked={kind === k}
                        onChange={() => setKind(k)}
                        className="accent-brand size-4"
                      />
                      {t(`ghar.report_kind_${k}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field id="safety-details" label={t("ghar.report_details")}>
                <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={2000} />
              </Field>
              <p className="text-fg-muted text-xs">{t("safety.emergency")}</p>
              <FormError message={error} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tAll("common.cancel")}
              </Button>
              <Button type="submit" variant="danger" loading={create.isPending}>
                {t("ghar.report_send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RateBox({ b, name }: { b: Booking; name: string }) {
  const t = useTranslations("bolau.ghar");
  const tAll = useTranslations();
  const f = useFormat();
  const act = useBookingAction(b.id);
  const [score, setScore] = React.useState(0);
  const [tags, setTags] = React.useState<string[]>([]);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  if (b.my_rating) {
    return (
      <section className={BOX}>
        <p className="text-fg font-semibold">{t("your_rating", { score: f.digits(b.my_rating.score) })}</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="rate-title" className={BOX}>
      <h2 id="rate-title" className="text-fg text-base font-bold">
        {t("rate_title", { name })}
      </h2>
      <p className="text-fg-body mt-1 text-sm">{t("rate_body", { name })}</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!score) {
            setError(t("rate_score"));
            return;
          }
          act.mutate(
            { action: "rate", rating: { score, tags, comment: comment.trim() || undefined } },
            { onSuccess: () => toast.success(t("rated")), onError: (err) => setError(errorMessage(err, tAll)) },
          );
        }}
      >
        <fieldset>
          <legend className="text-fg text-sm font-medium">{t("rate_score")}</legend>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="relative cursor-pointer rounded-md p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                <input type="radio" name="score" value={n} checked={score === n} onChange={() => setScore(n)} className="sr-only" />
                <Star
                  aria-hidden
                  strokeWidth={1.5}
                  className={cn("size-9", n <= score ? "fill-yellow stroke-on-accent" : "stroke-fg-muted fill-none")}
                />
                <span className="sr-only">{t("rate_star", { n })}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-fg text-sm font-medium">{t("rate_tags")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {RATING_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <label
                  key={tag}
                  className={cn(
                    "relative inline-flex min-h-10 cursor-pointer items-center rounded-pill border px-3 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    on ? "border-teal bg-teal-subtle text-fg" : "border-border-strong text-fg-body",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => setTags((x) => (on ? x.filter((y) => y !== tag) : [...x, tag]))}
                  />
                  {t(`tag.${tag}`)}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field id="rate-comment" label={t("rate_comment")}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("rate_comment_placeholder")} rows={3} maxLength={600} />
        </Field>
        <FormError message={error} />
        <Button type="submit" loading={act.isPending}>
          {t("rate_submit")}
        </Button>
      </form>
    </section>
  );
}

function PayBox({ b, name }: { b: Booking; name: string }) {
  const t = useTranslations("bolau.ghar");
  const tAll = useTranslations();
  const f = useFormat();
  const act = useBookingAction(b.id);
  const [method, setMethod] = React.useState<PayMethod>("cash");
  const pay = b.payment_to_sipalu;
  const paidAt = pay?.ghardhani_marked_at ?? b.paid_to_sipalu_at ?? null;
  if (paidAt) {
    return (
      <p className="text-success text-sm font-semibold">
        {t("paid_on", {
          method: t(`pay_method_${pay?.ghardhani_method ?? pay?.method ?? b.payment_method_to_sipalu ?? "cash"}`),
          when: f.dateTime(paidAt),
        })}
      </p>
    );
  }
  if (!canMarkPaid(b.status, paidAt)) return <p className="text-fg-body text-sm">{t("pay_body", { name })}</p>;
  return (
    <div className="space-y-3">
      <p className="text-fg-body text-sm">{t("pay_body", { name })}</p>
      <fieldset>
        <legend className="text-fg text-sm font-medium">{t("pay_method")}</legend>
        <div className="mt-1 flex flex-wrap gap-x-4">
          {PAY_METHODS.map((m) => (
            <label key={m} className="inline-flex min-h-10 items-center gap-2 text-sm">
              <input type="radio" name="pay-method" checked={method === m} onChange={() => setMethod(m)} className="accent-brand size-4" />
              {t(`pay_method_${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        variant="secondary"
        loading={act.isPending}
        onClick={() =>
          act.mutate(
            { action: "paid", method },
            { onSuccess: () => toast.success(t("paid_done")), onError: (e) => toast.error(errorMessage(e, tAll)) },
          )
        }
      >
        {t("mark_paid")}
      </Button>
    </div>
  );
}

/** Ghardhani booking detail: timeline, arrival code, contact, price + direct payment, actions, safety. */
export function BookingDetail({ id }: { id: string }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const when = useWhenText();
  const q = useBooking(id);
  const config = useBolauConfig().data ?? BOLAU_DEFAULTS;
  const act = useBookingAction(id);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [noShowOpen, setNoShowOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const b = q.data;
  const name = f.locale === "ne" && b.sipalu.name_ne ? b.sipalu.name_ne : b.sipalu.name;
  const firstName = name.split(/\s+/)[0] ?? name;
  const freeUntil = b.free_cancel_until ? new Date(b.free_cancel_until) : freeCancelUntil(b.scheduled_start, config.free_cancel_hours);
  // Free while still "requested"; once accepted, free until the window closes (2 h before start).
  const free =
    b.status === "requested" ||
    (now ? (b.free_cancel_until ? now <= freeUntil : insideFreeWindow(b.scheduled_start, now, config.free_cancel_hours)) : true);
  const quoteWaiting = b.price_type === "visit_then_quote" && b.quote_status === "proposed" && b.quote_amount;
  const toastErr = (e: unknown) => toast.error(errorMessage(e, tAll));

  return (
    <div className="space-y-6">
      <Link href="/ghar" className="text-fg-muted hover:text-fg inline-flex min-h-10 items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden />
        {t("ghar.back")}
      </Link>

      <header className="flex items-start gap-4">
        <SipaluPortrait name={name} photoUrl={b.sipalu.photo_url} size="sm" rotate={-3} tape="yellow" />
        <div className="min-w-0 space-y-1">
          <p className="text-fg-muted text-sm tabular">{t("ghar.booking_code", { code: b.code })}</p>
          <h1 className="text-fg text-2xl leading-tight font-extrabold">{bookingTitle(b, f.locale)}</h1>
          <p className="text-fg-body">
            {b.sipalu.handle ? (
              <Link href={`/sipalu/${b.sipalu.handle}`} className="font-semibold hover:underline">
                {t("ghar.with", { name })}
              </Link>
            ) : (
              t("ghar.with", { name })
            )}
            {" · "}
            <span suppressHydrationWarning>{when(b.scheduled_start)}</span>
          </p>
          <BookingStatusBadge status={b.status} />
        </div>
      </header>

      {showArrivalCode(b.status, b.arrival_code) ? <ArrivalCode code={b.arrival_code as string} name={firstName} /> : null}
      {b.arrival_verified_at ? (
        <p className="text-success text-sm font-semibold">{t("ghar.arrival_verified", { time: f.time(b.arrival_verified_at) })}</p>
      ) : null}

      {quoteWaiting ? (
        <section className="border-brand bg-brand-subtle rounded-card border-2 p-5">
          <p className="text-fg font-semibold">
            {t("ghar.quote_waiting", { name: firstName, price: f.money(b.quote_amount) })}
          </p>
          <Button
            className="mt-3"
            loading={act.isPending}
            onClick={() =>
              act.mutate({ action: "approve-quote" }, { onSuccess: () => toast.success(t("ghar.quote_approved")), onError: toastErr })
            }
          >
            {t("ghar.approve_quote", { price: f.money(b.quote_amount) })}
          </Button>
        </section>
      ) : null}

      {canConfirm(b.status) ? (
        <section className="border-teal bg-teal-subtle rounded-card border-2 p-5">
          <h2 className="text-fg text-base font-bold">{t("ghar.confirm_title")}</h2>
          <p className="text-fg-body mt-1 text-sm">{t("ghar.confirm_body", { name: firstName })}</p>
          <Button
            className="mt-3"
            loading={act.isPending}
            onClick={() => act.mutate({ action: "confirm" }, { onSuccess: () => toast.success(t("ghar.confirmed")), onError: toastErr })}
          >
            {t("ghar.confirm")}
          </Button>
        </section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="progress-title" className={BOX}>
          <h2 id="progress-title" className="text-fg mb-4 text-base font-bold">
            {t("timeline.label")}
          </h2>
          <StatusTimeline status={b.status} events={b.events} />
        </section>

        <div className="space-y-6">
          <section aria-labelledby="price-title" className={BOX}>
            <h2 id="price-title" className="text-fg text-base font-bold">
              {t("ghar.price_title")}
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">{t("ghar.quoted")}</dt>
                <dd className="text-fg font-semibold">
                  <PriceText p={{ price_type: b.price_type, price: b.quoted_price, visit_fee: b.visit_fee }} />
                </dd>
              </div>
              {b.final_price ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-muted">{t("ghar.final")}</dt>
                  <dd className="text-fg font-extrabold tabular">{f.money(b.final_price)}</dd>
                </div>
              ) : null}
            </dl>
            <FeeLine fee={b.booking_fee} status={b.booking_fee_status} className="border-border mt-4 border-t pt-3" />
            <div className="border-border mt-4 border-t pt-3">
              <h3 className="text-fg text-sm font-bold">{t("ghar.pay_title", { name: firstName })}</h3>
              <div className="mt-2">
                <PayBox b={b} name={firstName} />
              </div>
            </div>
          </section>
          <ContactBox b={b} name={firstName} />
        </div>
      </div>

      {b.description || b.address ? (
        <section className={BOX}>
          <dl className="space-y-3 text-sm">
            {b.description ? (
              <div>
                <dt className="text-fg-muted">{t("ghar.description")}</dt>
                <dd className="text-fg mt-0.5 whitespace-pre-line">{b.description}</dd>
              </div>
            ) : null}
            {b.address ? (
              <div>
                <dt className="text-fg-muted">{t("book.review_where")}</dt>
                <dd className="text-fg mt-0.5">{addressText(b.address, f.locale, t("address.ward"))}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {b.status === "confirmed" && b.can_rate !== false ? <RateBox b={b} name={firstName} /> : null}

      {canCancel(b.status) || (now && canReportNoShow(b.status, b.scheduled_start, now)) ? (
        <div className="flex flex-wrap gap-3">
          {canCancel(b.status) ? (
            <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
              {t("ghar.cancel")}
            </Button>
          ) : null}
          {now && canReportNoShow(b.status, b.scheduled_start, now) ? (
            <Button variant="secondary" onClick={() => setNoShowOpen(true)}>
              {t("ghar.no_show", { name: firstName })}
            </Button>
          ) : null}
        </div>
      ) : null}

      <SafetyBox b={b} name={firstName} />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent size="sm" closeLabel={tAll("common.close")}>
          <DialogHeader
            title={t("ghar.cancel_title")}
            description={
              free
                ? t("ghar.cancel_free", { when: f.dateTime(freeUntil.toISOString()) })
                : t("ghar.cancel_late", { when: f.dateTime(freeUntil.toISOString()), name: firstName })
            }
          />
          <DialogBody>
            <Field id="cancel-reason" label={t("ghar.cancel_reason")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ghar.cancel_reason_placeholder")} rows={3} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              {tAll("common.back")}
            </Button>
            <Button
              variant="danger"
              loading={act.isPending}
              onClick={() =>
                act.mutate(
                  { action: "cancel", reason: reason.trim() || "—" },
                  {
                    onSuccess: () => {
                      toast.success(t("ghar.cancelled"));
                      setCancelOpen(false);
                    },
                    onError: toastErr,
                  },
                )
              }
            >
              {t("ghar.cancel_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noShowOpen} onOpenChange={setNoShowOpen}>
        <DialogContent size="sm" closeLabel={tAll("common.close")}>
          <DialogHeader title={t("ghar.no_show_title")} description={t("ghar.no_show_body", { name: firstName })} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoShowOpen(false)}>
              {tAll("common.back")}
            </Button>
            <Button
              variant="danger"
              loading={act.isPending}
              onClick={() =>
                act.mutate(
                  { action: "report-no-show", reason: "" },
                  {
                    onSuccess: () => {
                      toast.success(t("ghar.no_show_done"));
                      setNoShowOpen(false);
                    },
                    onError: toastErr,
                  },
                )
              }
            >
              {t("ghar.no_show", { name: firstName })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
