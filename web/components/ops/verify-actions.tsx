"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BadgeCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useVerifyWorker } from "@/lib/api/hooks/ops";
import type { OpsWorker } from "@/lib/api/types";
import { toastError } from "@/lib/forms";

export type VerifyDecision = "verified" | "rejected";

/** Note + Verify / Reject. Reject requires a note (shown to the worker / ops history). */
export function VerifyActions({
  worker,
  onDone,
  shortcuts,
}: {
  worker: OpsWorker;
  onDone?: (decision: VerifyDecision) => void;
  /** Enable keyboard shortcuts (Alt+V verify, Alt+R reject). */
  shortcuts?: boolean;
}) {
  const t = useTranslations();
  const tv = useTranslations("ops.verify");
  const verify = useVerifyWorker();
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<VerifyDecision | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const id = `verify-note-${worker.id}`;

  React.useEffect(() => {
    setNote("");
    setNoteError(null);
  }, [worker.id]);

  const decide = React.useCallback(
    (status: VerifyDecision) => {
      if (verify.isPending) return;
      const trimmed = note.trim();
      if (status === "rejected" && !trimmed) {
        setNoteError(tv("reject_note_required"));
        noteRef.current?.focus();
        return;
      }
      setNoteError(null);
      setPending(status);
      verify.mutate(
        { id: worker.id, status, note: trimmed || undefined },
        {
          onSuccess: () => {
            toast.success(
              status === "verified"
                ? tv("verified_toast", { name: worker.full_name })
                : tv("rejected_toast", { name: worker.full_name }),
            );
            onDone?.(status);
          },
          onError: (e) => toastError(e, t),
          onSettled: () => setPending(null),
        },
      );
    },
    [note, onDone, t, tv, verify, worker.full_name, worker.id],
  );

  React.useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.code;
      if (k === "KeyV") {
        e.preventDefault();
        decide("verified");
      } else if (k === "KeyR") {
        e.preventDefault();
        decide("rejected");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, shortcuts]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>
          {tv("note")}
          <span className="ml-1 font-normal text-fg-muted">({tv("note_hint")})</span>
        </Label>
        <Textarea
          ref={noteRef}
          id={id}
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (noteError) setNoteError(null);
          }}
          placeholder={tv("note_placeholder")}
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? `${id}-error` : undefined}
        />
        {noteError ? (
          <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
            {noteError}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="danger-outline"
          onClick={() => decide("rejected")}
          loading={pending === "rejected"}
          disabled={verify.isPending}
        >
          <ShieldX aria-hidden />
          {tv("reject")}
        </Button>
        <Button onClick={() => decide("verified")} loading={pending === "verified"} disabled={verify.isPending}>
          <BadgeCheck aria-hidden />
          {tv("verify")}
        </Button>
      </div>
      {shortcuts ? <p className="hidden text-xs text-fg-subtle lg:block">{tv("shortcuts")}</p> : null}
    </div>
  );
}
