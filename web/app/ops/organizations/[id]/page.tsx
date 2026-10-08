"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, Receipt, Star, UserCog, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/avatar";
import { DateText } from "@/components/ui/date";
import { TBody, THead, Table, TableContainer, Td, Th, Tr, RowHeader } from "@/components/ui/table";
import { HoursOpenBadge } from "@/components/ops/ops-ui";
import { useDistrictLabel } from "@/components/ops/helpers";
import { useOpsJobs, useOpsOrganization } from "@/lib/api/hooks/ops";
import { listResults } from "@/lib/api/client";
import { useFormat } from "@/lib/use-format";

export default function OpsOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const to = useTranslations("ops.orgs");
  const tn = useTranslations("nav");
  const f = useFormat();
  const district = useDistrictLabel();
  const query = useOpsOrganization(id);
  const o = query.data;
  const back = { href: "/ops/organizations", label: tn("ops_organizations") };

  if (query.isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={back} />
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-dense" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-dense" />
      </>
    );
  }
  if (query.isError || !o) {
    return (
      <>
        <PageHeader title={to("title_fallback")} back={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </>
    );
  }

  const unpaid = Number(o.unpaid_total ?? 0);
  // Workers' private ratings, aggregated by the API (null below 3 ratings).
  const rep = o.employer_reputation ?? null;
  const location = [o.address, o.municipality, o.ward ? to("ward_n", { n: f.digits(o.ward) }) : null, district(o.district)]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={o.name} src={o.logo} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{o.name}</span>
              {o.name_ne ? (
                <span className="block text-sm font-normal text-fg-muted" lang="ne">
                  {o.name_ne}
                </span>
              ) : null}
            </span>
          </span>
        }
        meta={
          <>
            <Badge tone="outline">{t(`industry.${o.industry}`)}</Badge>
            <Badge tone={o.plan === "pilot" ? "accent" : "brand"}>{to(`plan_${o.plan}`)}</Badge>
            {!o.is_active ? <Badge tone="neutral">{to("inactive")}</Badge> : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label={to("active_workers")} value={f.number(o.active_workers ?? 0)} icon={Users} tone="success" />
        <StatCard label={to("open_jobs")} value={f.number(o.open_jobs ?? 0)} icon={Briefcase} tone="brand" />
        <StatCard label={to("members")} value={f.number(o.members_count ?? o.members?.length ?? 0)} icon={UserCog} />
        <StatCard
          label={to("unpaid")}
          value={f.money(o.unpaid_total ?? 0)}
          icon={Receipt}
          tone={unpaid > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label={to("reputation")}
          value={rep ? `${f.number(rep.pay_on_time_avg)} · ${f.number(rep.conditions_avg)}` : "—"}
          icon={Star}
          hint={rep ? to("reputation_hint", { count: rep.count }) : to("reputation_none")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-6">
          <OrgJobs orgId={o.id} />
          <Card>
            <CardHeader title={to("members")} />
            {o.members?.length ? (
              <TableContainer className="rounded-t-none border-x-0 border-b-0 shadow-none">
                <Table>
                  <THead>
                    <tr>
                      <Th>{t("common.name")}</Th>
                      <Th>{t("term.phone")}</Th>
                      <Th>{to("role")}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {o.members.map((m) => (
                      <Tr key={m.id}>
                        <RowHeader>{m.user.full_name || "—"}</RowHeader>
                        <Td className="whitespace-nowrap tabular">
                          <a href={`tel:${m.user.phone}`} className="hover:underline">
                            {f.phone(m.user.phone)}
                          </a>
                        </Td>
                        <Td>
                          <Badge tone="outline">{t(`role.${m.role}`)}</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            ) : (
              <CardBody>
                <p className="text-sm text-fg-muted">{to("no_members")}</p>
              </CardBody>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title={to("details")} />
          <CardBody>
            <DescriptionList
              columns={1}
              items={[
                { label: to("location"), value: location || "—" },
                {
                  label: t("term.phone"),
                  value: o.phone ? (
                    <a href={`tel:${o.phone}`} className="tabular hover:underline">
                      {f.phone(o.phone)}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                { label: t("term.email"), value: o.email || "—" },
                { label: t("term.pan"), value: o.pan_no ? <span className="tabular">{o.pan_no}</span> : "—" },
                { label: to("vat"), value: o.vat_registered ? t("common.yes") : t("common.no") },
                { label: to("ssf_employer_no"), value: o.ssf_employer_no || "—" },
                { label: to("weekly_off"), value: f.weekday(o.weekly_off_day, true) },
                { label: to("joined"), value: <DateText ad={o.created_at?.slice(0, 10)} /> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function OrgJobs({ orgId }: { orgId: string }) {
  const t = useTranslations();
  const to = useTranslations("ops.orgs");
  const f = useFormat();
  const q = useOpsJobs({ organization: orgId, status: "open", page_size: 100 });
  const rows = React.useMemo(
    () => [...listResults(q.data)].sort((a, b) => (b.hours_open ?? 0) - (a.hours_open ?? 0)),
    [q.data],
  );
  return (
    <Card>
      <CardHeader title={to("open_jobs")} />
      {q.isLoading ? (
        <CardBody className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </CardBody>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="mx-5 mb-5" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Briefcase} title={to("no_open_jobs")} className="mx-5 mb-5" />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((j) => (
            <li key={j.id}>
              <Link
                href={`/ops/jobs/${j.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{j.title}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {f.name(j.trade)} · {t("ops.jobs.openings")}: {f.digits(j.openings_count)}
                  </p>
                </div>
                <HoursOpenBadge hours={j.hours_open} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
