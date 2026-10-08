"use client";
import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronLeft,
  FileCheck2,
  FileText,
  HandCoins,
  MapPin,
  Pencil,
  Star,
  UserX,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CredentialCard,
  EmploymentTimeline,
  LadderStrip,
  useWorkerLadder,
  type TimelineEntry,
} from "@/components/ledger";
import { CREDENTIAL_TONE } from "@/components/credentials/shared";
import { ContractPanel } from "@/components/compliance/contract-panel";
import { useSession } from "@/components/providers/session";
import { StatusBadge, VerificationBadge } from "@/components/shared/status-badge";
import { RatingStars, SkillChips } from "@/components/shared/worker-summary";
import { CommentStatusBadge, ScorePair } from "@/components/trust/rating-bits";
import { ReliabilityBadge } from "@/components/trust/trust-badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateText, Money } from "@/components/ui/date";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { listResults, proxyHref } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useEmploymentContract } from "@/lib/api/hooks/compliance";
import { useExpiringCredentials } from "@/lib/api/hooks/credentials";
import { usePayrollRuns, usePayslips } from "@/lib/api/hooks/payroll";
import {
  useAdvances,
  useAttendanceRegister,
  useEmployment,
  useEmploymentHistory,
} from "@/lib/api/hooks/workforce";
import type { Advance, AttendanceRegister, Employment, RegisterCell } from "@/lib/api/types";
import type { EmploymentHistoryEvent, WageField } from "@/lib/api/types-history";
import type { WorkerTrustFields } from "@/lib/api/types-trust";
import { todayBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { CreateAdvanceDialog, EditAdvanceDialog, outstandingOf } from "./advance-dialogs";
import { EditEmploymentDialog, EndEmploymentDialog, RateDialog } from "./employment-dialogs";
import { Notice } from "./shared";
import { parseAmount } from "./utils";

type Worker = Employment["worker"] & WorkerTrustFields;

/**
 * Worker detail (/app/workers/[id]) — documentary ledger layout.
 * Header band: identity, job, ladder state, actions. Body: the work record (EmploymentTimeline) is
 * the one focal point in a wide column; facts on file sit in a narrow column, separated by hairlines
 * rather than cards. Phones stack header → timeline → letter → facts.
 */
export function EmploymentDetail({ id }: { id: string }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const { canManage } = useSession();
  const { data: emp, isLoading, isError, error, refetch } = useEmployment(id);
  const [dialog, setDialog] = React.useState<"edit" | "end" | "rate" | null>(null);

  const back = { href: "/app/workers", label: t("nav.workers") };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (isError || !emp) {
    return (
      <div>
        <PageHeader title={td("title")} back={back} />
        <ErrorState
          error={error}
          title={
            isApiError(error) && error.code === "not_found" ? t("errors.not_found") : undefined
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const active = emp.status === "active";
  const today = todayIso();
  const replacementOpen =
    !!emp.replacement_eligible_until && emp.replacement_eligible_until >= today;

  return (
    <div>
      <HeaderBand
        emp={emp}
        back={back}
        actions={
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => setDialog("rate")}>
                <Star aria-hidden />
                {td("rate")}
              </Button>
              {active ? (
                <Button variant="danger-outline" onClick={() => setDialog("end")}>
                  <UserX aria-hidden />
                  {td("end")}
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {replacementOpen && canManage ? (
        <Notice tone="info" title={td("replacement_title")} className="mt-6">
          {td.rich("replacement_body", {
            date: () => (
              <DateText ad={emp.replacement_eligible_until} inline className="font-semibold" />
            ),
          })}
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <WorkRecord emp={emp} canManage={canManage} />
          {canManage ? (
            <div className="border-border border-t pt-8">
              <ContractPanel employmentId={emp.id} active={active} bare />
            </div>
          ) : null}
        </div>

        <aside
          aria-label={td("facts_label")}
          className="border-border min-w-0 border-t pt-2 md:pt-8 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8"
        >
          <div className="divide-border grid gap-x-10 md:grid-cols-2 xl:block xl:divide-y [&>*]:py-6 xl:[&>*:first-child]:pt-0 md:[&>*:nth-child(-n+2)]:pt-0">
            {canManage ? (
              <PayFacts emp={emp} onEdit={active ? () => setDialog("edit") : undefined} />
            ) : null}
            <EmploymentFacts emp={emp} />
            <WorkerFacts emp={emp} />
            {canManage ? <CredentialFacts emp={emp} /> : null}
            {canManage ? <AdvanceFacts emp={emp} /> : null}
          </div>
        </aside>
      </div>

      {canManage ? (
        <>
          <EditEmploymentDialog
            open={dialog === "edit"}
            onOpenChange={(o) => setDialog(o ? "edit" : null)}
            employment={emp}
          />
          <EndEmploymentDialog
            open={dialog === "end"}
            onOpenChange={(o) => setDialog(o ? "end" : null)}
            employment={emp}
          />
          <RateDialog
            open={dialog === "rate"}
            onOpenChange={(o) => setDialog(o ? "rate" : null)}
            employment={emp}
          />
        </>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ header band

function HeaderBand({
  emp,
  back,
  actions,
}: {
  emp: Employment;
  back: { href: string; label: string };
  actions: React.ReactNode;
}) {
  const td = useTranslations("workforce.detail");
  const tl = useTranslations("ledger.ladder");
  const f = useFormat();
  const w = emp.worker as Worker;
  const level = w.verification_level ?? (w.verification_status === "verified" ? 1 : 0);
  const rungs = useWorkerLadder(level, {
    rejected: w.verification_status === "rejected",
    dense: true,
  });
  return (
    <header className="border-border border-b pb-6">
      <Link
        href={back.href}
        className="text-fg-muted hover:text-fg -ml-1 inline-flex items-center gap-1 rounded-sm px-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {back.label}
      </Link>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Avatar
            name={w.full_name}
            src={w.photo}
            size="xl"
            className="max-sm:size-12 max-sm:text-sm"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="text-fg text-2xl font-bold break-words sm:text-[28px] sm:leading-9">
              {w.full_name}
            </h1>
            <p className="text-fg-body text-[15px]">
              {[emp.designation, emp.site?.name].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {w.district ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {f.name(w.district)}
                </span>
              ) : null}
              <span className="tabular">{w.phone_masked}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <StatusBadge status={emp.status} />
              <VerificationBadge status={w.verification_status} />
              {w.reliability_score !== undefined ? (
                <ReliabilityBadge score={w.reliability_score} />
              ) : null}
              {emp.employee_code ? <Badge tone="outline">{emp.employee_code}</Badge> : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:pt-1">{actions}</div>
        ) : null}
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
        <div>
          <p className="text-fg text-sm font-semibold">{tl("label")}</p>
          <p className="text-fg-muted text-xs leading-5">
            {verificationText(w.verification_status, td)}
          </p>
        </div>
        <LadderStrip rungs={rungs} label={tl("worker_title", { name: w.full_name })} />
      </div>
    </header>
  );
}

function verificationText(status: string, td: ReturnType<typeof useTranslations>): string {
  return status === "verified"
    ? td("verified_body")
    : status === "pending"
      ? td("pending_body")
      : status === "rejected"
        ? td("rejected_body")
        : td("unverified_body");
}

// ------------------------------------------------------------------ work record (timeline)

/** One timeline entry plus the key it sorts by (newest first). */
type Dated = TimelineEntry & { sort: string };

function WorkRecord({ emp, canManage }: { emp: Employment; canManage: boolean }) {
  const td = useTranslations("workforce.detail");
  const tt = useTranslations("ledger.timeline");
  const tc = useTranslations("compliance.contract");
  const f = useFormat();
  const now = React.useMemo(() => todayBs(), []);
  const today = todayIso();
  const register = useAttendanceRegister(now.year, now.month, emp.site?.id);
  const row = register.data?.rows.find((r) => r.employment_id === emp.id);
  const contract = useEmploymentContract(emp.id, canManage);
  const history = useEmploymentHistory(emp.id);
  const events = (history.data?.pages ?? []).flatMap((p) => p.results);

  const when = (ad: string | null | undefined, bs?: string | null) => {
    const d = f.date(ad, bs);
    return (
      <>
        <span className="text-fg-body block font-medium">{d.bs}</span>
        <span className="block">{d.ad}</span>
      </>
    );
  };
  const gross = (v: string | number | null | undefined) => f.money(v);

  // Server events arrive newest first; keep that order within a day (index suffix) so the
  // client-side entries (today, replacement guarantee, terms-changed) slot in by date.
  const entries: Dated[] = events.map((ev, i) => ({
    ...historyEntry(ev, { tt, tc, f, when, emp }),
    sort: `${ev.at.slice(0, 10)}|${String(99999 - i).padStart(5, "0")}`,
  }));

  // Replacement guarantee
  const rep = emp.replacement_eligible_until;
  if (rep) {
    entries.push({
      id: "replacement",
      sort: rep >= today && emp.status === "active" ? `~${rep}` : rep,
      when: when(rep),
      title: tt("replacement"),
      detail: tt("replacement_hint", { name: emp.worker.full_name.split(/\s+/)[0] }),
      state: rep >= today ? "upcoming" : "done",
    });
  }

  // Today: hajiri this month, inline
  if (emp.status === "active") {
    entries.push({
      id: "now",
      sort: `${today}~~`,
      when: (
        <>
          <span className="text-fg-body block font-medium">{tt("today")}</span>
          <span className="block">{f.bsMonth(now.year, now.month)}</span>
        </>
      ),
      title: tt("still_working"),
      detail: (
        <HajiriThisMonth
          register={register.data}
          row={row}
          loading={register.isLoading}
          error={register.isError ? register.error : null}
          onRetry={() => register.refetch()}
          monthLabel={f.bsMonth(now.year, now.month)}
          today={today}
          startDate={emp.start_date}
        />
      ),
      state: "current",
    });
  }

  // The letter the worker holds no longer matches the terms on file.
  const latest = contract.data?.latest;
  if (latest && contract.data?.needs_new_version && emp.status === "active") {
    const wageMoved = latest.terms.monthly_gross !== emp.monthly_gross && emp.monthly_gross;
    entries.push({
      id: "terms-changed",
      sort: `${today}~`,
      when: <span className="text-fg-body block font-medium">{tt("today")}</span>,
      icon: AlertTriangle,
      title: tt("terms_changed", { version: f.digits(latest.version) }),
      detail: wageMoved
        ? `${tt("terms_changed_wage", { now: gross(emp.monthly_gross), then: gross(latest.terms.monthly_gross) })} ${tt("terms_changed_hint")}`
        : tt("terms_changed_hint"),
      state: "attention",
    });
  }

  entries.sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0));

  return (
    <section aria-labelledby="work-record-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id="work-record-heading" className="text-fg text-lg font-semibold">
            {td("record_title")}
          </h2>
          <p className="text-fg-muted text-sm">{td("record_hint")}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/attendance">
            <CalendarCheck aria-hidden />
            {td("open_register")}
          </Link>
        </Button>
      </div>
      {history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} className="mb-4" />
      ) : null}
      {history.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <EmploymentTimeline entries={entries} label={tt("label")} />
      )}
      {history.hasNextPage ? (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => history.fetchNextPage()}
            loading={history.isFetchingNextPage}
          >
            {tt("show_older")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

const WAGE_FIELDS: WageField[] = [
  "wage_type",
  "basic_salary",
  "dearness_allowance",
  "other_allowance",
  "daily_wage",
  "hourly_wage",
  "part_time",
  "ssf_enrolled",
];
const MONEY_FIELDS = new Set<WageField>([
  "basic_salary",
  "dearness_allowance",
  "other_allowance",
  "daily_wage",
  "hourly_wage",
]);

/** One server history event → a timeline entry (title, detail, state, icon). */
function historyEntry(
  ev: EmploymentHistoryEvent,
  {
    tt,
    tc,
    f,
    when,
    emp,
  }: {
    tt: ReturnType<typeof useTranslations>;
    tc: ReturnType<typeof useTranslations>;
    f: ReturnType<typeof useFormat>;
    when: (ad: string | null | undefined, bs?: string | null) => React.ReactNode;
    emp: Employment;
  },
): TimelineEntry {
  const id = `${ev.type}-${ev.at}-${"id" in ev.detail ? ev.detail.id : ""}`;
  const base = { id, when: when(ev.at.slice(0, 10), ev.at_bs) };
  const by = ev.actor?.full_name ? (
    <span>{tt("letter_by", { name: ev.actor.full_name })}</span>
  ) : null;
  const line = (...parts: React.ReactNode[]) => (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">{parts}</span>
  );
  switch (ev.type) {
    case "employment_started": {
      const { site, designation } = ev.detail;
      return {
        ...base,
        title: site ? tt("joined", { site: site.name }) : tt("joined_no_site"),
        detail:
          designation || by ? line(designation ? tt("as", { designation }) : null, by) : undefined,
        state: "done",
      };
    }
    case "employment_ended":
      return {
        ...base,
        title: tt("ended"),
        detail: line(
          ev.detail.end_reason_label
            ? tt("ended_hint", { reason: ev.detail.end_reason_label })
            : null,
          by,
        ),
        state: "ended",
      };
    case "wage_changed": {
      const { changes, monthly_gross } = ev.detail;
      const fmt = (field: WageField, v: string | boolean | null | undefined) => {
        if (v === null || v === undefined || v === "") return "—";
        if (field === "wage_type")
          return v === ev.detail.wage_type.from
            ? ev.detail.wage_type.from_label
            : ev.detail.wage_type.to_label;
        if (typeof v === "boolean") return v ? tt("field.yes") : tt("field.no");
        return MONEY_FIELDS.has(field) ? f.money(v) : String(v);
      };
      const moved = monthly_gross.from !== monthly_gross.to;
      return {
        ...base,
        icon: HandCoins,
        title: moved
          ? tt("wage_change", { from: f.money(monthly_gross.from), to: f.money(monthly_gross.to) })
          : tt("terms_updated"),
        detail: (
          <>
            <ul className="space-y-0.5">
              {WAGE_FIELDS.filter((k) => changes[k]).map((k) => (
                <li key={k}>
                  {tt("field_change", {
                    field: tt(`field.${k}`),
                    from: fmt(k, changes[k]!.from),
                    to: fmt(k, changes[k]!.to),
                  })}
                </li>
              ))}
            </ul>
            {by}
          </>
        ),
        state: "done",
      };
    }
    case "site_changed":
      return {
        ...base,
        icon: MapPin,
        title: tt("site_change", {
          from: ev.detail.from?.name || tt("no_site"),
          to: ev.detail.to?.name || tt("no_site"),
        }),
        detail: by ?? undefined,
        state: "done",
      };
    case "designation_changed":
      return {
        ...base,
        title: tt("designation_change", { from: ev.detail.from || "—", to: ev.detail.to || "—" }),
        detail: by ?? undefined,
        state: "done",
      };
    case "rating_given": {
      const r = ev.detail;
      return {
        ...base,
        icon: Star,
        title: tt("rated", { name: emp.worker.full_name }),
        detail: (
          <span className="block space-y-1">
            <ScorePair rating={{ rater: "employer", score_a: r.score_a, score_b: r.score_b }} />
            {r.comment ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-fg-body">“{r.comment}”</span>
                <CommentStatusBadge rating={r} />
              </span>
            ) : null}
            {r.voided ? <span className="block">{tt("rating_voided")}</span> : null}
            {by}
          </span>
        ),
        state: "done",
      };
    }
    case "contract_issued":
      return {
        ...base,
        icon: FileText,
        title: tt("letter_issued", { version: f.digits(ev.detail.version) }),
        detail: line(
          ev.detail.monthly_gross
            ? tt("letter_gross", { gross: f.money(ev.detail.monthly_gross) })
            : null,
          by,
          <a
            key="pdf"
            className="text-brand-text font-medium hover:underline"
            href={proxyHref(`/org/employments/${emp.id}/contract.pdf`, {
              version: ev.detail.version,
            })}
            target="_blank"
            rel="noreferrer"
          >
            {tt("pdf", { version: f.digits(ev.detail.version) })}
          </a>,
        ),
        state: "done",
      };
    case "contract_accepted":
      return {
        ...base,
        icon: FileCheck2,
        title: tt("letter_accepted", { version: f.digits(ev.detail.version) }),
        detail: tc("accepted_via", { channel: tc(`channel_${ev.detail.channel ?? "app"}`) }),
        state: "done",
      };
    case "dispute_opened": {
      const open = ev.detail.status === "open" || ev.detail.status === "employer_responded";
      return {
        ...base,
        icon: AlertTriangle,
        title: tt("dispute", { kind: ev.detail.kind_label }),
        detail: (
          <>
            <span className="line-clamp-2">
              {tt("dispute_hint", {
                status: ev.detail.status_label,
                description: ev.detail.description,
              })}
            </span>
            <Link href="/app/disputes" className="text-brand-text font-medium hover:underline">
              {tt("open_dispute")}
            </Link>
          </>
        ),
        state: open ? "attention" : "done",
      };
    }
    case "dispute_resolved":
      return {
        ...base,
        icon: AlertTriangle,
        title: ev.detail.appeal
          ? tt("appeal_decided", { kind: ev.detail.kind_label })
          : tt("dispute_decided", { kind: ev.detail.kind_label }),
        detail: ev.detail.note ? <span className="line-clamp-2">{ev.detail.note}</span> : undefined,
        state: "done",
      };
    case "advance_given":
      return {
        ...base,
        icon: HandCoins,
        title: tt("advance", { amount: f.money(ev.detail.amount) }),
        detail: line(
          tt("advance_hint", {
            per: f.money(ev.detail.recover_per_month),
            recovered: f.money(ev.detail.recovered_amount),
          }),
          ev.detail.note ? <span key="note">{ev.detail.note}</span> : null,
          by,
        ),
        state: "done",
      };
  }
}

const CELL: Record<Exclude<RegisterCell, null>, { tone: string; code: string; term: string }> = {
  P: { tone: "bg-success-soft text-success", code: "P", term: "term.present" },
  H: { tone: "bg-warning-soft text-warning", code: "½", term: "term.half_day" },
  A: { tone: "bg-danger-soft text-danger", code: "A", term: "term.absent" },
  L: { tone: "bg-info-soft text-info", code: "L", term: "term.on_leave" },
  PH: { tone: "bg-surface-muted text-fg-muted", code: "PH", term: "term.public_holiday" },
  WO: { tone: "bg-surface-muted text-fg-muted", code: "–", term: "term.weekly_off" },
};

/**
 * This month's hajiri inside the timeline's "today" entry: totals as words (the accessible
 * summary) and a day-by-day strip of register codes (decorative repeat; full detail in the register).
 */
function HajiriThisMonth({
  register,
  row,
  loading,
  error,
  onRetry,
  monthLabel,
  today,
  startDate,
}: {
  register: AttendanceRegister | undefined;
  row: AttendanceRegister["rows"][number] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  monthLabel: string;
  today: string;
  /** Days before the worker joined are blank, not "not marked". */
  startDate: string;
}) {
  const t = useTranslations();
  const tt = useTranslations("ledger.timeline");
  const f = useFormat();
  if (loading) return <Skeleton className="mt-2 h-14 w-full max-w-xl" />;
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-4" />;
  if (!row || !register) return <p className="mt-1">{tt("hajiri_none")}</p>;
  const totals = [
    { label: t("term.present"), value: f.number(row.totals.present), tone: "text-success" },
    { label: t("term.half_day"), value: f.number(row.totals.half_day), tone: "text-warning" },
    { label: t("term.absent"), value: f.number(row.totals.absent), tone: "text-danger" },
    { label: t("term.on_leave"), value: f.number(row.totals.leave), tone: "text-info" },
    {
      label: t("term.overtime"),
      value: t("term.hours_count", { count: row.totals.overtime_hours }),
      tone: "text-fg",
    },
  ];
  return (
    <div className="mt-2 space-y-3">
      <dl
        className="flex flex-wrap gap-x-6 gap-y-2"
        aria-label={tt("hajiri_month", { month: monthLabel })}
      >
        {totals.map((it) => (
          <div key={it.label} className="min-w-0">
            <dt className="text-fg-muted text-xs">{it.label}</dt>
            <dd className={cn("tabular text-xl leading-7 font-semibold", it.tone)}>{it.value}</dd>
          </div>
        ))}
      </dl>
      <div className="@container">
        <ol
          aria-hidden
          title={tt("hajiri_strip", { month: monthLabel })}
          className="grid max-w-[680px] grid-cols-[repeat(11,minmax(0,1fr))] gap-0.5 @sm:grid-cols-[repeat(16,minmax(0,1fr))] @lg:grid-cols-[repeat(var(--days),minmax(0,1fr))]"
          style={{ "--days": register.days.length } as React.CSSProperties}
        >
          {register.days.map((d) => {
            const c = row.cells[d.date];
            const future = d.date > today;
            const before = d.date < startDate;
            const spec = c ? CELL[c] : null;
            return (
              <li
                key={d.date}
                title={
                  before
                    ? f.digits(d.bs_day)
                    : `${f.digits(d.bs_day)} · ${spec ? t(spec.term) : tt("not_marked")}`
                }
                className={cn(
                  "flex h-7 min-w-0 flex-col items-center justify-center rounded-sm text-[10px] leading-none font-semibold",
                  spec
                    ? spec.tone
                    : before
                      ? "text-fg-muted"
                      : future
                        ? "text-fg-muted border-border border border-dashed"
                        : "text-fg-muted border-border-strong border border-dashed",
                  d.date === today && "ring-brand ring-offset-surface ring-2 ring-offset-1",
                )}
              >
                <span className="text-[9px] font-medium">{f.digits(d.bs_day)}</span>
                <span>{spec ? spec.code : ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ facts column

function FactsSection({
  title,
  action,
  children,
  id,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className="text-fg text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label/value rows: label left, value right — a ledger, not a card grid. */
function FactRows({ items }: { items: { label: React.ReactNode; value: React.ReactNode }[] }) {
  return (
    <dl className="space-y-2 text-sm">
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4">
          <dt className="text-fg-muted shrink-0">{it.label}</dt>
          <dd className="text-fg min-w-0 text-right break-words">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function PayFacts({ emp, onEdit }: { emp: Employment; onEdit?: () => void }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const monthly = emp.wage_type === "monthly";
  return (
    <FactsSection
      id="facts-pay"
      title={td("wage_card")}
      action={
        onEdit ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden />
            {t("common.edit")}
          </Button>
        ) : null
      }
    >
      <p className="text-fg-muted text-xs">{td("monthly_gross")}</p>
      <Money value={emp.monthly_gross} className="text-fg mb-3 block text-2xl font-semibold" />
      <FactRows
        items={[
          { label: t("term.wage_type"), value: t(`term.${emp.wage_type}`) },
          ...(monthly
            ? [
                { label: t("term.basic_salary"), value: <Money value={emp.basic_salary} /> },
                {
                  label: t("term.dearness_allowance"),
                  value: <Money value={emp.dearness_allowance} />,
                },
              ]
            : emp.wage_type === "hourly"
              ? [
                  {
                    label: t("wage_hourly.hourly_wage"),
                    value: <Money value={emp.hourly_wage ?? null} />,
                  },
                  {
                    label: t("wage_hourly.part_time"),
                    value: emp.part_time ? t("common.yes") : t("common.no"),
                  },
                ]
              : [{ label: t("term.daily_wage"), value: <Money value={emp.daily_wage} /> }]),
          { label: td("other_allowance"), value: <Money value={emp.other_allowance} /> },
          {
            label: t("term.ssf"),
            value: emp.ssf_enrolled ? (
              <Badge tone="success">{td("ssf_enrolled")}</Badge>
            ) : (
              <Badge tone="neutral">{td("ssf_not_enrolled")}</Badge>
            ),
          },
          { label: td("payment_method"), value: <PaymentMethodValue emp={emp} /> },
        ]}
      />
    </FactsSection>
  );
}

/** Payment method comes from the worker's payslip in the latest payroll run (the employer's record). */
function PaymentMethodValue({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const f = useFormat();
  const runs = usePayrollRuns();
  const latest = React.useMemo(() => {
    const list = listResults(runs.data);
    return [...list].sort((a, b) => b.bs_year - a.bs_year || b.bs_month - a.bs_month)[0];
  }, [runs.data]);
  const slips = usePayslips(latest?.id, emp.worker.full_name);
  if (runs.isLoading || (latest && slips.isLoading))
    return <Skeleton className="ml-auto h-4 w-20" />;
  // The API sends `employment_id` (types still say `employment`); accept either.
  const slip = (slips.data ?? []).find(
    (s) => ((s as { employment_id?: string }).employment_id ?? s.employment) === emp.id,
  );
  if (!slip || !latest) return <span className="text-fg-muted text-xs">{td("payment_none")}</span>;
  return (
    <span>
      <span className="block">{t(`pay.${slip.payment_method}`)}</span>
      <span className="text-fg-muted block text-xs">
        {td("payment_from", { month: f.bsMonth(latest.bs_year, latest.bs_month) })}
      </span>
    </span>
  );
}

function supervisorName(s: Employment["supervisor"]): string | null {
  if (!s) return null;
  return typeof s === "string" ? null : s.full_name;
}

function EmploymentFacts({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const f = useFormat();
  return (
    <FactsSection id="facts-employment" title={td("employment_card")}>
      <FactRows
        items={[
          { label: t("term.designation"), value: emp.designation || "—" },
          { label: t("term.trade"), value: emp.trade ? f.name(emp.trade) : "—" },
          { label: t("term.site"), value: emp.site?.name ?? "—" },
          { label: t("term.supervisor"), value: supervisorName(emp.supervisor) ?? "—" },
          {
            label: t("term.start_date"),
            value: <DateText ad={emp.start_date} bs={emp.start_date_bs} />,
          },
          ...(emp.end_date
            ? [
                {
                  label: t("term.end_date"),
                  value: <DateText ad={emp.end_date} bs={emp.end_date_bs} />,
                },
                {
                  label: td("end_reason"),
                  value: emp.end_reason ? t(`end_reason.${emp.end_reason}`) : "—",
                },
              ]
            : []),
          { label: t("term.employee_code"), value: emp.employee_code || "—" },
        ]}
      />
    </FactsSection>
  );
}

function WorkerFacts({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const f = useFormat();
  const w = emp.worker;
  return (
    <FactsSection id="facts-worker" title={td("worker_card")}>
      <div className="mb-3">
        <SkillChips skills={w.skills} max={5} />
      </div>
      <FactRows
        items={[
          {
            label: t("term.experience"),
            value: t("term.years", { count: w.total_experience_years ?? 0 }),
          },
          {
            label: t("term.rating"),
            value: <RatingStars value={w.rating_avg} className="text-sm" />,
          },
          { label: t("term.placements"), value: f.digits(w.placements_count ?? 0) },
          { label: t("term.phone"), value: <span className="tabular">{w.phone_masked}</span> },
        ]}
      />
    </FactsSection>
  );
}

/** Certificates with an expiry on file (from the org's expiring-credentials feed, 365 days). */
function CredentialFacts({ emp }: { emp: Employment }) {
  const tc = useTranslations("ledger.credential");
  const tr = useTranslations("credentials.review");
  const f = useFormat();
  const q = useExpiringCredentials(365);
  const mine = listResults(q.data).filter((c) => c.worker.id === emp.worker.id);
  return (
    <FactsSection id="facts-credentials" title={tc("title")}>
      {q.isLoading ? (
        <Skeleton className="h-16" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-4" />
      ) : mine.length === 0 ? (
        <p className="text-fg-muted text-sm">{tc("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {mine.map((c) => (
            <CredentialCard
              key={c.id}
              as="li"
              title={c.title}
              issuer={c.level ? tc("issuer_level", { issuer: c.issuer, level: c.level }) : c.issuer}
              status={{
                tone: c.status === "verified" ? "verified" : CREDENTIAL_TONE[c.status],
                label: c.status_label,
              }}
              expiry={
                <span
                  className={
                    c.days_to_expiry < 0
                      ? "text-danger font-medium"
                      : c.days_to_expiry <= 30
                        ? "text-warning font-medium"
                        : "text-fg-muted"
                  }
                >
                  {c.days_to_expiry < 0
                    ? tr("expired_ago", { days: Math.abs(c.days_to_expiry) })
                    : tc("expires", {
                        date: c.expires_on_bs ? f.bs(c.expires_on_bs) : f.ad(c.expires_on),
                      })}
                </span>
              }
            />
          ))}
        </ul>
      )}
    </FactsSection>
  );
}

function AdvanceFacts({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const ta = useTranslations("workforce.advances");
  const { data, isLoading, isError, error, refetch } = useAdvances({ employment: emp.id });
  const advances = listResults(data);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Advance | null>(null);
  const totalOutstanding = advances.reduce((s, a) => s + outstandingOf(a), 0);
  return (
    <FactsSection
      id="facts-advances"
      title={t("nav.advance")}
      action={
        emp.status === "active" ? (
          <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
            <HandCoins aria-hidden />
            {ta("create")}
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} className="py-4" />
      ) : advances.length === 0 ? (
        <p className="text-fg-muted text-sm">{ta("empty_worker")}</p>
      ) : (
        <>
          <p className="text-fg-muted mb-2 flex items-baseline justify-between gap-2 text-sm">
            {td("advance_outstanding_total")}
            <Money value={totalOutstanding} className="text-fg font-semibold" />
          </p>
          <ul className="divide-border border-border divide-y border-t">
            {advances.map((a) => (
              <AdvanceRow key={a.id} advance={a} onEdit={() => setEditing(a)} />
            ))}
          </ul>
        </>
      )}
      <CreateAdvanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employmentId={emp.id}
        workerName={emp.worker.full_name}
      />
      <EditAdvanceDialog
        advance={editing}
        workerName={emp.worker.full_name}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </FactsSection>
  );
}

export function RecoveryBar({ advance }: { advance: Advance }) {
  const ta = useTranslations("workforce.advances");
  const f = useFormat();
  const amount = parseAmount(advance.amount) ?? 0;
  const recovered = parseAmount(advance.recovered_amount) ?? 0;
  const pct = amount > 0 ? Math.min(100, Math.round((recovered / amount) * 100)) : 0;
  return (
    <div className="w-full min-w-28">
      <div
        className="bg-surface-hover h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={ta("recovered_pct", { pct: f.digits(pct) })}
      >
        <div className="bg-success h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-fg-muted tabular mt-1 text-xs">
        {ta("recovered_pct", { pct: f.digits(pct) })}
      </p>
    </div>
  );
}

/** Narrow-column advance row: amount + date, recovery bar, outstanding + edit. */
function AdvanceRow({ advance, onEdit }: { advance: Advance; onEdit: () => void }) {
  const t = useTranslations();
  const ta = useTranslations("workforce.advances");
  const outstanding = outstandingOf(advance);
  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Money value={advance.amount} className="text-fg font-semibold" />
            <DateText
              ad={advance.given_on}
              bs={advance.given_on_bs}
              inline
              className="text-fg-muted text-xs"
            />
          </p>
          <p className="text-fg-muted text-xs">
            {ta("per_month_label")} <Money value={advance.recover_per_month} />
            {advance.note ? ` · ${advance.note}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("common.edit")}>
          <Pencil aria-hidden />
        </Button>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <RecoveryBar advance={advance} />
        </div>
        <span className="text-right text-sm">
          <span className="text-fg-muted block text-xs">{ta("outstanding")}</span>
          <Money
            value={outstanding}
            className={outstanding > 0 ? "text-fg font-semibold" : "text-success"}
          />
        </span>
      </div>
    </li>
  );
}
