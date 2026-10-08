"use client";
import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Save,
  Undo2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Tooltip } from "@/components/ui/tooltip";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { WorkforceSiteSelect } from "@/components/workforce/shared";
import { useCopyRosterWeek, useRoster, useSaveRoster } from "@/lib/api/hooks/scheduling";
import type {
  RosterDay,
  RosterRow,
  RosterShift,
  RosterWarningCode,
} from "@/lib/api/types-scheduling";
import { addDays, todayIso } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import {
  cellValue,
  cellWarningText,
  editKey,
  editsToEntries,
  isActiveOn,
  OFF,
  type RosterEdits,
  summariseWarnings,
  type WarningSummary,
  weekStartOf,
} from "./utils";

export function RosterPage() {
  const t = useTranslations("scheduling");
  const tAll = useTranslations();
  const f = useFormat();
  const { isSupervisor } = useSession();
  const today = todayIso();
  const [weekStart, setWeekStart] = React.useState(() => weekStartOf(today));
  const [site, setSite] = React.useState("");
  const [edits, setEdits] = React.useState<RosterEdits>({});
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [saveWarnings, setSaveWarnings] = React.useState<WarningSummary[]>([]);

  const { data, isLoading, error, refetch, isFetching } = useRoster(weekStart, site || undefined);
  const save = useSaveRoster();
  const copy = useCopyRosterWeek();

  React.useEffect(() => {
    setEdits({});
    setSaveWarnings([]);
  }, [weekStart, site]);

  const rows = data?.rows ?? [];
  const pending = data ? editsToEntries(rows, edits) : [];
  const dirty = pending.length > 0;

  const goTo = (start: string) => {
    if (dirty && !window.confirm(t("discard_confirm"))) return;
    setWeekStart(start);
  };
  const go = (days: number) => goTo(addDays(weekStart, days));

  const doSave = () =>
    save.mutate(pending, {
      onSuccess: (r) => {
        const notified = r.notified_workers ?? 0;
        toast.success(t("saved_toast", { count: r.saved + r.cleared }), {
          description: notified > 0 ? t("notified", { count: notified }) : undefined,
        });
        const summary = summariseWarnings(r.warnings, rows, tAll("common.none"));
        setSaveWarnings(summary);
        if (summary.length) toast.warning(t("save_warnings_toast", { count: summary.length }));
        setEdits({});
      },
      onError: (e) => toastError(e, tAll),
    });

  const doCopy = () =>
    copy.mutate(
      { from_week_start: addDays(weekStart, -7), to_week_start: weekStart, site: site || null },
      {
        onSuccess: (r) => {
          const notified = r.notified_workers ?? 0;
          toast.success(t("copied_toast", { count: r.copied }), {
            description: notified > 0 ? t("notified", { count: notified }) : undefined,
          });
          setSaveWarnings([]);
          setEdits({});
          setCopyOpen(false);
        },
        onError: (e) => toastError(e, tAll),
      },
    );

  const rangeLabel = data
    ? `${f.bs(data.week_start_bs)} – ${f.bs(data.week_end_bs)}`
    : f.dateText(weekStart);

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={isSupervisor ? t("description_supervisor") : t("description")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCopyOpen(true)} disabled={!data}>
              <Copy aria-hidden />
              {t("copy_previous")}
            </Button>
            <Button onClick={doSave} disabled={!dirty} loading={save.isPending}>
              <Save aria-hidden />
              {dirty ? t("save_count", { count: pending.length }) : t("save")}
            </Button>
          </>
        }
      />

      <Toolbar className="sm:justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => go(-7)}
            aria-label={t("prev_week")}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span
            className="text-fg tabular min-w-48 px-2 text-center text-sm font-medium"
            aria-live="polite"
          >
            {rangeLabel}
          </span>
          <Button variant="secondary" size="icon" onClick={() => go(7)} aria-label={t("next_week")}>
            <ChevronRight aria-hidden />
          </Button>
          {weekStart !== weekStartOf(today) ? (
            <Button variant="ghost" size="sm" onClick={() => goTo(weekStartOf(today))}>
              {t("this_week")}
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setEdits({})}>
              <Undo2 aria-hidden />
              {t("discard")}
            </Button>
          ) : null}
          <WorkforceSiteSelect
            value={site}
            onChange={setSite}
            className="w-full sm:w-56"
            aria-label={tAll("term.site")}
          />
        </div>
      </Toolbar>

      {saveWarnings.length ? (
        <SaveWarnings items={saveWarnings} onDismiss={() => setSaveWarnings([])} />
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("empty_title")} description={t("empty_body")} />
      ) : data.shifts.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t("no_shifts_title")}
          description={t("no_shifts_body")}
          action={
            isSupervisor ? null : (
              <Button asChild>
                <Link href="/app/settings/shifts">{t("add_shifts")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <RosterGrid
          days={data.days}
          rows={rows}
          shifts={data.shifts}
          warningLabels={data.warning_labels}
          edits={edits}
          onEdit={(k, v) => setEdits((e) => ({ ...e, [k]: v }))}
          busy={isFetching && !isLoading}
          today={today}
        />
      )}
      {data && data.shifts.length ? <Legend shifts={data.shifts} /> : null}

      <ConfirmDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        title={t("copy_title")}
        description={t("copy_body")}
        confirmLabel={t("copy_confirm")}
        loading={copy.isPending}
        onConfirm={doCopy}
      />
    </div>
  );
}

function RosterGrid({
  days,
  rows,
  shifts,
  warningLabels,
  edits,
  onEdit,
  busy,
  today,
}: {
  days: RosterDay[];
  rows: RosterRow[];
  shifts: RosterShift[];
  warningLabels?: Partial<Record<RosterWarningCode, string>>;
  edits: RosterEdits;
  onEdit: (key: string, value: string) => void;
  busy: boolean;
  today: string;
}) {
  const t = useTranslations("scheduling");
  const tAll = useTranslations();
  const f = useFormat();
  return (
    <TableContainer className={cn(busy && "opacity-70")} aria-busy={busy || undefined}>
      <Table className="min-w-[860px]">
        <THead>
          <tr>
            <Th sticky className="min-w-44">
              {t("worker")}
            </Th>
            {days.map((d) => (
              <Th
                key={d.date}
                className={cn(
                  "min-w-28 text-center",
                  d.date === today && "text-brand-text",
                  (d.is_holiday || d.is_weekly_off) && "bg-surface-hover",
                )}
                title={d.holiday_name ?? undefined}
              >
                <span className="block">{f.weekday(d.weekday)}</span>
                <span className="tabular block font-normal">{f.bs(d.date_bs)}</span>
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={r.employment_id}>
              <RowHeader sticky className="min-w-44">
                <span className="block truncate">{r.worker_name}</span>
                {r.designation ? (
                  <span className="text-fg-muted block truncate text-xs font-normal">
                    {r.designation}
                  </span>
                ) : null}
              </RowHeader>
              {days.map((d) => {
                const key = editKey(r.employment_id, d.date);
                const value = key in edits ? edits[key] : cellValue(r.cells[d.date]);
                const changed = key in edits && edits[key] !== cellValue(r.cells[d.date]);
                const active = isActiveOn(r, d.date);
                // Server warnings describe the saved cell — hide them while the cell is being edited.
                const warns = changed ? [] : cellWarningText(r, d.date, warningLabels);
                return (
                  <Td key={d.date} className={cn("px-1.5", changed && "bg-brand-subtle")}>
                    {active ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={value}
                          onChange={(e) => onEdit(key, e.target.value)}
                          aria-label={t("cell_label", {
                            name: r.worker_name,
                            date: f.bs(d.date_bs),
                          })}
                          className={cn(
                            "border-border bg-surface text-fg focus-visible:ring-ring h-9 w-full min-w-24 rounded-md border px-1.5 text-xs focus-visible:ring-2",
                            value === OFF && "bg-surface-muted text-fg-muted",
                            value === "" && "text-fg-subtle",
                          )}
                        >
                          <option value="">{t("unassigned")}</option>
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                          <option value={OFF}>{t("off")}</option>
                        </select>
                        {warns.length ? (
                          <Tooltip content={warns.join(" · ")}>
                            <button
                              type="button"
                              className="text-warning focus-visible:ring-ring shrink-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                              aria-label={t("warning_label", {
                                name: r.worker_name,
                                date: f.bs(d.date_bs),
                                warnings: warns.join(", "),
                              })}
                            >
                              <AlertTriangle className="size-4" aria-hidden />
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-fg-subtle block text-center text-xs">
                        {tAll("common.none")}
                      </span>
                    )}
                  </Td>
                );
              })}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

function SaveWarnings({ items, onDismiss }: { items: WarningSummary[]; onDismiss: () => void }) {
  const t = useTranslations("scheduling");
  const f = useFormat();
  return (
    <div
      role="status"
      className="border-warning/30 bg-warning-subtle text-warning mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("save_warnings_title", { count: items.length })}</p>
        <p className="text-fg-muted mt-0.5 text-xs">{t("save_warnings_hint")}</p>
        <ul className="text-fg-body mt-1.5 space-y-0.5">
          {items.map((w) => (
            <li key={`${w.employment_id}|${w.date}`}>
              <span className="font-medium">{w.name}</span> ·{" "}
              <span className="tabular">{f.dateText(w.date)}</span> — {w.messages.join(", ")}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("save_warnings_dismiss")}
        className="text-fg-muted hover:text-fg focus-visible:ring-ring shrink-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function Legend({ shifts }: { shifts: RosterShift[] }) {
  const t = useTranslations("scheduling");
  const f = useFormat();
  return (
    <p className="text-fg-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {shifts.map((s) => (
        <span key={s.id}>
          <span className="text-fg-body font-medium">{s.name}</span> {f.clock(s.start_time)}–
          {f.clock(s.end_time)}
        </span>
      ))}
      <span>
        <span className="text-fg-body font-medium">{t("off")}</span> {t("off_hint")}
      </span>
    </p>
  );
}
