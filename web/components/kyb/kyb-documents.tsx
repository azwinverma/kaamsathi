"use client";
import * as React from "react";
import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

export const KYB_MAX_MB = 8;
export const KYB_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function isPdfName(name: string | null | undefined): boolean {
  return !!name && /\.pdf$/i.test(name);
}

/** Validates a picked KYB document: image or PDF, at most 8 MB. Returns a message key or null. */
export function kybFileProblem(file: File): "file_type" | "file_size" | null {
  const okType = file.type === "application/pdf" || file.type.startsWith("image/") || isPdfName(file.name);
  if (!okType) return "file_type";
  if (file.size > KYB_MAX_MB * 1024 * 1024) return "file_size";
  return null;
}

/**
 * Viewer for one KYB document served through a short-lived signed URL: images inline,
 * PDFs as a link that opens in a new tab (the URL expires after ~10 minutes).
 */
export function KybDocument({
  label,
  url,
  name,
  className,
}: {
  label: string;
  url: string | null;
  name: string | null;
  className?: string;
}) {
  const t = useTranslations("risk.kyb");
  const src = mediaSrc(url);
  return (
    <figure className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-dense border border-border bg-surface-muted">
        {!src ? (
          <span className="px-3 text-center text-xs text-fg-muted">{t("no_document")}</span>
        ) : isPdfName(name) ? (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 rounded-md p-4 text-sm font-medium text-brand-text hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <FileText className="size-10" aria-hidden />
            {t("open_pdf")}
          </a>
        ) : (
          <a href={src} target="_blank" rel="noopener noreferrer" className="size-full" aria-label={t("open_document", { name: label })}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={label} className="size-full object-contain" loading="lazy" />
          </a>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2 text-xs text-fg-muted">
        <span className="truncate font-medium text-fg-body">{label}</span>
        {src ? (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 hover:text-fg"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t("open")}
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** File picker row: shows the chosen or current file name and a replace/clear control. */
export function KybFileInput({
  id,
  file,
  currentName,
  onChange,
  disabled,
}: {
  id: string;
  file: File | null;
  currentName: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("risk.kyb");
  const ref = React.useRef<HTMLInputElement>(null);
  const shown = file?.name ?? currentName;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        id={id}
        type="file"
        accept={KYB_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
        <Upload aria-hidden />
        {shown ? t("replace_file") : t("choose_file")}
      </Button>
      {shown ? (
        <span className="inline-flex min-w-0 items-center gap-1 text-sm text-fg-body">
          <FileText className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <span className="truncate">{shown}</span>
          {file ? (
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg"
              onClick={() => onChange(null)}
              aria-label={t("clear_file")}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ) : (
        <span className="text-xs text-fg-muted">{t("file_hint", { mb: KYB_MAX_MB })}</span>
      )}
    </div>
  );
}
