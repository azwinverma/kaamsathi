"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ChevronLeft,
  ExternalLink,
  HelpCircle,
  ListChecks,
  Phone,
  PhoneOff,
  ShieldX,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, DescriptionList } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { VerificationBadge } from "@/components/shared/status-badge";
import { hoursSince } from "@/components/ops/helpers";
import { useOpsWorkHistory, useVerifyWorkHistory } from "@/lib/api/hooks/experience";
import {
  WORK_HISTORY_METHODS,
  type OpsWorkHistoryEntry,
  type WorkHistoryDecision,
  type WorkHistoryMethod,
  type WorkHistoryStatus,
} from "@/lib/api/types-experience";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { WorkHistoryStatusBadge } from "./badges";

type Filter = WorkHistoryStatus | "all";
const FILTERS: Filter[] = [
  "reference_pending",
  "self_reported",
  "verified",
  "unverifiable",
  "rejected",
  "all",
];
const QUEUE_FILTERS = new Set<Filter>(["reference_pending", "self_reported"]);
const SCRIPT_STEPS = ["intro", "confirm_worked", "role_dates", "rehire", "close"] as const;

/** /ops/references — reference-check queue for external work history. */
export function ReferenceQueue() {
  const t = useTranslations("experience.queue");
  const ts = useTranslations("experience.status");
  const f = useFormat();
  const [filter, setFilter] = React.useState<Filter>("reference_pending");
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Set<string>>(() => new Set());
  const [mobileDetail, setMobileDetail] = React.useState(false);

  const query = useOpsWorkHistory({
    status: filter === "all" ? undefined : filter,
    q: q || undefined,
    page_size: 50,
  });
  const isQueue = QUEUE_FILTERS.has(filter);
  const rows = React.useMemo(
    () => (query.data?.results ?? []).filter((e) => !(isQueue && done.has(e.id))),
    [query.data, done, isQueue],
  );
  const current = rows.find((e) => e.id === selectedId) ?? null;
  const index = current ? rows.findIndex((e) => e.id === current.id) : -1;
  const remaining = isQueue
    ? Math.max(0, (query.data?.count ?? 0) - done.size)
    : (query.data?.count ?? 0);

  React.useEffect(() => {
    if (query.isLoading) return;
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId, query.isLoading]);

  const onDecided = () => {
    if (!current || !isQueue) return;
    const next = rows[index + 1] ?? rows[index - 1] ?? null;
    setDone((s) => new Set(s).add(current.id));
    setSelectedId(next && next.id !== current.id ? next.id : null);
    if (!next) setMobileDetail(false);
  };

  const changeFilter = (v: Filter) => {
    setFilter(v);
    setSelectedId(null);
    setDone(new Set());
    setMobileDetail(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented
          label={t("filter_label")}
          value={filter}
          onChange={changeFilter}
          size="sm"
          className="max-w-full overflow-x-auto"
          options={FILTERS.map((v) => ({ value: v, label: v === "all" ? t("filter_all") : ts(v) }))}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={t("search_placeholder")}
          className="sm:max-w-xs sm:flex-1"
        />
        <Badge tone={remaining && isQueue ? "warning" : "neutral"} className="sm:ml-auto">
          {isQueue ? t("remaining", { count: remaining }) : f.digits(remaining)}
        </Badge>
      </div>

      {query.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]" aria-busy>
          <Skeleton className="h-[420px] rounded-lg" />
          <Skeleton className="h-[520px] rounded-lg max-lg:hidden" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={done.size && isQueue ? t("done_title") : t("empty_title")}
          description={q || !isQueue ? t("empty_filtered") : t("empty_body")}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <Card
            className={cn("overflow-hidden lg:sticky lg:top-24", mobileDetail && "max-lg:hidden")}
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <p className="text-fg text-sm font-semibold">{t("list_label")}</p>
              {isQueue ? <span className="text-fg-muted text-xs">{t("oldest_first")}</span> : null}
            </div>
            <ul
              className="max-h-[calc(100dvh-300px)] scrollbar-thin overflow-y-auto"
              aria-label={t("list_label")}
            >
              {rows.map((e) => {
                const active = e.id === current?.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(e.id);
                        setMobileDetail(true);
                      }}
                      aria-current={active || undefined}
                      className={cn(
                        "border-border hover:bg-surface-hover flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left transition-colors last:border-0 max-lg:min-h-14",
                        active && "bg-brand-subtle hover:bg-brand-subtle",
                      )}
                    >
                      <span className="text-fg block w-full truncate text-sm font-medium">
                        {e.worker.full_name}
                      </span>
                      <span className="text-fg-muted block w-full truncate text-xs">
                        {e.role_title} · {e.employer_name}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        {isQueue ? (
                          <span className="text-fg-muted text-xs">
                            {t("waiting", { time: f.hours(hoursSince(e.created_at)) })}
                          </span>
                        ) : (
                          <WorkHistoryStatusBadge status={e.status} label={e.status_label} />
                        )}
                        {e.employer_org ? (
                          <Badge tone="brand">
                            <Building2 aria-hidden />
                            {t("on_platform")}
                          </Badge>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className={cn(!mobileDetail && "max-lg:hidden")}>
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 lg:hidden"
              onClick={() => setMobileDetail(false)}
            >
              <ChevronLeft aria-hidden />
              {t("back_to_queue")}
            </Button>
            {current ? (
              <ReferenceReview key={current.id} entry={current} onDecided={onDecided} />
            ) : (
              <EmptyState icon={ListChecks} title={t("select_prompt")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceReview({
  entry: e,
  onDecided,
}: {
  entry: OpsWorkHistoryEntry;
  onDecided: () => void;
}) {
  const t = useTranslations("experience.queue");
  const f = useFormat();
  const decided = !QUEUE_FILTERS.has(e.status);
  const [editing, setEditing] = React.useState(!decided);
  const period = `${f.dateText(e.start_date, e.start_date_bs)} – ${
    e.end_date ? f.dateText(e.end_date, e.end_date_bs) : t("present")
  }`;

  return (
    <Card>
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-fg-muted text-xs font-medium">{e.employer_name}</p>
          <h2 className="text-fg text-lg font-semibold">{e.role_title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <WorkHistoryStatusBadge status={e.status} label={e.status_label} />
            <span className="text-fg-muted text-xs">{t("months", { count: e.months })}</span>
          </div>
        </div>
      </div>

      <CardBody className="space-y-6 pt-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="border-border rounded-lg border p-3">
              <p className="text-fg-muted text-xs font-medium">{t("worker")}</p>
              <p className="text-fg mt-0.5 font-medium">{e.worker.full_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <VerificationBadge status={e.worker.verification_status} />
                <span className="text-fg-muted tabular text-xs">{f.phone(e.worker.phone)}</span>
              </div>
              <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0">
                <Link href={`/ops/workers/${e.worker.id}`}>
                  <UserRound aria-hidden />
                  {t("view_worker")}
                </Link>
              </Button>
            </div>
            {e.worker.verification_status !== "verified" ? (
              <div className="border-warning/30 bg-warning-subtle text-warning flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("identity_unverified")}</span>
              </div>
            ) : null}
            <DescriptionList
              columns={2}
              items={[
                { label: t("employer"), value: e.employer_name, full: true },
                { label: t("period"), value: period, full: true },
                { label: t("trade"), value: e.trade ? f.name(e.trade) : "—" },
                { label: t("district"), value: e.district ? f.name(e.district) : "—" },
                ...(e.description
                  ? [{ label: t("description"), value: e.description, full: true }]
                  : []),
              ]}
            />
            {e.employer_org ? (
              <p className="border-brand/30 bg-brand-subtle text-brand-subtle-fg flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
                <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("on_platform_hint", { name: e.employer_org.name })}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <ReferenceCard entry={e} />
            <CallScript entry={e} />
          </div>
        </div>

        {decided && !editing ? (
          <div className="border-border bg-surface-muted/50 space-y-3 rounded-lg border p-4">
            <p className="text-fg text-sm font-semibold">{t("decision")}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <WorkHistoryStatusBadge status={e.status} label={e.status_label} />
              {e.verification_method_label ? (
                <span className="text-fg-body">{e.verification_method_label}</span>
              ) : null}
              {e.verified_by ? (
                <span className="text-fg-muted">
                  · {t("decided_by", { name: e.verified_by.full_name })}
                </span>
              ) : null}
              {e.verified_at ? (
                <span className="text-fg-muted">· {f.dateTime(e.verified_at)}</span>
              ) : null}
            </div>
            {e.note ? <p className="text-fg-body text-sm">{e.note}</p> : null}
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              {t("change_decision")}
            </Button>
          </div>
        ) : (
          <div className="border-border bg-surface-muted/50 rounded-lg border p-4">
            <DecisionForm entry={e} onDone={onDecided} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ReferenceCard({ entry: e }: { entry: OpsWorkHistoryEntry }) {
  const t = useTranslations("experience.queue");
  const f = useFormat();
  return (
    <div className="border-border rounded-lg border p-3">
      <p className="text-fg-muted text-xs font-medium">{t("reference")}</p>
      {e.reference_phone ? (
        <>
          <p className="text-fg mt-0.5 font-medium">{e.reference_name || "—"}</p>
          <Button asChild size="sm" className="mt-2">
            <a href={`tel:${e.reference_phone}`}>
              <Phone aria-hidden />
              {t("call", { phone: f.phone(e.reference_phone) })}
            </a>
          </Button>
        </>
      ) : (
        <p className="text-fg-muted mt-1 flex items-center gap-2 text-sm">
          <PhoneOff className="size-4" aria-hidden />
          {t("no_reference")}
        </p>
      )}
      <div className="mt-3">
        {e.document_url ? (
          <a
            href={e.document_url}
            target="_blank"
            rel="noreferrer"
            className="text-brand inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t("view_document")}
          </a>
        ) : (
          <span className="text-fg-muted text-xs">{t("no_document")}</span>
        )}
      </div>
    </div>
  );
}

function CallScript({ entry: e }: { entry: OpsWorkHistoryEntry }) {
  const t = useTranslations("experience.queue.script");
  const f = useFormat();
  const vars = {
    reference: e.reference_name || t("reference_fallback"),
    worker: e.worker.full_name,
    employer: e.employer_name,
    role: e.role_title,
    from: f.dateText(e.start_date, e.start_date_bs),
    to: e.end_date ? f.dateText(e.end_date, e.end_date_bs) : t("now"),
  };
  return (
    <details className="border-border group rounded-lg border p-3" open={!!e.reference_phone}>
      <summary className="text-fg flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <HelpCircle className="text-fg-muted size-4" aria-hidden />
        {t("title")}
      </summary>
      <ol className="text-fg-body mt-2 list-decimal space-y-1.5 pl-5 text-sm">
        {SCRIPT_STEPS.map((k) => (
          <li key={k}>{t(k, vars)}</li>
        ))}
      </ol>
      <p className="text-fg-muted mt-2 text-xs">{t("privacy")}</p>
    </details>
  );
}

function DecisionForm({ entry: e, onDone }: { entry: OpsWorkHistoryEntry; onDone: () => void }) {
  const t = useTranslations("experience.queue");
  const tm = useTranslations("experience.method");
  const th = useTranslations("experience.method_hint");
  const tRoot = useTranslations();
  const verify = useVerifyWorkHistory();
  const [method, setMethod] = React.useState<WorkHistoryMethod>(
    e.employer_org ? "employer_confirmed" : e.reference_phone ? "reference_call" : "document",
  );
  const [note, setNote] = React.useState(e.note ?? "");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<WorkHistoryDecision | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const decide = (status: WorkHistoryDecision) => {
    if (verify.isPending) return;
    const trimmed = note.trim();
    if (status !== "verified" && !trimmed) {
      setNoteError(t("note_required"));
      noteRef.current?.focus();
      return;
    }
    setNoteError(null);
    setPending(status);
    verify.mutate(
      { id: e.id, status, method: status === "verified" ? method : null, note: trimmed },
      {
        onSuccess: () => {
          toast.success(t(`toast_${status}`, { name: e.worker.full_name }));
          onDone();
        },
        onError: (err) => toastError(err, tRoot),
        onSettled: () => setPending(null),
      },
    );
  };

  const noteId = `wh-note-${e.id}`;
  return (
    <div className="space-y-4">
      <Field id={`wh-method-${e.id}`} label={t("method_label")} hint={th(method)}>
        <NativeSelect
          value={method}
          onChange={(ev) => setMethod(ev.target.value as WorkHistoryMethod)}
          options={WORK_HISTORY_METHODS.map((m) => ({ value: m, label: tm(m) }))}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={noteId}>
          {t("note_label")} <span className="text-fg-muted font-normal">({t("note_hint")})</span>
        </Label>
        <Textarea
          id={noteId}
          ref={noteRef}
          rows={2}
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          placeholder={t("note_placeholder")}
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? `${noteId}-error` : undefined}
        />
        {noteError ? (
          <p id={`${noteId}-error`} role="alert" className="text-danger text-xs font-medium">
            {noteError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="danger"
          onClick={() => decide("rejected")}
          loading={pending === "rejected"}
          disabled={verify.isPending}
        >
          <ShieldX aria-hidden />
          {t("reject")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => decide("unverifiable")}
          loading={pending === "unverifiable"}
          disabled={verify.isPending}
        >
          <PhoneOff aria-hidden />
          {t("unverifiable")}
        </Button>
        <Button
          onClick={() => decide("verified")}
          loading={pending === "verified"}
          disabled={verify.isPending}
        >
          <BadgeCheck aria-hidden />
          {t("verify")}
        </Button>
      </div>
    </div>
  );
}
