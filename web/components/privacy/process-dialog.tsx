"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { useProcessPrivacyRequest } from "@/lib/api/hooks/privacy";
import type { PrivacyProcessAction, PrivacyRequest } from "@/lib/api/types-privacy";
import { toastError } from "@/lib/forms";
import { validateProcessNote } from "./helpers";

/** Approve / reject a privacy request with a note to the worker (required when rejecting). */
export function ProcessDialog({
  request,
  action,
  onOpenChange,
}: {
  request: PrivacyRequest | null;
  action: PrivacyProcessAction;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const tp = useTranslations("privacy.ops");
  const process = useProcessPrivacyRequest();
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const open = !!request;

  React.useEffect(() => {
    if (open) {
      setNote("");
      setNoteError(null);
    }
  }, [open, request?.id, action]);

  if (!request) return null;
  const name = request.worker?.full_name || request.user?.full_name || "—";
  const kind = t(`privacy.kind.${request.kind}`);
  const reject = action === "reject";
  const id = `privacy-note-${request.id}`;

  const submit = () => {
    const v = validateProcessNote(action, note);
    if (!v.ok) {
      setNoteError(tp("note_required"));
      noteRef.current?.focus();
      return;
    }
    process.mutate(
      { id: request.id, action, note: v.note },
      {
        onSuccess: () => {
          toast.success(reject ? tp("rejected_toast") : tp("approved_toast"));
          onOpenChange(false);
        },
        onError: (e) => {
          if (isApiError(e) && e.code === "invalid_state") {
            toast.error(tp("already_handled"));
            onOpenChange(false);
          } else {
            toastError(e, t);
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !process.isPending && onOpenChange(o)}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <DialogHeader
          title={reject ? tp("reject_title", { kind }) : tp("approve_title", { kind })}
          description={
            reject
              ? tp("reject_body")
              : request.kind === "deletion"
                ? undefined
                : tp(`approve_${request.kind}`, { name })
          }
        />
        <DialogBody className="space-y-4">
          {!reject && request.kind === "deletion" ? (
            <p className="border-danger/30 bg-danger-subtle text-danger flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{tp("approve_deletion", { name })}</span>
            </p>
          ) : null}
          {request.details ? (
            <div className="bg-surface-muted rounded-md px-3 py-2 text-sm">
              <p className="text-fg-muted text-xs font-medium">{tp("col_details")}</p>
              <p className="text-fg-body mt-0.5 whitespace-pre-line">{request.details}</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>
              {tp("note_label")}
              {!reject ? (
                <span className="text-fg-muted ml-1 font-normal">({tp("note_optional")})</span>
              ) : null}
            </Label>
            <Textarea
              ref={noteRef}
              id={id}
              rows={3}
              value={note}
              maxLength={1000}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError(null);
              }}
              placeholder={tp("note_placeholder")}
              aria-invalid={noteError ? true : undefined}
              aria-required={reject || undefined}
              aria-describedby={noteError ? `${id}-error` : undefined}
            />
            {noteError ? (
              <p id={`${id}-error`} role="alert" className="text-danger text-xs font-medium">
                {noteError}
              </p>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={process.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant={reject || request.kind === "deletion" ? "danger" : "primary"}
            onClick={submit}
            loading={process.isPending}
          >
            {reject ? <X aria-hidden /> : <Check aria-hidden />}
            {reject ? tp("reject") : tp("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
