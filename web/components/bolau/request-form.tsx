"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImagePlus, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { TradeSelect } from "@/components/shared/selects";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { errorMessage } from "@/components/ui/feedback";
import { Input, PrefixInput, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { newIdempotencyKey, useAddresses, useCreateKaamRequest } from "@/lib/api/hooks/bolau";
import { isApiError } from "@/lib/api/errors";
import { addDays, adToBs, formatBs, todayIso } from "@/lib/format";
import { NPT_OFFSET } from "@/lib/bolau/slots";
import { useFormat } from "@/lib/use-format";
import { AddressForm, addressText } from "./address-form";
import { InlineLogin } from "./inline-login";
import { TIME_BANDS } from "@/lib/bolau/search";

const MAX_PHOTOS = 4;
const BAND_END: Record<string, string> = { "08:00": "11:00", "12:00": "15:00", "16:00": "19:00" };

/** Preferred window → ISO start/end in Nepal time. "" band = the whole working day. */
export function requestWindow(date: string, band: string): { start: string; end: string } {
  const from = band || "07:00";
  const to = band ? BAND_END[band] ?? "19:00" : "19:00";
  return { start: `${date}T${from}:00${NPT_OFFSET}`, end: `${date}T${to}:00${NPT_OFFSET}` };
}

/** Post a Kaam request (up to 4 photos) → the Ghardhani lands on the offers view. */
export function KaamRequestForm({ initialTrade }: { initialTrade?: string }) {
  const t = useTranslations("bolau");
  return (
    <InlineLogin title={t("request.login_title")} body={t("request.login_body")}>
      {() => <RequestFields initialTrade={initialTrade} />}
    </InlineLogin>
  );
}

function RequestFields({ initialTrade }: { initialTrade?: string }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const addresses = useAddresses();
  const create = useCreateKaamRequest();
  const [trade, setTrade] = React.useState(initialTrade ?? "");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const today = todayIso();
  const [date, setDate] = React.useState(today);
  const [band, setBand] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [addressId, setAddressId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [idemKey] = React.useState(() => newIdempotencyKey("kr"));

  React.useEffect(() => {
    if (!addressId && addresses.data?.length) setAddressId((addresses.data.find((a) => a.is_default) ?? addresses.data[0]).id);
  }, [addresses.data, addressId]);

  React.useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const req: Record<string, string> = {};
    if (!trade) req.trade = t("address.required");
    if (!title.trim()) req.title = t("address.required");
    if (!description.trim()) req.description = t("address.required");
    if (!addressId) req.address = t("address.required");
    setErrors(req);
    setFormError(null);
    if (Object.keys(req).length || !addressId) return;
    const w = requestWindow(date, band);
    create.mutate(
      {
        trade,
        title: title.trim(),
        description: description.trim(),
        address_id: addressId,
        preferred_window_start: w.start,
        preferred_window_end: w.end,
        budget_max: budget || undefined,
        photos,
        idempotencyKey: idemKey,
      },
      {
        onSuccess: (r) => {
          toast.success(t("request.posted"));
          router.push(`/ghar/requests/${r.id}`);
        },
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fields).length) {
            setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, m]) => [k, m[0]])));
          }
          setFormError(errorMessage(err, tAll));
        },
      },
    );
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div className="space-y-8">
      <form onSubmit={submit} noValidate className="space-y-5" id="kaam-request">
        <Field id="req-trade" label={t("request.trade")} error={errors.trade}>
          <TradeSelect value={trade} onChange={setTrade} />
        </Field>
        <Field id="req-title" label={t("request.title_label")} error={errors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("request.title_placeholder")} maxLength={120} />
        </Field>
        <Field id="req-description" label={t("request.description")} error={errors.description}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("request.description_placeholder")}
            rows={4}
            maxLength={2000}
          />
        </Field>

        <fieldset>
          <legend className="text-fg text-sm font-medium">{t("request.photos")}</legend>
          <p id="req-photos-hint" className="text-fg-muted mt-0.5 text-xs">
            {t("request.photos_hint")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <li key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-20 rounded-dense object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="bg-fg text-fg-inverse absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full"
                  aria-label={t("request.photo_remove", { n: f.digits(i + 1) })}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <li>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="border-border-strong text-fg-body hover:bg-surface-hover flex size-20 flex-col items-center justify-center gap-1 rounded-dense border-2 border-dashed text-xs font-medium"
                  aria-describedby="req-photos-hint"
                >
                  <ImagePlus className="size-5" aria-hidden />
                  {t("request.photos_add")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setPhotos((p) => [...p, ...files].slice(0, MAX_PHOTOS));
                    e.target.value = "";
                  }}
                />
              </li>
            ) : null}
          </ul>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="req-date" label={t("request.window_date")}>
            <NativeSelect
              value={date}
              onChange={(e) => setDate(e.target.value)}
              options={days.map((d, i) => ({
                value: d,
                label:
                  i === 0
                    ? f.locale === "ne" ? "आज" : "Today"
                    : i === 1
                      ? f.locale === "ne" ? "भोलि" : "Tomorrow"
                      : `${f.weekday(new Date(`${d}T00:00:00Z`).getUTCDay(), true)}, ${formatBs(adToBs(d), f.locale)}`,
              }))}
            />
          </Field>
          <Field id="req-band" label={t("request.window_time")}>
            <NativeSelect
              value={band}
              onChange={(e) => setBand(e.target.value)}
              placeholder={t("search.time_any")}
              options={TIME_BANDS.map((b) => ({ value: b.value, label: t(`search.${b.key}`) }))}
            />
          </Field>
        </div>
        <Field
          id="req-budget"
          label={t("request.budget")}
          hint={t("request.budget_hint")}
          error={errors.budget_max}
          className="max-w-xs"
        >
          <PrefixInput
            prefix={f.locale === "ne" ? "रु." : "Rs."}
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </form>

      <section aria-labelledby="req-where" className="space-y-3">
        <h3 id="req-where" className="text-fg text-base font-bold">
          {t("request.where")}
        </h3>
        <p className="text-fg-body bg-surface-muted flex items-start gap-2 rounded-dense px-3 py-2.5 text-sm">
          <Lock className="text-fg-muted mt-0.5 size-4 shrink-0" aria-hidden />
          {t("request.where_private")}
        </p>
        {addresses.data?.length && !adding ? (
          <>
            <NativeSelect
              aria-label={t("request.where")}
              value={addressId ?? ""}
              onChange={(e) => setAddressId(e.target.value)}
              options={addresses.data.map((a) => ({
                value: a.id,
                label: `${t(`address.label_${a.label}`)} — ${addressText(a, f.locale, t("address.ward"))}`,
              }))}
            />
            <Button variant="link" onClick={() => setAdding(true)}>
              {t("book.address_new")}
            </Button>
          </>
        ) : addresses.isLoading ? null : (
          <AddressForm
            idPrefix="req-addr"
            onSaved={(a) => {
              setAddressId(a.id);
              setAdding(false);
            }}
            onCancel={addresses.data?.length ? () => setAdding(false) : undefined}
          />
        )}
        {errors.address ? <p className="text-danger text-xs font-medium">{errors.address}</p> : null}
      </section>

      <FormError message={formError} />
      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-5">
        <Button type="submit" form="kaam-request" size="lg" loading={create.isPending}>
          {t("request.submit")}
        </Button>
        <p className="text-fg-muted text-sm">{t("request.max3")}</p>
      </div>
    </div>
  );
}
