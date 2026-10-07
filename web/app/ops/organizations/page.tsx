"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { Avatar } from "@/components/ui/avatar";
import { DateText } from "@/components/ui/date";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useDistrictLabel } from "@/components/ops/helpers";
import { useOpsOrganizations } from "@/lib/api/hooks/ops";
import { listResults } from "@/lib/api/client";
import { useFormat } from "@/lib/use-format";

const PAGE_SIZE = 25;

export default function OpsOrganizationsPage() {
  const t = useTranslations();
  const to = useTranslations("ops.orgs");
  const f = useFormat();
  const router = useRouter();
  const district = useDistrictLabel();
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [q]);

  const query = useOpsOrganizations({ q, page, page_size: PAGE_SIZE });
  const rows = listResults(query.data);
  const count = Array.isArray(query.data) ? query.data.length : (query.data?.count ?? 0);

  return (
    <>
      <PageHeader
        title={to("title")}
        description={query.data ? to("subtitle_count", { count }) : to("subtitle")}
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={to("search_placeholder")} />
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
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
          <EmptyState icon={Building2} title={to("empty_title")} description={to("empty_body")} />
        )
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{t("common.name")}</Th>
                  <Th className="max-md:hidden">{to("industry")}</Th>
                  <Th className="max-lg:hidden">{t("term.district")}</Th>
                  <Th numeric>{to("active_workers")}</Th>
                  <Th numeric>{to("open_jobs")}</Th>
                  <Th className="max-sm:hidden">{to("plan")}</Th>
                  <Th className="max-lg:hidden">{to("joined")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((o) => (
                  <Tr key={o.id} interactive onClick={() => router.push(`/ops/organizations/${o.id}`)}>
                    <RowHeader className="min-w-52">
                      <Link
                        href={`/ops/organizations/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Avatar name={o.name} src={o.logo} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{o.name}</span>
                          {!o.is_active ? (
                            <Badge tone="neutral" className="mt-0.5">
                              {to("inactive")}
                            </Badge>
                          ) : null}
                        </span>
                      </Link>
                    </RowHeader>
                    <Td className="max-md:hidden">{t(`industry.${o.industry}`)}</Td>
                    <Td className="max-lg:hidden">{district(o.district) || "—"}</Td>
                    <Td numeric>{f.number(o.active_workers ?? 0)}</Td>
                    <Td numeric>
                      {o.open_jobs ? (
                        <Badge tone="brand">{f.number(o.open_jobs)}</Badge>
                      ) : (
                        <span className="text-fg-subtle">{f.number(0)}</span>
                      )}
                    </Td>
                    <Td className="max-sm:hidden">
                      <Badge tone={o.plan === "pilot" ? "accent" : "outline"}>{to(`plan_${o.plan}`)}</Badge>
                    </Td>
                    <Td className="max-lg:hidden">
                      <DateText ad={o.created_at?.slice(0, 10)} inline />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          {!Array.isArray(query.data) ? (
            <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
