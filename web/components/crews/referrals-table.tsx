"use client";
import * as React from "react";
import { Ban, Banknote, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateText, Money } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { isApiError } from "@/lib/api/errors";
import { useMarkReferralPaid, useVoidReferral } from "@/lib/api/hooks/crews";
import type { CrewReferral, CrewReferralStatus } from "@/lib/api/types-crews";
import { useFormat } from "@/lib/use-format";

export const REFERRAL_TONE: Record<CrewReferralStatus, BadgeTone> = {
  pending: "warning",
  eligible: "brand",
  paid: "success",
  void: "neutral",
};

export function ReferralStatusBadge({ referral }: { referral: Pick<CrewReferral, "status" | "status_label"> }) {
  const t = useTranslations("crews.referral_status");
  return (
    <Badge tone={REFERRAL_TONE[referral.status] ?? "neutral"} dot>
      {referral.status_label || t(referral.status)}
    </Badge>
  );
}

/** Referral rows with ops actions (mark paid / void). */
export function ReferralsTable({
  rows,
  showCrew = true,
  className,
}: {
  rows: CrewReferral[];
  showCrew?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const tc = useTranslations("crews");
  const f = useFormat();
  const [paying, setPaying] = React.useState<CrewReferral | null>(null);
  const [voiding, setVoiding] = React.useState<CrewReferral | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={HandCoins} title={tc("referrals.empty_title")} description={tc("referrals.empty_body")} />;
  }
  return (
    <>
      <TableContainer className={className}>
        <Table className="min-w-[860px]">
          <THead>
            <Tr>
              <Th sticky>{tc("referrals.col_worker")}</Th>
              {showCrew ? <Th>{tc("referrals.col_crew")}</Th> : null}
              <Th>{tc("referrals.col_employer")}</Th>
              <Th>{tc("referrals.col_joined")}</Th>
              <Th>{tc("referrals.col_hold_until")}</Th>
              <Th numeric>{t("common.amount")}</Th>
              <Th>{t("common.status")}</Th>
              <Th className="text-right">{t("common.actions")}</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <RowHeader sticky>
                  <span className="block">{r.worker.full_name}</span>
                  <span className="block text-xs font-normal text-fg-muted tabular">{r.worker.phone_masked}</span>
                </RowHeader>
                {showCrew ? <Td>{r.crew.name}</Td> : null}
                <Td>
                  <span className="block">{r.organization.name}</span>
                  <span className="block text-xs text-fg-muted">{r.job.title}</span>
                </Td>
                <Td>
                  <DateText ad={r.start_date} bs={r.start_date_bs} />
                </Td>
                <Td>
                  <DateText ad={r.hold_until} bs={r.hold_until_bs} />
                </Td>
                <Td numeric>
                  <Money value={r.amount} />
                </Td>
                <Td>
                  <ReferralStatusBadge referral={r} />
                  {r.status === "paid" && r.payout_ref ? (
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {tc("referrals.paid_ref", { ref: r.payout_ref, date: f.dateTime(r.paid_at) })}
                    </span>
                  ) : null}
                  {r.status === "void" && r.void_reason ? (
                    <span className="mt-0.5 block max-w-48 text-xs text-fg-muted">{r.void_reason}</span>
                  ) : null}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    {r.status === "eligible" ? (
                      <Button size="sm" onClick={() => setPaying(r)} aria-label={tc("referrals.mark_paid_for", { name: r.worker.full_name })}>
                        <Banknote aria-hidden />
                        {tc("referrals.mark_paid")}
                      </Button>
                    ) : null}
                    {r.status === "pending" || r.status === "eligible" ? (
                      <Button
                        size="sm"
                        variant="danger-outline"
                        onClick={() => setVoiding(r)}
                        aria-label={tc("referrals.void_for", { name: r.worker.full_name })}
                      >
                        <Ban aria-hidden />
                        {tc("referrals.void")}
                      </Button>
                    ) : null}
                    {r.status === "paid" || r.status === "void" ? <span className="text-xs text-fg-subtle">—</span> : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      <MarkPaidDialog referral={paying} onClose={() => setPaying(null)} />
      <VoidDialog referral={voiding} onClose={() => setVoiding(null)} />
    </>
  );
}

function MarkPaidDialog({ referral, onClose }: { referral: CrewReferral | null; onClose: () => void }) {
  const t = useTranslations();
  const tc = useTranslations("crews.referrals");
  const f = useFormat();
  const mutation = useMarkReferralPaid();
  const [ref, setRef] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setRef("");
    setError(null);
  }, [referral]);
  if (!referral) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref.trim()) {
      setError(t("errors.required"));
      return;
    }
    mutation.mutate(
      { id: referral.id, payout_ref: ref.trim() },
      {
        onSuccess: () => {
          toast.success(tc("paid_toast", { name: referral.crew.name }));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!referral} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={tc("mark_paid_title")}
            description={tc("mark_paid_description", { amount: f.money(referral.amount), crew: referral.crew.name })}
          />
          <DialogBody className="space-y-4">
            <FormError message={error} />
            <Field id="payout-ref" label={tc("payout_ref")} hint={tc("payout_ref_hint")}>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} autoComplete="off" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {tc("mark_paid")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({ referral, onClose }: { referral: CrewReferral | null; onClose: () => void }) {
  const t = useTranslations();
  const tc = useTranslations("crews.referrals");
  const mutation = useVoidReferral();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason("");
    setError(null);
  }, [referral]);
  if (!referral) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("errors.required"));
      return;
    }
    mutation.mutate(
      { id: referral.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(tc("void_toast"));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!referral} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={tc("void_title")} description={referral.worker.full_name} />
          <DialogBody className="space-y-4">
            <FormError message={error} />
            <Field id="void-reason" label={tc("void_reason")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} rows={3} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={mutation.isPending}>
              {tc("void")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
