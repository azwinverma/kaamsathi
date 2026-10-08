"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink, FileQuestion, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useOpsWorkerCredentials } from "@/lib/api/hooks/credentials";
import { useFormat } from "@/lib/use-format";
import { AssessmentDialog } from "./assessments";
import { CredentialStatusBadge, ExpiryText } from "./shared";

/** Credentials, assessments and passport state for /ops/workers/[id]. */
export function WorkerCredentialsPanel({
  worker,
}: {
  worker: { id: string; full_name: string; skills?: { trade: { code: string } | string }[] };
}) {
  const t = useTranslations("credentials.panel");
  const tr = useTranslations("credentials.result");
  const f = useFormat();
  const query = useOpsWorkerCredentials(worker.id);
  const [open, setOpen] = React.useState(false);
  const first = worker.skills?.[0]?.trade;
  const trade = first ? (typeof first === "string" ? first : first.code) : null;
  const dialogWorker = React.useMemo(
    () => ({ id: worker.id, full_name: worker.full_name, trade }),
    [worker.id, worker.full_name, trade],
  );
  const data = query.data;
  const pending = data?.credentials.filter((c) => c.status === "pending").length ?? 0;

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("record_assessment")}</span>
          </Button>
        }
      />
      <CardBody className="space-y-5">
        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        ) : query.isError || !data ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-fg text-sm font-semibold">{t("credentials")}</h3>
                {pending ? (
                  <Button asChild variant="link" size="sm" className="h-auto px-0">
                    <Link href={`/ops/credentials?worker=${worker.id}`}>
                      {t("review")} ({f.digits(pending)})
                    </Link>
                  </Button>
                ) : null}
              </div>
              {data.credentials.length ? (
                <ul className="divide-border border-border divide-y rounded-lg border">
                  {data.credentials.map((c) => (
                    <li key={c.id} className="space-y-1 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="text-fg block truncate text-sm font-medium">
                            {c.title}
                          </span>
                          <span className="text-fg-muted block truncate text-xs">
                            {c.issuer}
                            {c.level ? ` · ${c.level}` : ""}
                          </span>
                        </span>
                        <CredentialStatusBadge credential={c} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {c.status === "verified" || c.status === "pending" ? (
                          <ExpiryText days={c.days_to_expiry} />
                        ) : null}
                        {!c.document_url ? (
                          <FileQuestion className="text-fg-subtle size-3.5" aria-hidden />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted text-sm">{t("none_credentials")}</p>
              )}
            </section>

            <section>
              <h3 className="text-fg mb-2 text-sm font-semibold">{t("assessments")}</h3>
              {data.assessments.length ? (
                <ul className="divide-border border-border divide-y rounded-lg border">
                  {data.assessments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="text-fg block truncate font-medium">
                          {f.name(a.trade)}
                        </span>
                        <span className="text-fg-muted block text-xs">
                          {f.date(a.assessed_on, a.assessed_on_bs).bs}
                          {a.level ? ` · ${a.level}` : ""}
                          {a.score !== null ? ` · ${f.digits(a.score)}/${f.digits(100)}` : ""}
                        </span>
                      </span>
                      <Badge tone={a.result === "pass" ? "success" : "danger"} dot>
                        {a.result_label || tr(a.result)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted text-sm">{t("none_assessments")}</p>
              )}
            </section>

            <section className="border-border bg-surface-muted/50 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-fg text-sm font-semibold">{t("passport")}</h3>
                {data.passport ? (
                  <Badge tone={data.passport.is_public ? "success" : "neutral"} dot>
                    {data.passport.is_public ? t("passport_public") : t("passport_private")}
                  </Badge>
                ) : (
                  <span className="text-fg-muted text-xs">{t("passport_none")}</span>
                )}
              </div>
              <p className="text-fg-muted mt-1 text-xs">
                {t("active_shares", { count: data.active_shares })}
              </p>
              {data.passport?.is_public ? (
                <a
                  href={`/p/${data.passport.public_code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-text mt-2 inline-flex items-center gap-1 text-sm hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  {t("open_passport")}
                </a>
              ) : null}
            </section>
          </>
        )}
      </CardBody>
      <AssessmentDialog open={open} onOpenChange={setOpen} worker={dialogWorker} />
    </Card>
  );
}
