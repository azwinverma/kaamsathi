"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/shared/status-badge";
import { RatingStars } from "@/components/shared/worker-summary";
import { WorkerForm } from "@/components/ops/worker-form";
import { WorkerDocs } from "@/components/ops/worker-docs";
import { VerifyActions } from "@/components/ops/verify-actions";
import { AvailabilityBadge, InfoRow } from "@/components/ops/ops-ui";
import { LanguageChips, ProfileCompletenessCard } from "@/components/ops/worker-profile-bits";
import { WorkerCredentialsPanel } from "@/components/credentials/worker-panel";
import { useOpsWorker, useUpdateOpsWorker } from "@/lib/api/hooks/ops";
import { useFormat } from "@/lib/use-format";

export default function OpsWorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const tw = useTranslations("ops.worker_detail");
  const tn = useTranslations("nav");
  const tl = useTranslations("moderation.languages");
  const f = useFormat();
  const query = useOpsWorker(id);
  const update = useUpdateOpsWorker();
  const [reReview, setReReview] = React.useState(false);
  const w = query.data;
  const back = { href: "/ops/workers", label: tn("ops_workers") };

  if (query.isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-56" />} back={back} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </>
    );
  }
  if (query.isError || !w) {
    return (
      <>
        <PageHeader title={tw("title_fallback")} back={back} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </>
    );
  }

  const decided = w.verification_status === "verified" || w.verification_status === "rejected";

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={w.full_name} src={w.photo} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{w.full_name}</span>
              {w.full_name_ne ? (
                <span className="block text-sm font-normal text-fg-muted" lang="ne">
                  {w.full_name_ne}
                </span>
              ) : null}
            </span>
          </span>
        }
        meta={
          <>
            <VerificationBadge status={w.verification_status} />
            <AvailabilityBadge available={w.is_available} />
            <span className="text-sm text-fg-muted tabular">{f.phone(w.phone)}</span>
          </>
        }
        actions={
          w.verification_status === "pending" ? (
            <Button asChild variant="secondary">
              <Link href={`/ops/verification?worker=${w.id}`}>
                <ShieldCheck aria-hidden />
                {tw("open_in_queue")}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="order-2 lg:order-1">
          <WorkerForm
            worker={w}
            submitLabel={t("common.save_changes")}
            submitting={update.isPending}
            onSubmit={async (body) => {
              await update.mutateAsync({ id: w.id, ...body });
              toast.success(t("common.changes_saved"));
            }}
          />
        </div>

        <aside className="order-1 space-y-6 lg:sticky lg:top-24 lg:order-2">
          <ProfileCompletenessCard completeness={w.profile_completeness} />

          <Card>
            <CardHeader title={tw("verification")} />
            <CardBody className="space-y-4">
              <dl>
                <InfoRow label={t("common.status")} value={<VerificationBadge status={w.verification_status} />} />
                <InfoRow label={tw("verified_by")} value={w.verified_by?.full_name} />
                <InfoRow label={tw("decided_at")} value={w.verified_at ? f.dateTime(w.verified_at) : null} />
                <InfoRow label={t("common.note")} value={w.verification_note} />
              </dl>
              {decided && !reReview ? (
                <Button variant="secondary" className="w-full" onClick={() => setReReview(true)}>
                  {tw("change_decision")}
                </Button>
              ) : (
                <VerifyActions worker={w} onDone={() => setReReview(false)} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={tw("documents")} description={tw("documents_hint")} />
            <CardBody>
              <WorkerDocs worker={w} editable />
            </CardBody>
          </Card>

          <WorkerCredentialsPanel worker={w} />

          <Card>
            <CardHeader title={tw("record")} />
            <CardBody>
              <dl>
                <InfoRow label={t("term.placements")} value={f.number(w.placements_count ?? 0)} />
                <InfoRow label={t("term.rating")} value={<RatingStars value={w.rating_avg} />} />
                <InfoRow
                  label={t("term.experience")}
                  value={t("term.years", { count: w.total_experience_years ?? 0 })}
                />
                <InfoRow label={tl("title")} value={<LanguageChips languages={w.languages} />} />
                <InfoRow label={t("common.created")} value={f.dateTime(w.created_at)} />
                <InfoRow label={t("common.updated")} value={f.dateTime(w.updated_at)} />
                <InfoRow label={tw("app_account")} value={w.user_id ? t("common.yes") : t("common.no")} />
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
