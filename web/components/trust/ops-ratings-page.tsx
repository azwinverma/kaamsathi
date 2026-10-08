"use client";
/** /ops/ratings — N004 rating comment moderation (support role): hide / restore comments, void ratings. */
import * as React from "react";
import Link from "next/link";
import { Ban, Eye, EyeOff, Info, MessageSquareWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { NativeSelect } from "@/components/ui/select";
import { TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import { useModerateRating, useOpsRatings, type RatingModerationAction } from "@/lib/api/hooks/moderation";
import type { OpsRating } from "@/lib/api/types-moderation";
import { useFormat } from "@/lib/use-format";
import { CommentStatusBadge, ScorePair } from "./rating-bits";
import { RATINGS_TABS, ratingsTabParams, type RatingsTab } from "./moderation";

const PAGE_SIZE = 25;

export function OpsRatingsPage() {
  const t = useTranslations();
  const tr = useTranslations("moderation.ratings");
  const f = useFormat();
  const [tab, setTab] = React.useState<RatingsTab>("flagged");
  const [rater, setRater] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [acting, setActing] = React.useState<{ rating: OpsRating; action: RatingModerationAction } | null>(null);
  React.useEffect(() => setPage(1), [tab, rater]);

  const query = useOpsRatings({ ...ratingsTabParams(tab), rater: rater || undefined, page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];

  return (
    <div>
      <PageHeader title={tr("title")} description={tr("description")} />
      <Toolbar className="sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as RatingsTab)}>
          <TabsList className="max-w-full overflow-x-auto">
            {RATINGS_TABS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {tr(`tab_${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <NativeSelect
          aria-label={tr("rater")}
          value={rater}
          onChange={(e) => setRater(e.target.value)}
          placeholder={tr("any_rater")}
          options={[
            { value: "employer", label: tr("rater_employer") },
            { value: "worker", label: tr("rater_worker") },
          ]}
          className="sm:w-56"
        />
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title={tr(`empty_${tab}`)} />
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{tr("rater")}</Th>
                  <Th>{tr("scores")}</Th>
                  <Th className="min-w-64">{tr("comment")}</Th>
                  <Th className="min-w-48">{tr("flag_reason")}</Th>
                  <Th className="max-md:hidden">{tr("organization")}</Th>
                  <Th className="max-md:hidden">{tr("worker")}</Th>
                  <Th className="max-lg:hidden">{tr("dates")}</Th>
                  <Th className="text-right">
                    <span className="sr-only">{t("common.actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={r.id} className={r.voided ? "opacity-70" : undefined}>
                    <Td>
                      <span className="block text-sm text-fg">{tr(`rater_${r.rater}`)}</span>
                      {r.voided ? (
                        <Badge tone="danger" className="mt-1">
                          <Ban aria-hidden />
                          {tr("voided")}
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      <ScorePair rating={r} />
                    </Td>
                    <Td className="min-w-64">
                      <div className="space-y-1">
                        <CommentStatusBadge rating={r} />
                        {r.comment ? (
                          <p className="text-sm whitespace-pre-line text-fg-body">{r.comment}</p>
                        ) : (
                          <p className="text-xs text-fg-subtle">{tr("no_comment")}</p>
                        )}
                        {r.moderation_note ? (
                          <p className="text-xs text-fg-muted">
                            {tr("moderation_note")}: {r.moderation_note}
                          </p>
                        ) : null}
                        {r.void_reason ? (
                          <p className="text-xs text-danger">
                            {tr("void_reason")}: {r.void_reason}
                          </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="min-w-48">
                      {r.flag_reason ? (
                        <div className="space-y-0.5">
                          <p className="text-sm text-fg">{r.flag_reason}</p>
                          {r.flagged_by ? (
                            <p className="text-xs text-fg-muted">{tr("flagged_by", { name: r.flagged_by.full_name })}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </Td>
                    <Td className="max-md:hidden">
                      <Link href={`/ops/organizations/${r.organization.id}`} className="text-brand hover:underline">
                        {r.organization.name}
                      </Link>
                    </Td>
                    <Td className="max-md:hidden">
                      <Link href={`/ops/workers/${r.worker.id}`} className="text-brand hover:underline">
                        {r.worker.full_name}
                      </Link>
                    </Td>
                    <Td className="max-lg:hidden text-xs text-fg-muted">
                      <span className="block">{tr("rated_on", { date: f.dateTime(r.created_at) })}</span>
                      {r.flagged_at ? (
                        <span className="block">{tr("flagged_on", { date: f.dateTime(r.flagged_at) })}</span>
                      ) : null}
                      {r.voided_at ? (
                        <span className="block">{tr("voided_on", { date: f.dateTime(r.voided_at) })}</span>
                      ) : null}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.comment_status !== "hidden" && r.comment ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActing({ rating: r, action: "hide" })}
                            aria-label={tr("hide_aria", { worker: r.worker.full_name })}
                          >
                            <EyeOff aria-hidden />
                            {tr("hide")}
                          </Button>
                        ) : null}
                        {r.comment_status !== "visible" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActing({ rating: r, action: "restore" })}
                            aria-label={tr("restore_aria", { worker: r.worker.full_name })}
                          >
                            <Eye aria-hidden />
                            {tr("restore")}
                          </Button>
                        ) : null}
                        {!r.voided ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            onClick={() => setActing({ rating: r, action: "void" })}
                            aria-label={tr("void_aria", { worker: r.worker.full_name })}
                          >
                            <Ban aria-hidden />
                            {tr("void")}
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
      <ModerateDialog target={acting} onClose={() => setActing(null)} />
    </div>
  );
}

function ModerateDialog({
  target,
  onClose,
}: {
  target: { rating: OpsRating; action: RatingModerationAction } | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const tr = useTranslations("moderation.ratings");
  const moderate = useModerateRating();
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setText("");
    setError(null);
  }, [target]);
  if (!target) return null;
  const { rating, action } = target;
  const isVoid = action === "void";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isVoid && !text.trim()) {
      setError(tr("void_reason_required"));
      return;
    }
    moderate.mutate(
      { id: rating.id, action, text: text.trim() },
      {
        onSuccess: () => {
          toast.success(tr(`${action}_toast`));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={tr(`${action}_title`)}
            description={`${tr(`rater_${rating.rater}`)} · ${rating.worker.full_name} · ${rating.organization.name}`}
          />
          <DialogBody className="space-y-4">
            {rating.comment ? (
              <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-muted px-3 py-2 text-sm whitespace-pre-line text-fg-body">
                {rating.comment}
              </blockquote>
            ) : null}
            <p
              className={
                isVoid
                  ? "flex gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger"
                  : "flex gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-fg-muted"
              }
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {tr(`${action}_explain`)}
            </p>
            <FormError message={error} />
            <Field
              id="rating-moderation-text"
              label={isVoid ? tr("void_reason") : tr("moderation_note")}
              optional={!isVoid}
              optionalLabel={t("common.optional")}
            >
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={moderate.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant={isVoid ? "danger" : "primary"} loading={moderate.isPending}>
              {tr(`${action}_confirm`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
