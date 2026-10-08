"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Users } from "lucide-react";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { DateText } from "@/components/ui/date";
import { DistrictSelect, TradeSelect } from "@/components/shared/selects";
import { VerificationBadge } from "@/components/shared/status-badge";
import { SkillChips } from "@/components/shared/worker-summary";
import { AvailabilityBadge } from "@/components/ops/ops-ui";
import { useDistrictLabel } from "@/components/ops/helpers";
import { useOpsWorkers } from "@/lib/api/hooks/ops";
import type { VerificationStatus } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";

const PAGE_SIZE = 25;
const STATUSES: VerificationStatus[] = ["pending", "verified", "unverified", "rejected"];

export default function OpsWorkersPage() {
  const t = useTranslations();
  const tw = useTranslations("ops.workers");
  const tm = useTranslations("moderation.workers");
  const f = useFormat();
  const router = useRouter();
  const district = useDistrictLabel();

  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [tradeQ, setTradeQ] = React.useState("");
  const [dist, setDist] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [avail, setAvail] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtersActive = !!(q || trade || tradeQ || dist || status || avail);
  React.useEffect(() => setPage(1), [q, trade, tradeQ, dist, status, avail]);

  const query = useOpsWorkers({
    q,
    trade,
    trade_q: tradeQ,
    district: dist,
    verification_status: status,
    is_available: avail,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];

  const clear = () => {
    setQ("");
    setTrade("");
    setTradeQ("");
    setDist("");
    setStatus("");
    setAvail("");
  };

  return (
    <>
      <PageHeader
        title={tw("title")}
        description={
          query.data ? tw("subtitle_count", { count: query.data.count }) : tw("subtitle")
        }
        actions={
          <Button asChild>
            <Link href="/ops/workers/new">
              <Plus aria-hidden />
              {tw("add")}
            </Link>
          </Button>
        }
      />

      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={tw("search_placeholder")} className="sm:w-80" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <div className="sm:w-44">
            <TradeSelect value={trade} onChange={setTrade} allowEmpty aria-label={t("term.trade")} placeholder={tw("all_trades")} />
          </div>
          <SearchInput
            value={tradeQ}
            onChange={setTradeQ}
            placeholder={tm("trade_q_placeholder")}
            label={tm("trade_q_label")}
            className="sm:w-48"
          />
          <div className="sm:w-44">
            <DistrictSelect value={dist} onChange={setDist} aria-label={t("term.district")} placeholder={tw("all_districts")} />
          </div>
          <div className="sm:w-40">
            <NativeSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={tw("verification")}
              placeholder={tw("all_statuses")}
              options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            />
          </div>
          <div className="sm:w-40">
            <NativeSelect
              value={avail}
              onChange={(e) => setAvail(e.target.value)}
              aria-label={tw("availability")}
              placeholder={tw("any_availability")}
              options={[
                { value: "true", label: t("ops.common.available") },
                { value: "false", label: t("ops.common.not_available") },
              ]}
            />
          </div>
        </div>
        {filtersActive ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            {t("common.clear_filters")}
          </Button>
        ) : null}
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <EmptyState
            title={t("common.no_results")}
            action={
              <Button variant="secondary" onClick={clear}>
                {t("common.clear_filters")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title={tw("empty_title")}
            description={tw("empty_body")}
            action={
              <Button asChild>
                <Link href="/ops/workers/new">
                  <Plus aria-hidden />
                  {tw("add")}
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{t("common.name")}</Th>
                  <Th>{tw("skills")}</Th>
                  <Th className="max-md:hidden">{t("term.district")}</Th>
                  <Th>{tw("verification")}</Th>
                  <Th className="max-sm:hidden">{tw("availability")}</Th>
                  <Th className="max-lg:hidden">{t("common.updated")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((w) => (
                  <Tr key={w.id} interactive onClick={() => router.push(`/ops/workers/${w.id}`)}>
                    <RowHeader>
                      <Link
                        href={`/ops/workers/${w.id}`}
                        className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Avatar name={w.full_name} src={w.photo} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{w.full_name}</span>
                          <span className="block text-xs font-normal text-fg-muted tabular">{f.phone(w.phone)}</span>
                        </span>
                      </Link>
                    </RowHeader>
                    <Td className="min-w-48">
                      {w.skills?.length ? <SkillChips skills={w.skills} max={2} /> : <span className="text-fg-subtle">—</span>}
                    </Td>
                    <Td className="max-md:hidden">{district(w.current_district ?? w.permanent_district) || "—"}</Td>
                    <Td>
                      <VerificationBadge status={w.verification_status} />
                    </Td>
                    <Td className="max-sm:hidden">
                      <AvailabilityBadge available={w.is_available} />
                    </Td>
                    <Td className="max-lg:hidden">
                      <DateText ad={w.updated_at?.slice(0, 10)} inline />
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
