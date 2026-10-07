"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useCreateShift, useDeleteShift, useShifts, useUpdateShift } from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import type { Shift } from "@/lib/api/types";
import { handleFormError, toastError } from "@/lib/forms";
import { toLatinDigits } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, PrefixInput } from "@/components/ui/input";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";

/** Working minutes of a shift (handles overnight shifts). */
function workMinutes(s: Pick<Shift, "start_time" | "end_time" | "break_minutes">): number {
  const toMin = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let span = toMin(s.end_time) - toMin(s.start_time);
  if (span <= 0) span += 24 * 60;
  return Math.max(0, span - (s.break_minutes || 0));
}

export function ShiftsTab() {
  const t = useTranslations();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useShifts();
  const shifts = listResults(data);
  const del = useDeleteShift();
  const [editing, setEditing] = React.useState<Shift | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Shift | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-fg-muted">{t("settings.shifts_intro")}</p>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("settings.add_shift")}
        </Button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={t("settings.shifts_empty")}
          description={t("settings.shifts_empty_body")}
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {t("settings.add_shift")}
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("common.name")}</Th>
                <Th>{t("settings.timing")}</Th>
                <Th numeric className="max-sm:hidden">
                  {t("settings.break")}
                </Th>
                <Th numeric className="max-sm:hidden">
                  {t("settings.work_hours")}
                </Th>
                <Th className="w-24">
                  <span className="sr-only">{t("common.actions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {shifts.map((s) => (
                <Tr key={s.id}>
                  <RowHeader>{s.name}</RowHeader>
                  <Td className="whitespace-nowrap tabular">
                    {f.clock(s.start_time)} – {f.clock(s.end_time)}
                  </Td>
                  <Td numeric className="max-sm:hidden">
                    {t("settings.minutes", { count: s.break_minutes })}
                  </Td>
                  <Td numeric className="max-sm:hidden">
                    {f.number(Math.round((workMinutes(s) / 60) * 10) / 10)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(s)}
                        aria-label={`${t("common.edit")} ${s.name}`}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(s)}
                        aria-label={`${t("common.delete")} ${s.name}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {editing ? <ShiftDialog shift={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("settings.delete_shift_title")}
        description={t("settings.delete_shift_body", { name: deleting?.name ?? "" })}
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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function ShiftDialog({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const t = useTranslations();
  const create = useCreateShift();
  const update = useUpdateShift();
  const [formError, setFormError] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("errors.required")),
        start_time: z.string().regex(TIME_RE, t("errors.required")),
        end_time: z.string().regex(TIME_RE, t("errors.required")),
        break_minutes: z
          .string()
          .transform((v) => toLatinDigits(v).trim())
          .refine((v) => /^\d+$/.test(v) && Number(v) <= 240, t("settings.break_invalid")),
      }),
    [t],
  );
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: shift?.name ?? "",
      start_time: shift?.start_time.slice(0, 5) ?? "07:00",
      end_time: shift?.end_time.slice(0, 5) ?? "16:00",
      break_minutes: String(shift?.break_minutes ?? 60),
    },
  });
  const { register, handleSubmit, formState } = form;
  const errors = formState.errors;
  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const body = {
      name: v.name,
      start_time: v.start_time,
      end_time: v.end_time,
      break_minutes: Number(v.break_minutes),
    };
    const opts = {
      onSuccess: () => {
        toast.success(shift ? t("common.changes_saved") : t("settings.shift_created"));
        onClose();
      },
      onError: (err: unknown) =>
        setFormError(
          handleFormError(err, form.setError, t, {
            fields: ["name", "start_time", "end_time", "break_minutes"],
            toast: false,
          }),
        ),
    };
    if (shift) update.mutate({ id: shift.id, ...body }, opts);
    else create.mutate(body, opts);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <DialogHeader title={shift ? t("settings.edit_shift") : t("settings.add_shift")} />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            <Field id="shift-name" label={t("settings.shift_name")} hint={t("settings.shift_name_hint")} error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="shift-start" label={t("settings.start_time")} error={errors.start_time?.message}>
                <Input type="time" className="tabular" {...register("start_time")} />
              </Field>
              <Field id="shift-end" label={t("settings.end_time")} error={errors.end_time?.message}>
                <Input type="time" className="tabular" {...register("end_time")} />
              </Field>
            </div>
            <Field id="shift-break" label={t("settings.break")} error={errors.break_minutes?.message}>
              <PrefixInput prefix={t("settings.min_short")} inputMode="numeric" {...register("break_minutes")} />
            </Field>
            <FormError message={formError} />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {shift ? t("common.save_changes") : t("settings.add_shift")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
