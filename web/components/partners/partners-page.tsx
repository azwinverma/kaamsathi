"use client";
import * as React from "react";
import Link from "next/link";
import { BookOpen, Handshake, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useOpsPartners } from "@/lib/api/hooks/partners";
import { PARTNER_KINDS } from "@/lib/api/types-partners";
import { useFormat } from "@/lib/use-format";
import { PartnerDetailSheet } from "./partner-detail";
import { PartnerFormDialog } from "./partner-form-dialog";

const PAGE_SIZE = 25;

export function PartnersPage() {
  const t = useTranslations("partners");
  const tc = useTranslations("common");
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  React.useEffect(() => setPage(1), [q, kind]);

  const query = useOpsPartners({ q, kind, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href="/partners/docs" target="_blank">
                <BookOpen aria-hidden />
                {t("api_docs")}
              </Link>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("new")}
            </Button>
          </div>
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} />
        <div className="w-full sm:w-56">
          <NativeSelect
            aria-label={t("form.kind")}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder={t("all_kinds")}
            options={PARTNER_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
          />
        </div>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        q || kind ? (
          <EmptyState
            title={tc("no_results")}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ("");
                  setKind("");
                }}
              >
                {tc("clear_filters")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Handshake}
            title={t("empty_title")}
            description={t("empty_body")}
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t("new")}
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
                  <Th>{tc("name")}</Th>
                  <Th className="max-md:hidden">{t("form.regulator")}</Th>
                  <Th numeric>{t("stats.active_keys")}</Th>
                  <Th numeric className="max-sm:hidden">{t("stats.active_grants")}</Th>
                  <Th numeric className="max-lg:hidden">{t("stats.referrals")}</Th>
                  <Th>{tc("status")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <Tr key={p.id} interactive onClick={() => setSelected(p.id)}>
                    <RowHeader className="min-w-52">
                      <button
                        type="button"
                        className="text-left focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(p.id);
                        }}
                      >
                        <span className="block font-medium text-fg">{p.name}</span>
                        <span className="block text-xs text-fg-muted">{t(`kind.${p.kind}`)}</span>
                      </button>
                    </RowHeader>
                    <Td className="max-md:hidden">{p.regulator ? t(`regulator.${p.regulator}`) : "—"}</Td>
                    <Td numeric>{f.number(p.stats.active_keys ?? 0)}</Td>
                    <Td numeric className="max-sm:hidden">{f.number(p.stats.active_grants ?? 0)}</Td>
                    <Td numeric className="max-lg:hidden">{f.number(p.stats.referrals ?? 0)}</Td>
                    <Td>
                      <Badge tone={p.is_active ? "success" : "neutral"} dot>
                        {p.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
      <PartnerFormDialog open={creating} onOpenChange={setCreating} />
      <PartnerDetailSheet partnerId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
