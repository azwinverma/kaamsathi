"use client";
import * as React from "react";
import { CalendarDays, ClipboardCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BsDatePicker, DateText } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Sheet,
  SheetContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton, errorMessage } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { isApiError } from "@/lib/api/errors";
import {
  useCourseSessions,
  useDeleteSession,
  useSaveSession,
  useSaveSessionAttendance,
  useSessionAttendance,
} from "@/lib/api/hooks/training";
import type { Course, SessionInput, TrainingSession } from "@/lib/api/types-training";
import { toastError } from "@/lib/forms";
import { todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { toTimeInput } from "./utils";

/** T006 — per-course sessions drawer: list / add / edit / delete, and the attendance sheet. */
export function CourseSessionsSheet({
  course,
  onClose,
}: {
  course: Course | null;
  onClose: () => void;
}) {
  const t = useTranslations("training.sessions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const f = useFormat();
  const courseId = course?.id ?? "";
  const query = useCourseSessions(course?.id ?? null);
  const del = useDeleteSession(courseId);
  const [editing, setEditing] = React.useState<TrainingSession | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<TrainingSession | null>(null);
  const [marking, setMarking] = React.useState<TrainingSession | null>(null);
  const sessions = query.data ?? [];

  return (
    <Sheet open={!!course} onOpenChange={(v) => !v && onClose()}>
      <SheetContent closeLabel={tc("close")} className="max-w-2xl">
        <div className="border-border space-y-1 border-b px-6 pt-5 pr-14 pb-4">
          <DialogTitle className="text-fg text-lg font-semibold">{t("title")}</DialogTitle>
          <DialogDescription className="text-fg-muted text-sm">
            {course?.title}
            {course?.min_attendance_pct
              ? ` · ${t("min_attendance", { pct: f.digits(course.min_attendance_pct) })}`
              : ""}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex justify-end">
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </div>
          {query.isLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t("empty_title")}
              description={t("empty_body")}
            />
          ) : (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <Th>{t("date")}</Th>
                    <Th>{t("time")}</Th>
                    <Th>{t("topic")}</Th>
                    <Th numeric>{t("present")}</Th>
                    <Th className="text-right">{tc("actions")}</Th>
                  </tr>
                </THead>
                <TBody>
                  {sessions.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <DateText ad={s.date} bs={s.date_bs} />
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {s.start_time || s.end_time
                          ? `${f.clock(s.start_time)}–${f.clock(s.end_time)}`
                          : "—"}
                      </Td>
                      <Td className="max-w-48">
                        <span className="line-clamp-2">{s.topic || "—"}</span>
                      </Td>
                      <Td numeric>{f.digits(s.present_count ?? 0)}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setMarking(s)}
                            aria-label={t("mark_for", { date: f.dateText(s.date, s.date_bs) })}
                          >
                            <ClipboardCheck aria-hidden />
                            {t("attendance")}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditing(s)}
                            aria-label={t("edit_for", { date: f.dateText(s.date, s.date_bs) })}
                            title={tc("edit")}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setDeleting(s)}
                            aria-label={t("delete_for", { date: f.dateText(s.date, s.date_bs) })}
                            title={tc("delete")}
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
        </div>
        {course ? (
          <>
            <SessionDialog
              courseId={course.id}
              session={editing}
              onClose={() => setEditing(null)}
            />
            <AttendanceDialog
              courseId={course.id}
              session={marking}
              onClose={() => setMarking(null)}
            />
          </>
        ) : null}
        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(v) => !v && setDeleting(null)}
          title={tc("are_you_sure")}
          description={
            deleting
              ? t("delete_confirm", { date: f.dateText(deleting.date, deleting.date_bs) })
              : undefined
          }
          confirmLabel={tc("delete")}
          danger
          loading={del.isPending}
          onConfirm={() =>
            deleting &&
            del.mutate(deleting.id, {
              onSuccess: () => {
                toast.success(t("deleted"));
                setDeleting(null);
              },
              onError: (e) => {
                toastError(e, tRoot);
                setDeleting(null);
              },
            })
          }
        />
      </SheetContent>
    </Sheet>
  );
}

function SessionDialog({
  courseId,
  session,
  onClose,
}: {
  courseId: string;
  session: TrainingSession | "new" | null;
  onClose: () => void;
}) {
  const t = useTranslations("training.sessions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const save = useSaveSession(courseId);
  const open = session !== null;
  const existing = session && session !== "new" ? session : null;
  const [form, setForm] = React.useState({ date: todayIso(), start: "", end: "", topic: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setForm(
      existing
        ? {
            date: existing.date,
            start: toTimeInput(existing.start_time),
            end: toTimeInput(existing.end_time),
            topic: existing.topic ?? "",
          }
        : { date: todayIso(), start: "", end: "", topic: "" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = t("date_required");
    if (form.start && form.end && form.end <= form.start) errs.end_time = t("end_after_start");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: SessionInput = {
      date: form.date,
      start_time: form.start || null,
      end_time: form.end || null,
      topic: form.topic.trim() || null,
    };
    save.mutate(
      { ...body, id: existing?.id },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fields).length) {
            const fe: Record<string, string> = {};
            for (const [k, v] of Object.entries(err.fields)) fe[k] = v[0];
            setErrors(fe);
            if (!fe.date && !fe.start_time && !fe.end_time && !fe.topic)
              setFormError(errorMessage(err, tRoot));
          } else setFormError(errorMessage(err, tRoot));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" closeLabel={tc("close")}>
        <DialogHeader title={existing ? t("edit") : t("add")} />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <Field id="ss-date" label={t("date")} error={errors.date}>
              <BsDatePicker
                value={form.date}
                onChange={(v) => setForm((s) => ({ ...s, date: v }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="ss-start"
                label={t("start_time")}
                error={errors.start_time}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  type="time"
                  className="tabular"
                  value={form.start}
                  onChange={(e) => setForm((s) => ({ ...s, start: e.target.value }))}
                />
              </Field>
              <Field
                id="ss-end"
                label={t("end_time")}
                error={errors.end_time}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  type="time"
                  className="tabular"
                  value={form.end}
                  onChange={(e) => setForm((s) => ({ ...s, end: e.target.value }))}
                />
              </Field>
            </div>
            <Field
              id="ss-topic"
              label={t("topic")}
              error={errors.topic}
              optional
              optionalLabel={tc("optional")}
            >
              <Input
                value={form.topic}
                maxLength={200}
                onChange={(e) => setForm((s) => ({ ...s, topic: e.target.value }))}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceDialog({
  courseId,
  session,
  onClose,
}: {
  courseId: string;
  session: TrainingSession | null;
  onClose: () => void;
}) {
  const t = useTranslations("training.sessions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const f = useFormat();
  const query = useSessionAttendance(session?.id ?? null);
  const save = useSaveSessionAttendance(session?.id ?? "", courseId);
  const [marks, setMarks] = React.useState<Record<string, boolean>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const rows = query.data?.rows ?? [];

  React.useEffect(() => {
    if (!query.data) return;
    setMarks(Object.fromEntries(query.data.rows.map((r) => [r.enrollment_id, !!r.present])));
    setFormError(null);
  }, [query.data]);

  const presentCount = rows.filter((r) => marks[r.enrollment_id]).length;
  const allChecked = rows.length > 0 && presentCount === rows.length;

  const submit = () => {
    setFormError(null);
    save.mutate(
      rows.map((r) => ({ enrollment_id: r.enrollment_id, present: !!marks[r.enrollment_id] })),
      {
        onSuccess: () => {
          toast.success(t("attendance_saved", { count: presentCount }));
          onClose();
        },
        onError: (err) => setFormError(errorMessage(err, tRoot)),
      },
    );
  };

  return (
    <Dialog open={!!session} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" closeLabel={tc("close")}>
        <DialogHeader
          title={t("attendance_title")}
          description={
            session
              ? [f.dateText(session.date, session.date_bs), session.topic]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
        />
        <DialogBody className="space-y-3">
          <FormError message={formError} />
          {query.isLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title={t("no_enrolled_title")} description={t("no_enrolled_body")} />
          ) : (
            <fieldset>
              <legend className="sr-only">{t("attendance_title")}</legend>
              <label className="border-border text-fg flex items-center gap-3 border-b pb-2 text-sm font-medium">
                <Checkbox
                  checked={allChecked ? true : presentCount ? "indeterminate" : false}
                  onCheckedChange={(v) =>
                    setMarks(Object.fromEntries(rows.map((r) => [r.enrollment_id, v === true])))
                  }
                  aria-label={t("mark_all")}
                />
                {t("mark_all")}
                <span className="text-fg-muted tabular ml-auto text-xs font-normal">
                  {t("present_of", {
                    present: f.digits(presentCount),
                    total: f.digits(rows.length),
                  })}
                </span>
              </label>
              <ul className="divide-border divide-y">
                {rows.map((r) => (
                  <li key={r.enrollment_id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                      <Checkbox
                        checked={!!marks[r.enrollment_id]}
                        onCheckedChange={(v) =>
                          setMarks((m) => ({ ...m, [r.enrollment_id]: v === true }))
                        }
                        aria-label={t("present_for", { name: r.worker.full_name })}
                      />
                      <span className="text-fg">{r.worker.full_name}</span>
                      {r.present === null ? (
                        <span className="text-fg-muted ml-auto text-xs">{t("not_marked")}</span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={!rows.length}>
            {t("save_attendance")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
