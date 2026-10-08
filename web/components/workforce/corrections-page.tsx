"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, ClipboardCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateText } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton, errorMessage } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDecideCorrection, useOrgCorrections } from "@/lib/api/hooks/corrections";
import { isApiError } from "@/lib/api/errors";
import {
  CORRECTION_STATUSES,
  type AttendanceCorrection,
  type CorrectionStatus,
} from "@/lib/api/types-corrections";
import { useFormat } from "@/lib/use-format";

const PAGE_SIZE = 25;

/** /app/attendance/corrections — P008 worker hajiri correction requests. */
export function CorrectionsPage() {
  const t = useTranslations();
  const tc = useTranslations("corrections");
  const f = useFormat();
  const { isSupervisor } = useSession();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<CorrectionStatus>(() => {
    const s = params.get("status") as CorrectionStatus | null;
    return s && CORRECTION_STATUSES.includes(s) ? s : "pending";
  });
  const [page, setPage] = React.useState(1);
  const [deciding, setDeciding] = React.useState<{
    row: AttendanceCorrection;
    decision: "approve" | "reject";
  } | null>(null);
  React.useEffect(() => setPage(1), [tab]);

  const { data, isLoading, isError, error, refetch, isFetching } = useOrgCorrections({
    status: tab,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = data?.results ?? [];

  return (
    <div>
      <PageHeader
        title={tc("title")}
        description={isSupervisor ? tc("description_supervisor") : tc("description")}
        back={{ href: "/app/attendance", label: t("nav.attendance") }}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CorrectionStatus)} className="mb-4">
        <TabsList>
          {CORRECTION_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {tc(`tab.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={tc(`empty.${tab}`)}
          description={tab === "pending" ? tc("empty_body") : undefined}
        />
      ) : (
        <>
          <TableContainer className={isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table className="min-w-[960px]">
              <THead>
                <Tr>
                  <Th sticky>{tc("col_worker")}</Th>
                  <Th>{tc("col_date")}</Th>
                  <Th>{tc("col_change")}</Th>
                  <Th>{tc("col_times")}</Th>
                  <Th>{tc("col_reason")}</Th>
                  <Th>{tc("col_requested_at")}</Th>
                  <Th className="text-right">
                    {tab === "pending" ? t("common.actions") : tc("col_decision")}
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((c) => {
                  const name = c.worker.full_name;
                  return (
                    <Tr key={c.id}>
                      <RowHeader sticky>
                        <span className="block">{name}</span>
                        {c.designation ? (
                          <span className="text-fg-muted block text-xs font-normal">
                            {c.designation}
                          </span>
                        ) : null}
                      </RowHeader>
                      <Td>
                        <DateText ad={c.date} bs={c.date_bs} />
                      </Td>
                      <Td>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral">{c.current_status_label}</Badge>
                          <ArrowRight
                            className="text-fg-muted size-3.5"
                            aria-label={tc("changes_to")}
                          />
                          <Badge tone="brand">{c.requested_status_label}</Badge>
                        </span>
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {c.requested_check_in_at || c.requested_check_out_at ? (
                          <>
                            <span className="block">
                              {tc("check_in")}: {f.time(c.requested_check_in_at) || "—"}
                            </span>
                            <span className="block">
                              {tc("check_out")}: {f.time(c.requested_check_out_at) || "—"}
                            </span>
                          </>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </Td>
                      <Td className="max-w-64">
                        <span className="text-fg-body line-clamp-3">{c.reason || "—"}</span>
                      </Td>
                      <Td className="text-fg-muted text-xs whitespace-nowrap">
                        {f.dateTime(c.created_at)}
                      </Td>
                      <Td className="text-right">
                        {c.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setDeciding({ row: c, decision: "approve" })}
                              aria-label={tc("approve_for", { name })}
                            >
                              <Check aria-hidden />
                              {tc("approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger-outline"
                              onClick={() => setDeciding({ row: c, decision: "reject" })}
                              aria-label={tc("reject_for", { name })}
                            >
                              <X aria-hidden />
                              {tc("reject")}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1 text-xs">
                            <StatusBadge status={c.status} label={c.status_label} />
                            <span className="text-fg-muted">
                              {c.decided_by?.full_name ?? "—"}
                              {c.decided_at ? ` · ${f.dateTime(c.decided_at)}` : ""}
                            </span>
                            {c.decision_note ? (
                              <span className="text-fg-body max-w-56 text-left">
                                {c.decision_note}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}

      <DecisionDialog
        row={deciding?.row ?? null}
        decision={deciding?.decision ?? "approve"}
        onClose={() => setDeciding(null)}
      />
    </div>
  );
}

function DecisionDialog({
  row,
  decision,
  onClose,
}: {
  row: AttendanceCorrection | null;
  decision: "approve" | "reject";
  onClose: () => void;
}) {
  const t = useTranslations();
  const tc = useTranslations("corrections");
  const f = useFormat();
  const decide = useDecideCorrection();
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setNote("");
    setNoteError(null);
    setFormError(null);
  }, [row, decision]);
  if (!row) return null;
  const reject = decision === "reject";
  const name = row.worker.full_name;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (reject && !trimmed) {
      setNoteError(tc("note_required"));
      return;
    }
    setNoteError(null);
    setFormError(null);
    decide.mutate(
      { id: row.id, decision, note: trimmed || undefined },
      {
        onSuccess: () => {
          toast.success(tc(reject ? "rejected_toast" : "approved_toast", { name }));
          onClose();
        },
        onError: (err) => {
          // invalid_state = payroll for that month is locked (or already decided): show the server text.
          if (isApiError(err) && err.fields?.note?.[0]) setNoteError(err.fields.note[0]);
          else setFormError(errorMessage(err, t));
        },
      },
    );
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" closeLabel={t("common.close")}>
        <DialogHeader
          title={reject ? tc("reject_title") : tc("approve_title")}
          description={tc("dialog_summary", {
            name,
            date: f.dateText(row.date, row.date_bs),
            from: row.current_status_label,
            to: row.requested_status_label,
          })}
        />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            {!reject ? <p className="text-fg-muted text-sm">{tc("approve_hint")}</p> : null}
            <Field
              id="correction-note"
              label={reject ? tc("reject_note") : tc("approve_note")}
              error={noteError ?? undefined}
              optional={!reject}
              optionalLabel={t("common.optional")}
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={decide.isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant={reject ? "danger" : "primary"}
              loading={decide.isPending}
            >
              {reject ? tc("reject") : tc("approve")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
