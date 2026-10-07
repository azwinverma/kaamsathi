"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useCreateHoliday, useDeleteHoliday, useHolidays } from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import type { HolidayListItem } from "@/lib/api/types";
import { handleFormError, toastError } from "@/lib/forms";
import { bsToAd, todayBs, weekdayOf } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BsDatePicker } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";

type Filter = "all" | "national" | "org";

const isNational = (h: HolidayListItem) => h.is_national ?? !h.organization;

export function HolidaysTab() {
  const t = useTranslations();
  const f = useFormat();
  const [year, setYear] = React.useState(() => todayBs().year);
  const [filter, setFilter] = React.useState<Filter>("all");
  const { data, isLoading, error, refetch } = useHolidays(year);
  const del = useDeleteHoliday();
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<HolidayListItem | null>(null);

  const all = listResults(data);
  const rows = all.filter((h) => filter === "all" || (filter === "national" ? isNational(h) : !isNational(h)));
  const counts = { national: all.filter(isNational).length, org: all.filter((h) => !isNational(h)).length };

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-fg-muted">{t("settings.holidays_intro")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-md border border-border-strong bg-surface shadow-sm">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="inline-flex size-10 items-center justify-center rounded-l-md text-fg-muted hover:bg-surface-hover"
              aria-label={t("settings.prev_year")}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="min-w-28 border-x border-border px-3 text-center text-sm leading-10 font-medium text-fg tabular" aria-live="polite">
              {t("settings.bs_year", { year: f.digits(year) })}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="inline-flex size-10 items-center justify-center rounded-r-md text-fg-muted hover:bg-surface-hover"
              aria-label={t("settings.next_year")}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <Segmented<Filter>
            label={t("common.filter")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("common.all") },
              { value: "national", label: `${t("settings.national")} (${f.digits(counts.national)})` },
              { value: "org", label: `${t("settings.org_holiday")} (${f.digits(counts.org)})` },
            ]}
          />
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t("settings.add_holiday")}
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("settings.holidays_empty", { year: f.digits(year) })}
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t("settings.add_holiday")}
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("common.date")}</Th>
                <Th>{t("common.name")}</Th>
                <Th className="max-sm:hidden">{t("settings.holiday_type")}</Th>
                <Th className="w-14">
                  <span className="sr-only">{t("common.actions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((h) => {
                const d = f.date(h.date, h.date_bs);
                const national = isNational(h);
                return (
                  <Tr key={h.id}>
                    <Td className="whitespace-nowrap">
                      <span className="block text-fg tabular">{d.bs}</span>
                      <span className="block text-xs text-fg-muted tabular">
                        {f.weekday(weekdayOf(h.date))} · {d.ad}
                      </span>
                    </Td>
                    <Td>
                      <span className="block font-medium text-fg">{f.name(h)}</span>
                      <Badge tone={national ? "neutral" : "brand"} className="mt-1 sm:hidden">
                        {national ? t("settings.national") : t("settings.org_holiday")}
                      </Badge>
                    </Td>
                    <Td className="max-sm:hidden">
                      <Badge tone={national ? "neutral" : "brand"}>
                        {national ? t("settings.national") : t("settings.org_holiday")}
                      </Badge>
                    </Td>
                    <Td>
                      {!national ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(h)}
                          aria-label={`${t("common.delete")} ${f.name(h)}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {adding ? <HolidayDialog year={year} onClose={() => setAdding(false)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("settings.delete_holiday_title")}
        description={deleting ? t("settings.delete_holiday_body", { name: f.name(deleting) }) : undefined}
        confirmLabel={t("common.delete")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("common.deleted_success"));
              setDeleting(null);
            },
            onError: (e) => toastError(e, t),
          })
        }
      />
    </div>
  );
}

function HolidayDialog({ year, onClose }: { year: number; onClose: () => void }) {
  const t = useTranslations();
  const create = useCreateHoliday();
  const [formError, setFormError] = React.useState<string | null>(null);
  const schema = React.useMemo(
    () =>
      z.object({
        date: z.string().min(1, t("errors.required")),
        name_en: z.string().trim().min(2, t("errors.required")),
        name_ne: z.string().trim().min(1, t("errors.required")),
      }),
    [t],
  );
  type FormValues = z.infer<typeof schema>;
  const current = todayBs();
  const initialDate = year === current.year ? "" : (bsToAd({ year, month: 1, day: 1 }) ?? "");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: initialDate, name_en: "", name_ne: "" },
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    create.mutate(v, {
      onSuccess: () => {
        toast.success(t("settings.holiday_added"));
        onClose();
      },
      onError: (err) =>
        setFormError(
          handleFormError(err, form.setError, t, { fields: ["date", "name_en", "name_ne"], toast: false }),
        ),
    });
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <DialogHeader title={t("settings.add_holiday")} description={t("settings.add_holiday_hint")} />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            <Field id="holiday-date" label={t("common.date")} error={errors.date?.message}>
              <Controller
                control={control}
                name="date"
                render={({ field }) => <BsDatePicker value={field.value} onChange={field.onChange} />}
              />
            </Field>
            <Field id="holiday-name-en" label={t("settings.holiday_name_en")} error={errors.name_en?.message}>
              <Input placeholder={t("settings.holiday_name_en_ph")} {...register("name_en")} />
            </Field>
            <Field id="holiday-name-ne" label={t("settings.holiday_name_ne")} error={errors.name_ne?.message}>
              <Input lang="ne" className="font-nepali" placeholder={t("settings.holiday_name_ne_ph")} {...register("name_ne")} />
            </Field>
            <FormError message={formError} />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t("settings.add_holiday")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
