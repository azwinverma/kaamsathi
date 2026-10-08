"use client";
/** Ops billing console: invoices (generate → issue → payments / credit notes / void), plans, org plans. */
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Info, Pencil, Plus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker, BsMonthPicker } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listResults, proxyHref } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import {
  useBillingPlans,
  useCreateCreditNote,
  useGenerateInvoices,
  useIssueInvoice,
  useOpsInvoice,
  useOpsInvoices,
  useRecordPayment,
  useSetSubscription,
  useUpdatePlan,
  useVoidInvoice,
} from "@/lib/api/hooks/billing";
import { useOpsOrganizations } from "@/lib/api/hooks/ops";
import {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  type BillingPlan,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/lib/api/types-billing";
import { todayBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";

const PAGE_SIZE = 25;
export const INVOICE_TONE: Record<InvoiceStatus, "neutral" | "brand" | "success" | "danger"> = {
  draft: "neutral",
  issued: "brand",
  paid: "success",
  void: "danger",
};

export function OpsBillingPage() {
  const t = useTranslations("ops_billing");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="mb-4 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-fg-muted">
        <Info className="mt-px size-4 shrink-0 text-brand-text" aria-hidden />
        {t("rules_note")}
      </p>
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">{t("tabs.invoices")}</TabsTrigger>
          <TabsTrigger value="plans">{t("tabs.plans")}</TabsTrigger>
          <TabsTrigger value="subscriptions">{t("tabs.subscriptions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices">
          <Invoices />
        </TabsContent>
        <TabsContent value="plans">
          <Plans />
        </TabsContent>
        <TabsContent value="subscriptions">
          <Subscriptions />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ------------------------------------------------------------------------------ invoices
function previousBsMonth() {
  const now = todayBs();
  return now.month === 1 ? { year: now.year - 1, month: 12 } : { year: now.year, month: now.month - 1 };
}

function Invoices() {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const f = useFormat();
  const [status, setStatus] = React.useState<"" | InvoiceStatus>("");
  const [page, setPage] = React.useState(1);
  const [period, setPeriod] = React.useState(previousBsMonth);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const query = useOpsInvoices({ page, page_size: PAGE_SIZE, status: status || undefined });
  const generate = useGenerateInvoices();
  const rows = listResults(query.data);
  const count = query.data && !Array.isArray(query.data) ? query.data.count : rows.length;

  async function onGenerate() {
    try {
      const res = await generate.mutateAsync({ bs_year: period.year, bs_month: period.month });
      toast.success(t("generated", { count: res.count }));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : tc("something_went_wrong"));
    }
  }

  return (
    <div className="space-y-4">
      <Toolbar className="flex flex-wrap items-end gap-2">
        <NativeSelect
          aria-label={tc("status")}
          className="w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | InvoiceStatus);
            setPage(1);
          }}
          options={[
            { value: "", label: t("all_statuses") },
            ...INVOICE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
          ]}
        />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <BsMonthPicker value={period} onChange={setPeriod} max={todayBs()} />
          <Button onClick={onGenerate} loading={generate.isPending}>
            <Plus className="size-4" aria-hidden />
            {t("generate")}
          </Button>
        </div>
      </Toolbar>
      <p className="text-xs text-fg-muted">{t("generate_hint")}</p>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title={t("empty")} description={t("empty_body")} />
      ) : (
        <>
          <TableContainer className={query.isPlaceholderData ? "opacity-60" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{t("number")}</Th>
                  <Th>{t("payer")}</Th>
                  <Th>{t("period")}</Th>
                  <Th numeric>{t("total")}</Th>
                  <Th numeric className="max-md:hidden">{t("balance")}</Th>
                  <Th>{tc("status")}</Th>
                  <Th>
                    <span className="sr-only">{tc("actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((inv) => (
                  <Tr key={inv.id}>
                    <RowHeader className="whitespace-nowrap tabular">{inv.number ?? t("draft_number")}</RowHeader>
                    <Td>
                      <span className="block text-fg">{inv.buyer_name}</span>
                      <span className="block text-xs text-fg-muted">{t(`payer_type.${inv.payer_type}`)}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {inv.period_bs_year && inv.period_bs_month ? f.bsMonth(inv.period_bs_year, inv.period_bs_month) : "—"}
                    </Td>
                    <Td numeric className="font-medium text-fg">
                      {f.money(inv.total)}
                    </Td>
                    <Td numeric className="max-md:hidden">
                      {f.money(inv.balance_due)}
                    </Td>
                    <Td>
                      <Badge tone={INVOICE_TONE[inv.status]}>{inv.status_label}</Badge>
                    </Td>
                    <Td>
                      <Button size="sm" variant="secondary" onClick={() => setOpenId(inv.id)}>
                        {tc("view")}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}
      <InvoiceDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

type Action = null | "payment" | "credit" | "void";

function InvoiceDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const f = useFormat();
  const { data: inv, isLoading, error } = useOpsInvoice(id);
  const issue = useIssueInvoice();
  const [action, setAction] = React.useState<Action>(null);
  React.useEffect(() => setAction(null), [id]);

  async function onIssue() {
    if (!inv) return;
    try {
      const res = await issue.mutateAsync(inv.id);
      toast.success(t("issued_toast", { number: res.number ?? "" }));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : tc("something_went_wrong"));
    }
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <DialogHeader
          title={inv ? (inv.number ?? t("draft_number")) : t("invoice")}
          description={inv ? `${inv.buyer_name} · ${inv.status_label}` : undefined}
        />
        <DialogBody className="space-y-4">
          {error ? <FormError message={isApiError(error) ? error.message : tc("error_loading")} /> : null}
          {isLoading || !inv ? (
            <TableSkeleton rows={3} cols={3} />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Meta label={t("issue_date")} value={f.bs(inv.issue_date_bs)} />
                <Meta label={t("due_date")} value={f.bs(inv.due_date_bs)} />
                <Meta label={t("buyer_pan")} value={inv.pan_of_buyer ?? "—"} />
                <Meta label={t("fiscal_year")} value={inv.fiscal_year ?? "—"} />
              </dl>
              <TableContainer className="shadow-none">
                <Table>
                  <THead>
                    <tr>
                      <Th>{tc("description")}</Th>
                      <Th numeric>{tc("amount")}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {inv.lines.map((l) => (
                      <Tr key={l.id}>
                        <Td>
                          <span className="block text-fg">{l.description}</span>
                          {l.kind_label ? <span className="text-xs text-fg-muted">{l.kind_label}</span> : null}
                        </Td>
                        <Td numeric>{f.money(l.amount)}</Td>
                      </Tr>
                    ))}
                    <Tr>
                      <Td className="text-fg-muted">{t("subtotal")}</Td>
                      <Td numeric>{f.money(inv.subtotal)}</Td>
                    </Tr>
                    <Tr>
                      <Td className="text-fg-muted">{t("vat", { rate: f.number(inv.vat_rate) })}</Td>
                      <Td numeric>{f.money(inv.vat_amount)}</Td>
                    </Tr>
                    <Tr>
                      <Td className="font-semibold text-fg">{t("total")}</Td>
                      <Td numeric className="font-semibold text-fg">
                        {f.money(inv.total)}
                      </Td>
                    </Tr>
                  </TBody>
                </Table>
              </TableContainer>
              {inv.payments.length || inv.credit_notes.length ? (
                <ul className="space-y-1 text-sm">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        {t("payment_line", { method: p.method_label, date: f.bs(p.paid_on_bs) })}
                        {p.reference ? <span className="text-fg-muted"> · {p.reference}</span> : null}
                      </span>
                      <span className="tabular">{f.money(p.amount)}</span>
                    </li>
                  ))}
                  {inv.credit_notes.map((n) => (
                    <li key={n.id} className="flex justify-between gap-2">
                      <span>
                        {n.number} <span className="text-fg-muted">· {n.reason}</span>
                      </span>
                      <span className="tabular">−{f.money(n.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-sm font-medium text-fg">
                {t("balance_due", { amount: f.money(inv.balance_due) })}
              </p>
              {action === "payment" ? <PaymentForm id={inv.id} balance={inv.balance_due} onDone={() => setAction(null)} /> : null}
              {action === "credit" ? <CreditNoteForm id={inv.id} onDone={() => setAction(null)} /> : null}
              {action === "void" ? <VoidForm id={inv.id} onDone={() => setAction(null)} /> : null}
            </>
          )}
        </DialogBody>
        {inv ? (
          <DialogFooter className="flex-wrap">
            <a
              href={proxyHref(`/ops/billing/invoices/${inv.id}/pdf`)}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline sm:me-auto"
            >
              <FileText className="size-4" aria-hidden />
              {t("pdf")}
            </a>
            {inv.status === "draft" ? (
              <Button onClick={onIssue} loading={issue.isPending}>
                {t("issue")}
              </Button>
            ) : null}
            {inv.status === "issued" ? (
              <Button onClick={() => setAction("payment")} variant={action === "payment" ? "secondary" : "primary"}>
                {t("record_payment")}
              </Button>
            ) : null}
            {inv.status === "issued" || inv.status === "paid" ? (
              <Button variant="secondary" onClick={() => setAction("credit")}>
                {t("credit_note")}
              </Button>
            ) : null}
            {(inv.status === "draft" || inv.status === "issued") && inv.payments.length === 0 ? (
              <Button variant="danger" onClick={() => setAction("void")}>
                {t("void")}
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-fg tabular">{value}</dd>
    </div>
  );
}

function useSubmit<T>(fn: (v: T) => Promise<unknown>, okMessage: string, onDone: () => void) {
  const [error, setError] = React.useState<unknown>(null);
  const submit = async (v: T) => {
    setError(null);
    try {
      await fn(v);
      toast.success(okMessage);
      onDone();
    } catch (e) {
      setError(e);
    }
  };
  return { error, submit, err: (k: string) => (isApiError(error) ? error.fieldError(k) : undefined) };
}

function PaymentForm({ id, balance, onDone }: { id: string; balance: string; onDone: () => void }) {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const pay = useRecordPayment();
  const [amount, setAmount] = React.useState(balance);
  const [method, setMethod] = React.useState<PaymentMethod>("bank");
  const [reference, setReference] = React.useState("");
  const [paidOn, setPaidOn] = React.useState(todayIso());
  const { error, submit, err } = useSubmit(pay.mutateAsync, t("payment_saved"), onDone);
  return (
    <form
      className="space-y-3 rounded-md border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ id, amount, method, reference, paid_on: paidOn });
      }}
      noValidate
    >
      {isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="pay-amount" label={tc("amount")} error={err("amount")}>
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field id="pay-method" label={t("method")} error={err("method")}>
          <NativeSelect
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`method_label.${m}`) }))}
          />
        </Field>
        <Field id="pay-ref" label={t("reference")} error={err("reference")} optional optionalLabel={tc("optional")}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} />
        </Field>
        <Field id="pay-date" label={t("paid_on")} error={err("paid_on")}>
          <BsDatePicker value={paidOn} onChange={setPaidOn} max={todayIso()} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={pay.isPending}>
          {t("record_payment")}
        </Button>
      </div>
    </form>
  );
}

function CreditNoteForm({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const credit = useCreateCreditNote();
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const { error, submit, err } = useSubmit(credit.mutateAsync, t("credit_saved"), onDone);
  return (
    <form
      className="space-y-3 rounded-md border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ id, amount, reason });
      }}
      noValidate
    >
      {isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cn-amount" label={t("credit_amount")} hint={t("credit_amount_hint")} error={err("amount")}>
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field id="cn-reason" label={t("reason")} error={err("reason")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={credit.isPending}>
          {t("credit_note")}
        </Button>
      </div>
    </form>
  );
}

function VoidForm({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const voidInv = useVoidInvoice();
  const [reason, setReason] = React.useState("");
  const { error, submit, err } = useSubmit(voidInv.mutateAsync, t("voided"), onDone);
  return (
    <form
      className="space-y-3 rounded-md border border-danger/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ id, reason });
      }}
      noValidate
    >
      {isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
      <Field id="void-reason" label={t("reason")} hint={t("void_hint")} error={err("reason")}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" variant="danger" loading={voidInv.isPending}>
          {t("void")}
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------------- plans
function Plans() {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const f = useFormat();
  const { data, isLoading, error, refetch } = useBillingPlans();
  const [editing, setEditing] = React.useState<BillingPlan | null>(null);
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <TableSkeleton rows={5} cols={6} />;
  return (
    <>
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <Th>{t("plan")}</Th>
              <Th numeric>{t("monthly_base")}</Th>
              <Th numeric>{t("per_worker")}</Th>
              <Th numeric className="max-md:hidden">{t("included_workers")}</Th>
              <Th numeric>{t("min_monthly")}</Th>
              <Th numeric className="max-md:hidden">{t("placement_fee")}</Th>
              <Th>
                <span className="sr-only">{tc("actions")}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {data.map((p) => (
              <Tr key={p.code}>
                <RowHeader>
                  {p.name}
                  {!p.is_active ? <Badge className="ms-2">{t("inactive")}</Badge> : null}
                </RowHeader>
                <Td numeric>{f.money(p.monthly_base)}</Td>
                <Td numeric>{f.money(p.per_active_worker)}</Td>
                <Td numeric className="max-md:hidden">{f.digits(p.included_workers)}</Td>
                <Td numeric>{f.money(p.min_monthly)}</Td>
                <Td numeric className="max-md:hidden">{f.money(p.placement_fee)}</Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={t("edit_plan", { plan: p.name })}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      <p className="mt-3 text-xs text-fg-muted">{t("plans_hint")}</p>
      <PlanDialog plan={editing} onClose={() => setEditing(null)} />
    </>
  );
}

const PLAN_FIELDS = ["monthly_base", "per_active_worker", "min_monthly", "placement_fee"] as const;

function PlanDialog({ plan, onClose }: { plan: BillingPlan | null; onClose: () => void }) {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const update = useUpdatePlan();
  const [v, setV] = React.useState<Record<string, string>>({});
  const [active, setActive] = React.useState(true);
  React.useEffect(() => {
    if (!plan) return;
    setV({
      name: plan.name,
      included_workers: String(plan.included_workers),
      ...Object.fromEntries(PLAN_FIELDS.map((k) => [k, plan[k]])),
    });
    setActive(plan.is_active);
  }, [plan]);
  const { error, submit, err } = useSubmit(update.mutateAsync, tc("changes_saved"), onClose);
  if (!plan) return null;
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader title={t("edit_plan", { plan: plan.name })} description={t("plan_formula_hint")} />
        <form
          className="contents"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit({
              code: plan.code,
              name: v.name,
              included_workers: Number(v.included_workers || 0),
              is_active: active,
              ...Object.fromEntries(PLAN_FIELDS.map((k) => [k, v[k]])),
            });
          }}
        >
          <DialogBody className="space-y-3">
            {isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
            <Field id="plan-name" label={t("plan_name")} error={err("name")}>
              <Input value={v.name ?? ""} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} maxLength={60} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLAN_FIELDS.map((k) => (
                <Field key={k} id={`plan-${k}`} label={t(k === "per_active_worker" ? "per_worker" : k)} error={err(k)}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={v[k] ?? ""}
                    onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))}
                  />
                </Field>
              ))}
              <Field id="plan-included" label={t("included_workers")} error={err("included_workers")}>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={v.included_workers ?? ""}
                  onChange={(e) => setV((s) => ({ ...s, included_workers: e.target.value }))}
                />
              </Field>
              <Field id="plan-active" label={t("plan_active")}>
                <NativeSelect
                  value={active ? "1" : "0"}
                  onChange={(e) => setActive(e.target.value === "1")}
                  options={[
                    { value: "1", label: tc("yes") },
                    { value: "0", label: tc("no") },
                  ]}
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {tc("save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------- subscriptions
function Subscriptions() {
  const t = useTranslations("ops_billing");
  const tc = useTranslations("common");
  const orgs = useOpsOrganizations({ page_size: 100 });
  const plans = useBillingPlans();
  const setSub = useSetSubscription();
  const [orgId, setOrgId] = React.useState("");
  const [plan, setPlan] = React.useState("");
  const orgRows = listResults(orgs.data);
  const { error, submit, err } = useSubmit(setSub.mutateAsync, t("subscription_saved"), () => setPlan(""));
  return (
    <form
      className="max-w-xl space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ orgId, plan });
      }}
    >
      <p className="text-sm text-fg-muted">{t("subscriptions_hint")}</p>
      {isApiError(error) && !Object.keys(error.fields).length ? <FormError message={error.message} /> : null}
      <Field id="sub-org" label={t("organization")}>
        <NativeSelect
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          placeholder={tc("select")}
          options={orgRows.map((o) => ({ value: o.id, label: o.name }))}
        />
      </Field>
      <Field id="sub-plan" label={t("plan")} error={err("plan")}>
        <NativeSelect
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder={tc("select")}
          options={(plans.data ?? []).filter((p) => p.is_active).map((p) => ({ value: p.code, label: p.name }))}
        />
      </Field>
      <Button type="submit" disabled={!orgId || !plan} loading={setSub.isPending}>
        {t("set_plan")}
      </Button>
    </form>
  );
}
