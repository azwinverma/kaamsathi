"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Link2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { WorkerCardView } from "@/components/shared/worker-summary";
import { isApiError } from "@/lib/api/errors";
import { useInviteCandidates, useInviteWorker } from "@/lib/api/hooks/pipeline";
import type { Job } from "@/lib/api/types";
import { extractShareToken } from "./pipeline-lib";

const PAGE_SIZE = 10;

/** Server message for an invite failure (403 not eligible, 400 invalid_state / duplicate / bad token). */
function inviteErrorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) {
    return (
      err.fieldError("share_token") ?? err.fieldError("worker_id") ?? (err.message || fallback)
    );
  }
  return fallback;
}

/** "Invite a worker" button + dialog for an open job (L004). */
export function InviteWorkerButton({ job }: { job: Job }) {
  const t = useTranslations("pipeline.invite");
  const [open, setOpen] = React.useState(false);
  if (job.status !== "open") return null;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        {t("button")}
      </Button>
      <InviteWorkerDialog job={job} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function InviteWorkerDialog({
  job,
  open,
  onOpenChange,
}: {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const ti = useTranslations("pipeline.invite");
  const [page, setPage] = React.useState(1);
  const [link, setLink] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const candidates = useInviteCandidates(job.id, { page, page_size: PAGE_SIZE }, open);
  const invite = useInviteWorker();

  React.useEffect(() => {
    if (open) {
      setPage(1);
      setLink("");
      setLinkError(null);
      setListError(null);
    }
  }, [open]);

  const fallback = t("errors.server_error");

  const invitePast = (workerId: string, name: string) => {
    setListError(null);
    setPendingId(workerId);
    invite.mutate(
      { jobId: job.id, worker_id: workerId },
      {
        onSuccess: () => toast.success(ti("invited_toast", { name })),
        onError: (e) => setListError(inviteErrorMessage(e, fallback)),
        onSettled: () => setPendingId(null),
      },
    );
  };

  const inviteByLink = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    const token = extractShareToken(link);
    if (!token) {
      setLinkError(ti("share_invalid"));
      return;
    }
    invite.mutate(
      { jobId: job.id, share_token: token },
      {
        onSuccess: (app) => {
          toast.success(ti("invited_toast", { name: app?.worker?.full_name ?? "" }));
          setLink("");
        },
        onError: (err) => setLinkError(inviteErrorMessage(err, fallback)),
      },
    );
  };

  const rows = candidates.data?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !invite.isPending && onOpenChange(o)}>
      <DialogContent size="lg" closeLabel={t("common.close")}>
        <DialogHeader title={ti("title")} description={ti("description", { job: job.title })} />
        <DialogBody className="space-y-6">
          <section aria-labelledby="invite-share-heading" className="space-y-3">
            <h3 id="invite-share-heading" className="text-fg text-sm font-semibold">
              {ti("share_title")}
            </h3>
            <form
              onSubmit={inviteByLink}
              noValidate
              className="flex flex-col gap-2 sm:flex-row sm:items-start"
            >
              <Field
                id="invite-share"
                label={ti("share_label")}
                hint={ti("share_hint")}
                error={linkError ?? undefined}
                className="flex-1"
              >
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder={ti("share_placeholder")}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Button
                type="submit"
                className="sm:mt-7"
                loading={invite.isPending && !pendingId}
                disabled={!link.trim() || invite.isPending}
              >
                <Link2 aria-hidden />
                {ti("share_submit")}
              </Button>
            </form>
          </section>

          <section aria-labelledby="invite-past-heading" className="space-y-3">
            <div>
              <h3 id="invite-past-heading" className="text-fg text-sm font-semibold">
                {ti("past_title")}
              </h3>
              <p className="text-fg-muted text-xs">{ti("past_hint")}</p>
            </div>
            <FormError message={listError} />
            {candidates.isLoading ? (
              <div className="space-y-2" aria-busy>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : candidates.isError ? (
              <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
            ) : !rows.length ? (
              <EmptyState
                icon={Users}
                title={ti("past_empty")}
                description={ti("past_empty_body")}
              />
            ) : (
              <>
                <ul className="divide-border border-border divide-y rounded-dense border">
                  {rows.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                      <WorkerCardView worker={w} className="min-w-0 flex-1" />
                      <Button
                        size="sm"
                        onClick={() => invitePast(w.id, w.full_name)}
                        loading={pendingId === w.id}
                        disabled={invite.isPending}
                        aria-label={ti("invite_name", { name: w.full_name })}
                      >
                        <UserPlus aria-hidden />
                        {ti("invite")}
                      </Button>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  count={candidates.data?.count ?? 0}
                  onPageChange={setPage}
                />
              </>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
