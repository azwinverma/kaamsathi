"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, MoreHorizontal, Pause, Pencil, Play, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCloseJob,
  useDeleteJob,
  usePauseJob,
  usePublishJob,
  useResumeJob,
} from "@/lib/api/hooks/hiring";
import type { Job } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { JobFormDialog } from "./job-form-dialog";

type Pending = "publish" | "close" | "delete" | "pause" | "resume" | null;

export function canEditJob(job: Job) {
  return job.status === "draft" || job.status === "open" || job.status === "paused";
}
export function canCloseJob(job: Job) {
  return job.status === "open" || job.status === "filled" || job.status === "paused";
}

/**
 * Publish / close / delete-draft / edit for a job. `primary` also renders the main action
 * (Publish for drafts, Edit otherwise) as a visible button next to the menu.
 */
export function JobActions({
  job,
  primary,
  redirectOnDelete,
}: {
  job: Job;
  primary?: boolean;
  redirectOnDelete?: string;
}) {
  const t = useTranslations();
  const ta = useTranslations("hiring.actions");
  const tp = useTranslations("pipeline.actions");
  const router = useRouter();
  const publish = usePublishJob();
  const close = useCloseJob();
  const del = useDeleteJob();
  const pause = usePauseJob();
  const resume = useResumeJob();
  const [confirm, setConfirm] = React.useState<Pending>(null);
  const [editing, setEditing] = React.useState(false);

  const isDraft = job.status === "draft";
  const editable = canEditJob(job);
  const closable = canCloseJob(job);
  const pausable = job.status === "open";
  const resumable = job.status === "paused";
  if (!isDraft && !editable && !closable) return null;

  const run = () => {
    const done = (msg: string) => () => {
      toast.success(msg);
      setConfirm(null);
    };
    if (confirm === "publish") {
      publish.mutate(job.id, {
        onSuccess: done(ta("published_toast")),
        onError: (e) => toastError(e, t),
      });
    } else if (confirm === "close") {
      close.mutate(job.id, {
        onSuccess: done(ta("closed_toast")),
        onError: (e) => toastError(e, t),
      });
    } else if (confirm === "pause") {
      pause.mutate(job.id, {
        onSuccess: done(tp("paused_toast")),
        onError: (e) => toastError(e, t),
      });
    } else if (confirm === "resume") {
      resume.mutate(job.id, {
        onSuccess: done(tp("resumed_toast")),
        onError: (e) => toastError(e, t),
      });
    } else if (confirm === "delete") {
      del.mutate(job.id, {
        onSuccess: () => {
          done(ta("deleted_toast"))();
          if (redirectOnDelete) router.push(redirectOnDelete);
        },
        onError: (e) => toastError(e, t),
      });
    }
  };

  const copy = {
    publish: { title: ta("publish_title"), body: ta("publish_body"), label: ta("publish") },
    close: { title: ta("close_title"), body: ta("close_body"), label: ta("close") },
    delete: { title: ta("delete_title"), body: ta("delete_body"), label: ta("delete") },
    pause: { title: tp("pause_title"), body: tp("pause_body"), label: tp("pause") },
    resume: { title: tp("resume_title"), body: tp("resume_body"), label: tp("resume") },
  };

  return (
    <>
      {primary ? (
        isDraft ? (
          <Button onClick={() => setConfirm("publish")}>
            <Send aria-hidden />
            {ta("publish")}
          </Button>
        ) : resumable ? (
          <Button onClick={() => setConfirm("resume")}>
            <Play aria-hidden />
            {tp("resume")}
          </Button>
        ) : editable ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t("common.edit")}
          </Button>
        ) : null
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={primary ? "secondary" : "ghost"}
            size={primary ? "icon" : "icon-sm"}
            aria-label={t("common.more_actions")}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {editable ? (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil aria-hidden />
              {t("common.edit")}
            </DropdownMenuItem>
          ) : null}
          {isDraft ? (
            <DropdownMenuItem onSelect={() => setConfirm("publish")}>
              <Send aria-hidden />
              {ta("publish")}
            </DropdownMenuItem>
          ) : null}
          {pausable ? (
            <DropdownMenuItem onSelect={() => setConfirm("pause")}>
              <Pause aria-hidden />
              {tp("pause")}
            </DropdownMenuItem>
          ) : null}
          {resumable ? (
            <DropdownMenuItem onSelect={() => setConfirm("resume")}>
              <Play aria-hidden />
              {tp("resume")}
            </DropdownMenuItem>
          ) : null}
          {closable ? (
            <DropdownMenuItem onSelect={() => setConfirm("close")}>
              <Archive aria-hidden />
              {ta("close")}
            </DropdownMenuItem>
          ) : null}
          {isDraft ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={() => setConfirm("delete")}>
                <Trash2 aria-hidden />
                {ta("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? copy[confirm].title : ""}
        description={confirm ? copy[confirm].body : undefined}
        confirmLabel={confirm ? copy[confirm].label : undefined}
        danger={confirm === "delete" || confirm === "close"}
        loading={
          publish.isPending ||
          close.isPending ||
          del.isPending ||
          pause.isPending ||
          resume.isPending
        }
        onConfirm={run}
      />
      {editable ? <JobFormDialog open={editing} onOpenChange={setEditing} job={job} /> : null}
    </>
  );
}
