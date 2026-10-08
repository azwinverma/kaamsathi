"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { isApiError } from "@/lib/api/errors";
import { useOpsEmployer, useOpsEmployers, useVerifyEmployer } from "@/lib/api/hooks/risk";
import type { KybStatus, OpsEmployer } from "@/lib/api/types-risk";
import { useFormat } from "@/lib/use-format";
import { KybStatusBadge } from "./kyb-badges";
import { VerificationLadder, useKybLadder } from "@/components/ledger";
import { KybDocument } from "./kyb-documents";

const PAGE_SIZE = 25;
type Tab = KybStatus | "all";
const TABS: Tab[] = ["pending", "rejected", "unverified", "verified", "all"];

/** /ops/employers — KYB review queue with a document viewer (signed URLs) and verify/reject. */
export function EmployersQueue() {
  const t = useTranslations("risk.employers");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("pending");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const openId = params.get("id");
  React.useEffect(() => setPage(1), [tab, q]);

  const query = useOpsEmployers({
    verification_status: tab === "all" ? undefined : tab,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];
  const setOpen = (id: string | null) => router.replace(id ? `/ops/employers?id=${id}` : "/ops/employers", { scroll: false });

  return (
    <div>
      <PageHeader title={tn("ops_employers")} description={t("description")} />
      <Toolbar className="sm:justify-between">
        <Segmented
          label={tn("ops_employers")}
          value={tab}
          onChange={(v) => setTab(v)}
          className="max-w-full overflow-x-auto"
          options={TABS.map((s) => ({ value: s, label: t(`tab_${s}`) }))}
        />
        <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} className="sm:w-72" />
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building}
          title={q ? tc("no_results") : t(`empty_${tab}`)}
          action={
            q ? (
              <Button variant="secondary" onClick={() => setQ("")}>
                {tc("clear_filters")}
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
                  <Th>{t("col_employer")}</Th>
                  <Th className="max-md:hidden">{t("col_registration")}</Th>
                  <Th className="max-lg:hidden">{t("col_owner")}</Th>
                  <Th>{tc("status")}</Th>
                  <Th className="text-right">
                    <span className="sr-only">{tc("actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((o) => (
                  <Tr key={o.id} interactive onClick={() => setOpen(o.id)}>
                    <RowHeader>
                      <span className="block font-medium text-fg">{o.name}</span>
                      <span className="block text-xs font-normal text-fg-muted">
                        {[o.industry_label, o.district?.name_en].filter(Boolean).join(" · ")}
                      </span>
                    </RowHeader>
                    <Td className="tabular max-md:hidden">{o.registration_no || "—"}</Td>
                    <Td className="max-lg:hidden">
                      {o.owner ? (
                        <>
                          <span className="block text-fg">{o.owner.full_name || "—"}</span>
                          <span className="block text-xs text-fg-muted tabular">{o.owner.phone}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <KybStatusBadge status={o.verification_status} />
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant={o.verification_status === "pending" ? "primary" : "secondary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(o.id);
                        }}
                      >
                        {o.verification_status === "pending" ? t("review") : tc("view")}
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
      <ReviewDialog id={openId} onClose={() => setOpen(null)} />
    </div>
  );
}

function ReviewDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("risk.employers");
  const tc = useTranslations("common");
  const query = useOpsEmployer(id);
  const o = query.data;
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" closeLabel={tc("close")}>
        <DialogHeader
          title={o?.name ?? t("review_title")}
          description={o ? <KybStatusBadge status={o.verification_status} /> : undefined}
        />
        {query.isLoading || !o ? (
          <DialogBody className="space-y-4">
            {query.isError ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : (
              <>
                <Skeleton className="h-24 rounded-dense" />
                <Skeleton className="h-56 rounded-dense" />
              </>
            )}
          </DialogBody>
        ) : (
          <ReviewBody org={o} onClose={onClose} />
        )}
        {o ? null : (
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              {tc("close")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewBody({ org: o, onClose }: { org: OpsEmployer; onClose: () => void }) {
  const t = useTranslations("risk.employers");
  const tk = useTranslations("risk.kyb");
  const tAll = useTranslations();
  const f = useFormat();
  const verify = useVerifyEmployer();
  const [status, setStatus] = React.useState<"verified" | "rejected">("verified");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const decided = o.verification_status === "verified" || o.verification_status === "rejected";
  const tl = useTranslations("ledger.ops");
  const ladder = useKybLadder(o.verification_status, !!(o.registration_doc_url || o.pan_doc_url)).map((r) => ({ ...r, hint: undefined }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "rejected" && !note.trim()) {
      setError(t("reject_note_required"));
      return;
    }
    setError(null);
    verify.mutate(
      { id: o.id, status, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(status === "verified" ? t("verified_toast", { name: o.name }) : t("rejected_toast", { name: o.name }));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || tAll(`errors.${err.code}`) : tAll("errors.server_error")),
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
      <DialogBody className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <DescriptionList
          columns={2}
          items={[
            { label: tk("registration_no"), value: <span className="tabular">{o.registration_no || "—"}</span> },
            { label: tk("pan_no"), value: <span className="tabular">{o.pan_no || "—"}</span> },
            { label: t("industry"), value: o.industry_label },
            {
              label: t("address"),
              value: [o.address, o.municipality, o.district?.name_en].filter(Boolean).join(", ") || "—",
            },
            {
              label: t("contact"),
              value: [o.phone, o.email].filter(Boolean).join(" · ") || "—",
            },
            {
              label: t("col_owner"),
              value: o.owner ? `${o.owner.full_name || "—"} · ${o.owner.phone}` : "—",
            },
            { label: t("members"), value: f.number(o.members_count ?? 0) },
            { label: t("active_workers"), value: f.number(o.active_workers ?? 0) },
            {
              label: t("profile"),
              value: (
                <Link href={`/ops/organizations/${o.id}`} className="text-brand-text hover:underline">
                  {t("open_profile")}
                </Link>
              ),
            },
          ]}
        />
          <section className="lg:border-l lg:border-border lg:pl-6">
            <h3 className="mb-2 text-sm font-semibold text-fg">{tl("kyb_ladder")}</h3>
            <VerificationLadder rungs={ladder} dense label={tl("kyb_ladder")} />
          </section>
        </div>
        <section aria-labelledby="kyb-docs-title" className="space-y-3">
          <h3 id="kyb-docs-title" className="text-sm font-semibold text-fg">
            {t("documents")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <KybDocument label={tk("registration_doc")} url={o.registration_doc_url} name={o.registration_doc_name} />
            <KybDocument label={tk("pan_doc")} url={o.pan_doc_url} name={o.pan_doc_name} />
          </div>
          <p className="text-xs text-fg-muted">{t("checklist")}</p>
        </section>
        {decided ? (
          <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
            <p className="text-xs font-medium text-fg-muted">
              {t("last_decision")}
              {o.verified_at ? ` · ${f.dateTime(o.verified_at)}` : ""}
              {o.verified_by ? ` · ${o.verified_by.full_name}` : ""}
            </p>
            <p className="mt-0.5 whitespace-pre-line text-fg">{o.verification_note || "—"}</p>
          </div>
        ) : null}
        <section aria-labelledby="kyb-decision-title" className="space-y-3 border-t border-border pt-4">
          <h3 id="kyb-decision-title" className="text-sm font-semibold text-fg">
            {decided ? t("change_decision") : t("decision")}
          </h3>
          <FormError message={error} />
          <Segmented
            label={t("decision")}
            value={status}
            onChange={setStatus}
            options={[
              {
                value: "verified",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" aria-hidden />
                    {t("verify")}
                  </span>
                ),
              },
              {
                value: "rejected",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <XCircle className="size-4" aria-hidden />
                    {t("reject")}
                  </span>
                ),
              },
            ]}
          />
          <Field
            id="kyb-note"
            label={status === "rejected" ? t("reject_reason") : t("verify_note")}
            hint={status === "rejected" ? t("reject_hint") : undefined}
          >
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} />
          </Field>
        </section>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={verify.isPending}>
          {tAll("common.cancel")}
        </Button>
        <Button type="submit" variant={status === "rejected" ? "danger" : "primary"} loading={verify.isPending}>
          {status === "verified" ? t("verify") : t("reject")}
        </Button>
      </DialogFooter>
    </form>
  );
}
