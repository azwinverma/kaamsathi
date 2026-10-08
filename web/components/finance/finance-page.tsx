"use client";
import * as React from "react";
import { Banknote, CheckCircle2, FileText, Info, Landmark, Pencil, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { HBarList, ChartCard, type Datum } from "@/components/insights/charts";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { NativeSelect } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinanceOffers, useFinanceReferrals, useFinanceSummary } from "@/lib/api/hooks/finance";
import { useOpsPartners } from "@/lib/api/hooks/partners";
import { FINANCE_REFERRAL_STATUSES, type FinanceOffer, type FinanceReferralStatus } from "@/lib/api/types-finance";
import { useFormat } from "@/lib/use-format";
import { OfferFormDialog } from "./offer-form-dialog";

const PAGE_SIZE = 25;

export const REFERRAL_TONE: Record<FinanceReferralStatus, BadgeTone> = {
  submitted: "brand",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  disbursed: "success",
  closed: "neutral",
};

export function FinancePage() {
  const t = useTranslations("finance");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="mb-4 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-fg-muted">
        <Info className="mt-px size-4 shrink-0 text-brand-text" aria-hidden />
        {t("rules_note")}
      </p>
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">{t("tabs.summary")}</TabsTrigger>
          <TabsTrigger value="offers">{t("tabs.offers")}</TabsTrigger>
          <TabsTrigger value="referrals">{t("tabs.referrals")}</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <Summary />
        </TabsContent>
        <TabsContent value="offers">
          <Offers />
        </TabsContent>
        <TabsContent value="referrals">
          <Referrals />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Summary() {
  const t = useTranslations("finance");
  const f = useFormat();
  const query = useFinanceSummary();
  if (query.isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const s = query.data;
  if (!s) return null;
  const pct = (v: number | null) => (v === null ? "—" : `${f.number(v * 100, { decimals: 1 })}%`);
  const statusRows: Datum[] = s.by_status.map((b) => ({
    key: b.status,
    label: t(`status.${b.status}`),
    value: b.count,
    display: f.number(b.count),
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("summary.referrals")} value={f.number(s.total)} icon={FileText} tone="brand" />
        <StatCard label={t("summary.approval_rate")} value={pct(s.approval_rate)} icon={CheckCircle2} hint={t("summary.approval_hint")} />
        <StatCard
          label={t("summary.disbursed")}
          value={f.money(s.disbursed_total)}
          icon={Banknote}
          hint={t("summary.disbursed_hint")}
        />
        <StatCard
          label={t("summary.verified_workers")}
          value={f.number(s.workers_with_verified_earnings)}
          icon={Users}
          hint={t("summary.active_offers", { count: s.active_offers })}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("summary.by_status")}
          table={{
            columns: [
              { key: "status", label: t("table.status") },
              { key: "count", label: t("table.count"), numeric: true },
            ],
            rows: statusRows.map((r) => ({ status: r.label, count: r.display })),
          }}
        >
          <HBarList rows={statusRows} ariaLabel={t("summary.by_status")} />
        </ChartCard>
        <ChartCard title={t("summary.by_partner")}>
          {s.by_partner.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">{t("summary.none_yet")}</p>
          ) : (
            <TableContainer className="shadow-none">
              <Table>
                <THead>
                  <tr>
                    <Th>{t("table.partner")}</Th>
                    <Th numeric>{t("table.total")}</Th>
                    <Th numeric>{t("table.open")}</Th>
                    <Th numeric>{t("summary.approval_rate")}</Th>
                    <Th numeric className="max-sm:hidden">{t("summary.disbursed")}</Th>
                  </tr>
                </THead>
                <TBody>
                  {s.by_partner.map((p) => (
                    <Tr key={p.partner.id}>
                      <RowHeader>{p.partner.name}</RowHeader>
                      <Td numeric>{f.number(p.total)}</Td>
                      <Td numeric>{f.number(p.open)}</Td>
                      <Td numeric>{pct(p.approval_rate)}</Td>
                      <Td numeric className="max-sm:hidden">{f.money(p.disbursed_total)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function usePartnerOptions() {
  const partners = useOpsPartners({ page_size: 100 });
  return (partners.data?.results ?? []).map((p) => ({ value: p.id, label: p.name }));
}

function Offers() {
  const t = useTranslations("finance");
  const f = useFormat();
  const [partner, setPartner] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<FinanceOffer | null>(null);
  const [creating, setCreating] = React.useState(false);
  React.useEffect(() => setPage(1), [partner]);
  const partnerOptions = usePartnerOptions();
  const query = useFinanceOffers({ partner, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  return (
    <>
      <Toolbar className="sm:justify-between">
        <div className="w-full sm:w-64">
          <NativeSelect
            aria-label={t("table.partner")}
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            placeholder={t("all_partners")}
            options={partnerOptions}
          />
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {t("offers.new")}
        </Button>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Landmark} title={t("offers.empty_title")} description={t("offers.empty_body")} />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("offers.title_col")}</Th>
                  <Th className="max-md:hidden">{t("table.partner")}</Th>
                  <Th numeric className="max-sm:hidden">{t("offers.min_months")}</Th>
                  <Th numeric className="max-lg:hidden">{t("offers.min_avg_net")}</Th>
                  <Th numeric className="max-lg:hidden">{t("offers.max_amount")}</Th>
                  <Th>{t("table.status")}</Th>
                  <Th className="w-12">
                    <span className="sr-only">{t("table.actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((o) => (
                  <Tr key={o.id}>
                    <RowHeader className="min-w-48">
                      <span className="block font-medium text-fg">{f.locale === "ne" && o.title_ne ? o.title_ne : o.title}</span>
                      <span className="block text-xs text-fg-muted">{t(`kind.${o.kind}`)}</span>
                    </RowHeader>
                    <Td className="max-md:hidden">{o.partner.name}</Td>
                    <Td numeric className="max-sm:hidden">{f.number(o.min_verified_months)}</Td>
                    <Td numeric className="max-lg:hidden">{o.min_avg_net ? f.money(o.min_avg_net) : "—"}</Td>
                    <Td numeric className="max-lg:hidden">{o.max_amount ? f.money(o.max_amount) : "—"}</Td>
                    <Td>
                      <Badge tone={o.is_active ? "success" : "neutral"} dot>
                        {o.is_active ? t("offers.active") : t("offers.inactive")}
                      </Badge>
                    </Td>
                    <Td>
                      <Button variant="ghost" size="icon-sm" aria-label={t("offers.edit", { title: o.title })} onClick={() => setEditing(o)}>
                        <Pencil aria-hidden />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
      <OfferFormDialog
        open={creating || !!editing}
        offer={editing}
        partnerOptions={partnerOptions}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}

function Referrals() {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const f = useFormat();
  const [status, setStatus] = React.useState("");
  const [partner, setPartner] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status, partner]);
  const partnerOptions = usePartnerOptions();
  const query = useFinanceReferrals({ status, partner, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  return (
    <>
      <Toolbar>
        <div className="w-full sm:w-52">
          <NativeSelect
            aria-label={t("table.status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder={t("all_statuses")}
            options={FINANCE_REFERRAL_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          />
        </div>
        <div className="w-full sm:w-64">
          <NativeSelect
            aria-label={t("table.partner")}
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            placeholder={t("all_partners")}
            options={partnerOptions}
          />
        </div>
      </Toolbar>
      <p className="mb-3 text-xs text-fg-muted">{t("referrals.status_note")}</p>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={status || partner ? tc("no_results") : t("referrals.empty_title")}
          description={status || partner ? undefined : t("referrals.empty_body")}
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("referrals.worker")}</Th>
                  <Th>{t("referrals.offer")}</Th>
                  <Th className="max-md:hidden">{t("table.partner")}</Th>
                  <Th numeric className="max-sm:hidden">{t("referrals.requested")}</Th>
                  <Th numeric className="max-lg:hidden">{t("referrals.approved_amount")}</Th>
                  <Th>{t("table.status")}</Th>
                  <Th className="max-lg:hidden">{t("referrals.updated")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <RowHeader>{r.worker?.full_name ?? "—"}</RowHeader>
                    <Td>
                      <span className="block">{f.locale === "ne" && r.offer.title_ne ? r.offer.title_ne : r.offer.title}</span>
                      {r.partner_ref ? <span className="block font-mono text-xs text-fg-muted">{r.partner_ref}</span> : null}
                    </Td>
                    <Td className="max-md:hidden">{r.partner?.name ?? "—"}</Td>
                    <Td numeric className="max-sm:hidden">{r.amount_requested ? f.money(r.amount_requested) : "—"}</Td>
                    <Td numeric className="max-lg:hidden">{r.amount_approved ? f.money(r.amount_approved) : "—"}</Td>
                    <Td>
                      <Badge tone={REFERRAL_TONE[r.status]}>{t(`status.${r.status}`)}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap max-lg:hidden">{f.dateTime(r.updated_at)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
