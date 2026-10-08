"use client";
import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { errorMessage } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { VerificationBadge } from "@/components/shared/status-badge";
import { useVerifyProvider } from "@/lib/api/hooks/training";
import { isApiError } from "@/lib/api/errors";
import type { ProviderVerifyInput, TrainingProvider } from "@/lib/api/types-training";
import { useFormat } from "@/lib/use-format";

type Decision = ProviderVerifyInput["status"];

/** Small "Verified" pill for a course's provider (T002). */
export function ProviderVerifiedBadge({ verified }: { verified?: boolean }) {
  const t = useTranslations("training.verify");
  if (!verified) return null;
  return (
    <Badge tone="success" title={t("verified_provider")}>
      <BadgeCheck aria-hidden />
      {t("verified_short")}
    </Badge>
  );
}

/** Verification status cell: badge + who/when + note. */
export function ProviderVerificationCell({ provider: p }: { provider: TrainingProvider }) {
  const t = useTranslations("training.verify");
  const f = useFormat();
  const status = p.verification_status ?? "unverified";
  return (
    <div className="space-y-0.5">
      <VerificationBadge status={status} />
      {p.verified_at ? (
        <span className="text-fg-muted block text-xs">
          {t("by_at", { name: p.verified_by?.full_name ?? "—", at: f.dateTime(p.verified_at) })}
        </span>
      ) : null}
      {p.verification_note ? (
        <span className="text-fg-body line-clamp-2 block max-w-56 text-xs">
          {p.verification_note}
        </span>
      ) : null}
    </div>
  );
}

/** POST /ops/training/providers/{id}/verify — Verified / Rejected (note required) / Back to pending. */
export function ProviderVerifyDialog({
  provider,
  onClose,
}: {
  provider: TrainingProvider | null;
  onClose: () => void;
}) {
  const t = useTranslations("training.verify");
  const tRoot = useTranslations();
  const verify = useVerifyProvider();
  const [status, setStatus] = React.useState<Decision>("verified");
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!provider) return;
    setStatus(provider.verification_status === "verified" ? "pending" : "verified");
    setNote(provider.verification_note ?? "");
    setNoteError(null);
    setFormError(null);
  }, [provider]);

  if (!provider) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (status === "rejected" && !trimmed) {
      setNoteError(t("note_required"));
      return;
    }
    setNoteError(null);
    setFormError(null);
    verify.mutate(
      { id: provider.id, status, note: trimmed || undefined },
      {
        onSuccess: () => {
          toast.success(t(`toast.${status}`, { name: provider.name }));
          onClose();
        },
        onError: (err) => {
          if (isApiError(err) && err.fields?.note?.[0]) setNoteError(err.fields.note[0]);
          else if (isApiError(err) && err.fields?.ctevt_affiliation_no?.[0])
            setFormError(err.fields.ctevt_affiliation_no[0]);
          else setFormError(errorMessage(err, tRoot));
        },
      },
    );
  };

  return (
    <Dialog open={!!provider} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" closeLabel={tRoot("common.close")}>
        <DialogHeader title={t("title")} description={provider.name} />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-fg-muted">{t("current")}</span>
              <VerificationBadge status={provider.verification_status ?? "unverified"} />
            </div>
            {provider.kind === "ctevt_affiliated" ? (
              <p className="text-fg-muted text-sm">
                {provider.ctevt_affiliation_no
                  ? t("affiliation_check", { no: provider.ctevt_affiliation_no })
                  : t("affiliation_missing")}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <p className="text-fg text-sm font-medium" aria-hidden>
                {t("decision")}
              </p>
              <Segmented
                label={t("decision")}
                value={status}
                onChange={(v) => setStatus(v)}
                options={(["verified", "rejected", "pending"] as const).map((s) => ({
                  value: s,
                  label: t(`decision_${s}`),
                }))}
              />
            </div>
            <Field
              id="pv-verify-note"
              label={t("note")}
              error={noteError ?? undefined}
              optional={status !== "rejected"}
              optionalLabel={tRoot("common.optional")}
              hint={status === "rejected" ? t("note_hint_rejected") : undefined}
            >
              <Textarea
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={verify.isPending}>
              {tRoot("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant={status === "rejected" ? "danger" : "primary"}
              loading={verify.isPending}
            >
              {t(`submit_${status}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
