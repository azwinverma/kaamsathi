"use client";
import * as React from "react";
import Link from "next/link";
import { CalendarDays, HardHat, Pencil, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { BsMonthPicker, Money } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { EmploymentPicker } from "@/components/workforce/employment-picker";
import { listResults } from "@/lib/api/client";
import {
  useAssignToContractor,
  useContractor,
  useContractorSummary,
  useUnassignFromContractor,
} from "@/lib/api/hooks/compliance";
import { useEmployments } from "@/lib/api/hooks/workforce";
import { isApiError } from "@/lib/api/errors";
import type { Employment } from "@/lib/api/types";
import { todayBs } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { ComplianceGate } from "./compliance-page";
import { ContractorDialog } from "./contractors-page";

export function ContractorDetailPage({ id }: { id: string }) {
  return (
    <ComplianceGate>
      <ContractorDetail id={id} />
    </ComplianceGate>
  );
}

function ContractorDetail({ id }: { id: string }) {
  const t = useTranslations("compliance.contractors");
  const tAll = useTranslations();
  const f = useFormat();
  const { data: c, isLoading, error, refetch } = useContractor(id);
  const [editOpen, setEditOpen] = React.useState(false);
  const back = { href: "/app/contractors", label: t("title") };

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (error || !c) {
    const notFound = isApiError(error) && error.status === 404;
    return (
      <div>
        <PageHeader title={t("title")} back={back} />
        <ErrorState
          error={error}
          title={notFound ? tAll("errors.not_found") : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        back={back}
        title={c.name}
        meta={
          <Badge tone={c.is_active ? "success" : "neutral"} dot>
            {c.is_active ? t("active") : t("inactive")}
          </Badge>
        }
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            {t("edit")}
          </Button>
        }
      />
      <Card>
        <CardBody className="pt-5">
          <DescriptionList
            columns={3}
            items={[
              {
                label: tAll("term.phone"),
                value: <span className="tabular">{f.phone(c.phone)}</span>,
              },
              { label: tAll("term.pan"), value: c.pan_no || "—" },
              { label: t("lead"), value: c.lead_worker?.full_name ?? "—" },
              {
                label: t("trades"),
                full: true,
                value: c.trades.length ? (
                  <span className="flex flex-wrap gap-1">
                    {c.trades.map((tr) => (
                      <Badge key={tr.code} tone="outline">
                        {f.name(tr)}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                ),
              },
            ]}
          />
        </CardBody>
      </Card>
      <SummarySection contractorId={c.id} />
      <WorkersSection contractorId={c.id} />
      <ContractorDialog contractor={c} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function SummarySection({ contractorId }: { contractorId: string }) {
  const t = useTranslations("compliance.contractors");
  const tTerm = useTranslations("term");
  const f = useFormat();
  const now = React.useMemo(() => todayBs(), []);
  const [month, setMonth] = React.useState({ year: now.year, month: now.month });
  const { data, isLoading, error, refetch } = useContractorSummary(
    contractorId,
    month.year,
    month.month,
  );
  return (
    <section aria-labelledby="contractor-summary" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="contractor-summary" className="text-fg text-lg font-semibold">
          {t("summary_title")}
        </h2>
        <BsMonthPicker
          value={month}
          onChange={setMonth}
          max={{ year: now.year, month: now.month }}
        />
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t("headcount")} value={f.number(data.headcount)} icon={Users} />
            <StatCard label={t("days_worked")} value={f.number(data.days)} icon={CalendarDays} />
            <StatCard
              label={t("wages")}
              value={data.wages ? f.money(data.wages.gross) : "—"}
              icon={Wallet}
              tone="brand"
              hint={
                data.wages
                  ? t("wages_hint", {
                      net: f.money(data.wages.net),
                      cost: f.money(data.wages.employer_cost),
                    })
                  : t("no_payroll")
              }
            />
          </div>
          {data.workers.length ? (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <Th>{t("col_worker")}</Th>
                    <Th>{tTerm("designation")}</Th>
                    <Th numeric>{t("col_days")}</Th>
                    <Th numeric>{t("col_gross")}</Th>
                    <Th numeric>{t("col_net")}</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.workers.map((w) => (
                    <Tr key={w.employment_id}>
                      <RowHeader>
                        <Link href={`/app/workers/${w.employment_id}`} className="hover:underline">
                          {w.worker_name}
                        </Link>
                      </RowHeader>
                      <Td>{w.designation || "—"}</Td>
                      <Td numeric>{f.number(w.days)}</Td>
                      <Td numeric>{w.gross_pay ? <Money value={w.gross_pay} /> : "—"}</Td>
                      <Td numeric>{w.net_pay ? <Money value={w.net_pay} /> : "—"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          ) : null}
        </>
      )}
    </section>
  );
}

function WorkersSection({ contractorId }: { contractorId: string }) {
  const t = useTranslations("compliance.contractors");
  const tAll = useTranslations();
  const { data, isLoading, error, refetch } = useEmployments({
    contractor: contractorId,
    status: "active",
    page_size: 100,
  });
  const rows = listResults<Employment>(data);
  const unassign = useUnassignFromContractor();
  const [assignOpen, setAssignOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader
        title={t("workers_title")}
        description={t("workers_body")}
        action={
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus aria-hidden />
            {t("assign")}
          </Button>
        }
      />
      <CardBody>
        {isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={HardHat} title={t("no_workers")} className="py-8" />
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/app/workers/${e.id}`}
                    className="text-fg truncate text-sm font-medium hover:underline"
                  >
                    {e.worker.full_name}
                  </Link>
                  <p className="text-fg-muted truncate text-xs">
                    {[e.designation, e.site?.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    unassign.mutate(
                      { id: contractorId, employment_ids: [e.id] },
                      {
                        onSuccess: () => toast.success(t("unassigned_toast")),
                        onError: (err) => toastError(err, tAll),
                      },
                    )
                  }
                  loading={unassign.isPending && unassign.variables?.employment_ids[0] === e.id}
                >
                  <UserMinus aria-hidden />
                  {t("unassign")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <AssignDialog contractorId={contractorId} open={assignOpen} onOpenChange={setAssignOpen} />
    </Card>
  );
}

function AssignDialog({
  contractorId,
  open,
  onOpenChange,
}: {
  contractorId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("compliance.contractors");
  const tAll = useTranslations();
  const assign = useAssignToContractor();
  const [picked, setPicked] = React.useState<{ id: string; name: string }[]>([]);
  const [current, setCurrent] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setPicked([]);
      setCurrent("");
    }
  }, [open]);
  const save = () =>
    assign.mutate(
      { id: contractorId, employment_ids: picked.map((p) => p.id) },
      {
        onSuccess: () => {
          toast.success(t("assigned_toast", { count: picked.length }));
          onOpenChange(false);
        },
        onError: (e) => toastError(e, tAll),
      },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tAll("common.close")}>
        <DialogHeader title={t("assign_title")} description={t("assign_body")} />
        <DialogBody className="space-y-3">
          <Field id="assign-worker" label={t("col_worker")}>
            <EmploymentPicker
              value={current}
              onChange={(id, emp) => {
                if (id && emp && !picked.some((p) => p.id === id)) {
                  setPicked([...picked, { id, name: emp.worker.full_name }]);
                }
                setCurrent("");
              }}
            />
          </Field>
          {picked.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="border-border hover:bg-surface-hover rounded-full border px-2.5 py-1 text-xs"
                    onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}
                  >
                    {p.name} ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tAll("common.cancel")}
          </Button>
          <Button onClick={save} disabled={!picked.length} loading={assign.isPending}>
            {t("assign_confirm", { count: picked.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
