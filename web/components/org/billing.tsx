"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, CircleDollarSign, FileText, Receipt, RefreshCcw, Users, Wallet } from "lucide-react";
import { useBillingSummary, useCharges } from "@/lib/api/hooks/org";
import { listResults, proxyHref } from "@/lib/api/client";
import { useOrgInvoices, useOrgSubscription } from "@/lib/api/hooks/billing";
import type { Invoice, InvoiceStatus } from "@/lib/api/types-billing";
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
/** Phase-1 pilot terms; the live numbers come from GET /org/billing/subscription. */
const PER_WORKER = 150;
const MINIMUM = 3000;
const INVOICE_TONE: Record<InvoiceStatus, "neutral" | "brand" | "success" | "danger"> = {
  draft: "neutral",
  issued: "brand",
  paid: "success",
  void: "danger",
};

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
          <div className="space-y-6 xl:col-span-2">
            <Invoices />
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
  const sub = useOrgSubscription();
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const workers = data?.active_workers ?? 0;
  const plan = sub.data?.plan;
  const perWorker = Number(plan?.per_active_worker ?? PER_WORKER);
  const minimum = Number(plan?.min_monthly ?? MINIMUM);
  const raw = Number(plan?.monthly_base ?? 0) + Math.max(0, workers - (plan?.included_workers ?? 0)) * perWorker;
  const unpaid = Number(data?.unpaid_total ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label={t("plan")}
        value={plan ? plan.code_label || plan.name : "—"}
        icon={BadgeCheck}
        tone="brand"
        loading={isLoading || sub.isLoading}
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
            ? raw < minimum
              ? t("estimate_minimum", { min: f.money(minimum) })
              : t("estimate_formula", { workers: f.digits(workers), rate: f.money(perWorker) })
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
                          {c.kind_label ?? t(`billing.kind_${c.kind}`)}
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
  const ti = useTranslations("invoices");
  const f = useFormat();
  const { data: sub } = useOrgSubscription();
  const plan = sub?.plan;
  const perWorker = plan ? Number(plan.per_active_worker) : PER_WORKER;
  const minimum = plan ? Number(plan.min_monthly) : MINIMUM;
  const items = [
    {
      icon: BadgeCheck,
      title: t("price_placement_title", { amount: f.money(plan?.placement_fee ?? 5000) }),
      body: t("price_placement_body"),
    },
    {
      icon: RefreshCcw,
      title: t("price_replacement_title"),
      body: t("price_replacement_body"),
    },
    {
      icon: Users,
      title: t("price_subscription_title", { rate: f.money(perWorker) }),
      body:
        plan && (Number(plan.monthly_base) > 0 || plan.included_workers > 0)
          ? ti("plan_formula", {
              base: f.money(plan.monthly_base),
              included: f.digits(plan.included_workers),
              rate: f.money(plan.per_active_worker),
              min: f.money(minimum),
            })
          : t("price_subscription_body", { min: f.money(minimum) }),
    },
  ];
  return (
    <Card className="h-fit">
      <CardHeader
        title={plan ? ti("your_plan", { plan: plan.code_label || plan.name }) : t("pricing_title")}
        description={sub?.started_on ? ti("plan_since", { date: f.bs(sub.started_on_bs) }) : t("pricing_hint")}
      />
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
        <p className="mt-3 text-xs text-fg-muted">{ti("change_plan_hint")}</p>
      </CardBody>
    </Card>
  );
}

function Invoices() {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const f = useFormat();
  const [page, setPage] = React.useState(1);
  const { data, isLoading, error, refetch, isPlaceholderData } = useOrgInvoices({ page, page_size: PAGE_SIZE });
  const rows = data?.results ?? [];
  const period = (inv: Invoice) =>
    inv.period_bs_year && inv.period_bs_month ? f.bsMonth(inv.period_bs_year, inv.period_bs_month) : null;
  return (
    <Card>
      <CardHeader title={t("title")} description={t("hint")} />
      <CardBody className="space-y-4">
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FileText} title={t("empty")} description={t("empty_body")} />
        ) : (
          <>
            <TableContainer className={isPlaceholderData ? "opacity-60" : undefined}>
              <Table>
                <THead>
                  <tr>
                    <Th>{t("number")}</Th>
                    <Th>{t("issued")}</Th>
                    <Th numeric>{t("total")}</Th>
                    <Th numeric className="max-sm:hidden">{t("balance")}</Th>
                    <Th>{tc("status")}</Th>
                    <Th>
                      <span className="sr-only">{t("pdf")}</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((inv) => (
                    <Tr key={inv.id}>
                      <Td className="whitespace-nowrap font-medium text-fg tabular">
                        {inv.number ?? "—"}
                        {period(inv) ? <span className="block text-xs font-normal text-fg-muted">{period(inv)}</span> : null}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="block tabular">{f.bs(inv.issue_date_bs)}</span>
                        <span className="block text-xs text-fg-muted">
                          {t("due", { date: f.bs(inv.due_date_bs) })}
                        </span>
                      </Td>
                      <Td numeric className="font-medium text-fg">
                        {f.money(inv.total)}
                        <span className="block text-xs font-normal text-fg-muted">
                          {t("incl_vat", { amount: f.money(inv.vat_amount) })}
                        </span>
                      </Td>
                      <Td numeric className="max-sm:hidden">{f.money(inv.balance_due)}</Td>
                      <Td>
                        <Badge tone={INVOICE_TONE[inv.status]}>{inv.status_label}</Badge>
                      </Td>
                      <Td>
                        <a
                          href={proxyHref(`/org/billing/invoices/${inv.id}/pdf`)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                          aria-label={t("open_pdf", { number: inv.number ?? "" })}
                        >
                          <FileText className="size-4" aria-hidden />
                          {t("pdf")}
                        </a>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} />
          </>
        )}
      </CardBody>
    </Card>
  );
}
