"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { useCreatePartnerKey } from "@/lib/api/hooks/partners";
import { PARTNER_SCOPES, type PartnerScope } from "@/lib/api/types-partners";
import { SecretReveal } from "./secret-reveal";

/** Create an API key. The full key is displayed once and never again. */
export function CreateKeyDialog({
  partnerId,
  open,
  onOpenChange,
}: {
  partnerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("partners.keys");
  const tp = useTranslations("partners");
  const tc = useTranslations("common");
  const create = useCreatePartnerKey();
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<PartnerScope[]>(["profile.read", "earnings.read"]);
  const [created, setCreated] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setScopes(["profile.read", "earnings.read"]);
      setCreated(null);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(s: PartnerScope, on: boolean) {
    setScopes((cur) => (on ? Array.from(new Set([...cur, s])) : cur.filter((x) => x !== s)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await create.mutateAsync({ partnerId, scopes, name });
      setCreated(res.key);
    } catch {
      /* shown below */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Don't let an accidental outside click discard the only copy of the key.
        if (!o && created) return onOpenChange(false);
        onOpenChange(o);
      }}
    >
      <DialogContent
        size="md"
        closeLabel={tc("close")}
        onInteractOutside={(e) => {
          if (created) e.preventDefault();
        }}
      >
        <DialogHeader title={created ? t("created_title") : t("new_title")} description={created ? undefined : t("new_desc")} />
        {created ? (
          <>
            <DialogBody>
              <SecretReveal label={t("key")} value={created} warning={t("shown_once")} />
              <p className="mt-3 text-xs text-fg-muted">{t("usage", { header: "Authorization: Partner <key>" })}</p>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="contents">
            <DialogBody className="space-y-4">
              {create.error ? (
                <FormError message={isApiError(create.error) ? create.error.message : tc("something_went_wrong")} />
              ) : null}
              <Field id="key-name" label={t("name")} hint={t("name_hint")} optional optionalLabel={tc("optional")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </Field>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-fg">{t("scopes")}</legend>
                {PARTNER_SCOPES.map((s) => (
                  <label key={s} className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-hover/50">
                    <Checkbox checked={scopes.includes(s)} onCheckedChange={(v) => toggle(s, v === true)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-fg">{s}</span>
                      <span className="block text-xs text-fg-muted">{tp(`scope.${s.replace(".", "_")}`)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={create.isPending} disabled={!scopes.length}>
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
