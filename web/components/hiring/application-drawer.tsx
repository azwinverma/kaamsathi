"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Briefcase, CalendarClock, EyeOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/card";
import { DateText } from "@/components/ui/date";
import { DialogDescription, DialogTitle, Sheet, SheetContent } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { StatusBadge, VerificationBadge } from "@/components/shared/status-badge";
import { ApplicationGrowthBadges } from "@/components/experience/badges";
import { OfferChip } from "@/components/experience/offer-dialog";
import type { ApplicationGrowthFields, ApplicationOfferField } from "@/lib/api/types-experience";
import {
  RatingStars,
  SkillChips,
  WorkerIdentity,
  tradeOf,
} from "@/components/shared/worker-summary";
import { useApplication } from "@/lib/api/hooks/hiring";
import type { ApplicationDetail, ApplicationExtras, Stage, WorkHistoryItem } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { TRANSITIONS, actorName, ageFrom, isProfile } from "./lib";
import { useStageMove } from "./move-stage";
import { AssignmentSection, MatchScoreBadge } from "./application-pipeline";
import { InterviewsSection } from "./interviews";

/** Right-side drawer with a candidate's application: profile, history, stage events, move actions. */
export function ApplicationDrawer({
  id,
  onOpenChange,
  showJobLink = true,
}: {
  id: string | null;
  onOpenChange: (open: boolean) => void;
  showJobLink?: boolean;
}) {
  const t = useTranslations();
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t("common.close")} aria-describedby={undefined}>
        {id ? <DrawerBody id={id} showJobLink={showJobLink} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ id, showJobLink }: { id: string; showJobLink: boolean }) {
  const t = useTranslations();
  const ta = useTranslations("hiring.application");
  const tp = useTranslations("pipeline");
  const { data, isLoading, error, refetch } = useApplication(id);
  const mover = useStageMove();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" aria-busy>
        <DialogTitle className="sr-only">{t("common.loading")}</DialogTitle>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 pt-14">
        <DialogTitle className="sr-only">{t("common.error_loading")}</DialogTitle>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const app = data as ApplicationDetail & ApplicationExtras;
  const worker = app.worker;
  const profile = isProfile(worker) ? worker : null;
  const next = TRANSITIONS[app.stage] ?? [];

  return (
    <>
      <div className="border-border border-b px-6 pt-5 pr-14 pb-4">
        <DialogTitle className="sr-only">{worker.full_name}</DialogTitle>
        <DialogDescription className="sr-only">{ta("title")}</DialogDescription>
        <WorkerIdentity worker={worker} size="lg" showPhone={!profile} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={app.stage} ns="stage" />
          <VerificationBadge status={worker.verification_status} />
          <ApplicationGrowthBadges
            application={app as ApplicationGrowthFields}
            className="contents"
          />
          <OfferChip offer={(app as ApplicationOfferField).offer} />
          <MatchScoreBadge app={app} />
          {showJobLink ? (
            <Link
              href={`/app/jobs/${app.job.id}`}
              className="text-brand inline-flex items-center gap-1 text-sm hover:underline"
            >
              <Briefcase className="size-3.5" aria-hidden />
              {app.job.title}
            </Link>
          ) : (
            <span className="text-fg-muted text-sm">{app.job.title}</span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {app.stage === "interview" && app.interview_at ? (
          <InterviewBanner iso={app.interview_at} />
        ) : null}

        <Section title={tp("assign.section")}>
          <AssignmentSection app={app} />
        </Section>

        {app.stage === "shortlisted" ||
        app.stage === "interview" ||
        (app.interviews?.length ?? 0) > 0 ? (
          <Section title={tp("interviews.title")}>
            <InterviewsSection app={app} />
          </Section>
        ) : null}

        <Section title={ta("profile")}>
          <ProfileFacts worker={worker} profile={profile} />
          {!profile ? (
            <p className="bg-surface-muted text-fg-muted mt-3 flex items-start gap-2 rounded-md p-3 text-sm">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              {ta("profile_hidden")}
            </p>
          ) : null}
        </Section>

        {profile ? (
          <Section title={ta("history")}>
            {profile.history.length ? (
              <ol className="space-y-2">
                {profile.history.map((h, i) => (
                  <HistoryRow key={i} item={h} />
                ))}
              </ol>
            ) : (
              <p className="text-fg-muted text-sm">{ta("history_empty")}</p>
            )}
          </Section>
        ) : null}

        {app.rejection_reason || app.notes ? (
          <Section title={t("common.notes")}>
            <DescriptionList
              columns={1}
              items={[
                ...(app.rejection_reason
                  ? [{ label: ta("rejection_reason"), value: app.rejection_reason }]
                  : []),
                ...(app.notes
                  ? [
                      {
                        label: t("common.notes"),
                        value: <span className="whitespace-pre-line">{app.notes}</span>,
                      },
                    ]
                  : []),
              ]}
            />
          </Section>
        ) : null}

        <Section title={ta("timeline")}>
          <Timeline app={app} />
        </Section>
      </div>

      {next.length ? (
        <div className="border-border bg-surface-muted/60 flex flex-wrap items-center gap-2 border-t px-6 py-4">
          <span className="text-fg-muted mr-1 text-sm">{ta("move_to")}</span>
          {next.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={
                s === "rejected" || s === "dropped"
                  ? "danger-outline"
                  : s === "joined"
                    ? "primary"
                    : "secondary"
              }
              onClick={() => mover.request(app, s)}
              loading={mover.pendingId === app.id}
            >
              {t(`stage.${s}`)}
            </Button>
          ))}
        </div>
      ) : null}
      {app.stage === "joined" && app.employment_id ? (
        <div className="border-border bg-surface-muted/60 border-t px-6 py-4">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/app/workers/${app.employment_id}`}>
              {ta("view_workers")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}
      {mover.dialog}
    </>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-fg text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function InterviewBanner({ iso }: { iso: string }) {
  const ta = useTranslations("hiring.application");
  const f = useFormat();
  return (
    <div className="border-warning/30 bg-warning-subtle flex items-center gap-3 rounded-lg border p-3 text-sm">
      <CalendarClock className="text-warning size-5 shrink-0" aria-hidden />
      <div>
        <p className="text-fg font-semibold">{ta("interview")}</p>
        <p className="text-fg-body tabular">{f.dateTime(iso)}</p>
      </div>
    </div>
  );
}

function ProfileFacts({
  worker,
  profile,
}: {
  worker: ApplicationDetail["worker"];
  profile: Extract<ApplicationDetail["worker"], { history: unknown }> | null;
}) {
  const t = useTranslations();
  const ta = useTranslations("hiring.application");
  const f = useFormat();
  const age = profile ? ageFrom(profile.date_of_birth) : null;
  const items: { label: React.ReactNode; value: React.ReactNode; full?: boolean }[] = [];
  if (profile) {
    items.push({
      label: t("term.phone"),
      value: (
        <a
          href={`tel:+977${profile.phone}`}
          className="text-brand tabular inline-flex items-center gap-1 hover:underline"
        >
          <Phone className="size-3.5" aria-hidden />
          {f.phone(profile.phone)}
        </a>
      ),
    });
    items.push({
      label: t("term.gender"),
      value: profile.gender ? t(`term.${profile.gender}`) : "—",
    });
    items.push({ label: ta("age"), value: age !== null ? ta("age_years", { count: age }) : "—" });
    if (profile.address) items.push({ label: t("term.address"), value: profile.address });
  }
  items.push({
    label: t("term.experience"),
    value: t("term.years", { count: worker.total_experience_years ?? 0 }),
  });
  items.push({ label: t("term.rating"), value: <RatingStars value={worker.rating_avg} /> });
  items.push({ label: t("term.placements"), value: f.digits(worker.placements_count ?? 0) });
  items.push({
    label: ta("skills"),
    value: worker.skills?.length ? <SkillChips skills={worker.skills} max={6} /> : "—",
    full: true,
  });
  return <DescriptionList items={items} />;
}

function HistoryRow({ item }: { item: WorkHistoryItem }) {
  const ta = useTranslations("hiring.application");
  const f = useFormat();
  const trade = item.trade
    ? tradeOf({ trade: item.trade, years_experience: 0, nstb_level: "none" })
    : null;
  return (
    <li className="border-border rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-fg truncate font-medium">{item.organization_name}</p>
          <p className="text-fg-muted text-xs">{trade ? f.name(trade) : null}</p>
        </div>
        <RatingStars value={item.rating} />
      </div>
      <p className="text-fg-muted tabular mt-1.5 text-xs">
        <DateText ad={item.start_date} bs={item.start_date_bs} inline /> –{" "}
        {item.end_date ? (
          <DateText ad={item.end_date} bs={item.end_date_bs} inline />
        ) : (
          ta("present")
        )}
        {" · "}
        {ta("months", { count: item.months })}
      </p>
    </li>
  );
}

function Timeline({ app }: { app: ApplicationDetail }) {
  const t = useTranslations();
  const ta = useTranslations("hiring.application");
  const f = useFormat();
  const events = [...(app.events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!events.length) {
    return (
      <p className="text-fg-muted text-sm">
        {ta("event_created", { stage: t(`stage.${app.stage}`) })} · {f.dateTime(app.created_at)}
      </p>
    );
  }
  const stageName = (s: Stage | null) => (s ? t(`stage.${s}`) : "");
  return (
    <ol className="border-border relative space-y-4 border-l pl-5">
      {events.map((e, i) => {
        const by = actorName(e.by);
        return (
          <li key={e.id ?? i} className="relative">
            <span
              className={cn(
                "ring-surface absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4",
                i === 0 ? "bg-brand" : "bg-border-strong",
              )}
              aria-hidden
            />
            <p className="text-fg text-sm">
              {e.from_stage
                ? ta("event_moved", { from: stageName(e.from_stage), to: stageName(e.to_stage) })
                : ta("event_created", { stage: stageName(e.to_stage) })}
            </p>
            <p className="text-fg-muted tabular text-xs">
              {f.dateTime(e.created_at)}
              {by ? ` · ${ta("by", { name: by })}` : null}
            </p>
            {e.note ? (
              <p className="text-fg-body mt-1 text-sm whitespace-pre-line">{e.note}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
