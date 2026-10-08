"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LifeBuoy, Plus, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupportCase, useSupportCases } from "@/lib/api/hooks/support";
import type { SupportCase } from "@/lib/api/types-support";
import { useFormat } from "@/lib/use-format";
import { CaseStatusBadge, PriorityBadge, SafetyBadges } from "./case-badges";
import { CaseThread } from "./case-thread";
import { NewCaseDialog } from "./new-case-dialog";

const PAGE_SIZE = 20;
type Tab = "active" | "resolved" | "all";
const TAB_STATUS: Record<Tab, string | undefined> = {
  active: "open,pending_user",
  resolved: "resolved,closed",
  all: undefined,
};

/** /app/support — the organisation's help-desk cases (any member; supervisors see their own). */
export function OrgSupportPage() {
  const t = useTranslations("support.org");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("active");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [dialog, setDialog] = React.useState<null | "case" | "safety">(null);
  React.useEffect(() => setPage(1), [tab, q]);
  const query = useSupportCases("org", { status: TAB_STATUS[tab], q: q || undefined, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={tn("support")}
        description={t("description")}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/help?audience=employer">
                <BookOpen aria-hidden />
                {t("help_center")}
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => setDialog("safety")}>
              <ShieldAlert aria-hidden />
              {t("report_safety")}
            </Button>
            <Button onClick={() => setDialog("case")}>
              <Plus aria-hidden />
              {t("new_case")}
            </Button>
          </>
        }
      />
      <Toolbar className="sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {(Object.keys(TAB_STATUS) as Tab[]).map((s) => (
              <TabsTrigger key={s} value={s}>
                {t(`tab_${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} className="sm:w-72" />
      </Toolbar>
      {query.isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-dense" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={q ? tc("no_results") : t("empty_title")}
          description={q ? undefined : t("empty_body")}
          action={
            q ? undefined : (
              <Button onClick={() => setDialog("case")}>
                <Plus aria-hidden />
                {t("new_case")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id}>
                <CaseRow c={c} />
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
      <NewCaseDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        scope="org"
        safety={dialog === "safety"}
        onCreated={(c) => router.push(`/app/support/${c.id}`)}
      />
    </div>
  );
}

function CaseRow({ c }: { c: SupportCase }) {
  const t = useTranslations("support.org");
  const f = useFormat();
  return (
    <Card className="transition-colors hover:border-border-strong">
      <Link
        href={`/app/support/${c.id}`}
        className="flex flex-col gap-2 rounded-dense p-4 focus-visible:outline-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-fg-muted tabular">{c.number}</span>
            <span className="truncate font-medium text-fg">{c.subject}</span>
          </div>
          <p className="text-xs text-fg-muted">
            {[c.category_label, c.requester.full_name, f.dateTime(c.created_at)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SafetyBadges c={c} />
          {c.priority === "urgent" || c.priority === "high" ? <PriorityBadge priority={c.priority} /> : null}
          {c.messages_count ? <Badge tone="outline">{t("replies", { count: c.messages_count })}</Badge> : null}
          <CaseStatusBadge c={c} requester />
        </div>
      </Link>
    </Card>
  );
}

/** /app/support/[id] — one case with its public thread. */
export function OrgCasePage({ id }: { id: string }) {
  const t = useTranslations("support.org");
  const tn = useTranslations("nav");
  const f = useFormat();
  const query = useSupportCase("org", id);
  if (query.isLoading) {
    return (
      <div className="max-w-3xl space-y-4" aria-busy>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 rounded-dense" />
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const c = query.data;
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/app/support", label: tn("support") }}
        title={c.subject}
        meta={
          <>
            <span className="text-sm font-semibold text-fg-muted tabular">{c.number}</span>
            <CaseStatusBadge c={c} requester />
            <SafetyBadges c={c} />
            <PriorityBadge priority={c.priority} />
          </>
        }
      />
      <dl className="mb-6 grid gap-4 rounded-dense border border-border bg-surface p-4 text-sm shadow-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-muted">{t("category")}</dt>
          <dd className="mt-0.5 text-fg">{c.safety_kind_label ?? c.category_label}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{t("raised_by")}</dt>
          <dd className="mt-0.5 text-fg">{c.requester.full_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{t("first_response")}</dt>
          <dd className="mt-0.5 text-fg">{c.first_response_at ? f.dateTime(c.first_response_at) : t("awaiting_response")}</dd>
        </div>
      </dl>
      {c.status === "pending_user" ? (
        <p role="status" className="mb-4 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-fg">
          {t("pending_user_note")}
        </p>
      ) : null}
      <CaseThread scope="org" c={c} />
    </div>
  );
}
