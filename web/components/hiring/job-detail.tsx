"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  ChevronDown,
  MoreHorizontal,
  PauseCircle,
  Send,
  UserSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateText } from "@/components/ui/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SkillChips, WorkerIdentity } from "@/components/shared/worker-summary";
import { MatchReasonCard } from "@/components/ledger";
import { useCandidateReasons } from "./match-reasons";
import { isApiError } from "@/lib/api/errors";
import { useApplications, useJob } from "@/lib/api/hooks/hiring";
import type { Application, Job, Stage } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ApplicationDrawer } from "./application-drawer";
import { HiringGate } from "./gate";
import { JobActions } from "./job-actions";
import { FillProgress, JobBenefits, JobStatusBadge, JobWage } from "./job-bits";
import { RequirementChips } from "./requirements";
import { InviteWorkerButton } from "./invite-dialog";
import { TagsAndAssignee } from "./application-pipeline";
import { CLOSED_STAGES, PIPELINE_STAGES, TRANSITIONS, daysSince, type PipelineStage } from "./lib";
import { ApplicationGrowthBadges } from "@/components/experience/badges";
import { OfferControls } from "@/components/experience/offer-dialog";
import type { ApplicationOfferField, ApplicationWithGrowth } from "@/lib/api/types-experience";
import { useStageMove } from "./move-stage";

export function JobDetailPage({ id }: { id: string }) {
  return (
    <HiringGate>
      <JobDetailInner id={id} />
    </HiringGate>
  );
}

function JobDetailInner({ id }: { id: string }) {
  const t = useTranslations();
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const { data: job, isLoading, error, refetch } = useJob(id);
  const back = { href: "/app/jobs", label: t("nav.jobs") };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (error || !job) {
    const notFound = isApiError(error) && error.status === 404;
    return (
      <>
        <PageHeader title={td("not_found")} back={back} />
        <ErrorState error={error} onRetry={notFound ? undefined : () => void refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        back={back}
        title={job.title}
        meta={
          <>
            <JobStatusBadge job={job} />
            <span className="text-fg-muted text-sm">
              {[f.name(job.trade), job.site?.name].filter(Boolean).join(" · ")}
            </span>
          </>
        }
        actions={<JobActions job={job} primary redirectOnDelete="/app/jobs" />}
      />
      {job.status === "paused" ? (
        <div
          role="status"
          className="border-warning/30 bg-warning-subtle text-fg-body rounded-dense mb-4 flex items-start gap-2 border p-3 text-sm"
        >
          <PauseCircle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("pipeline.actions.paused_banner")}
            {job.paused_at ? (
              <span className="text-fg-muted">
                {" "}
                · {t("pipeline.actions.paused_since", { date: f.dateTime(job.paused_at) })}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      <JobSummary job={job} />
      <Pipeline job={job} />
    </>
  );
}

/**
 * Job facts as a ledger band above the pipeline (not a side card), so the five stage columns get
 * the full content width. Requirements and the description fold into a disclosure.
 */
function JobSummary({ job }: { job: Job }) {
  const t = useTranslations();
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const shift = job.shift && typeof job.shift === "object" ? job.shift.name : null;
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: td("wage"), value: <JobWage job={job} /> },
    { label: td("openings"), value: f.digits(job.openings_count) },
    { label: t("term.start_date"), value: <DateText ad={job.start_date} bs={job.start_date_bs} /> },
    {
      label: td("min_experience"),
      value: job.min_experience_years
        ? t("term.years", { count: job.min_experience_years })
        : t("common.none"),
    },
    ...(shift ? [{ label: t("term.shift"), value: shift }] : []),
    {
      label: td("benefits"),
      value:
        job.food_provided || job.accommodation_provided ? (
          <JobBenefits job={job} />
        ) : (
          t("common.none")
        ),
    },
    ...(job.published_at
      ? [{ label: td("published_on"), value: f.dateTime(job.published_at) }]
      : []),
    ...(job.first_shortlist_at
      ? [{ label: td("first_shortlist"), value: f.dateTime(job.first_shortlist_at) }]
      : []),
  ];
  const hasMore = !!job.requirements?.length || !!job.description;
  return (
    <section aria-labelledby="job-facts-heading" className="border-border mb-8 border-y py-5">
      <h2 id="job-facts-heading" className="sr-only">
        {td("overview")}
      </h2>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div className="lg:w-48 lg:shrink-0">
          <FillProgress job={job} />
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 xl:grid-cols-4">
          {facts.map((it) => (
            <div key={it.label} className="min-w-0">
              <dt className="text-fg-muted text-xs">{it.label}</dt>
              <dd className="text-fg mt-1 text-sm break-words">{it.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {hasMore ? (
        <details className="group mt-4">
          <summary className="text-brand-text focus-visible:outline-ring inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden
            />
            {td("more_details")}
          </summary>
          <div className="mt-3 grid max-w-4xl gap-4 lg:grid-cols-2">
            {job.requirements?.length ? (
              <div>
                <p className="text-fg-muted text-xs">{t("pipeline.requirements.detail_title")}</p>
                <div className="mt-1">
                  <RequirementChips requirements={job.requirements} />
                </div>
              </div>
            ) : null}
            {job.description ? (
              <div>
                <p className="text-fg-muted text-xs">{t("common.description")}</p>
                <p className="text-fg-body mt-1 text-sm whitespace-pre-line">{job.description}</p>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}

type Layout = "wide" | "tablet" | "phone";

const WIDE = "(min-width: 1280px)";
const TABLET = "(min-width: 768px)";

/** ≥1280: all five columns · 768–1279: three columns + stage chips · <768: one stage, tab list. */
function usePipelineLayout(): Layout {
  return React.useSyncExternalStore(
    (cb) => {
      const a = window.matchMedia(WIDE);
      const b = window.matchMedia(TABLET);
      a.addEventListener("change", cb);
      b.addEventListener("change", cb);
      return () => {
        a.removeEventListener("change", cb);
        b.removeEventListener("change", cb);
      };
    },
    () =>
      window.matchMedia(WIDE).matches
        ? "wide"
        : window.matchMedia(TABLET).matches
          ? "tablet"
          : "phone",
    () => "wide",
  );
}

function Pipeline({ job }: { job: Job }) {
  const t = useTranslations();
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const { data, isLoading, error, refetch } = useApplications({
    job: job.id,
    page_size: 100,
    ordering: "-stage_changed_at",
  });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showClosed, setShowClosed] = React.useState(false);
  const [active, setActive] = React.useState<PipelineStage | null>(null);
  const mover = useStageMove();
  const layout = usePipelineLayout();

  const byStage = React.useMemo(() => {
    const m = new Map<Stage, Application[]>();
    for (const a of data?.results ?? []) {
      const list = m.get(a.stage) ?? [];
      list.push(a);
      m.set(a.stage, list);
    }
    return m;
  }, [data]);
  const closed = CLOSED_STAGES.flatMap((s) => byStage.get(s) ?? []);
  const countOf = (s: Stage) => job.counts?.[s] ?? byStage.get(s)?.length ?? 0;
  // Default focus: the earliest stage that has someone in it.
  const focus: PipelineStage =
    active ?? PIPELINE_STAGES.find((s) => (byStage.get(s)?.length ?? 0) > 0) ?? PIPELINE_STAGES[0];
  const fi = PIPELINE_STAGES.indexOf(focus);
  const winStart = Math.max(0, Math.min(fi - 1, PIPELINE_STAGES.length - 3));
  const visible: readonly PipelineStage[] =
    layout === "wide"
      ? PIPELINE_STAGES
      : layout === "tablet"
        ? PIPELINE_STAGES.slice(winStart, winStart + 3)
        : [focus];

  const column = (s: PipelineStage, opts?: { panel?: boolean }) => {
    const list = byStage.get(s) ?? [];
    const dense = layout === "wide";
    return (
      <div
        key={s}
        className="border-border bg-surface-muted/60 rounded-dense flex min-w-0 flex-col border"
        aria-labelledby={opts?.panel ? undefined : `stage-head-${s}`}
        role={opts?.panel ? undefined : "group"}
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-2.5 py-2">
          <span id={`stage-head-${s}`}>
            <StatusBadge status={s} ns="stage" />
          </span>
          <span className="text-fg tabular text-sm font-semibold">
            <span className="sr-only">{t(`stage.${s}`)}: </span>
            {f.digits(countOf(s))}
          </span>
        </div>
        <ul className={cn("flex flex-1 flex-col gap-2", dense ? "p-1.5" : "p-2")}>
          {list.length ? (
            list.map((a) => (
              <li key={a.id}>
                <CandidateCard
                  app={a}
                  job={job}
                  dense={dense}
                  onOpen={() => setOpenId(a.id)}
                  onMove={(to) => mover.request(a, to)}
                  pending={mover.pendingId === a.id}
                />
              </li>
            ))
          ) : (
            <li className="text-fg-muted px-2 py-6 text-center text-xs">{td("column_empty")}</li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <section aria-labelledby="pipeline-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="pipeline-heading" className="text-fg text-lg font-semibold">
            {td("pipeline")}
          </h2>
          <p className="text-fg-muted text-sm">{td("pipeline_hint")}</p>
        </div>
        <InviteWorkerButton job={job} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5" aria-busy>
          {PIPELINE_STAGES.map((s, i) => (
            <Skeleton
              key={s}
              className={cn("h-48 w-full", i > 0 && "max-md:hidden", i > 2 && "md:max-xl:hidden")}
            />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.results.length ? (
        <EmptyState
          icon={UserSearch}
          title={td("no_candidates_title")}
          description={
            job.status === "draft" ? td("no_candidates_draft") : td("no_candidates_open")
          }
          action={job.status === "draft" ? <JobActionsPublishHint /> : undefined}
        />
      ) : (
        <>
          {layout === "phone" ? (
            <TabsPrimitive.Root
              value={focus}
              onValueChange={(v) => setActive(v as PipelineStage)}
              activationMode="automatic"
            >
              <TabsPrimitive.List
                aria-label={td("stage_tabs")}
                className="bg-surface-muted rounded-control grid grid-cols-5 gap-0.5 p-0.5"
              >
                {PIPELINE_STAGES.map((s) => (
                  <TabsPrimitive.Trigger
                    key={s}
                    value={s}
                    className="text-fg-muted data-[state=active]:bg-surface data-[state=active]:text-fg focus-visible:outline-ring flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[10px] px-0.5 py-1 text-[11px] leading-4 font-medium focus-visible:outline-2 data-[state=active]:shadow-sm"
                  >
                    <span className="w-full truncate text-center">{t(`stage.${s}`)}</span>
                    <span className="tabular text-sm font-semibold">{f.digits(countOf(s))}</span>
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>
              {PIPELINE_STAGES.map((s) => (
                <TabsPrimitive.Content
                  key={s}
                  value={s}
                  className="pt-3 focus-visible:outline-none"
                >
                  {column(s, { panel: true })}
                </TabsPrimitive.Content>
              ))}
            </TabsPrimitive.Root>
          ) : (
            <>
              {layout === "tablet" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg-muted text-xs font-medium" id="stage-jump-label">
                    {td("stage_jump")}
                  </span>
                  <div
                    role="group"
                    aria-labelledby="stage-jump-label"
                    className="flex flex-wrap gap-1.5"
                  >
                    {PIPELINE_STAGES.map((s) => {
                      const shown = visible.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={shown}
                          onClick={() => setActive(s)}
                          className={cn(
                            "focus-visible:outline-ring rounded-pill inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                            shown
                              ? "border-brand bg-brand-subtle text-brand-subtle-fg"
                              : "border-border bg-surface text-fg-body hover:bg-surface-hover",
                          )}
                        >
                          {t(`stage.${s}`)}
                          <span className="tabular font-semibold">{f.digits(countOf(s))}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-fg-muted ml-auto text-xs" aria-live="polite">
                    {td("stage_window", {
                      from: t(`stage.${visible[0]}`),
                      to: t(`stage.${visible[visible.length - 1]}`),
                    })}
                  </span>
                </div>
              ) : null}
              <div className={cn("grid gap-2", layout === "wide" ? "grid-cols-5" : "grid-cols-3")}>
                {visible.map((s) => column(s))}
              </div>
            </>
          )}

          {closed.length ? (
            <div className="border-border bg-surface rounded-dense border">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                aria-expanded={showClosed}
                className="text-fg hover:bg-surface-hover flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
              >
                {td("closed_stages", { count: closed.length })}
                <ChevronDown
                  className={cn("size-4 transition-transform", showClosed && "rotate-180")}
                  aria-hidden
                />
              </button>
              {showClosed ? (
                <ul className="border-border grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {closed.map((a) => (
                    <li key={a.id}>
                      <CandidateCard app={a} job={job} onOpen={() => setOpenId(a.id)} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <ApplicationDrawer
        id={openId}
        onOpenChange={(o) => !o && setOpenId(null)}
        showJobLink={false}
      />
      {mover.dialog}
    </section>
  );
}

function JobActionsPublishHint() {
  const td = useTranslations("hiring.detail");
  return (
    <p className="text-fg-muted inline-flex items-center gap-1.5 text-sm">
      <Send className="size-4" aria-hidden />
      {td("publish_hint")}
    </p>
  );
}

function CandidateCard({
  app,
  job,
  onOpen,
  onMove,
  pending,
  dense,
}: {
  app: Application;
  job: Job;
  onOpen: () => void;
  onMove?: (to: Stage) => void;
  pending?: boolean;
  /** Five-column board: score moves to the footer line, one skill chip, tighter padding. */
  dense?: boolean;
}) {
  const t = useTranslations();
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const reasonsFor = useCandidateReasons();
  const next = TRANSITIONS[app.stage] ?? [];
  const days = daysSince(app.stage_changed_at);
  return (
    <MatchReasonCard
      compact
      className={cn(pending && "opacity-60", dense && "p-2.5")}
      score={dense ? null : (app.match_score ?? null)}
      scoreLabel={
        app.match_score !== null && app.match_score !== undefined
          ? f.digits(app.match_score)
          : undefined
      }
      reasons={reasonsFor(app.worker, job)}
      identity={
        <button
          type="button"
          onClick={onOpen}
          className="focus-visible:outline-ring block w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={td("open_candidate", { name: app.worker.full_name })}
        >
          <WorkerIdentity worker={app.worker} size="sm" showTrust={false} hideVerified wrap />
        </button>
      }
      footer={
        <>
          <ApplicationGrowthBadges
            application={app as ApplicationWithGrowth}
            className="flex flex-wrap gap-1 empty:hidden"
          />
          <OfferControls app={app as Application & ApplicationOfferField} />
          <TagsAndAssignee app={app} className="mt-2" />
          {app.stage === "interview" && app.interview_at ? (
            <p className="bg-warning-subtle text-warning tabular mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium">
              <CalendarClock className="size-3.5" aria-hidden />
              {f.dateTime(app.interview_at)}
            </p>
          ) : null}
          {app.stage === "rejected" && app.rejection_reason ? (
            <p className="text-fg-muted mt-2 line-clamp-2 text-xs">{app.rejection_reason}</p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-1">
            <span className="text-fg-muted min-w-0 text-[11px] leading-4">
              {dense && app.match_score !== null && app.match_score !== undefined ? (
                <span className="text-fg tabular block font-semibold">
                  {td("score_inline", { score: f.digits(app.match_score) })}
                </span>
              ) : null}
              {days !== null ? td("in_stage_for", { count: days }) : null}
            </span>
            {onMove && next.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2" disabled={pending}>
                    {td("move")}
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{td("move_to")}</DropdownMenuLabel>
                  {next.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      danger={s === "rejected" || s === "dropped"}
                      onSelect={() => onMove(s)}
                    >
                      {t(`stage.${s}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </>
      }
    >
      <div
        className={cn(
          dense &&
            "[&_.rounded-pill]:shrink [&_.rounded-pill]:flex-wrap [&_.rounded-pill]:rounded-sm",
        )}
      >
        <SkillChips skills={app.worker.skills} max={dense ? 1 : 2} />
      </div>
    </MatchReasonCard>
  );
}
