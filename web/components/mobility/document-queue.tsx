"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  Copy,
  FileQuestion,
  ListChecks,
  PencilLine,
  ShieldX,
} from "lucide-react";
import { hoursSince } from "@/components/ops/helpers";
import { VerificationBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, DescriptionList } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { useOpsMobilityDocuments, useVerifyMobilityDocument } from "@/lib/api/hooks/mobility";
import type { VerificationStatus } from "@/lib/api/types";
import {
  MOBILITY_DOC_STATUSES,
  type MobilityDocStatus,
  type MobilityKindGroup,
  type OpsMobilityDocument,
} from "@/lib/api/types-mobility";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { DocStatusBadge, DocumentViewer, ExpiryText } from "./shared";

type Filter = MobilityDocStatus | "all";
type GroupFilter = MobilityKindGroup | "all";
const FILTERS: Filter[] = [...MOBILITY_DOC_STATUSES, "all"];
const GROUPS: GroupFilter[] = ["all", "travel", "clearance"];

/** Ops queue for worker-uploaded passports, permits and clearances (/ops/mobility). */
export function DocumentQueue() {
  const t = useTranslations("mobility.queue");
  const ts = useTranslations("mobility.status");
  const tg = useTranslations("mobility.group");
  const f = useFormat();
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [group, setGroup] = React.useState<GroupFilter>("all");
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = React.useState(false);
  const query = useOpsMobilityDocuments({
    status: filter === "all" ? undefined : filter,
    kind_group: group === "all" ? undefined : group,
    q: q || undefined,
    page_size: 50,
  });
  const rows = React.useMemo(() => query.data?.results ?? [], [query.data]);
  const current = rows.find((d) => d.id === selectedId) ?? null;
  const isQueue = filter === "pending";

  React.useEffect(() => {
    if (query.isLoading) return;
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId, query.isLoading]);

  const onDecided = () => {
    if (!current || !isQueue) return;
    const i = rows.findIndex((r) => r.id === current.id);
    const next = rows[i + 1] ?? rows[i - 1] ?? null;
    setSelectedId(next?.id ?? null);
    if (!next) setMobileDetail(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented
          label={t("filter_label")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setSelectedId(null);
          }}
          size="sm"
          className="max-w-full overflow-x-auto"
          options={FILTERS.map((v) => ({ value: v, label: v === "all" ? t("filter_all") : ts(v) }))}
        />
        <Segmented
          label={t("group_label")}
          value={group}
          onChange={setGroup}
          size="sm"
          options={GROUPS.map((g) => ({ value: g, label: g === "all" ? t("group_all") : tg(g) }))}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={t("search_placeholder")}
          className="sm:max-w-xs sm:flex-1"
        />
        <Badge tone={isQueue && query.data?.count ? "warning" : "neutral"} className="sm:ml-auto">
          {isQueue
            ? t("remaining", { count: query.data?.count ?? 0 })
            : f.digits(query.data?.count ?? 0)}
        </Badge>
      </div>

      {query.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]" aria-busy>
          <Skeleton className="h-[420px] rounded-dense" />
          <Skeleton className="h-[520px] rounded-dense max-lg:hidden" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={t("empty_title")}
          description={q || !isQueue || group !== "all" ? t("empty_filtered") : t("empty_body")}
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
              {rows.map((d) => {
                const active = d.id === current?.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(d.id);
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
                          {d.worker.full_name}
                        </span>
                        <span className="text-fg-muted block truncate text-xs">
                          {d.kind_label}
                          {d.number_masked ? ` · ${d.number_masked}` : ""}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {isQueue ? (
                            <span className="text-fg-muted text-xs">
                              {t("uploaded_ago", { time: f.hours(hoursSince(d.created_at)) })}
                            </span>
                          ) : (
                            <DocStatusBadge doc={d} />
                          )}
                          <ExpiryText days={d.days_to_expiry} />
                        </span>
                      </span>
                      {d.duplicate_number ? (
                        <Copy
                          className="text-danger mt-0.5 size-4 shrink-0"
                          aria-label={t("duplicate")}
                        />
                      ) : !d.document_url ? (
                        <FileQuestion className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {(query.data?.count ?? 0) > rows.length ? (
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
              <DocumentReview key={current.id} doc={current} onDecided={onDecided} />
            ) : (
              <EmptyState icon={ListChecks} title={t("select_prompt")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentReview({
  doc: d,
  onDecided,
}: {
  doc: OpsMobilityDocument;
  onDecided: () => void;
}) {
  const t = useTranslations("mobility.review");
  const f = useFormat();
  const decided = d.status !== "pending";
  const [editing, setEditing] = React.useState(!decided);
  const date = (ad: string | null, bs: string | null) => (ad ? f.date(ad, bs).bs : "—");
  return (
    <Card>
      <div className="border-border border-b px-5 py-4">
        <p className="text-fg-muted text-xs font-medium">{d.kind_group_label}</p>
        <h2 className="text-fg text-lg font-semibold">{d.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <DocStatusBadge doc={d} />
          <ExpiryText days={d.days_to_expiry} />
        </div>
      </div>
      <CardBody className="space-y-6 pt-5">
        {d.duplicate_number ? (
          <div className="border-danger/30 bg-danger-subtle text-danger flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("duplicate_warning")}</span>
          </div>
        ) : null}
        <div className="grid gap-6 md:grid-cols-2">
          <DocumentViewer doc={d} />
          <div className="space-y-4">
            <div className="border-border rounded-dense border p-3">
              <p className="text-fg-muted text-xs font-medium">{t("worker")}</p>
              <p className="text-fg mt-0.5 font-medium">{d.worker.full_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <VerificationBadge status={d.worker.verification_status as VerificationStatus} />
                <span className="tabular text-fg-muted text-xs">{f.phone(d.worker.phone)}</span>
              </div>
              <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0">
                <Link href={`/ops/workers/${d.worker.id}`}>
                  <PencilLine aria-hidden />
                  {t("view_worker")}
                </Link>
              </Button>
            </div>
            {d.worker.verification_status !== "verified" ? (
              <div className="border-warning/30 bg-warning-subtle text-warning flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("identity_unverified")}</span>
              </div>
            ) : null}
            <DescriptionList
              columns={2}
              items={[
                {
                  label: t("number"),
                  value: d.number ? <span className="tabular">{d.number}</span> : "—",
                },
                d.kind_group === "travel"
                  ? { label: t("country"), value: d.issuing_country || "—" }
                  : { label: t("issuer"), value: d.issuer || "—" },
                ...(d.score_or_level ? [{ label: t("score"), value: d.score_or_level }] : []),
                { label: t("issued_on"), value: date(d.issued_on, d.issued_on_bs) },
                {
                  label: t("expires_on"),
                  value: d.expires_on ? date(d.expires_on, d.expires_on_bs) : t("no_expiry"),
                },
              ]}
            />
          </div>
        </div>
        {decided && !editing ? (
          <div className="border-border bg-surface-muted/50 space-y-3 rounded-dense border p-4">
            <p className="text-fg text-sm font-semibold">{t("decision")}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <DocStatusBadge doc={d} />
              {d.verified_by ? (
                <span className="text-fg-muted">
                  {t("decided_by", { name: d.verified_by.full_name })}
                </span>
              ) : null}
              {d.verified_at ? (
                <span className="text-fg-muted">· {f.dateTime(d.verified_at)}</span>
              ) : null}
            </div>
            {d.note ? <p className="text-fg-body text-sm">{d.note}</p> : null}
            {d.status !== "expired" ? (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                {t("change_decision")}
              </Button>
            ) : null}
          </div>
        ) : (
          <DecisionForm doc={d} onDone={onDecided} />
        )}
      </CardBody>
    </Card>
  );
}

function DecisionForm({ doc: d, onDone }: { doc: OpsMobilityDocument; onDone: () => void }) {
  const t = useTranslations("mobility.review");
  const tRoot = useTranslations();
  const verify = useVerifyMobilityDocument();
  const [note, setNote] = React.useState(d.note ?? "");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"verified" | "rejected" | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const noteId = `mob-note-${d.id}`;

  const decide = (status: "verified" | "rejected") => {
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
      { id: d.id, status, note: trimmed || undefined },
      {
        onSuccess: () => {
          toast.success(
            status === "verified"
              ? t("verified_toast", { title: d.title })
              : t("rejected_toast", { title: d.title }),
          );
          onDone();
        },
        onError: (e) => toastError(e, tRoot),
        onSettled: () => setPending(null),
      },
    );
  };

  return (
    <div className="border-border bg-surface-muted/50 space-y-4 rounded-dense border p-4">
      <div>
        <p className="text-fg text-sm font-semibold">{t("checklist_title")}</p>
        <ul className="text-fg-body mt-1.5 list-disc space-y-0.5 pl-5 text-sm">
          <li>{t("checklist_1")}</li>
          <li>{t("checklist_2")}</li>
          <li>{t("checklist_3")}</li>
        </ul>
      </div>
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
    </div>
  );
}
