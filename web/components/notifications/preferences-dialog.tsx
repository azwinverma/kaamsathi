"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  type JobAlertFrequency,
  type NotificationPreferences,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/lib/api/hooks/notifications";
import { toastError } from "@/lib/forms";

const FREQS: JobAlertFrequency[] = ["instant", "daily", "weekly", "off"];

export function PreferencesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("notifications.prefs");
  const tAll = useTranslations();
  const { data, isLoading, error, refetch } = useNotificationPreferences(open);
  const save = useUpdateNotificationPreferences();
  const [form, setForm] = React.useState<NotificationPreferences | null>(null);

  React.useEffect(() => {
    if (open && data) setForm(data);
  }, [open, data]);

  const set = <K extends keyof NotificationPreferences>(k: K, v: NotificationPreferences[K]) =>
    setForm((cur) => (cur ? { ...cur, [k]: v } : cur));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    save.mutate(
      { ...form, quiet_hours_start: form.quiet_hours_start || null, quiet_hours_end: form.quiet_hours_end || null },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onOpenChange(false);
        },
        onError: (er) => toastError(er, tAll),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit}>
          <DialogHeader title={t("title")} description={t("description")} />
          <DialogBody className="space-y-3">
            {isLoading || (!form && !error) ? (
              <Skeleton className="h-60" />
            ) : error || !form ? (
              <ErrorState error={error} onRetry={() => void refetch()} />
            ) : (
              <>
                <SwitchField id="np-sms" label={t("sms")} description={t("sms_desc")} checked={form.sms_enabled} onCheckedChange={(v) => set("sms_enabled", v)} />
                <SwitchField id="np-push" label={t("push")} description={t("push_desc")} checked={form.push_enabled} onCheckedChange={(v) => set("push_enabled", v)} />
                <SwitchField id="np-email" label={t("email")} description={t("email_desc")} checked={form.email_enabled} onCheckedChange={(v) => set("email_enabled", v)} />
                <SwitchField id="np-mkt" label={t("marketing")} description={t("marketing_desc")} checked={form.marketing_opt_in} onCheckedChange={(v) => set("marketing_opt_in", v)} />
                <Field id="np-freq" label={t("job_alerts")}>
                  <Select
                    value={form.job_alert_frequency}
                    onValueChange={(v) => set("job_alert_frequency", v as JobAlertFrequency)}
                    options={FREQS.map((x) => ({ value: x, label: t(`freq.${x}`) }))}
                  />
                </Field>
                <fieldset className="space-y-2 pt-1">
                  <legend className="text-sm font-medium text-fg">{t("quiet")}</legend>
                  <p className="text-xs text-fg-muted">{t("quiet_desc")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="np-qs" label={t("quiet_from")}>
                      <Input type="time" value={form.quiet_hours_start ?? ""} onChange={(e) => set("quiet_hours_start", e.target.value || null)} />
                    </Field>
                    <Field id="np-qe" label={t("quiet_to")}>
                      <Input type="time" value={form.quiet_hours_end ?? ""} onChange={(e) => set("quiet_hours_end", e.target.value || null)} />
                    </Field>
                  </div>
                </fieldset>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!form}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
