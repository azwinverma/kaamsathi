"use client";
import * as React from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Toolbar } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import { useDeleteHelpArticle, useOpsHelpArticles, useSaveHelpArticle } from "@/lib/api/hooks/support";
import { HELP_CATEGORIES, type HelpArticle, type HelpArticleInput, type HelpAudience } from "@/lib/api/types-support";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { Markdown } from "./markdown";

const EMPTY: HelpArticleInput = {
  slug: "",
  audience: "all",
  category: "getting_started",
  title_en: "",
  title_ne: "",
  body_en: "",
  body_ne: "",
  is_published: false,
  order: 100,
};

/** Ops help-center editor (tab inside /ops/support): bilingual markdown articles. */
export function HelpEditor() {
  const t = useTranslations("support.help_editor");
  const tc = useTranslations("common");
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<HelpArticle | "new" | null>(null);
  const query = useOpsHelpArticles({ q: q || undefined });
  const rows = query.data?.results ?? [];
  return (
    <div>
      <Toolbar className="sm:justify-between">
        <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} className="sm:w-72" />
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/help" target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("open_public")}
            </Link>
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("new_article")}
          </Button>
        </div>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title={q ? tc("no_results") : t("empty")} />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("article")}</Th>
                <Th className="max-md:hidden">{t("audience")}</Th>
                <Th className="max-md:hidden">{t("category")}</Th>
                <Th>{tc("status")}</Th>
                <Th className="max-lg:hidden">{tc("updated")}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((a) => (
                <Tr key={a.id} interactive onClick={() => setEditing(a)}>
                  <RowHeader>
                    <span className="block font-medium text-fg">{a.title_en}</span>
                    <span className="block text-xs font-normal text-fg-muted">{a.title_ne || a.slug}</span>
                  </RowHeader>
                  <Td className="max-md:hidden">{a.audience_label}</Td>
                  <Td className="max-md:hidden">{a.category_label}</Td>
                  <Td>
                    <Badge tone={a.is_published ? "success" : "neutral"} dot>
                      {a.is_published ? t("published") : t("draft")}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-fg-muted max-lg:hidden">
                    {f.dateTime(a.updated_at)}
                    {a.updated_by ? ` · ${a.updated_by.full_name}` : ""}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      <ArticleDialog article={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ArticleDialog({ article, onClose }: { article: HelpArticle | "new" | null; onClose: () => void }) {
  const t = useTranslations("support.help_editor");
  const tAll = useTranslations();
  const save = useSaveHelpArticle();
  const del = useDeleteHelpArticle();
  const [form, setForm] = React.useState<HelpArticleInput>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const existing = article && article !== "new" ? article : null;

  React.useEffect(() => {
    if (!article) return;
    setForm(
      article === "new"
        ? EMPTY
        : {
            slug: article.slug,
            audience: article.audience,
            category: article.category,
            title_en: article.title_en,
            title_ne: article.title_ne,
            body_en: article.body_en,
            body_ne: article.body_ne,
            is_published: article.is_published,
            order: article.order,
          },
    );
    setErrors({});
    setFormError(null);
  }, [article]);

  const set = <K extends keyof HelpArticleInput>(k: K, v: HelpArticleInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    for (const k of ["slug", "title_en", "body_en"] as const) if (!String(form[k]).trim()) next[k] = tAll("errors.required");
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(
      { id: existing?.id, ...form },
      {
        onSuccess: () => {
          toast.success(t("saved_toast"));
          onClose();
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

  return (
    <Dialog open={!!article} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={existing ? t("edit_title") : t("new_article")} description={t("markdown_hint")} />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-4">
              <Field id="help-slug" label={t("slug")} error={errors.slug} className="sm:col-span-2">
                <Input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
              </Field>
              <Field id="help-audience" label={t("audience")}>
                <NativeSelect
                  value={form.audience}
                  onChange={(e) => set("audience", e.target.value as HelpAudience)}
                  options={(["all", "worker", "employer"] as const).map((a) => ({ value: a, label: t(`audience_${a}`) }))}
                />
              </Field>
              <Field id="help-category" label={t("category")}>
                <NativeSelect
                  value={form.category}
                  onChange={(e) => set("category", e.target.value as HelpArticleInput["category"])}
                  options={HELP_CATEGORIES.map((c) => ({ value: c, label: tAll(`support.help.category.${c}`) }))}
                />
              </Field>
            </div>
            <Tabs defaultValue="en">
              <TabsList>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="ne">नेपाली</TabsTrigger>
                <TabsTrigger value="preview">{t("preview")}</TabsTrigger>
              </TabsList>
              <TabsContent value="en" className="space-y-3 pt-3">
                <Field id="help-title-en" label={t("title_en")} error={errors.title_en}>
                  <Input value={form.title_en} onChange={(e) => set("title_en", e.target.value)} maxLength={200} />
                </Field>
                <Field id="help-body-en" label={t("body_en")} error={errors.body_en}>
                  <Textarea value={form.body_en} onChange={(e) => set("body_en", e.target.value)} rows={12} className="font-mono text-xs" />
                </Field>
              </TabsContent>
              <TabsContent value="ne" className="space-y-3 pt-3">
                <Field id="help-title-ne" label={t("title_ne")}>
                  <Input value={form.title_ne} onChange={(e) => set("title_ne", e.target.value)} maxLength={200} lang="ne" />
                </Field>
                <Field id="help-body-ne" label={t("body_ne")}>
                  <Textarea value={form.body_ne} onChange={(e) => set("body_ne", e.target.value)} rows={12} className="font-mono text-xs" lang="ne" />
                </Field>
              </TabsContent>
              <TabsContent value="preview" className="grid gap-6 pt-3 lg:grid-cols-2">
                <article>
                  <h3 className="mb-2 text-base font-semibold text-fg">{form.title_en || "—"}</h3>
                  <Markdown source={form.body_en} />
                </article>
                <article lang="ne">
                  <h3 className="mb-2 text-base font-semibold text-fg">{form.title_ne || "—"}</h3>
                  <Markdown source={form.body_ne} />
                </article>
              </TabsContent>
            </Tabs>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-fg">
                <Checkbox checked={form.is_published} onCheckedChange={(v) => set("is_published", v === true)} />
                {t("publish")}
              </label>
              <Field id="help-order" label={t("order")} className="w-28">
                <Input type="number" min={0} value={form.order} onChange={(e) => set("order", Number(e.target.value) || 0)} />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            {existing ? (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
                {tAll("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                {tAll("common.cancel")}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {tAll("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
        {existing ? (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t("delete_title")}
            description={t("delete_body", { title: existing.title_en })}
            confirmLabel={tAll("common.delete")}
            danger
            loading={del.isPending}
            onConfirm={() =>
              del.mutate(existing.id, {
                onSuccess: () => {
                  toast.success(t("deleted_toast"));
                  setConfirmDelete(false);
                  onClose();
                },
                onError: (e) => toastError(e, tAll),
              })
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
