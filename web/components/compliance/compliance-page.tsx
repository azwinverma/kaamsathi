"use client";
import * as React from "react";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DateText } from "@/components/ui/date";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { listResults } from "@/lib/api/client";
import { useComplianceStatus } from "@/lib/api/hooks/compliance";
import { useExpiringCredentials } from "@/lib/api/hooks/credentials";
import { isApiError } from "@/lib/api/errors";
import type { ComplianceItem } from "@/lib/api/types-compliance";
import type { ExpiringCredential } from "@/lib/api/types-credentials";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import { SSFFilingsCard } from "./ssf-filings";
import { scoreTone, sortItems } from "./utils";

export function ComplianceGate({ children }: { children: React.ReactNode }) {
  const { canManage } = useSession();
  const t = useTranslations();
  if (!canManage) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("errors.forbidden_title")}
        description={t("compliance.forbidden")}
        className="mx-auto mt-8 max-w-xl"
      />
    );
  }
  return <>{children}</>;
}

export function CompliancePage() {
  const t = useTranslations("compliance");
  return (
    <ComplianceGate>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <ScoreCard />
          <ExpiringCredentialsCard />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <ActionItemsCard />
          <SSFFilingsCard />
        </div>
      </div>
      <p className="text-fg-muted mt-6 text-xs">{t("disclaimer")}</p>
    </ComplianceGate>
  );
}

const TONE_CLASS = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;
const RING_CLASS = {
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
} as const;

function ScoreCard() {
  const t = useTranslations("compliance.score");
  const f = useFormat();
  const { data, isLoading, error, refetch } = useComplianceStatus();
  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const tone = scoreTone(data.score);
  const r = 52;
  const c = 2 * Math.PI * r;
  const counts = {
    action: data.items.filter((i) => i.status === "action").length,
    warning: data.items.filter((i) => i.status === "warning").length,
    ok: data.items.filter((i) => i.status === "ok").length,
  };
  return (
    <Card>
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody className="flex flex-col items-center gap-4">
        <div className="relative size-36">
          <svg viewBox="0 0 120 120" className="size-36 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-border" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - data.score / 100)}
              className={cn("transition-[stroke-dashoffset]", RING_CLASS[tone])}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={cn("tabular text-4xl font-semibold", TONE_CLASS[tone])}
              role="img"
              aria-label={t("aria", { score: data.score })}
            >
              {f.digits(data.score)}
            </span>
            <span className="text-fg-muted text-xs">/ {f.digits(100)}</span>
          </div>
        </div>
        <p className={cn("text-sm font-semibold", TONE_CLASS[tone])}>{t(`band_${tone}`)}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge tone="danger">{t("count_action", { count: counts.action })}</Badge>
          <Badge tone="warning">{t("count_warning", { count: counts.warning })}</Badge>
          <Badge tone="success">{t("count_ok", { count: counts.ok })}</Badge>
        </div>
      </CardBody>
    </Card>
  );
}

const ITEM_ICON = { action: AlertOctagon, warning: AlertTriangle, ok: CheckCircle2 } as const;
const ITEM_ICON_CLASS = {
  action: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning",
  ok: "bg-success-subtle text-success",
} as const;

function ActionItemsCard() {
  const t = useTranslations("compliance.items");
  const { data, isLoading, error, refetch } = useComplianceStatus();
  const [showOk, setShowOk] = React.useState(false);
  const items = sortItems(data?.items ?? []);
  const open = items.filter((i) => i.status !== "ok");
  const visible = showOk ? items : open;
  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("description")}
        action={
          data && open.length < items.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOk((v) => !v)}
              aria-pressed={showOk}
            >
              {showOk ? t("hide_ok") : t("show_ok", { count: items.length - open.length })}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={t("all_good_title")}
            description={t("all_good_body")}
          />
        ) : (
          <ul className="divide-border divide-y">
            {visible.map((item) => (
              <ActionItemRow key={item.key} item={item} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ActionItemRow({ item }: { item: ComplianceItem }) {
  const t = useTranslations("compliance.items");
  const Icon = ITEM_ICON[item.status];
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          ITEM_ICON_CLASS[item.status],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm font-medium">
          {t.has(`label.${item.key}`) ? t(`label.${item.key}`) : item.key}
        </p>
        <p className="text-fg-muted text-sm">{item.message}</p>
      </div>
      {item.status !== "ok" ? (
        <Button variant="secondary" size="sm" asChild className="self-start sm:self-center">
          <Link href={item.link}>
            {t(`fix.${item.key}`)}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

function ExpiringCredentialsCard() {
  const t = useTranslations("compliance.credentials");
  const { data, isLoading, error, refetch } = useExpiringCredentials(30);
  // Endpoint owned by the credentials area; a 404 (not deployed) shows the calm empty state.
  const unavailable = isApiError(error) && (error.status === 404 || error.code === "not_found");
  const rows = listResults<ExpiringCredential>(data);
  return (
    <Card id="credentials" className="scroll-mt-20">
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : error && !unavailable ? (
          <ErrorState error={error} onRetry={() => void refetch()} className="py-6" />
        ) : rows.length === 0 ? (
          <p className="bg-surface-muted text-fg-muted rounded-md px-3 py-3 text-sm">{t("none")}</p>
        ) : (
          <ul className="divide-border divide-y">
            {rows.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-fg truncate text-sm font-medium">
                    {c.worker?.full_name ?? "—"}
                  </p>
                  <p className="text-fg-muted truncate text-xs">{c.title}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <span className="text-fg-muted block">{t("expires")}</span>
                  <DateText
                    ad={c.expires_on}
                    bs={c.expires_on_bs}
                    inline
                    className="text-warning"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
