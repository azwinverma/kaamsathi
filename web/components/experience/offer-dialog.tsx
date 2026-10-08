"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileSignature, Send, Undo2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, PrefixInput } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { SiteSelect } from "@/components/shared/selects";
import { Bind } from "@/components/hiring/bind";
import { parseAmount, splitMonthly } from "@/components/hiring/lib";
import { useWageCheck } from "@/components/hiring/wage";
import { useJob } from "@/lib/api/hooks/hiring";
import { useSendOffer, useWithdrawOffer } from "@/lib/api/hooks/experience";
import type { WageType } from "@/lib/api/types";
import {
  CONTRACT_TYPES,
  type ApplicationOfferField,
  type ContractType,
  type JobOfferStatus,
  type JobOfferSummary,
} from "@/lib/api/types-experience";
import { addDays, todayIso } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

const OFFER_TONE: Record<JobOfferStatus, BadgeTone> = {
  sent: "brand",
  accepted: "success",
  declined: "danger",
  expired: "neutral",
  withdrawn: "neutral",
};

/** Offer status chip for pipeline cards and the candidate drawer. */
export function OfferChip({ offer }: { offer: JobOfferSummary | null | undefined }) {
  const t = useTranslations("experience.offer");
  const f = useFormat();
  if (!offer) return null;
  return (
    <Badge
      tone={OFFER_TONE[offer.status] ?? "neutral"}
      title={
        offer.status === "sent" ? t("expires", { when: f.dateTime(offer.expires_at) }) : undefined
      }
    >
      <FileSignature aria-hidden />
      {t(`status.${offer.status}`)}
    </Badge>
  );
}

type OfferApp = {
  id: string;
  stage: string;
  job: { id: string; title: string };
} & ApplicationOfferField & {
    worker: { full_name: string };
  };

/**
 * Pipeline controls for a `selected` candidate: "Send offer" (or withdraw an open one) and the chip.
 * Joining without an accepted offer is still allowed; the join dialog nudges.
 */
export function OfferControls({ app }: { app: OfferApp }) {
  const t = useTranslations("experience.offer");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const withdraw = useWithdrawOffer();
  const offer = app.offer;
  if (app.stage !== "selected" && !offer) return null;
  const active = offer && (offer.status === "sent" || offer.status === "accepted");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <OfferChip offer={offer} />
      {app.stage === "selected" && !active ? (
        <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => setOpen(true)}>
          <Send aria-hidden />
          {offer ? t("send_again") : t("send")}
        </Button>
      ) : null}
      {offer?.status === "sent" ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          loading={withdraw.isPending}
          onClick={() =>
            withdraw.mutate(offer.id, {
              onSuccess: () => toast.success(t("withdrawn_toast")),
              onError: (e) => toastError(e, tRoot),
            })
          }
        >
          <Undo2 aria-hidden />
          {t("withdraw")}
        </Button>
      ) : null}
      <OfferDialog app={app} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function OfferDialog({
  app,
  open,
  onOpenChange,
}: {
  app: OfferApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("experience.offer");
  const tRoot = useTranslations();
  const wage = useWageCheck();
  const { data: job } = useJob(open ? app.job.id : undefined);
  const send = useSendOffer();
  const [wageType, setWageType] = React.useState<WageType>("monthly");
  const [basic, setBasic] = React.useState("");
  const [da, setDa] = React.useState("");
  const [daily, setDaily] = React.useState("");
  const [start, setStart] = React.useState(addDays(todayIso(), 7));
  const [site, setSite] = React.useState("");
  const [designation, setDesignation] = React.useState(app.job.title);
  const [contract, setContract] = React.useState<ContractType>("permanent");
  const [endsOn, setEndsOn] = React.useState("");
  const [days, setDays] = React.useState("3");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !job) return;
    const wt = job.wage_type;
    const amount = parseAmount(job.wage_amount) ?? 0;
    setWageType(wt);
    if (wt === "monthly" && amount) {
      const split = splitMonthly(amount, wage.mw);
      setBasic(String(split.basic));
      setDa(String(split.da));
    } else if (amount) {
      setDaily(String(amount));
    }
    setSite(job.site?.id ?? "");
    setDesignation(job.title);
    if (job.start_date && job.start_date > todayIso()) setStart(job.start_date);
    setContract(wt === "daily" ? "daily" : "permanent");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id]);

  const monthly =
    wageType === "monthly" ? (parseAmount(basic) ?? 0) + (parseAmount(da) ?? 0) : null;
  const below =
    wageType === "monthly"
      ? wage.below("monthly", monthly)
      : wage.below("daily", parseAmount(daily));
  const needsEnd = contract === "fixed_term" || contract === "probation";

  const submit = () => {
    setError(null);
    if (below) return setError(below);
    if (needsEnd && !endsOn) return setError(t("ends_on_required"));
    send.mutate(
      {
        applicationId: app.id,
        wage_type: wageType,
        basic_salary: wageType === "monthly" ? basic : null,
        dearness_allowance: wageType === "monthly" ? da : null,
        daily_wage: wageType === "daily" ? daily : null,
        start_date: start,
        site_id: site || null,
        designation: designation.trim(),
        contract_type: contract,
        ends_on: needsEnd ? endsOn : null,
        expires_in_days: Number(days) || 3,
      },
      {
        onSuccess: () => {
          toast.success(t("sent_toast", { name: app.worker.full_name }));
          onOpenChange(false);
        },
        onError: (e) => toastError(e, tRoot),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={tRoot("common.close")}>
        <DialogHeader
          title={t("title", { name: app.worker.full_name })}
          description={t("description")}
        />
        <DialogBody className="space-y-4">
          <Segmented
            label={tRoot("term.wage_type")}
            value={wageType}
            onChange={(v) => setWageType(v)}
            size="sm"
            options={[
              { value: "monthly", label: tRoot("term.monthly") },
              { value: "daily", label: tRoot("term.daily") },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {wageType === "monthly" ? (
              <>
                <Field id="of-basic" label={tRoot("term.basic_salary")} hint={wage.hint("monthly")}>
                  <PrefixInput
                    prefix={tRoot("term.npr")}
                    inputMode="decimal"
                    value={basic}
                    onChange={(e) => setBasic(e.target.value)}
                  />
                </Field>
                <Field id="of-da" label={tRoot("term.dearness_allowance")}>
                  <PrefixInput
                    prefix={tRoot("term.npr")}
                    inputMode="decimal"
                    value={da}
                    onChange={(e) => setDa(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <Field id="of-daily" label={tRoot("term.daily_wage")} hint={wage.hint("daily")}>
                <PrefixInput
                  prefix={tRoot("term.npr")}
                  inputMode="decimal"
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                />
              </Field>
            )}
            <Field id="of-start" label={tRoot("term.start_date")}>
              <Bind
                render={(a) => (
                  <BsDatePicker {...a} value={start} onChange={setStart} min={todayIso()} />
                )}
              />
            </Field>
            <Field id="of-site" label={t("site")} optional>
              <Bind render={(a) => <SiteSelect {...a} value={site} onChange={setSite} />} />
            </Field>
            <Field id="of-designation" label={t("designation")}>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </Field>
            <Field id="of-contract" label={t("contract_type")}>
              <NativeSelect
                value={contract}
                onChange={(e) => setContract(e.target.value as ContractType)}
                options={CONTRACT_TYPES.map((c) => ({ value: c, label: t(`contract.${c}`) }))}
              />
            </Field>
            {needsEnd ? (
              <Field id="of-ends" label={t("ends_on")}>
                <Bind
                  render={(a) => (
                    <BsDatePicker {...a} value={endsOn} onChange={setEndsOn} min={start} />
                  )}
                />
              </Field>
            ) : null}
            <Field id="of-days" label={t("expires_in")} hint={t("expires_in_hint")}>
              <NativeSelect
                value={days}
                onChange={(e) => setDays(e.target.value)}
                options={["1", "2", "3", "5", "7"].map((d) => ({
                  value: d,
                  label: t("days", { count: Number(d) }),
                }))}
              />
            </Field>
          </div>
          <FormError message={error ?? below} />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            {tRoot("common.cancel")}
          </Button>
          <Button onClick={submit} loading={send.isPending}>
            <Send aria-hidden />
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Join-form defaults taken from an accepted offer (empty object when there is none). */
export function offerDefaults(offer: JobOfferSummary | null | undefined) {
  if (!offer) return {};
  return {
    start_date: offer.start_date,
    site_id: offer.site?.id ?? "",
    designation: offer.designation,
    wage_type: offer.wage_type,
    basic_salary: offer.basic_salary ?? "",
    dearness_allowance: offer.dearness_allowance ?? "",
    daily_wage: offer.daily_wage ?? "",
  };
}

/** In the join dialog: "terms filled from the accepted offer" or a nudge to send one first. */
export function JoinOfferNudge({ offer }: { offer: JobOfferSummary | null | undefined }) {
  const t = useTranslations("experience.offer");
  const accepted = offer?.status === "accepted";
  return (
    <p
      className={
        accepted
          ? "border-success/30 bg-success-subtle text-success rounded-md border px-3 py-2 text-sm"
          : "border-warning/30 bg-warning-subtle text-warning rounded-md border px-3 py-2 text-sm"
      }
    >
      {accepted ? t("join_from_offer") : t("join_without_offer")}
    </p>
  );
}
