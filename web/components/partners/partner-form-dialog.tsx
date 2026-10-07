"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/checkbox";
import { isApiError } from "@/lib/api/errors";
import { useCreateOpsPartner, useUpdateOpsPartner } from "@/lib/api/hooks/partners";
import {
  PARTNER_KINDS,
  PARTNER_REGULATORS,
  type OpsPartner,
  type OpsPartnerInput,
  type PartnerKind,
  type PartnerRegulator,
} from "@/lib/api/types-partners";
import { SecretReveal } from "./secret-reveal";

const EMPTY: OpsPartnerInput = {
  name: "",
  kind: "bank",
  license_no: "",
  regulator: "",
  contact_email: "",
  contact_phone: "",
  webhook_url: "",
  is_active: true,
};

export function PartnerFormDialog({
  open,
  onOpenChange,
  partner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: OpsPartner | null;
}) {
  const t = useTranslations("partners");
  const tc = useTranslations("common");
  const create = useCreateOpsPartner();
  const update = useUpdateOpsPartner();
  const [values, setValues] = React.useState<OpsPartnerInput>(EMPTY);
  const [error, setError] = React.useState<unknown>(null);
  const [secret, setSecret] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSecret(null);
    setValues(
      partner
        ? {
            name: partner.name,
            kind: partner.kind,
            license_no: partner.license_no,
            regulator: partner.regulator,
            contact_email: partner.contact_email,
            contact_phone: partner.contact_phone,
            webhook_url: partner.webhook_url,
            is_active: partner.is_active,
          }
        : EMPTY,
    );
  }, [open, partner]);

  const set = <K extends keyof OpsPartnerInput>(k: K, v: OpsPartnerInput[K]) => setValues((s) => ({ ...s, [k]: v }));
  const fieldErr = (k: string) => (isApiError(error) ? error.fieldError(k) : undefined);
  const pending = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (partner) {
        await update.mutateAsync({ id: partner.id, ...values });
        toast.success(tc("changes_saved"));
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync(values);
        toast.success(t("form.created"));
        if (created.webhook_secret) setSecret(created.webhook_secret);
        else onOpenChange(false);
      }
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <DialogHeader title={partner ? t("form.edit_title") : t("form.new_title")} description={t("form.description")} />
        {secret ? (
          <>
            <DialogBody>
              <SecretReveal label={t("form.webhook_secret")} value={secret} warning={t("form.webhook_secret_once")} />
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t("keys.done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="contents" noValidate>
            <DialogBody className="space-y-4">
              {error && isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="partner-name" label={t("form.name")} error={fieldErr("name")} className="sm:col-span-2">
                  <Input value={values.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
                </Field>
                <Field id="partner-kind" label={t("form.kind")} error={fieldErr("kind")}>
                  <NativeSelect
                    value={values.kind}
                    onChange={(e) => set("kind", e.target.value as PartnerKind)}
                    options={PARTNER_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
                  />
                </Field>
                <Field id="partner-regulator" label={t("form.regulator")} error={fieldErr("regulator")} optional optionalLabel={tc("optional")}>
                  <NativeSelect
                    value={values.regulator ?? ""}
                    onChange={(e) => set("regulator", e.target.value as PartnerRegulator | "")}
                    placeholder={tc("none")}
                    options={PARTNER_REGULATORS.map((r) => ({ value: r, label: t(`regulator.${r}`) }))}
                  />
                </Field>
                <Field id="partner-license" label={t("form.license_no")} error={fieldErr("license_no")} optional optionalLabel={tc("optional")}>
                  <Input value={values.license_no ?? ""} onChange={(e) => set("license_no", e.target.value)} maxLength={100} />
                </Field>
                <Field id="partner-phone" label={t("form.contact_phone")} error={fieldErr("contact_phone")} optional optionalLabel={tc("optional")}>
                  <Input value={values.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} inputMode="tel" maxLength={20} />
                </Field>
                <Field id="partner-email" label={t("form.contact_email")} error={fieldErr("contact_email")} optional optionalLabel={tc("optional")} className="sm:col-span-2">
                  <Input type="email" value={values.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
                </Field>
                <Field
                  id="partner-webhook"
                  label={t("form.webhook_url")}
                  hint={t("form.webhook_hint")}
                  error={fieldErr("webhook_url")}
                  optional
                  optionalLabel={tc("optional")}
                  className="sm:col-span-2"
                >
                  <Input type="url" placeholder="https://" value={values.webhook_url ?? ""} onChange={(e) => set("webhook_url", e.target.value)} />
                </Field>
              </div>
              <SwitchField
                id="partner-active"
                label={t("form.is_active")}
                description={t("form.is_active_hint")}
                checked={!!values.is_active}
                onCheckedChange={(v: boolean) => set("is_active", v)}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={pending}>
                {partner ? tc("save_changes") : tc("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
