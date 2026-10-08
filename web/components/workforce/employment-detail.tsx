"use client";
import * as React from "react";
import Link from "next/link";
import { CalendarCheck, HandCoins, Pencil, Star, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { StatusBadge, VerificationBadge } from "@/components/shared/status-badge";
import { RatingStars, SkillChips, WorkerIdentity } from "@/components/shared/worker-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { DateText, Money } from "@/components/ui/date";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { listResults } from "@/lib/api/client";
import { useAdvances, useAttendanceRegister, useEmployment } from "@/lib/api/hooks/workforce";
import { isApiError } from "@/lib/api/errors";
import type { Advance, Employment } from "@/lib/api/types";
import { todayBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { CreateAdvanceDialog, EditAdvanceDialog, outstandingOf } from "./advance-dialogs";
import { EditEmploymentDialog, EndEmploymentDialog, RateDialog } from "./employment-dialogs";
import { ContractPanel } from "@/components/compliance/contract-panel";
import { Notice } from "./shared";
import { parseAmount } from "./utils";

export function EmploymentDetail({ id }: { id: string }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const { canManage } = useSession();
  const { data: emp, isLoading, isError, error, refetch } = useEmployment(id);
  const [dialog, setDialog] = React.useState<"edit" | "end" | "rate" | null>(null);

  const back = { href: "/app/workers", label: t("nav.workers") };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
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
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        back={back}
        title={emp.worker.full_name}
        description={[emp.designation, emp.site?.name].filter(Boolean).join(" · ")}
        meta={
          <>
            <StatusBadge status={emp.status} />
            <VerificationBadge status={emp.worker.verification_status} />
            {emp.employee_code ? <Badge tone="outline">{emp.employee_code}</Badge> : null}
          </>
        }
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
        <Notice tone="info" title={td("replacement_title")}>
          {td.rich("replacement_body", {
            date: () => (
              <DateText ad={emp.replacement_eligible_until} inline className="font-semibold" />
            ),
          })}
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <WorkerCardPanel emp={emp} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <EmploymentPanel emp={emp} />
          {canManage ? (
            <WagePanel emp={emp} onEdit={active ? () => setDialog("edit") : undefined} />
          ) : null}
          {canManage ? <ContractPanel employmentId={emp.id} active={active} /> : null}
          <AttendancePanel emp={emp} />
          {canManage ? <AdvancesPanel emp={emp} /> : null}
        </div>
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

function WorkerCardPanel({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const f = useFormat();
  const w = emp.worker;
  const verificationText =
    w.verification_status === "verified"
      ? td("verified_body")
      : w.verification_status === "pending"
        ? td("pending_body")
        : w.verification_status === "rejected"
          ? td("rejected_body")
          : td("unverified_body");
  return (
    <Card>
      <CardHeader title={td("worker_card")} />
      <CardBody className="space-y-4">
        <WorkerIdentity worker={w} size="lg" />
        <div
          className={
            w.verification_status === "verified"
              ? "bg-success-subtle text-success rounded-md px-3 py-2 text-xs"
              : "bg-surface-muted text-fg-muted rounded-md px-3 py-2 text-xs"
          }
        >
          {verificationText}
        </div>
        <SkillChips skills={w.skills} max={5} />
        <DescriptionList
          columns={2}
          items={[
            {
              label: t("term.experience"),
              value: t("term.years", { count: w.total_experience_years ?? 0 }),
            },
            { label: t("term.rating"), value: <RatingStars value={w.rating_avg} /> },
            { label: t("term.placements"), value: f.digits(w.placements_count ?? 0) },
            { label: t("term.phone"), value: <span className="tabular">{w.phone_masked}</span> },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function supervisorName(s: Employment["supervisor"]): string | null {
  if (!s) return null;
  return typeof s === "string" ? null : s.full_name;
}

function EmploymentPanel({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const f = useFormat();
  return (
    <Card>
      <CardHeader title={td("employment_card")} />
      <CardBody>
        <DescriptionList
          columns={3}
          items={[
            { label: t("term.designation"), value: emp.designation || "—" },
            { label: t("term.trade"), value: emp.trade ? f.name(emp.trade) : "—" },
            { label: t("term.site"), value: emp.site?.name ?? "—" },
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
            { label: t("term.supervisor"), value: supervisorName(emp.supervisor) ?? "—" },
            { label: t("term.employee_code"), value: emp.employee_code || "—" },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function WagePanel({ emp, onEdit }: { emp: Employment; onEdit?: () => void }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const monthly = emp.wage_type === "monthly";
  return (
    <Card>
      <CardHeader
        title={td("wage_card")}
        action={
          onEdit ? (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil aria-hidden />
              {t("common.edit")}
            </Button>
          ) : null
        }
      />
      <CardBody>
        <DescriptionList
          columns={3}
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
              label: td("monthly_gross"),
              value: <Money value={emp.monthly_gross} className="font-semibold" />,
            },
            {
              label: t("term.ssf"),
              value: emp.ssf_enrolled ? (
                <Badge tone="success">{td("ssf_enrolled")}</Badge>
              ) : (
                <Badge tone="neutral">{td("ssf_not_enrolled")}</Badge>
              ),
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function AttendancePanel({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const f = useFormat();
  const now = React.useMemo(() => todayBs(), []);
  const { data, isLoading, isError, refetch, error } = useAttendanceRegister(
    now.year,
    now.month,
    emp.site?.id,
  );
  const row = data?.rows.find((r) => r.employment_id === emp.id);
  const items: { label: string; value: number; tone: string }[] = row
    ? [
        { label: t("term.present"), value: row.totals.present, tone: "text-success" },
        { label: t("term.half_day"), value: row.totals.half_day, tone: "text-warning" },
        { label: t("term.absent"), value: row.totals.absent, tone: "text-danger" },
        { label: t("term.on_leave"), value: row.totals.leave, tone: "text-brand-text" },
        { label: t("term.overtime"), value: row.totals.overtime_hours, tone: "text-fg" },
      ]
    : [];
  return (
    <Card>
      <CardHeader
        title={td("attendance_card")}
        description={f.bsMonth(now.year, now.month)}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/attendance">
              <CalendarCheck aria-hidden />
              {td("open_register")}
            </Link>
          </Button>
        }
      />
      <CardBody>
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} className="py-6" />
        ) : !row ? (
          <p className="text-fg-muted text-sm">{td("attendance_none")}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {items.map((it, i) => (
              <div key={i} className="border-border rounded-md border px-3 py-2">
                <dt className="text-fg-muted text-xs">{it.label}</dt>
                <dd className={`tabular text-xl font-semibold ${it.tone}`}>
                  {i === 4 ? t("term.hours_count", { count: it.value }) : f.number(it.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function AdvancesPanel({ emp }: { emp: Employment }) {
  const t = useTranslations();
  const td = useTranslations("workforce.detail");
  const ta = useTranslations("workforce.advances");
  const { data, isLoading, isError, error, refetch } = useAdvances({ employment: emp.id });
  const advances = listResults(data);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Advance | null>(null);
  const totalOutstanding = advances.reduce((s, a) => s + outstandingOf(a), 0);
  return (
    <Card>
      <CardHeader
        title={t("nav.advance")}
        action={
          emp.status === "active" ? (
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
              <HandCoins aria-hidden />
              {ta("create")}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {advances.length ? (
          <p className="text-fg-muted -mt-2 mb-3 flex items-baseline gap-2 text-sm">
            {td("advance_outstanding_total")}
            <Money value={totalOutstanding} className="text-fg font-semibold" />
          </p>
        ) : null}
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} className="py-6" />
        ) : advances.length === 0 ? (
          <EmptyState icon={HandCoins} title={ta("empty_worker")} className="py-8" />
        ) : (
          <ul className="divide-border divide-y">
            {advances.map((a) => (
              <AdvanceRow key={a.id} advance={a} onEdit={() => setEditing(a)} />
            ))}
          </ul>
        )}
      </CardBody>
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
    </Card>
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

function AdvanceRow({ advance, onEdit }: { advance: Advance; onEdit: () => void }) {
  const t = useTranslations();
  const ta = useTranslations("workforce.advances");
  const outstanding = outstandingOf(advance);
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Money value={advance.amount} className="text-fg font-semibold" />
          <span className="text-fg-muted">·</span>
          <DateText
            ad={advance.given_on}
            bs={advance.given_on_bs}
            inline
            className="text-fg-muted"
          />
        </p>
        <p className="text-fg-muted text-xs">
          {ta("per_month_label")} <Money value={advance.recover_per_month} />
          {advance.note ? ` · ${advance.note}` : ""}
        </p>
      </div>
      <div className="w-full sm:w-40">
        <RecoveryBar advance={advance} />
      </div>
      <div className="flex items-center justify-between gap-3 sm:w-44 sm:justify-end">
        <span className="text-right text-sm">
          <span className="text-fg-muted block text-xs">{ta("outstanding")}</span>
          <Money
            value={outstanding}
            className={outstanding > 0 ? "text-fg font-semibold" : "text-success"}
          />
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("common.edit")}>
          <Pencil aria-hidden />
        </Button>
      </div>
    </li>
  );
}
