"use client";
import * as React from "react";
import { ExternalLink, FileText, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { DocImage } from "@/components/ops/ops-ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type {
  AgencyComplianceStatus,
  MobilityDocStatus,
  MobilityDocument,
} from "@/lib/api/types-mobility";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

export const DOC_TONE: Record<MobilityDocStatus, BadgeTone> = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
  expired: "neutral",
};

export const COMPLIANCE_TONE: Record<AgencyComplianceStatus, BadgeTone> = {
  unverified: "warning",
  verified: "success",
  suspended: "danger",
};

export function DocStatusBadge({
  doc,
}: {
  doc: Pick<MobilityDocument, "status" | "status_label">;
}) {
  const t = useTranslations("mobility.status");
  return (
    <Badge tone={DOC_TONE[doc.status] ?? "neutral"} dot>
      {doc.status_label || t(doc.status)}
    </Badge>
  );
}

export function ExpiryText({
  days,
  className,
}: {
  days: number | null | undefined;
  className?: string;
}) {
  const t = useTranslations("mobility.review");
  if (days === null || days === undefined) return null;
  const tone = days < 0 ? "text-danger" : days <= 60 ? "text-warning" : "text-fg-muted";
  return (
    <span className={cn("tabular text-xs font-medium", tone, className)}>
      {days < 0 ? t("expired_ago", { days: Math.abs(days) }) : t("expires_in", { days })}
    </span>
  );
}

/** Images open in the zoomable DocImage; PDFs open in a new tab (framing is blocked by CSP). */
export function DocumentViewer({ doc, className }: { doc: MobilityDocument; className?: string }) {
  const t = useTranslations("mobility.review");
  const src = mediaSrc(doc.document_url);
  if (!src) {
    return (
      <div
        className={cn(
          "border-border bg-surface-muted text-fg-subtle flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 text-center",
          className,
        )}
      >
        <ImageOff className="size-5" aria-hidden />
        <span className="text-sm">{t("no_document")}</span>
      </div>
    );
  }
  if (doc.document_type === "pdf") {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "group border-border bg-surface-muted hover:bg-surface-hover focus-visible:outline-ring flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border px-6 text-center transition-colors focus-visible:outline-2",
          className,
        )}
      >
        <span className="bg-danger-subtle text-danger flex size-12 items-center justify-center rounded-lg">
          <FileText className="size-6" aria-hidden />
        </span>
        <span className="text-fg text-sm font-medium">{t("pdf_document")}</span>
        <span className="text-brand inline-flex items-center gap-1 text-sm group-hover:underline">
          <ExternalLink className="size-4" aria-hidden />
          {t("open_document")}
        </span>
        <span className="text-fg-muted text-xs">{t("pdf_hint")}</span>
      </a>
    );
  }
  return <DocImage src={doc.document_url} label={t("document")} className={className} />;
}
