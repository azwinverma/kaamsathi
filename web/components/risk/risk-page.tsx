"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Flag, ShieldAlert, ShieldCheck, Siren, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HBarList } from "@/components/insights/charts";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Segmented } from "@/components/ui/segmented";
import { NativeSelect } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import { useCreateRiskFlag, useResolveRiskFlag, useRiskFlags, useRiskSummary } from "@/lib/api/hooks/risk";
import {
  RISK_KINDS,
  RISK_SEVERITIES,
  RISK_SUBJECT_TYPES,
  type RiskFlag,
  type RiskFlagStatus,
  type RiskSeverity,
  type RiskSubjectType,
} from "@/lib/api/types-risk";
import { useFormat } from "@/lib/use-format";
import { RiskTrendBars } from "./trend-bars";

const PAGE_SIZE = 25;
type Tab = RiskFlagStatus | "all";
const TABS: Tab[] = ["open", "confirmed", "dismissed", "all"];

export const SEVERITY_TONE: Record<RiskSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const STATUS_TONE: Record<RiskFlagStatus, BadgeTone> = { open: "brand", confirmed: "danger", dismissed: "neutral" };

export function SeverityBadge({ severity, label }: { severity: RiskSeverity; label?: string }) {
  const t = useTranslations("risk.severity");
  return (
    <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} dot>
      {label || t(severity)}
    </Badge>
  );
}

/** /ops/risk — fraud flags with filters, resolve dialog, summary cards and a 30-day trend. */
export function RiskPage() {
  const t = useTranslations("risk.flags");
  const tn = useTranslations("nav");
  const tAll = useTranslations();
  const params = useSearchParams();
  const subjectId = params.get("subject_id") ?? undefined;
  const [tab, setTab] = React.useState<Tab>("open");
  const [kind, setKind] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [subjectType, setSubjectType] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [resolving, setResolving] = React.useState<RiskFlag | null>(null);
  const [creating, setCreating] = React.useState(false);
  React.useEffect(() => setPage(1), [tab, kind, severity, subjectType]);

  const summary = useRiskSummary();
  const query = useRiskFlags({
    status: tab === "all" ? undefined : tab,
    kind: kind || undefined,
    severity: severity || undefined,
    subject_type: subjectType || undefined,
    subject_id: subjectId,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];
  const s = summary.data;
  const filtered = !!(kind || severity || subjectType || subjectId);

  return (
    <div>
      <PageHeader
        title={tn("ops_risk")}
        description={t("description")}
        actions={
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Flag aria-hidden />
            {t("raise_manual")}
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stat_open")} value={s?.open ?? "—"} icon={ShieldAlert} tone="brand" loading={summary.isLoading} />
        <StatCard label={t("stat_high")} value={s?.open_high ?? "—"} icon={Siren} tone="danger" loading={summary.isLoading} />
        <StatCard label={t("stat_raised")} value={s?.created_30d ?? "—"} icon={Flag} loading={summary.isLoading} hint={t("last_30_days")} />
        <StatCard
          label={t("stat_confirmed")}
          value={s?.confirmed_30d ?? "—"}
          icon={ShieldCheck}
          tone="warning"
          loading={summary.isLoading}
          hint={t("resolved_30d", { count: s?.resolved_30d ?? 0 })}
        />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {summary.isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : s ? (
          <RiskTrendBars trend={s.trend} />
        ) : summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        ) : null}
        <Card className="min-w-0">
          <CardHeader title={t("by_kind_title")} description={t("by_kind_description")} />
          <CardBody>
            {s ? (
              <HBarList
                ariaLabel={t("by_kind_title")}
                emptyLabel={t("no_open")}
                rows={s.by_kind
                  .filter((r) => r.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map((r) => ({ key: r.key, label: r.label, value: r.count, display: String(r.count) }))}
              />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardBody>
        </Card>
      </div>

      <Toolbar>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {TABS.map((x) => (
              <TabsTrigger key={x} value={x}>
                {t(`tab_${x}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <NativeSelect
          aria-label={t("kind")}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          placeholder={t("any_kind")}
          options={RISK_KINDS.map((k) => ({ value: k, label: tAll(`risk.kind.${k}`) }))}
          className="sm:w-52"
        />
        <NativeSelect
          aria-label={t("severity")}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          placeholder={t("any_severity")}
          options={RISK_SEVERITIES.map((k) => ({ value: k, label: tAll(`risk.severity.${k}`) }))}
          className="sm:w-40"
        />
        <NativeSelect
          aria-label={t("subject_type")}
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value)}
          placeholder={t("any_subject")}
          options={RISK_SUBJECT_TYPES.map((k) => ({ value: k, label: tAll(`risk.subject.${k}`) }))}
          className="sm:w-44"
        />
        {subjectId ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/ops/risk">{t("clear_subject")}</Link>
          </Button>
        ) : null}
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={filtered ? tAll("common.no_results") : t(`empty_${tab}`)}
          description={filtered ? undefined : t("empty_hint")}
        />
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{t("severity")}</Th>
                  <Th>{t("flag")}</Th>
                  <Th>{t("subject")}</Th>
                  <Th className="max-lg:hidden">{t("detected")}</Th>
                  <Th>{tAll("common.status")}</Th>
                  <Th className="text-right">
                    <span className="sr-only">{tAll("common.actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((f) => (
                  <FlagRow key={f.id} f={f} onResolve={() => setResolving(f)} />
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
      <ResolveDialog flag={resolving} onClose={() => setResolving(null)} />
      <ManualFlagDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function Matches({ f }: { f: RiskFlag }) {
  const t = useTranslations("risk.flags");
  const people = f.details.matches ?? [];
  if (!people.length) return null;
  return (
    <p className="text-xs text-fg-muted">
      {t("matches")}{" "}
      {people.map((p, i) => (
        <React.Fragment key={p.worker_id}>
          {i > 0 ? ", " : null}
          <Link href={`/ops/workers/${p.worker_id}`} className="text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
            {p.full_name}
          </Link>
        </React.Fragment>
      ))}
    </p>
  );
}

function FlagRow({ f, onResolve }: { f: RiskFlag; onResolve: () => void }) {
  const t = useTranslations("risk.flags");
  const fmt = useFormat();
  return (
    <Tr>
      <Td>
        <SeverityBadge severity={f.severity} label={f.severity_label} />
      </Td>
      <Td className="max-w-96 py-2">
        <span className="block font-medium text-fg">{f.kind_label}</span>
        {f.reasons.length ? <span className="block text-xs text-fg-body">{f.reasons.join(" · ")}</span> : null}
        {f.details.note ? <span className="block text-xs text-fg-body">“{f.details.note}”</span> : null}
        {f.details.organizations?.length ? (
          <span className="block text-xs text-fg-muted">{f.details.organizations.join(", ")}</span>
        ) : null}
        <Matches f={f} />
      </Td>
      <Td className="py-2">
        <span className="block text-xs text-fg-muted">{f.subject_type_label}</span>
        {f.subject.link ? (
          <Link href={f.subject.link} className="font-medium text-brand hover:underline">
            {f.subject.label ?? f.subject_id}
          </Link>
        ) : (
          <span className="text-fg">{f.subject.label ?? t("subject_missing")}</span>
        )}
      </Td>
      <Td className="text-xs whitespace-nowrap text-fg-muted max-lg:hidden">{fmt.dateTime(f.created_at)}</Td>
      <Td className="py-2">
        <Badge tone={STATUS_TONE[f.status]} dot>
          {f.status_label}
        </Badge>
        {f.resolved_by ? (
          <span className="mt-0.5 block text-[11px] text-fg-muted">
            {f.resolved_by.full_name} · {fmt.dateTime(f.resolved_at)}
          </span>
        ) : null}
      </Td>
      <Td className="text-right">
        {f.status === "open" ? (
          <Button size="sm" onClick={onResolve}>
            {t("resolve")}
          </Button>
        ) : f.note ? (
          <span className="line-clamp-2 max-w-48 text-left text-xs text-fg-muted" title={f.note}>
            {f.note}
          </span>
        ) : null}
      </Td>
    </Tr>
  );
}

function ResolveDialog({ flag, onClose }: { flag: RiskFlag | null; onClose: () => void }) {
  const t = useTranslations("risk.flags");
  const tAll = useTranslations();
  const resolve = useResolveRiskFlag();
  const [status, setStatus] = React.useState<"confirmed" | "dismissed">("dismissed");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setStatus("dismissed");
    setNote("");
    setError(null);
  }, [flag]);
  if (!flag) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError(t("note_required"));
      return;
    }
    resolve.mutate(
      { id: flag.id, status, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(status === "confirmed" ? t("confirmed_toast") : t("dismissed_toast"));
          onClose();
        },
        onError: (err) => setError(isApiError(err) ? err.message || tAll(`errors.${err.code}`) : tAll("errors.server_error")),
      },
    );
  };
  return (
    <Dialog open={!!flag} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={t("resolve_title")} description={`${flag.kind_label} · ${flag.subject.label ?? flag.subject_id}`} />
          <DialogBody className="space-y-4">
            {flag.reasons.length ? (
              <ul className="list-disc space-y-1 rounded-md bg-surface-muted py-2 pr-3 pl-7 text-sm text-fg-body">
                {flag.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            <Matches f={flag} />
            <FormError message={error} />
            <Segmented
              label={t("decision")}
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: "dismissed",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="size-4" aria-hidden />
                      {t("dismiss")}
                    </span>
                  ),
                },
                {
                  value: "confirmed",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {t("confirm")}
                    </span>
                  ),
                },
              ]}
            />
            <Field id="flag-note" label={t("note")} hint={status === "confirmed" ? t("confirm_hint") : t("dismiss_hint")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={resolve.isPending}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" variant={status === "confirmed" ? "danger" : "primary"} loading={resolve.isPending}>
              {status === "confirmed" ? t("confirm") : t("dismiss")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManualFlagDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("risk.flags");
  const tAll = useTranslations();
  const create = useCreateRiskFlag();
  const params = useSearchParams();
  const [subjectType, setSubjectType] = React.useState<RiskSubjectType>("worker");
  const [subjectId, setSubjectId] = React.useState("");
  const [severity, setSeverity] = React.useState<RiskSeverity>("medium");
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!open) return;
    setSubjectType("worker");
    setSubjectId(params.get("subject_id") ?? "");
    setSeverity("medium");
    setNote("");
    setErrors({});
  }, [open, params]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!subjectId.trim()) next.subject_id = tAll("errors.required");
    if (!note.trim()) next.note = tAll("errors.required");
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate(
      { subject_type: subjectType, subject_id: subjectId.trim(), severity, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t("created_toast"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err)) {
            const fields: Record<string, string> = {};
            for (const [k, msgs] of Object.entries(err.fields ?? {})) fields[k] = msgs[0];
            setErrors({ ...fields, form: Object.keys(fields).length ? "" : err.message });
          } else setErrors({ form: tAll("errors.server_error") });
        },
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={t("manual_title")} description={t("manual_description")} />
          <DialogBody className="space-y-4">
            <FormError message={errors.form || null} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="manual-subject-type" label={t("subject_type")}>
                <NativeSelect
                  value={subjectType}
                  onChange={(e) => setSubjectType(e.target.value as RiskSubjectType)}
                  options={RISK_SUBJECT_TYPES.map((k) => ({ value: k, label: tAll(`risk.subject.${k}`) }))}
                />
              </Field>
              <Field id="manual-severity" label={t("severity")}>
                <NativeSelect
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as RiskSeverity)}
                  options={RISK_SEVERITIES.map((k) => ({ value: k, label: tAll(`risk.severity.${k}`) }))}
                />
              </Field>
            </div>
            <Field id="manual-subject-id" label={t("subject_id")} hint={t("subject_id_hint")} error={errors.subject_id}>
              <Input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="font-mono text-xs" autoComplete="off" />
            </Field>
            <Field id="manual-note" label={t("note")} error={errors.note}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t("raise_manual")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
