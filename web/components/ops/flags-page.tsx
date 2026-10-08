"use client";
import * as React from "react";
import { Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RequireStaffRole } from "@/components/security/require-staff-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { isApiError } from "@/lib/api/errors";
import { useDeleteFlag, useOpsFlags, useSaveFlag } from "@/lib/api/hooks/flags";
import type { FeatureFlag, FlagRollout } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

type Draft = {
  key: string;
  description: string;
  enabled: boolean;
  rollout: FlagRollout;
  org_ids: string;
  percent: string;
  client_visible: boolean;
};

const empty = (key = ""): Draft => ({
  key,
  description: "",
  enabled: false,
  rollout: "all",
  org_ids: "",
  percent: "0",
  client_visible: false,
});

/** /ops/flags — runtime feature flags (superadmin; every change is audited). */
export function OpsFlagsPage() {
  return (
    <RequireStaffRole roles={["superadmin"]}>
      <Flags />
    </RequireStaffRole>
  );
}

function Flags() {
  const t = useTranslations("ops_flags");
  const tAll = useTranslations();
  const f = useFormat();
  const flags = useOpsFlags();
  const remove = useDeleteFlag();
  const [editing, setEditing] = React.useState<{ draft: Draft; create: boolean } | null>(null);
  const [deleting, setDeleting] = React.useState<FeatureFlag | null>(null);

  const rolloutText = (fl: FeatureFlag) =>
    fl.rollout === "orgs"
      ? t("rollout_orgs_count", { count: fl.org_ids.length })
      : fl.rollout === "percent"
        ? t("rollout_percent_value", { percent: fl.percent })
        : t("rollout.all");

  const openEdit = (fl: FeatureFlag) =>
    setEditing({
      create: false,
      draft: {
        key: fl.key,
        description: fl.description,
        enabled: fl.enabled,
        rollout: fl.rollout,
        org_ids: fl.org_ids.join("\n"),
        percent: String(fl.percent),
        client_visible: fl.client_visible,
      },
    });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button onClick={() => setEditing({ draft: empty(), create: true })}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        }
      />
      {flags.isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : flags.isError ? (
        <ErrorState error={flags.error} onRetry={() => flags.refetch()} />
      ) : (
        <div className="space-y-8">
          {flags.data?.results.length ? (
            <TableContainer>
              <Table className="min-w-[720px]">
                <THead>
                  <tr>
                    <Th>{t("col_key")}</Th>
                    <Th>{t("col_state")}</Th>
                    <Th>{t("col_rollout")}</Th>
                    <Th>{t("col_updated")}</Th>
                    <Th className="sr-only">{t("col_actions")}</Th>
                  </tr>
                </THead>
                <TBody>
                  {flags.data.results.map((fl) => (
                    <Tr key={fl.key}>
                      <RowHeader>
                        <span className="text-fg font-mono text-sm">{fl.key}</span>
                        {fl.client_visible ? (
                          <Badge tone="outline" className="ml-2">
                            {t("client_badge")}
                          </Badge>
                        ) : null}
                        {fl.description ? (
                          <p className="text-fg-muted text-xs">{fl.description}</p>
                        ) : null}
                      </RowHeader>
                      <Td>
                        <Badge tone={fl.enabled ? "success" : "neutral"} dot>
                          {fl.enabled ? t("on") : t("off")}
                        </Badge>
                      </Td>
                      <Td className="text-sm">{rolloutText(fl)}</Td>
                      <Td className="text-fg-muted text-xs">
                        {f.dateTime(fl.updated_at)}
                        {fl.updated_by ? (
                          <span className="block">{fl.updated_by.full_name}</span>
                        ) : null}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(fl)}
                          aria-label={t("edit_label", { key: fl.key })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(fl)}
                          aria-label={t("delete_label", { key: fl.key })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState icon={Flag} title={t("empty_title")} description={t("empty_body")} />
          )}

          {flags.data?.settings_defaults.length ? (
            <section aria-labelledby="flag-defaults" className="space-y-2">
              <h2 id="flag-defaults" className="text-fg text-sm font-semibold">
                {t("defaults_heading")}
              </h2>
              <p className="text-fg-muted text-xs">{t("defaults_body")}</p>
              <ul className="divide-border border-border divide-y rounded-md border">
                {flags.data.settings_defaults.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-mono text-sm">{d.key}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={d.default ? "success" : "neutral"}>
                        {d.default ? t("on") : t("off")}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setEditing({
                            draft: { ...empty(d.key), enabled: d.default },
                            create: true,
                          })
                        }
                      >
                        {t("override")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <FlagDialog state={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("delete_title")}
        description={t("delete_body", { key: deleting?.key ?? "" })}
        confirmLabel={t("delete_confirm")}
        danger
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.key, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setDeleting(null);
            },
            onError: (err) => toastError(err, tAll),
          })
        }
      />
    </>
  );
}

function FlagDialog({
  state,
  onClose,
}: {
  state: { draft: Draft; create: boolean } | null;
  onClose: () => void;
}) {
  const t = useTranslations("ops_flags");
  const tAll = useTranslations();
  const save = useSaveFlag();
  const [d, setD] = React.useState<Draft>(empty());
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (state) {
      setD(state.draft);
      setErrors({});
    }
  }, [state]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    save.mutate(
      {
        create: state.create,
        key: d.key.trim(),
        description: d.description,
        enabled: d.enabled,
        rollout: d.rollout,
        org_ids: d.org_ids
          .split(/[\s,]+/)
          .map((x) => x.trim())
          .filter(Boolean),
        percent: Number(d.percent) || 0,
        client_visible: d.client_visible,
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

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader
            title={state?.create ? t("new") : t("edit_title")}
            description={t("dialog_description")}
          />
          <DialogBody className="space-y-4">
            <Field id="flag-key" label={t("key")} hint={t("key_hint")} error={errors.key}>
              <Input
                value={d.key}
                disabled={!state?.create}
                onChange={(e) => set("key", e.target.value.toLowerCase())}
                className="font-mono"
                maxLength={64}
              />
            </Field>
            <Field
              id="flag-desc"
              label={t("description")}
              optional
              optionalLabel={tAll("common.optional")}
              error={errors.description}
            >
              <Input
                value={d.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={255}
              />
            </Field>
            <SwitchField
              id="flag-enabled"
              label={t("enabled")}
              description={t("enabled_hint")}
              checked={d.enabled}
              onCheckedChange={(v) => set("enabled", v)}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-fg text-sm font-medium">{t("col_rollout")}</span>
              <Segmented<FlagRollout>
                label={t("col_rollout")}
                value={d.rollout}
                onChange={(v) => set("rollout", v)}
                options={(["all", "orgs", "percent"] as const).map((v) => ({
                  value: v,
                  label: t(`rollout.${v}`),
                }))}
                className="self-start"
              />
            </div>
            {d.rollout === "orgs" ? (
              <Field
                id="flag-orgs"
                label={t("org_ids")}
                hint={t("org_ids_hint")}
                error={errors.org_ids}
              >
                <Textarea
                  rows={3}
                  value={d.org_ids}
                  onChange={(e) => set("org_ids", e.target.value)}
                  className="font-mono text-xs"
                />
              </Field>
            ) : null}
            {d.rollout === "percent" ? (
              <Field
                id="flag-percent"
                label={t("percent")}
                hint={t("percent_hint")}
                error={errors.percent}
              >
                <Input
                  inputMode="numeric"
                  value={d.percent}
                  onChange={(e) => set("percent", e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              </Field>
            ) : null}
            <SwitchField
              id="flag-client"
              label={t("client_visible")}
              description={t("client_visible_hint")}
              checked={d.client_visible}
              onCheckedChange={(v) => set("client_visible", v)}
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
