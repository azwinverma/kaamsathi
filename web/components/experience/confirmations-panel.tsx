"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BadgeCheck, CalendarRange, History, MapPin, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Segmented } from "@/components/ui/segmented";
import { useDecideWorkHistory, useWorkHistoryConfirmations } from "@/lib/api/hooks/experience";
import type { WorkHistoryConfirmation } from "@/lib/api/types-experience";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { WorkHistoryStatusBadge } from "./badges";

const PAGE_SIZE = 20;
type Filter = "pending" | "all";

/**
 * Employer "Work history confirmations": workers who say they worked here before ask the
 * employer to confirm. Rendered as a tab of /app/candidates.
 */
export function WorkHistoryConfirmations() {
  const t = useTranslations("experience.confirm");
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [page, setPage] = React.useState(1);
  const query = useWorkHistoryConfirmations({ status: filter, page, page_size: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-muted max-w-2xl text-sm">{t("description")}</p>
        <Segmented
          label={t("filter_label")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          size="sm"
          options={[
            { value: "pending", label: t("filter_pending") },
            { value: "all", label: t("filter_all") },
          ]}
        />
      </div>
      {query.isLoading ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.results.length ? (
        <EmptyState icon={History} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.results.map((c) => (
              <li key={c.id}>
                <ConfirmationCard item={c} />
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={query.data.count}
            onPageChange={setPage}
          />
        </>
      )}
      <p className="text-fg-subtle text-xs">{t("privacy_note")}</p>
    </div>
  );
}

function ConfirmationCard({ item: c }: { item: WorkHistoryConfirmation }) {
  const t = useTranslations("experience.confirm");
  const tRoot = useTranslations();
  const f = useFormat();
  const decide = useDecideWorkHistory();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const open = c.status === "reference_pending" || c.status === "self_reported";

  const run = (decision: "confirm" | "reject") =>
    decide.mutate(
      { id: c.id, decision, note: decision === "reject" ? note.trim() : undefined },
      {
        onSuccess: () => {
          toast.success(
            t(decision === "confirm" ? "confirmed_toast" : "rejected_toast", {
              name: c.worker.full_name,
            }),
          );
          setRejectOpen(false);
        },
        onError: (e) => toastError(e, tRoot),
      },
    );

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-fg font-semibold">{c.worker.full_name}</p>
          <span className="text-fg-muted tabular text-xs">{c.worker.phone_masked}</span>
          <WorkHistoryStatusBadge status={c.status} label={c.status_label} />
        </div>
        <p className="text-fg-body text-sm">
          {t("worked_as", { role: c.role_title, employer: c.employer_name })}
        </p>
        <p className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="size-3.5" aria-hidden />
            {f.dateText(c.start_date, c.start_date_bs)} –{" "}
            {c.end_date ? f.dateText(c.end_date, c.end_date_bs) : t("present")} ·{" "}
            {t("months", { count: c.months })}
          </span>
          {c.district ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {f.name(c.district)}
            </span>
          ) : null}
          {c.trade ? <span>{f.name(c.trade)}</span> : null}
        </p>
        {c.description ? (
          <p className="text-fg-muted line-clamp-2 text-sm">{c.description}</p>
        ) : null}
      </div>
      {open ? (
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRejectOpen(true)}
            disabled={decide.isPending}
          >
            <ShieldX aria-hidden />
            {t("reject")}
          </Button>
          <Button
            size="sm"
            onClick={() => run("confirm")}
            loading={decide.isPending && !rejectOpen}
            disabled={decide.isPending}
          >
            <BadgeCheck aria-hidden />
            {t("confirm")}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t("reject_title", { name: c.worker.full_name })}
        description={t("reject_body")}
        confirmLabel={t("reject")}
        danger
        loading={decide.isPending}
        onConfirm={() => run("reject")}
      >
        <Field id={`wh-reject-${c.id}`} label={t("reject_note_label")} optional>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("reject_note_placeholder")}
          />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}
