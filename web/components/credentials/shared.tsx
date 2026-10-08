"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, FileText, ImageOff } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DocImage } from "@/components/ops/ops-ui";
import type { Credential, CredentialStatus } from "@/lib/api/types-credentials";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

export const CREDENTIAL_TONE: Record<CredentialStatus, BadgeTone> = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
  expired: "neutral",
};

export function CredentialStatusBadge({
  credential,
  className,
}: {
  credential: Pick<Credential, "status" | "status_label">;
  className?: string;
}) {
  const t = useTranslations("credentials.status");
  return (
    <Badge tone={CREDENTIAL_TONE[credential.status] ?? "neutral"} dot className={className}>
      {credential.status_label || t(credential.status)}
    </Badge>
  );
}

/** "Expires in 12 days" / "Expired 3 days ago" with an urgency colour. */
export function ExpiryText({
  days,
  className,
}: {
  days: number | null | undefined;
  className?: string;
}) {
  const t = useTranslations("credentials.review");
  if (days === null || days === undefined) return null;
  const tone = days < 0 ? "text-danger" : days <= 30 ? "text-warning" : "text-fg-muted";
  return (
    <span className={cn("tabular text-xs font-medium", tone, className)}>
      {days < 0 ? t("expired_ago", { days: Math.abs(days) }) : t("expires_in", { days })}
    </span>
  );
}

/**
 * Credential document viewer. Images open in the zoomable DocImage; PDFs open in a new tab
 * (the app's CSP/X-Frame-Options forbid framing, by design). URLs are short-lived signed links.
 */
export function CredentialDocument({
  credential,
  className,
}: {
  credential: Credential;
  className?: string;
}) {
  const t = useTranslations("credentials.review");
  const src = mediaSrc(credential.document_url);
  if (!src) {
    return (
      <div
        className={cn(
          "border-border bg-surface-muted text-fg-subtle flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 text-center",
          className,
        )}
      >
        <ImageOff className="size-5" aria-hidden />
        <span className="text-sm">{t("no_document_hint")}</span>
      </div>
    );
  }
  if (credential.document_type === "pdf") {
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
        <span className="text-brand-text inline-flex items-center gap-1 text-sm group-hover:underline">
          <ExternalLink className="size-4" aria-hidden />
          {t("open_document")}
        </span>
        <span className="text-fg-muted text-xs">{t("pdf_hint")}</span>
      </a>
    );
  }
  return <DocImage src={credential.document_url} label={t("document")} className={className} />;
}
