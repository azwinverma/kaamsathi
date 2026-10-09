"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DistrictSelect, TradeSelect } from "@/components/shared/selects";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { ErrorState, Skeleton, errorMessage } from "@/components/ui/feedback";
import { Input, PrefixInput, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useDistricts, useMinimumWage } from "@/lib/api/hooks/ref";
import { useOnboardingStep, useSetHandle, useSipaluMe } from "@/lib/api/hooks/bolau";
import { isApiError } from "@/lib/api/errors";
import type { PriceType, SipaluMe } from "@/lib/api/types-bolau";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { PriceText } from "./bits";
import { InlineLogin } from "./inline-login";
import { SEARCH_LANGS } from "@/lib/bolau/search";

export const JOIN_STEPS = [
  "name",
  "photo",
  "skills",
  "languages",
  "service_area",
  "availability",
  "services",
  "headline",
  "payment",
  "identity",
  "consent",
  "handle",
] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];
const NSTB = ["none", "elementary", "level1", "level2", "level3"] as const;
const HANDLE_RE = /^[a-z0-9-]{3,30}$/;

type Save = (data: Record<string, unknown>, files?: Record<string, File>) => void;
interface StepProps {
  me: SipaluMe;
  save: Save;
  saving: boolean;
  fieldErrors: Record<string, string>;
}

/** Sipalu web onboarding (mobile app is primary). Save-and-resume through /me/sipalu/onboarding-step. */
export function SipaluOnboarding() {
  const t = useTranslations("bolau.join");
  return (
    <InlineLogin title={t("login_title")} body={t("login_body")}>
      {() => <Wizard />}
    </InlineLogin>
  );
}

function Wizard() {
  const t = useTranslations("bolau.join");
  const tAll = useTranslations();
  const f = useFormat();
  const me = useSipaluMe();
  const step = useOnboardingStep();
  const setHandle = useSetHandle();
  const [active, setActive] = React.useState<JoinStep | "done" | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstFocus = React.useRef(true);

  const completed = new Set(me.data?.completed_steps ?? []);
  const current: JoinStep | "done" = active ?? ((me.data?.next_step as JoinStep | null) ?? "handle");

  React.useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [current]);

  if (me.isLoading) return <Skeleton className="h-72 rounded-card" />;
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;

  /** Walk the steps in order (the API's `next_step` skips ahead past finished ones on reload). */
  const goNext = (from: JoinStep) => {
    const i = JOIN_STEPS.indexOf(from);
    setActive(JOIN_STEPS[i + 1] ?? "done");
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && Object.keys(err.fields).length) {
      setFieldErrors(Object.fromEntries(Object.entries(err.fields).map(([k, m]) => [k.split(".").pop() as string, m[0]])));
    }
    setFormError(errorMessage(err, tAll));
  };

  const save =
    (s: JoinStep): Save =>
    (data, files) => {
      setFieldErrors({});
      setFormError(null);
      if (s === "handle") {
        setHandle.mutate(String(data.handle), {
          onSuccess: () => {
            toast.success(t("saved"));
            goNext(s);
          },
          onError,
        });
        return;
      }
      step.mutate(
        { step: s, data, file: files },
        {
          onSuccess: () => {
            toast.success(t("saved"));
            goNext(s);
          },
          onError,
        },
      );
    };

  const percent = me.data.completeness?.percent ?? 0;
  const props = (s: JoinStep): StepProps => ({
    me: me.data as SipaluMe,
    save: save(s),
    saving: step.isPending || setHandle.isPending,
    fieldErrors,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label={t("steps_label")} className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3">
          <p className="text-fg text-sm font-semibold">{t("progress", { n: f.digits(percent) })}</p>
          <div className="bg-surface-muted mt-1.5 h-2 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-teal h-full rounded-full" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <ol className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
          {JOIN_STEPS.map((s) => {
            const done = s === "handle" ? !!me.data?.handle && completed.size > 0 && current === "done" : completed.has(s);
            const on = current === s;
            return (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(s)}
                  aria-current={on ? "step" : undefined}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-dense px-2.5 text-left text-sm whitespace-nowrap",
                    on ? "bg-fg text-fg-inverse font-semibold" : "text-fg-body hover:bg-surface-hover",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      done ? "bg-teal text-on-accent" : on ? "bg-yellow" : "border-border-strong border-2 border-dashed",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  {t(`step.${s}`)}
                  {done ? <span className="sr-only"> — {t("step_done")}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="join-step-title" className="border-border bg-surface rounded-card border p-5 sm:p-7">
        {current === "done" ? (
          <DonePanel me={me.data} headingRef={headingRef} />
        ) : (
          <>
            <h2 id="join-step-title" ref={headingRef} tabIndex={-1} className="text-fg text-xl font-extrabold focus:outline-none">
              {t(titleKey(current))}
            </h2>
            <div className="mt-5">
              {current === "name" ? <NameStep {...props("name")} /> : null}
              {current === "photo" ? <PhotoStep {...props("photo")} /> : null}
              {current === "skills" ? <SkillsStep {...props("skills")} /> : null}
              {current === "languages" ? <LanguagesStep {...props("languages")} /> : null}
              {current === "service_area" ? <AreaStep {...props("service_area")} /> : null}
              {current === "availability" ? <AvailabilityStep {...props("availability")} /> : null}
              {current === "services" ? <ServicesStep {...props("services")} onDone={() => goNext("services")} /> : null}
              {current === "headline" ? <HeadlineStep {...props("headline")} /> : null}
              {current === "payment" ? <PaymentStep {...props("payment")} /> : null}
              {current === "identity" ? <IdentityStep {...props("identity")} /> : null}
              {current === "consent" ? <ConsentStep {...props("consent")} /> : null}
              {current === "handle" ? <HandleStep {...props("handle")} /> : null}
            </div>
            <FormError message={formError} className="mt-4" />
            <button
              type="button"
              className="text-fg-muted hover:text-fg mt-4 min-h-10 text-sm underline-offset-4 hover:underline"
              onClick={() => goNext(current)}
            >
              {t("skip")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function titleKey(s: JoinStep): string {
  return (
    {
      name: "basics_title",
      photo: "photo_title",
      skills: "skills_title",
      languages: "languages_title",
      service_area: "area_title",
      availability: "availability_title",
      services: "services_title",
      headline: "headline_step_title",
      payment: "payment_title",
      identity: "id_title",
      consent: "consent_title",
      handle: "handle_title",
    } as const
  )[s];
}

function SaveButton({ saving }: { saving: boolean }) {
  const t = useTranslations("bolau.join");
  return (
    <Button type="submit" size="lg" loading={saving}>
      {t("continue")}
    </Button>
  );
}

function NameStep({ me, save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const [name, setName] = React.useState(me.name ?? "");
  const [nameNe, setNameNe] = React.useState(me.name_ne ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save({ full_name: name.trim(), full_name_ne: nameNe.trim() });
      }}
    >
      <Field id="join-name" label={t("name")} error={fieldErrors.full_name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </Field>
      <Field id="join-name-ne" label={t("name_ne")} error={fieldErrors.full_name_ne}>
        <Input value={nameNe} onChange={(e) => setNameNe(e.target.value)} lang="ne" />
      </Field>
      <SaveButton saving={saving} />
    </form>
  );
}

function FilePick({
  id,
  label,
  file,
  onFile,
  accept = "image/jpeg,image/png,image/webp",
  error,
}: {
  id: string;
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  error?: string;
}) {
  const t = useTranslations("bolau.join");
  const [preview, setPreview] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-fg text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-20 rounded-dense object-cover" />
        ) : null}
        <input
          id={id}
          type="file"
          accept={accept}
          aria-invalid={error ? true : undefined}
          className="text-fg-body file:bg-surface-muted file:text-fg file:border-border-strong text-sm file:mr-3 file:min-h-10 file:rounded-control file:border file:px-3 file:font-semibold"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {file ? <p className="text-fg-muted text-xs">{t("change_photo")}</p> : null}
      {error ? <p className="text-danger text-xs font-medium">{error}</p> : null}
    </div>
  );
}

function PhotoStep({ save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const [file, setFile] = React.useState<File | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) save({}, { photo: file });
      }}
    >
      <p className="text-fg-body text-sm">{t("photo_hint")}</p>
      <FilePick id="join-photo" label={t("photo")} file={file} onFile={setFile} error={fieldErrors.photo} />
      <SaveButton saving={saving} />
    </form>
  );
}

function SkillsStep({ me, save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const tn = useTranslations("nstb");
  const [rows, setRows] = React.useState(
    me.trades?.length
      ? me.trades.map((x) => ({ trade: x.code, years: String(x.years ?? 0), nstb: x.nstb_level ?? "none" }))
      : [{ trade: "", years: "1", nstb: "none" }],
  );
  const set = (i: number, k: "trade" | "years" | "nstb", v: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const skills = rows
          .filter((r) => r.trade)
          .map((r) => ({ trade: r.trade, years_experience: Number(r.years) || 0, nstb_level: r.nstb }));
        if (skills.length) save({ skills, primary_trade: skills[0].trade });
      }}
    >
      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={i} className="border-border grid gap-3 border-b pb-4 sm:grid-cols-[minmax(0,1fr)_6rem_10rem_auto] sm:items-end">
            <Field id={`skill-trade-${i}`} label={i === 0 ? t("skill_primary") : t("skill_trade")} error={i === 0 ? fieldErrors.trade : undefined}>
              <TradeSelect value={r.trade} onChange={(v) => set(i, "trade", v)} />
            </Field>
            <Field id={`skill-years-${i}`} label={t("skill_years")}>
              <Input inputMode="numeric" value={r.years} onChange={(e) => set(i, "years", e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </Field>
            <Field id={`skill-nstb-${i}`} label={t("nstb")}>
              <NativeSelect
                value={r.nstb}
                onChange={(e) => set(i, "nstb", e.target.value)}
                options={NSTB.map((n) => ({ value: n, label: n === "none" ? t("nstb_none") : tn.has(n) ? tn(n) : n }))}
              />
            </Field>
            {rows.length > 1 ? (
              <Button type="button" variant="ghost" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                <X aria-hidden />
                {t("skill_remove")}
              </Button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      <Button type="button" variant="secondary" onClick={() => setRows((x) => [...x, { trade: "", years: "1", nstb: "none" }])}>
        <Plus aria-hidden />
        {t("skill_add")}
      </Button>
      <div>
        <SaveButton saving={saving} />
      </div>
    </form>
  );
}

function LanguagesStep({ me, save, saving }: StepProps) {
  const t = useTranslations("bolau");
  const [langs, setLangs] = React.useState<string[]>(me.languages?.map((l) => l.language) ?? ["ne"]);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (langs.length) save({ languages: langs.map((language) => ({ language, proficiency: "conversational" })) });
      }}
    >
      <fieldset>
        <legend className="sr-only">{t("join.languages_title")}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {SEARCH_LANGS.map((l) => (
            <label key={l} htmlFor={`lang-${l}`} className="flex min-h-11 items-center gap-2.5 text-sm">
              <Checkbox
                id={`lang-${l}`}
                checked={langs.includes(l)}
                onCheckedChange={(c) => setLangs((x) => (c === true ? [...x, l] : x.filter((y) => y !== l)))}
              />
              {t(`lang.${l}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <SaveButton saving={saving} />
    </form>
  );
}

function AreaStep({ me, save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const f = useFormat();
  const districts = useDistricts();
  const [home, setHome] = React.useState(me.service_districts?.[0]?.code ?? "");
  const [picked, setPicked] = React.useState<string[]>(me.service_districts?.map((d) => d.code) ?? []);
  const [adding, setAdding] = React.useState("");
  const [municipality, setMunicipality] = React.useState(me.service_municipality ?? "");
  const [radius, setRadius] = React.useState(me.service_radius_km ? String(me.service_radius_km) : "10");
  const nameOf = (code: string) => {
    const d = districts.data?.find((x) => x.code === code);
    return d ? f.name(d) : code;
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const service_districts = picked.length ? picked : home ? [home] : [];
        if (!service_districts.length) return;
        save({
          current_district: home || service_districts[0],
          service_districts,
          service_municipality: municipality.trim(),
          service_radius_km: Number(radius) || null,
        });
      }}
    >
      <Field id="join-home" label={t("home_district")}>
        <DistrictSelect value={home} onChange={(v) => {
          setHome(v);
          if (v && !picked.includes(v)) setPicked((p) => [...p, v]);
        }} />
      </Field>
      <Field id="join-municipality" label={t("municipality")}>
        <Input value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
      </Field>
      <div className="space-y-2">
        <Field id="join-add-district" label={t("service_districts")} error={fieldErrors.service_districts}>
          <DistrictSelect value={adding} onChange={(v) => {
            if (v && !picked.includes(v)) setPicked((p) => [...p, v]);
            setAdding("");
          }} />
        </Field>
        <ul className="flex flex-wrap gap-2">
          {picked.map((code) => (
            <li key={code} className="bg-teal-subtle text-fg inline-flex items-center gap-1 rounded-pill py-1 pr-1 pl-3 text-sm font-medium">
              {nameOf(code)}
              <button
                type="button"
                className="hover:bg-surface flex size-7 items-center justify-center rounded-full"
                aria-label={`${t("skill_remove")}: ${nameOf(code)}`}
                onClick={() => setPicked((p) => p.filter((x) => x !== code))}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Field id="join-radius" label={t("radius")} className="max-w-xs">
        <Input inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value.replace(/\D/g, "").slice(0, 3))} />
      </Field>
      <SaveButton saving={saving} />
    </form>
  );
}

function AvailabilityStep({ me, save, saving }: StepProps) {
  const t = useTranslations("bolau.join");
  const f = useFormat();
  const initial = React.useMemo(() => {
    const m = new Map<number, { on: boolean; from: string; to: string }>();
    for (let d = 0; d < 7; d++) m.set(d, { on: d !== 6, from: "08:00", to: "18:00" });
    if (me.availability?.length) {
      for (let d = 0; d < 7; d++) m.set(d, { on: false, from: "08:00", to: "18:00" });
      for (const r of me.availability) m.set(r.weekday, { on: true, from: r.start_time.slice(0, 5), to: r.end_time.slice(0, 5) });
    }
    return m;
  }, [me.availability]);
  const [days, setDays] = React.useState(initial);
  const upd = (d: number, patch: Partial<{ on: boolean; from: string; to: string }>) =>
    setDays((m) => new Map(m).set(d, { ...(m.get(d) as { on: boolean; from: string; to: string }), ...patch }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const rules = [...days.entries()]
          .filter(([, v]) => v.on && v.from < v.to)
          .map(([weekday, v]) => ({ weekday, start_time: v.from, end_time: v.to }));
        if (rules.length) save({ rules });
      }}
    >
      <p className="text-fg-body text-sm">{t("availability_hint")}</p>
      <ul className="divide-border divide-y">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const v = days.get(d) as { on: boolean; from: string; to: string };
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 py-2.5">
              <label htmlFor={`day-${d}`} className="flex min-h-10 w-36 items-center gap-2.5 text-sm font-semibold">
                <Checkbox id={`day-${d}`} checked={v.on} onCheckedChange={(c) => upd(d, { on: c === true })} />
                {f.weekday(d, true)}
              </label>
              {v.on ? (
                <span className="flex items-center gap-2 text-sm">
                  <label className="sr-only" htmlFor={`from-${d}`}>
                    {f.weekday(d, true)} {t("from")}
                  </label>
                  <Input id={`from-${d}`} type="time" value={v.from} onChange={(e) => upd(d, { from: e.target.value })} className="w-32" />
                  <span aria-hidden>–</span>
                  <label className="sr-only" htmlFor={`to-${d}`}>
                    {f.weekday(d, true)} {t("to")}
                  </label>
                  <Input id={`to-${d}`} type="time" value={v.to} onChange={(e) => upd(d, { to: e.target.value })} className="w-32" />
                </span>
              ) : (
                <span className="text-fg-muted text-sm">{t("day_off")}</span>
              )}
            </li>
          );
        })}
      </ul>
      <SaveButton saving={saving} />
    </form>
  );
}

function ServicesStep({ me, save, saving, fieldErrors, onDone }: StepProps & { onDone: () => void }) {
  const t = useTranslations("bolau.join");
  const f = useFormat();
  const mw = useMinimumWage();
  const minHourly = Math.max(Number(mw.data?.hourly ?? 0), Number(mw.data?.hourly_part_time ?? 0));
  const [trade, setTrade] = React.useState(me.trades?.[0]?.code ?? "");
  const [title, setTitle] = React.useState("");
  const [priceType, setPriceType] = React.useState<PriceType>("fixed");
  const [price, setPrice] = React.useState("");
  const [visit, setVisit] = React.useState("");
  const [minutes, setMinutes] = React.useState("60");
  const [err, setErr] = React.useState<string | null>(null);
  const services = me.services ?? [];
  return (
    <div className="space-y-5">
      <p className="text-fg-body text-sm">{t("services_hint", { min: f.money(minHourly || 107) })}</p>
      {services.length ? (
        <ul className="divide-border divide-y">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-fg font-medium">{f.locale === "ne" && s.title_ne ? s.title_ne : s.title}</span>
              <PriceText p={s} className="text-fg font-bold" />
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="border-border space-y-4 rounded-dense border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          if (!trade || !title.trim() || !price) return;
          if (priceType === "hourly" && minHourly && Number(price) < minHourly) {
            setErr(t("below_min", { min: f.money(minHourly) }));
            return;
          }
          save({
            services: [
              {
                trade,
                title: title.trim(),
                price_type: priceType,
                price,
                visit_fee: priceType === "visit_then_quote" ? visit || "0" : null,
                estimated_minutes: Number(minutes) || null,
              },
            ],
          });
          setTitle("");
          setPrice("");
          setVisit("");
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="svc-trade" label={t("skill_trade")} error={fieldErrors.trade}>
            <TradeSelect value={trade} onChange={setTrade} />
          </Field>
          <Field id="svc-title" label={t("service_title")} error={fieldErrors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("service_title_placeholder")} />
          </Field>
          <Field id="svc-type" label={t("price_type")}>
            <NativeSelect
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType)}
              options={[
                { value: "fixed", label: t("price_fixed") },
                { value: "hourly", label: t("price_hourly") },
                { value: "visit_then_quote", label: t("price_visit") },
              ]}
            />
          </Field>
          <Field id="svc-price" label={t("price")} error={err ?? fieldErrors.price}>
            <PrefixInput prefix={f.locale === "ne" ? "रु." : "Rs."} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          {priceType === "visit_then_quote" ? (
            <Field id="svc-visit" label={t("visit_fee")} error={fieldErrors.visit_fee}>
              <PrefixInput prefix={f.locale === "ne" ? "रु." : "Rs."} inputMode="numeric" value={visit} onChange={(e) => setVisit(e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
          ) : null}
          <Field id="svc-minutes" label={t("minutes")} error={fieldErrors.estimated_minutes}>
            <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={saving}>
          <Plus aria-hidden />
          {t("service_add")}
        </Button>
      </form>
      {services.length ? (
        <Button size="lg" onClick={onDone}>
          {t("continue")}
        </Button>
      ) : null}
    </div>
  );
}

function HeadlineStep({ me, save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const [headline, setHeadline] = React.useState(me.headline ?? "");
  const [headlineNe, setHeadlineNe] = React.useState(me.headline_ne ?? "");
  const [bio, setBio] = React.useState(me.bio ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save({ headline: headline.trim(), headline_ne: headlineNe.trim(), bio: bio.trim() });
      }}
    >
      <Field id="join-headline" label={t("headline")} error={fieldErrors.headline}>
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} placeholder={t("headline_placeholder")} />
      </Field>
      <Field id="join-headline-ne" label={t("headline_ne")}>
        <Input value={headlineNe} onChange={(e) => setHeadlineNe(e.target.value)} maxLength={80} lang="ne" />
      </Field>
      <Field id="join-bio" label={t("bio")}>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} rows={4} />
      </Field>
      <SaveButton saving={saving} />
    </form>
  );
}

function PaymentStep({ me, save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau");
  const [method, setMethod] = React.useState(me.payment?.method ?? "esewa");
  const [wallet, setWallet] = React.useState(me.payment?.wallet_id ?? "");
  const [bank, setBank] = React.useState(me.payment?.bank_name ?? "");
  const [account, setAccount] = React.useState("");
  const [holder, setHolder] = React.useState(me.payment?.bank_account_name ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(
          method === "bank"
            ? { payment_method: method, bank_name: bank, bank_account_no: account, bank_account_name: holder }
            : method === "cash"
              ? { payment_method: method }
              : { payment_method: method, wallet_id: wallet },
        );
      }}
    >
      <p className="text-fg-body text-sm">{t("join.payment_hint")}</p>
      <fieldset>
        <legend className="text-fg text-sm font-medium">{t("join.payment_method")}</legend>
        <div className="mt-1 flex flex-wrap gap-x-5">
          {(["esewa", "khalti", "bank", "cash"] as const).map((m) => (
            <label key={m} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="pay" checked={method === m} onChange={() => setMethod(m)} className="accent-brand size-4" />
              {t(`ghar.pay_method_${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {method === "esewa" || method === "khalti" ? (
        <Field id="join-wallet" label={t("join.payment_account")} error={fieldErrors.wallet_id}>
          <Input value={wallet} onChange={(e) => setWallet(e.target.value)} inputMode="tel" />
        </Field>
      ) : null}
      {method === "bank" ? (
        <>
          <Field id="join-bank" label={t("join.payment_bank")}>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} />
          </Field>
          <Field
            id="join-account"
            label={t("join.payment_account")}
            error={fieldErrors.bank_account_no}
            hint={me.payment?.bank_account_masked ?? undefined}
          >
            <Input value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" />
          </Field>
          <Field id="join-holder" label={t("join.payment_name")}>
            <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
          </Field>
        </>
      ) : null}
      <SaveButton saving={saving} />
    </form>
  );
}

function IdentityStep({ save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const [number, setNumber] = React.useState("");
  const [front, setFront] = React.useState<File | null>(null);
  const [back, setBack] = React.useState<File | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const files: Record<string, File> = {};
        if (front) files.id_front = front;
        if (back) files.id_back = back;
        save({ citizenship_no: number.trim() }, files);
      }}
    >
      <p className="text-fg-body text-sm">{t("id_body")}</p>
      <Field id="join-cit" label={t("id_number")} error={fieldErrors.citizenship_no}>
        <Input value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" />
      </Field>
      <FilePick id="join-id-front" label={t("id_front")} file={front} onFile={setFront} accept="image/*,application/pdf" error={fieldErrors.id_front} />
      <FilePick id="join-id-back" label={t("id_back")} file={back} onFile={setBack} accept="image/*,application/pdf" />
      <SaveButton saving={saving} />
    </form>
  );
}

function ConsentStep({ me, save, saving }: StepProps) {
  const t = useTranslations("bolau.join");
  const [data, setData] = React.useState(true);
  const [pub, setPub] = React.useState(!!me.public_consent);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pub || !data) {
          setErr(t("consent_required"));
          return;
        }
        save({ data_processing: data, public_profile: pub });
      }}
    >
      <label htmlFor="consent-data" className="flex items-start gap-2.5 text-sm">
        <Checkbox id="consent-data" checked={data} onCheckedChange={(c) => setData(c === true)} className="mt-0.5" />
        {t("consent_data")}
      </label>
      <label htmlFor="consent-public" className="flex items-start gap-2.5 text-sm">
        <Checkbox id="consent-public" checked={pub} onCheckedChange={(c) => setPub(c === true)} className="mt-0.5" />
        {t("consent")}
      </label>
      <FormError message={err} />
      <SaveButton saving={saving} />
    </form>
  );
}

function HandleStep({ me, save, saving, fieldErrors }: StepProps) {
  const t = useTranslations("bolau.join");
  const [handle, setHandle] = React.useState(me.handle ?? "");
  const valid = HANDLE_RE.test(handle);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save({ handle });
      }}
    >
      <p className="text-fg-body text-sm">{t("handle_body")}</p>
      <Field id="join-handle" label={t("handle_title")} error={fieldErrors.handle ?? (handle && !valid ? t("handle_invalid") : undefined)}>
        <PrefixInput
          prefix={t("handle")}
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))}
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <SaveButton saving={saving} />
    </form>
  );
}

function DonePanel({ me, headingRef }: { me: SipaluMe; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const t = useTranslations("bolau.join");
  const f = useFormat();
  return (
    <div>
      <h2 id="join-step-title" ref={headingRef} tabIndex={-1} className="text-fg text-xl font-extrabold focus:outline-none">
        {t("done_title")}
      </h2>
      <p className="text-fg-body mt-2">{t("done_body")}</p>
      <p className="text-fg mt-3 font-semibold">{t("done_progress", { n: f.digits(me.completeness?.percent ?? 0) })}</p>
      {me.bookable ? (
        <p className="text-success mt-1 text-sm font-semibold">{t("bookable")}</p>
      ) : me.completeness?.missing?.length ? (
        <p className="text-fg-muted mt-1 text-sm">
          {t("not_bookable", {
            problems: (me.completeness.items ?? [])
              .filter((i) => !i.done && !i.optional)
              .map((i) => i.label)
              .join(", "),
          })}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {me.handle ? (
          <Link
            href={`/sipalu/${me.handle}`}
            className="bg-brand text-brand-fg hover:bg-brand-hover inline-flex min-h-11 items-center rounded-control px-4 font-semibold"
          >
            {t("view_profile")}
          </Link>
        ) : null}
      </div>
      <p className="text-fg-muted mt-4 text-sm">{t("open_app")}</p>
    </div>
  );
}
