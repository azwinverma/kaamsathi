"use client";
import * as React from "react";
import { CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, Save, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker } from "@/components/ui/date";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Toolbar } from "@/components/ui/page-header";
import { useAttendanceDay, useBulkAttendance } from "@/lib/api/hooks/workforce";
import { isApiError } from "@/lib/api/errors";
import type { AttendanceDayRow, AttendanceRecordInput, AttendanceStatus } from "@/lib/api/types";
import { addDays, toLatinDigits, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn, uuid } from "@/lib/utils";
import { CountChip, Notice, WorkforceSiteSelect } from "./shared";
import { MARK_STATUSES, STATUS_SOLID, type MarkStatus } from "./utils";

interface Edit {
  status?: AttendanceStatus;
  overtime?: string;
}

const SHORT_KEY: Record<MarkStatus, string> = {
  present: "short_present",
  absent: "short_absent",
  half_day: "short_half_day",
  leave: "short_leave",
};
const TERM_KEY: Record<AttendanceStatus, string> = {
  present: "term.present",
  absent: "term.absent",
  half_day: "term.half_day",
  leave: "term.on_leave",
  holiday: "term.public_holiday",
  weekly_off: "term.weekly_off",
};

export function AttendanceDay({ onLocked }: { onLocked?: () => void }) {
  const t = useTranslations();
  const ta = useTranslations("workforce.attendance");
  const f = useFormat();
  const { isSupervisor } = useSession();
  const today = todayIso();
  const [date, setDate] = React.useState(today);
  const [site, setSite] = React.useState("");
  const [edits, setEdits] = React.useState<Record<string, Edit>>({});
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});
  const [locked, setLocked] = React.useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useAttendanceDay(date, site || undefined);
  const bulk = useBulkAttendance();

  // Drop unsaved edits when the day or site changes.
  React.useEffect(() => {
    setEdits({});
    setRowErrors({});
    setLocked(false);
  }, [date, site]);

  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const statusOf = (r: AttendanceDayRow): AttendanceStatus | null => edits[r.employment_id]?.status ?? r.record?.status ?? null;
  const otOf = (r: AttendanceDayRow): string =>
    edits[r.employment_id]?.overtime ?? (r.record?.overtime_minutes ? String(r.record.overtime_minutes) : "");

  const dirtyIds = Object.keys(edits).filter((id) => {
    const r = rows.find((x) => x.employment_id === id);
    if (!r) return false;
    const e = edits[id];
    const statusChanged = e.status !== undefined && e.status !== r.record?.status;
    const otChanged =
      e.overtime !== undefined && Number(toLatinDigits(e.overtime) || 0) !== (r.record?.overtime_minutes ?? 0);
    return statusChanged || otChanged;
  });

  const summary = React.useMemo(() => {
    const s = { present: 0, absent: 0, half_day: 0, leave: 0, not_marked: 0 };
    for (const r of rows) {
      const st = edits[r.employment_id]?.status ?? r.record?.status ?? null;
      if (st === "present" || st === "absent" || st === "half_day" || st === "leave") s[st]++;
      else if (!st) s.not_marked++;
    }
    return s;
  }, [rows, edits]);

  const setStatus = (id: string, status: AttendanceStatus) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], status } }));
    setRowErrors(({ [id]: _drop, ...rest }) => rest);
  };
  const setOt = (id: string, overtime: string) => {
    const clean = toLatinDigits(overtime).replace(/\D/g, "").slice(0, 4);
    setEdits((e) => ({ ...e, [id]: { ...e[id], overtime: clean } }));
  };

  const markAllPresent = () => {
    setEdits((e) => {
      const next = { ...e };
      for (const r of rows) {
        const st = next[r.employment_id]?.status ?? r.record?.status ?? null;
        // Don't overwrite approved leave or holidays.
        if (st === "leave" || st === "holiday" || st === "weekly_off") continue;
        next[r.employment_id] = { ...next[r.employment_id], status: "present" };
      }
      return next;
    });
  };

  const save = () => {
    const byUuid = new Map<string, string>();
    const records: AttendanceRecordInput[] = [];
    const missing: Record<string, string> = {};
    for (const id of dirtyIds) {
      const r = rows.find((x) => x.employment_id === id)!;
      const status = statusOf(r);
      if (!status) {
        missing[id] = ta("pick_status");
        continue;
      }
      const client_uuid = uuid();
      byUuid.set(client_uuid, id);
      records.push({
        client_uuid,
        employment_id: id,
        date,
        status,
        method: isSupervisor ? "supervisor" : "manual",
        overtime_minutes: Number(otOf(r) || 0),
      });
    }
    setRowErrors(missing);
    if (!records.length) return;
    bulk.mutate(records, {
      onSuccess: (res) => {
        const savedIds = new Set(res.saved.map((u) => byUuid.get(u)).filter(Boolean) as string[]);
        const errs: Record<string, string> = { ...missing };
        let lockedHit = false;
        for (const e of res.errors) {
          const id = byUuid.get(e.client_uuid);
          if (e.code === "invalid_state") lockedHit = true;
          if (id) errs[id] = e.message;
        }
        setEdits((cur) => {
          const next = { ...cur };
          for (const id of savedIds) delete next[id];
          return next;
        });
        setRowErrors(errs);
        if (lockedHit) {
          setLocked(true);
          onLocked?.();
        }
        if (savedIds.size) toast.success(ta("saved", { count: savedIds.size, n: f.digits(savedIds.size) }));
        if (res.errors.length) toast.error(ta("save_errors", { count: res.errors.length, n: f.digits(res.errors.length) }));
      },
      onError: (err) => {
        if (isApiError(err) && err.code === "invalid_state") {
          setLocked(true);
          onLocked?.();
          return;
        }
        toast.error(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error"));
      },
    });
  };

  const dateLabel = f.date(date);

  return (
    <div className="space-y-4 pb-20">
      <Toolbar className="mb-0">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label={t("common.prev_day")}>
            <ChevronLeft aria-hidden />
          </Button>
          <BsDatePicker value={date} onChange={setDate} max={today} className="w-60" aria-label={t("common.date")} />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setDate((d) => addDays(d, 1))}
            disabled={date >= today}
            aria-label={t("common.next_day")}
          >
            <ChevronRight aria-hidden />
          </Button>
          {date !== today ? (
            <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
              {t("common.today")}
            </Button>
          ) : null}
        </div>
        <WorkforceSiteSelect value={site} onChange={setSite} className="sm:w-56" aria-label={t("term.site")} />
        <div className="sm:ml-auto">
          <Button variant="secondary" onClick={markAllPresent} disabled={!rows.length || locked}>
            <CheckCheck aria-hidden />
            {ta("mark_all_present")}
          </Button>
        </div>
      </Toolbar>

      {data?.is_holiday ? (
        <Notice tone="warning" title={ta("holiday_title", { name: data.holiday_name ?? t("term.public_holiday") })}>
          {ta("holiday_body")}
        </Notice>
      ) : null}
      {locked ? (
        <Notice tone="locked" title={ta("locked_title")}>
          {ta("locked_body")}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2" aria-live="polite">
        <CountChip tone="success" label={t("term.present")} value={f.digits(summary.present)} />
        <CountChip tone="danger" label={t("term.absent")} value={f.digits(summary.absent)} />
        <CountChip tone="warning" label={t("term.half_day")} value={f.digits(summary.half_day)} />
        <CountChip tone="brand" label={t("term.on_leave")} value={f.digits(summary.leave)} />
        <CountChip label={t("term.not_marked")} value={f.digits(summary.not_marked)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={ta("empty_title")} description={ta("empty_body")} />
      ) : (
        <ul
          className={cn(
            "divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
            isFetching && "opacity-70 transition-opacity",
          )}
          aria-label={ta("list_label", { date: dateLabel.bs })}
        >
          {rows.map((r) => {
            const st = statusOf(r);
            const dirty = dirtyIds.includes(r.employment_id);
            const err = rowErrors[r.employment_id];
            const groupLabel = ta("status_for", { name: r.worker.full_name });
            return (
              <li
                key={r.employment_id}
                className={cn(
                  "flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center",
                  dirty && "bg-brand-subtle/40",
                  err && "bg-danger-subtle/40",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={r.worker.full_name} src={r.worker.photo} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{r.worker.full_name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {r.designation}
                      {r.record?.check_in_at ? ` · ${t("term.check_in")} ${f.time(r.record.check_in_at)}` : ""}
                      {r.record?.check_out_at ? ` · ${t("term.check_out")} ${f.time(r.record.check_out_at)}` : ""}
                    </p>
                    {st === "holiday" || st === "weekly_off" ? (
                      <Badge tone="neutral" className="mt-1">
                        {t(TERM_KEY[st])}
                      </Badge>
                    ) : null}
                    {err ? (
                      <p role="alert" className="mt-1 text-xs font-medium text-danger">
                        {err}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div role="radiogroup" aria-label={groupLabel} className="flex gap-1">
                    {MARK_STATUSES.map((s) => {
                      const on = st === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={t(TERM_KEY[s])}
                          title={t(TERM_KEY[s])}
                          disabled={locked}
                          onClick={() => setStatus(r.employment_id, s)}
                          className={cn(
                            "inline-flex h-10 min-w-11 items-center justify-center rounded-md border px-2.5 text-sm font-semibold transition-colors disabled:opacity-50 max-sm:h-11",
                            on ? STATUS_SOLID[s] : "border-border bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg",
                          )}
                        >
                          {ta(SHORT_KEY[s])}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <span>{ta("ot_minutes")}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otOf(r)}
                      disabled={locked}
                      onChange={(e) => setOt(r.employment_id, e.target.value)}
                      placeholder="0"
                      aria-label={ta("ot_for", { name: r.worker.full_name })}
                      className="h-10 w-20 rounded-md border border-border-strong bg-surface px-2 text-right text-sm text-fg tabular focus-visible:outline-2 focus-visible:outline-ring max-sm:h-11"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dirtyIds.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur md:left-auto md:right-6 md:bottom-6 md:rounded-lg md:border">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-fg" aria-live="polite">
              {ta("unsaved", { count: dirtyIds.length, n: f.digits(dirtyIds.length) })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEdits({});
                  setRowErrors({});
                }}
                disabled={bulk.isPending}
              >
                <Undo2 aria-hidden />
                {ta("discard")}
              </Button>
              <Button onClick={save} loading={bulk.isPending} disabled={locked}>
                <Save aria-hidden />
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
