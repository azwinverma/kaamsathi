"use client";
import * as React from "react";
import Link from "next/link";
import { Building2, HandCoins, TrendingUp, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkillChips, WorkerIdentity } from "@/components/shared/worker-summary";
import { AvailabilityBadge } from "@/components/ops/ops-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useOpsCrew } from "@/lib/api/hooks/crews";
import { useFormat } from "@/lib/use-format";
import { ReferralsTable } from "./referrals-table";

/** /ops/crews/[id] — a naike's crew: members, placements and referral rewards. */
export function OpsCrewDetail({ id }: { id: string }) {
  const t = useTranslations();
  const tc = useTranslations("crews");
  const f = useFormat();
  const query = useOpsCrew(id);
  const crew = query.data;
  const back = { href: "/ops/crews", label: t("nav.ops_crews") };

  if (query.isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={back} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 rounded-lg" />
      </>
    );
  }
  if (query.isError || !crew) {
    return (
      <>
        <PageHeader title={tc("detail_title")} back={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={crew.name}
        back={back}
        description={tc("led_by", { name: crew.lead.full_name })}
        meta={
          <>
            <Badge tone={crew.is_active ? "success" : "neutral"} dot>
              {crew.is_active ? tc("active") : tc("inactive")}
            </Badge>
            <span className="text-xs text-fg-muted">{tc("since", { date: f.dateTime(crew.created_at) })}</span>
          </>
        }
        className="mb-0"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={tc("col_members")} value={f.digits(crew.stats.members)} icon={Users} />
        <StatCard label={tc("col_placed_90d")} value={f.digits(crew.stats.placed_90d)} icon={TrendingUp} tone="brand" />
        <StatCard label={tc("col_earned")} value={f.money(crew.stats.earned_total)} icon={Wallet} tone="success" />
        <StatCard label={tc("col_pending")} value={f.money(crew.stats.pending_total)} icon={HandCoins} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title={tc("members_title")} description={tc("members_description")} />
          <CardBody>
            {crew.members.length === 0 ? (
              <EmptyState icon={Users} title={tc("no_members")} />
            ) : (
              <ul className="divide-y divide-border">
                {crew.members.map((m) => (
                  <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <Link href={`/ops/workers/${m.id}`} className="block rounded-md hover:bg-surface-hover/50">
                        <WorkerIdentity worker={m} size="sm" />
                      </Link>
                      <SkillChips skills={m.skills} max={2} />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      {m.current_employer ? (
                        <Badge tone="outline">
                          <Building2 aria-hidden />
                          {m.current_employer.name}
                        </Badge>
                      ) : (
                        <AvailabilityBadge available={m.is_available} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader title={tc("lead_title")} />
          <CardBody className="space-y-3">
            <Link href={`/ops/workers/${crew.lead.id}`} className="block rounded-md hover:bg-surface-hover/50">
              <WorkerIdentity worker={crew.lead} size="lg" />
            </Link>
            <SkillChips skills={crew.lead.skills} />
            <p className="text-xs text-fg-muted">{tc("referrals.policy")}</p>
          </CardBody>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-fg">{tc("referrals.title")}</h2>
        <ReferralsTable rows={crew.referrals ?? []} showCrew={false} />
      </section>
    </div>
  );
}
