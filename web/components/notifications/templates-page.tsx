"use client";
import * as React from "react";
import { MessageSquareText, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import {
  type NotificationChannel,
  type NotificationTemplate,
  useOpsNotificationDeliveries,
  useOpsNotificationTemplates,
  usePreviewNotificationTemplate,
  useSaveNotificationTemplate,
} from "@/lib/api/hooks/notifications";
import { useFormat } from "@/lib/use-format";

const CHANNELS: NotificationChannel[] = ["inapp", "sms", "push", "email"];
const LANGS = ["en", "ne"] as const;
const DELIVERY_TONE: Record<string, BadgeTone> = { queued: "warning", sent: "success", failed: "danger", skipped: "neutral" };

/** /ops/notifications — versioned template editor with preview, plus the delivery log. */
export function NotificationTemplatesPage() {
  const t = useTranslations("notif_templates");
  const [tab, setTab] = React.useState<"templates" | "deliveries">("templates");
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "templates" | "deliveries")}>
        <TabsList>
          <TabsTrigger value="templates">{t("tab_templates")}</TabsTrigger>
          <TabsTrigger value="deliveries">{t("tab_deliveries")}</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <TemplatesPanel />
        </TabsContent>
        <TabsContent value="deliveries">
          <DeliveriesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatesPanel() {
  const t = useTranslations("notif_templates");
  const f = useFormat();
  const [key, setKey] = React.useState("");
  const [channel, setChannel] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [editing, setEditing] = React.useState<NotificationTemplate | "new" | null>(null);
  const q = { latest: "1", key, channel, language };
  const { data, isLoading, error, refetch } = useOpsNotificationTemplates(q);
  const rows = data?.results ?? [];

  return (
    <div className="space-y-4 pt-4">
      <Toolbar className="sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={key} onChange={setKey} placeholder={t("search")} className="sm:w-56" />
          <Select
            value={channel}
            onValueChange={setChannel}
            allowEmpty
            emptyLabel={t("filter_channel")}
            options={CHANNELS.map((c) => ({ value: c, label: t(`channel_${c}`) }))}
            className="sm:w-40"
            aria-label={t("channel")}
          />
          <Select
            value={language}
            onValueChange={setLanguage}
            allowEmpty
            emptyLabel={t("filter_language")}
            options={LANGS.map((l) => ({ value: l, label: t(`lang_${l}`) }))}
            className="sm:w-40"
            aria-label={t("language")}
          />
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </Toolbar>
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquareText} title={t("empty")} />
      ) : (
        <TableContainer>
          <Table className="min-w-[860px]">
            <THead>
              <tr>
                <Th>{t("col_key")}</Th>
                <Th>{t("col_channel")}</Th>
                <Th>{t("col_language")}</Th>
                <Th numeric>{t("col_version")}</Th>
                <Th>{t("body")}</Th>
                <Th>{t("col_updated")}</Th>
                <Th className="text-right">
                  <span className="sr-only">{t("edit")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-mono text-xs">{r.key}</Td>
                  <Td>{t(`channel_${r.channel}`)}</Td>
                  <Td>{t(`lang_${r.language}`)}</Td>
                  <Td numeric>
                    v{f.digits(r.version)}
                    {!r.is_active ? (
                      <Badge tone="neutral" className="ml-1.5">
                        {t("inactive")}
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="max-w-md">
                    {r.subject ? <span className="block truncate text-sm font-medium text-fg">{r.subject}</span> : null}
                    <span className="line-clamp-2 text-xs text-fg-muted">{r.body}</span>
                  </Td>
                  <Td className="text-xs whitespace-nowrap text-fg-muted">{f.dateTime(r.updated_at)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                      <Pencil aria-hidden />
                      {t("edit")}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      <TemplateDialog template={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TemplateDialog({ template, onClose }: { template: NotificationTemplate | "new" | null; onClose: () => void }) {
  const t = useTranslations("notif_templates");
  const tc = useTranslations("common");
  const save = useSaveNotificationTemplate();
  const preview = usePreviewNotificationTemplate();
  const isNew = template === "new";
  const [form, setForm] = React.useState({
    key: "",
    channel: "sms" as NotificationChannel,
    language: "en" as "en" | "ne",
    subject: "",
    body: "",
    is_active: true,
  });
  const [ctx, setCtx] = React.useState('{"name": "Ram", "month": "Ashwin 2083", "amount": "Rs. 19,550"}');
  const [ctxError, setCtxError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!template) return;
    save.reset();
    preview.reset();
    setForm(
      template === "new"
        ? { key: "", channel: "sms", language: "en", subject: "", body: "", is_active: true }
        : {
            key: template.key,
            channel: template.channel,
            language: template.language,
            subject: template.subject,
            body: template.body,
            is_active: template.is_active,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  if (!template) return null;
  const err = isApiError(save.error) ? save.error : null;

  function runPreview() {
    let context: Record<string, unknown>;
    try {
      context = JSON.parse(ctx || "{}");
      setCtxError(null);
    } catch {
      setCtxError(t("invalid_json", { example: '{"month": "Ashwin"}' }));
      return;
    }
    preview.mutate({ subject: form.subject, body: form.body, context });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = isNew ? form : { subject: form.subject, body: form.body, is_active: form.is_active };
    save.mutate(
      { ...(isNew ? {} : { id: (template as NotificationTemplate).id }), ...body },
      {
        onSuccess: (r) => {
          toast.success(t("saved", { version: r.version }));
          onClose();
        },
      },
    );
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((cur) => ({ ...cur, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <form onSubmit={submit}>
          <DialogHeader
            title={isNew ? t("new") : `${form.key} · ${t(`channel_${form.channel}`)} · ${t(`lang_${form.language}`)}`}
            description={isNew ? undefined : t("new_version_note", { version: (template as NotificationTemplate).version + 1 })}
          />
          <DialogBody className="space-y-4">
            <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
            {isNew ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="tpl-key" label={t("key")} hint={t("key_hint")} error={err?.fields.key?.[0]}>
                  <Input value={form.key} required onChange={(e) => set("key", e.target.value.trim())} />
                </Field>
                <Field id="tpl-channel" label={t("channel")}>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => set("channel", v as NotificationChannel)}
                    options={CHANNELS.map((c) => ({ value: c, label: t(`channel_${c}`) }))}
                  />
                </Field>
                <Field id="tpl-lang" label={t("language")}>
                  <Select
                    value={form.language}
                    onValueChange={(v) => set("language", v as "en" | "ne")}
                    options={LANGS.map((l) => ({ value: l, label: t(`lang_${l}`) }))}
                  />
                </Field>
              </div>
            ) : null}
            {form.channel !== "sms" ? (
              <Field id="tpl-subject" label={t("subject")} error={err?.fields.subject?.[0]}>
                <Input value={form.subject} maxLength={200} onChange={(e) => set("subject", e.target.value)} />
              </Field>
            ) : null}
            <Field
              id="tpl-body"
              label={t("body")}
              hint={
                form.channel === "sms"
                  ? `${t("body_hint", { example: "{worker_name}, {month}" })} · ${t("sms_length", { count: form.body.length })}`
                  : t("body_hint", { example: "{worker_name}, {month}" })
              }
              error={err?.fields.body?.[0]}
            >
              <Textarea rows={5} required value={form.body} onChange={(e) => set("body", e.target.value)} />
            </Field>
            <SwitchField id="tpl-active" label={t("is_active")} checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <div className="space-y-2 rounded-lg border border-border bg-surface-muted p-3">
              <Field id="tpl-ctx" label={t("preview_context")} error={ctxError ?? undefined}>
                <Textarea rows={2} className="font-mono text-xs" value={ctx} onChange={(e) => setCtx(e.target.value)} />
              </Field>
              <Button type="button" size="sm" variant="secondary" onClick={runPreview} loading={preview.isPending}>
                {t("preview")}
              </Button>
              {preview.data ? (
                <div className="space-y-1 text-sm" aria-live="polite">
                  <p className="text-xs font-semibold text-fg-muted">{t("preview_result")}</p>
                  {preview.data.subject ? <p className="font-medium text-fg">{preview.data.subject}</p> : null}
                  <p className="whitespace-pre-wrap text-fg-body">{preview.data.body}</p>
                  {preview.data.missing.length ? (
                    <p className="text-xs text-warning">{t("preview_missing", { vars: preview.data.missing.join(", ") })}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
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

function DeliveriesPanel() {
  const t = useTranslations("notif_templates");
  const f = useFormat();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [channel, setChannel] = React.useState("");
  React.useEffect(() => setPage(1), [status, channel]);
  const { data, isLoading, error, refetch } = useOpsNotificationDeliveries({ page, status, channel });
  const rows = data?.results ?? [];
  return (
    <div className="space-y-4 pt-4">
      <Toolbar>
        <Select
          value={status}
          onValueChange={setStatus}
          allowEmpty
          emptyLabel={t("all")}
          options={["queued", "sent", "failed", "skipped"].map((s) => ({ value: s, label: t(`status_${s}`) }))}
          className="sm:w-40"
          aria-label={t("col_status")}
        />
        <Select
          value={channel}
          onValueChange={setChannel}
          allowEmpty
          emptyLabel={t("filter_channel")}
          options={CHANNELS.map((c) => ({ value: c, label: t(`channel_${c}`) }))}
          className="sm:w-40"
          aria-label={t("channel")}
        />
      </Toolbar>
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquareText} title={t("no_deliveries")} />
      ) : (
        <>
          <TableContainer>
            <Table className="min-w-[760px]">
              <THead>
                <tr>
                  <Th>{t("col_time")}</Th>
                  <Th>{t("col_kind")}</Th>
                  <Th>{t("col_user")}</Th>
                  <Th>{t("col_channel")}</Th>
                  <Th>{t("col_status")}</Th>
                  <Th numeric>{t("col_attempts")}</Th>
                  <Th>{t("col_error")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((d) => (
                  <Tr key={d.id}>
                    <Td className="text-xs whitespace-nowrap">{f.dateTime(d.created_at)}</Td>
                    <Td className="font-mono text-xs">{d.kind}</Td>
                    <Td className="text-xs tabular">{f.phone(d.user.phone)}</Td>
                    <Td>{t(`channel_${d.channel}`)}</Td>
                    <Td>
                      <Badge tone={DELIVERY_TONE[d.status] ?? "neutral"} dot>
                        {t(`status_${d.status}`)}
                      </Badge>
                    </Td>
                    <Td numeric>{f.digits(d.attempts)}</Td>
                    <Td className="max-w-56 truncate text-xs text-fg-muted" title={d.error ?? undefined}>
                      {d.error ?? "—"}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={25} count={data?.count ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
