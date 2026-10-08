"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, History, UserCheck, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { useMe } from "@/lib/api/hooks/auth";
import { useMatchRun, useMatchRuns, useSetOpsJobOwner } from "@/lib/api/hooks/pipeline";
import type { MatchRequirementCheck, MatchRun, UserRef } from "@/lib/api/types-pipeline";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** Requirement checks for a match row: met ✓ / unmet ✗ (required rows emphasised). */
export function RequirementChecks({
  checks,
  className,
}: {
  checks: MatchRequirementCheck[] | undefined;
  className?: string;
}) {
  const t = useTranslations("pipeline.ops");
  if (!checks?.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={t("requirement_checks")}>
      {checks.map((c) => (
        <li key={c.id}>
          <Badge
            tone={c.met ? "success" : c.required ? "danger" : "outline"}
            title={c.required ? t("req_required") : t("req_preferred")}
          >
            {c.met ? <Check aria-hidden /> : <X aria-hidden />}
            <span className="sr-only">{c.met ? t("req_met") : t("req_unmet")}: </span>
            {c.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** "Recruiter" — the KaamSathi staff owner of a job (L009). */
export function OpsOwnerCard({
  jobId,
  owner,
}: {
  jobId: string;
  owner: UserRef | null | undefined;
}) {
  const t = useTranslations();
  const to = useTranslations("pipeline.ops");
  const me = useMe();
  const setOwner = useSetOpsJobOwner();
  const mine = !!owner && owner.id === me.data?.id;

  const assign = (userId: string | null) =>
    setOwner.mutate(
      { jobId, user_id: userId },
      {
        onSuccess: () => toast.success(to("owner_saved")),
        onError: (e) => toastError(e, t),
      },
    );

  return (
    <Card>
      <CardHeader title={to("owner_title")} description={to("owner_hint")} />
      <CardBody className="space-y-3">
        <p className="text-fg text-sm font-medium">
          {owner ? (
            mine ? (
              to("owner_me", { name: owner.full_name })
            ) : (
              owner.full_name
            )
          ) : (
            <span className="text-fg-muted font-normal">{to("owner_none")}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {!mine ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => me.data && assign(me.data.id)}
              disabled={!me.data}
              loading={setOwner.isPending && setOwner.variables?.user_id !== null}
            >
              <UserCheck aria-hidden />
              {to("assign_me")}
            </Button>
          ) : null}
          {owner ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => assign(null)}
              loading={setOwner.isPending && setOwner.variables?.user_id === null}
            >
              <UserX aria-hidden />
              {to("owner_clear")}
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

const RUNS_PAGE = 10;

/** Match run history (K010/K012) with expandable top-candidate detail. */
export function MatchRunsPanel({ jobId }: { jobId: string }) {
  const to = useTranslations("pipeline.ops");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const runs = useMatchRuns(jobId, { page, page_size: RUNS_PAGE });
  const rows = runs.data?.results ?? [];

  return (
    <Card className="min-w-0">
      <CardHeader title={to("runs_title")} description={to("runs_hint")} />
      <CardBody>
        {runs.isLoading ? (
          <div className="space-y-2" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : runs.isError ? (
          <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon={History} title={to("runs_empty")} />
        ) : (
          <>
            <ul className="divide-border border-border divide-y rounded-lg border">
              {rows.map((r) => (
                <RunRow
                  key={r.id}
                  jobId={jobId}
                  run={r}
                  open={openId === r.id}
                  onToggle={() => setOpenId((x) => (x === r.id ? null : r.id))}
                />
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={RUNS_PAGE}
              count={runs.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </CardBody>
    </Card>
  );
}

function RunRow({
  jobId,
  run,
  open,
  onToggle,
}: {
  jobId: string;
  run: MatchRun;
  open: boolean;
  onToggle: () => void;
}) {
  const to = useTranslations("pipeline.ops");
  const f = useFormat();
  const panelId = `run-${run.id}`;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="hover:bg-surface-hover focus-visible:outline-ring flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm focus-visible:outline-2"
      >
        <Badge tone="brand">{run.algorithm_version}</Badge>
        {run.config?.revision !== undefined ? (
          <span className="text-fg-muted tabular text-xs">
            {to("run_revision", { rev: f.digits(run.config.revision) })}
          </span>
        ) : null}
        <span className="text-fg-body tabular">
          {to("run_candidates", { count: run.candidates_count })}
        </span>
        <span className="text-fg-muted text-xs">
          {run.created_by ? run.created_by.full_name : to("run_system")}
        </span>
        <span className="text-fg-muted tabular ml-auto text-xs">{f.dateTime(run.created_at)}</span>
        <ChevronDown
          className={cn("text-fg-muted size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
        <span className="sr-only">{open ? to("run_hide") : to("run_show")}</span>
      </button>
      {open ? (
        <div id={panelId} className="border-border bg-surface-muted/40 border-t px-3 py-3">
          <RunDetail jobId={jobId} runId={run.id} />
        </div>
      ) : null}
    </li>
  );
}

function RunDetail({ jobId, runId }: { jobId: string; runId: string }) {
  const to = useTranslations("pipeline.ops");
  const f = useFormat();
  const q = useMatchRun(jobId, runId);
  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const cands = q.data.candidates.slice(0, 10);
  if (!cands.length) return <p className="text-fg-muted text-sm">{to("run_no_candidates")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{to("run_top")}</caption>
        <thead>
          <tr className="text-fg-muted text-left text-xs">
            <th scope="col" className="py-1 pr-3 font-medium">
              {to("col_rank")}
            </th>
            <th scope="col" className="py-1 pr-3 font-medium">
              {to("col_worker")}
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              {to("col_score")}
            </th>
            <th scope="col" className="py-1 font-medium">
              {to("col_requirements")}
            </th>
          </tr>
        </thead>
        <tbody>
          {cands.map((c) => (
            <tr key={c.worker.id} className="border-border border-t align-top">
              <td className="tabular py-1.5 pr-3">#{f.digits(c.rank)}</td>
              <td className="py-1.5 pr-3">
                <Link href={`/ops/workers/${c.worker.id}`} className="text-brand hover:underline">
                  {c.worker.full_name}
                </Link>
              </td>
              <td className="tabular py-1.5 pr-3 text-right font-semibold">{f.digits(c.score)}</td>
              <td className="py-1.5">
                {c.requirements?.length ? (
                  <RequirementChecks checks={c.requirements} />
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
