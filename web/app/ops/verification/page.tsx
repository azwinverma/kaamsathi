"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, ListChecks, PencilLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/shared/status-badge";
import { tradeOf } from "@/components/shared/worker-summary";
import { DocImage, InfoRow } from "@/components/ops/ops-ui";
import { VerifyActions } from "@/components/ops/verify-actions";
import { hoursSince, useDistrictLabel } from "@/components/ops/helpers";
import { useOpsWorker, useOpsWorkers } from "@/lib/api/hooks/ops";
import type { OpsWorker } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

type QueueFilter = "pending" | "unverified";

export default function VerificationPage() {
  return (
    <React.Suspense fallback={<QueueSkeleton />}>
      <VerificationQueue />
    </React.Suspense>
  );
}

function VerificationQueue() {
  const t = useTranslations("ops.verification");
  const f = useFormat();
  const params = useSearchParams();
  const [filter, setFilter] = React.useState<QueueFilter>("pending");
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("worker"));
  const [done, setDone] = React.useState<Set<string>>(() => new Set());
  const [reviewed, setReviewed] = React.useState(0);
  const [mobileDetail, setMobileDetail] = React.useState(!!params.get("worker"));

  const query = useOpsWorkers({ verification_status: filter, page_size: 50, ordering: "created_at" });
  const rows = React.useMemo(
    () => (query.data?.results ?? []).filter((w) => !done.has(w.id)),
    [query.data, done],
  );
  const doneInPage = (query.data?.results ?? []).filter((w) => done.has(w.id)).length;
  const remaining = Math.max(0, (query.data?.count ?? 0) - doneInPage);

  // Fall back to the first item when nothing (or a finished item) is selected.
  React.useEffect(() => {
    if (query.isLoading) return;
    if (!selectedId || (done.has(selectedId) && rows.length)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId, done, query.isLoading]);

  // Selected worker may not be in this page of the queue (deep link) — fetch it on its own.
  const inList = rows.find((w) => w.id === selectedId) ?? null;
  const single = useOpsWorker(!inList && selectedId && !done.has(selectedId) ? selectedId : null);
  const current: OpsWorker | null = inList ?? single.data ?? null;
  const index = current ? rows.findIndex((w) => w.id === current.id) : -1;

  const go = React.useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const i = index < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, index + delta));
      setSelectedId(rows[i].id);
    },
    [index, rows],
  );

  const onDecided = React.useCallback(() => {
    if (!current) return;
    const next = rows[index + 1] ?? rows[index - 1] ?? null;
    setDone((s) => new Set(s).add(current.id));
    setReviewed((n) => n + 1);
    setSelectedId(next && next.id !== current.id ? next.id : null);
    if (!next) setMobileDetail(false);
  }, [current, index, rows]);

  // Alt+J / Alt+K to move through the queue.
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

  const changeFilter = (v: QueueFilter) => {
    setFilter(v);
    setSelectedId(null);
    setDone(new Set());
    setMobileDetail(false);
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        meta={
          <>
            <Badge tone={remaining ? "warning" : "success"}>{t("remaining", { count: remaining })}</Badge>
            {reviewed ? <Badge tone="brand">{t("reviewed_session", { count: reviewed })}</Badge> : null}
          </>
        }
        actions={
          <Segmented
            label={t("filter_label")}
            value={filter}
            onChange={changeFilter}
            options={[
              { value: "pending", label: t("filter_pending") },
              { value: "unverified", label: t("filter_unverified") },
            ]}
          />
        }
      />

      {query.isLoading ? (
        <QueueSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 && !current ? (
        <EmptyState
          icon={BadgeCheck}
          title={reviewed ? t("done_title") : t("empty_title")}
          description={reviewed ? t("done_body", { count: reviewed }) : t("empty_body")}
          action={
            <Button asChild variant="secondary">
              <Link href="/ops">{t("back_to_overview")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          {/* Queue list */}
          <Card className={cn("overflow-hidden lg:sticky lg:top-24", mobileDetail && "max-lg:hidden")}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-fg">{t("queue")}</p>
              <span className="text-xs text-fg-muted">{t("oldest_first")}</span>
            </div>
            <ul className="scrollbar-thin max-h-[calc(100dvh-260px)] overflow-y-auto" aria-label={t("queue")}>
              {rows.map((w) => {
                const active = w.id === current?.id;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(w.id);
                        setMobileDetail(true);
                      }}
                      aria-current={active || undefined}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-hover max-lg:min-h-14",
                        active && "bg-brand-subtle hover:bg-brand-subtle",
                      )}
                    >
                      <Avatar name={w.full_name} src={w.photo} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{w.full_name}</span>
                        <span className="block truncate text-xs text-fg-muted">
                          {w.skills?.[0] ? f.name(tradeOf(w.skills[0])) : "—"} ·{" "}
                          {t("waiting_for", { time: f.hours(hoursSince(w.updated_at ?? w.created_at)) })}
                        </span>
                      </span>
                      {!w.id_front || !w.photo ? (
                        <AlertTriangle className="size-4 shrink-0 text-warning" aria-label={t("missing_docs")} />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {(query.data?.count ?? 0) > (query.data?.results.length ?? 0) ? (
              <p className="border-t border-border px-4 py-2 text-xs text-fg-muted">{t("more_after")}</p>
            ) : null}
          </Card>

          {/* Review panel */}
          <div className={cn(!mobileDetail && "max-lg:hidden")}>
            <Button variant="ghost" size="sm" className="mb-3 lg:hidden" onClick={() => setMobileDetail(false)}>
              <ChevronLeft aria-hidden />
              {t("back_to_queue", { count: rows.length })}
            </Button>
            {current ? (
              <ReviewPanel
                worker={current}
                position={index >= 0 ? index + 1 : null}
                total={rows.length}
                onPrev={() => go(-1)}
                onNext={() => go(1)}
                onDecided={onDecided}
              />
            ) : single.isLoading ? (
              <Skeleton className="h-[480px] rounded-lg" />
            ) : single.isError ? (
              <ErrorState error={single.error} onRetry={() => single.refetch()} />
            ) : (
              <EmptyState icon={ListChecks} title={t("select_prompt")} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReviewPanel({
  worker: w,
  position,
  total,
  onPrev,
  onNext,
  onDecided,
}: {
  worker: OpsWorker;
  position: number | null;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onDecided: () => void;
}) {
  const t = useTranslations();
  const tv = useTranslations("ops.verification");
  const f = useFormat();
  const district = useDistrictLabel();
  const age = ageFrom(w.date_of_birth);
  const missing = !w.id_front || !w.id_back || !w.photo;
  const noIdNumber = !w.citizenship_no && !w.nid_no;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={w.full_name} src={w.photo} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-fg">{w.full_name}</h2>
            {w.full_name_ne ? (
              <p className="text-sm text-fg-muted" lang="ne">
                {w.full_name_ne}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <VerificationBadge status={w.verification_status} />
              <span className="text-xs text-fg-muted tabular">{f.phone(w.phone)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {position ? (
            <span className="mr-1 text-xs text-fg-muted tabular">
              {tv("position", { n: f.digits(position), total: f.digits(total) })}
            </span>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label={tv("prev")} title={tv("prev")}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label={tv("skip")} title={tv("skip")}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <CardBody className="space-y-6 pt-5">
        {missing || noIdNumber ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{missing ? tv("missing_docs_body") : tv("missing_id_number")}</span>
          </div>
        ) : null}

        <section aria-label={tv("documents")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_0.75fr]">
            <DocImage src={w.id_front} label={t("ops.docs.id_front")} />
            <DocImage src={w.id_back} label={t("ops.docs.id_back")} />
            <DocImage src={w.photo} label={t("ops.docs.photo")} tall className="max-sm:col-span-2 max-sm:mx-auto max-sm:w-1/2" />
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h3 className="mb-1 text-sm font-semibold text-fg">{tv("id_numbers")}</h3>
            <dl>
              <InfoRow label={t("term.citizenship")} value={w.citizenship_no} mono />
              <InfoRow label={t("term.nid")} value={w.nid_no} mono />
              <InfoRow
                label={t("term.date_of_birth")}
                value={
                  w.date_of_birth ? (
                    <>
                      {f.date(w.date_of_birth, w.date_of_birth_bs).bs}
                      {age !== null ? (
                        <span className="ml-1 text-fg-muted">({tv("age", { years: f.digits(age) })})</span>
                      ) : null}
                    </>
                  ) : null
                }
              />
              <InfoRow label={t("term.gender")} value={t(`term.${w.gender}`)} />
            </dl>
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold text-fg">{tv("location")}</h3>
            <dl>
              <InfoRow label={t("ops.worker_form.current_district")} value={district(w.current_district)} />
              <InfoRow label={t("ops.worker_form.permanent_district")} value={district(w.permanent_district)} />
              <InfoRow label={t("term.address")} value={w.address} />
            </dl>
          </section>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-fg">{tv("skills")}</h3>
          {w.skills?.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {w.skills.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-fg">{f.name(tradeOf(s))}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <span>{t("term.years", { count: s.years_experience ?? 0 })}</span>
                    {s.nstb_level && s.nstb_level !== "none" ? (
                      <Badge tone="brand">NSTB {t(`nstb.${s.nstb_level}`)}</Badge>
                    ) : null}
                    {s.certificate_no ? (
                      <span className="tabular">
                        {tv("certificate")}: {s.certificate_no}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">{tv("no_skills")}</p>
          )}
        </section>

        {w.notes || w.verification_note ? (
          <section className="space-y-2">
            {w.notes ? (
              <p className="text-sm">
                <span className="font-medium text-fg">{t("common.notes")}: </span>
                <span className="text-fg-body">{w.notes}</span>
              </p>
            ) : null}
            {w.verification_note ? (
              <p className="text-sm">
                <span className="font-medium text-fg">{tv("previous_note")}: </span>
                <span className="text-fg-body">{w.verification_note}</span>
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="rounded-lg border border-border bg-surface-muted/50 p-4">
          <VerifyActions worker={w} onDone={onDecided} shortcuts />
        </div>

        <div className="flex justify-end">
          <Button asChild variant="link" size="sm">
            <Link href={`/ops/workers/${w.id}`}>
              <PencilLine aria-hidden />
              {tv("edit_profile")}
            </Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 120 ? age : null;
}

function QueueSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]" aria-busy>
      <Skeleton className="h-[420px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg max-lg:hidden" />
    </div>
  );
}
