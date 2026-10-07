"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect, type SelectOption } from "@/components/ui/select";
import { isApiError } from "@/lib/api/errors";
import { useCreateFinanceOffer, useUpdateFinanceOffer } from "@/lib/api/hooks/finance";
import { OFFER_KINDS, type FinanceOffer, type FinanceOfferInput, type OfferKind } from "@/lib/api/types-finance";

interface FormState {
  partner_id: string;
  kind: OfferKind;
  title: string;
  title_ne: string;
  description: string;
  description_ne: string;
  min_verified_months: string;
  min_avg_net: string;
  max_amount: string;
  interest_note: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  partner_id: "",
  kind: "ewa",
  title: "",
  title_ne: "",
  description: "",
  description_ne: "",
  min_verified_months: "1",
  min_avg_net: "",
  max_amount: "",
  interest_note: "",
  is_active: true,
};

const money = (v: string) => (v.trim() === "" ? null : v.trim());

export function OfferFormDialog({
  open,
  onOpenChange,
  offer,
  partnerOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer?: FinanceOffer | null;
  partnerOptions: SelectOption[];
}) {
  const t = useTranslations("finance.offer_form");
  const tf = useTranslations("finance");
  const tc = useTranslations("common");
  const create = useCreateFinanceOffer();
  const update = useUpdateFinanceOffer();
  const [v, setV] = React.useState<FormState>(EMPTY);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setV(
      offer
        ? {
            partner_id: offer.partner.id,
            kind: offer.kind,
            title: offer.title,
            title_ne: offer.title_ne ?? "",
            description: offer.description,
            description_ne: offer.description_ne ?? "",
            min_verified_months: String(offer.min_verified_months),
            min_avg_net: offer.min_avg_net ?? "",
            max_amount: offer.max_amount ?? "",
            interest_note: offer.interest_note ?? "",
            is_active: offer.is_active,
          }
        : EMPTY,
    );
  }, [open, offer]);

  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: string) => (isApiError(error) ? error.fieldError(k) : undefined);
  const pending = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: FinanceOfferInput = {
      partner_id: v.partner_id,
      kind: v.kind,
      title: v.title,
      title_ne: v.title_ne,
      description: v.description,
      description_ne: v.description_ne,
      min_verified_months: Number(v.min_verified_months || 0),
      min_avg_net: money(v.min_avg_net),
      max_amount: money(v.max_amount),
      interest_note: v.interest_note,
      is_active: v.is_active,
    };
    try {
      if (offer) await update.mutateAsync({ id: offer.id, ...body });
      else await create.mutateAsync(body);
      toast.success(offer ? tc("changes_saved") : tc("created_success"));
      onOpenChange(false);
    } catch (e2) {
      setError(e2);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <DialogHeader title={offer ? t("edit_title") : t("new_title")} description={t("description")} />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            {isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="offer-partner" label={tf("table.partner")} error={err("partner_id")}>
                <NativeSelect
                  value={v.partner_id}
                  onChange={(e) => set("partner_id", e.target.value)}
                  placeholder={tc("select")}
                  options={partnerOptions}
                  disabled={!!offer}
                />
              </Field>
              <Field id="offer-kind" label={t("kind")} error={err("kind")}>
                <NativeSelect
                  value={v.kind}
                  onChange={(e) => set("kind", e.target.value as OfferKind)}
                  options={OFFER_KINDS.map((k) => ({ value: k, label: tf(`kind.${k}`) }))}
                />
              </Field>
              <Field id="offer-title" label={t("title_en")} error={err("title")}>
                <Input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
              </Field>
              <Field id="offer-title-ne" label={t("title_ne")} error={err("title_ne")} optional optionalLabel={tc("optional")}>
                <Input value={v.title_ne} onChange={(e) => set("title_ne", e.target.value)} maxLength={200} lang="ne" />
              </Field>
              <Field id="offer-desc" label={t("desc_en")} error={err("description")} optional optionalLabel={tc("optional")}>
                <Textarea rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field id="offer-desc-ne" label={t("desc_ne")} error={err("description_ne")} optional optionalLabel={tc("optional")}>
                <Textarea rows={3} value={v.description_ne} onChange={(e) => set("description_ne", e.target.value)} lang="ne" />
              </Field>
              <Field id="offer-min-months" label={t("min_months")} hint={t("min_months_hint")} error={err("min_verified_months")}>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  inputMode="numeric"
                  value={v.min_verified_months}
                  onChange={(e) => set("min_verified_months", e.target.value)}
                />
              </Field>
              <Field id="offer-min-net" label={t("min_avg_net")} error={err("min_avg_net")} optional optionalLabel={tc("optional")}>
                <Input type="number" min={0} inputMode="decimal" value={v.min_avg_net} onChange={(e) => set("min_avg_net", e.target.value)} />
              </Field>
              <Field id="offer-max" label={t("max_amount")} error={err("max_amount")} optional optionalLabel={tc("optional")}>
                <Input type="number" min={0} inputMode="decimal" value={v.max_amount} onChange={(e) => set("max_amount", e.target.value)} />
              </Field>
              <Field
                id="offer-terms"
                label={t("interest_note")}
                hint={t("interest_note_hint")}
                error={err("interest_note")}
                optional
                optionalLabel={tc("optional")}
              >
                <Input value={v.interest_note} onChange={(e) => set("interest_note", e.target.value)} maxLength={255} />
              </Field>
            </div>
            <SwitchField
              id="offer-active"
              label={t("is_active")}
              description={t("is_active_hint")}
              checked={v.is_active}
              onCheckedChange={(val: boolean) => set("is_active", val)}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {offer ? tc("save_changes") : tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
