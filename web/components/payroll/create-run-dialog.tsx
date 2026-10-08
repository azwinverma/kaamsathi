"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { BsMonthPicker } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { useCreatePayrollRun, usePayGroups } from "@/lib/api/hooks/payroll";
import { isApiError } from "@/lib/api/errors";
import type { PayrollRunListItem } from "@/lib/api/types";
import { todayBs } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { isFestivalMonth } from "./utils";

type YM = { year: number; month: number };

export function CreateRunDialog({
  open,
  onOpenChange,
  existingRuns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRuns: PayrollRunListItem[];
}) {
  const t = useTranslations("payroll_page.create");
  const tAll = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const create = useCreatePayrollRun();
  const tg = useTranslations("payroll_config.run_dialog");
  const groups = usePayGroups();
  const activeGroups = React.useMemo(
    () => (groups.data ?? []).filter((g) => g.is_active),
    [groups.data],
  );
  const [groupId, setGroupId] = React.useState("");
  const current = React.useMemo<YM>(() => {
    const b = todayBs();
    return { year: b.year, month: b.month };
  }, []);
  const [month, setMonth] = React.useState<YM>(current);
  const [festival, setFestival] = React.useState(isFestivalMonth(current.month));
  const [festivalTouched, setFestivalTouched] = React.useState(false);
  const [duplicateOf, setDuplicateOf] = React.useState<YM | null>(null);

  React.useEffect(() => {
    if (open) {
      setMonth(current);
      setFestival(isFestivalMonth(current.month));
      setFestivalTouched(false);
      setDuplicateOf(null);
      setGroupId("");
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // One run per BS month per pay group (R001); "" = everyone not in a group.
  const existing = (ym: YM) =>
    existingRuns.find(
      (r) =>
        r.bs_year === ym.year && r.bs_month === ym.month && (r.pay_group?.id ?? "") === groupId,
    );
  const alreadyExists = existing(month);

  const onMonthChange = (v: YM) => {
    setMonth(v);
    setDuplicateOf(null);
    if (!festivalTouched) setFestival(isFestivalMonth(v.month));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadyExists) {
      setDuplicateOf(month);
      return;
    }
    create.mutate(
      {
        bs_year: month.year,
        bs_month: month.month,
        include_festival_allowance: festival,
        pay_group_id: groupId || null,
      },
      {
        onSuccess: (run) => {
          toast.success(t("created", { month: f.bsMonth(month.year, month.month) }));
          onOpenChange(false);
          if (run?.id) router.push(`/app/payroll/${run.id}`);
        },
        onError: (err) => {
          if (isApiError(err) && err.code === "duplicate") setDuplicateOf(month);
          else toastError(err, tAll);
        },
      },
    );
  };

  const dupRun = duplicateOf ? existing(duplicateOf) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader title={t("title")} description={t("description")} />
          <DialogBody className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <Label id="run-month-label">{t("month")}</Label>
              <div role="group" aria-labelledby="run-month-label">
                <BsMonthPicker value={month} onChange={onMonthChange} max={current} />
              </div>
              <p className="text-fg-muted text-xs">{t("month_hint")}</p>
            </div>

            {activeGroups.length ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run-pay-group">{tg("group")}</Label>
                <NativeSelect
                  id="run-pay-group"
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setDuplicateOf(null);
                  }}
                  options={[
                    { value: "", label: tg("group_none") },
                    ...activeGroups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                />
                <p className="text-fg-muted text-xs">{tg("group_hint")}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <SwitchField
                id="include-festival"
                label={t("festival_label")}
                description={t("festival_description")}
                checked={festival}
                onCheckedChange={(v) => {
                  setFestival(v);
                  setFestivalTouched(true);
                }}
              />
              {isFestivalMonth(month.month) ? (
                <p className="text-brand flex items-start gap-1.5 text-xs">
                  <Sparkles className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t("festival_suggest", { month: f.monthName(month.month) })}
                </p>
              ) : null}
            </div>

            {duplicateOf || alreadyExists ? (
              <div
                role="alert"
                className="border-warning/30 bg-warning-subtle text-warning flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="space-y-1">
                  <p>{t("duplicate", { month: f.bsMonth(month.year, month.month) })}</p>
                  {(dupRun ?? alreadyExists) ? (
                    <Link
                      href={`/app/payroll/${(dupRun ?? alreadyExists)!.id}`}
                      className="font-medium underline underline-offset-2"
                      onClick={() => onOpenChange(false)}
                    >
                      {t("open_existing")}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!!alreadyExists}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
