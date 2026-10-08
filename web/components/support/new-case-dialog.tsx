"use client";
import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { isApiError } from "@/lib/api/errors";
import { useCreateSupportCase } from "@/lib/api/hooks/support";
import {
  SAFETY_KINDS,
  SUPPORT_CATEGORIES,
  type SafetyKind,
  type SupportCase,
  type SupportCategory,
} from "@/lib/api/types-support";

/**
 * New support case (employer `org` scope or personal `me` scope). `safety` opens the confidential
 * safety-report variant: kind, anonymous-to-employer and emergency.
 */
export function NewCaseDialog({
  open,
  onOpenChange,
  scope,
  safety,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "org" | "me";
  safety?: boolean;
  onCreated?: (c: SupportCase) => void;
}) {
  const t = useTranslations("support.new");
  const ts = useTranslations("support.safety");
  const tc = useTranslations("support.category");
  const tAll = useTranslations();
  const create = useCreateSupportCase(scope);
  const [category, setCategory] = React.useState<SupportCategory>("other");
  const [priority, setPriority] = React.useState<"low" | "normal" | "high">("normal");
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<SafetyKind | "">("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [emergency, setEmergency] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCategory(safety ? "safety" : "other");
    setPriority("normal");
    setSubject("");
    setDescription("");
    setKind("");
    setAnonymous(false);
    setEmergency(false);
    setErrors({});
    setFormError(null);
  }, [open, safety]);

  const isSafety = category === "safety";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = tAll("errors.required");
    if (!description.trim()) next.description = tAll("errors.required");
    if (isSafety && !kind) next.safety_kind = ts("kind_required");
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate(
      {
        subject: subject.trim(),
        description: description.trim(),
        category,
        channel: "web",
        ...(isSafety ? { safety_kind: kind as SafetyKind, anonymous, emergency } : { priority }),
      },
      {
        onSuccess: (c) => {
          toast.success(t("created_toast", { number: c.number }));
          onOpenChange(false);
          onCreated?.(c);
        },
        onError: (err) => {
          if (isApiError(err)) {
            const fields: Record<string, string> = {};
            for (const [k, msgs] of Object.entries(err.fields ?? {})) fields[k] = msgs[0];
            setErrors(fields);
            setFormError(err.message || tAll(`errors.${err.code}`));
          } else setFormError(tAll("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={isSafety ? ts("dialog_title") : t("title")}
            description={isSafety ? ts("dialog_description") : t("description")}
          />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            {isSafety ? (
              <p className="flex gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-fg">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                {ts("danger_note")}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {isSafety ? (
                <Field id="case-safety-kind" label={ts("kind")} error={errors.safety_kind}>
                  <NativeSelect
                    value={kind}
                    onChange={(e) => setKind(e.target.value as SafetyKind)}
                    placeholder={tAll("common.select")}
                    options={SAFETY_KINDS.map((k) => ({ value: k, label: ts(`kind_${k}`) }))}
                  />
                </Field>
              ) : (
                <>
                  <Field id="case-category" label={t("category")}>
                    <NativeSelect
                      value={category}
                      onChange={(e) => setCategory(e.target.value as SupportCategory)}
                      options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: tc(c) }))}
                    />
                  </Field>
                  <Field id="case-priority" label={t("priority")} hint={t("priority_hint")}>
                    <NativeSelect
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
                      options={(["low", "normal", "high"] as const).map((p) => ({
                        value: p,
                        label: tAll(`support.priority.${p}`),
                      }))}
                    />
                  </Field>
                </>
              )}
            </div>
            <Field id="case-subject" label={t("subject")} error={errors.subject}>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </Field>
            <Field id="case-description" label={t("details")} hint={isSafety ? ts("details_hint") : t("details_hint")} error={errors.description}>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} />
            </Field>
            {isSafety ? (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm text-fg">
                  <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{ts("anonymous")}</span>
                    <span className="block text-xs text-fg-muted">{ts("anonymous_hint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-fg">
                  <Checkbox checked={emergency} onCheckedChange={(v) => setEmergency(v === true)} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-danger">{ts("emergency")}</span>
                    <span className="block text-xs text-fg-muted">{ts("emergency_hint")}</span>
                  </span>
                </label>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-danger hover:underline"
                onClick={() => setCategory("safety")}
              >
                {ts("switch_to_safety")}
              </button>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" variant={isSafety ? "danger" : "primary"} loading={create.isPending}>
              {isSafety ? ts("submit") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
