"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Clock, Download, Lock, X } from "lucide-react";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useOpsPrivacyRequests } from "@/lib/api/hooks/privacy";
import {
  PRIVACY_REQUEST_KINDS,
  PRIVACY_REQUEST_STATUSES,
  type PrivacyProcessAction,
  type PrivacyRequest,
  type PrivacyRequestKind,
  type PrivacyRequestStatus,
} from "@/lib/api/types-privacy";
import { useFormat } from "@/lib/use-format";
import { PRIVACY_STATUS_TONE, canProcess, exportFileState, privacyDownloadHref } from "./helpers";
import { ProcessDialog } from "./process-dialog";

/** Fallback page size until a full page tells us the server's; used only for the page count. */
const PAGE_SIZE = 25;

export function PrivacyRequestsPage() {
  const t = useTranslations();
  const tp = useTranslations("privacy.ops");
  const [status, setStatus] = React.useState<PrivacyRequestStatus | "">("");
  const [kind, setKind] = React.useState<PrivacyRequestKind | "">("");
  const [page, setPage] = React.useState(1);
  const [target, setTarget] = React.useState<{
    request: PrivacyRequest;
    action: PrivacyProcessAction;
  } | null>(null);

  React.useEffect(() => setPage(1), [status, kind]);

  const query = useOpsPrivacyRequests({ status, kind, page });
  const open = useOpsPrivacyRequests({ status: "received", page: 1 });
  const rows = query.data?.results ?? [];
  const count = query.data?.count ?? 0;
  // Learn the server's page size from any full page (one that has a next link).
  const pageSizeRef = React.useRef(PAGE_SIZE);
  if (query.data?.next && rows.length) pageSizeRef.current = rows.length;
  const pageSize = pageSizeRef.current;
  const filtersActive = !!(status || kind);
  const clear = () => {
    setStatus("");
    setKind("");
  };

  return (
    <>
      <PageHeader
        title={tp("title")}
        description={tp("subtitle")}
        meta={
          query.data ? (
            <>
              <Badge tone="neutral">{tp("count", { count })}</Badge>
              {open.data?.count ? (
                <Badge tone="warning">{tp("open_count", { count: open.data.count })}</Badge>
              ) : null}
            </>
          ) : null
        }
      />

      <Toolbar>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <div className="sm:w-48">
            <NativeSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as PrivacyRequestStatus | "")}
              aria-label={tp("filter_status")}
              placeholder={tp("all_statuses")}
              options={PRIVACY_REQUEST_STATUSES.map((s) => ({
                value: s,
                label: t(`privacy.status.${s}`),
              }))}
            />
          </div>
          <div className="sm:w-48">
            <NativeSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as PrivacyRequestKind | "")}
              aria-label={tp("filter_kind")}
              placeholder={tp("all_kinds")}
              options={PRIVACY_REQUEST_KINDS.map((k) => ({
                value: k,
                label: t(`privacy.kind.${k}`),
              }))}
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
        <TableSkeleton rows={6} cols={6} />
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
          <EmptyState icon={Lock} title={tp("empty_title")} description={tp("empty_body")} />
        )
      ) : (
        <>
          <TableContainer
            className={query.isFetching ? "opacity-70 transition-opacity" : undefined}
          >
            <Table>
              <THead>
                <tr>
                  <Th>{tp("col_worker")}</Th>
                  <Th>{tp("col_kind")}</Th>
                  <Th>{tp("col_status")}</Th>
                  <Th className="max-sm:hidden">{tp("col_created")}</Th>
                  <Th className="max-lg:hidden">{tp("col_details")}</Th>
                  <Th className="text-right">{tp("col_actions")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <RequestRow
                    key={r.id}
                    request={r}
                    onAction={(action) => setTarget({ request: r, action })}
                  />
                ))}
              </TBody>
            </Table>
          </TableContainer>
          {count > rows.length || page > 1 ? (
            <div className="mt-4">
              <Pagination page={page} pageSize={pageSize} count={count} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      <ProcessDialog
        request={target?.request ?? null}
        action={target?.action ?? "approve"}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
      />
    </>
  );
}

function RequestRow({
  request: r,
  onAction,
}: {
  request: PrivacyRequest;
  onAction: (action: PrivacyProcessAction) => void;
}) {
  const t = useTranslations();
  const tp = useTranslations("privacy.ops");
  const f = useFormat();
  const file = exportFileState(r);
  const name = r.worker?.full_name || r.user?.full_name || "—";

  return (
    <Tr>
      <RowHeader className="min-w-48">
        {r.worker ? (
          <Link
            href={`/ops/workers/${r.worker.id}`}
            className="text-fg block truncate font-medium hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="text-fg block truncate font-medium">{name}</span>
        )}
        <span className="text-fg-muted tabular block truncate text-xs font-normal">
          {r.worker ? f.digits(r.worker.phone_masked) : tp("no_worker")}
        </span>
        <span className="text-fg-muted block text-xs font-normal sm:hidden">
          {f.dateTime(r.created_at)}
        </span>
      </RowHeader>
      <Td>
        <span className="whitespace-nowrap">
          {t.has(`privacy.kind.${r.kind}`) ? t(`privacy.kind.${r.kind}`) : r.kind_label}
        </span>
      </Td>
      <Td>
        <Badge tone={PRIVACY_STATUS_TONE[r.status] ?? "neutral"} dot>
          {t.has(`privacy.status.${r.status}`) ? t(`privacy.status.${r.status}`) : r.status_label}
        </Badge>
      </Td>
      <Td className="tabular whitespace-nowrap max-sm:hidden">{f.dateTime(r.created_at)}</Td>
      <Td className="max-w-80 max-lg:hidden">
        <p className="text-fg-body line-clamp-2 text-sm" title={r.details ?? undefined}>
          {r.details || <span className="text-fg-subtle">{tp("no_details")}</span>}
        </p>
        {r.response_note ? (
          <p className="text-fg-muted mt-0.5 line-clamp-2 text-xs" title={r.response_note}>
            <span className="font-medium">{tp("response_note")}:</span> {r.response_note}
          </p>
        ) : null}
        {r.handled_by ? (
          <p className="text-fg-subtle mt-0.5 text-xs">
            {tp("handled_by", { name: r.handled_by.full_name })}
            {r.completed_at
              ? ` · ${tp("completed_on", { date: f.dateTime(r.completed_at) })}`
              : null}
          </p>
        ) : null}
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          {canProcess(r) ? (
            <>
              <Button size="sm" variant="danger-outline" onClick={() => onAction("reject")}>
                <X aria-hidden />
                {tp("reject")}
              </Button>
              <Button size="sm" onClick={() => onAction("approve")}>
                <Check aria-hidden />
                {tp("approve")}
              </Button>
            </>
          ) : null}
          {file === "ready" ? (
            <Button asChild size="sm" variant="secondary">
              <a
                href={privacyDownloadHref(r.id)}
                download
                title={
                  r.file_expires_at
                    ? tp("download_expires", { date: f.dateTime(r.file_expires_at) })
                    : undefined
                }
              >
                <Download aria-hidden />
                {tp("download")}
              </a>
            </Button>
          ) : file === "preparing" ? (
            <span className="text-fg-muted inline-flex items-center gap-1 text-xs">
              <Clock className="size-3.5" aria-hidden />
              {tp("export_preparing")}
            </span>
          ) : file === "expired" ? (
            <span className="text-fg-subtle text-xs">{tp("export_expired")}</span>
          ) : null}
        </div>
      </Td>
    </Tr>
  );
}
