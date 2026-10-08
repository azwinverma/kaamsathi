"use client";
import * as React from "react";
import { BadgeCheck, Clock, Info, Lock, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { isApiError } from "@/lib/api/errors";
import { useOrgVerification, useSubmitOrgVerification } from "@/lib/api/hooks/risk";
import type { KybStatus, OrgVerification } from "@/lib/api/types-risk";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { KybStatusBadge } from "./kyb-badges";
import { KybDocument, KybFileInput, kybFileProblem } from "./kyb-documents";

const STATUS_ICON: Record<KybStatus, React.ComponentType<{ className?: string }>> = {
  unverified: ShieldQuestion,
  pending: Clock,
  verified: BadgeCheck,
  rejected: ShieldAlert,
};
const STATUS_PANEL: Record<KybStatus, string> = {
  unverified: "border-border bg-surface-muted",
  pending: "border-warning/30 bg-warning-subtle",
  verified: "border-success/30 bg-success-subtle",
  rejected: "border-danger/30 bg-danger-subtle",
};

/** /app/verification — owner/admin submit company registration + PAN documents for KYB. */
export function OrgVerificationPage() {
  const session = useSession();
  const te = useTranslations("errors");
  const t = useTranslations("risk.kyb");
  if (!session.isAdmin) {
    return <EmptyState icon={Lock} title={te("forbidden_title")} description={t("owner_only")} />;
  }
  return <VerificationContent />;
}

function VerificationContent() {
  const t = useTranslations("risk.kyb");
  const tn = useTranslations("nav");
  const query = useOrgVerification();
  const [editing, setEditing] = React.useState(false);

  if (query.isLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const v = query.data;
  const showForm = v.verification_status === "unverified" || v.verification_status === "rejected" || editing;

  return (
    <div className="max-w-4xl">
      <PageHeader title={tn("org_verification")} description={t("page_description")} />
      <StatusPanel v={v} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          {showForm ? (
            <SubmitForm v={v} onDone={() => setEditing(false)} onCancel={editing ? () => setEditing(false) : undefined} />
          ) : (
            <Card>
              <CardHeader
                title={t("submitted_documents")}
                action={
                  v.verification_status === "pending" ? (
                    <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                      {t("update_documents")}
                    </Button>
                  ) : null
                }
              />
              <CardBody className="space-y-4">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-fg-muted">{t("registration_no")}</dt>
                    <dd className="mt-1 text-fg tabular">{v.registration_no || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-fg-muted">{t("pan_no")}</dt>
                    <dd className="mt-1 text-fg tabular">{v.pan_no_masked || "—"}</dd>
                  </div>
                </dl>
                <div className="grid gap-4 sm:grid-cols-2">
                  <KybDocument label={t("registration_doc")} url={v.registration_doc_url} name={v.registration_doc_name} />
                  <KybDocument label={t("pan_doc")} url={v.pan_doc_url} name={v.pan_doc_name} />
                </div>
              </CardBody>
            </Card>
          )}
        </div>
        <aside className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-fg">
            <Info className="size-4 text-brand-text" aria-hidden />
            {t("why_title")}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-fg-body">
            <li>{t("why_shortlist")}</li>
            <li>{t("why_badge")}</li>
            <li>{t("why_trust")}</li>
          </ul>
          <p className="text-xs text-fg-muted">{t("privacy_note")}</p>
        </aside>
      </div>
    </div>
  );
}

function StatusPanel({ v }: { v: OrgVerification }) {
  const t = useTranslations("risk.kyb");
  const f = useFormat();
  const Icon = STATUS_ICON[v.verification_status] ?? ShieldQuestion;
  return (
    <section
      aria-labelledby="kyb-status-title"
      className={cn("flex gap-4 rounded-lg border p-4 sm:p-5", STATUS_PANEL[v.verification_status])}
    >
      <Icon className="mt-0.5 size-6 shrink-0 text-fg-body" aria-hidden />
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="kyb-status-title" className="text-base font-semibold text-fg">
            {t(`status_title.${v.verification_status}`)}
          </h2>
          <KybStatusBadge status={v.verification_status} />
        </div>
        <p className="text-sm text-fg-body">
          {v.verification_status === "verified" && v.verified_at
            ? t("status_body.verified_on", { date: f.dateTime(v.verified_at) })
            : t(`status_body.${v.verification_status}`)}
        </p>
        {v.verification_status === "rejected" && v.verification_note ? (
          <p className="rounded-md border border-danger/30 bg-surface px-3 py-2 text-sm text-fg">
            <span className="font-medium">{t("reviewer_note")}: </span>
            {v.verification_note}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SubmitForm({
  v,
  onDone,
  onCancel,
}: {
  v: OrgVerification;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("risk.kyb");
  const tAll = useTranslations();
  const submit = useSubmitOrgVerification();
  const [registrationNo, setRegistrationNo] = React.useState(v.registration_no);
  const [panNo, setPanNo] = React.useState("");
  const [regDoc, setRegDoc] = React.useState<File | null>(null);
  const [panDoc, setPanDoc] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const pick = (field: "registration_doc" | "pan_doc", file: File | null) => {
    const problem = file ? kybFileProblem(file) : null;
    setErrors((e) => ({ ...e, [field]: problem ? t(problem, { mb: 8 }) : "" }));
    if (problem) return;
    (field === "registration_doc" ? setRegDoc : setPanDoc)(file);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!registrationNo.trim()) next.registration_no = tAll("errors.required");
    if (!regDoc && !v.has_registration_doc) next.registration_doc = t("doc_required");
    if (!panDoc && !v.has_pan_doc) next.pan_doc = t("doc_required");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    submit.mutate(
      { registration_no: registrationNo.trim(), pan_no: panNo.trim() || undefined, registration_doc: regDoc, pan_doc: panDoc },
      {
        onSuccess: () => {
          toast.success(t("submitted_toast"));
          setRegDoc(null);
          setPanDoc(null);
          onDone();
        },
        onError: (err) => {
          if (isApiError(err)) {
            const fields: Record<string, string> = {};
            for (const [k, msgs] of Object.entries(err.fields ?? {})) fields[k] = msgs[0];
            setErrors(fields);
            setFormError(err.message || tAll(`errors.${err.code}`));
          } else setFormError(tAll("errors.server_error"));
        },
      },
    );
  };

  const resubmit = v.verification_status === "rejected" || v.verification_status === "pending";
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader title={resubmit ? t("resubmit_title") : t("submit_title")} description={t("submit_description")} />
        <CardBody className="space-y-5">
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="kyb-registration-no" label={t("registration_no")} hint={t("registration_no_hint")} error={errors.registration_no}>
              <Input value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} maxLength={60} autoComplete="off" />
            </Field>
            <Field
              id="kyb-pan-no"
              label={t("pan_no")}
              optional
              optionalLabel={tAll("common.optional")}
              hint={v.pan_no_masked ? t("pan_on_file", { pan: v.pan_no_masked }) : t("pan_hint")}
              error={errors.pan_no}
            >
              <Input value={panNo} onChange={(e) => setPanNo(e.target.value)} maxLength={20} inputMode="numeric" autoComplete="off" />
            </Field>
          </div>
          <Field id="kyb-registration-doc" label={t("registration_doc")} hint={t("registration_doc_hint")} error={errors.registration_doc}>
            <KybFileInput
              id="kyb-registration-doc"
              file={regDoc}
              currentName={v.registration_doc_name}
              onChange={(file) => pick("registration_doc", file)}
              disabled={submit.isPending}
            />
          </Field>
          <Field id="kyb-pan-doc" label={t("pan_doc")} hint={t("pan_doc_hint")} error={errors.pan_doc}>
            <KybFileInput
              id="kyb-pan-doc"
              file={panDoc}
              currentName={v.pan_doc_name}
              onChange={(file) => pick("pan_doc", file)}
              disabled={submit.isPending}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {onCancel ? (
              <Button variant="secondary" onClick={onCancel} disabled={submit.isPending}>
                {tAll("common.cancel")}
              </Button>
            ) : null}
            <Button type="submit" loading={submit.isPending}>
              {resubmit ? t("resubmit") : t("submit")}
            </Button>
          </div>
        </CardBody>
      </form>
    </Card>
  );
}
