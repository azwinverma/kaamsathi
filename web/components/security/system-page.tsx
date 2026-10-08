"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Activity,
  AlarmClock,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  MessageSquareWarning,
  RotateCcw,
  Server,
  Tag,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Segmented } from "@/components/ui/segmented";
import { StatCard } from "@/components/ui/stat-card";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useFailedTaskAction, useFailedTasks, useSystemHealth } from "@/lib/api/hooks/security";
import { FAILED_TASK_STATUSES, type FailedTask, type FailedTaskStatus } from "@/lib/api/types-security";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { prettyJson } from "./helpers";
import { RequireStaffRole } from "./require-staff-role";

const PAGE_SIZE = 25;

export function SystemHealthPage() {
  return (
    <RequireStaffRole roles={["superadmin"]}>
      <SystemHealth />
    </RequireStaffRole>
  );
}

function SystemHealth() {
  const t = useTranslations("security.system");
  const f = useFormat();
  const health = useSystemHealth();
  const h = health.data;
  const loading = health.isLoading;
  const okTone = (v: string | undefined) => (v === "ok" ? "success" : "danger") as "success" | "danger";
  const stateLabel = (v: string | undefined) => (v === "ok" ? t("ok") : t("unavailable"));
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : f.number(v));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        meta={h?.version ? <Badge tone="outline">{t("version", { version: h.version })}</Badge> : null}
        actions={
          <Button variant="secondary" onClick={() => health.refetch()} loading={health.isFetching && !loading}>
            <RotateCcw aria-hidden />
            {t("refresh")}
          </Button>
        }
      />

      {health.isError ? (
        <ErrorState error={health.error} onRetry={() => health.refetch()} className="mb-6" />
      ) : (
        <section aria-label={t("health_heading")} className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("db")}
            icon={Database}
            loading={loading}
            tone={okTone(h?.db)}
            value={stateLabel(h?.db)}
          />
          <StatCard
            label={t("redis")}
            icon={Server}
            loading={loading}
            tone={okTone(h?.redis)}
            value={stateLabel(h?.redis)}
          />
          <StatCard
            label={t("celery")}
            icon={Cpu}
            loading={loading}
            tone={h && (h.celery.workers_seen ?? 0) > 0 ? "success" : "warning"}
            value={t("workers", { count: num(h?.celery.workers_seen) })}
            hint={t("queue_length", { count: num(h?.celery.queue_length) })}
          />
          <StatCard
            label={t("beat")}
            icon={AlarmClock}
            loading={loading}
            tone={h?.beat.stale || !h?.beat.last_heartbeat ? "danger" : "success"}
            value={h?.beat.stale || !h?.beat.last_heartbeat ? t("stale") : t("ok")}
            hint={
              h?.beat.last_heartbeat
                ? t("last_heartbeat", { date: f.dateTime(h.beat.last_heartbeat) })
                : t("no_heartbeat")
            }
          />
          <StatCard
            label={t("failed_tasks_24h")}
            icon={TriangleAlert}
            loading={loading}
            tone={h && h.failed_tasks_24h > 0 ? "warning" : "neutral"}
            value={num(h?.failed_tasks_24h)}
          />
          <StatCard
            label={t("sms_failed_24h")}
            icon={MessageSquareWarning}
            loading={loading}
            tone={h && h.sms_failed_24h > 0 ? "warning" : "neutral"}
            value={num(h?.sms_failed_24h)}
          />
          <StatCard
            label={t("version_label")}
            icon={Tag}
            loading={loading}
            value={<span className="font-mono text-base">{h?.version || "—"}</span>}
          />
          <StatCard
            label={t("overall")}
            icon={Activity}
            loading={loading}
            tone={h && h.db === "ok" && h.redis === "ok" && !h.beat.stale ? "success" : "danger"}
            value={h && h.db === "ok" && h.redis === "ok" && !h.beat.stale ? t("healthy") : t("degraded")}
          />
        </section>
      )}

      <FailedTasks />
    </>
  );
}

function FailedTasks() {
  const t = useTranslations("security.system");
  const [status, setStatus] = React.useState<FailedTaskStatus>("open");
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const query = useFailedTasks({ status, page });
  const rows = query.data?.results ?? [];
  const count = query.data?.count ?? 0;
  const pageSizeRef = React.useRef(PAGE_SIZE);
  if (query.data?.next && rows.length) pageSizeRef.current = rows.length;

  return (
    <section aria-labelledby="failed-tasks-heading">
      <h2 id="failed-tasks-heading" className="mb-3 text-lg font-semibold text-fg">
        {t("failed_tasks")}
      </h2>
      <Toolbar>
        <Segmented
          label={t("filter_status")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={FAILED_TASK_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        />
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Activity} title={t("no_failed_tasks")} />
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th className="w-10">
                    <span className="sr-only">{t("traceback")}</span>
                  </Th>
                  <Th>{t("col_task")}</Th>
                  <Th className="max-md:hidden">{t("col_error")}</Th>
                  <Th>{t("col_when")}</Th>
                  <Th>{t("col_state")}</Th>
                  <Th className="text-right">{t("col_actions")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TaskRow
                    key={r.id}
                    task={r}
                    open={expanded === r.id}
                    onToggle={() => setExpanded((e) => (e === r.id ? null : r.id))}
                  />
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={pageSizeRef.current} count={count} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

function TaskRow({ task: r, open, onToggle }: { task: FailedTask; open: boolean; onToggle: () => void }) {
  const t = useTranslations("security.system");
  const tc = useTranslations();
  const f = useFormat();
  const action = useFailedTaskAction();
  const detailsId = `task-${r.id}-details`;
  const handled = !!(r.retried_at || r.dismissed_at);
  const run = (a: "retry" | "dismiss") =>
    action.mutate(
      { id: r.id, action: a },
      {
        onSuccess: () => toast.success(a === "retry" ? t("retried_toast") : t("dismissed_toast")),
        onError: (e) => toastError(e, tc),
      },
    );
  const args = prettyJson(r.args_redacted);

  return (
    <>
      <Tr>
        <Td className="w-10 pr-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={open ? t("hide_traceback") : t("show_traceback")}
          >
            {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          </Button>
        </Td>
        <RowHeader className="max-w-72">
          <span className="block truncate font-mono text-xs text-fg" title={r.task_name}>
            {r.task_name}
          </span>
          <span className="block truncate font-mono text-[11px] font-normal text-fg-muted" title={r.task_id}>
            {r.task_id}
          </span>
        </RowHeader>
        <Td className="max-w-80 max-md:hidden">
          <p className="line-clamp-2 font-mono text-xs text-danger" title={r.exception}>
            {r.exception}
          </p>
        </Td>
        <Td className="tabular text-sm whitespace-nowrap">{f.dateTime(r.created_at)}</Td>
        <Td className="whitespace-nowrap">
          {r.dismissed_at ? (
            <Badge tone="neutral" title={f.dateTime(r.dismissed_at)}>
              {t("status.dismissed")}
            </Badge>
          ) : r.retried_at ? (
            <Badge tone="brand" title={f.dateTime(r.retried_at)}>
              {t("status.retried")}
            </Badge>
          ) : (
            <Badge tone="danger" dot>
              {t("status.open")}
            </Badge>
          )}
        </Td>
        <Td className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run("retry")}
              loading={action.isPending && action.variables?.action === "retry"}
              disabled={action.isPending || !!r.dismissed_at}
            >
              <RotateCcw aria-hidden />
              {t("retry")}
            </Button>
            {!handled ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => run("dismiss")}
                loading={action.isPending && action.variables?.action === "dismiss"}
                disabled={action.isPending}
              >
                <XCircle aria-hidden />
                {t("dismiss")}
              </Button>
            ) : null}
          </div>
        </Td>
      </Tr>
      {open ? (
        <tr id={detailsId}>
          <td colSpan={6} className="space-y-3 border-b border-border bg-surface-muted/50 px-4 py-3">
            <div className="md:hidden">
              <p className="mb-1 text-xs font-medium text-fg-muted">{t("col_error")}</p>
              <p className="font-mono text-xs break-words text-danger">{r.exception}</p>
            </div>
            {args ? (
              <div>
                <p className="mb-1 text-xs font-medium text-fg-muted">{t("args")}</p>
                <pre className="scrollbar-thin max-h-40 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-xs text-fg">
                  {args}
                </pre>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-xs font-medium text-fg-muted">{t("traceback")}</p>
              <pre className="scrollbar-thin max-h-96 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-fg">
                {r.traceback || "—"}
              </pre>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
