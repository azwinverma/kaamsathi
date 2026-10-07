"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarCheck,
  CalendarOff,
  CircleDashed,
  Plus,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { useDashboard } from "@/lib/api/hooks/org";
import { useFormat } from "@/lib/use-format";
import { weekdayOf } from "@/lib/format";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Dashboard } from "@/lib/api/types";
import { AttendanceChart } from "./attendance-chart";

const STAGES = ["sourced", "shortlisted", "interview", "selected"] as const;

export function DashboardView() {
  const t = useTranslations();
  const f = useFormat();
  const { me, isSupervisor, membership } = useSession();
  const { data, isLoading, error, refetch } = useDashboard();
  const firstName = (me.full_name || "").trim().split(/\s+/)[0];

  const todayLine = data ? (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium text-fg-body">
        {f.weekday(weekdayOf(data.today), true)}, {f.bs(data.today_bs)}
      </span>
      <span className="text-xs text-fg-muted tabular">{f.ad(data.today)}</span>
    </span>
  ) : null;

  return (
    <div>
      <PageHeader
        title={firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.title")}
        description={todayLine ?? membership?.organization.name}
        actions={<QuickActions supervisor={isSupervisor} />}
      />

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <DashboardSkeleton supervisor={isSupervisor} />
      ) : (
        <div className="space-y-6">
          {isSupervisor ? (
            <p className="text-sm text-fg-muted">{t("dashboard.supervisor_scope")}</p>
          ) : null}
          <TodaySection data={data} />
          {isSupervisor ? (
            <Card>
              <CardHeader title={t("dashboard.attendance_14d")} description={t("dashboard.attendance_14d_hint")} />
              <CardBody>
                <AttendanceChart days={data.attendance_14d} today={data.today} />
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader
                    title={t("dashboard.attendance_14d")}
                    description={t("dashboard.attendance_14d_hint")}
                    action={
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/app/attendance">
                          {t("common.view_all")}
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    }
                  />
                  <CardBody>
                    <AttendanceChart days={data.attendance_14d} today={data.today} />
                  </CardBody>
                </Card>
                <HiringCard data={data} />
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <PayrollCard data={data} />
                <WorkforceCard data={data} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuickActions({ supervisor }: { supervisor: boolean }) {
  const t = useTranslations("dashboard");
  return (
    <>
      <Button asChild>
        <Link href="/app/attendance">
          <CalendarCheck aria-hidden />
          {t("action_mark_hajiri")}
        </Link>
      </Button>
      {!supervisor ? (
        <>
          <Button asChild variant="secondary">
            <Link href="/app/jobs">
              <Plus aria-hidden />
              {t("action_post_job")}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/app/payroll">
              <Banknote aria-hidden />
              {t("action_run_payroll")}
            </Link>
          </Button>
        </>
      ) : null}
    </>
  );
}

function TodaySection({ data }: { data: Dashboard }) {
  const t = useTranslations();
  const f = useFormat();
  if (data.active_workers === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("dashboard.no_workers_title")}
        description={t("dashboard.no_workers_body")}
        action={
          <Button asChild>
            <Link href="/app/workers">{t("dashboard.add_workers")}</Link>
          </Button>
        }
      />
    );
  }
  const marked = data.active_workers - data.not_marked_today;
  const pct = Math.round((marked / Math.max(1, data.active_workers)) * 100);
  return (
    <section aria-labelledby="today-heading" className="space-y-3">
      <h2 id="today-heading" className="text-base font-semibold text-fg">
        {t("dashboard.today_hajiri")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard
          label={t("dashboard.active_workers")}
          value={f.digits(data.active_workers)}
          icon={Users}
          tone="brand"
          href="/app/workers"
          className="col-span-2 lg:col-span-1"
        />
        <StatCard label={t("term.present")} value={f.digits(data.present_today)} icon={UserCheck} tone="success" />
        <StatCard label={t("term.absent")} value={f.digits(data.absent_today)} icon={UserX} tone="danger" />
        <StatCard label={t("term.on_leave")} value={f.digits(data.on_leave_today)} icon={CalendarOff} tone="brand" />
        <StatCard
          label={t("term.not_marked")}
          value={f.digits(data.not_marked_today)}
          icon={CircleDashed}
          tone={data.not_marked_today > 0 ? "warning" : "neutral"}
          href="/app/attendance"
        />
      </div>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-fg-body">
            {t("dashboard.marked_progress", { marked: f.digits(marked), total: f.digits(data.active_workers) })}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-hover"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={t("dashboard.today_hajiri")}
          >
            <div
              className={pct === 100 ? "h-full bg-success" : "h-full bg-brand"}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {data.not_marked_today > 0 ? (
          <Button asChild size="sm" variant="subtle">
            <Link href="/app/attendance">
              {t("dashboard.mark_remaining", { count: data.not_marked_today })}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <span className="text-sm font-medium text-success">{t("dashboard.all_marked")}</span>
        )}
      </Card>
    </section>
  );
}

function HiringCard({ data }: { data: Dashboard }) {
  const t = useTranslations();
  const f = useFormat();
  const max = Math.max(1, ...STAGES.map((s) => data.pipeline[s]));
  const inPipeline = STAGES.reduce((n, s) => n + data.pipeline[s], 0);
  return (
    <Card>
      <CardHeader
        title={t("dashboard.hiring")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/jobs">
              {t("common.view_all")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <CardBody className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-brand-subtle text-brand">
            <Briefcase className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-2xl font-semibold text-fg tabular">{f.digits(data.open_jobs)}</p>
            <p className="text-sm text-fg-muted">{t("dashboard.open_jobs")}</p>
          </div>
        </div>
        {data.open_jobs === 0 && inPipeline === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-sm text-fg-muted">{t("dashboard.no_jobs")}</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/app/jobs">
                <Plus aria-hidden />
                {t("dashboard.action_post_job")}
              </Link>
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium text-fg-muted">{t("dashboard.pipeline")}</p>
            <ul className="space-y-2">
              {STAGES.map((s, i) => (
                <li key={s} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                  <span className="truncate text-fg-body">{t(`stage.${s}`)}</span>
                  <span className="h-5 overflow-hidden rounded-sm bg-surface-muted">
                    <span
                      className="block h-full rounded-sm bg-brand"
                      style={{ width: `${(data.pipeline[s] / max) * 100}%`, opacity: 1 - i * 0.17 }}
                    />
                  </span>
                  <span className="text-right font-medium text-fg tabular">{f.digits(data.pipeline[s])}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <p className="flex items-center gap-1 text-xs text-fg-muted">
              <TrendingUp className="size-3.5 text-success" aria-hidden />
              {t("dashboard.hires_30d")}
            </p>
            <p className="text-lg font-semibold text-fg tabular">{f.digits(data.hires_30d)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-fg-muted">
              <TrendingDown className="size-3.5 text-danger" aria-hidden />
              {t("dashboard.attrition_30d")}
            </p>
            <p className="text-lg font-semibold text-fg tabular">{f.digits(data.attrition_30d)}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function PayrollCard({ data }: { data: Dashboard }) {
  const t = useTranslations();
  const f = useFormat();
  const run = data.last_payroll;
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={t("dashboard.last_payroll")}
        action={
          run ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/app/payroll/${run.id}`}>
                {t("common.view")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null
        }
      />
      <CardBody>
        {run ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-fg-body">{f.bsMonth(run.bs_year, run.bs_month)}</p>
                <StatusBadge status={run.status} ns="payroll" />
              </div>
              <p className="text-2xl font-semibold text-fg tabular">{f.money(run.net_total)}</p>
              <p className="text-xs text-fg-muted">{t("dashboard.net_pay_total")}</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/app/payroll">
                <Banknote aria-hidden />
                {t("dashboard.action_run_payroll")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg-muted">{t("dashboard.no_payroll")}</p>
            <Button asChild>
              <Link href="/app/payroll">
                <Banknote aria-hidden />
                {t("dashboard.action_run_payroll")}
              </Link>
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function WorkforceCard({ data }: { data: Dashboard }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  return (
    <Card>
      <CardHeader title={t("wage_bill")} description={t("wage_bill_hint")} />
      <CardBody className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-success-subtle text-success">
          <Wallet className="size-5" aria-hidden />
        </span>
        <p className="text-2xl font-semibold text-fg tabular">{f.money(data.wage_bill_month_estimate)}</p>
      </CardBody>
    </Card>
  );
}

function DashboardSkeleton({ supervisor }: { supervisor: boolean }) {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={i === 0 ? "col-span-2 h-[104px] lg:col-span-1" : "h-[104px]"} />
        ))}
      </div>
      <Skeleton className="h-16" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className={supervisor ? "h-72 lg:col-span-3" : "h-72 lg:col-span-2"} />
        {!supervisor ? <Skeleton className="h-72" /> : null}
      </div>
    </div>
  );
}
