"use client";
import * as React from "react";
import { AlertTriangle, Info, Lock, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { useSites } from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Work-site select scoped to what the current member can see:
 * supervisors only get their assigned sites (Membership.site_ids).
 * Empty string = all (visible) sites.
 */
export function WorkforceSiteSelect({
  value,
  onChange,
  className,
  allowAll = true,
  id,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  allowAll?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const t = useTranslations("workforce.common");
  const { isSupervisor, membership } = useSession();
  const { data, isLoading } = useSites();
  const sites = React.useMemo(() => {
    const all = listResults(data);
    if (!isSupervisor) return all;
    const mine = new Set(membership?.site_ids ?? []);
    return all.filter((s) => mine.has(s.id));
  }, [data, isSupervisor, membership]);
  const allLabel = isSupervisor ? t("all_my_sites") : t("all_sites");
  return (
    <Select
      id={id}
      value={value}
      onValueChange={onChange}
      allowEmpty={allowAll}
      emptyLabel={allowAll ? allLabel : t("no_site")}
      placeholder={allowAll ? allLabel : t("no_site")}
      disabled={isLoading}
      className={className}
      options={sites.map((s) => ({ value: s.id, label: s.name }))}
      {...aria}
    />
  );
}

/** Full-page "no access" state for role-gated workforce pages. */
export function NoAccess() {
  const t = useTranslations("errors");
  return <EmptyState icon={ShieldOff} title={t("forbidden_title")} description={t("forbidden_body")} />;
}

/** Inline banner (info / warning / locked). */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "locked";
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "locked" ? Lock : tone === "info" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center",
        tone === "info" && "border-brand/25 bg-brand-subtle text-brand-subtle-fg",
        tone === "warning" && "border-warning/30 bg-warning-subtle text-warning",
        tone === "danger" && "border-danger/30 bg-danger-subtle text-danger",
        tone === "locked" && "border-border bg-surface-muted text-fg-body",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={cn(title && "opacity-90")}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Small labelled count pill used for summaries (attendance chips, import results). */
export function CountChip({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "brand";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        tone === "neutral" && "border-border bg-surface text-fg-body",
        tone === "success" && "border-success/25 bg-success-subtle text-success",
        tone === "danger" && "border-danger/25 bg-danger-subtle text-danger",
        tone === "warning" && "border-warning/25 bg-warning-subtle text-warning",
        tone === "brand" && "border-brand/25 bg-brand-subtle text-brand-subtle-fg",
        className,
      )}
    >
      {label}
      <span className="font-semibold tabular">{value}</span>
    </span>
  );
}
