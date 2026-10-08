"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Link2, ScrollText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker } from "@/components/ui/date";
import { EmptyState, ErrorState, TableSkeleton, errorMessage } from "@/components/ui/feedback";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useAuditLog, useVerifyAuditChain } from "@/lib/api/hooks/security";
import type { AuditEntry, AuditFilters } from "@/lib/api/types-security";
import { useFormat } from "@/lib/use-format";
import { compactFilters, prettyJson } from "./helpers";
import { Notice } from "./notice";
import { RequireStaffRole } from "./require-staff-role";

const PAGE_SIZE = 50;
type Draft = Required<Omit<AuditFilters, "page">>;
const EMPTY: Draft = { actor: "", organization: "", action: "", object_type: "", object_id: "", from: "", to: "" };
const TEXT_FIELDS = ["actor", "organization", "action", "object_type", "object_id"] as const;

export function AuditLogPage() {
  return (
    <RequireStaffRole roles={["superadmin"]}>
      <AuditLog />
    </RequireStaffRole>
  );
}

function AuditLog() {
  const t = useTranslations("security.audit");
  const tc = useTranslations();
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [applied, setApplied] = React.useState<Partial<Draft>>({});
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const verify = useVerifyAuditChain();

  const query = useAuditLog({ ...applied, page });
  const rows = query.data?.results ?? [];
  const count = query.data?.count ?? 0;
  const pageSizeRef = React.useRef(PAGE_SIZE);
  if (query.data?.next && rows.length) pageSizeRef.current = rows.length;
  const filtersActive = Object.keys(applied).length > 0;

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setApplied(compactFilters(draft));
    setPage(1);
  };
  const clear = () => {
    setDraft(EMPTY);
    setApplied({});
    setPage(1);
  };
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        meta={query.data ? <Badge tone="neutral">{t("count", { count })}</Badge> : null}
        actions={
          <Button variant="secondary" onClick={() => verify.mutate()} loading={verify.isPending}>
            <Link2 aria-hidden />
            {t("verify")}
          </Button>
        }
      />

      {verify.data || verify.isError ? (
        <div className="mb-4" aria-live="polite">
          {verify.isError ? (
            <Notice tone="danger" role="alert" title={t("verify_failed")}>
              {errorMessage(verify.error, tc)}
            </Notice>
          ) : verify.data?.ok ? (
            <Notice
              tone="success"
              role="status"
              title={t("verify_ok_title")}
              action={<DismissButton onClick={() => verify.reset()} />}
            >
              {t("verify_ok_body", { count: verify.data.checked })}
            </Notice>
          ) : verify.data ? (
            <Notice
              tone="danger"
              role="alert"
              title={t("verify_broken_title")}
              action={<DismissButton onClick={() => verify.reset()} />}
            >
              {t("verify_broken_body", {
                count: verify.data.checked,
                id: verify.data.first_broken_id ?? "—",
              })}
            </Notice>
          ) : null}
        </div>
      ) : null}

      <form
        onSubmit={apply}
        className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
        aria-label={tc("common.filters")}
      >
        {TEXT_FIELDS.map((k) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={`audit-${k}`}>{t(`filter_${k}`)}</Label>
            <Input
              id={`audit-${k}`}
              value={draft[k]}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
              placeholder={t(`filter_${k}_ph`)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">{t("filter_from")}</Label>
          <BsDatePicker
            id="audit-from"
            value={draft.from || null}
            max={draft.to || undefined}
            onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">{t("filter_to")}</Label>
          <BsDatePicker
            id="audit-to"
            value={draft.to || null}
            min={draft.from || undefined}
            onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit">{t("apply")}</Button>
          {filtersActive || JSON.stringify(draft) !== JSON.stringify(EMPTY) ? (
            <Button type="button" variant="ghost" onClick={clear}>
              {tc("common.clear_filters")}
            </Button>
          ) : null}
        </div>
      </form>

      {query.isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtersActive ? tc("common.no_results") : t("empty")}
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={clear}>
                {tc("common.clear_filters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th className="w-10">
                    <span className="sr-only">{t("col_details")}</span>
                  </Th>
                  <Th>{t("col_when")}</Th>
                  <Th>{t("col_actor")}</Th>
                  <Th>{t("col_action")}</Th>
                  <Th className="max-md:hidden">{t("col_object")}</Th>
                  <Th className="max-lg:hidden">{t("col_org")}</Th>
                  <Th className="max-lg:hidden">{t("col_ip")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <AuditRow key={r.id} entry={r} open={expanded.has(r.id)} onToggle={() => toggle(r.id)} />
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={pageSizeRef.current} count={count} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  const tc = useTranslations("common");
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={tc("close")}>
      <X aria-hidden />
    </Button>
  );
}

function AuditRow({ entry: r, open, onToggle }: { entry: AuditEntry; open: boolean; onToggle: () => void }) {
  const t = useTranslations("security.audit");
  const f = useFormat();
  const detailsId = `audit-${r.id}-details`;
  const changes = prettyJson(r.changes);
  return (
    <>
      <Tr>
        <Td className="w-10 pr-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={open ? t("hide_details") : t("show_details")}
          >
            {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          </Button>
        </Td>
        <RowHeader className="font-normal whitespace-nowrap">
          <span className="block tabular text-sm text-fg">{f.dateTime(r.created_at)}</span>
          <span className="block text-xs text-fg-muted tabular">#{f.digits(r.seq)}</span>
        </RowHeader>
        <Td className="min-w-40">
          {r.actor ? (
            <>
              <span className="block truncate font-medium text-fg">{r.actor.full_name || "—"}</span>
              <span className="block text-xs text-fg-muted tabular">{f.phone(r.actor.phone)}</span>
            </>
          ) : (
            <span className="text-fg-subtle">{t("system_actor")}</span>
          )}
        </Td>
        <Td>
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-fg">{r.action}</code>
        </Td>
        <Td className="max-w-64 max-md:hidden">
          <span className="block text-sm text-fg">{r.object_type}</span>
          <span className="block truncate font-mono text-xs text-fg-muted" title={r.object_id}>
            {r.object_id}
          </span>
        </Td>
        <Td className="max-w-48 truncate max-lg:hidden">{r.organization?.name ?? "—"}</Td>
        <Td className="font-mono text-xs whitespace-nowrap max-lg:hidden">{r.ip ?? "—"}</Td>
      </Tr>
      {open ? (
        <tr id={detailsId}>
          <td colSpan={7} className="border-b border-border bg-surface-muted/50 px-4 py-3">
            <dl className="mb-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 md:hidden">
              <div>
                <dt className="inline font-medium text-fg-muted">{t("col_object")}: </dt>
                <dd className="inline font-mono break-all">
                  {r.object_type} {r.object_id}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-fg-muted">{t("col_org")}: </dt>
                <dd className="inline">{r.organization?.name ?? "—"}</dd>
              </div>
            </dl>
            <p className="mb-1 text-xs font-medium text-fg-muted">{t("changes")}</p>
            {changes ? (
              <pre className="scrollbar-thin max-h-80 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-fg">
                {changes}
              </pre>
            ) : (
              <p className="text-xs text-fg-subtle">{t("no_changes")}</p>
            )}
            <p className="mt-2 text-xs text-fg-muted">
              <span className="font-medium">{t("hash")}:</span>{" "}
              <code className="font-mono break-all">{r.hash}</code>
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
