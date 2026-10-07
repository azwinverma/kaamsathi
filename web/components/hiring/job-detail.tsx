"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, ChevronDown, MoreHorizontal, Send, UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
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
import { WorkerCardView } from "@/components/shared/worker-summary";
import { isApiError } from "@/lib/api/errors";
import { useApplications, useJob } from "@/lib/api/hooks/hiring";
import type { Application, Job, Stage } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { ApplicationDrawer } from "./application-drawer";
import { HiringGate } from "./gate";
import { JobActions } from "./job-actions";
import { FillProgress, JobBenefits, JobWage } from "./job-bits";
import { CLOSED_STAGES, PIPELINE_STAGES, TRANSITIONS, daysSince } from "./lib";
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
            <StatusBadge status={job.status} label={job.status_label} />
            <span className="text-fg-muted text-sm">
              {[f.name(job.trade), job.site?.name].filter(Boolean).join(" · ")}
            </span>
          </>
        }
        actions={<JobActions job={job} primary redirectOnDelete="/app/jobs" />}
      />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <JobSummary job={job} />
        <Pipeline job={job} />
      </div>
    </>
  );
}

function JobSummary({ job }: { job: Job }) {
  const t = useTranslations();
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const shift = job.shift && typeof job.shift === "object" ? job.shift.name : null;
  return (
    <Card className="h-fit">
      <CardHeader title={td("overview")} />
      <CardBody className="space-y-5">
        <FillProgress job={job} />
        <DescriptionList
          columns={1}
          items={[
            { label: td("wage"), value: <JobWage job={job} /> },
            { label: td("openings"), value: f.digits(job.openings_count) },
            {
              label: t("term.start_date"),
              value: <DateText ad={job.start_date} bs={job.start_date_bs} />,
            },
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
            ...(job.description
              ? [
                  {
                    label: t("common.description"),
                    value: <span className="whitespace-pre-line">{job.description}</span>,
                  },
                ]
              : []),
          ]}
        />
      </CardBody>
    </Card>
  );
}

function Pipeline({ job }: { job: Job }) {
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const { data, isLoading, error, refetch } = useApplications({
    job: job.id,
    page_size: 100,
    ordering: "-stage_changed_at",
  });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showClosed, setShowClosed] = React.useState(false);
  const mover = useStageMove();

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

  return (
    <section aria-labelledby="pipeline-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="pipeline-heading" className="text-fg text-lg font-semibold">
            {td("pipeline")}
          </h2>
          <p className="text-fg-muted text-sm">{td("pipeline_hint")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy>
          {PIPELINE_STAGES.map((s) => (
            <Skeleton key={s} className="h-48 w-full" />
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
          <div className="-mx-4 flex snap-x snap-mandatory scrollbar-thin gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {PIPELINE_STAGES.map((s) => {
              const list = byStage.get(s) ?? [];
              return (
                <div
                  key={s}
                  className="border-border bg-surface-muted/60 flex w-[78vw] max-w-[280px] min-w-[240px] shrink-0 snap-start flex-col rounded-lg border sm:w-auto sm:flex-1"
                >
                  <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2.5">
                    <StatusBadge status={s} ns="stage" />
                    <span className="text-fg-muted tabular text-sm font-semibold">
                      {f.digits(job.counts?.[s] ?? list.length)}
                    </span>
                  </div>
                  <ul className="flex flex-1 flex-col gap-2 p-2">
                    {list.length ? (
                      list.map((a) => (
                        <li key={a.id}>
                          <CandidateCard
                            app={a}
                            onOpen={() => setOpenId(a.id)}
                            onMove={(to) => mover.request(a, to)}
                            pending={mover.pendingId === a.id}
                          />
                        </li>
                      ))
                    ) : (
                      <li className="text-fg-subtle px-2 py-6 text-center text-xs">
                        {td("column_empty")}
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          {closed.length ? (
            <div className="border-border bg-surface rounded-lg border">
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
                <ul className="border-border grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {closed.map((a) => (
                    <li key={a.id}>
                      <CandidateCard app={a} onOpen={() => setOpenId(a.id)} />
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
  onOpen,
  onMove,
  pending,
}: {
  app: Application;
  onOpen: () => void;
  onMove?: (to: Stage) => void;
  pending?: boolean;
}) {
  const t = useTranslations();
  const td = useTranslations("hiring.detail");
  const f = useFormat();
  const next = TRANSITIONS[app.stage] ?? [];
  const days = daysSince(app.stage_changed_at);
  return (
    <div
      className={cn(
        "border-border bg-surface hover:border-border-strong rounded-lg border p-3 shadow-sm transition-colors",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:outline-ring block w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={td("open_candidate", { name: app.worker.full_name })}
      >
        <WorkerCardView worker={app.worker} />
      </button>
      {app.stage === "interview" && app.interview_at ? (
        <p className="bg-warning-subtle text-warning tabular mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium">
          <CalendarClock className="size-3.5" aria-hidden />
          {f.dateTime(app.interview_at)}
        </p>
      ) : null}
      {app.stage === "rejected" && app.rejection_reason ? (
        <p className="text-fg-muted mt-2 line-clamp-2 text-xs">{app.rejection_reason}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-fg-subtle text-[11px]">
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
    </div>
  );
}
