"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { DialogDescription, DialogTitle, Sheet, SheetContent } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { useTimesheetPolicy, useUpdateTimesheetPolicy } from "@/lib/api/hooks/timesheets";
import { toLatinDigits } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { hoursToMinutes, minutesToHours } from "./utils";

/** Owner/admin/HR: overtime approval rule, weekly OT cap and regular day length. */
export function PolicyDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("timesheets");
  const tAll = useTranslations();
  const { data, isLoading, error, refetch } = useTimesheetPolicy();
  const save = useUpdateTimesheetPolicy();
  const [requires, setRequires] = React.useState(false);
  const [cap, setCap] = React.useState("24");
  const [daily, setDaily] = React.useState("8");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open && data) {
      setRequires(data.ot_requires_approval);
      setCap(String(minutesToHours(data.weekly_ot_cap_minutes)));
      setDaily(String(minutesToHours(data.daily_regular_minutes)));
      setFieldErrors({});
    }
  }, [open, data]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const capMin = hoursToMinutes(toLatinDigits(cap));
    const dailyMin = hoursToMinutes(toLatinDigits(daily));
    const errs: Record<string, string> = {};
    if (Number.isNaN(capMin)) errs.weekly_ot_cap_minutes = tAll("errors.validation_error");
    if (Number.isNaN(dailyMin)) errs.daily_regular_minutes = tAll("errors.validation_error");
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate(
      { ot_requires_approval: requires, weekly_ot_cap_minutes: capMin, daily_regular_minutes: dailyMin },
      {
        onSuccess: () => {
          toast.success(t("policy_saved"));
          onOpenChange(false);
        },
        onError: (er) => {
          if (isApiError(er) && er.fields && Object.keys(er.fields).length) {
            setFieldErrors(Object.fromEntries(Object.entries(er.fields).map(([k, v]) => [k, v[0]])));
          } else toastError(er, tAll);
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tAll("common.close")} className="max-w-md">
        <form onSubmit={submit} className="flex h-full flex-col">
          <div className="space-y-1 border-b border-border px-6 pt-5 pb-4 pr-14">
            <DialogTitle className="text-lg font-semibold text-fg">{t("policy_title")}</DialogTitle>
            <DialogDescription className="text-sm text-fg-muted">{t("policy_desc")}</DialogDescription>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : error ? (
              <ErrorState error={error} onRetry={() => void refetch()} />
            ) : (
              <>
                <SwitchField
                  id="ts-requires-approval"
                  label={t("policy_requires_approval")}
                  description={t("policy_requires_approval_desc")}
                  checked={requires}
                  onCheckedChange={setRequires}
                />
                <Field id="ts-cap" label={t("policy_cap")} hint={t("policy_cap_hint")} error={fieldErrors.weekly_ot_cap_minutes}>
                  <Input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
                </Field>
                <Field id="ts-daily" label={t("policy_daily")} hint={t("policy_daily_hint")} error={fieldErrors.daily_regular_minutes}>
                  <Input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
                </Field>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!data}>
              {t("save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
