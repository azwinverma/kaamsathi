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
import { ApplicationGrowthBadges } from "@/components/experience/badges";
import { WorkHistoryConfirmations } from "@/components/experience/confirmations-panel";
import type { ApplicationWithGrowth } from "@/lib/api/types-experience";
import { ApplicationDrawer } from "./application-drawer";
import { HiringGate } from "./gate";
import { ALL_STAGES } from "./lib";
import { MatchScoreBadge, TagsAndAssignee } from "./application-pipeline";
import { useApplicationTags } from "@/lib/api/hooks/pipeline";
import { useMembers } from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import { useSession } from "@/components/providers/session";

const PAGE_SIZE = 25;
const SOURCES = ["ops", "worker_interest", "employer_invite"] as const;

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
  const tf = useTranslations("pipeline.filters");
  const { me } = useSession();
  const f = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const openId = search.get("application");
  const [stage, setStage] = React.useState<"all" | Stage | "confirmations">(() => {
    const s = search.get("stage");
    if (search.get("tab") === "confirmations") return "confirmations";
    return s && (ALL_STAGES as string[]).includes(s) ? (s as Stage) : "all";
  });
  const confirmations = stage === "confirmations";
  const [job, setJob] = React.useState(() => search.get("job") ?? "");
  const [q, setQ] = React.useState("");
  const [tag, setTag] = React.useState(() => search.get("tag") ?? "");
  const [assignee, setAssignee] = React.useState(() => search.get("assignee") ?? "");
  const [source, setSource] = React.useState(() => search.get("source") ?? "");
  const tags = useApplicationTags();
  const members = useMembers();
  const [page, setPage] = React.useState(1);

  const jobs = useJobs({ page_size: 100, ordering: "-created_at" });
  const { data, isLoading, error, refetch, isFetching } = useApplications({
    stage: stage === "all" || confirmations ? undefined : stage,
    job: job || undefined,
    q: q || undefined,
    tag: tag || undefined,
    assignee: assignee || undefined,
    source: source || undefined,
    page,
    page_size: PAGE_SIZE,
    ordering: "-stage_changed_at",
  });
  const filtered =
    (stage !== "all" && !confirmations) || !!job || !!q || !!tag || !!assignee || !!source;
  const memberOptions = listResults(members.data)
    .filter((m) => m.is_active && m.user.id !== me.id)
    .map((m) => ({ value: m.user.id, label: m.user.full_name }));

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
          setStage(v as "all" | Stage | "confirmations");
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
          <TabsTrigger value="confirmations">{t("experience.confirm.tab")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {confirmations ? (
        <WorkHistoryConfirmations />
      ) : (
        <>
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
            <Select
              value={tag}
              onValueChange={(v) => {
                setTag(v);
                setPage(1);
              }}
              allowEmpty
              emptyLabel={tf("all_tags")}
              placeholder={tf("all_tags")}
              aria-label={tf("tag")}
              disabled={tags.isLoading}
              className="sm:w-44"
              options={(tags.data ?? []).map((x) => ({
                value: x.tag,
                label: `${x.tag} (${f.digits(x.count)})`,
              }))}
            />
            <Select
              value={assignee}
              onValueChange={(v) => {
                setAssignee(v);
                setPage(1);
              }}
              allowEmpty
              emptyLabel={tf("assignee_all")}
              placeholder={tf("assignee_all")}
              aria-label={tf("assignee")}
              className="sm:w-48"
              options={[
                { value: "me", label: tf("assignee_me") },
                { value: "none", label: tf("assignee_none") },
                ...memberOptions,
              ]}
            />
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v);
                setPage(1);
              }}
              allowEmpty
              emptyLabel={tf("source_all")}
              placeholder={tf("source_all")}
              aria-label={tf("source")}
              className="sm:w-48"
              options={SOURCES.map((s) => ({ value: s, label: tf(`sources.${s}`) }))}
            />
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStage("all");
                  setJob("");
                  setTag("");
                  setAssignee("");
                  setSource("");
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
                          <TagsAndAssignee app={a} className="mt-1.5" />
                        </RowHeader>
                        <Td>
                          <Link
                            href={`/app/jobs/${a.job.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-fg hover:text-brand-text hover:underline"
                          >
                            {a.job.title}
                          </Link>
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={a.stage} ns="stage" />
                            <ApplicationGrowthBadges application={a as ApplicationWithGrowth} />
                            <MatchScoreBadge app={a} />
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
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                count={data.count}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      <ApplicationDrawer id={openId} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}
