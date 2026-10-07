"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  ListChecks,
  PencilLine,
  ShieldX,
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
import { useOpsCredentials, useVerifyCredential } from "@/lib/api/hooks/credentials";
import {
  VERIFICATION_METHODS,
  type CredentialStatus,
  type OpsCredential,
  type VerificationMethod,
} from "@/lib/api/types-credentials";
import type { VerificationStatus } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { CredentialDocument, CredentialStatusBadge, ExpiryText } from "./shared";

type Filter = CredentialStatus | "all";
const FILTERS: Filter[] = ["pending", "verified", "rejected", "expired", "all"];

/** Ops verification queue for worker-uploaded credentials (/ops/credentials). */
export function CredentialQueue({
  workerId,
  onClearWorker,
}: {
  workerId?: string | null;
  onClearWorker?: () => void;
}) {
  const t = useTranslations("credentials.queue");
  const ts = useTranslations("credentials.status");
  const tc = useTranslations("common");
  const f = useFormat();
  const [filter, setFilter] = React.useState<Filter>(workerId ? "all" : "pending");
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Set<string>>(() => new Set());
  const [reviewed, setReviewed] = React.useState(0);
  const [mobileDetail, setMobileDetail] = React.useState(false);

  const query = useOpsCredentials({
    status: filter === "all" ? undefined : filter,
    q: q || undefined,
    worker: workerId || undefined,
    page_size: 50,
  });
  const isQueue = filter === "pending";
  const rows = React.useMemo(
    () => (query.data?.results ?? []).filter((c) => !(isQueue && done.has(c.id))),
    [query.data, done, isQueue],
  );
  const current = rows.find((c) => c.id === selectedId) ?? null;
  const index = current ? rows.findIndex((c) => c.id === current.id) : -1;
  const remaining = isQueue
    ? Math.max(0, (query.data?.count ?? 0) - done.size)
    : (query.data?.count ?? 0);

  React.useEffect(() => {
    if (query.isLoading) return;
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId, query.isLoading]);

  const go = React.useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const i = index < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, index + delta));
      setSelectedId(rows[i].id);
    },
    [index, rows],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === "KeyJ") {
        e.preventDefault();
        go(1);
      } else if (e.code === "KeyK") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onDecided = () => {
    if (!current) return;
    setReviewed((n) => n + 1);
    if (isQueue) {
      const next = rows[index + 1] ?? rows[index - 1] ?? null;
      setDone((s) => new Set(s).add(current.id));
      setSelectedId(next && next.id !== current.id ? next.id : null);
      if (!next) setMobileDetail(false);
    }
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
        {workerId && onClearWorker ? (
          <Button variant="secondary" size="sm" onClick={onClearWorker}>
            {rows[0]?.worker.full_name ?? t("list_label")} ×
            <span className="sr-only">{tc("clear_filters")}</span>
          </Button>
        ) : null}
        <div className="flex items-center gap-2 sm:ml-auto">
          <Badge tone={remaining && isQueue ? "warning" : "neutral"}>
            {isQueue ? t("remaining", { count: remaining }) : f.digits(remaining)}
          </Badge>
          {reviewed ? (
            <Badge tone="brand">{t("reviewed_session", { count: f.digits(reviewed) })}</Badge>
          ) : null}
        </div>
      </div>

      {query.isLoading ? (
        <QueueSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={reviewed && isQueue ? t("done_title") : t("empty_title")}
          description={
            reviewed && isQueue
              ? t("done_body", { count: f.digits(reviewed) })
              : q || !isQueue
                ? t("empty_filtered")
                : t("empty_body")
          }
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
              {rows.map((c) => {
                const active = c.id === current?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setMobileDetail(true);
                      }}
                      aria-current={active || undefined}
                      className={cn(
                        "border-border hover:bg-surface-hover flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 max-lg:min-h-14",
                        active && "bg-brand-subtle hover:bg-brand-subtle",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-fg block truncate text-sm font-medium">
                          {c.title}
                        </span>
                        <span className="text-fg-muted block truncate text-xs">
                          {c.worker.full_name} · {c.kind_label}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {isQueue ? (
                            <span className="text-fg-muted text-xs">
                              {t("uploaded_ago", { time: f.hours(hoursSince(c.created_at)) })}
                            </span>
                          ) : (
                            <CredentialStatusBadge credential={c} />
                          )}
                        </span>
                      </span>
                      {!c.document_url ? (
                        <FileQuestion
                          className="text-warning mt-0.5 size-4 shrink-0"
                          aria-label={t("no_document")}
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {(query.data?.count ?? 0) > (query.data?.results.length ?? 0) ? (
              <p className="border-border text-fg-muted border-t px-4 py-2 text-xs">
                {t("more_after")}
              </p>
            ) : null}
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
              <CredentialReview
                key={current.id}
                credential={current}
                position={index + 1}
                total={rows.length}
                onPrev={() => go(-1)}
                onNext={() => go(1)}
                onDecided={onDecided}
              />
            ) : (
              <EmptyState icon={ListChecks} title={t("select_prompt")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialReview({
  credential: c,
  position,
  total,
  onPrev,
  onNext,
  onDecided,
}: {
  credential: OpsCredential;
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onDecided: () => void;
}) {
  const t = useTranslations("credentials.review");
  const tq = useTranslations("credentials.queue");
  const f = useFormat();
  const decided = c.status !== "pending";
  const [editing, setEditing] = React.useState(!decided);

  return (
    <Card>
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-fg-muted text-xs font-medium">{c.kind_label}</p>
          <h2 className="text-fg text-lg font-semibold">{c.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CredentialStatusBadge credential={c} />
            <ExpiryText days={c.days_to_expiry} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-fg-muted tabular mr-1 text-xs">
            {f.digits(position)} / {f.digits(total)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPrev}
            aria-label={tq("back_to_queue")}
            title="Alt+K"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNext}
            aria-label={tq("select_prompt")}
            title="Alt+J"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <CardBody className="space-y-6 pt-5">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CredentialDocument credential={c} />
          <div className="space-y-4">
            <div className="border-border rounded-lg border p-3">
              <p className="text-fg-muted text-xs font-medium">{t("worker")}</p>
              <p className="text-fg mt-0.5 font-medium">{c.worker.full_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {c.worker.verification_status ? (
                  <VerificationBadge status={c.worker.verification_status as VerificationStatus} />
                ) : null}
                {c.worker.phone ? (
                  <span className="text-fg-muted tabular text-xs">{f.phone(c.worker.phone)}</span>
                ) : null}
              </div>
              <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0">
                <Link href={`/ops/workers/${c.worker.id}`}>
                  <PencilLine aria-hidden />
                  {t("view_worker")}
                </Link>
              </Button>
            </div>
            {c.worker.verification_status && c.worker.verification_status !== "verified" ? (
              <div className="border-warning/30 bg-warning-subtle text-warning flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("identity_unverified")}</span>
              </div>
            ) : null}
            <DescriptionList
              columns={2}
              items={[
                { label: t("issuer"), value: c.issuer, full: true },
                {
                  label: t("certificate_no"),
                  value: c.certificate_no ? (
                    <span className="tabular">{c.certificate_no}</span>
                  ) : (
                    "—"
                  ),
                },
                { label: t("level"), value: c.level || "—" },
                {
                  label: t("issued_on"),
                  value: c.issued_on ? f.date(c.issued_on, c.issued_on_bs).bs : "—",
                },
                {
                  label: t("expires_on"),
                  value: c.expires_on ? f.date(c.expires_on, c.expires_on_bs).bs : t("no_expiry"),
                },
              ]}
            />
          </div>
        </div>

        {decided && !editing ? (
          <div className="border-border bg-surface-muted/50 space-y-3 rounded-lg border p-4">
            <p className="text-fg text-sm font-semibold">{t("decision")}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <CredentialStatusBadge credential={c} />
              {c.verification_method_label ? (
                <span className="text-fg-body">{c.verification_method_label}</span>
              ) : null}
              {c.verified_by ? (
                <span className="text-fg-muted">
                  · {t("decided_by", { name: c.verified_by.full_name })}
                </span>
              ) : null}
              {c.verified_at ? (
                <span className="text-fg-muted">· {f.dateTime(c.verified_at)}</span>
              ) : null}
            </div>
            {c.note ? <p className="text-fg-body text-sm">{c.note}</p> : null}
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              {t("change_decision")}
            </Button>
          </div>
        ) : (
          <div className="border-border bg-surface-muted/50 rounded-lg border p-4">
            <DecisionForm credential={c} onDone={onDecided} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DecisionForm({
  credential: c,
  onDone,
}: {
  credential: OpsCredential;
  onDone: () => void;
}) {
  const t = useTranslations("credentials.review");
  const tm = useTranslations("credentials.method");
  const th = useTranslations("credentials.method_hint");
  const tRoot = useTranslations();
  const verify = useVerifyCredential();
  const [method, setMethod] = React.useState<VerificationMethod>(
    c.document_url ? "document" : "ops_call",
  );
  const [note, setNote] = React.useState(c.note ?? "");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"verified" | "rejected" | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const decide = React.useCallback(
    (status: "verified" | "rejected") => {
      if (verify.isPending) return;
      const trimmed = note.trim();
      if (status === "rejected" && !trimmed) {
        setNoteError(t("note_required"));
        noteRef.current?.focus();
        return;
      }
      setNoteError(null);
      setPending(status);
      verify.mutate(
        { id: c.id, status, method, note: trimmed || undefined },
        {
          onSuccess: () => {
            toast.success(
              status === "verified"
                ? t("verified_toast", { title: c.title })
                : t("rejected_toast", { title: c.title }),
            );
            onDone();
          },
          onError: (e) => toastError(e, tRoot),
          onSettled: () => setPending(null),
        },
      );
    },
    [verify, note, method, c.id, c.title, t, tRoot, onDone],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === "KeyV") {
        e.preventDefault();
        decide("verified");
      } else if (e.code === "KeyR") {
        e.preventDefault();
        decide("rejected");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const noteId = `cred-note-${c.id}`;
  return (
    <div className="space-y-4">
      <Field id={`cred-method-${c.id}`} label={t("method_label")} hint={th(method)}>
        <NativeSelect
          value={method}
          onChange={(e) => setMethod(e.target.value as VerificationMethod)}
          options={VERIFICATION_METHODS.map((m) => ({ value: m, label: tm(m) }))}
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
          onChange={(e) => setNote(e.target.value)}
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
          onClick={() => decide("verified")}
          loading={pending === "verified"}
          disabled={verify.isPending}
        >
          <BadgeCheck aria-hidden />
          {t("verify")}
        </Button>
      </div>
      <p className="text-fg-muted hidden text-xs lg:block">{t("shortcuts")}</p>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]" aria-busy>
      <Skeleton className="h-[420px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg max-lg:hidden" />
    </div>
  );
}
