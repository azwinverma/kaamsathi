"use client";
/** N006 — evidence attached to a dispute (images / PDFs), listed and uploaded per party. */
import * as React from "react";
import { ExternalLink, FileText, Paperclip, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { useDisputeEvidence, useUploadDisputeEvidence, type DisputeScope } from "@/lib/api/hooks/trust";
import type { Dispute, DisputeEvidence } from "@/lib/api/types-trust";
import { mediaSrc } from "@/lib/media";
import { useFormat } from "@/lib/use-format";
import { canAddEvidence, EVIDENCE_ACCEPT, evidenceFileError, MAX_EVIDENCE } from "./moderation";

export function EvidenceCountBadge({ count }: { count: number | null | undefined }) {
  const te = useTranslations("moderation.evidence");
  if (!count) return null;
  return (
    <Badge tone="neutral" title={te("count", { count })}>
      <Paperclip aria-hidden />
      <span aria-hidden>{count}</span>
      <span className="sr-only">{te("count", { count })}</span>
    </Badge>
  );
}

export function EvidencePanel({ dispute, scope }: { dispute: Dispute; scope: DisputeScope }) {
  const te = useTranslations("moderation.evidence");
  const query = useDisputeEvidence(scope, dispute.id);
  const rows = query.data ?? [];
  const canAdd = canAddEvidence(dispute.status, query.data ? rows.length : dispute.evidence_count);
  const headingId = `evidence-${dispute.id}`;
  return (
    <section aria-labelledby={headingId} className="mt-3 space-y-3 rounded-md border border-border p-3">
      <h3 id={headingId} className="text-sm font-semibold text-fg">
        {te("title")}
      </h3>
      {query.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-busy>
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{te("empty")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((ev) => (
            <li key={ev.id}>
              <EvidenceItem evidence={ev} />
            </li>
          ))}
        </ul>
      )}
      {canAdd ? (
        <EvidenceUpload dispute={dispute} scope={scope} />
      ) : (
        <p className="text-xs text-fg-muted">
          {rows.length >= MAX_EVIDENCE ? te("limit_reached", { max: MAX_EVIDENCE }) : te("closed_hint")}
        </p>
      )}
    </section>
  );
}

function EvidenceItem({ evidence: ev }: { evidence: DisputeEvidence }) {
  const te = useTranslations("moderation.evidence");
  const f = useFormat();
  const src = mediaSrc(ev.file_url) ?? ev.file_url;
  const label = ev.file_type === "pdf" ? te("open_pdf") : te("open_image");
  return (
    <div className="flex gap-3 rounded-md border border-border bg-surface-muted/50 p-2">
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${label} — ${ev.party_label}`}
      >
        {ev.file_type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <FileText className="size-6 text-danger" aria-hidden />
        )}
      </a>
      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={ev.party === "ops" ? "brand" : ev.party === "employer" ? "accent" : "outline"}>
            {ev.party_label || te(`party.${ev.party}`)}
          </Badge>
          <span className="text-xs text-fg-muted">{f.dateTime(ev.created_at)}</span>
        </div>
        {ev.note ? <p className="whitespace-pre-line text-fg-body">{ev.note}</p> : null}
        {ev.uploaded_by ? <p className="text-xs text-fg-muted">{ev.uploaded_by.full_name}</p> : null}
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-text hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          {label}
        </a>
      </div>
    </div>
  );
}

function EvidenceUpload({ dispute, scope }: { dispute: Dispute; scope: DisputeScope }) {
  const te = useTranslations("moderation.evidence");
  const t = useTranslations();
  const upload = useUploadDisputeEvidence(scope);
  const [file, setFile] = React.useState<File | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileId = `evidence-file-${dispute.id}`;
  const noteId = `evidence-note-${dispute.id}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = evidenceFileError(file);
    if (problem) {
      setError(te(`file_${problem}`));
      return;
    }
    setError(null);
    upload.mutate(
      { id: dispute.id, file: file!, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(te("uploaded_toast"));
          setFile(null);
          setNote("");
          if (inputRef.current) inputRef.current.value = "";
        },
        onError: (err) =>
          setError(
            isApiError(err)
              ? (err.fields.file?.[0] ?? (err.message || t(`errors.${err.code}`)))
              : t("errors.server_error"),
          ),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 border-t border-border pt-3">
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={fileId} label={te("file")} hint={te("file_hint")}>
          <Input
            ref={inputRef}
            type="file"
            accept={EVIDENCE_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="py-1.5"
          />
        </Field>
        <Field id={noteId} label={te("note")} optional optionalLabel={t("common.optional")}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" loading={upload.isPending}>
          <Upload aria-hidden />
          {te("upload")}
        </Button>
      </div>
    </form>
  );
}
