"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardCheck, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker, DateText } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableContainer, TBody, Td, Th, THead, Tr, RowHeader } from "@/components/ui/table";
import { TradeSelect } from "@/components/shared/selects";
import { useCreateAssessment, useOpsAssessments } from "@/lib/api/hooks/credentials";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { OpsWorker, Paginated } from "@/lib/api/types";
import { isApiError } from "@/lib/api/errors";
import type { AssessmentResult } from "@/lib/api/types-credentials";
import { todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/** Ops: list + record practical skill assessments. */
export function AssessmentsPanel() {
  const t = useTranslations("credentials.assessments");
  const tr = useTranslations("credentials.result");
  const tc = useTranslations("common");
  const f = useFormat();
  const [result, setResult] = React.useState<AssessmentResult | "all">("all");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setPage(1), [result]);
  const query = useOpsAssessments({
    result: result === "all" ? undefined : result,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-fg-muted text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            label={t("filter_result")}
            value={result}
            onChange={setResult}
            options={[
              { value: "all", label: tc("all") },
              { value: "pass", label: tr("pass") },
              { value: "fail", label: tr("fail") },
            ]}
          />
          <Button onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {t("record")}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t("empty_title")}
          description={t("empty_body")}
          action={<Button onClick={() => setOpen(true)}>{t("record")}</Button>}
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("worker")}</Th>
                  <Th>{t("trade")}</Th>
                  <Th>{t("result")}</Th>
                  <Th numeric>{t("score")}</Th>
                  <Th>{t("level")}</Th>
                  <Th>{t("assessed_on")}</Th>
                  <Th>{t("assessor")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((a) => (
                  <Tr key={a.id}>
                    <RowHeader>
                      <Link href={`/ops/workers/${a.worker.id}`} className="hover:underline">
                        {a.worker.full_name}
                      </Link>
                    </RowHeader>
                    <Td>{f.name(a.trade)}</Td>
                    <Td>
                      <Badge tone={a.result === "pass" ? "success" : "danger"} dot>
                        {a.result_label || tr(a.result)}
                      </Badge>
                    </Td>
                    <Td numeric>{a.score !== null ? f.digits(a.score) : "—"}</Td>
                    <Td>{a.level || "—"}</Td>
                    <Td>
                      <DateText ad={a.assessed_on} bs={a.assessed_on_bs} inline />
                    </Td>
                    <Td className="text-fg-muted">
                      {a.assessor_partner?.name ?? a.assessor_user?.full_name ?? "—"}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={query.data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
      <AssessmentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Record an assessment; optionally pre-filled with a worker (ops worker page). */
export function AssessmentDialog({
  open,
  onOpenChange,
  worker,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  worker?: { id: string; full_name: string; trade?: string | null };
}) {
  const t = useTranslations("credentials.assessments");
  const tr = useTranslations("credentials.result");
  const tc = useTranslations("common");
  const create = useCreateAssessment();
  const [picked, setPicked] = React.useState<{ id: string; full_name: string } | null>(
    worker ?? null,
  );
  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState(worker?.trade ?? "");
  const [date, setDate] = React.useState(todayIso());
  const [result, setResult] = React.useState<AssessmentResult>("pass");
  const [score, setScore] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const search = open && !picked && q.trim().length >= 2;
  const workers = useQuery({
    queryKey: ["ops", "workers", "list", { q, page_size: 6 }],
    queryFn: () => api.get<Paginated<OpsWorker>>("/ops/workers", { q, page_size: 6 }),
    enabled: search,
  });

  React.useEffect(() => {
    if (!open) return;
    setPicked(worker ?? null);
    setTrade(worker?.trade ?? "");
    setQ("");
    setDate(todayIso());
    setResult("pass");
    setScore("");
    setLevel("");
    setNotes("");
    setErrors({});
    setFormError(null);
  }, [open, worker]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!picked) errs.worker = t("worker_required");
    if (!trade) errs.trade = t("trade_required");
    const scoreNum = score.trim() === "" ? null : Number(score);
    if (scoreNum !== null && (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > 100)) {
      errs.score = t("score_invalid");
    }
    setErrors(errs);
    if (Object.keys(errs).length || !picked) return;
    setFormError(null);
    create.mutate(
      {
        worker_id: picked.id,
        trade,
        assessed_on: date,
        result,
        score: scoreNum,
        level: level.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err)) {
            const fe: Record<string, string> = {};
            for (const [k, v] of Object.entries(err.fields ?? {}))
              fe[k === "worker_id" ? "worker" : k] = v[0];
            setErrors(fe);
            setFormError(err.message);
          } else setFormError(String(err));
        },
      },
    );
  };

  const options = search ? (workers.data?.results ?? []) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={tc("close")}>
        <DialogHeader title={t("record")} description={t("subtitle")} />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <div className="flex flex-col gap-1.5">
              <span className="text-fg text-sm font-medium">{t("worker")}</span>
              {picked ? (
                <div className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-fg flex items-center gap-2 text-sm font-medium">
                    <Avatar name={picked.full_name} size="sm" />
                    {picked.full_name}
                  </span>
                  {!worker ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                      {t("change_worker")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <SearchInput
                    value={q}
                    onChange={setQ}
                    placeholder={t("worker_search")}
                    delay={250}
                  />
                  {options.length ? (
                    <ul className="divide-border border-border divide-y rounded-md border">
                      {options.map((w) => (
                        <li key={w.id}>
                          <button
                            type="button"
                            className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                            onClick={() => {
                              setPicked({ id: w.id, full_name: w.full_name });
                              const first = w.skills?.[0];
                              if (!trade && first)
                                setTrade(
                                  typeof first.trade === "string" ? first.trade : first.trade.code,
                                );
                            }}
                          >
                            <Avatar name={w.full_name} src={w.photo} size="sm" />
                            <span className="min-w-0 flex-1 truncate">{w.full_name}</span>
                            <span className="text-fg-muted tabular text-xs">{w.phone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
              {errors.worker ? (
                <p role="alert" className="text-danger text-xs font-medium">
                  {errors.worker}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="as-trade" label={t("trade")} error={errors.trade}>
                <TradeSelect value={trade} onChange={setTrade} />
              </Field>
              <Field id="as-date" label={t("assessed_on")} error={errors.assessed_on}>
                <BsDatePicker value={date} onChange={setDate} max={todayIso()} />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-fg text-sm font-medium">{t("result")}</span>
              <Segmented
                label={t("result")}
                value={result}
                onChange={setResult}
                className={cn("self-start")}
                options={[
                  { value: "pass", label: tr("pass") },
                  { value: "fail", label: tr("fail") },
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="as-score" label={t("score")} hint={t("score_hint")} error={errors.score}>
                <Input
                  inputMode="numeric"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </Field>
              <Field
                id="as-level"
                label={t("level")}
                error={errors.level}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder={t("level_placeholder")}
                />
              </Field>
            </div>
            <Field id="as-notes" label={t("notes")} optional optionalLabel={tc("optional")}>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
