"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlarmClock, Inbox, Search, ShieldCheck, UserCheck, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogTitle, Sheet, SheetContent } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useIdentityCheck,
  useSupportCase,
  useSupportCases,
  useSupportLookup,
  useUpdateSupportCase,
  useWorkerSensitiveUpdate,
} from "@/lib/api/hooks/support";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type IdentityMethod,
  type SupportCase,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/api/types-support";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { CaseStatusBadge, PriorityBadge, SafetyBadges, SlaIndicator } from "./case-badges";
import { CaseThread } from "./case-thread";
import { HelpEditor } from "./help-editor";

const PAGE_SIZE = 25;
type Queue = "open" | "overdue" | "mine" | "unassigned" | "pending_user" | "safety" | "done" | "all";
const QUEUES: Queue[] = ["open", "overdue", "mine", "unassigned", "safety", "pending_user", "done", "all"];

function queueParams(queue: Queue): Record<string, string | undefined> {
  switch (queue) {
    case "open":
      return { status: "open" };
    case "overdue":
      return { overdue: "1" };
    case "mine":
      return { assignee: "me", status: "open,pending_user" };
    case "unassigned":
      return { assignee: "none", status: "open,pending_user" };
    case "pending_user":
      return { status: "pending_user" };
    case "safety":
      return { category: "safety", status: "open,pending_user" };
    case "done":
      return { status: "resolved,closed", ordering: "-created_at" };
    default:
      return {};
  }
}

/** /ops/support — case queue (SLA countdown, assign, status, thread with internal notes),
 * contact-center caller lookup, and the help-center editor. */
export function OpsSupportPage() {
  const tn = useTranslations("nav");
  const t = useTranslations("support.ops");
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = React.useState(params.get("tab") ?? "queue");
  const openId = params.get("case");
  return (
    <div>
      <PageHeader title={tn("ops_support")} description={t("description")} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="queue">{t("tab_queue")}</TabsTrigger>
          <TabsTrigger value="lookup">{t("tab_lookup")}</TabsTrigger>
          <TabsTrigger value="help">{t("tab_help")}</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <CaseQueue />
        </TabsContent>
        <TabsContent value="lookup">
          <CallerLookup />
        </TabsContent>
        <TabsContent value="help">
          <HelpEditor />
        </TabsContent>
      </Tabs>
      <CaseSheet id={openId} onClose={() => router.replace("/ops/support", { scroll: false })} />
    </div>
  );
}

function CaseQueue() {
  const t = useTranslations("support.ops");
  const tAll = useTranslations();
  const tc = useTranslations("common");
  const f = useFormat();
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("case");
  const [queue, setQueue] = React.useState<Queue>("open");
  const [priority, setPriority] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [queue, priority, category, q]);
  const base = queueParams(queue);
  const query = useSupportCases("ops", {
    ...base,
    priority: priority || undefined,
    category: category || base.category,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];
  const setOpen = (id: string | null) => router.replace(id ? `/ops/support?case=${id}` : "/ops/support", { scroll: false });

  return (
    <>
      <Toolbar>
        <NativeSelect
          aria-label={t("queue")}
          value={queue}
          onChange={(e) => setQueue(e.target.value as Queue)}
          options={QUEUES.map((k) => ({ value: k, label: t(`queue_${k}`) }))}
          className="sm:w-52"
        />
        <NativeSelect
          aria-label={t("priority")}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          placeholder={t("any_priority")}
          options={SUPPORT_PRIORITIES.map((p) => ({ value: p, label: tAll(`support.priority.${p}`) }))}
          className="sm:w-40"
        />
        <NativeSelect
          aria-label={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("any_category")}
          options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: tAll(`support.category.${c}`) }))}
          className="sm:w-48"
        />
        <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} className="sm:ml-auto sm:w-64" />
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title={q ? tc("no_results") : t("empty", { queue: t(`queue_${queue}`) })} />
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{t("col_case")}</Th>
                  <Th className="max-md:hidden">{t("col_requester")}</Th>
                  <Th>{t("priority")}</Th>
                  <Th>{t("col_sla")}</Th>
                  <Th className="max-lg:hidden">{t("col_assignee")}</Th>
                  <Th>{tc("status")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <Tr key={c.id} interactive selected={c.id === openId} onClick={() => setOpen(c.id)}>
                    <RowHeader className="max-w-80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(c.id);
                        }}
                        className="block max-w-full text-left focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="block text-xs font-semibold text-fg-muted tabular">
                          {c.number} · {c.category_label}
                        </span>
                        <span className="block truncate font-medium text-fg">{c.subject}</span>
                      </button>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <SafetyBadges c={c} />
                      </span>
                    </RowHeader>
                    <Td className="max-md:hidden">
                      <span className="block text-fg">{c.requester.full_name || c.requester.phone}</span>
                      <span className="block text-xs text-fg-muted">
                        {c.organization?.name ?? t("worker_case")} · {c.channel_label}
                      </span>
                    </Td>
                    <Td>
                      <PriorityBadge priority={c.priority} />
                    </Td>
                    <Td>
                      <SlaIndicator c={c} />
                      {c.escalated && c.status === "open" ? (
                        <span className="block text-[11px] text-danger">{t("escalated")}</span>
                      ) : null}
                    </Td>
                    <Td className="max-lg:hidden">{c.assignee?.full_name ?? <span className="text-fg-subtle">{t("unassigned")}</span>}</Td>
                    <Td>
                      <CaseStatusBadge c={c} />
                      <span className="block text-[11px] text-fg-subtle">{f.dateTime(c.created_at)}</span>
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

function CaseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const tc = useTranslations("common");
  const t = useTranslations("support.ops");
  const query = useSupportCase("ops", id);
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent closeLabel={tc("close")} className="max-w-2xl">
        {query.data ? (
          <CaseDetail c={query.data} />
        ) : (
          <div className="space-y-4 p-6">
            <DialogTitle className="sr-only">{t("case")}</DialogTitle>
            <DialogDescription className="sr-only">{t("case")}</DialogDescription>
            {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <Skeleton className="h-64 rounded-lg" />}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CaseDetail({ c }: { c: SupportCase }) {
  const t = useTranslations("support.ops");
  const tAll = useTranslations();
  const f = useFormat();
  const { me } = useSession();
  const update = useUpdateSupportCase();
  const patch = (body: Parameters<typeof update.mutate>[0], ok: string) =>
    update.mutate(body, { onSuccess: () => toast.success(ok), onError: (e) => toastError(e, tAll) });
  const mine = c.assignee?.id === me.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-2 border-b border-border px-6 pt-5 pb-4 pr-14">
        <p className="text-xs font-semibold text-fg-muted tabular">
          {c.number} · {c.channel_label}
        </p>
        <DialogTitle className="text-lg font-semibold text-fg">{c.subject}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <CaseStatusBadge c={c} />
            <PriorityBadge priority={c.priority} />
            <SafetyBadges c={c} />
            <SlaIndicator c={c} />
          </div>
        </DialogDescription>
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-fg-muted">{t("col_requester")}</dt>
            <dd className="mt-0.5 text-fg">
              {c.requester.full_name || "—"} <span className="text-fg-muted tabular">{c.requester.phone}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t("about")}</dt>
            <dd className="mt-0.5 text-fg">
              {c.worker ? (
                <Link href={`/ops/workers/${c.worker.id}`} className="text-brand-text hover:underline">
                  {c.worker.full_name}
                </Link>
              ) : null}
              {c.worker && c.organization ? " · " : null}
              {c.organization ? (
                <Link href={`/ops/organizations/${c.organization.id}`} className="text-brand-text hover:underline">
                  {c.organization.name}
                </Link>
              ) : null}
              {!c.worker && !c.organization ? "—" : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t("category")}</dt>
            <dd className="mt-0.5 text-fg">{c.safety_kind_label ?? c.category_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t("first_response")}</dt>
            <dd className="mt-0.5 text-fg">{c.first_response_at ? f.dateTime(c.first_response_at) : t("no_response_yet")}</dd>
          </div>
        </dl>

        <section aria-label={t("actions")} className="grid gap-3 rounded-lg border border-border bg-surface-muted/60 p-4 sm:grid-cols-3">
          <Field id="case-status" label={tAll("common.status")}>
            <NativeSelect
              value={c.status}
              disabled={update.isPending}
              onChange={(e) => patch({ id: c.id, status: e.target.value as SupportStatus }, t("updated_toast"))}
              options={SUPPORT_STATUSES.map((s) => ({ value: s, label: tAll(`support.status.staff_${s}`) }))}
            />
          </Field>
          <Field id="case-priority-ops" label={t("priority")}>
            <NativeSelect
              value={c.priority}
              disabled={update.isPending}
              onChange={(e) => patch({ id: c.id, priority: e.target.value as SupportPriority }, t("updated_toast"))}
              options={SUPPORT_PRIORITIES.map((p) => ({ value: p, label: tAll(`support.priority.${p}`) }))}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("col_assignee")}</span>
            <p className="truncate text-sm text-fg-body">{c.assignee?.full_name ?? t("unassigned")}</p>
            {mine ? (
              <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => patch({ id: c.id, assignee_id: null }, t("unassigned_toast"))}>
                <UserMinus aria-hidden />
                {t("unassign")}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => patch({ id: c.id, assignee_id: me.id }, t("assigned_toast"))}>
                <UserCheck aria-hidden />
                {t("assign_me")}
              </Button>
            )}
          </div>
          {c.category === "safety" ? (
            <label className="flex items-start gap-2 text-sm text-fg sm:col-span-3">
              <Checkbox
                checked={!!c.shared_with_org}
                disabled={update.isPending || !c.organization}
                onCheckedChange={(v) => patch({ id: c.id, shared_with_org: v === true }, t("updated_toast"))}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{t("share_with_employer")}</span>
                <span className="block text-xs text-fg-muted">
                  {c.anonymous ? t("share_hint_anonymous") : t("share_hint")}
                </span>
              </span>
            </label>
          ) : null}
        </section>

        {c.category === "safety" ? <SafetyLinks c={c} /> : null}
        {c.worker ? <IdentityPanel c={c} /> : null}
        <CaseThread scope="ops" c={c} />
      </div>
    </div>
  );
}

function SafetyLinks({ c }: { c: SupportCase }) {
  const t = useTranslations("support.ops");
  const tAll = useTranslations();
  const update = useUpdateSupportCase();
  const [dispute, setDispute] = React.useState(c.dispute_id ?? "");
  const [flag, setFlag] = React.useState(c.risk_flag_id ?? "");
  const save = () =>
    update.mutate(
      { id: c.id, dispute_id: dispute.trim() || null, risk_flag_id: flag.trim() || null },
      { onSuccess: () => toast.success(t("links_saved")), onError: (e) => toastError(e, tAll) },
    );
  return (
    <section aria-labelledby={`links-${c.id}`} className="space-y-3">
      <h3 id={`links-${c.id}`} className="text-sm font-semibold text-fg">
        {t("links_title")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="link-dispute" label={t("dispute_id")} hint={<Link href="/ops/disputes" className="text-brand-text hover:underline">{t("open_disputes")}</Link>}>
          <Input value={dispute} onChange={(e) => setDispute(e.target.value)} placeholder="uuid" className="font-mono text-xs" />
        </Field>
        <Field id="link-flag" label={t("risk_flag_id")} hint={<Link href="/ops/risk" className="text-brand-text hover:underline">{t("open_risk")}</Link>}>
          <Input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="uuid" className="font-mono text-xs" />
        </Field>
        <Button variant="secondary" onClick={save} loading={update.isPending}>
          {tAll("common.save")}
        </Button>
      </div>
    </section>
  );
}

/** Contact-center identity check, then (within 15 min) phone / payment changes for the worker. */
function IdentityPanel({ c }: { c: SupportCase }) {
  const t = useTranslations("support.identity");
  const tAll = useTranslations();
  const f = useFormat();
  const check = useIdentityCheck();
  const change = useWorkerSensitiveUpdate();
  const [method, setMethod] = React.useState<IdentityMethod>("otp");
  const [phone, setPhone] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [wallet, setWallet] = React.useState("");
  const verified = !!c.identity_verified;

  const record = (result: "passed" | "failed") =>
    check.mutate(
      { id: c.id, method, result },
      {
        onSuccess: () => (result === "passed" ? toast.success(t("passed_toast")) : toast.error(t("failed_toast"))),
        onError: (e) => toastError(e, tAll),
      },
    );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(
      Object.entries({
        phone,
        payment_method: paymentMethod,
        bank_name: bankName,
        bank_account_no: account,
        wallet_id: wallet,
      }).filter(([, v]) => v.trim()),
    );
    if (!Object.keys(body).length) return;
    change.mutate(
      { id: c.id, ...body },
      {
        onSuccess: (res) => {
          toast.success(t("updated_toast", { fields: res.updated.join(", ") || "—" }));
          setPhone("");
          setBankName("");
          setAccount("");
          setWallet("");
          setPaymentMethod("");
        },
        onError: (e) => toastError(e, tAll),
      },
    );
  };

  return (
    <section aria-labelledby={`identity-${c.id}`} className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`identity-${c.id}`} className="flex items-center gap-2 text-sm font-semibold text-fg">
          <ShieldCheck className="size-4 text-brand-text" aria-hidden />
          {t("title")}
        </h3>
        {verified ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <AlarmClock className="size-3.5" aria-hidden />
            {t("verified_at", { time: f.time(c.identity_verified_at ?? null) })}
          </span>
        ) : (
          <span className="text-xs text-fg-muted">{t("not_verified")}</span>
        )}
      </div>
      <p className="text-xs text-fg-muted">{t("explain", { phone: c.worker_phone ?? "—" })}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field id={`id-method-${c.id}`} label={t("method")} className="min-w-52">
          <NativeSelect
            value={method}
            onChange={(e) => setMethod(e.target.value as IdentityMethod)}
            options={[
              { value: "otp", label: t("method_otp") },
              { value: "security_questions", label: t("method_questions") },
            ]}
          />
        </Field>
        <Button size="sm" onClick={() => record("passed")} loading={check.isPending}>
          {t("mark_passed")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => record("failed")} disabled={check.isPending}>
          {t("mark_failed")}
        </Button>
      </div>
      <form onSubmit={submit} className="space-y-3 border-t border-border pt-3" noValidate>
        <p className="text-xs font-medium text-fg-muted">{verified ? t("change_title") : t("locked")}</p>
        <fieldset disabled={!verified || change.isPending} className="grid gap-3 disabled:opacity-60 sm:grid-cols-2">
          <Field id={`new-phone-${c.id}`} label={t("new_phone")}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={10} />
          </Field>
          <Field id={`pay-method-${c.id}`} label={t("payment_method")}>
            <NativeSelect
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder={t("unchanged")}
              options={(["bank", "esewa", "khalti", "cash"] as const).map((m) => ({ value: m, label: t(`pm_${m}`) }))}
            />
          </Field>
          <Field id={`bank-${c.id}`} label={t("bank_name")}>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} />
          </Field>
          <Field id={`acct-${c.id}`} label={t("account_no")}>
            <Input value={account} onChange={(e) => setAccount(e.target.value)} maxLength={40} autoComplete="off" />
          </Field>
          <Field id={`wallet-${c.id}`} label={t("wallet_id")}>
            <Input value={wallet} onChange={(e) => setWallet(e.target.value)} maxLength={40} autoComplete="off" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" size="sm" loading={change.isPending}>
              {t("apply")}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function CallerLookup() {
  const t = useTranslations("support.lookup");
  const router = useRouter();
  const [by, setBy] = React.useState<"phone" | "citizenship_no">("phone");
  const [value, setValue] = React.useState("");
  const [submitted, setSubmitted] = React.useState<Record<string, string> | null>(null);
  const query = useSupportLookup(submitted ?? {}, !!submitted);
  const data = query.data;
  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) setSubmitted({ [by]: value.trim() });
        }}
      >
        <Field id="lookup-by" label={t("search_by")} className="sm:w-48">
          <NativeSelect
            value={by}
            onChange={(e) => setBy(e.target.value as "phone" | "citizenship_no")}
            options={[
              { value: "phone", label: t("by_phone") },
              { value: "citizenship_no", label: t("by_citizenship") },
            ]}
          />
        </Field>
        <Field id="lookup-value" label={by === "phone" ? t("by_phone") : t("by_citizenship")} className="flex-1">
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        </Field>
        <Button type="submit" loading={query.isFetching}>
          <Search aria-hidden />
          {t("search")}
        </Button>
      </form>
      <p className="text-xs text-fg-muted">{t("audited")}</p>
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {data ? (
        data.users.length + data.workers.length === 0 ? (
          <EmptyState icon={Search} title={t("no_match")} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">{t("people")}</h3>
              <ul className="divide-y divide-border text-sm">
                {data.workers.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <Link href={`/ops/workers/${w.id}`} className="font-medium text-brand-text hover:underline">
                        {w.full_name}
                      </Link>
                      <span className="block text-xs text-fg-muted">
                        {[t("worker"), w.phone, w.district, w.verification_status].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
                {data.users
                  .filter((u) => !data.workers.some((w) => w.phone === u.phone))
                  .map((u) => (
                    <li key={u.id} className="py-2">
                      <span className="font-medium text-fg">{u.full_name || u.phone}</span>
                      <span className="block text-xs text-fg-muted">
                        {[u.is_staff ? t("staff") : t("user"), u.phone].join(" · ")}
                      </span>
                    </li>
                  ))}
                {data.organizations.map((o) => (
                  <li key={`${o.id}-${o.user_id}`} className="py-2">
                    <Link href={`/ops/organizations/${o.id}`} className="font-medium text-brand-text hover:underline">
                      {o.name}
                    </Link>
                    <span className="block text-xs text-fg-muted">{t("member_role", { role: o.role })}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">{t("open_cases")}</h3>
              {data.open_cases.length === 0 ? (
                <p className="text-sm text-fg-muted">{t("no_cases")}</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {data.open_cases.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => router.replace(`/ops/support?case=${c.id}`, { scroll: false })}
                      >
                        <span className="block text-xs font-semibold text-fg-muted tabular">{c.number}</span>
                        <span className="block truncate font-medium text-brand-text hover:underline">{c.subject}</span>
                      </button>
                      <CaseStatusBadge c={c} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}
