"use client";
import * as React from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileClock, RefreshCw, Send, Settings2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { WorkforceSiteSelect } from "@/components/workforce/shared";
import {
  useBulkApproveTimesheets,
  useGenerateTimesheets,
  useSubmitTimesheet,
  useTimesheetPolicy,
  useTimesheets,
} from "@/lib/api/hooks/timesheets";
import type { Timesheet, TimesheetDay, TimesheetStatus } from "@/lib/api/types-timesheets";
import { addDays, adToBs, todayIso, weekdayOf } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ApproveDialog, RejectDialog } from "./decision-dialogs";
import { PolicyDrawer } from "./policy-drawer";
import { isActionable, minutesToHours, timesheetWeekOf, weekDates } from "./utils";

const STATUS_TONE: Record<TimesheetStatus, BadgeTone> = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
};
const STATUSES: TimesheetStatus[] = ["draft", "submitted", "approved", "rejected"];

export function TimesheetsPage() {
  const t = useTranslations("timesheets");
  const tAll = useTranslations();
  const f = useFormat();
  const { isSupervisor, canManage } = useSession();
  const [weekStart, setWeekStart] = React.useState(() => timesheetWeekOf(todayIso()));
  const [site, setSite] = React.useState("");
  const [status, setStatus] = React.useState<TimesheetStatus | "">("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [approving, setApproving] = React.useState<Timesheet | null>(null);
  const [rejecting, setRejecting] = React.useState<Timesheet | null>(null);
  const [policyOpen, setPolicyOpen] = React.useState(false);

  const { data, isLoading, error, refetch, isFetching } = useTimesheets({
    week_start: weekStart,
    site: site || undefined,
    status,
  });
  const policy = useTimesheetPolicy();
  const generate = useGenerateTimesheets();
  const submit = useSubmitTimesheet();
  const bulk = useBulkApproveTimesheets();

  React.useEffect(() => setSelected(new Set()), [weekStart, site, status]);

  const rows = data ?? [];
  const actionable = rows.filter(isActionable);
  const today = todayIso();
  const thisWeek = timesheetWeekOf(today);
  const dates = weekDates(weekStart);
  const range = `${f.date(weekStart).bs} – ${f.date(addDays(weekStart, 6)).bs}`;
  const capHours = minutesToHours(policy.data?.weekly_ot_cap_minutes ?? 1440);

  const doGenerate = () =>
    generate.mutate(
      { week_start: weekStart, site: site || null },
      {
        onSuccess: (r) =>
          toast.success(t("generate_toast", { created: r.created, refreshed: r.refreshed, skipped: r.skipped })),
        onError: (e) => toastError(e, tAll),
      },
    );

  const doSubmit = (ts: Timesheet) =>
    submit.mutate(ts.id, {
      onSuccess: () => toast.success(t("submitted_toast")),
      onError: (e) => toastError(e, tAll),
    });

  const doBulk = () =>
    bulk.mutate(Array.from(selected), {
      onSuccess: (r) => {
        toast.success(t("bulk_toast", { approved: r.approved.length, skipped: r.skipped.length }));
        setSelected(new Set());
      },
      onError: (e) => toastError(e, tAll),
    });

  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allChecked: boolean | "indeterminate" =
    actionable.length > 0 && selected.size === actionable.length ? true : selected.size > 0 ? "indeterminate" : false;

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={isSupervisor ? t("description_supervisor") : t("description")}
        actions={
          <>
            {canManage ? (
              <Button variant="secondary" onClick={() => setPolicyOpen(true)}>
                <Settings2 aria-hidden />
                {t("policy")}
              </Button>
            ) : null}
            {canManage && selected.size > 0 ? (
              <Button variant="secondary" onClick={doBulk} loading={bulk.isPending}>
                <Check aria-hidden />
                {t("bulk_approve", { count: selected.size })}
              </Button>
            ) : null}
            <Button onClick={doGenerate} loading={generate.isPending}>
              <RefreshCw aria-hidden />
              {t("generate")}
            </Button>
          </>
        }
      />

      <Toolbar className="sm:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("prev_week")}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="tabular min-w-52 px-2 text-center text-sm font-medium text-fg" aria-live="polite">
            {range}
          </span>
          <Button variant="secondary" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("next_week")}>
            <ChevronRight aria-hidden />
          </Button>
          {weekStart !== thisWeek ? (
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeek)}>
              {t("this_week")}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as TimesheetStatus | "")}
            allowEmpty
            emptyLabel={t("all_statuses")}
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            className="w-full sm:w-44"
            aria-label={t("status_filter")}
          />
          <WorkforceSiteSelect value={site} onChange={setSite} className="w-full sm:w-56" aria-label={tAll("term.site")} />
        </div>
      </Toolbar>

      {isLoading ? (
        <TableSkeleton rows={6} cols={10} />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileClock}
          title={t("empty_title")}
          description={t("empty_body")}
          action={
            <Button onClick={doGenerate} loading={generate.isPending}>
              <RefreshCw aria-hidden />
              {t("generate")}
            </Button>
          }
        />
      ) : (
        <TableContainer className={cn(isFetching && "opacity-70")} aria-busy={isFetching || undefined}>
          <Table className="min-w-[1080px]">
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-10 px-3">
                    <Checkbox
                      checked={allChecked}
                      disabled={actionable.length === 0}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(actionable.map((r) => r.id)) : new Set())}
                      aria-label={t("select_all")}
                    />
                  </Th>
                ) : null}
                <Th sticky className="min-w-44">
                  {t("col_worker")}
                </Th>
                {dates.map((d) => (
                  <Th key={d} className={cn("min-w-16 px-2 text-center", d === today && "text-brand-text")}>
                    <span className="block">{f.weekday(weekdayOf(d))}</span>
                    <span className="tabular block font-normal">{f.digits(adToBs(d)?.day ?? "")}</span>
                  </Th>
                ))}
                <Th numeric>{t("col_regular")}</Th>
                <Th numeric>{t("col_ot_claimed")}</Th>
                <Th numeric>{t("col_ot_approved")}</Th>
                <Th>{t("col_status")}</Th>
                <Th className="text-right">{t("col_actions")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((ts) => (
                <Tr key={ts.id} selected={selected.has(ts.id)}>
                  {canManage ? (
                    <Td className="w-10 px-3">
                      <Checkbox
                        checked={selected.has(ts.id)}
                        disabled={!isActionable(ts)}
                        onCheckedChange={(v) => toggle(ts.id, v === true)}
                        aria-label={t("select_row", { name: ts.worker.full_name })}
                      />
                    </Td>
                  ) : null}
                  <RowHeader sticky className="min-w-44">
                    <span className="block truncate">{ts.worker.full_name}</span>
                    <span className="block truncate text-xs font-normal text-fg-muted">
                      {[ts.designation, ts.site?.name].filter(Boolean).join(" · ")}
                    </span>
                  </RowHeader>
                  {ts.days.map((d) => (
                    <DayCell key={d.date} day={d} />
                  ))}
                  <Td numeric>{f.number(minutesToHours(ts.regular_minutes))}</Td>
                  <Td numeric>
                    <span className={cn("inline-flex items-center gap-1", ts.over_cap && "font-semibold text-warning")}>
                      {ts.over_cap ? (
                        <Tooltip content={t("over_cap_hint", { h: f.number(capHours) })}>
                          <AlertTriangle className="size-4" aria-label={t("over_cap")} />
                        </Tooltip>
                      ) : null}
                      {f.number(minutesToHours(ts.overtime_minutes_claimed))}
                    </span>
                  </Td>
                  <Td numeric>
                    {ts.overtime_minutes_approved === null ? "—" : f.number(minutesToHours(ts.overtime_minutes_approved))}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={STATUS_TONE[ts.status]} dot>
                        {t(`status.${ts.status}`)}
                      </Badge>
                      {ts.status === "rejected" && ts.note ? (
                        <span className="max-w-48 truncate text-xs text-fg-muted" title={ts.note}>
                          {t("rejected_note", { note: ts.note })}
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      {ts.status === "draft" || ts.status === "rejected" ? (
                        <Button size="sm" variant="secondary" onClick={() => doSubmit(ts)} disabled={submit.isPending}>
                          <Send aria-hidden />
                          {t("submit")}
                        </Button>
                      ) : null}
                      {canManage && isActionable(ts) ? (
                        <>
                          <Button size="sm" onClick={() => setApproving(ts)}>
                            <Check aria-hidden />
                            {t("approve")}
                          </Button>
                          <Button size="sm" variant="danger-outline" onClick={() => setRejecting(ts)}>
                            <Undo2 aria-hidden />
                            {t("reject")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {rows.length ? <p className="mt-3 text-xs text-fg-muted">{t("legend")}</p> : null}

      <ApproveDialog
        timesheet={approving}
        requiresApproval={!!policy.data?.ot_requires_approval}
        capHours={capHours}
        onOpenChange={(o) => !o && setApproving(null)}
      />
      <RejectDialog timesheet={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />
      {canManage ? <PolicyDrawer open={policyOpen} onOpenChange={setPolicyOpen} /> : null}
    </div>
  );
}

function DayCell({ day }: { day: TimesheetDay }) {
  const t = useTranslations("timesheets");
  const f = useFormat();
  const worked = day.regular_minutes > 0 || day.overtime_minutes > 0;
  const muted = day.status === "not_employed" || day.status === "weekly_off" || day.status === "holiday";
  return (
    <Td
      className={cn("px-2 text-center text-xs", muted && "bg-surface-muted")}
      title={t(`day_title.${day.status}`)}
    >
      {worked ? (
        <span className="tabular inline-flex flex-col leading-tight">
          <span className="font-medium text-fg">{f.number(minutesToHours(day.regular_minutes))}</span>
          {day.overtime_minutes > 0 ? (
            <span className="text-accent">+{f.number(minutesToHours(day.overtime_minutes))}</span>
          ) : null}
        </span>
      ) : (
        <span className={cn("text-fg-muted", day.status === "absent" && "text-danger")}>{t(`day.${day.status}`)}</span>
      )}
      <span className="sr-only">{t(`day_title.${day.status}`)}</span>
    </Td>
  );
}
