"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleSlash,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BsDatePicker, DateText } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { isApiError } from "@/lib/api/errors";
import {
  useDeleteInterview,
  useScheduleInterview,
  useUpdateInterview,
} from "@/lib/api/hooks/pipeline";
import type { ApplicationDetail } from "@/lib/api/types";
import {
  INTERVIEW_MODES,
  type Interview,
  type InterviewMode,
  type InterviewOutcome,
} from "@/lib/api/types-pipeline";
import { todayIso } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ktmDateTime } from "./lib";
import { ktmParts } from "./pipeline-lib";

const OUTCOME_TONE: Record<InterviewOutcome, BadgeTone> = {
  pending: "warning",
  passed: "success",
  failed: "danger",
  no_show: "neutral",
};

export function InterviewOutcomeBadge({ outcome }: { outcome: InterviewOutcome }) {
  const t = useTranslations("pipeline.interviews.outcomes");
  return (
    <Badge tone={OUTCOME_TONE[outcome] ?? "neutral"} dot>
      {t(outcome)}
    </Badge>
  );
}

/** L010 interview rounds inside the application drawer. */
export function InterviewsSection({ app }: { app: ApplicationDetail }) {
  const ti = useTranslations("pipeline.interviews");
  const rounds = React.useMemo(
    () => [...(app.interviews ?? [])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [app.interviews],
  );
  const canSchedule = app.stage === "shortlisted" || app.stage === "interview";
  const [editing, setEditing] = React.useState<Interview | "new" | null>(null);

  return (
    <div className="space-y-3">
      {rounds.length ? (
        <ol className="space-y-2">
          {rounds.map((iv, i) => (
            <InterviewRow
              key={iv.id}
              interview={iv}
              round={i + 1}
              onReschedule={() => setEditing(iv)}
            />
          ))}
        </ol>
      ) : (
        <p className="text-fg-muted text-sm">{canSchedule ? ti("empty") : ti("not_allowed")}</p>
      )}
      {canSchedule ? (
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <CalendarPlus aria-hidden />
          {ti("schedule")}
        </Button>
      ) : null}
      <InterviewFormDialog
        applicationId={app.id}
        interview={editing && editing !== "new" ? editing : null}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

function InterviewRow({
  interview: iv,
  round,
  onReschedule,
}: {
  interview: Interview;
  round: number;
  onReschedule: () => void;
}) {
  const t = useTranslations();
  const ti = useTranslations("pipeline.interviews");
  const f = useFormat();
  const update = useUpdateInterview();
  const del = useDeleteInterview();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const parts = ktmParts(iv.scheduled_at);
  const pending = iv.outcome === "pending";

  const setOutcome = (outcome: InterviewOutcome) =>
    update.mutate(
      { id: iv.id, applicationId: iv.application_id, outcome },
      {
        onSuccess: () => toast.success(ti("outcome_saved")),
        onError: (e) => toastError(e, t),
      },
    );

  return (
    <li
      className={cn(
        "border-border rounded-dense border p-3",
        (update.isPending || del.isPending) && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-fg text-sm font-semibold">
              {ti("round", { n: f.digits(round) })}
            </span>
            <InterviewOutcomeBadge outcome={iv.outcome} />
            <Badge tone="outline">{ti(`modes.${iv.mode}`)}</Badge>
          </div>
          <p className="text-fg-body flex flex-wrap items-center gap-x-2 text-sm">
            <CalendarClock className="text-fg-muted size-3.5" aria-hidden />
            <DateText ad={parts?.date} bs={iv.scheduled_at_bs} inline />
            <span className="text-fg-muted text-xs">{parts ? f.date(parts.date).ad : null}</span>
            <span className="tabular">{f.time(iv.scheduled_at)}</span>
          </p>
          {iv.location ? (
            <p className="text-fg-muted flex items-center gap-1 text-xs">
              <MapPin className="size-3.5" aria-hidden />
              {iv.location}
            </p>
          ) : null}
          {iv.interviewer_name ? (
            <p className="text-fg-muted flex items-center gap-1 text-xs">
              <UserRound className="size-3.5" aria-hidden />
              {ti("interviewer_named", { name: iv.interviewer_name })}
            </p>
          ) : null}
          {iv.notes ? <p className="text-fg-body text-xs whitespace-pre-line">{iv.notes}</p> : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={ti("actions_for", { n: f.digits(round) })}
              disabled={update.isPending || del.isPending}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{ti("set_outcome")}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => setOutcome("passed")}
              disabled={iv.outcome === "passed"}
            >
              <CheckCircle2 aria-hidden />
              {ti("outcomes.passed")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setOutcome("failed")}
              disabled={iv.outcome === "failed"}
            >
              <XCircle aria-hidden />
              {ti("outcomes.failed")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setOutcome("no_show")}
              disabled={iv.outcome === "no_show"}
            >
              <CircleSlash aria-hidden />
              {ti("outcomes.no_show")}
            </DropdownMenuItem>
            {!pending ? (
              <DropdownMenuItem onSelect={() => setOutcome("pending")}>
                <CalendarClock aria-hidden />
                {ti("outcomes.pending")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReschedule}>
              <Pencil aria-hidden />
              {ti("reschedule")}
            </DropdownMenuItem>
            {pending ? (
              <DropdownMenuItem danger onSelect={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
                {t("common.delete")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={ti("delete_title")}
        description={ti("delete_body")}
        confirmLabel={t("common.delete")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(
            { id: iv.id, applicationId: iv.application_id },
            {
              onSuccess: () => {
                toast.success(ti("deleted_toast"));
                setConfirmDelete(false);
              },
              onError: (e) => toastError(e, t),
            },
          )
        }
      />
    </li>
  );
}

type Draft = {
  date: string;
  time: string;
  mode: InterviewMode;
  location: string;
  interviewer_name: string;
  notes: string;
};
type DraftErrors = Partial<Record<keyof Draft | "scheduled_at", string>>;

function InterviewFormDialog({
  applicationId,
  interview,
  open,
  onOpenChange,
}: {
  applicationId: string;
  interview: Interview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const ti = useTranslations("pipeline.interviews");
  const create = useScheduleInterview();
  const update = useUpdateInterview();
  const pending = create.isPending || update.isPending;
  const [draft, setDraft] = React.useState<Draft>(() => blank());
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    if (interview) {
      const p = ktmParts(interview.scheduled_at);
      setDraft({
        date: p?.date ?? "",
        time: p?.time ?? "10:00",
        mode: interview.mode,
        location: interview.location ?? "",
        interviewer_name: interview.interviewer_name ?? "",
        notes: interview.notes ?? "",
      });
    } else {
      setDraft(blank());
    }
  }, [open, interview]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!draft.date || !draft.time) {
      setErrors({ date: ti("date_required") });
      return;
    }
    setErrors({});
    const body = {
      scheduled_at: ktmDateTime(draft.date, draft.time),
      mode: draft.mode,
      location: draft.location.trim(),
      interviewer_name: draft.interviewer_name.trim(),
      notes: draft.notes.trim(),
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && Object.keys(err.fields).length) {
        const fe: DraftErrors = {};
        const rest: string[] = [];
        for (const [k, msgs] of Object.entries(err.fields)) {
          if (k === "scheduled_at") fe.date = msgs[0];
          else if (k === "mode" || k === "location" || k === "interviewer_name" || k === "notes")
            fe[k] = msgs[0];
          else rest.push(msgs[0]);
        }
        setErrors(fe);
        if (rest.length) setFormError(rest.join(" "));
      } else if (isApiError(err)) {
        setFormError(err.message || t(`errors.${err.code}`));
      } else {
        setFormError(t("errors.server_error"));
      }
    };
    const onSuccess = () => {
      toast.success(interview ? ti("updated_toast") : ti("scheduled_toast"));
      onOpenChange(false);
    };
    if (interview) {
      update.mutate({ id: interview.id, applicationId, ...body }, { onSuccess, onError });
    } else {
      create.mutate({ applicationId, ...body }, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <DialogHeader
          title={interview ? ti("reschedule_title") : ti("schedule_title")}
          description={interview ? undefined : ti("schedule_hint")}
        />
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <Field id="iv-date" label={ti("date")} error={errors.date}>
                <BsDatePicker
                  value={draft.date}
                  onChange={(v) => set("date", v)}
                  min={interview ? undefined : todayIso()}
                />
              </Field>
              <Field id="iv-time" label={ti("time")} error={errors.time}>
                <Input
                  type="time"
                  step={300}
                  value={draft.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </Field>
            </div>
            <Field id="iv-mode" label={ti("mode")} error={errors.mode}>
              <NativeSelect
                value={draft.mode}
                onChange={(e) => set("mode", e.target.value as InterviewMode)}
                options={INTERVIEW_MODES.map((m) => ({ value: m, label: ti(`modes.${m}`) }))}
              />
            </Field>
            <Field
              id="iv-location"
              label={ti("location")}
              optional
              optionalLabel={t("common.optional")}
              error={errors.location}
            >
              <Input
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder={ti("location_placeholder")}
              />
            </Field>
            <Field
              id="iv-interviewer"
              label={ti("interviewer")}
              optional
              optionalLabel={t("common.optional")}
              error={errors.interviewer_name}
            >
              <Input
                value={draft.interviewer_name}
                onChange={(e) => set("interviewer_name", e.target.value)}
              />
            </Field>
            <Field
              id="iv-notes"
              label={t("common.notes")}
              optional
              optionalLabel={t("common.optional")}
              error={errors.notes}
            >
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
            <p className="text-fg-muted text-xs">{ti("sms_hint")}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {interview ? t("common.save_changes") : ti("schedule")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blank(): Draft {
  return {
    date: "",
    time: "10:00",
    mode: "in_person",
    location: "",
    interviewer_name: "",
    notes: "",
  };
}
