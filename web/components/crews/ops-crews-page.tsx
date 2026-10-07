"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandCoins, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { WorkerIdentity } from "@/components/shared/worker-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/date";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpsCrews, useOpsReferrals } from "@/lib/api/hooks/crews";
import type { CrewReferralStatus } from "@/lib/api/types-crews";
import { useFormat } from "@/lib/use-format";
import { ReferralsTable } from "./referrals-table";

const PAGE_SIZE = 25;

/** /ops/crews — naike crews and the referral payout queue. */
export function OpsCrewsPage() {
  const t = useTranslations();
  const tc = useTranslations("crews");
  const [tab, setTab] = React.useState<"crews" | "referrals">("crews");
  return (
    <div>
      <PageHeader title={t("nav.ops_crews")} description={tc("ops_description")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "crews" | "referrals")}>
        <TabsList className="mb-4">
          <TabsTrigger value="crews">
            <UsersRound className="size-4" aria-hidden />
            {tc("tab_crews")}
          </TabsTrigger>
          <TabsTrigger value="referrals">
            <HandCoins className="size-4" aria-hidden />
            {tc("tab_referrals")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="crews">
          <CrewsList />
        </TabsContent>
        <TabsContent value="referrals">
          <ReferralQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CrewsList() {
  const t = useTranslations();
  const tc = useTranslations("crews");
  const f = useFormat();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState<"true" | "false" | "all">("true");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [q, active]);
  const query = useOpsCrews({
    q: q || undefined,
    is_active: active === "all" ? undefined : active,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={tc("search_placeholder")} className="sm:w-72" />
        <Segmented
          label={t("common.status")}
          value={active}
          onChange={setActive}
          size="sm"
          options={[
            { value: "true", label: tc("active") },
            { value: "false", label: tc("inactive") },
            { value: "all", label: t("common.all") },
          ]}
        />
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        q ? (
          <EmptyState
            title={t("common.no_results")}
            action={
              <Button variant="secondary" onClick={() => setQ("")}>
                {t("common.clear_filters")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={UsersRound} title={tc("empty_title")} description={tc("empty_body")} />
        )
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table className="min-w-[760px]">
              <THead>
                <Tr>
                  <Th sticky>{tc("col_crew")}</Th>
                  <Th>{tc("col_lead")}</Th>
                  <Th numeric>{tc("col_members")}</Th>
                  <Th numeric>{tc("col_placed_90d")}</Th>
                  <Th numeric>{tc("col_earned")}</Th>
                  <Th numeric>{tc("col_pending")}</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <Tr
                    key={c.id}
                    className="cursor-pointer hover:bg-surface-hover/50"
                    onClick={() => router.push(`/ops/crews/${c.id}`)}
                  >
                    <RowHeader sticky>
                      <Link href={`/ops/crews/${c.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </Link>
                      {!c.is_active ? (
                        <Badge tone="neutral" className="ml-2">
                          {tc("inactive")}
                        </Badge>
                      ) : null}
                    </RowHeader>
                    <Td>
                      <WorkerIdentity worker={c.lead} size="sm" />
                    </Td>
                    <Td numeric>{f.digits(c.stats.members)}</Td>
                    <Td numeric>{f.digits(c.stats.placed_90d)}</Td>
                    <Td numeric>
                      <Money value={c.stats.earned_total} />
                    </Td>
                    <Td numeric>
                      <Money value={c.stats.pending_total} />
                    </Td>
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

const REFERRAL_FILTERS: (CrewReferralStatus | "all")[] = ["eligible", "pending", "paid", "void", "all"];

function ReferralQueue() {
  const t = useTranslations();
  const tc = useTranslations("crews");
  const [status, setStatus] = React.useState<CrewReferralStatus | "all">("eligible");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status]);
  const query = useOpsReferrals({ status: status === "all" ? undefined : status, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  return (
    <>
      <Toolbar>
        <Segmented
          label={t("common.status")}
          value={status}
          onChange={setStatus}
          size="sm"
          className="max-w-full overflow-x-auto"
          options={REFERRAL_FILTERS.map((s) => ({
            value: s,
            label: s === "all" ? t("common.all") : tc(`referral_status.${s}`),
          }))}
        />
        <p className="text-xs text-fg-muted sm:ml-auto">{tc("referrals.policy")}</p>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <ReferralsTable rows={rows} className={query.isFetching ? "opacity-70 transition-opacity" : undefined} />
          {rows.length ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
