"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Award,
  Banknote,
  Building,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  FileWarning,
  ListChecks,
  PauseCircle,
  Plus,
  UserPlus,
  Users,
  Wallet,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { useDashboard, useOrg } from "@/lib/api/hooks/org";
import { useJobs } from "@/lib/api/hooks/hiring";
import { useLeaves } from "@/lib/api/hooks/workforce";
import { usePendingCorrectionsCount } from "@/lib/api/hooks/corrections";
import { useComplianceStatus } from "@/lib/api/hooks/compliance";
import { useExpiringCredentials } from "@/lib/api/hooks/credentials";
import { useOrgVerification } from "@/lib/api/hooks/risk";
import { useWebhooks } from "@/lib/api/hooks/integrations";
import { useOrgDisputes } from "@/lib/api/hooks/trust";
import { listResults } from "@/lib/api/client";
import { useFormat } from "@/lib/use-format";
import { weekdayOf } from "@/lib/format";
import { useSession } from "@/components/providers/session";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AttentionList, DenseStatRow, TodayStrip, type AttentionItem } from "@/components/ledger";
import type { Dashboard, Job } from "@/lib/api/types";
import { JobWage } from "@/components/hiring/job-bits";
import { AttendanceChart } from "./attendance-chart";

/**
 * Employer dashboard — direction A "documentary ledger" (approved mockup A-Dashboard):
 * today's hajiri is the focal point, then open jobs + what needs attention, then 14 days of
 * attendance and a single strip of month numbers. Supervisors get the hajiri-only view.
 */
export function DashboardView() {
  const t = useTranslations();
  const f = useFormat();
  const { me, isSupervisor, canManage, membership } = useSession();
  const { data, isLoading, error, refetch } = useDashboard();
  const firstName = (me.full_name || "").trim().split(/\s+/)[0];

  const eyebrow = data ? (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium text-fg-body">
        {f.weekday(weekdayOf(data.today), true)}, {f.bs(data.today_bs)}
      </span>
      <span className="text-xs text-fg-muted tabular">{f.ad(data.today)}</span>
    </span>
  ) : (
    <span className="inline-block h-5" aria-hidden />
  );

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.title")}
        description={
          isSupervisor
            ? t("dashboard.supervisor_scope")
            : membership
              ? t("ledger.dashboard.today_at", { org: membership.organization.name })
              : undefined
        }
        actions={<HeaderActions canManage={canManage} />}
      />

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <DashboardSkeleton supervisor={isSupervisor} />
      ) : (
        <div className="space-y-6">
          <Today data={data} />
          {canManage ? (
            <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
              <OpenJobs data={data} className="lg:col-span-7" />
              <Attention className="lg:col-span-5" />
            </div>
          ) : (
            <Attention />
          )}
          <ChartSection data={data} />
          {canManage ? (
            <>
              <MonthStrip data={data} />
              <QuickActions />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HeaderActions({ canManage }: { canManage: boolean }) {
  const t = useTranslations("dashboard");
  return (
    <>
      {canManage ? (
        <Button asChild variant="outline">
          <Link href="/app/jobs">
            <Plus aria-hidden />
            {t("action_post_job")}
          </Link>
        </Button>
      ) : null}
      <Button asChild>
        <Link href="/app/attendance">
          <CalendarCheck aria-hidden />
          {t("action_mark_hajiri")}
        </Link>
      </Button>
    </>
  );
}

function Today({ data }: { data: Dashboard }) {
  const t = useTranslations("dashboard");
  if (data.active_workers === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("no_workers_title")}
        description={t("no_workers_body")}
        action={
          <Button asChild>
            <Link href="/app/workers">
              <UserPlus aria-hidden />
              {t("add_workers")}
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <TodayStrip
      total={data.active_workers}
      present={data.present_today}
      absent={data.absent_today}
      leave={data.on_leave_today}
      notMarked={data.not_marked_today}
    />
  );
}

// ---------------------------------------------------------------- open jobs

function jobState(job: Job): { tone: BadgeTone; icon: LucideIcon; key: string } {
  const c = job.counts ?? ({} as Job["counts"]);
  const joined = c?.joined ?? 0;
  if (job.status === "paused") return { tone: "warning", icon: PauseCircle, key: "status_paused" };
  if (joined >= job.openings_count) return { tone: "success", icon: CheckCircle2, key: "status_filled" };
  if (job.openings_count > 1 && joined >= job.openings_count - 1)
    return { tone: "success", icon: CheckCircle2, key: "status_almost" };
  if ((c?.interview ?? 0) > 0) return { tone: "brand", icon: CircleDot, key: "status_interviews" };
  if ((c?.selected ?? 0) > 0) return { tone: "brand", icon: CircleDot, key: "status_selecting" };
  if ((c?.shortlisted ?? 0) === 0) return { tone: "warning", icon: Clock, key: "status_waiting" };
  return { tone: "brand", icon: CircleDot, key: "status_selecting" };
}

function OpenJobs({ data, className }: { data: Dashboard; className?: string }) {
  const t = useTranslations();
  const tl = useTranslations("ledger.dashboard");
  const f = useFormat();
  const q = useJobs({ status: "open", page_size: 6, ordering: "-created_at" });
  const jobs = listResults(q.data);
  return (
    <section
      aria-labelledby="open-jobs-heading"
      className={`min-w-0 overflow-hidden rounded-dense border border-border bg-surface ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 id="open-jobs-heading" className="text-[17px] font-semibold">
          {tl("open_jobs")}
          {data.open_jobs ? (
            <span className="ml-2 text-sm font-normal text-fg-muted tabular">{f.digits(data.open_jobs)}</span>
          ) : null}
        </h2>
        <Link href="/app/jobs" className="text-sm font-medium text-brand-text hover:underline">
          {tl("all_jobs")}
        </Link>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-5" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} className="m-4 border-0" />
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="max-w-md text-sm text-fg-muted">{tl("no_open_jobs")}</p>
          <Button asChild size="sm">
            <Link href="/app/jobs">
              <Plus aria-hidden />
              {t("dashboard.action_post_job")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
        <ul className="divide-y divide-border sm:hidden">
          {jobs.map((j) => {
            const s = jobState(j);
            const Icon = s.icon;
            return (
              <li key={j.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/app/jobs/${j.id}`} className="min-w-0 font-semibold text-fg hover:underline">
                    {j.title}
                  </Link>
                  <Badge tone={s.tone}>
                    <Icon aria-hidden />
                    {tl(s.key)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">
                  <JobWage job={j} className="[&>span:first-child]:font-normal [&>span:first-child]:text-fg-muted" /> ·{" "}
                  {tl("filled_of", { joined: f.digits(j.counts?.joined ?? 0), total: f.digits(j.openings_count) })}{" "}
                  {tl("col_filled").toLowerCase()} · {f.digits(j.counts?.shortlisted ?? 0)} {tl("col_shortlisted").toLowerCase()}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="scrollbar-thin hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[13px] text-fg-muted">
                <th scope="col" className="px-5 py-2.5 font-medium">{tl("col_role")}</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">{tl("col_shortlisted")}</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">{tl("col_interview")}</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">{tl("col_filled")}</th>
                <th scope="col" className="px-5 py-2.5 font-medium">{tl("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const s = jobState(j);
                const Icon = s.icon;
                const c = j.counts;
                return (
                  <tr key={j.id} className="border-t border-surface-muted hover:bg-surface-muted/50">
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <Link href={`/app/jobs/${j.id}`} className="font-semibold text-fg hover:text-brand-text hover:underline">
                        {j.title}
                      </Link>
                      <span className="block text-xs text-fg-muted">
                        <JobWage job={j} className="[&>span:first-child]:font-normal [&>span:first-child]:text-fg-muted" />{" "}
                        · {tl("openings", { count: j.openings_count })}
                        {j.site ? ` · ${j.site.name}` : ""}
                      </span>
                    </th>
                    <td className="px-2 py-3 text-right tabular">{f.digits(c?.shortlisted ?? 0)}</td>
                    <td className="px-2 py-3 text-right tabular">{f.digits(c?.interview ?? 0)}</td>
                    <td className="px-2 py-3 text-right whitespace-nowrap tabular">
                      {tl("filled_of", { joined: f.digits(c?.joined ?? 0), total: f.digits(j.openings_count) })}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={s.tone}>
                        <Icon aria-hidden />
                        {tl(s.key)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- attention

type Bucket = Record<string, AttentionItem[]>;

/**
 * Collects "needs attention" items from the existing APIs. Each source is a tiny component so
 * role-gated endpoints are only requested by members who may call them (owner/admin/hr for
 * compliance, expiring certificates and disputes; owner/admin for KYB and webhooks).
 */
function Attention({ className }: { className?: string }) {
  const tl = useTranslations("ledger.dashboard");
  const { canManage, isAdmin } = useSession();
  const [buckets, setBuckets] = React.useState<Bucket>({});
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const report = React.useCallback((key: string, items: AttentionItem[], loading: boolean) => {
    setBuckets((b) => (sameItems(b[key], items) ? b : { ...b, [key]: items }));
    setPending((p) => (p[key] === loading ? p : { ...p, [key]: loading }));
  }, []);

  const order = ["compliance", "corrections", "leave", "expiring", "disputes", "kyb", "webhooks"];
  const items = order.flatMap((k) => buckets[k] ?? []);
  // Urgent first, then failures, then the rest — stable within a tone.
  const rank = { urgent: 0, danger: 1, normal: 2 } as const;
  items.sort((a, b) => rank[a.tone] - rank[b.tone]);
  const loading = Object.values(pending).some(Boolean);

  return (
    <>
      <CorrectionsSource report={report} />
      <LeaveSource report={report} />
      {canManage ? (
        <>
          <ComplianceSource report={report} />
          <ExpiringSource report={report} />
          <DisputesSource report={report} />
        </>
      ) : null}
      {isAdmin ? (
        <>
          <KybSource report={report} />
          <WebhooksSource report={report} />
        </>
      ) : null}
      <AttentionList
        title={tl("attention")}
        items={items.slice(0, 6)}
        loading={loading}
        emptyText={tl("attention_clear")}
        className={className}
      />
    </>
  );
}

function sameItems(a: AttentionItem[] | undefined, b: AttentionItem[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((x, i) => x.id === b[i].id && String(x.title) === String(b[i].title) && String(x.hint) === String(b[i].hint));
}

type Report = (key: string, items: AttentionItem[], loading: boolean) => void;

function useReport(report: Report, key: string, items: AttentionItem[], loading: boolean) {
  const sig = JSON.stringify(items.map((i) => [i.id, String(i.title), String(i.hint ?? "")]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => report(key, items, loading), [report, key, sig, loading]);
}

function CorrectionsSource({ report }: { report: Report }) {
  const t = useTranslations("ledger.attention");
  const n = usePendingCorrectionsCount();
  const items: AttentionItem[] = n
    ? [
        {
          id: "corrections",
          icon: ListChecks,
          title: t("corrections", { count: n }),
          hint: t("corrections_hint"),
          href: "/app/attendance/corrections?status=pending",
          tone: "normal",
        },
      ]
    : [];
  useReport(report, "corrections", items, false);
  return null;
}

function LeaveSource({ report }: { report: Report }) {
  const t = useTranslations("ledger.attention");
  const q = useLeaves({ status: "pending", page_size: 1 });
  const d = q.data;
  const n = !d ? 0 : Array.isArray(d) ? d.length : d.count;
  const items: AttentionItem[] = n
    ? [
        {
          id: "leave",
          icon: CalendarOff,
          title: t("leave", { count: n }),
          hint: t("leave_hint"),
          href: "/app/leave",
          tone: "normal",
        },
      ]
    : [];
  useReport(report, "leave", items, q.isLoading);
  return null;
}

const COMPLIANCE_ICON: Partial<Record<string, LucideIcon>> = {
  ssf_filings_overdue: FileWarning,
  ssf_employer_registered: Building,
  workers_missing_ssf_id: Users,
  below_minimum_wage: Wallet,
  payroll_not_run_last_month: Banknote,
  attendance_unmarked_7d: CalendarCheck,
};

function ComplianceSource({ report }: { report: Report }) {
  const q = useComplianceStatus();
  const items: AttentionItem[] = (q.data?.items ?? [])
    // Expiring certificates get their own, named rows below.
    .filter((i) => i.status !== "ok" && i.key !== "credentials_expiring")
    .map((i) => ({
      id: `compliance-${i.key}`,
      icon: COMPLIANCE_ICON[i.key] ?? ClipboardCheck,
      title: i.message,
      href: i.link?.startsWith("/app") ? i.link : "/app/compliance",
      tone: i.status === "action" ? ("urgent" as const) : ("normal" as const),
    }));
  useReport(report, "compliance", items, q.isLoading);
  return null;
}

function ExpiringSource({ report }: { report: Report }) {
  const t = useTranslations("ledger.attention");
  const tr = useTranslations("credentials.review");
  const f = useFormat();
  const q = useExpiringCredentials(30);
  const rows = listResults(q.data).sort((a, b) => a.days_to_expiry - b.days_to_expiry);
  const items: AttentionItem[] = rows.slice(0, 2).map((c) => ({
    id: `expiring-${c.id}`,
    icon: Award,
    title: t("expiring", { title: c.title }),
    hint: t("expiring_hint", {
      name: c.worker.full_name,
      when:
        c.days_to_expiry < 0
          ? tr("expired_ago", { days: Math.abs(c.days_to_expiry) })
          : c.expires_on_bs
            ? f.bs(c.expires_on_bs)
            : tr("expires_in", { days: c.days_to_expiry }),
    }),
    href: "/app/compliance",
    tone: c.days_to_expiry <= 7 ? ("urgent" as const) : ("normal" as const),
  }));
  if (rows.length > 2) {
    items.push({
      id: "expiring-more",
      icon: Award,
      title: t("expiring_more", { count: rows.length - 2 }),
      href: "/app/compliance",
      tone: "normal",
    });
  }
  useReport(report, "expiring", items, q.isLoading);
  return null;
}

function DisputesSource({ report }: { report: Report }) {
  const t = useTranslations("ledger.attention");
  const q = useOrgDisputes({ status: "open", page_size: 1 });
  const n = q.data?.count ?? 0;
  const items: AttentionItem[] = n
    ? [
        {
          id: "disputes",
          icon: FileWarning,
          title: t("disputes", { count: n }),
          hint: t("disputes_hint"),
          href: "/app/disputes",
          tone: "normal",
        },
      ]
    : [];
  useReport(report, "disputes", items, q.isLoading);
  return null;
}

function KybSource({ report }: { report: Report }) {
  const t = useTranslations("ledger.attention");
  const q = useOrgVerification();
  const s = q.data?.verification_status;
  const items: AttentionItem[] =
    !s || s === "verified"
      ? []
      : [
          {
            id: `kyb-${s}`,
            icon: Building,
            title: t(`kyb_${s}`),
            hint: t(`kyb_${s}_hint`),
            href: "/app/verification",
            tone: s === "rejected" ? "danger" : "normal",
          },
        ];
  useReport(report, "kyb", items, q.isLoading);
  return null;
}

function WebhooksSource({ report }: { report: Report }) {
  const t = useTranslations("ledger.attention");
  const q = useWebhooks();
  const failing = listResults(q.data).filter((w) => (w.failed_7d ?? 0) > 0);
  const n = failing.reduce((s, w) => s + (w.failed_7d ?? 0), 0);
  const items: AttentionItem[] = n
    ? [
        {
          id: "webhooks",
          icon: Webhook,
          title: t("webhooks", { count: n }),
          hint: t("webhooks_hint", { url: failing[0].url.replace(/^https?:\/\//, "") }),
          href: "/app/integrations",
          tone: "danger",
        },
      ]
    : [];
  useReport(report, "webhooks", items, q.isLoading);
  return null;
}

// ---------------------------------------------------------------- chart + month

function ChartSection({ data }: { data: Dashboard }) {
  const t = useTranslations();
  const tl = useTranslations("ledger.dashboard");
  const f = useFormat();
  const org = useOrg();
  const off = org.data?.weekly_off_day;
  return (
    <section
      aria-labelledby="att14-heading"
      className="rounded-dense border border-border bg-surface px-5 py-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="att14-heading" className="text-[17px] font-semibold">
          {tl("attendance_14d")}
        </h2>
        <span className="flex items-center gap-4 text-[13px] text-fg-muted">
          {off !== undefined && off !== null ? tl("weekly_off", { day: f.weekday(off, true) }) : null}
          <Link href="/app/attendance" className="inline-flex items-center gap-1 font-medium text-brand-text hover:underline">
            {t("common.view_all")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </span>
      </div>
      <AttendanceChart days={data.attendance_14d} today={data.today} weeklyOff={off} />
    </section>
  );
}

function MonthStrip({ data }: { data: Dashboard }) {
  const t = useTranslations();
  const tl = useTranslations("ledger.dashboard");
  const f = useFormat();
  const run = data.last_payroll;
  const inPipeline = data.pipeline.sourced + data.pipeline.shortlisted + data.pipeline.interview + data.pipeline.selected;
  return (
    <DenseStatRow
      label={tl("month_strip")}
      items={[
        {
          key: "payroll",
          label: run ? `${tl("last_payroll")} · ${f.bsMonth(run.bs_year, run.bs_month)}` : tl("last_payroll"),
          value: run ? f.money(run.net_total) : "—",
          hint: run ? <StatusBadge status={run.status} ns="payroll" /> : t("dashboard.no_payroll"),
          icon: Banknote,
          href: run ? `/app/payroll/${run.id}` : "/app/payroll",
        },
        {
          key: "wage",
          label: tl("wage_bill"),
          value: f.money(data.wage_bill_month_estimate),
          icon: Wallet,
        },
        { key: "pipeline", label: tl("in_pipeline"), value: f.digits(inPipeline), icon: Users, href: "/app/candidates" },
        { key: "hires", label: tl("hires_30d"), value: f.digits(data.hires_30d), icon: UserPlus, tone: "success" },
        { key: "left", label: tl("left_30d"), value: f.digits(data.attrition_30d), icon: CalendarOff },
      ]}
    />
  );
}

function QuickActions() {
  const t = useTranslations();
  const tl = useTranslations("ledger.dashboard");
  const links = [
    { href: "/app/workers", label: tl("qa_add_worker"), icon: UserPlus },
    { href: "/app/payroll", label: t("dashboard.action_run_payroll"), icon: Banknote },
    { href: "/app/leave", label: tl("qa_leave"), icon: CalendarOff },
    { href: "/app/compliance", label: tl("qa_ssf"), icon: ClipboardCheck },
  ];
  return (
    <nav aria-label={tl("quick_actions")} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="text-fg-muted">{tl("quick_actions")}:</span>
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <Link key={l.href} href={l.href} className="inline-flex items-center gap-1.5 font-medium text-brand-text hover:underline">
            <Icon className="size-4" aria-hidden />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

function DashboardSkeleton({ supervisor }: { supervisor: boolean }) {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-[120px] rounded-dense" />
      {!supervisor ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-64 rounded-dense lg:col-span-7" />
          <Skeleton className="h-64 rounded-dense lg:col-span-5" />
        </div>
      ) : null}
      <Skeleton className="h-56 rounded-dense" />
    </div>
  );
}
