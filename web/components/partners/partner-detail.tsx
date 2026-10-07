"use client";
import * as React from "react";
import { KeyRound, Pencil, Plus, RefreshCw, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogDescription, DialogTitle, Sheet, SheetContent } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import {
  useOpsPartner,
  usePartnerAccessLog,
  usePartnerGrants,
  usePartnerKeys,
  useRevokePartnerKey,
  useRotateWebhookSecret,
} from "@/lib/api/hooks/partners";
import type { OpsPartner, PartnerApiKey } from "@/lib/api/types-partners";
import { useFormat } from "@/lib/use-format";
import { CreateKeyDialog } from "./key-dialog";
import { PartnerFormDialog } from "./partner-form-dialog";
import { SecretReveal } from "./secret-reveal";

const PAGE_SIZE = 25;

export function PartnerDetailSheet({ partnerId, onClose }: { partnerId: string | null; onClose: () => void }) {
  const t = useTranslations("partners");
  const tc = useTranslations("common");
  const query = useOpsPartner(partnerId);
  const p = query.data;
  return (
    <Sheet open={!!partnerId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-2xl" closeLabel={tc("close")}>
        <div className="border-b border-border px-6 pt-5 pb-4 pr-14">
          <DialogTitle className="text-lg font-semibold text-fg">{p?.name ?? t("detail.loading")}</DialogTitle>
          <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            {p ? (
              <>
                <Badge tone="outline">{t(`kind.${p.kind}`)}</Badge>
                {p.regulator ? <span>{t(`regulator.${p.regulator}`)}</span> : null}
                <Badge tone={p.is_active ? "success" : "neutral"} dot>
                  {p.is_active ? t("active") : t("inactive")}
                </Badge>
              </>
            ) : null}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {query.isLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : p ? (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">{t("detail.overview")}</TabsTrigger>
                <TabsTrigger value="keys">
                  <KeyRound aria-hidden />
                  {t("detail.keys")}
                </TabsTrigger>
                <TabsTrigger value="log">
                  <ScrollText aria-hidden />
                  {t("detail.access_log")}
                </TabsTrigger>
                <TabsTrigger value="grants">{t("detail.grants")}</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <Overview partner={p} />
              </TabsContent>
              <TabsContent value="keys">
                <Keys partner={p} />
              </TabsContent>
              <TabsContent value="log">
                <AccessLog partnerId={p.id} />
              </TabsContent>
              <TabsContent value="grants">
                <Grants partnerId={p.id} />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Overview({ partner }: { partner: OpsPartner }) {
  const t = useTranslations("partners");
  const f = useFormat();
  const [edit, setEdit] = React.useState(false);
  const [confirmRotate, setConfirmRotate] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);
  const rotate = useRotateWebhookSecret();
  const s = partner.stats;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["active_keys", s.active_keys],
            ["active_grants", s.active_grants],
            ["offers", s.offers],
            ["referrals", s.referrals],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border p-3">
            <p className="text-xs text-fg-muted">{t(`stats.${k}`)}</p>
            <p className="text-xl font-semibold text-fg tabular">{f.number(v ?? 0)}</p>
          </div>
        ))}
      </div>
      <DescriptionList
        items={[
          { label: t("form.license_no"), value: partner.license_no || null },
          { label: t("form.regulator"), value: partner.regulator ? t(`regulator.${partner.regulator}`) : null },
          { label: t("form.contact_email"), value: partner.contact_email || null },
          { label: t("form.contact_phone"), value: partner.contact_phone ? f.phone(partner.contact_phone) : null },
          { label: t("form.webhook_url"), value: partner.webhook_url || t("detail.no_webhook"), full: true },
          { label: t("detail.created"), value: f.dateTime(partner.created_at) },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEdit(true)}>
          <Pencil aria-hidden />
          {t("detail.edit")}
        </Button>
        <Button variant="secondary" onClick={() => setConfirmRotate(true)}>
          <RefreshCw aria-hidden />
          {t("detail.rotate_secret")}
        </Button>
      </div>
      {secret ? (
        <SecretReveal label={t("form.webhook_secret")} value={secret} warning={t("form.webhook_secret_once")} />
      ) : null}
      <PartnerFormDialog open={edit} onOpenChange={setEdit} partner={partner} />
      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={t("detail.rotate_secret")}
        description={t("detail.rotate_confirm")}
        confirmLabel={t("detail.rotate_secret")}
        danger
        loading={rotate.isPending}
        onConfirm={async () => {
          try {
            const res = await rotate.mutateAsync(partner.id);
            setSecret(res.webhook_secret);
            setConfirmRotate(false);
          } catch (err) {
            toast.error(isApiError(err) ? err.message : t("detail.rotate_failed"));
          }
        }}
      />
    </div>
  );
}

function Keys({ partner }: { partner: OpsPartner }) {
  const t = useTranslations("partners.keys");
  const tp = useTranslations("partners");
  const f = useFormat();
  const query = usePartnerKeys(partner.id);
  const revoke = useRevokePartnerKey();
  const [creating, setCreating] = React.useState(false);
  const [toRevoke, setToRevoke] = React.useState<PartnerApiKey | null>(null);
  const keys = query.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">{t("intro")}</p>
        <Button onClick={() => setCreating(true)} disabled={!partner.is_active}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      {query.isLoading ? (
        <TableSkeleton rows={2} cols={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : keys.length === 0 ? (
        <EmptyState icon={KeyRound} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm text-fg">{k.masked}</code>
                  {k.name ? <span className="text-sm text-fg-muted">{k.name}</span> : null}
                  <Badge tone={k.is_active ? "success" : "neutral"} dot>
                    {k.is_active ? tp("active") : t("revoked")}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <Badge key={s} tone="outline" className="font-mono font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-fg-muted">
                  {t("created_at", { date: f.dateTime(k.created_at) })} ·{" "}
                  {k.last_used_at ? t("last_used", { date: f.dateTime(k.last_used_at) }) : t("never_used")}
                  {k.revoked_at ? ` · ${t("revoked_at", { date: f.dateTime(k.revoked_at) })}` : ""}
                </p>
              </div>
              {k.is_active ? (
                <Button variant="danger-outline" size="sm" onClick={() => setToRevoke(k)}>
                  {t("revoke")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <CreateKeyDialog partnerId={partner.id} open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={!!toRevoke}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title={t("revoke_title")}
        description={t("revoke_body", { key: toRevoke?.masked ?? "" })}
        confirmLabel={t("revoke")}
        danger
        loading={revoke.isPending}
        onConfirm={async () => {
          if (!toRevoke) return;
          try {
            await revoke.mutateAsync({ partnerId: partner.id, keyId: toRevoke.id });
            toast.success(t("revoked_toast"));
            setToRevoke(null);
          } catch (err) {
            toast.error(isApiError(err) ? err.message : t("revoke_failed"));
          }
        }}
      />
    </div>
  );
}

function AccessLog({ partnerId }: { partnerId: string }) {
  const t = useTranslations("partners.log");
  const f = useFormat();
  const [page, setPage] = React.useState(1);
  const query = usePartnerAccessLog(partnerId, { page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!rows.length) return <EmptyState icon={ScrollText} title={t("empty_title")} description={t("empty_body")} />;
  return (
    <>
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <Th>{t("when")}</Th>
              <Th>{t("worker")}</Th>
              <Th className="max-sm:hidden">{t("endpoint")}</Th>
              <Th>{t("result")}</Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap">{f.dateTime(r.created_at)}</Td>
                <Td>{r.worker?.full_name ?? "—"}</Td>
                <Td className="max-w-56 truncate font-mono text-xs max-sm:hidden" title={r.endpoint}>
                  {r.method} {r.endpoint.replace(/^\/api\/v1/, "")}
                </Td>
                <Td>
                  <Badge tone={r.granted ? "success" : "danger"}>
                    {f.digits(r.status_code)} {r.granted ? t("allowed") : t("denied")}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
    </>
  );
}

function Grants({ partnerId }: { partnerId: string }) {
  const t = useTranslations("partners.grants");
  const f = useFormat();
  const [page, setPage] = React.useState(1);
  const query = usePartnerGrants(partnerId, { page, page_size: PAGE_SIZE });
  const rows = query.data?.results ?? [];
  if (query.isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!rows.length) return <EmptyState title={t("empty_title")} description={t("empty_body")} />;
  return (
    <>
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <Th>{t("worker")}</Th>
              <Th>{t("purpose")}</Th>
              <Th className="max-sm:hidden">{t("expires")}</Th>
              <Th>{t("status")}</Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((g) => (
              <Tr key={g.id}>
                <Td>{g.worker?.full_name ?? t("hidden_worker")}</Td>
                <Td>{g.purpose_label}</Td>
                <Td className="whitespace-nowrap max-sm:hidden">{f.dateTime(g.expires_at)}</Td>
                <Td>
                  <Badge tone={g.status === "active" ? "success" : g.status === "revoked" ? "danger" : "neutral"}>
                    {g.status_label}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      <Pagination page={page} pageSize={PAGE_SIZE} count={query.data?.count ?? 0} onPageChange={setPage} />
    </>
  );
}
