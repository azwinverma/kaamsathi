"use client";
import * as React from "react";
import { Award } from "lucide-react";
import { Badge, TONE_ICON, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Credential card (direction A signature): a document-like dense card — a thin left strip
 * (teal when verified, amber when waiting, red when rejected, neutral otherwise), title, issuer
 * and level, a status chip with icon + label and the expiry line.
 */
export function CredentialCard({
  title,
  issuer,
  status,
  expiry,
  action,
  className,
  as: As = "div",
}: {
  title: React.ReactNode;
  issuer?: React.ReactNode;
  status: { tone: BadgeTone; label: React.ReactNode };
  expiry?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const Icon = TONE_ICON[status.tone];
  const strip =
    status.tone === "verified" || status.tone === "success"
      ? "before:bg-verified"
      : status.tone === "warning"
        ? "before:bg-warning-hue"
        : status.tone === "danger"
          ? "before:bg-danger"
          : "before:bg-border-strong";
  return (
    <As
      className={cn(
        "relative flex gap-3 overflow-hidden rounded-dense border border-border bg-surface py-3 pr-3 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        strip,
        className,
      )}
    >
      <Award className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-fg-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold text-fg">{title}</p>
          <Badge tone={status.tone}>
            <Icon aria-hidden />
            {status.label}
          </Badge>
        </div>
        {issuer ? <p className="truncate text-[13px] text-fg-muted">{issuer}</p> : null}
        {expiry || action ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            {expiry ? <span className="text-xs">{expiry}</span> : <span />}
            {action}
          </div>
        ) : null}
      </div>
    </As>
  );
}
