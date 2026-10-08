"use client";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useApproveTimesheet, useRejectTimesheet } from "@/lib/api/hooks/timesheets";
import type { Timesheet } from "@/lib/api/types-timesheets";
import { toLatinDigits } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { hoursToMinutes, minutesToHours } from "./utils";

export function ApproveDialog({
  timesheet,
  requiresApproval,
  capHours,
  onOpenChange,
}: {
  timesheet: Timesheet | null;
  requiresApproval: boolean;
  capHours: number;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("timesheets");
  const tAll = useTranslations();
  const f = useFormat();
  const approve = useApproveTimesheet();
  const [hours, setHours] = React.useState("");
  const [err, setErr] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (timesheet) {
      setHours(String(minutesToHours(timesheet.overtime_minutes_claimed)));
      setErr(undefined);
    }
  }, [timesheet]);

  if (!timesheet) return null;
  const claimedH = minutesToHours(timesheet.overtime_minutes_claimed);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!timesheet) return;
    const minutes = Math.min(hoursToMinutes(toLatinDigits(hours || "0")), timesheet.overtime_minutes_claimed);
    if (Number.isNaN(minutes)) {
      setErr(tAll("errors.validation_error"));
      return;
    }
    approve.mutate(
      { id: timesheet.id, overtime_minutes_approved: minutes },
      {
        onSuccess: () => {
          toast.success(t("approved_toast"));
          onOpenChange(false);
        },
        onError: (er) => toastError(er, tAll),
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm" closeLabel={tAll("common.close")}>
        <form onSubmit={submit}>
          <DialogHeader
            title={t("approve_title")}
            description={t("approve_desc", { name: timesheet.worker.full_name, week: f.date(timesheet.week_start).bs })}
          />
          <DialogBody className="space-y-4">
            {timesheet.over_cap ? (
              <p role="note" className="flex items-start gap-2 rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("over_cap_hint", { h: f.number(capHours) })}
              </p>
            ) : null}
            <Field
              id="ts-ot-approved"
              label={t("approve_ot_label")}
              hint={t("approve_ot_hint", { h: f.number(claimedH) })}
              error={err}
            >
              <Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
            {requiresApproval ? <p className="text-xs text-fg-muted">{t("approve_payroll_note")}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={approve.isPending}>
              {t("approve")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({
  timesheet,
  onOpenChange,
}: {
  timesheet: Timesheet | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("timesheets");
  const tAll = useTranslations();
  const f = useFormat();
  const reject = useRejectTimesheet();
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | undefined>();

  React.useEffect(() => {
    setNote("");
    setErr(undefined);
  }, [timesheet]);

  if (!timesheet) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!timesheet) return;
    if (!note.trim()) {
      setErr(tAll("errors.validation_error"));
      return;
    }
    reject.mutate(
      { id: timesheet.id, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t("rejected_toast"));
          onOpenChange(false);
        },
        onError: (er) => toastError(er, tAll),
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm" closeLabel={tAll("common.close")}>
        <form onSubmit={submit}>
          <DialogHeader
            title={t("reject_title")}
            description={t("approve_desc", { name: timesheet.worker.full_name, week: f.date(timesheet.week_start).bs })}
          />
          <DialogBody>
            <Field id="ts-reject-note" label={t("reject_note")} hint={t("reject_note_hint")} error={err}>
              <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={reject.isPending}>
              {t("reject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
