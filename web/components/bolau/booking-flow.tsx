"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { errorMessage } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { BOLAU_DEFAULTS, newIdempotencyKey, useAddresses, useBolauConfig, useCreateBooking } from "@/lib/api/hooks/bolau";
import { isApiError } from "@/lib/api/errors";
import type { Address, Booking, PublicSipalu, SipaluService } from "@/lib/api/types-bolau";
import { buildSlots, summaryRules, type SlotDay } from "@/lib/bolau/slots";
import { adToBs, formatBs } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn, pickName } from "@/lib/utils";
import { AddressForm, addressText } from "./address-form";
import { EstimateText, FeeLine, PriceText, useWhenText } from "./bits";
import { InlineLogin } from "./inline-login";

type StepKey = "service" | "time" | "address" | "review";
const STEPS: StepKey[] = ["service", "time", "address", "review"];
const OTHER = "other";
const ESTIMATES = [60, 90, 120, 180, 240];
const SLOT_CONFLICT = new Set(["slot_unavailable", "slot_taken", "conflict", "double_booking", "outside_availability"]);

/** Same-origin progress dots + labels; current step is announced. */
function Stepper({ current }: { current: number }) {
  const t = useTranslations("bolau.book");
  const f = useFormat();
  return (
    <nav aria-label={t("steps_label")}>
      <p className="text-fg-muted text-sm sm:hidden">
        {t("step", { n: f.digits(current + 1), total: f.digits(STEPS.length) })} · {t(`steps.${STEPS[current]}`)}
      </p>
      <ol className="hidden items-center gap-2 sm:flex">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                i < current
                  ? "bg-teal text-on-accent"
                  : i === current
                    ? "bg-fg text-yellow"
                    : "border-border-strong text-fg-muted border-2 border-dashed",
              )}
            >
              {i < current ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : f.digits(i + 1)}
            </span>
            <span className={cn("text-sm", i === current ? "text-fg font-semibold" : "text-fg-muted")}>
              {t(`steps.${s}`)}
            </span>
            {i < STEPS.length - 1 ? <span aria-hidden className="bg-border-strong h-0.5 w-6" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function dayChipLabel(day: SlotDay, i: number, locale: "en" | "ne", weekday: (n: number) => string) {
  if (i === 0) return locale === "ne" ? "आज" : "Today";
  if (i === 1) return locale === "ne" ? "भोलि" : "Tomorrow";
  return `${weekday(day.jsWeekday)} ${formatBs(adToBs(day.date), locale).split(" ").slice(0, 2).join(" ")}`;
}

/**
 * Book a specific Sipalu: service → day/time (from their weekly availability) → address (after an
 * inline OTP login; becomes a Ghardhani on first booking) → review price + booking fee → confirm
 * with an Idempotency-Key. The API re-checks every rule; a lost slot sends the user back to step 2.
 */
export function BookingFlow({ p, initialService }: { p: PublicSipalu; initialService?: string }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const when = useWhenText();
  const config = useBolauConfig().data ?? BOLAU_DEFAULTS;
  const create = useCreateBooking();
  const services = p.services.filter((s) => s.is_active !== false);
  const name = f.locale === "ne" && p.name_ne ? p.name_ne : p.name;
  const firstName = name.split(/\s+/)[0] ?? name;

  const [step, setStep] = React.useState(0);
  const [serviceId, setServiceId] = React.useState<string>(
    initialService && services.some((s) => s.id === initialService) ? initialService : (services[0]?.id ?? OTHER),
  );
  const service: SipaluService | null = services.find((s) => s.id === serviceId) ?? null;
  const tradeOf = (s: SipaluService | null) =>
    s?.trade ? (typeof s.trade === "string" ? s.trade : s.trade.code) : (p.trades[0]?.code ?? "");
  const [trade, setTrade] = React.useState(tradeOf(service));
  const [description, setDescription] = React.useState("");
  const [minutes, setMinutes] = React.useState<number>(service?.estimated_minutes ?? 60);
  const [day, setDay] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState<Address | null>(null);
  const addressId = address?.id ?? null;
  const [addingAddress, setAddingAddress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [descError, setDescError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Booking | null>(null);
  const [idemKey] = React.useState(() => newIdempotencyKey("bk"));
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, done]);

  React.useEffect(() => {
    setTrade(tradeOf(service));
    if (service?.estimated_minutes) setMinutes(service.estimated_minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);
  const days = React.useMemo(
    () =>
      now
        ? buildSlots({
            rules: summaryRules(p.availability_summary),
            timeOff: p.availability_summary?.time_off ?? [],
            busy: p.availability_summary?.busy ?? [],
            now,
            days: 14,
            durationMinutes: Math.min(minutes, 240),
            leadMinutes: config.lead_time_minutes,
          })
        : [],
    [p.availability_summary, now, minutes, config.lead_time_minutes],
  );
  const openDays = days.filter((d) => d.slots.length);
  const activeDay = openDays.find((d) => d.date === day) ?? openDays[0] ?? null;


  const priced = service ?? { price_type: "visit_then_quote" as const, price: null, visit_fee: null };

  const next = () => {
    setError(null);
    if (STEPS[step] === "service") {
      if (!service && description.trim().length < 5) {
        setDescError(t("address.required"));
        return;
      }
      setDescError(null);
    }
    if (STEPS[step] === "time" && !slot) return;
    if (STEPS[step] === "address" && !addressId) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const confirm = () => {
    if (!slot || !addressId) return;
    setError(null);
    create.mutate(
      {
        idempotencyKey: idemKey,
        sipalu_handle: p.handle,
        service_id: service?.id ?? null,
        trade,
        description: description.trim() || (service ? (f.locale === "ne" && service.title_ne ? service.title_ne : service.title) : ""),
        address_id: addressId,
        scheduled_start: slot,
        estimated_minutes: minutes,
      },
      {
        onSuccess: (b) => setDone(b),
        onError: (err) => {
          if (isApiError(err) && (SLOT_CONFLICT.has(err.code) || err.status === 409 || err.fields.scheduled_start)) {
            setSlot(null);
            setStep(1);
            setError(t("book.error_slot"));
          } else {
            setError(errorMessage(err, tAll) || t("book.error_generic"));
          }
        },
      },
    );
  };

  if (done) {
    const accepted = done.status === "accepted";
    return (
      <section aria-labelledby="book-done" className="border-teal bg-surface rounded-card border-2 p-6 sm:p-8">
        <CheckCircle2 className="text-teal-text size-10" aria-hidden />
        <h2 id="book-done" ref={headingRef} tabIndex={-1} className="text-fg mt-3 text-2xl font-extrabold focus:outline-none">
          {t("book.done_title")}
        </h2>
        <p className="text-fg-body mt-2">
          {accepted ? t("book.done_accepted", { name: firstName }) : t("book.done_requested", { name: firstName })}
        </p>
        <p className="text-fg-muted mt-1 text-sm">{t("ghar.booking_code", { code: done.code })}</p>
        <Link
          href={`/ghar/bookings/${done.id}`}
          className="bg-brand text-brand-fg hover:bg-brand-hover mt-5 inline-flex min-h-12 items-center gap-2 rounded-control px-5 font-semibold"
        >
          {t("book.view_booking")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    );
  }

  const stepKey = STEPS[step];
  const heading =
    stepKey === "service"
      ? t("book.service_title", { name: firstName })
      : stepKey === "time"
        ? t("book.time_title", { name: firstName })
        : stepKey === "address"
          ? t("book.address_title")
          : t("book.review_title");

  const nav = (canNext: boolean, label?: string, noBack = false) => (
    <div className="border-border mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
      {step > 0 && !noBack ? (
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft aria-hidden />
          {tAll("common.back")}
        </Button>
      ) : null}
      <Button size="lg" className="ml-auto" disabled={!canNext} onClick={next}>
        {label ?? tAll("common.continue")}
        <ArrowRight aria-hidden />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Stepper current={step} />
      <section aria-labelledby="book-step" className="border-border bg-surface rounded-card border p-5 sm:p-7">
        <h2 id="book-step" ref={headingRef} tabIndex={-1} className="text-fg text-xl font-extrabold focus:outline-none">
          {heading}
        </h2>
        {error && stepKey !== "review" ? <FormError message={error} className="mt-4" /> : null}

        {stepKey === "service" ? (
          <>
            <fieldset className="mt-4">
              <legend className="sr-only">{t("book.steps.service")}</legend>
              <ul className="divide-border divide-y">
                {[...services, null].map((s) => {
                  const id = s?.id ?? OTHER;
                  const title = s ? (f.locale === "ne" && s.title_ne ? s.title_ne : s.title) : t("book.service_other");
                  return (
                    <li key={id}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 py-3">
                        <input
                          type="radio"
                          name="service"
                          value={id}
                          checked={serviceId === id}
                          onChange={() => setServiceId(id)}
                          className="accent-brand size-5 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-fg block font-semibold">{title}</span>
                          {!s ? (
                            <span className="text-fg-muted block text-sm">{t("book.service_other_hint", { name: firstName })}</span>
                          ) : null}
                        </span>
                        {s ? <PriceText p={s} className="text-fg font-bold whitespace-nowrap" /> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            {!service && p.trades.length > 1 ? (
              <Field id="book-trade" label={t("book.trade")} className="mt-4">
                <NativeSelect
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  options={p.trades.map((tr) => ({ value: tr.code, label: pickName(tr, f.locale) }))}
                />
              </Field>
            ) : null}
            <Field
              id="book-description"
              label={t("book.description")}
              hint={t("book.description_hint")}
              error={descError ?? undefined}
              optional={!!service}
              optionalLabel={tAll("common.optional")}
              className="mt-4"
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("book.description_placeholder")}
                maxLength={2000}
                rows={4}
              />
            </Field>
            {service?.price_type === "hourly" ? (
              <Field id="book-minutes" label={t("book.estimate")} className="mt-4 max-w-xs">
                <NativeSelect
                  value={String(minutes)}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  options={ESTIMATES.map((m) => ({
                    value: String(m),
                    label: m < 90 ? t("price.minutes", { minutes: f.digits(m) }) : t("price.hours", { hours: f.digits(m / 60) }),
                  }))}
                />
              </Field>
            ) : null}
            {nav(true)}
          </>
        ) : null}

        {stepKey === "time" ? (
          <>
            {p.instant_booking ? (
              <p className="text-fg-body mt-2 text-sm">{t("book.instant_note", { name: firstName })}</p>
            ) : (
              <p className="text-fg-body mt-2 text-sm">{t("book.request_note", { name: firstName })}</p>
            )}
            {openDays.length === 0 ? (
              <div className="mt-4">
                <p className="text-fg">{t("book.time_none", { name: firstName })}</p>
                <Link href="/bolau/request" className="text-brand-text mt-2 inline-flex min-h-11 items-center font-semibold hover:underline">
                  {t("request_cta.cta")}
                </Link>
              </div>
            ) : (
              <>
                <fieldset className="mt-4 min-w-0">
                  <legend className="text-fg mb-2 text-sm font-semibold">{t("book.day_label")}</legend>
                  <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {openDays.map((d) => {
                      const idx = days.indexOf(d);
                      const checked = activeDay?.date === d.date;
                      return (
                        <label
                          key={d.date}
                          className={cn(
                            "relative inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-pill border-2 px-3.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                            checked ? "border-fg bg-fg text-fg-inverse" : "border-border-strong text-fg hover:bg-surface-hover",
                          )}
                        >
                          <input
                            type="radio"
                            name="day"
                            className="sr-only"
                            checked={checked}
                            onChange={() => {
                              setDay(d.date);
                              setSlot(null);
                            }}
                          />
                          {dayChipLabel(d, idx, f.locale, (n) => f.weekday(n))}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                {activeDay ? (
                  <fieldset className="mt-5 min-w-0">
                    <legend className="text-fg mb-2 text-sm font-semibold">{t("book.slot_label")}</legend>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {activeDay.slots.map((s) => {
                        const checked = slot === s.start;
                        return (
                          <label
                            key={s.start}
                            className={cn(
                              "relative flex min-h-12 cursor-pointer items-center justify-center rounded-control border-2 text-sm font-bold tabular has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                              checked ? "border-brand bg-brand text-brand-fg" : "border-border-strong text-fg hover:border-fg-subtle",
                            )}
                          >
                            <input
                              type="radio"
                              name="slot"
                              className="sr-only"
                              checked={checked}
                              onChange={() => setSlot(s.start)}
                            />
                            {f.clock(s.time)}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ) : null}
                <p className="text-fg-muted mt-3 text-xs">{t("book.lead_note")}</p>
              </>
            )}
            {nav(!!slot)}
          </>
        ) : null}

        {stepKey === "address" ? (
          <div className="mt-3">
            <InlineLogin title={t("book.login_title")} body={t("book.login_body", { name: firstName })} headingLevel={3}>
              {() => (
                <>
                  <p className="text-fg-body bg-surface-muted flex items-start gap-2 rounded-dense px-3 py-2.5 text-sm">
                    <Lock className="text-fg-muted mt-0.5 size-4 shrink-0" aria-hidden />
                    {t("book.address_private", { name: firstName })}
                  </p>
                  <AddressStep
                    address={address}
                    onAddress={setAddress}
                    adding={addingAddress}
                    setAdding={setAddingAddress}
                    footer={nav(!!address, undefined, true)}
                  />
                </>
              )}
            </InlineLogin>
            {step > 0 ? (
              <Button variant="ghost" className="mt-4" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft aria-hidden />
                {tAll("common.back")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {stepKey === "review" ? (
          <>
            <dl className="divide-border mt-4 divide-y">
              {(
                [
                  ["review_with", name],
                  [
                    "review_service",
                    service
                      ? f.locale === "ne" && service.title_ne
                        ? service.title_ne
                        : service.title
                      : t("book.service_other"),
                  ],
                  ["review_when", slot ? when(slot) : "—"],
                  ["review_where", address ? addressText(address, f.locale, t("address.ward")) : "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
                  <dt className="text-fg-muted text-sm">{t(`book.${k}`)}</dt>
                  <dd className="text-fg font-medium" suppressHydrationWarning>
                    {v}
                  </dd>
                  <dd>
                    <button
                      type="button"
                      className="text-brand-text min-h-9 text-sm font-medium hover:underline"
                      onClick={() => setStep(k === "review_when" ? 1 : k === "review_where" ? 2 : 0)}
                    >
                      {t("book.edit")}
                      <span className="sr-only"> {t(`book.${k}`)}</span>
                    </button>
                  </dd>
                </div>
              ))}
              <div className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-fg-muted text-sm">{t("book.review_price")}</dt>
                <dd className="space-y-1">
                  <PriceText p={priced} className="text-fg text-lg font-extrabold" />
                  <div>
                    <EstimateText p={priced} minutes={minutes} />
                  </div>
                  {priced.price_type === "visit_then_quote" ? (
                    <p className="text-fg-body text-sm">{t("book.review_visit", { name: firstName })}</p>
                  ) : null}
                </dd>
              </div>
            </dl>
            <FeeLine
              fee={config.booking_fee}
              status={config.fee_enabled ? "enabled" : "disabled"}
              className="border-yellow bg-yellow-subtle mt-2 rounded-dense border-l-4 px-4 py-3"
            />
            <p className="text-fg-muted mt-4 text-xs">
              {t("book.terms", { hours: f.digits(config.free_cancel_hours) })}{" "}
              <Link href="/terms" className="underline underline-offset-2">
                {tAll("marketing.footer.terms")}
              </Link>
            </p>
            {error ? <FormError message={error} className="mt-4" /> : null}
            <div className="border-border mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft aria-hidden />
                {tAll("common.back")}
              </Button>
              <Button size="lg" className="ml-auto" loading={create.isPending} onClick={confirm}>
                {p.instant_booking ? t("book.confirm_instant") : t("book.confirm")}
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

/**
 * Saved-address picker (or a new address). Mounted only after the inline login, so its query
 * starts with a session (an anonymous fetch would 401 and stay detached after the login).
 */
function AddressStep({
  address,
  onAddress,
  adding,
  setAdding,
  footer,
}: {
  address: Address | null;
  onAddress: (a: Address) => void;
  adding: boolean;
  setAdding: (v: boolean) => void;
  footer: React.ReactNode;
}) {
  const t = useTranslations("bolau");
  const f = useFormat();
  const addresses = useAddresses();
  const list = React.useMemo(() => addresses.data ?? [], [addresses.data]);
  React.useEffect(() => {
    if (!address && list.length) onAddress(list.find((a) => a.is_default) ?? list[0]);
  }, [list, address, onAddress]);
  if (addresses.isLoading) return <div className="bg-surface-muted mt-4 h-24 animate-pulse rounded-dense" aria-busy />;
  return (
    <>
      {list.length && !adding ? (
        <fieldset className="mt-4 min-w-0">
          <legend className="text-fg mb-1 text-sm font-semibold">{t("book.address_saved")}</legend>
          <ul className="divide-border divide-y">
            {list.map((a) => (
              <li key={a.id}>
                <label className="flex min-h-14 cursor-pointer items-start gap-3 py-3">
                  <input
                    type="radio"
                    name="address"
                    checked={address?.id === a.id}
                    onChange={() => onAddress(a)}
                    className="accent-brand mt-1 size-5 shrink-0"
                  />
                  <span>
                    <span className="text-fg block font-semibold">{t(`address.label_${a.label}`)}</span>
                    <span className="text-fg-body block text-sm">{addressText(a, f.locale, t("address.ward"))}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
      {adding || !list.length ? (
        <div className="mt-4">
          <AddressForm
            idPrefix="book-addr"
            onSaved={(a) => {
              onAddress(a);
              setAdding(false);
            }}
            onCancel={list.length ? () => setAdding(false) : undefined}
          />
        </div>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t("book.address_new")}
        </Button>
      )}
      {!adding && list.length ? footer : null}
    </>
  );
}
