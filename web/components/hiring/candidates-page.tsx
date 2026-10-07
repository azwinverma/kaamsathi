"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { RatingStars, WorkerIdentity } from "@/components/shared/worker-summary";
import { useApplications, useJobs } from "@/lib/api/hooks/hiring";
import type { Stage } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { ApplicationDrawer } from "./application-drawer";
import { HiringGate } from "./gate";
import { ALL_STAGES } from "./lib";

const PAGE_SIZE = 25;

export function CandidatesPage() {
  return (
    <HiringGate>
      <CandidatesInner />
    </HiringGate>
  );
}

function CandidatesInner() {
  const t = useTranslations();
  const tc = useTranslations("hiring.candidates");
  const f = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const openId = search.get("application");
  const [stage, setStage] = React.useState<"all" | Stage>(() => {
    const s = search.get("stage");
    return s && (ALL_STAGES as string[]).includes(s) ? (s as Stage) : "all";
  });
  const [job, setJob] = React.useState(() => search.get("job") ?? "");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);

  const jobs = useJobs({ page_size: 100, ordering: "-created_at" });
  const { data, isLoading, error, refetch, isFetching } = useApplications({
    stage: stage === "all" ? undefined : stage,
    job: job || undefined,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
    ordering: "-stage_changed_at",
  });
  const filtered = stage !== "all" || !!job || !!q;

  const setOpen = (id: string | null) => {
    const sp = new URLSearchParams(search.toString());
    if (id) sp.set("application", id);
    else sp.delete("application");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <PageHeader title={t("nav.candidates")} description={tc("description")} />

      <Tabs
        value={stage}
        onValueChange={(v) => {
          setStage(v as "all" | Stage);
          setPage(1);
        }}
      >
        <TabsList className="mb-4" aria-label={t("common.status")}>
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
          {ALL_STAGES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(`stage.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={tc("search")}
        />
        <Select
          value={job}
          onValueChange={(v) => {
            setJob(v);
            setPage(1);
          }}
          allowEmpty
          emptyLabel={tc("all_jobs")}
          placeholder={tc("all_jobs")}
          aria-label={tc("job_filter")}
          disabled={jobs.isLoading}
          className="sm:w-64"
          options={(jobs.data?.results ?? []).map((j) => ({ value: j.id, label: j.title }))}
        />
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStage("all");
              setJob("");
              setQ("");
              setPage(1);
            }}
          >
            {t("common.clear_filters")}
          </Button>
        ) : null}
      </Toolbar>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.results.length ? (
        filtered ? (
          <EmptyState icon={UserSearch} title={t("common.no_results")} />
        ) : (
          <EmptyState
            icon={UserSearch}
            title={tc("empty_title")}
            description={tc("empty_body")}
            action={
              <Button asChild>
                <Link href="/app/jobs">{tc("view_jobs")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <TableContainer className={isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table className="min-w-[760px]">
              <THead>
                <tr>
                  <Th>{tc("col_candidate")}</Th>
                  <Th>{tc("col_job")}</Th>
                  <Th>{tc("col_stage")}</Th>
                  <Th>{tc("col_experience")}</Th>
                  <Th>{tc("col_updated")}</Th>
                </tr>
              </THead>
              <TBody>
                {data.results.map((a) => (
                  <Tr
                    key={a.id}
                    interactive
                    selected={a.id === openId}
                    onClick={() => setOpen(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen(a.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={tc("open_candidate", { name: a.worker.full_name })}
                  >
                    <RowHeader>
                      <WorkerIdentity worker={a.worker} size="sm" />
                    </RowHeader>
                    <Td>
                      <Link
                        href={`/app/jobs/${a.job.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-fg hover:text-brand hover:underline"
                      >
                        {a.job.title}
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={a.stage} ns="stage" />
                        {a.stage === "interview" && a.interview_at ? (
                          <span className="text-fg-muted tabular text-xs">
                            {f.dateTime(a.interview_at)}
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="whitespace-nowrap">
                          {t("term.years", { count: a.worker.total_experience_years ?? 0 })}
                        </span>
                        <RatingStars value={a.worker.rating_avg} />
                      </div>
                    </Td>
                    <Td className="text-fg-muted tabular text-xs whitespace-nowrap">
                      {f.dateTime(a.stage_changed_at)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPageChange={setPage} />
        </>
      )}

      <ApplicationDrawer id={openId} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}
