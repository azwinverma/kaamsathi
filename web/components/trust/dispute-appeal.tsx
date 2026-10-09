"use client";
/** N008 — appeal a dispute decision (employer) and decide the appeal (ops, a different staff member). */
import * as React from "react";
import { Info, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { isApiError } from "@/lib/api/errors";
import { useAppealDispute, useDecideAppeal } from "@/lib/api/hooks/trust";
import type { AppealOutcome, Dispute, DisputeAppeal } from "@/lib/api/types-trust";
import { useFormat } from "@/lib/use-format";
import { daysUntil } from "./moderation";

export function AppealBlock({
  appeal,
  partyLabel,
}: {
  appeal: DisputeAppeal;
  /** Override the party's name (Bolau: the dispute's "worker" is the Sipalu). */
  partyLabel?: (party: DisputeAppeal["party"]) => string;
}) {
  const ta = useTranslations("moderation.appeal");
  const f = useFormat();
  return (
    <div className="mt-3 space-y-2 rounded-md border border-accent/30 bg-accent-subtle/40 px-3 py-2">
      <p className="text-xs font-medium text-fg-muted">
        {ta("block_title", { party: partyLabel ? partyLabel(appeal.party) : ta(`party.${appeal.party}`) })}
        <span className="font-normal"> · {f.dateTime(appeal.appealed_at)}</span>
      </p>
      <p className="text-sm whitespace-pre-line text-fg">{appeal.reason}</p>
      {appeal.outcome ? (
        <div className="border-t border-border pt-2">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-fg-muted">
            {ta("outcome")}
            <Badge tone={appeal.outcome === "overturned" ? "warning" : "success"}>
              {appeal.outcome_label || ta(`outcomes.${appeal.outcome}`)}
            </Badge>
            {appeal.resolved_at ? <span className="font-normal">{f.dateTime(appeal.resolved_at)}</span> : null}
            {appeal.resolved_by ? <span className="font-normal">· {appeal.resolved_by.full_name}</span> : null}
          </p>
          {appeal.resolution_note ? (
            <p className="mt-1 text-sm whitespace-pre-line text-fg">{appeal.resolution_note}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-fg-muted">{ta("pending")}</p>
      )}
    </div>
  );
}

export function AppealDialog({
  dispute,
  onClose,
  scope = "org",
}: {
  dispute: Dispute | null;
  onClose: () => void;
  scope?: "me" | "org" | "ghar";
}) {
  const t = useTranslations();
  const ta = useTranslations("moderation.appeal");
  const f = useFormat();
  const appeal = useAppealDispute(scope);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason("");
    setError(null);
  }, [dispute]);
  if (!dispute) return null;
  const days = daysUntil(dispute.appeal_deadline);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("errors.required"));
      return;
    }
    appeal.mutate(
      { id: dispute.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(ta("appealed_toast"));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={ta("title")} description={dispute.worker.full_name} />
          <DialogBody className="space-y-4">
            {dispute.resolution_note ? (
              <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-muted px-3 py-2 text-sm whitespace-pre-line text-fg-body">
                {dispute.resolution_note}
              </blockquote>
            ) : null}
            <p className="flex gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-fg-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {ta("once_hint")}
                {dispute.appeal_deadline ? (
                  <>
                    {" "}
                    {ta("deadline", { date: f.dateTime(dispute.appeal_deadline), days: days ?? 0 })}
                  </>
                ) : null}
              </span>
            </p>
            <FormError message={error} />
            <Field id="appeal-reason" label={ta("reason")} hint={ta("reason_hint")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} rows={5} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={appeal.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={appeal.isPending}>
              {ta("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DecideAppealDialog({ dispute, onClose }: { dispute: Dispute | null; onClose: () => void }) {
  const t = useTranslations();
  const ta = useTranslations("moderation.appeal");
  const decide = useDecideAppeal();
  const [outcome, setOutcome] = React.useState<AppealOutcome>("upheld");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setOutcome("upheld");
    setNote("");
    setError(null);
  }, [dispute]);
  if (!dispute) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError(t("errors.required"));
      return;
    }
    decide.mutate(
      { id: dispute.id, outcome, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(outcome === "upheld" ? ta("upheld_toast") : ta("overturned_toast"));
          onClose();
        },
        onError: (err) => {
          if (isApiError(err) && err.status === 403) setError(ta("same_staff"));
          else setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error"));
        },
      },
    );
  };
  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={ta("decide_title")}
            description={`${dispute.worker.full_name}${dispute.organization ? ` · ${dispute.organization.name}` : ""}`}
          />
          <DialogBody className="space-y-4">
            {dispute.appeal ? <AppealBlock appeal={dispute.appeal} /> : null}
            <p className="flex gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-fg-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {ta("different_staff_hint")}
            </p>
            <FormError message={error} />
            <Segmented
              label={ta("outcome")}
              value={outcome}
              onChange={setOutcome}
              options={[
                {
                  value: "upheld",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <ThumbsUp className="size-4" aria-hidden />
                      {ta("outcomes.upheld")}
                    </span>
                  ),
                },
                {
                  value: "overturned",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <ThumbsDown className="size-4" aria-hidden />
                      {ta("outcomes.overturned")}
                    </span>
                  ),
                },
              ]}
            />
            <p className="text-xs text-fg-muted">{ta(`outcome_hint.${outcome}`)}</p>
            <Field id="appeal-note" label={ta("decision_note")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={4} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={decide.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant={outcome === "overturned" ? "danger" : "primary"} loading={decide.isPending}>
              {ta("decide_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
