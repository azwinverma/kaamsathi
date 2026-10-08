"use client";
import * as React from "react";
import Link from "next/link";
import { BookOpen, KeyRound, Lock, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecretReveal } from "@/components/partners/secret-reveal";
import { isApiError } from "@/lib/api/errors";
import {
  useCreateOrgApiKey,
  useOrgApiKeys,
  useRevokeOrgApiKey,
} from "@/lib/api/hooks/integrations";
import {
  ORG_API_SCOPES,
  messageKey,
  type OrgApiKey,
  type OrgApiScope,
} from "@/lib/api/types-integrations";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { WebhooksPanel } from "./webhooks-panel";

export function IntegrationsPage() {
  const t = useTranslations("integrations");
  const { isAdmin } = useSession();
  const [tab, setTab] = React.useState<"keys" | "webhooks">("keys");

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title={t("title")} />
        <EmptyState icon={Lock} title={t("forbidden")} />
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="secondary" asChild>
            <Link href="/developers" target="_blank">
              <BookOpen aria-hidden />
              {t("docs_link")}
            </Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "keys" | "webhooks")}>
        <TabsList>
          <TabsTrigger value="keys">{t("tab_keys")}</TabsTrigger>
          <TabsTrigger value="webhooks">{t("tab_webhooks")}</TabsTrigger>
        </TabsList>
        <TabsContent value="keys">
          <KeysPanel />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KeysPanel() {
  const t = useTranslations("integrations");
  const tAll = useTranslations();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useOrgApiKeys();
  const revoke = useRevokeOrgApiKey();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState<OrgApiKey | null>(null);
  const keys = data?.results ?? [];

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          {t("keys.new")}
        </Button>
      </div>
      {isLoading ? (
        <TableSkeleton rows={3} cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t("keys.empty_title")}
          description={t("keys.empty_body")}
        />
      ) : (
        <TableContainer>
          <Table className="min-w-[820px]">
            <THead>
              <tr>
                <Th>{t("keys.col_name")}</Th>
                <Th>{t("keys.col_key")}</Th>
                <Th>{t("keys.col_scopes")}</Th>
                <Th>{t("keys.col_last_used")}</Th>
                <Th>{t("keys.col_created")}</Th>
                <Th className="text-right">
                  <span className="sr-only">{tAll("common.actions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {keys.map((k) => (
                <Tr key={k.id}>
                  <Td>
                    <span className="text-fg font-medium">{k.name}</span>
                    <div>
                      <Badge tone={k.is_active ? "success" : "neutral"} dot>
                        {k.is_active ? t("keys.active") : t("keys.revoked")}
                      </Badge>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs">{k.masked}</Td>
                  <Td>
                    <div className="flex max-w-80 flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} tone="outline" title={t(`scope.${messageKey(s)}`)}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-fg-muted text-sm">
                    {k.last_used_at ? f.dateTime(k.last_used_at) : t("keys.never")}
                  </Td>
                  <Td className="text-fg-muted text-sm">
                    {f.dateTime(k.created_at)}
                    {k.created_by ? (
                      <span className="block text-xs">{k.created_by.full_name}</span>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    {k.is_active ? (
                      <Button size="sm" variant="danger-outline" onClick={() => setRevoking(k)}>
                        {t("keys.revoke")}
                      </Button>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      <CreateOrgKeyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("keys.revoke_title")}
        description={t("keys.revoke_body", { name: revoking?.name ?? "" })}
        confirmLabel={t("keys.revoke")}
        danger
        loading={revoke.isPending}
        onConfirm={() =>
          revoking &&
          revoke.mutate(revoking.id, {
            onSuccess: () => {
              toast.success(t("keys.revoked_toast"));
              setRevoking(null);
            },
            onError: (e) => toastError(e, tAll),
          })
        }
      />
    </div>
  );
}

function CreateOrgKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("integrations");
  const tc = useTranslations("common");
  const create = useCreateOrgApiKey();
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<OrgApiScope[]>(["workforce.read", "attendance.read"]);
  const [created, setCreated] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setScopes(["workforce.read", "attendance.read"]);
      setCreated(null);
      setLocalError(null);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (s: OrgApiScope, on: boolean) =>
    setScopes((cur) => (on ? Array.from(new Set([...cur, s])) : cur.filter((x) => x !== s)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!scopes.length) return setLocalError(t("keys.scopes_required"));
    setLocalError(null);
    try {
      const res = await create.mutateAsync({ name: name.trim(), scopes });
      setCreated(res.key);
    } catch {
      /* shown below */
    }
  }

  const apiErr = isApiError(create.error) ? create.error : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        closeLabel={tc("close")}
        onInteractOutside={(e) => {
          if (created) e.preventDefault();
        }}
      >
        <DialogHeader
          title={created ? t("keys.created_title") : t("keys.new_title")}
          description={created ? undefined : t("keys.new_desc")}
        />
        {created ? (
          <>
            <DialogBody>
              <SecretReveal label={t("keys.key")} value={created} warning={t("keys.shown_once")} />
              <p className="text-fg-muted mt-3 text-xs">
                {t("keys.usage", { header: "Authorization: Org <key>" })}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t("keys.done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogBody className="space-y-4">
              <FormError
                message={localError ?? (apiErr && !apiErr.fields.name ? apiErr.message : null)}
              />
              <Field
                id="org-key-name"
                label={t("keys.name")}
                hint={t("keys.name_hint")}
                error={apiErr?.fields.name?.[0]}
              >
                <Input
                  value={name}
                  maxLength={100}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <fieldset className="space-y-2">
                <legend className="text-fg mb-1 text-sm font-medium">{t("keys.scopes")}</legend>
                {ORG_API_SCOPES.map((s) => (
                  <label key={s} className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={scopes.includes(s)}
                      onCheckedChange={(v) => toggle(s, v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-fg font-mono text-xs">{s}</span>
                      <span className="text-fg-muted block">{t(`scope.${messageKey(s)}`)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
                {t("keys.create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
