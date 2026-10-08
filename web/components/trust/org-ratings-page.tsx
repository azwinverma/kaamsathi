"use client";
/** /app/ratings — "What workers say": anonymised worker → employer ratings (N004), managers only. */
import * as React from "react";
import { Flag, Lock, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { isApiError } from "@/lib/api/errors";
import { useFlagOrgRating, useOrgRatingsReceived } from "@/lib/api/hooks/moderation";
import type { OrgReceivedRating } from "@/lib/api/types-moderation";
import { parseYearMonth } from "./moderation";
import { CommentStatusBadge, ScorePair } from "./rating-bits";

export function OrgRatingsPage() {
  const session = useSession();
  const te = useTranslations("errors");
  if (!session.canManage) {
    return <EmptyState icon={Lock} title={te("forbidden_title")} description={te("forbidden_body")} />;
  }
  return <OrgRatings />;
}

function useMonthLabel() {
  const locale = useLocale();
  return React.useCallback(
    (v: string) => {
      const ym = parseYearMonth(v);
      if (!ym) return v;
      return new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-GB", { month: "short", year: "numeric" }).format(
        new Date(Date.UTC(ym.year, ym.month - 1, 15)),
      );
    },
    [locale],
  );
}

function OrgRatings() {
  const tr = useTranslations("moderation.org_ratings");
  const month = useMonthLabel();
  const query = useOrgRatingsReceived();
  const [flagging, setFlagging] = React.useState<OrgReceivedRating | null>(null);
  const data = query.data;
  const rows = data?.results ?? [];

  return (
    <div>
      <PageHeader title={tr("title")} description={tr("description")} />
      <Card className="mb-4 flex gap-3 p-4 text-sm text-fg-body">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <p>{tr("anonymous_explain", { min: data?.min_ratings ?? 3 })}</p>
      </Card>

      {query.isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title={tr("empty_title")}
          description={
            data && data.count < data.min_ratings
              ? tr("below_threshold", { count: data.count, min: data.min_ratings })
              : tr("empty_body")
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-fg-muted">{tr("total", { count: data?.count ?? rows.length })}</p>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-fg-muted">{tr("anonymous_worker")}</span>
                        <span className="text-xs text-fg-muted">· {month(r.created_at)}</span>
                        <CommentStatusBadge rating={r} />
                      </div>
                      <ScorePair rating={r} />
                      {r.comment ? (
                        <p className="text-sm whitespace-pre-line text-fg">{r.comment}</p>
                      ) : (
                        <p className="text-xs text-fg-subtle">
                          {r.comment_status === "hidden" ? tr("comment_hidden") : tr("no_comment")}
                        </p>
                      )}
                      {r.comment_status === "flagged" ? (
                        <p className="text-xs text-fg-muted">{tr("flagged_hint")}</p>
                      ) : null}
                    </div>
                    {r.can_flag ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFlagging(r)}
                        aria-label={tr("report_aria", { month: month(r.created_at) })}
                      >
                        <Flag aria-hidden />
                        {tr("report")}
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      <FlagDialog rating={flagging} onClose={() => setFlagging(null)} />
    </div>
  );
}

function FlagDialog({ rating, onClose }: { rating: OrgReceivedRating | null; onClose: () => void }) {
  const t = useTranslations();
  const tr = useTranslations("moderation.org_ratings");
  const flag = useFlagOrgRating();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason("");
    setError(null);
  }, [rating]);
  if (!rating) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("errors.required"));
      return;
    }
    flag.mutate(
      { id: rating.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(tr("reported_toast"));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!rating} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={tr("report_title")} description={tr("report_description")} />
          <DialogBody className="space-y-4">
            {rating.comment ? (
              <blockquote className="rounded-md border-l-2 border-border-strong bg-surface-muted px-3 py-2 text-sm whitespace-pre-line text-fg-body">
                {rating.comment}
              </blockquote>
            ) : null}
            <FormError message={error} />
            <Field id="rating-flag-reason" label={tr("reason")} hint={tr("reason_hint")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={flag.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={flag.isPending}>
              {tr("report_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
