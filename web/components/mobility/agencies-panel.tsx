"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Building2, CheckCircle2, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsDatePicker } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useOpsAgencies, useSetAgencyCompliance } from "@/lib/api/hooks/mobility";
import {
  AGENCY_COMPLIANCE_STATUSES,
  type AgencyComplianceStatus,
  type OpsAgency,
} from "@/lib/api/types-mobility";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { COMPLIANCE_TONE } from "./shared";

export const DOFE_URL = "https://dofe.gov.np";
type Filter = AgencyComplianceStatus | "all";

/** Recruitment-agency licence compliance (verify / suspend), with licence validity at a glance. */
export function AgenciesPanel() {
  const t = useTranslations("mobility.agencies");
  const tcs = useTranslations("mobility.agencies.compliance_status");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [dialog, setDialog] = React.useState<{
    agency: OpsAgency;
    action: "verify" | "suspend";
  } | null>(null);
  const query = useOpsAgencies({
    compliance_status: filter === "all" ? undefined : filter,
    q: q || undefined,
    page_size: 100,
  });
  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented
          label={t("filter_label")}
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: "all" as Filter, label: t("filter_all") },
            ...AGENCY_COMPLIANCE_STATUSES.map((s) => ({ value: s as Filter, label: tcs(s) })),
          ]}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={t("search_placeholder")}
          className="sm:max-w-xs sm:flex-1"
        />
        <Button asChild variant="secondary" size="sm" className="sm:ml-auto">
          <a href={DOFE_URL} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden />
            {t("check_dofe")}
          </a>
        </Button>
      </div>
      {query.isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("name")}</Th>
                <Th>{t("license")}</Th>
                <Th>{t("valid_until")}</Th>
                <Th>{t("compliance")}</Th>
                <Th numeric>{t("shares")}</Th>
                <Th className="text-right">{t("actions")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((a) => (
                <AgencyRow
                  key={a.id}
                  agency={a}
                  onAction={(action) => setDialog({ agency: a, action })}
                />
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {dialog ? (
        <ComplianceDialog
          key={dialog.agency.id + dialog.action}
          agency={dialog.agency}
          action={dialog.action}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function AgencyRow({
  agency: a,
  onAction,
}: {
  agency: OpsAgency;
  onAction: (a: "verify" | "suspend") => void;
}) {
  const t = useTranslations("mobility.agencies");
  const f = useFormat();
  const days = a.license_days_left;
  const validTone =
    days === null
      ? "text-fg-muted"
      : days < 0
        ? "text-danger"
        : days <= 60
          ? "text-warning"
          : "text-fg-muted";
  return (
    <Tr>
      <Td>
        <p className="text-fg font-medium">{a.name}</p>
        <p className="text-fg-muted flex items-center gap-1 text-xs">
          {a.eligible ? (
            <CheckCircle2 className="text-success size-3.5" aria-hidden />
          ) : (
            <XCircle className="text-fg-subtle size-3.5" aria-hidden />
          )}
          {a.eligible ? t("eligible") : t("not_eligible")}
        </p>
      </Td>
      <Td>
        <span className="tabular text-sm">{a.license_no || "—"}</span>
      </Td>
      <Td>
        {a.license_valid_until ? (
          <>
            <p className="tabular text-fg text-sm">
              {f.date(a.license_valid_until, a.license_valid_until_bs).bs}
            </p>
            <p className={cn("text-xs font-medium", validTone)}>
              {days !== null && days < 0 ? t("expired") : t("days_left", { days: days ?? 0 })}
            </p>
          </>
        ) : (
          <span className="text-fg-muted text-xs">{t("no_license_date")}</span>
        )}
      </Td>
      <Td>
        <Badge tone={COMPLIANCE_TONE[a.compliance_status]} dot>
          {a.compliance_status_label}
        </Badge>
        {a.compliance_verified_by && a.compliance_verified_at ? (
          <p className="text-fg-muted mt-1 text-xs">
            {t("verified_by", {
              name: a.compliance_verified_by.full_name,
              date: f.dateText(a.compliance_verified_at.slice(0, 10)),
            })}
          </p>
        ) : null}
        {a.compliance_note ? (
          <p className="text-fg-muted mt-0.5 line-clamp-2 max-w-xs text-xs">{a.compliance_note}</p>
        ) : null}
      </Td>
      <Td numeric>{a.active_shares === null ? "—" : f.digits(a.active_shares)}</Td>
      <Td className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant={a.compliance_status === "verified" ? "secondary" : "primary"}
            onClick={() => onAction("verify")}
          >
            <ShieldCheck aria-hidden />
            {a.compliance_status === "suspended" ? t("reinstate") : t("verify")}
          </Button>
          {a.compliance_status !== "suspended" ? (
            <Button size="sm" variant="ghost" onClick={() => onAction("suspend")}>
              <Ban aria-hidden />
              {t("suspend")}
            </Button>
          ) : null}
        </div>
      </Td>
    </Tr>
  );
}

function ComplianceDialog({
  agency,
  action,
  onClose,
}: {
  agency: OpsAgency;
  action: "verify" | "suspend";
  onClose: () => void;
}) {
  const t = useTranslations("mobility.agencies");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const save = useSetAgencyCompliance();
  const [licenseNo, setLicenseNo] = React.useState(agency.license_no ?? "");
  const [until, setUntil] = React.useState(agency.license_valid_until ?? "");
  const [note, setNote] = React.useState(
    action === "suspend" ? "" : (agency.compliance_note ?? ""),
  );
  const [error, setError] = React.useState<{ until?: string; note?: string }>({});
  const today = new Date().toISOString().slice(0, 10);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof error = {};
    if (action === "verify" && (!until || until < today)) errs.until = t("date_required");
    if (action === "suspend" && !note.trim()) errs.note = t("note_required");
    setError(errs);
    if (Object.keys(errs).length) return;
    save.mutate(
      action === "verify"
        ? {
            id: agency.id,
            status: "verified",
            license_valid_until: until,
            license_no: licenseNo.trim() || undefined,
            note: note.trim(),
          }
        : { id: agency.id, status: "suspended", note: note.trim() },
      {
        onSuccess: (a) => {
          toast.success(
            action === "verify"
              ? t("saved_verified", { name: a.name })
              : t("saved_suspended", { name: a.name }),
          );
          onClose();
        },
        onError: (err) => toastError(err, tRoot),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent closeLabel={tc("close")}>
        <form onSubmit={submit} noValidate>
          <DialogHeader
            title={
              action === "verify"
                ? t("dialog_verify_title", { name: agency.name })
                : t("dialog_suspend_title", { name: agency.name })
            }
            description={action === "verify" ? t("dialog_verify_body") : t("dialog_suspend_body")}
          />
          <DialogBody className="space-y-4">
            {action === "verify" ? (
              <>
                <Field id="agency-license-no" label={t("license_no")}>
                  <Input
                    value={licenseNo}
                    onChange={(e) => setLicenseNo(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  id="agency-license-until"
                  label={t("license_valid_until")}
                  error={error.until}
                >
                  <BsDatePicker value={until || null} onChange={setUntil} min={today} />
                </Field>
                <a
                  href={DOFE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand inline-flex items-center gap-1 text-sm hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  {t("check_dofe")}
                </a>
              </>
            ) : null}
            <Field
              id="agency-note"
              label={t("note")}
              error={error.note}
              optional={action === "verify"}
              optionalLabel={tc("optional")}
            >
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              variant={action === "suspend" ? "danger" : "primary"}
              loading={save.isPending}
            >
              {action === "verify" ? t("verify") : t("suspend")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
