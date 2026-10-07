"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Briefcase, CalendarDays, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateText } from "@/components/ui/date";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { TradeSelect } from "@/components/shared/selects";
import { useJobs } from "@/lib/api/hooks/hiring";
import type { Job, JobStatus } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { HiringGate } from "./gate";
import { JobActions } from "./job-actions";
import { FillProgress, JobBenefits, JobWage, PipelineCounts } from "./job-bits";
import { JobFormDialog } from "./job-form-dialog";

const PAGE_SIZE = 20;
const STATUS_TABS: ("all" | JobStatus)[] = ["all", "open", "draft", "filled", "closed"];

export function JobsPage() {
  return (
    <HiringGate>
      <JobsPageInner />
    </HiringGate>
  );
}

function JobsPageInner() {
  const t = useTranslations();
  const tj = useTranslations("hiring.jobs");
  const [status, setStatus] = React.useState<"all" | JobStatus>("all");
  const [trade, setTrade] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const params = {
    status: status === "all" ? undefined : status,
    trade: trade || undefined,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
    ordering: "-created_at",
  };
  const { data, isLoading, error, refetch, isFetching } = useJobs(params);
  const filtered = status !== "all" || !!trade || !!q;

  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader
        title={t("nav.jobs")}
        description={tj("description")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {tj("new")}
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(v) => resetPage(setStatus)(v as "all" | JobStatus)}>
        <TabsList className="mb-4" aria-label={t("common.status")}>
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s === "all" ? t("common.all") : t(`status.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Toolbar>
        <SearchInput value={q} onChange={resetPage(setQ)} placeholder={tj("search")} />
        <div className="w-full sm:w-56">
          <TradeSelect
            value={trade}
            onChange={resetPage(setTrade)}
            allowEmpty
            placeholder={tj("all_trades")}
            aria-label={t("term.trade")}
          />
        </div>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("all");
              setTrade("");
              setQ("");
              setPage(1);
            }}
          >
            {t("common.clear_filters")}
          </Button>
        ) : null}
      </Toolbar>

      {isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3 w-80 max-w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.results.length ? (
        filtered ? (
          <EmptyState icon={Briefcase} title={t("common.no_results")} />
        ) : (
          <EmptyState
            icon={Briefcase}
            title={tj("empty_title")}
            description={tj("empty_body")}
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {tj("new")}
              </Button>
            }
          />
        )
      ) : (
        <div className={isFetching ? "space-y-3 opacity-70 transition-opacity" : "space-y-3"}>
          {data.results.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
          <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPageChange={setPage} />
        </div>
      )}

      <JobFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function JobCard({ job }: { job: Job }) {
  const t = useTranslations();
  const tj = useTranslations("hiring.jobs");
  const f = useFormat();
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/jobs/${job.id}`}
              className="text-fg hover:text-brand text-base font-semibold hover:underline"
            >
              {job.title}
            </Link>
            <StatusBadge status={job.status} label={job.status_label} />
          </div>
          <div className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-fg-body">{f.name(job.trade)}</span>
            {job.site ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {job.site.name}
              </span>
            ) : null}
            <JobWage job={job} />
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {tj("starts")} <DateText ad={job.start_date} bs={job.start_date_bs} inline />
            </span>
            {job.min_experience_years ? (
              <span>
                {t("term.experience")}: {t("term.years", { count: job.min_experience_years })}+
              </span>
            ) : null}
          </div>
          <JobBenefits job={job} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="max-sm:hidden">
            <FillProgress job={job} />
          </div>
          <JobActions job={job} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <PipelineCounts counts={job.counts} className="flex-1" />
        <div className="sm:hidden">
          <FillProgress job={job} />
        </div>
        <Button asChild variant="secondary" size="sm" className="sm:self-center">
          <Link href={`/app/jobs/${job.id}`}>{tj("view_pipeline")}</Link>
        </Button>
      </div>
    </Card>
  );
}
