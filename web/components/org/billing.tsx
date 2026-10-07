"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, CircleDollarSign, Receipt, RefreshCcw, Users, Wallet } from "lucide-react";
import { useBillingSummary, useCharges } from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import type { ChargeKind, ChargeListItem, ChargeStatus } from "@/lib/api/types";
import { adToBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { useSession } from "@/components/providers/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { NoAccess } from "./no-access";

const PAGE_SIZE = 25;
const PER_WORKER = 150;
const MINIMUM = 3000;

export function BillingView() {
  const t = useTranslations("billing");
  const { isAdmin } = useSession();
  if (!isAdmin) return <NoAccess description={t("admins_only")} />;
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-6">
        <Summary />
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Charges />
          </div>
          <Pricing />
        </div>
      </div>
    </div>
  );
}

function Summary() {
  const t = useTranslations("billing");
  const f = useFormat();
  const { data, isLoading, error, refetch } = useBillingSummary();
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const workers = data?.active_workers ?? 0;
  const raw = workers * PER_WORKER;
  const unpaid = Number(data?.unpaid_total ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label={t("plan")}
        value={data ? t(`plan_${data.plan}`) : "—"}
        icon={BadgeCheck}
        tone="brand"
        loading={isLoading}
      />
      <StatCard
        label={t("active_workers")}
        value={f.digits(workers)}
        icon={Users}
        loading={isLoading}
        href="/app/workers"
      />
      <StatCard
        label={t("monthly_estimate")}
        value={f.money(data?.monthly_estimate)}
        icon={CircleDollarSign}
        tone="success"
        loading={isLoading}
        hint={
          data
            ? raw < MINIMUM
              ? t("estimate_minimum", { min: f.money(MINIMUM) })
              : t("estimate_formula", { workers: f.digits(workers), rate: f.money(PER_WORKER) })
            : undefined
        }
      />
      <StatCard
        label={t("unpaid_total")}
        value={f.money(data?.unpaid_total)}
        icon={Wallet}
        tone={unpaid > 0 ? "warning" : "neutral"}
        loading={isLoading}
        hint={data && unpaid === 0 ? t("all_paid") : undefined}
      />
    </div>
  );
}

function Charges() {
  const t = useTranslations();
  const f = useFormat();
  const [page, setPage] = React.useState(1);
  const [kind, setKind] = React.useState<"" | ChargeKind>("");
  const [status, setStatus] = React.useState<"" | ChargeStatus>("");
  const params = { page, page_size: PAGE_SIZE, kind: kind || undefined, status: status || undefined };
  const { data, isLoading, error, refetch, isPlaceholderData } = useCharges(params);
  const rows = listResults(data);
  const count = data && !Array.isArray(data) ? data.count : rows.length;
  const filtered = !!kind || !!status;

  const period = (c: ChargeListItem) =>
    c.bs_year && c.bs_month ? f.bsMonth(c.bs_year, c.bs_month) : null;

  return (
    <Card>
      <CardHeader
        title={t("billing.charges")}
        description={t("billing.charges_hint")}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select
            aria-label={t("billing.kind")}
            className="sm:w-44"
            value={kind}
            allowEmpty
            emptyLabel={t("billing.all_kinds")}
            placeholder={t("billing.all_kinds")}
            onValueChange={(v) => {
              setKind(v as "" | ChargeKind);
              setPage(1);
            }}
            options={[
              { value: "placement", label: t("billing.kind_placement") },
              { value: "subscription", label: t("billing.kind_subscription") },
            ]}
          />
          <Select
            aria-label={t("common.status")}
            className="sm:w-44"
            value={status}
            allowEmpty
            emptyLabel={t("billing.all_statuses")}
            placeholder={t("billing.all_statuses")}
            onValueChange={(v) => {
              setStatus(v as "" | ChargeStatus);
              setPage(1);
            }}
            options={(["unpaid", "paid", "waived"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))}
          />
        </div>
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={filtered ? t("common.no_results") : t("billing.charges_empty")}
            description={filtered ? undefined : t("billing.charges_empty_body")}
          />
        ) : (
          <>
            <TableContainer className={isPlaceholderData ? "opacity-60" : undefined}>
              <Table>
                <THead>
                  <tr>
                    <Th>{t("common.date")}</Th>
                    <Th>{t("common.description")}</Th>
                    <Th numeric>{t("common.amount")}</Th>
                    <Th>{t("common.status")}</Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((c) => (
                    <Tr key={c.id}>
                      <Td className="whitespace-nowrap">
                        <span className="block text-fg tabular">{f.bs(adToBs(todayIso(new Date(c.created_at))))}</span>
                        {period(c) ? <span className="block text-xs text-fg-muted">{period(c)}</span> : null}
                      </Td>
                      <Td>
                        <Badge tone={c.kind === "placement" ? "accent" : "brand"} className="mb-1">
                          {t(`billing.kind_${c.kind}`)}
                        </Badge>
                        <p className="text-sm text-fg-body">{c.description || "—"}</p>
                      </Td>
                      <Td numeric className="font-medium text-fg">
                        {f.money(c.amount)}
                      </Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Pricing() {
  const t = useTranslations("billing");
  const f = useFormat();
  const items = [
    {
      icon: BadgeCheck,
      title: t("price_placement_title", { amount: f.money(5000) }),
      body: t("price_placement_body"),
    },
    {
      icon: RefreshCcw,
      title: t("price_replacement_title"),
      body: t("price_replacement_body"),
    },
    {
      icon: Users,
      title: t("price_subscription_title", { rate: f.money(PER_WORKER) }),
      body: t("price_subscription_body", { min: f.money(MINIMUM) }),
    },
  ];
  return (
    <Card className="h-fit">
      <CardHeader title={t("pricing_title")} description={t("pricing_hint")} />
      <CardBody>
        <ul className="space-y-4">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="text-sm text-fg-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-md bg-success-subtle px-3 py-2.5 text-sm text-success">{t("workers_never_pay")}</p>
      </CardBody>
    </Card>
  );
}
