"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Clock,
  Handshake,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DenseStatRow } from "@/components/ledger";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/avatar";
import { HoursOpenBadge } from "@/components/ops/ops-ui";
import { SHORTLIST_SLA_HOURS, hoursSince, slaTone, useDistrictLabel } from "@/components/ops/helpers";
import { useOpsDashboard, useOpsJobs, useOpsWorkers } from "@/lib/api/hooks/ops";
import { listResults } from "@/lib/api/client";
import { useFormat } from "@/lib/use-format";

export default function OpsDashboardPage() {
  const t = useTranslations("ops.dashboard");
  const tl = useTranslations("ledger.ops");
  const f = useFormat();
  const dash = useOpsDashboard();
  const d = dash.data;

  const verifiedPct = d && d.workers ? Math.round((d.verified_workers / d.workers) * 100) : null;
  const avg = d?.avg_hours_to_shortlist ?? null;
  const avgTone = avg === null ? "neutral" : slaTone(avg);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {dash.isError ? (
        <ErrorState error={dash.error} onRetry={() => dash.refetch()} className="mb-6" />
      ) : (
        <div className="mb-6 space-y-3">
          <DenseStatRow
            label={tl("queues_title")}
            loading={dash.isLoading}
            items={[
              {
                key: "pending",
                label: t("pending_verification"),
                value: f.number(d?.pending_verification),
                icon: d?.pending_verification ? Clock : BadgeCheck,
                tone: d?.pending_verification ? "warning" : "success",
                href: "/ops/verification",
                hint: t("pending_hint"),
                focal: true,
              },
              {
                key: "avg",
                label: t("avg_to_shortlist"),
                value: avg === null ? "—" : f.hours(avg),
                icon: Timer,
                tone: avgTone === "neutral" ? "neutral" : avgTone,
                hint: t("sla_target", { hours: f.digits(SHORTLIST_SLA_HOURS) }),
              },
              { key: "open", label: t("open_jobs"), value: f.number(d?.open_jobs), icon: Briefcase, href: "/ops/jobs" },
              { key: "hires", label: t("hires_30d"), value: f.number(d?.hires_30d), icon: Handshake, tone: "success" },
              { key: "workers", label: t("workers"), value: f.number(d?.workers), icon: Users, href: "/ops/workers" },
              {
                key: "verified",
                label: t("verified_workers"),
                value: f.number(d?.verified_workers),
                icon: ShieldCheck,
                tone: "verified",
                hint: verifiedPct !== null ? t("verified_pct", { pct: f.digits(verifiedPct) }) : undefined,
              },
              { key: "orgs", label: t("organizations"), value: f.number(d?.organizations), icon: Building2, href: "/ops/organizations" },
            ]}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <OpenJobsCard />
        <PendingQueueCard />
      </div>
    </>
  );
}

function OpenJobsCard() {
  const t = useTranslations("ops.dashboard");
  const tc = useTranslations("common");
  const f = useFormat();
  const q = useOpsJobs({ status: "open", page_size: 100 });
  const jobs = React.useMemo(
    () => [...listResults(q.data)].sort((a, b) => (b.hours_open ?? 0) - (a.hours_open ?? 0)).slice(0, 8),
    [q.data],
  );
  const overdue = listResults(q.data).filter((j) => (j.hours_open ?? 0) > SHORTLIST_SLA_HOURS).length;

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t("jobs_waiting")}
        description={overdue ? t("overdue_count", { count: overdue }) : t("jobs_waiting_hint")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/ops/jobs">
              {tc("view_all")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="px-2 pb-3">
        {q.isLoading ? (
          <ListSkeleton />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} className="border-0" />
        ) : jobs.length === 0 ? (
          <EmptyState icon={Briefcase} title={t("no_open_jobs")} className="m-3" />
        ) : (
          <ul>
            {jobs.map((j) => {
              const shortlisted = (j.counts?.shortlisted ?? 0) + (j.counts?.interview ?? 0) + (j.counts?.selected ?? 0);
              return (
                <li key={j.id}>
                  <Link
                    href={`/ops/jobs/${j.id}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{j.title}</p>
                      <p className="truncate text-xs text-fg-muted">
                        {j.organization?.name} · {f.name(j.trade)} ·{" "}
                        {t("openings_shortlisted", {
                          openings: f.digits(j.openings_count),
                          shortlisted: f.digits(shortlisted),
                        })}
                      </p>
                    </div>
                    <HoursOpenBadge hours={j.hours_open} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function PendingQueueCard() {
  const t = useTranslations("ops.dashboard");
  const f = useFormat();
  const district = useDistrictLabel();
  const q = useOpsWorkers({ verification_status: "pending", page_size: 6, ordering: "created_at" });
  const rows = q.data?.results ?? [];

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t("verification_queue")}
        description={q.data ? t("pending_count", { count: q.data.count }) : undefined}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/ops/verification">
              {t("start_reviewing")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="px-2 pb-3">
        {q.isLoading ? (
          <ListSkeleton />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} className="border-0" />
        ) : rows.length === 0 ? (
          <EmptyState icon={BadgeCheck} title={t("queue_clear")} className="m-3" />
        ) : (
          <ul>
            {rows.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/ops/verification?worker=${w.id}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-hover"
                >
                  <Avatar name={w.full_name} src={w.photo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{w.full_name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {district(w.current_district ?? w.permanent_district) || "—"}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-xs text-fg-muted tabular"
                    title={t("waiting")}
                  >
                    <Clock className="size-3.5" aria-hidden />
                    {f.hours(hoursSince(w.updated_at ?? w.created_at))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 px-3 py-1" aria-busy>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}
