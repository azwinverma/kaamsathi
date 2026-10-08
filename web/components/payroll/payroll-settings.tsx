"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, SwitchField } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, PrefixInput } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/select";
import { listResults } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useContractors } from "@/lib/api/hooks/compliance";
import { useSites } from "@/lib/api/hooks/org";
import {
  useDeletePayGroup,
  usePayGroups,
  usePayPolicy,
  useSavePayGroup,
  useUpdatePayPolicy,
} from "@/lib/api/hooks/payroll";
import type {
  FestivalAllowanceRule,
  PayGroup,
  PayPolicy,
  PayPolicyUpdate,
  PayRounding,
  WageType,
} from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { PayrollGate } from "./payroll-gate";

const WAGE_TYPES: WageType[] = ["monthly", "daily", "hourly"];

/** /app/payroll/settings — pay rules (R003) and pay groups (R001). */
export function PayrollSettingsPage() {
  return (
    <PayrollGate>
      <Settings />
    </PayrollGate>
  );
}

function Settings() {
  const t = useTranslations("payroll_config");
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/payroll">
              <ArrowLeft aria-hidden />
              {t("back")}
            </Link>
          </Button>
        }
      />
      <PolicyCard />
      <GroupsCard />
    </div>
  );
}

// ------------------------------------------------------------------ pay policy (R003)
function PolicyCard() {
  const t = useTranslations("payroll_config.policy");
  const tAll = useTranslations();
  const f = useFormat();
  const { isAdmin } = useSession();
  const policy = usePayPolicy();
  const save = useUpdatePayPolicy();
  const [draft, setDraft] = React.useState<PayPolicy | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (policy.data) setDraft(policy.data);
  }, [policy.data]);

  if (policy.isError) return <ErrorState error={policy.error} onRetry={() => policy.refetch()} />;
  if (!draft) return <Skeleton className="h-64 w-full" />;

  const set = <K extends keyof PayPolicy>(k: K, v: PayPolicy[K]) => setDraft({ ...draft, [k]: v });
  const disabled = !isAdmin || save.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const body: PayPolicyUpdate = {
      ot_multiplier: draft.ot_multiplier,
      festival_allowance_rule: draft.festival_allowance_rule,
      festival_custom_amount: draft.festival_custom_amount || "0",
      festival_month: draft.festival_month,
      rounding: draft.rounding,
      weekly_off_paid: draft.weekly_off_paid,
      half_day_fraction: draft.half_day_fraction,
    };
    save.mutate(body, {
      onSuccess: () => toast.success(t("saved")),
      onError: (err) => {
        if (isApiError(err) && err.fields && Object.keys(err.fields).length) {
          setErrors(
            Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0] ?? ""])),
          );
        } else toastError(err, tAll);
      },
    });
  };

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={draft.is_default ? t("defaults_note") : t("custom_note")}
        action={draft.is_default ? <Badge tone="outline">{t("default_badge")}</Badge> : null}
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="pp-ot"
              label={t("ot_multiplier")}
              hint={t("ot_multiplier_hint")}
              error={errors.ot_multiplier}
            >
              <PrefixInput
                prefix="×"
                inputMode="decimal"
                value={draft.ot_multiplier}
                disabled={disabled}
                onChange={(e) => set("ot_multiplier", e.target.value)}
              />
            </Field>
            <Field
              id="pp-half"
              label={t("half_day_fraction")}
              hint={t("half_day_fraction_hint")}
              error={errors.half_day_fraction}
            >
              <Input
                inputMode="decimal"
                value={draft.half_day_fraction}
                disabled={disabled}
                onChange={(e) => set("half_day_fraction", e.target.value)}
              />
            </Field>
            <Field
              id="pp-festival-rule"
              label={t("festival_rule")}
              error={errors.festival_allowance_rule}
            >
              <NativeSelect
                value={draft.festival_allowance_rule}
                disabled={disabled}
                onChange={(e) =>
                  set("festival_allowance_rule", e.target.value as FestivalAllowanceRule)
                }
                options={(["one_month_basic", "custom_amount", "none"] as const).map((v) => ({
                  value: v,
                  label: t(`festival_rules.${v}`),
                }))}
              />
            </Field>
            {draft.festival_allowance_rule === "custom_amount" ? (
              <Field
                id="pp-festival-amount"
                label={t("festival_amount")}
                hint={t("festival_amount_hint")}
                error={errors.festival_custom_amount}
              >
                <PrefixInput
                  prefix={tAll("term.npr")}
                  inputMode="decimal"
                  value={draft.festival_custom_amount}
                  disabled={disabled}
                  onChange={(e) => set("festival_custom_amount", e.target.value)}
                />
              </Field>
            ) : null}
            <Field
              id="pp-festival-month"
              label={t("festival_month")}
              hint={t("festival_month_hint")}
              error={errors.festival_month}
            >
              <NativeSelect
                value={draft.festival_month === null ? "" : String(draft.festival_month)}
                disabled={disabled}
                onChange={(e) =>
                  set("festival_month", e.target.value ? Number(e.target.value) : null)
                }
                placeholder={t("festival_month_none")}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: f.monthName(i + 1),
                }))}
              />
            </Field>
            <Field id="pp-rounding" label={t("rounding")} error={errors.rounding}>
              <NativeSelect
                value={draft.rounding}
                disabled={disabled}
                onChange={(e) => set("rounding", e.target.value as PayRounding)}
                options={(["two_decimals", "nearest_rupee"] as const).map((v) => ({
                  value: v,
                  label: t(`roundings.${v}`),
                }))}
              />
            </Field>
          </div>
          <SwitchField
            id="pp-weekly-off"
            label={t("weekly_off_paid")}
            description={t("weekly_off_paid_hint")}
            checked={draft.weekly_off_paid}
            disabled={disabled}
            onCheckedChange={(v) => set("weekly_off_paid", v)}
          />
          {isAdmin ? (
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending}>
                {t("save")}
              </Button>
            </div>
          ) : (
            <p className="text-fg-muted text-xs">{t("admin_only")}</p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ pay groups (R001)
function GroupsCard() {
  const t = useTranslations("payroll_config.groups");
  const tAll = useTranslations();
  const groups = usePayGroups();
  const sites = useSites();
  const contractors = useContractors();
  const remove = useDeletePayGroup();
  const [editing, setEditing] = React.useState<PayGroup | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<PayGroup | null>(null);
  const siteName = React.useMemo(
    () => new Map(listResults(sites.data).map((s) => [s.id, s.name])),
    [sites.data],
  );
  const contractorName = React.useMemo(
    () => new Map(listResults(contractors.data).map((c) => [c.id, c.name])),
    [contractors.data],
  );

  const criteria = (g: PayGroup) => {
    const parts: string[] = [];
    if (g.site_ids.length) parts.push(g.site_ids.map((id) => siteName.get(id) ?? "—").join(", "));
    if (g.wage_types.length) parts.push(g.wage_types.map((w) => tAll(`term.${w}`)).join(", "));
    if (g.contractor_ids.length)
      parts.push(g.contractor_ids.map((id) => contractorName.get(id) ?? "—").join(", "));
    return parts.length ? parts.join(" · ") : t("everyone");
  };

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        }
      />
      <CardBody>
        {groups.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : groups.isError ? (
          <ErrorState error={groups.error} onRetry={() => groups.refetch()} />
        ) : !groups.data?.length ? (
          <EmptyState icon={Layers} title={t("empty_title")} description={t("empty_body")} />
        ) : (
          <ul className="divide-border divide-y">
            {groups.data.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-fg flex flex-wrap items-center gap-2 font-medium">
                    {g.name}
                    {!g.is_active ? <Badge tone="outline">{t("inactive")}</Badge> : null}
                    {g.pay_day ? (
                      <Badge tone="neutral">{t("pay_day_badge", { day: g.pay_day })}</Badge>
                    ) : null}
                  </p>
                  <p className="text-fg-muted text-xs">{criteria(g)}</p>
                  <p className="text-fg-muted text-xs">
                    {t("members", { count: g.employment_count ?? 0 })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(g)}>
                    <Pencil aria-hidden />
                    {tAll("common.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(g)}
                    aria-label={t("delete_label", { name: g.name })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-fg-muted mt-3 text-xs">{t("rule_note")}</p>
      </CardBody>

      <GroupDialog
        group={editing}
        onClose={() => setEditing(null)}
        sites={listResults(sites.data).map((s) => ({ id: s.id, name: s.name }))}
        contractors={listResults(contractors.data).map((c) => ({ id: c.id, name: c.name }))}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("delete_title")}
        description={t("delete_body", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete_confirm")}
        danger
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setDeleting(null);
            },
            onError: (err) => {
              toastError(err, tAll);
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

function GroupDialog({
  group,
  onClose,
  sites,
  contractors,
}: {
  group: PayGroup | "new" | null;
  onClose: () => void;
  sites: { id: string; name: string }[];
  contractors: { id: string; name: string }[];
}) {
  const t = useTranslations("payroll_config.groups");
  const tAll = useTranslations();
  const save = useSavePayGroup();
  const open = group !== null;
  const existing = group && group !== "new" ? group : null;
  const [name, setName] = React.useState("");
  const [siteIds, setSiteIds] = React.useState<string[]>([]);
  const [wageTypes, setWageTypes] = React.useState<WageType[]>([]);
  const [contractorIds, setContractorIds] = React.useState<string[]>([]);
  const [payDay, setPayDay] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setSiteIds(existing?.site_ids ?? []);
    setWageTypes(existing?.wage_types ?? []);
    setContractorIds(existing?.contractor_ids ?? []);
    setPayDay(existing?.pay_day ? String(existing.pay_day) : "");
    setActive(existing?.is_active ?? true);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const toggle = <T extends string>(list: T[], v: T, setter: (l: T[]) => void) =>
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: tAll("errors.required") });
      return;
    }
    save.mutate(
      {
        id: existing?.id,
        name: name.trim(),
        site_ids: siteIds,
        wage_types: wageTypes,
        contractor_ids: contractorIds,
        pay_day: payDay ? Number(payDay) : null,
        is_active: active,
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          if (isApiError(err) && err.fields && Object.keys(err.fields).length) {
            setErrors(
              Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0] ?? ""])),
            );
          } else toastError(err, tAll);
        },
      },
    );
  };

  const CheckList = ({
    legend,
    items,
    selected,
    onToggle,
    error,
  }: {
    legend: string;
    items: { id: string; name: string }[];
    selected: string[];
    onToggle: (id: string) => void;
    error?: string;
  }) => (
    <fieldset className="space-y-2">
      <legend className="text-fg text-sm font-medium">{legend}</legend>
      {items.length === 0 ? (
        <p className="text-fg-muted text-xs">{t("none_available")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((it) => (
            <label key={it.id} className="text-fg-body flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(it.id)}
                onCheckedChange={() => onToggle(it.id)}
              />
              {it.name}
            </label>
          ))}
        </div>
      )}
      <FormError message={error} />
    </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader
            title={existing ? t("edit_title") : t("add_title")}
            description={t("dialog_description")}
          />
          <DialogBody className="space-y-5">
            <Field id="pg-name" label={t("name")} error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
            <CheckList
              legend={t("wage_types")}
              items={WAGE_TYPES.map((w) => ({ id: w, name: tAll(`term.${w}`) }))}
              selected={wageTypes}
              onToggle={(id) => toggle(wageTypes, id as WageType, setWageTypes)}
              error={errors.wage_types}
            />
            <CheckList
              legend={t("sites")}
              items={sites}
              selected={siteIds}
              onToggle={(id) => toggle(siteIds, id, setSiteIds)}
              error={errors.site_ids}
            />
            <CheckList
              legend={t("contractors")}
              items={contractors}
              selected={contractorIds}
              onToggle={(id) => toggle(contractorIds, id, setContractorIds)}
              error={errors.contractor_ids}
            />
            <p className="text-fg-muted text-xs">{t("criteria_hint")}</p>
            <Field
              id="pg-pay-day"
              label={t("pay_day")}
              hint={t("pay_day_hint")}
              optional
              optionalLabel={tAll("common.optional")}
              error={errors.pay_day}
            >
              <Input
                inputMode="numeric"
                value={payDay}
                onChange={(e) => setPayDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </Field>
            <SwitchField
              id="pg-active"
              label={t("active")}
              description={t("active_hint")}
              checked={active}
              onCheckedChange={setActive}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
