"use client";
/**
 * Ghardhani side of a Bolau booking dispute on /ghar/bookings/[id]: raise one, then follow it —
 * status, KaamSathi's decision, evidence from both sides (add photos / PDFs while it is open) and a
 * single appeal within 14 days of the decision. API: GET /bolau/bookings/{id}/dispute and
 * /me/booking-disputes/{id}/{evidence,appeal} (docs/CONTRACT-BOLAU.md, implementation note 9).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { AppealBlock, AppealDialog } from "@/components/trust/dispute-appeal";
import { EvidencePanel } from "@/components/trust/dispute-evidence";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ErrorState, Skeleton, errorMessage } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useBookingAction, useBookingDispute } from "@/lib/api/hooks/bolau";
import type { Booking } from "@/lib/api/types-bolau";
import type { DisputeStatus } from "@/lib/api/types-trust";
import { disputeText } from "@/lib/bolau/timeline";
import { useFormat } from "@/lib/use-format";

const TONE: Record<DisputeStatus, BadgeTone> = {
  open: "warning",
  employer_responded: "warning",
  resolved: "success",
  rejected: "neutral",
  appealed: "warning",
  appeal_resolved: "neutral",
};

/** "Raise a dispute" button + dialog (shown while the booking can be disputed). */
export function RaiseDispute({ b, name }: { b: Booking; name: string }) {
  const t = useTranslations("bolau.ghar.dispute");
  const tAll = useTranslations();
  const act = useBookingAction(b.id);
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Scale aria-hidden />
        {t("raise")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" closeLabel={tAll("common.close")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim().length < 10) {
                setError(t("too_short"));
                return;
              }
              setError(null);
              act.mutate(
                { action: "dispute", description: text.trim() },
                {
                  onSuccess: () => {
                    toast.success(t("raised"));
                    setOpen(false);
                    setText("");
                  },
                  onError: (err) => setError(errorMessage(err, tAll)),
                },
              );
            }}
          >
            <DialogHeader title={t("raise_title")} description={t("raise_body", { name })} />
            <DialogBody className="space-y-3">
              <Field id="dispute-text" label={t("raise_label")} error={error ?? undefined}>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} placeholder={t("raise_placeholder")} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tAll("common.back")}
              </Button>
              <Button type="submit" loading={act.isPending}>
                {t("raise_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The booking's dispute, for the Ghardhani: status, decision, evidence, appeal. */
export function BookingDisputeBox({ b, name }: { b: Booking; name: string }) {
  const t = useTranslations("bolau.ghar.dispute");
  const tm = useTranslations("moderation");
  const f = useFormat();
  const q = useBookingDispute(b.id, b.status === "disputed");
  const [appealing, setAppealing] = React.useState(false);
  if (b.status !== "disputed") return null;
  if (q.isLoading) return <Skeleton className="h-40 rounded-card" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return null;
  // On a booking the dispute's "worker" is the Sipalu.
  const party = (p: string) =>
    p === "worker" ? tm("evidence.party.sipalu") : p === "ghardhani" ? tm("evidence.party.ghardhani") : tm(`evidence.party.${p}`);
  return (
    <section aria-labelledby="dispute-title" className="border-danger rounded-card border-2 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="dispute-title" className="text-fg flex items-center gap-2 text-base font-bold">
          <Scale className="text-danger size-5" aria-hidden />
          {t("title")}
        </h2>
        <Badge tone={TONE[d.status] ?? "neutral"}>{d.status_label}</Badge>
      </div>
      <p className="text-fg-muted mt-1 text-sm">{t("raised_on", { when: f.dateTime(d.raised_at) })}</p>
      <p className="text-fg-body mt-3 whitespace-pre-line">{disputeText(d.description)}</p>
      {d.status === "open" || d.status === "employer_responded" ? (
        <p className="text-fg-muted mt-2 text-sm">{t("open_body", { name })}</p>
      ) : null}
      {d.resolution_note ? (
        <div className="bg-surface-muted mt-3 rounded-dense px-4 py-3">
          <p className="text-fg-muted text-xs font-semibold">{t("decision")}</p>
          <p className="text-fg mt-1 text-sm whitespace-pre-line">{d.resolution_note}</p>
        </div>
      ) : null}
      {d.appeal ? (
        <AppealBlock appeal={d.appeal} partyLabel={(p) => (p === "worker" ? tm("appeal.party.sipalu") : tm(`appeal.party.${p}`))} />
      ) : null}
      {d.can_appeal ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setAppealing(true)}>
            {tm("appeal.title")}
          </Button>
          {d.appeal_deadline ? (
            <span className="text-fg-muted text-sm">{t("appeal_until", { when: f.dateTime(d.appeal_deadline) })}</span>
          ) : null}
        </div>
      ) : null}
      <EvidencePanel dispute={d} scope="ghar" partyLabel={party} />
      <AppealDialog dispute={appealing ? d : null} onClose={() => setAppealing(false)} scope="ghar" />
    </section>
  );
}
