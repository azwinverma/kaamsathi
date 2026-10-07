"use client";
import * as React from "react";
import { Check, Plus, X, CalendarOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker, DateText } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listResults } from "@/lib/api/client";
import { useCreateLeave, useDecideLeave, useLeaves } from "@/lib/api/hooks/workforce";
import { isApiError } from "@/lib/api/errors";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/lib/api/types";
import { todayIso } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { EmploymentPicker } from "./employment-picker";
import { designationOf, workerNameOf } from "./utils";

const PAGE_SIZE = 25;
type Tab = LeaveStatus | "all";
const TABS: Tab[] = ["pending", "approved", "rejected", "all"];
const LEAVE_TYPES: LeaveType[] = ["home", "sick", "maternity", "paternity", "mourning", "unpaid"];

/** Inclusive day count between two AD ISO dates. */
function dayCount(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function LeavePage() {
  const t = useTranslations();
  const tl = useTranslations("workforce.leave");
  const f = useFormat();
  const [tab, setTab] = React.useState<Tab>("pending");
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState<LeaveRequest | null>(null);
  const decide = useDecideLeave();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => setPage(1), [tab]);

  const { data, isLoading, isError, error, refetch, isFetching } = useLeaves({
    status: tab === "all" ? undefined : tab,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = listResults(data);
  const count = data && !Array.isArray(data) ? data.count : rows.length;

  const approve = (lr: LeaveRequest) => {
    setBusyId(lr.id);
    decide.mutate(
      { id: lr.id, decision: "approve" },
      {
        onSuccess: () => toast.success(tl("approved_toast", { name: workerNameOf(lr) })),
        onError: (err) => toastError(err, t),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t("nav.leave")}
        description={tl("description")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden />
            {tl("create")}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          {TABS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s === "all" ? t("common.all") : t(`status.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <TableSkeleton cols={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title={tab === "pending" ? tl("empty_pending") : tl("empty")}
          action={
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {tl("create")}
            </Button>
          }
        />
      ) : (
        <>
          <TableContainer className={isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table className="min-w-[820px]">
              <THead>
                <Tr>
                  <Th sticky>{tl("col_worker")}</Th>
                  <Th>{tl("col_type")}</Th>
                  <Th>{tl("col_from")}</Th>
                  <Th>{tl("col_to")}</Th>
                  <Th numeric>{tl("col_days")}</Th>
                  <Th>{tl("col_reason")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th className="text-right">{t("common.actions")}</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((lr) => {
                  const name = workerNameOf(lr) || "—";
                  return (
                    <Tr key={lr.id}>
                      <RowHeader sticky>
                        <span className="block">{name}</span>
                        {designationOf(lr) ? (
                          <span className="block text-xs font-normal text-fg-muted">{designationOf(lr)}</span>
                        ) : null}
                      </RowHeader>
                      <Td>{lr.leave_type_label ?? t(`leave_type.${lr.leave_type}`)}</Td>
                      <Td>
                        <DateText ad={lr.from_date} bs={lr.from_date_bs} />
                      </Td>
                      <Td>
                        <DateText ad={lr.to_date} bs={lr.to_date_bs} />
                      </Td>
                      <Td numeric>{f.number(lr.days)}</Td>
                      <Td className="max-w-56">
                        <span className="line-clamp-2 text-fg-muted">{lr.reason || "—"}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={lr.status} label={lr.status_label} />
                      </Td>
                      <Td className="text-right">
                        {lr.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => approve(lr)}
                              loading={busyId === lr.id}
                              aria-label={tl("approve_for", { name })}
                            >
                              <Check aria-hidden />
                              {tl("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger-outline"
                              onClick={() => setRejecting(lr)}
                              disabled={busyId === lr.id}
                              aria-label={tl("reject_for", { name })}
                            >
                              <X aria-hidden />
                              {tl("reject")}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-fg-muted">
                            {lr.decided_at ? f.dateTime(lr.decided_at) : "—"}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </>
      )}

      <CreateLeaveDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RejectDialog leave={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}

function RejectDialog({ leave, onClose }: { leave: LeaveRequest | null; onClose: () => void }) {
  const t = useTranslations();
  const tl = useTranslations("workforce.leave");
  const decide = useDecideLeave();
  const [note, setNote] = React.useState("");
  React.useEffect(() => setNote(""), [leave]);
  if (!leave) return null;
  const name = workerNameOf(leave);
  const submit = () =>
    decide.mutate(
      { id: leave.id, decision: "reject", note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(tl("rejected_toast", { name }));
          onClose();
        },
        onError: (err) => toastError(err, t),
      },
    );
  return (
    <Dialog open={!!leave} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <DialogHeader title={tl("reject_title")} description={name} />
        <DialogBody>
          <Field id="reject-note" label={tl("reject_note")} optional optionalLabel={t("common.optional")}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={decide.isPending}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={submit} loading={decide.isPending}>
            {tl("reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type LeaveErrors = Partial<Record<"employment" | "leave_type" | "from_date" | "to_date" | "reason", string>>;

function CreateLeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const tl = useTranslations("workforce.leave");
  const f = useFormat();
  const create = useCreateLeave();
  const [employment, setEmployment] = React.useState("");
  const [leaveType, setLeaveType] = React.useState<LeaveType | "">("");
  const [from, setFrom] = React.useState(todayIso());
  const [to, setTo] = React.useState(todayIso());
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<LeaveErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setEmployment("");
      setLeaveType("");
      setFrom(todayIso());
      setTo(todayIso());
      setReason("");
      setErrors({});
      setFormError(null);
    }
  }, [open]);

  const days = dayCount(from, to);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: LeaveErrors = {};
    if (!employment) next.employment = t("errors.required");
    if (!leaveType) next.leave_type = t("errors.required");
    if (!from) next.from_date = t("errors.required");
    if (!to) next.to_date = t("errors.required");
    else if (from && to < from) next.to_date = tl("to_before_from");
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setFormError(null);
    create.mutate(
      { employment, leave_type: leaveType as LeaveType, from_date: from, to_date: to, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(tl("created"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err)) {
            setErrors({
              employment: err.fieldError("employment"),
              leave_type: err.fieldError("leave_type"),
              from_date: err.fieldError("from_date"),
              to_date: err.fieldError("to_date"),
              reason: err.fieldError("reason"),
            });
            setFormError(err.message || t(`errors.${err.code}`));
          } else setFormError(t("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={tl("create_title")} description={tl("create_description")} />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <Field id="leave-employment" label={tl("col_worker")} error={errors.employment}>
              <EmploymentPicker value={employment} onChange={(id) => setEmployment(id)} />
            </Field>
            <Field id="leave-type" label={tl("col_type")} error={errors.leave_type}>
              <NativeSelect
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                placeholder={t("common.select")}
                options={LEAVE_TYPES.map((lt) => ({ value: lt, label: t(`leave_type.${lt}`) }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="leave-from" label={tl("col_from")} error={errors.from_date}>
                <BsDatePicker
                  value={from}
                  onChange={(v) => {
                    setFrom(v);
                    if (to < v) setTo(v);
                  }}
                />
              </Field>
              <Field id="leave-to" label={tl("col_to")} error={errors.to_date}>
                <BsDatePicker value={to} onChange={setTo} min={from} />
              </Field>
            </div>
            {days > 0 ? (
              <p className="text-sm text-fg-muted" aria-live="polite">
                {tl("total_days", { count: days, n: f.digits(days) })}
              </p>
            ) : null}
            <Field id="leave-reason" label={tl("col_reason")} optional optionalLabel={t("common.optional")} error={errors.reason}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {tl("create_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
