"use client";
import * as React from "react";
import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { BsMonthPicker } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Toolbar } from "@/components/ui/page-header";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listResults } from "@/lib/api/client";
import { useAttendanceRegister, useBulkAttendance, usePayrollRunsForLock } from "@/lib/api/hooks/workforce";
import { isApiError } from "@/lib/api/errors";
import type { AttendanceRegister as Register, AttendanceStatus, RegisterCell } from "@/lib/api/types";
import { todayBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn, uuid } from "@/lib/utils";
import { Notice, WorkforceSiteSelect } from "./shared";
import { CELL_TINT, CODE_LABEL_KEY, MARK_STATUSES, STATUS_SOLID, type MarkStatus } from "./utils";

const LEGEND: Exclude<RegisterCell, null>[] = ["P", "H", "A", "L", "PH", "WO"];
const TERM_KEY: Record<MarkStatus, string> = {
  present: "term.present",
  absent: "term.absent",
  half_day: "term.half_day",
  leave: "term.on_leave",
};

type Target = { employmentId: string; name: string; date: string; current: RegisterCell };

export function AttendanceRegisterView() {
  const t = useTranslations();
  const ta = useTranslations("workforce.attendance");
  const f = useFormat();
  const { canManage, isSupervisor } = useSession();
  const now = React.useMemo(() => todayBs(), []);
  const [month, setMonth] = React.useState({ year: now.year, month: now.month });
  const [site, setSite] = React.useState("");
  const [target, setTarget] = React.useState<Target | null>(null);
  const [lockedByServer, setLockedByServer] = React.useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useAttendanceRegister(
    month.year,
    month.month,
    site || undefined,
  );
  const runs = usePayrollRunsForLock(canManage);
  const run = canManage
    ? listResults(runs.data).find((r) => r.bs_year === month.year && r.bs_month === month.month)
    : undefined;
  const lockedByRun = !!run && (run.status === "approved" || run.status === "paid");
  const locked = lockedByRun || lockedByServer;

  React.useEffect(() => setLockedByServer(false), [month.year, month.month]);

  const today = todayIso();

  return (
    <div className="space-y-4">
      <Toolbar className="mb-0">
        <BsMonthPicker value={month} onChange={setMonth} max={{ year: now.year, month: now.month }} />
        <WorkforceSiteSelect value={site} onChange={setSite} className="sm:w-56" aria-label={t("term.site")} />
      </Toolbar>

      {locked ? (
        <Notice tone="locked" title={ta("locked_title")}>
          {ta("register_locked_body", { month: f.bsMonth(month.year, month.month) })}
        </Notice>
      ) : (
        <p className="text-xs text-fg-muted">{ta("register_edit_hint")}</p>
      )}

      <Legend />

      {isLoading ? (
        <TableSkeleton rows={8} cols={10} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState icon={CalendarRange} title={ta("register_empty")} />
      ) : (
        <RegisterGrid
          data={data}
          today={today}
          locked={locked}
          dim={isFetching}
          onCell={(tg) => setTarget(tg)}
        />
      )}

      <CellDialog
        target={target}
        onClose={() => setTarget(null)}
        method={isSupervisor ? "supervisor" : "manual"}
        onLocked={() => setLockedByServer(true)}
      />
    </div>
  );
}

function Legend() {
  const ta = useTranslations("workforce.attendance");
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-fg-muted" aria-label={ta("legend")}>
      {LEGEND.map((c) => (
        <li key={c} className="inline-flex items-center gap-1.5">
          <span className={cn("inline-flex h-5 min-w-6 items-center justify-center rounded px-1 text-[11px] font-semibold", CELL_TINT[c])}>
            {ta(`code_short.${c}`)}
          </span>
          {ta(CODE_LABEL_KEY[c])}
        </li>
      ))}
    </ul>
  );
}

function RegisterGrid({
  data,
  today,
  locked,
  dim,
  onCell,
}: {
  data: Register;
  today: string;
  locked: boolean;
  dim: boolean;
  onCell: (t: Target) => void;
}) {
  const t = useTranslations();
  const ta = useTranslations("workforce.attendance");
  const f = useFormat();
  return (
    <TableContainer maxHeight="70vh" className={dim ? "opacity-70 transition-opacity" : undefined}>
      <Table className="text-xs">
        <caption className="sr-only">{f.bsMonth(data.bs_year, data.bs_month)}</caption>
        <THead>
          <Tr>
            <Th sticky className="min-w-44">
              {ta("col_worker")}
            </Th>
            {data.days.map((d) => (
              <Th
                key={d.date}
                className={cn(
                  "w-9 min-w-9 px-0 text-center",
                  (d.is_holiday || d.is_weekly_off) && "text-danger",
                  d.date === today && "bg-brand-subtle text-brand-subtle-fg",
                )}
                title={f.ad(d.date)}
              >
                <span className="block leading-tight tabular">{f.digits(d.bs_day)}</span>
                <span className="block text-[10px] leading-tight font-normal">{f.weekday(d.weekday)}</span>
              </Th>
            ))}
            <Th numeric className="border-l border-border">{ta("code_short.P")}</Th>
            <Th numeric>{ta("code_short.H")}</Th>
            <Th numeric>{ta("code_short.A")}</Th>
            <Th numeric>{ta("code_short.L")}</Th>
            <Th numeric>{ta("ot_hours")}</Th>
          </Tr>
        </THead>
        <TBody>
          {data.rows.map((r) => (
            <Tr key={r.employment_id}>
              <RowHeader sticky className="h-10 min-w-44 py-1">
                <span className="block truncate text-sm">{r.worker_name}</span>
                <span className="block truncate text-[11px] font-normal text-fg-muted">{r.designation}</span>
              </RowHeader>
              {data.days.map((d) => {
                const code = r.cells[d.date] ?? null;
                const future = d.date > today;
                const label = `${r.worker_name}, ${f.bs({ year: data.bs_year, month: data.bs_month, day: d.bs_day })}: ${code ? ta(CODE_LABEL_KEY[code]) : t("term.not_marked")}`;
                const editable = !locked && !future;
                return (
                  <Td key={d.date} className={cn("h-10 px-0.5 text-center", (d.is_holiday || d.is_weekly_off) && !code && "bg-surface-muted")}>
                    <button
                      type="button"
                      disabled={!editable}
                      aria-label={label}
                      title={label}
                      onClick={() => onCell({ employmentId: r.employment_id, name: r.worker_name, date: d.date, current: code })}
                      className={cn(
                        "inline-flex h-7 w-8 items-center justify-center rounded text-[11px] font-semibold disabled:cursor-default",
                        code ? CELL_TINT[code] : "text-fg-subtle",
                        editable && "hover:ring-1 hover:ring-brand",
                      )}
                    >
                      {code ? ta(`code_short.${code}`) : future ? "" : "·"}
                    </button>
                  </Td>
                );
              })}
              <Td numeric className="h-10 border-l border-border font-medium text-success">{f.number(r.totals.present)}</Td>
              <Td numeric className="h-10 text-warning">{f.number(r.totals.half_day)}</Td>
              <Td numeric className="h-10 text-danger">{f.number(r.totals.absent)}</Td>
              <Td numeric className="h-10 text-brand-text">{f.number(r.totals.leave)}</Td>
              <Td numeric className="h-10">{f.number(r.totals.overtime_hours)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

function CellDialog({
  target,
  onClose,
  method,
  onLocked,
}: {
  target: Target | null;
  onClose: () => void;
  method: "manual" | "supervisor";
  onLocked: () => void;
}) {
  const t = useTranslations();
  const ta = useTranslations("workforce.attendance");
  const f = useFormat();
  const bulk = useBulkAttendance();
  const [status, setStatus] = React.useState<MarkStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (target) {
      const map: Partial<Record<string, MarkStatus>> = { P: "present", A: "absent", H: "half_day", L: "leave" };
      setStatus(target.current ? (map[target.current] ?? null) : null);
      setError(null);
    }
  }, [target]);

  if (!target) return null;
  const d = f.date(target.date);

  const save = () => {
    if (!status) return;
    const client_uuid = uuid();
    bulk.mutate(
      [{ client_uuid, employment_id: target.employmentId, date: target.date, status: status as AttendanceStatus, method }],
      {
        onSuccess: (res) => {
          const e = res.errors.find((x) => x.client_uuid === client_uuid);
          if (e) {
            if (e.code === "invalid_state") {
              onLocked();
              toast.error(ta("locked_title"));
              onClose();
            } else setError(e.message);
            return;
          }
          toast.success(t("common.changes_saved"));
          onClose();
        },
        onError: (err) => {
          if (isApiError(err) && err.code === "invalid_state") {
            onLocked();
            toast.error(ta("locked_title"));
            onClose();
            return;
          }
          setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <DialogHeader title={target.name} description={`${d.bs} · ${d.ad}`} />
        <DialogBody className="space-y-3">
          <div role="radiogroup" aria-label={ta("status_for", { name: target.name })} className="grid grid-cols-2 gap-2">
            {MARK_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "h-11 rounded-md border text-sm font-medium transition-colors",
                  status === s ? STATUS_SOLID[s] : "border-border bg-surface text-fg hover:bg-surface-hover",
                )}
              >
                {t(TERM_KEY[s])}
              </button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={bulk.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} loading={bulk.isPending} disabled={!status}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
