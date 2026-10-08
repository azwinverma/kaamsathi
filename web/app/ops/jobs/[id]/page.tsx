"use client";
import { MatchReasonCard } from "@/components/ledger";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Info, ListChecks, RefreshCw, Send, UserSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { DateText, Money } from "@/components/ui/date";
import { RatingStars, SkillChips, WorkerIdentity } from "@/components/shared/worker-summary";
import { HoursOpenBadge, ScoreMeter } from "@/components/ops/ops-ui";
import { InterestedBadge, MatchExplain, useMatchReasonLabel } from "@/components/experience/match-explain";
import { SHORTLIST_SLA_HOURS, useReasonLabel } from "@/components/ops/helpers";
import { useJobMatches, useOpsJob, useShortlist } from "@/lib/api/hooks/ops";
import type { Stage } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { VerifiedEmployerBadge } from "@/components/kyb/kyb-badges";
import { JobStatusBadge } from "@/components/hiring/job-bits";
import { RequirementChips } from "@/components/hiring/requirements";
import {
  MatchRunsPanel,
  OpsOwnerCard,
  RequirementChecks,
} from "@/components/hiring/ops-job-panels";
import { useRefreshMatches } from "@/lib/api/hooks/pipeline";
import type { MatchWithPipeline, OpsJobWithPipeline } from "@/lib/api/types-pipeline";

const STAGES: Stage[] = ["sourced", "shortlisted", "interview", "selected", "joined", "rejected", "dropped"];
const TARGET_MIN = 5;
const TARGET_MAX = 10;

export default function OpsJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const tj = useTranslations("ops.job");
  const tn = useTranslations("nav");
  const tp = useTranslations("pipeline");
  const f = useFormat();
  const job = useOpsJob(id);
  const back = { href: "/ops/jobs", label: tn("ops_jobs") };
  const j = job.data as OpsJobWithPipeline | undefined;

  if (job.isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-64" />} back={back} />
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Skeleton className="h-80 rounded-dense" />
          <Skeleton className="h-[480px] rounded-dense" />
        </div>
      </>
    );
  }
  if (job.isError || !j) {
    return (
      <>
        <PageHeader title={tj("title_fallback")} back={back} />
        <ErrorState error={job.error} onRetry={() => job.refetch()} />
      </>
    );
  }

  const over = (j.hours_open ?? 0) > SHORTLIST_SLA_HOURS;
  const perks = [j.food_provided && tj("food"), j.accommodation_provided && tj("accommodation")].filter(Boolean);

  return (
    <>
      <PageHeader
        back={back}
        title={j.title}
        description={
          <span className="inline-flex items-center gap-1">
            <Link href={`/ops/organizations/${j.organization.id}`} className="inline-flex items-center gap-1 hover:underline">
              <Building2 className="size-4" aria-hidden />
              {j.organization.name}
            </Link>
            <VerifiedEmployerBadge
              compact
              status={(j as { employer_verified?: boolean }).employer_verified ? "verified" : null}
            />
          </span>
        }
        meta={
          <>
            <JobStatusBadge job={j} />
            {j.ops_owner ? (
              <Badge tone="outline">{tp("ops.owner_badge", { name: j.ops_owner.full_name })}</Badge>
            ) : null}
            {j.invited_count ? (
              <Badge tone="accent">{tp("ops.invited_count", { count: j.invited_count })}</Badge>
            ) : null}
            <HoursOpenBadge hours={j.hours_open} />
            {j.first_shortlist_at ? (
              <Badge tone="success">{tj("first_shortlist", { date: f.dateTime(j.first_shortlist_at) })}</Badge>
            ) : over ? (
              <Badge tone="danger">{tj("sla_missed", { hours: f.digits(SHORTLIST_SLA_HOURS) })}</Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader title={tj("details")} />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: t("term.trade"), value: f.name(j.trade) },
                  { label: t("term.site"), value: j.site?.name ?? "—" },
                  { label: tj("openings"), value: f.number(j.openings_count) },
                  {
                    label: tj("wage"),
                    value: (
                      <>
                        <Money value={j.wage_amount} />{" "}
                        <span className="text-fg-muted">
                          {j.wage_type === "daily" ? t("common.per_day") : t("common.per_month")}
                        </span>
                      </>
                    ),
                  },
                  { label: t("term.start_date"), value: <DateText ad={j.start_date} bs={j.start_date_bs} /> },
                  { label: tj("min_experience"), value: t("term.years", { count: j.min_experience_years ?? 0 }) },
                  { label: tj("perks"), value: perks.length ? perks.join(", ") : "—" },
                  {
                    label: tj("published"),
                    value: j.published_at ? f.dateTime(j.published_at) : "—",
                  },
                ]}
              />
              {j.requirements?.length ? (
                <div className="border-border mt-4 space-y-2 border-t pt-4">
                  <p className="text-fg-muted text-sm">{tp("requirements.detail_title")}</p>
                  <RequirementChips requirements={j.requirements} />
                </div>
              ) : null}
              {j.description ? (
                <p className="mt-4 border-t border-border pt-4 text-sm whitespace-pre-line text-fg-body">
                  {j.description}
                </p>
              ) : null}
            </CardBody>
          </Card>
          <OpsOwnerCard jobId={j.id} owner={j.ops_owner} />
          <Card>
            <CardHeader title={tj("pipeline")} />
            <CardBody>
              <ul className="grid grid-cols-2 gap-2">
                {STAGES.map((s) => (
                  <li
                    key={s}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="text-fg-muted">{t(`stage.${s}`)}</span>
                    <span className="font-semibold text-fg tabular">{f.number(j.counts?.[s] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <MatchesPanel jobId={j.id} jobOpen={j.status === "open"} />
          <MatchRunsPanel jobId={j.id} />
        </div>
      </div>
    </>
  );
}

function MatchesPanel({ jobId, jobOpen }: { jobId: string; jobOpen: boolean }) {
  const t = useTranslations();
  const tj = useTranslations("ops.job");
  const f = useFormat();
  const reason = useMatchReasonLabel(useReasonLabel());
  const [limit, setLimit] = React.useState(20);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = React.useState(false);
  const tp = useTranslations("pipeline.ops");
  const matches = useJobMatches(jobId, limit);
  const refresh = useRefreshMatches();
  const shortlist = useShortlist();
  const rows = React.useMemo(() => (matches.data ?? []) as MatchWithPipeline[], [matches.data]);
  const version = rows[0]?.algorithm_version;

  // Drop selections for workers no longer in the match list (e.g. after shortlisting).
  React.useEffect(() => {
    setSelected((s) => {
      const ids = new Set(rows.map((m) => m.worker.id));
      const next = new Set([...s].filter((x) => ids.has(x)));
      return next.size === s.size ? s : next;
    });
  }, [rows]);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allChecked = rows.length > 0 && rows.every((m) => selected.has(m.worker.id));
  const someChecked = selected.size > 0 && !allChecked;
  const count = selected.size;
  const inTarget = count >= TARGET_MIN && count <= TARGET_MAX;

  const submit = () => {
    shortlist.mutate(
      { jobId, worker_ids: [...selected] },
      {
        onSuccess: (r) => {
          toast.success(tj("shortlisted_toast", { count: r?.created ?? count }));
          setSelected(new Set());
          setConfirm(false);
        },
        onError: (e) => toastError(e, t),
      },
    );
  };

  const selectedMatches = rows.filter((m) => selected.has(m.worker.id));

  return (
    <Card className="min-w-0">
      <CardHeader
        title={tj("matches")}
        description={tj("matches_hint", { min: f.digits(TARGET_MIN), max: f.digits(TARGET_MAX) })}
        action={
          <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              refresh.mutate(
                { jobId, limit },
                {
                  onSuccess: () => toast.success(tp("refreshed_toast")),
                  onError: (e) => toastError(e, t),
                },
              )
            }
            loading={refresh.isPending}
            disabled={matches.isLoading}
          >
            {refresh.isPending ? null : <RefreshCw aria-hidden />}
            {tp("refresh")}
          </Button>
          <div className="w-28">
            <NativeSelect
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label={tj("show_top")}
              options={[20, 50, 100].map((n) => ({ value: String(n), label: tj("top_n", { n: f.digits(n) }) }))}
            />
          </div>
          </div>
        }
      />

      {!jobOpen ? (
        <div className="mx-5 mb-4 flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {tj("not_open_note")}
        </div>
      ) : null}

      {matches.isLoading ? (
        <div className="space-y-3 px-5 pb-5" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-dense" />
          ))}
        </div>
      ) : matches.isError ? (
        <ErrorState error={matches.error} onRetry={() => matches.refetch()} className="mx-5 mb-5" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={tj("no_matches_title")}
          description={tj("no_matches_body")}
          className="mx-5 mb-5"
          action={
            <Button asChild variant="secondary">
              <Link href="/ops/workers/new">{tj("add_worker")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-y border-border bg-surface-muted px-5 py-2.5">
            <label className="flex items-center gap-2 text-sm font-medium text-fg">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) =>
                  setSelected(v === true ? new Set(rows.map((m) => m.worker.id)) : new Set())
                }
                aria-label={tj("select_all")}
              />
              {tj("select_all")}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set(rows.slice(0, TARGET_MIN).map((m) => m.worker.id)))}
            >
              <ListChecks aria-hidden />
              {tj("select_top", { n: f.digits(TARGET_MIN) })}
            </Button>
            <span className="ml-auto text-xs text-fg-muted">
              {tj("showing_matches", { count: rows.length })}
              {version ? ` · ${tp("algorithm", { version })}` : null}
            </span>
          </div>
          <ul className={cn("py-2", matches.isFetching && "opacity-70")}>
            {rows.map((m, i) => (
              <MatchRow
                key={m.worker.id}
                match={m}
                rank={m.rank ?? i + 1}
                checked={selected.has(m.worker.id)}
                onCheckedChange={(on) => toggle(m.worker.id, on)}
                reason={reason}
              />
            ))}
          </ul>
        </>
      )}

      {count > 0 ? (
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-b-dense border-t border-border bg-surface/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="font-semibold text-fg">{t("common.selected_count", { count: f.digits(count) })}</span>
            <span className={cn("ml-2 text-xs", inTarget ? "text-success" : "text-warning")}>
              {inTarget
                ? tj("target_ok")
                : count < TARGET_MIN
                  ? tj("target_low", { min: f.digits(TARGET_MIN) })
                  : tj("target_high", { max: f.digits(TARGET_MAX) })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              {tj("clear_selection")}
            </Button>
            <Button onClick={() => setConfirm(true)} disabled={!jobOpen}>
              <Send aria-hidden />
              {tj("shortlist_n", { count })}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={tj("confirm_title", { count })}
        description={tj("confirm_body")}
        confirmLabel={tj("confirm_send")}
        loading={shortlist.isPending}
        onConfirm={submit}
      >
        <ul className="space-y-1.5 text-sm">
          {selectedMatches.map((m) => (
            <li key={m.worker.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-fg">{m.worker.full_name}</span>
              <span className="text-xs text-fg-muted tabular">
                {tj("score_short", { score: f.digits(m.score) })}
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </Card>
  );
}

function MatchRow({
  match: m,
  rank,
  checked,
  onCheckedChange,
  reason,
}: {
  match: MatchWithPipeline;
  rank: number;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  reason: (r: string) => string;
}) {
  const t = useTranslations();
  const f = useFormat();
  const id = `match-${m.worker.id}`;
  const negative = (r: string) => /higher wage|above offer/i.test(r);
  return (
    <li className="px-5 py-2">
      <MatchReasonCard
        selected={checked}
        reasons={m.reasons.map((r) => ({ label: reason(r), tone: negative(r) ? "negative" : "positive" }))}
        identity={
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(v) => onCheckedChange(v === true)}
                aria-label={m.worker.full_name}
              />
              <span className="text-xs text-fg-muted tabular">#{f.digits(rank)}</span>
            </div>
            <label htmlFor={id} className="min-w-0 cursor-pointer">
              <WorkerIdentity worker={m.worker} size="sm" />
            </label>
          </div>
        }
        aside={
          <span className="flex items-center gap-2">
            <InterestedBadge match={m} />
            <MatchExplain match={m}>
              <ScoreMeter score={m.score} />
            </MatchExplain>
          </span>
        }
        footer={
          <span className="flex items-center gap-3 text-xs text-fg-muted">
            <RatingStars value={m.worker.rating_avg} />
            {m.worker.placements_count ? (
              <span>
                {t("term.placements")}: {f.digits(m.worker.placements_count)}
              </span>
            ) : null}
            <Link href={`/ops/workers/${m.worker.id}`} className="ml-auto text-brand-text hover:underline">
              {t("common.view")}
            </Link>
          </span>
        }
      >
        <SkillChips skills={m.worker.skills} max={3} />
        <RequirementChecks checks={m.requirements} />
      </MatchReasonCard>
    </li>
  );
}
