"use client";
import * as React from "react";
import { History, KeyRound, Pencil, Plus, RotateCw, Send, Trash2, Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, SwitchField } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { SecretReveal } from "@/components/partners/secret-reveal";
import { isApiError } from "@/lib/api/errors";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useRedeliverWebhook,
  useRotateOrgWebhookSecret,
  useTestWebhook,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from "@/lib/api/hooks/integrations";
import {
  WEBHOOK_EVENTS,
  messageKey,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
  type WebhookEvent,
} from "@/lib/api/types-integrations";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

const DELIVERY_TONE: Record<WebhookDeliveryStatus, BadgeTone> = {
  pending: "warning",
  delivered: "success",
  failed: "danger",
};

export function WebhooksPanel() {
  const t = useTranslations("integrations.webhooks");
  const tI = useTranslations("integrations");
  const tAll = useTranslations();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useWebhooks();
  const test = useTestWebhook();
  const del = useDeleteWebhook();
  const rotate = useRotateOrgWebhookSecret();
  const [editing, setEditing] = React.useState<WebhookEndpoint | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<WebhookEndpoint | null>(null);
  const [rotating, setRotating] = React.useState<WebhookEndpoint | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [logFor, setLogFor] = React.useState<WebhookEndpoint | null>(null);
  const endpoints = data?.results ?? [];

  const doTest = (e: WebhookEndpoint) =>
    test.mutate(e.id, {
      onSuccess: (d) =>
        d.status === "delivered"
          ? toast.success(t("test_ok", { code: d.last_status_code ?? 200 }))
          : toast.error(
              t("test_failed", { error: d.last_error ?? String(d.last_status_code ?? "") }),
            ),
      onError: (er) => toastError(er, tAll),
    });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      {isLoading ? (
        <TableSkeleton rows={2} cols={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : endpoints.length === 0 ? (
        <EmptyState icon={Webhook} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <ul className="space-y-3">
          {endpoints.map((e) => (
            <li key={e.id} className="rounded-dense border-border bg-surface border p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-fg font-mono text-sm break-all">{e.url}</span>
                    <Badge tone={e.is_active ? "success" : "neutral"} dot>
                      {e.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </p>
                  {e.description ? <p className="text-fg-muted text-sm">{e.description}</p> : null}
                  <div className="flex flex-wrap gap-1">
                    {e.events.length === 0 ? (
                      <Badge tone="outline">{t("all_events")}</Badge>
                    ) : (
                      e.events.map((ev) => (
                        <Badge key={ev} tone="outline" title={ev}>
                          {tI(`event.${messageKey(ev)}`)}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="text-fg-muted text-xs">
                    {t("stats", {
                      total: f.digits(e.deliveries_7d ?? 0),
                      failed: f.digits(e.failed_7d ?? 0),
                    })}{" "}
                    · <span className="font-mono">{e.secret_hint}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => doTest(e)}
                    disabled={test.isPending}
                  >
                    <Send aria-hidden />
                    {t("test")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setLogFor(e)}>
                    <History aria-hidden />
                    {t("deliveries")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                    <Pencil aria-hidden />
                    {t("edit")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRotating(e)}>
                    <KeyRound aria-hidden />
                    {t("rotate")}
                  </Button>
                  <Button size="sm" variant="danger-outline" onClick={() => setDeleting(e)}>
                    <Trash2 aria-hidden />
                    {t("delete")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EndpointDialog
        endpoint={editing}
        onClose={() => setEditing(null)}
        onCreated={(s) => {
          setEditing(null);
          setSecret(s);
        }}
      />
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
      <DeliveriesSheet endpoint={logFor} onOpenChange={(o) => !o && setLogFor(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("delete_title")}
        description={t("delete_body")}
        confirmLabel={t("delete")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("deleted_toast"));
              setDeleting(null);
            },
            onError: (er) => toastError(er, tAll),
          })
        }
      />
      <ConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title={t("rotate_title")}
        description={t("rotate_body")}
        confirmLabel={t("rotate")}
        loading={rotate.isPending}
        onConfirm={() =>
          rotating &&
          rotate.mutate(rotating.id, {
            onSuccess: (e) => {
              setRotating(null);
              setSecret(e.secret ?? null);
            },
            onError: (er) => toastError(er, tAll),
          })
        }
      />
    </div>
  );
}

function EndpointDialog({
  endpoint,
  onClose,
  onCreated,
}: {
  endpoint: WebhookEndpoint | "new" | null;
  onClose: () => void;
  onCreated: (secret: string | null) => void;
}) {
  const t = useTranslations("integrations.webhooks");
  const tI = useTranslations("integrations");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const isNew = endpoint === "new";
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [events, setEvents] = React.useState<WebhookEvent[]>([]);
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (!endpoint) return;
    create.reset();
    update.reset();
    if (endpoint === "new") {
      setUrl("https://");
      setDescription("");
      setEvents([]);
      setActive(true);
    } else {
      setUrl(endpoint.url);
      setDescription(endpoint.description);
      setEvents(endpoint.events);
      setActive(endpoint.is_active);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  if (!endpoint) return null;
  const err = isApiError(create.error)
    ? create.error
    : isApiError(update.error)
      ? update.error
      : null;
  const pending = create.isPending || update.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { url: url.trim(), description: description.trim(), events, is_active: active };
    if (endpoint === "new") {
      create.mutate(body, {
        onSuccess: (r) => onCreated(r.secret ?? null),
        onError: () => undefined,
      });
    } else if (endpoint) {
      update.mutate(
        { id: endpoint.id, ...body },
        {
          onSuccess: () => {
            toast.success(t("saved_toast"));
            onClose();
          },
          onError: (er) =>
            isApiError(er) && Object.keys(er.fields).length ? undefined : toastError(er, tAll),
        },
      );
    }
  }

  const toggle = (ev: WebhookEvent, on: boolean) =>
    setEvents((cur) => (on ? Array.from(new Set([...cur, ev])) : cur.filter((x) => x !== ev)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={tc("close")}>
        <form onSubmit={submit}>
          <DialogHeader title={isNew ? t("new") : t("edit")} />
          <DialogBody className="space-y-4">
            <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
            <Field id="wh-url" label={t("url")} hint={t("url_hint")} error={err?.fields.url?.[0]}>
              <Input
                type="url"
                required
                maxLength={500}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>
            <Field
              id="wh-desc"
              label={t("description_label")}
              optional
              optionalLabel={tc("optional")}
            >
              <Input
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-fg mb-1 text-sm font-medium">{t("events")}</legend>
              <p className="text-fg-muted text-xs">{t("events_hint")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={events.includes(ev)}
                      onCheckedChange={(v) => toggle(ev, v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-fg block">{tI(`event.${messageKey(ev)}`)}</span>
                      <span className="text-fg-muted font-mono text-[11px]">{ev}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SwitchField
              id="wh-active"
              label={t("enabled")}
              checked={active}
              onCheckedChange={setActive}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {isNew ? t("create") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SecretDialog({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  const t = useTranslations("integrations.webhooks");
  const tc = useTranslations("common");
  const tk = useTranslations("integrations.keys");
  if (!secret) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="md"
        closeLabel={tc("close")}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader title={t("secret_title")} />
        <DialogBody>
          <SecretReveal label={t("secret_label")} value={secret} warning={t("secret_warning")} />
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{tk("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesSheet({
  endpoint,
  onOpenChange,
}: {
  endpoint: WebhookEndpoint | null;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("integrations.webhooks");
  const tI = useTranslations("integrations");
  const tAll = useTranslations();
  const f = useFormat();
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<string | null>(null);
  const { data, isLoading, error, refetch } = useWebhookDeliveries(endpoint?.id ?? null, page);
  const redeliver = useRedeliverWebhook();
  React.useEffect(() => setPage(1), [endpoint?.id]);

  const doRedeliver = (d: WebhookDelivery) =>
    redeliver.mutate(d.id, {
      onSuccess: (r) => toast.success(t("redelivered_toast", { status: t(`status.${r.status}`) })),
      onError: (er) => toastError(er, tAll),
    });

  return (
    <Sheet open={!!endpoint} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tAll("common.close")} className="max-w-3xl">
        <div className="border-border space-y-1 border-b px-6 pt-5 pr-14 pb-4">
          <DialogTitle className="text-fg text-lg font-semibold">{t("deliveries")}</DialogTitle>
          <DialogDescription className="text-fg-muted text-sm break-all">
            {t("deliveries_desc", { url: endpoint?.url ?? "" })}
          </DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : !data?.results.length ? (
            <p className="text-fg-muted text-sm">{t("no_deliveries")}</p>
          ) : (
            <>
              <TableContainer>
                <Table className="min-w-[640px]">
                  <THead>
                    <tr>
                      <Th>{t("col_time")}</Th>
                      <Th>{t("col_event")}</Th>
                      <Th>{t("col_status")}</Th>
                      <Th numeric>{t("col_attempts")}</Th>
                      <Th>{t("col_response")}</Th>
                      <Th className="text-right">
                        <span className="sr-only">{tAll("common.actions")}</span>
                      </Th>
                    </tr>
                  </THead>
                  <TBody>
                    {data.results.map((d) => (
                      <React.Fragment key={d.id}>
                        <Tr interactive onClick={() => setOpen(open === d.id ? null : d.id)}>
                          <Td className="text-xs whitespace-nowrap">{f.dateTime(d.created_at)}</Td>
                          <Td className="text-sm">{tI(`event.${messageKey(d.event)}`)}</Td>
                          <Td>
                            <Badge tone={DELIVERY_TONE[d.status]} dot>
                              {t(`status.${d.status}`)}
                            </Badge>
                            {d.status === "pending" && d.next_attempt_at ? (
                              <span className="text-fg-muted block text-[11px]">
                                {t("next_retry", { time: f.time(d.next_attempt_at) })}
                              </span>
                            ) : null}
                          </Td>
                          <Td numeric>{f.digits(d.attempts)}</Td>
                          <Td
                            className="max-w-48 truncate font-mono text-xs"
                            title={d.last_error ?? undefined}
                          >
                            {d.last_status_code ?? "—"}
                            {d.last_error ? ` · ${d.last_error}` : ""}
                          </Td>
                          <Td className="text-right">
                            {d.status !== "pending" || d.attempts > 0 ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  doRedeliver(d);
                                }}
                                disabled={redeliver.isPending}
                              >
                                <RotateCw aria-hidden />
                                {t("redeliver")}
                              </Button>
                            ) : null}
                          </Td>
                        </Tr>
                        {open === d.id ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="border-border bg-surface-muted border-b px-4 py-3"
                            >
                              <p className="text-fg-muted mb-1 text-xs font-semibold">
                                {t("payload")}
                              </p>
                              <pre className="text-fg max-h-64 scrollbar-thin overflow-auto font-mono text-xs">
                                {JSON.stringify(d.payload, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
              <Pagination page={page} pageSize={25} count={data.count} onPageChange={setPage} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
