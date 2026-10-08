"use client";
import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileWarning,
  Gavel,
  Info,
  Lock,
  MessageSquareReply,
  Paperclip,
  Scale,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateText } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import { useOpsDisputes, useOrgDisputes, useResolveDispute, useRespondDispute } from "@/lib/api/hooks/trust";
import type { Dispute, DisputeStatus } from "@/lib/api/types-trust";
import { useFormat } from "@/lib/use-format";
import { AppealBlock, AppealDialog, DecideAppealDialog } from "./dispute-appeal";
import { EvidenceCountBadge, EvidencePanel } from "./dispute-evidence";

const PAGE_SIZE = 20;
type Mode = "org" | "ops";
type Tab = "active" | "open" | "employer_responded" | "appealed" | "closed" | "all";
const TABS: Tab[] = ["active", "open", "employer_responded", "appealed", "closed", "all"];
const TAB_STATUS: Record<Tab, string | undefined> = {
  active: "open,employer_responded,appealed",
  open: "open",
  employer_responded: "employer_responded",
  appealed: "appealed",
  closed: "resolved,rejected,appeal_resolved",
  all: undefined,
};

export const DISPUTE_TONE: Record<DisputeStatus, BadgeTone> = {
  open: "warning",
  employer_responded: "brand",
  resolved: "success",
  rejected: "danger",
  appealed: "accent",
  appeal_resolved: "success",
};

export function DisputeStatusBadge({ dispute }: { dispute: Pick<Dispute, "status" | "status_label"> }) {
  const t = useTranslations("trust.dispute_status");
  const tm = useTranslations("moderation.dispute_status");
  const fallback =
    dispute.status === "appealed" || dispute.status === "appeal_resolved" ? tm(dispute.status) : t(dispute.status);
  return (
    <Badge tone={DISPUTE_TONE[dispute.status] ?? "neutral"} dot>
      {dispute.status_label || fallback}
    </Badge>
  );
}

/** Employer (/app/disputes) and ops (/ops/disputes) dispute queue. */
export function DisputesPage({ mode }: { mode: Mode }) {
  const session = useSession();
  const te = useTranslations("errors");
  if (mode === "org" && !session.canManage) {
    return <EmptyState icon={Lock} title={te("forbidden_title")} description={te("forbidden_body")} />;
  }
  return <DisputesQueue mode={mode} />;
}

function DisputesQueue({ mode }: { mode: Mode }) {
  const t = useTranslations();
  const td = useTranslations("trust.disputes");
  const tm = useTranslations("moderation");
  const [tab, setTab] = React.useState<Tab>("active");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [responding, setResponding] = React.useState<Dispute | null>(null);
  const [resolving, setResolving] = React.useState<Dispute | null>(null);
  const [appealing, setAppealing] = React.useState<Dispute | null>(null);
  const [decidingAppeal, setDecidingAppeal] = React.useState<Dispute | null>(null);
  React.useEffect(() => setPage(1), [tab, q]);

  const params = { status: TAB_STATUS[tab], q: q || undefined, page, page_size: PAGE_SIZE };
  const orgQuery = useOrgDisputes(params, mode === "org");
  const opsQuery = useOpsDisputes(params, mode === "ops");
  const query = mode === "org" ? orgQuery : opsQuery;
  const rows = query.data?.results ?? [];
  const count = query.data?.count ?? 0;

  return (
    <div>
      <PageHeader
        title={mode === "org" ? t("nav.disputes") : t("nav.ops_disputes")}
        description={mode === "org" ? td("org_description") : td("ops_description")}
      />
      <Toolbar className="sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="max-w-full overflow-x-auto">
            {TABS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {s === "appealed" ? tm("disputes.tab_appealed") : td(`tab_${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput value={q} onChange={setQ} placeholder={td("search_placeholder")} className="sm:w-72" />
      </Toolbar>

      {query.isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
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
          <EmptyState icon={FileWarning} title={td("empty_title")} description={td(`empty_${mode}`)} />
        )
      ) : (
        <>
          <ul className={query.isFetching ? "space-y-3 opacity-70 transition-opacity" : "space-y-3"}>
            {rows.map((d) => (
              <li key={d.id}>
                <DisputeCard
                  dispute={d}
                  mode={mode}
                  onRespond={() => setResponding(d)}
                  onResolve={() => setResolving(d)}
                  onAppeal={() => setAppealing(d)}
                  onDecideAppeal={() => setDecidingAppeal(d)}
                />
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}

      <RespondDialog dispute={responding} onClose={() => setResponding(null)} />
      <ResolveDialog dispute={resolving} onClose={() => setResolving(null)} />
      <AppealDialog dispute={appealing} onClose={() => setAppealing(null)} />
      <DecideAppealDialog dispute={decidingAppeal} onClose={() => setDecidingAppeal(null)} />
    </div>
  );
}

function DisputeCard({
  dispute: d,
  mode,
  onRespond,
  onResolve,
  onAppeal,
  onDecideAppeal,
}: {
  dispute: Dispute;
  mode: Mode;
  onRespond: () => void;
  onResolve: () => void;
  onAppeal: () => void;
  onDecideAppeal: () => void;
}) {
  const td = useTranslations("trust.disputes");
  const tk = useTranslations("trust.dispute_kind");
  const tm = useTranslations("moderation");
  const f = useFormat();
  const [showEvidence, setShowEvidence] = React.useState(false);
  const firstDecisionPending = d.status === "open" || d.status === "employer_responded";
  const evidencePanelId = `dispute-evidence-${d.id}`;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-fg">{d.worker.full_name}</span>
            <span className="text-xs text-fg-muted tabular">{d.worker.phone_masked}</span>
            <Badge tone="outline">{d.kind_label || tk(d.kind)}</Badge>
            <DisputeStatusBadge dispute={d} />
            <EvidenceCountBadge count={d.evidence_count} />
          </div>
          <p className="text-xs text-fg-muted">
            {[
              mode === "ops" ? (d.organization?.name ?? td("no_employer")) : null,
              d.employment?.designation,
              d.payslip ? td("payslip_month", { month: f.bsMonth(d.payslip.bs_year, d.payslip.bs_month) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {mode === "org" && firstDecisionPending ? (
            <Button size="sm" variant={d.status === "open" ? "primary" : "secondary"} onClick={onRespond}>
              <MessageSquareReply aria-hidden />
              {d.status === "open" ? td("respond") : td("update_response")}
            </Button>
          ) : null}
          {mode === "ops" && firstDecisionPending ? (
            <Button size="sm" onClick={onResolve}>
              <CheckCircle2 aria-hidden />
              {td("decide")}
            </Button>
          ) : null}
          {mode === "org" && d.can_appeal ? (
            <Button size="sm" variant="secondary" onClick={onAppeal}>
              <Scale aria-hidden />
              {tm("appeal.button")}
            </Button>
          ) : null}
          {mode === "ops" && d.status === "appealed" ? (
            <Button size="sm" onClick={onDecideAppeal}>
              <Gavel aria-hidden />
              {tm("appeal.decide")}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm whitespace-pre-line text-fg-body">{d.description}</p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-muted">{td("raised")}</dt>
          <dd className="text-fg">{f.dateTime(d.raised_at)}</dd>
        </div>
        {d.attendance_date ? (
          <div>
            <dt className="text-xs text-fg-muted">{td("attendance_date")}</dt>
            <dd>
              <DateText ad={d.attendance_date} bs={d.attendance_date_bs} inline />
            </dd>
          </div>
        ) : null}
        {d.resolved_at ? (
          <div>
            <dt className="text-xs text-fg-muted">{td("decided")}</dt>
            <dd className="text-fg">
              {f.dateTime(d.resolved_at)}
              {d.resolved_by ? <span className="text-fg-muted"> · {d.resolved_by.full_name}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {d.employer_note ? (
        <NoteBlock label={td("employer_note")} when={d.responded_at} text={d.employer_note} />
      ) : null}
      {d.resolution_note ? (
        <NoteBlock label={td("resolution_note")} when={d.resolved_at} text={d.resolution_note} tone="ops" />
      ) : null}
      {d.appeal ? <AppealBlock appeal={d.appeal} /> : null}
      {mode === "org" && d.can_appeal && d.appeal_deadline ? (
        <p className="mt-2 text-xs text-fg-muted">
          {tm("appeal.deadline_short", { date: f.dateTime(d.appeal_deadline) })}
        </p>
      ) : null}

      <div className="mt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowEvidence((v) => !v)}
          aria-expanded={showEvidence}
          aria-controls={evidencePanelId}
        >
          <Paperclip aria-hidden />
          {tm("evidence.toggle", { count: d.evidence_count ?? 0 })}
          <ChevronDown className={showEvidence ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
        </Button>
        <div id={evidencePanelId}>{showEvidence ? <EvidencePanel dispute={d} scope={mode} /> : null}</div>
      </div>
    </Card>
  );
}

function NoteBlock({
  label,
  text,
  when,
  tone,
}: {
  label: string;
  text: string;
  when: string | null;
  tone?: "ops";
}) {
  const f = useFormat();
  return (
    <div
      className={
        tone === "ops"
          ? "mt-3 rounded-md border border-border bg-brand-subtle/50 px-3 py-2"
          : "mt-3 rounded-md border border-border bg-surface-muted px-3 py-2"
      }
    >
      <p className="text-xs font-medium text-fg-muted">
        {label}
        {when ? <span className="font-normal"> · {f.dateTime(when)}</span> : null}
      </p>
      <p className="mt-0.5 text-sm whitespace-pre-line text-fg">{text}</p>
    </div>
  );
}

function RespondDialog({ dispute, onClose }: { dispute: Dispute | null; onClose: () => void }) {
  const t = useTranslations();
  const td = useTranslations("trust.disputes");
  const respond = useRespondDispute();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setNote(dispute?.employer_note ?? "");
    setError(null);
  }, [dispute]);
  if (!dispute) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError(t("errors.required"));
      return;
    }
    respond.mutate(
      { id: dispute.id, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(td("responded_toast"));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={td("respond_title")} description={dispute.worker.full_name} />
          <DialogBody className="space-y-4">
            <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-muted px-3 py-2 text-sm whitespace-pre-line text-fg-body">
              {dispute.description}
            </blockquote>
            <FormError message={error} />
            <Field id="dispute-response" label={td("your_response")} hint={td("response_hint")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={5} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={respond.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={respond.isPending}>
              {td("send_response")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ dispute, onClose }: { dispute: Dispute | null; onClose: () => void }) {
  const t = useTranslations();
  const td = useTranslations("trust.disputes");
  const resolve = useResolveDispute();
  const [status, setStatus] = React.useState<"resolved" | "rejected">("resolved");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setStatus("resolved");
    setNote("");
    setError(null);
  }, [dispute]);
  if (!dispute) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError(t("errors.required"));
      return;
    }
    resolve.mutate(
      { id: dispute.id, status, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(status === "resolved" ? td("resolved_toast") : td("rejected_toast"));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={td("decide_title")}
            description={`${dispute.worker.full_name}${dispute.organization ? ` · ${dispute.organization.name}` : ""}`}
          />
          <DialogBody className="space-y-4">
            <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-muted px-3 py-2 text-sm whitespace-pre-line text-fg-body">
              {dispute.description}
            </blockquote>
            {dispute.employer_note ? (
              <NoteBlock label={td("employer_note")} when={dispute.responded_at} text={dispute.employer_note} />
            ) : null}
            <FormError message={error} />
            <Segmented
              label={td("decision")}
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: "resolved",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {td("resolve")}
                    </span>
                  ),
                },
                {
                  value: "rejected",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="size-4" aria-hidden />
                      {td("reject")}
                    </span>
                  ),
                },
              ]}
            />
            <Field id="dispute-resolution" label={td("resolution_note")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={4} />
            </Field>
            <p className="flex gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-fg-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {td("no_auto_edit")}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={resolve.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant={status === "rejected" ? "danger" : "primary"} loading={resolve.isPending}>
              {status === "resolved" ? td("resolve") : td("reject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
