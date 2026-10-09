"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Ban, CalendarCheck, Clock, Gauge, Lock, ShieldOff, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DenseStatRow, type DenseStat } from "@/components/ledger";
import { useSession } from "@/components/providers/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Sheet, SheetContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton, errorMessage } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { FilterBar, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasStaffRole } from "@/components/security/helpers";
import { useFlag } from "@/lib/api/hooks/flags";
import {
  useOpsBolauBooking,
  useOpsBolauBookings,
  useOpsBolauFees,
  useOpsBolauKpis,
  useOpsBolauRequests,
  useOpsBolauSipalu,
  useOpsCancelBooking,
  useOpsSuspendSipalu,
} from "@/lib/api/hooks/bolau";
import type { BookingStatus, OpsBooking, OpsSipaluRow } from "@/lib/api/types-bolau";
import { BOLAU_FLAG } from "@/lib/bolau/flag";
import { useFormat } from "@/lib/use-format";
import { BookingStatusBadge, PriceText } from "./bits";
import { StatusTimeline } from "./status-timeline";

type Tab = "bookings" | "queue" | "requests" | "fees" | "sipalu";
const TABS: Tab[] = ["bookings", "queue", "requests", "fees", "sipalu"];
const PAGE_SIZE = 25;
const STATUSES: BookingStatus[] = [
  "requested",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "confirmed",
  "cancelled",
  "declined",
  "expired",
  "no_show",
  "disputed",
];

function pct(v: unknown, digits: (x: string | number) => string): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${digits(String(v))}%`;
}

/** Ops console · Bolau (A · documentary ledger, most restrained). Staff role: support. */
export function OpsBolauPage() {
  const t = useTranslations("bolau.ops");
  const te = useTranslations("errors");
  const tAll = useTranslations();
  const session = useSession();
  const on = useFlag(BOLAU_FLAG);
  if (!hasStaffRole(session.me, ["support"])) {
    return <EmptyState icon={Lock} title={te("forbidden_title")} description={te("forbidden_body")} />;
  }
  if (!on) {
    return (
      <div>
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState
          icon={ShieldOff}
          title={t("off")}
          action={
            hasStaffRole(session.me, ["superadmin"]) ? (
              <Button asChild variant="secondary">
                <Link href="/ops/flags">{tAll("nav.ops_flags")}</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }
  return <OpsBolau />;
}

function Kpis() {
  const t = useTranslations("bolau.ops");
  const f = useFormat();
  const q = useOpsBolauKpis();
  const k = q.data;
  const items: DenseStat[] = [
    { key: "bpd", label: t("kpi.bookings_per_day"), value: k?.bookings_per_day != null ? f.digits(String(k.bookings_per_day)) : "—", icon: CalendarCheck, focal: true },
    { key: "acc", label: t("kpi.acceptance_rate"), value: pct(k?.acceptance_rate, f.digits), tone: "brand" },
    {
      key: "tta",
      label: t("kpi.time_to_accept_minutes"),
      value: k?.time_to_accept_minutes_median != null ? t("minutes", { n: f.digits(String(k.time_to_accept_minutes_median)) }) : "—",
      icon: Clock,
    },
    { key: "done", label: t("kpi.completion_rate"), value: pct(k?.completion_rate, f.digits), tone: "success" },
    { key: "cxl", label: t("kpi.cancellation_rate"), value: pct(k?.cancellation_rate, f.digits), icon: XCircle, tone: "warning" },
    { key: "rep", label: t("kpi.repeat_ghardhani_rate"), value: pct(k?.repeat_ghardhani_rate, f.digits) },
    { key: "rat", label: t("kpi.avg_rating"), value: k?.avg_rating != null ? f.digits(String(k.avg_rating)) : "—", icon: Star },
    { key: "ns", label: t("kpi.no_shows"), value: f.digits(k?.no_shows ?? 0), tone: "danger" },
    { key: "dis", label: t("kpi.open_disputes"), value: f.digits(k?.disputes ?? 0), tone: "danger" },
  ];
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <DenseStatRow items={items} label={t("kpis_label")} loading={q.isLoading} className="mb-6" />;
}

function OpsBolau() {
  const t = useTranslations("bolau.ops");
  const [tab, setTab] = React.useState<Tab>("bookings");
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <Kpis />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4 max-w-full overflow-x-auto">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* One panel for the active tab, so the tab's aria-controls points at a real tabpanel. */}
        <TabsContent value={tab} className="pt-0">
          {tab === "bookings" ? <BookingsTable onOpen={setOpenId} /> : null}
          {tab === "queue" ? <BookingsTable onOpen={setOpenId} queue /> : null}
          {tab === "requests" ? <RequestsTable /> : null}
          {tab === "fees" ? <FeesTable /> : null}
          {tab === "sipalu" ? <SipaluTable /> : null}
        </TabsContent>
      </Tabs>
      <BookingSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function BookingsTable({ onOpen, queue = false }: { onOpen: (id: string) => void; queue?: boolean }) {
  const t = useTranslations("bolau.ops");
  const ts = useTranslations("bolau.status");
  const tc = useTranslations("common");
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [q, status]);
  const query = useOpsBolauBookings({
    q: q || undefined,
    status: queue ? "no_show,disputed" : status || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];
  return (
    <>
      <FilterBar label={tc("filters")} summary={query.data ? tc("results", { count: query.data.count }) : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder={t("search")} label={t("search")} className="sm:w-80" />
        {!queue ? (
          <NativeSelect
            aria-label={t("col.status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder={t("status_any")}
            options={STATUSES.map((s) => ({ value: s, label: ts(s) }))}
            className="sm:w-48"
          />
        ) : null}
      </FilterBar>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={queue ? t("queue_empty") : t("empty")} />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("col.code")}</Th>
                <Th>{t("col.status")}</Th>
                <Th>{t("col.sipalu")}</Th>
                <Th>{t("col.ghardhani")}</Th>
                <Th>{t("col.trade")}</Th>
                <Th>{t("col.when")}</Th>
                <Th numeric>{t("col.price")}</Th>
                <Th>{t("col.fee")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((b) => (
                <Tr key={b.id} interactive onClick={() => onOpen(b.id)}>
                  <RowHeader>
                    <button
                      type="button"
                      className="font-mono text-sm font-semibold whitespace-nowrap hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(b.id);
                      }}
                    >
                      {b.code}
                    </button>
                  </RowHeader>
                  <Td>
                    <BookingStatusBadge status={b.status} />
                  </Td>
                  <Td>
                    <span className="text-fg font-medium">{b.sipalu.name}</span>
                    {b.sipalu.handle ? <span className="text-fg-muted block text-xs">@{b.sipalu.handle}</span> : null}
                  </Td>
                  <Td>{b.ghardhani?.name}</Td>
                  <Td>{b.trade ? f.name(b.trade) : "—"}</Td>
                  <Td className="whitespace-nowrap tabular">{f.dateTime(b.scheduled_start)}</Td>
                  <Td numeric>{b.final_price ? f.money(b.final_price) : f.money(b.quoted_price)}</Td>
                  <Td>
                    <Badge tone={b.booking_fee_status === "paid" ? "success" : b.booking_fee_status === "pending" ? "warning" : "neutral"}>
                      {t(`fee_status.${b.booking_fee_status}`)}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {query.data && query.data.count > PAGE_SIZE ? (
        <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={setPage} />
      ) : null}
    </>
  );
}

function BookingSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const q = useOpsBolauBooking(id);
  const cancel = useOpsCancelBooking();
  const [suspendFor, setSuspendFor] = React.useState<{ handle: string; name: string } | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const b = q.data as OpsBooking | undefined;
  // Event log: localized labels, never raw codes (fall back to the code only for an unknown value).
  const statusText = (s: string) => (t.has(`status.${s}`) ? t(`status.${s}`) : s);
  const partyText = (p: string) => (t.has(`ops.party.${p}`) ? t(`ops.party.${p}`) : p);
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent closeLabel={tAll("common.close")} aria-describedby={undefined}>
        <div className="border-border border-b px-6 pt-5 pb-4 pr-14">
          <DialogTitle className="text-fg text-lg font-semibold">{b ? t("ops.detail", { code: b.code }) : "…"}</DialogTitle>
          {b ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <BookingStatusBadge status={b.status} />
              {b.late_cancellation ? <Badge tone="warning">{t("ops.late_cancel")}</Badge> : null}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm">
          {q.isLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : q.isError || !b ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <>
              <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2">
                <dt className="text-fg-muted">{t("ops.col.sipalu")}</dt>
                <dd className="text-fg">
                  {b.sipalu.name}
                  {b.sipalu.phone ? <span className="text-fg-muted tabular"> · {f.phone(b.sipalu.phone)}</span> : null}
                </dd>
                <dt className="text-fg-muted">{t("ops.col.ghardhani")}</dt>
                <dd className="text-fg">
                  {b.ghardhani.name}
                  {b.ghardhani.phone ? <span className="text-fg-muted tabular"> · {f.phone(b.ghardhani.phone)}</span> : null}
                </dd>
                <dt className="text-fg-muted">{t("ops.col.when")}</dt>
                <dd className="tabular">{f.dateTime(b.scheduled_start)}</dd>
                <dt className="text-fg-muted">{t("ops.col.price")}</dt>
                <dd>
                  <PriceText p={{ price_type: b.price_type, price: b.quoted_price, visit_fee: b.visit_fee }} />
                  {b.final_price ? <span className="text-fg-muted"> → {f.money(b.final_price)}</span> : null}
                </dd>
                <dt className="text-fg-muted">{t("ops.col.fee")}</dt>
                <dd>
                  {f.money(b.booking_fee)} · {t(`ops.fee_status.${b.booking_fee_status}`)}
                </dd>
                {b.cancel_reason ? (
                  <>
                    <dt className="text-fg-muted">{t("ghar.cancel_reason")}</dt>
                    <dd>
                      {b.cancel_reason} {b.cancelled_by ? <span className="text-fg-muted">({partyText(b.cancelled_by)})</span> : null}
                    </dd>
                  </>
                ) : null}
              </dl>
              <section>
                <h3 className="text-fg mb-3 font-semibold">{t("ops.events")}</h3>
                <StatusTimeline status={b.status} events={b.events} />
                {b.events?.length ? (
                  <ol className="border-border mt-4 space-y-1.5 border-t pt-3">
                    {b.events.map((e, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2 text-xs">
                        <span className="text-fg-muted tabular">{f.dateTime(e.at)}</span>
                        <span className="text-fg font-medium">
                          {e.from_status ? `${statusText(e.from_status)} → ` : ""}
                          {statusText(e.to_status)}
                        </span>
                        {e.by_party ? <span className="text-fg-muted">{t("ops.by", { who: partyText(e.by_party) })}</span> : null}
                        {e.note ? <span className="text-fg-body w-full">{e.note}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
              {b.reports?.length ? (
                <section>
                  <h3 className="text-fg mb-2 font-semibold">{t("ops.reports")}</h3>
                  <ul className="space-y-1.5">
                    {b.reports.map((r) => (
                      <li key={r.id} className="text-fg-body">
                        <Badge tone="danger">{r.reason}</Badge> {r.reporter_side} · {f.dateTime(r.created_at)}
                        {r.note ? <p className="mt-0.5">{r.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {b.disputes?.length ? (
                <p>
                  <Link href="/ops/disputes" className="text-brand-text font-semibold hover:underline">
                    {t("ops.open_dispute")} ({f.digits(b.disputes.length)})
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </div>
        {b ? (
          <div className="border-border bg-surface-muted/60 flex flex-wrap gap-2 border-t px-6 py-4">
            {b.sipalu.handle ? (
              <Button variant="danger-outline" onClick={() => setSuspendFor({ handle: b.sipalu.handle as string, name: b.sipalu.name })}>
                <Ban aria-hidden />
                {t("ops.suspend_this", { name: b.sipalu.name })}
              </Button>
            ) : null}
            {["requested", "accepted", "on_the_way"].includes(b.status) ? (
              <div className="flex w-full flex-wrap items-end gap-2">
                <Field id="ops-cancel-reason" label={t("ghar.cancel_reason")} className="min-w-0 flex-1">
                  <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </Field>
                <Button
                  variant="danger"
                  disabled={!cancelReason.trim()}
                  loading={cancel.isPending}
                  onClick={() =>
                    cancel.mutate(
                      { id: b.id, reason: cancelReason.trim() },
                      { onSuccess: () => toast.success(t("ghar.cancelled")), onError: (e) => toast.error(errorMessage(e, tAll)) },
                    )
                  }
                >
                  {t("ghar.cancel")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <SuspendDialog target={suspendFor} onClose={() => setSuspendFor(null)} />
      </SheetContent>
    </Sheet>
  );
}

function SuspendDialog({
  target,
  onClose,
  lift = false,
}: {
  target: { handle: string; name: string } | null;
  onClose: () => void;
  lift?: boolean;
}) {
  const t = useTranslations("bolau.ops");
  const tAll = useTranslations();
  const suspend = useOpsSuspendSipalu();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason("");
    setError(null);
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={tAll("common.close")}>
        <DialogHeader title={lift ? t("unsuspend") : t("suspend_title")} description={t("suspend_body")} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            if (!lift && !reason.trim()) {
              setError(t("reason_required"));
              return;
            }
            suspend.mutate(
              { handle: target.handle, reason: reason.trim(), suspend: !lift },
              {
                onSuccess: () => {
                  toast.success(lift ? t("unsuspended") : t("suspended"));
                  onClose();
                },
                onError: (err) => setError(errorMessage(err, tAll)),
              },
            );
          }}
        >
          <DialogBody className="space-y-3">
            <p className="text-fg font-semibold">
              {target?.name} <span className="text-fg-muted font-normal">@{target?.handle}</span>
            </p>
            <Field id="suspend-reason" label={t("reason")}>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reason_placeholder")} />
            </Field>
            <FormError message={error} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" variant={lift ? "primary" : "danger"} loading={suspend.isPending}>
              {lift ? t("unsuspend") : t("suspend")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestsTable() {
  const t = useTranslations("bolau");
  const tc = useTranslations("common");
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [q]);
  const query = useOpsBolauRequests({ q: q || undefined, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  return (
    <>
      <FilterBar label={tc("filters")} summary={query.data ? tc("results", { count: query.data.count }) : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder={t("ops.search_requests")} label={t("ops.search_requests")} className="sm:w-80" />
      </FilterBar>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("ops.empty")} />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("ops.col.code")}</Th>
                <Th>{t("ops.col.title")}</Th>
                <Th>{t("ops.col.status")}</Th>
                <Th>{t("ops.col.ghardhani")}</Th>
                <Th>{t("ops.col.trade")}</Th>
                <Th numeric>{t("ops.col.offers")}</Th>
                <Th>{t("ops.col.created")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <RowHeader className="font-mono text-sm whitespace-nowrap">{r.code}</RowHeader>
                  <Td className="text-fg">{r.title}</Td>
                  <Td>
                    <Badge tone={r.status === "booked" ? "success" : r.status === "open" || r.status === "offers_received" ? "brand" : "neutral"}>
                      {t(`request.status.${r.status}`)}
                    </Badge>
                  </Td>
                  <Td>{r.ghardhani?.name ?? "—"}</Td>
                  <Td>{r.trade ? f.name(r.trade) : "—"}</Td>
                  <Td numeric>{f.digits(r.offers_count ?? r.offers?.length ?? 0)}</Td>
                  <Td className="whitespace-nowrap tabular">{f.dateTime(r.created_at)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {query.data && query.data.count > PAGE_SIZE ? (
        <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={setPage} />
      ) : null}
    </>
  );
}

function FeesTable() {
  const t = useTranslations("bolau.ops");
  const tc = useTranslations("common");
  const f = useFormat();
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status]);
  const query = useOpsBolauFees({ status: status || undefined, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  const totals = query.data?.totals;
  return (
    <>
      <p className="text-fg-muted mb-3 text-sm">{t("fees_note")}</p>
      {totals ? (
        <DenseStatRow
          className="mb-4"
          label={t("tabs.fees")}
          items={(["paid", "pending", "waived", "refunded"] as const).map((s) => ({
            key: s,
            label: `${t(`fee_status.${s}`)} · ${f.digits(totals[s]?.count ?? 0)}`,
            value: f.money(totals[s]?.amount ?? 0),
            icon: Gauge,
            tone: s === "paid" ? "success" : s === "pending" ? "warning" : "neutral",
          }))}
        />
      ) : null}
      <FilterBar label={tc("filters")} summary={query.data ? tc("results", { count: query.data.count }) : undefined}>
        <NativeSelect
          aria-label={t("col.status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder={t("status_any")}
          options={(["waived", "pending", "paid", "refunded"] as const).map((s) => ({ value: s, label: t(`fee_status.${s}`) }))}
          className="sm:w-48"
        />
      </FilterBar>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("col.code")}</Th>
                <Th>{t("col.payer")}</Th>
                <Th numeric>{t("col.amount")}</Th>
                <Th>{t("col.status")}</Th>
                <Th>{t("col.gateway")}</Th>
                <Th>{t("col.created")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.booking_id}>
                  <RowHeader className="font-mono text-sm whitespace-nowrap">{r.code}</RowHeader>
                  <Td>{r.payer?.name ?? "—"}</Td>
                  <Td numeric>{f.money(r.amount)}</Td>
                  <Td>{t(`fee_status.${r.status}`)}</Td>
                  <Td>{r.provider ?? "—"}</Td>
                  <Td className="whitespace-nowrap tabular">{f.dateTime(r.created_at)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {query.data && query.data.count > PAGE_SIZE ? (
        <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={setPage} />
      ) : null}
    </>
  );
}

function SipaluTable() {
  const t = useTranslations("bolau.ops");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const [q, setQ] = React.useState("");
  const [onlySuspended, setOnlySuspended] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [target, setTarget] = React.useState<{ row: OpsSipaluRow; lift: boolean } | null>(null);
  React.useEffect(() => setPage(1), [q, onlySuspended]);
  const query = useOpsBolauSipalu({ q: q || undefined, suspended: onlySuspended ? 1 : undefined, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  return (
    <>
      <p className="text-fg-muted mb-3 max-w-3xl text-sm">{t("suspend_body")}</p>
      <FilterBar label={tc("filters")} summary={query.data ? tc("results", { count: query.data.count }) : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder={t("handle")} label={t("handle")} className="sm:w-72" />
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlySuspended} onChange={(e) => setOnlySuspended(e.target.checked)} className="accent-brand size-4" />
          {t("only_suspended")}
        </label>
      </FilterBar>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("col.sipalu")}</Th>
                <Th>{t("handle")}</Th>
                <Th>{t("col.status")}</Th>
                <Th>{t("reason")}</Th>
                <Th>
                  <span className="sr-only">{tc("actions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.handle}>
                  <RowHeader>{r.name || <span className="text-fg-muted">{t("no_name")}</span>}</RowHeader>
                  <Td className="font-mono text-sm">@{r.handle}</Td>
                  <Td>
                    {r.suspended_at ? (
                      <Badge tone="danger">{t("badge_suspended")}</Badge>
                    ) : r.bolau_enabled ? (
                      <Badge tone="success">{t("enabled")}</Badge>
                    ) : (
                      <Badge tone="neutral">{ts.has(r.verification_status) ? ts(r.verification_status) : r.verification_status}</Badge>
                    )}
                  </Td>
                  <Td className="text-fg-body max-w-xs truncate">{r.suspension_reason ?? "—"}</Td>
                  <Td numeric>
                    <Button
                      size="sm"
                      variant={r.suspended_at ? "secondary" : "danger-outline"}
                      onClick={() => setTarget({ row: r, lift: !!r.suspended_at })}
                    >
                      {r.suspended_at ? t("unsuspend") : t("suspend")}
                      <span className="sr-only"> {r.name || `@${r.handle}`}</span>
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {query.data && query.data.count > PAGE_SIZE ? (
        <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPageChange={setPage} />
      ) : null}
      <SuspendDialog
        target={target ? { handle: target.row.handle, name: target.row.name } : null}
        lift={target?.lift}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
