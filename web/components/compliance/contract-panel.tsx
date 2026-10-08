"use client";
import * as React from "react";
import { CheckCircle2, Clock, Eye, FilePen, FileSignature, History, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { proxyHref } from "@/lib/api/client";
import {
  useEmploymentContract,
  useGenerateContract,
  useRecordContractAcceptance,
} from "@/lib/api/hooks/compliance";
import type { ContractLanguage, EmploymentContract } from "@/lib/api/types-compliance";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

/**
 * Appointment letter (नियुक्ति पत्र) panel on the worker's employment page. Managers only.
 * `bare` drops the card chrome (heading + hairline only) for pages that already have structure;
 * version history then lives on the employment timeline, so the panel keeps only the controls.
 */
export function ContractPanel({
  employmentId,
  active,
  bare,
}: {
  employmentId: string;
  active: boolean;
  bare?: boolean;
}) {
  const t = useTranslations("compliance.contract");
  const tAll = useTranslations();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useEmploymentContract(employmentId);
  const generate = useGenerateContract(employmentId);
  const accept = useRecordContractAcceptance(employmentId);
  const [showAll, setShowAll] = React.useState(false);
  const [language, setLanguage] = React.useState<ContractLanguage>("both");

  const latest = data?.latest ?? null;
  const pdfHref = (v?: number) =>
    proxyHref(`/org/employments/${employmentId}/contract.pdf`, v ? { version: v } : undefined);

  const doGenerate = (force = false) =>
    generate.mutate(
      { language, force },
      {
        onSuccess: (res) =>
          toast.success(t("generated_toast", { version: res.latest?.version ?? 1 })),
        onError: (e) => toastError(e, tAll),
      },
    );

  const action = latest ? (
    <Button variant="secondary" size="sm" asChild>
      <a href={pdfHref()} target="_blank" rel="noreferrer">
        <Eye aria-hidden />
        {t("view_pdf")}
      </a>
    </Button>
  ) : null;

  const body = (
    <>
      {isLoading ? (
        <Skeleton className="h-20" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} className="py-6" />
      ) : !latest ? (
        <EmptyState
          icon={FileSignature}
          title={t("empty_title")}
          description={t("empty_body")}
          className="py-8"
          action={
            active ? (
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <LanguageSelect value={language} onChange={setLanguage} />
                <Button onClick={() => doGenerate()} loading={generate.isPending}>
                  <FilePen aria-hidden />
                  {t("generate")}
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{t("version", { version: f.digits(latest.version) })}</Badge>
            <AcceptedBadge contract={latest} />
            <span className="text-fg-muted text-xs">
              {t("generated_on", { date: f.dateTime(latest.generated_at) })}
            </span>
          </div>
          {data?.needs_new_version ? (
            <div className="border-warning/30 bg-warning-subtle text-warning flex flex-col gap-3 rounded-md border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>{t("terms_changed")}</span>
              {active ? (
                <Button size="sm" onClick={() => doGenerate()} loading={generate.isPending}>
                  <RefreshCw aria-hidden />
                  {t("generate_new")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {!latest.is_accepted ? (
            <div className="bg-surface-muted text-fg-body flex flex-col gap-2 rounded-md px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>{t("waiting_body")}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  accept.mutate("paper", {
                    onSuccess: () => toast.success(t("paper_toast")),
                    onError: (e) => toastError(e, tAll),
                  })
                }
                loading={accept.isPending}
              >
                <CheckCircle2 aria-hidden />
                {t("record_paper")}
              </Button>
            </div>
          ) : null}
          {data && data.versions.length > 1 && !bare ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
              >
                <History aria-hidden />
                {showAll ? t("hide_versions") : t("show_versions", { count: data.versions.length })}
              </Button>
              {showAll ? (
                <ul className="divide-border border-border mt-2 divide-y rounded-md border">
                  {data.versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-fg font-medium">
                          {t("version", { version: f.digits(v.version) })}
                        </span>
                        <span className="text-fg-muted text-xs">{f.dateTime(v.generated_at)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <AcceptedBadge contract={v} />
                        <a
                          className="text-brand-text text-xs hover:underline"
                          href={pdfHref(v.version)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {active && !data?.needs_new_version ? (
            <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
              <LanguageSelect value={language} onChange={setLanguage} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => doGenerate(true)}
                loading={generate.isPending}
              >
                <RefreshCw aria-hidden />
                {t("regenerate")}
              </Button>
            </div>
          ) : null}
          <p className="text-fg-muted text-xs">{t("lawyer_note")}</p>
        </>
      )}
    </>
  );

  if (bare) {
    return (
      <section aria-labelledby={`contract-${employmentId}`} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h2 id={`contract-${employmentId}`} className="text-fg text-base font-semibold">
              {t("title")}
            </h2>
            <p className="text-fg-muted text-sm">{t("description")}</p>
          </div>
          {action}
        </div>
        {body}
      </section>
    );
  }
  return (
    <Card>
      <CardHeader title={t("title")} description={t("description")} action={action} />
      <CardBody className="space-y-4">{body}</CardBody>
    </Card>
  );
}

function AcceptedBadge({ contract }: { contract: EmploymentContract }) {
  const t = useTranslations("compliance.contract");
  const f = useFormat();
  if (!contract.is_accepted) {
    return (
      <Badge tone="warning">
        <Clock aria-hidden />
        {t("not_accepted")}
      </Badge>
    );
  }
  return (
    <Badge
      tone="success"
      title={contract.accepted_at ? f.dateTime(contract.accepted_at) : undefined}
    >
      <CheckCircle2 aria-hidden />
      {t("accepted_via", { channel: t(`channel_${contract.accepted_channel ?? "app"}`) })}
    </Badge>
  );
}

function LanguageSelect({
  value,
  onChange,
}: {
  value: ContractLanguage;
  onChange: (v: ContractLanguage) => void;
}) {
  const t = useTranslations("compliance.contract");
  return (
    <label className="text-fg-muted flex items-center gap-2 text-sm">
      <span>{t("language")}</span>
      <select
        className="border-border bg-surface text-fg h-8 rounded-md border px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as ContractLanguage)}
      >
        <option value="both">{t("lang_both")}</option>
        <option value="ne">{t("lang_ne")}</option>
        <option value="en">{t("lang_en")}</option>
      </select>
    </label>
  );
}
