"use client";
import * as React from "react";
import { Pencil, Plus, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isApiError } from "@/lib/api/errors";
import { useCreateTrade, useTaxonomyTrades, useUpdateTrade } from "@/lib/api/hooks/risk";
import type { TradeCategory } from "@/lib/api/types";
import { TRADE_CATEGORIES, type TaxonomyTrade, type TradeInput } from "@/lib/api/types-risk";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";

type ActiveTab = "active" | "inactive" | "all";

/** /ops/taxonomy — trade list CRUD. Codes are immutable; retire a trade by deactivating it. */
export function TaxonomyPage() {
  const t = useTranslations("risk.taxonomy");
  const tn = useTranslations("nav");
  const tAll = useTranslations();
  const f = useFormat();
  const [tab, setTab] = React.useState<ActiveTab>("active");
  const [category, setCategory] = React.useState("");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<TaxonomyTrade | "new" | null>(null);
  const update = useUpdateTrade();
  const query = useTaxonomyTrades({
    is_active: tab === "all" ? undefined : tab === "active" ? "true" : "false",
    category: category || undefined,
    q: q || undefined,
  });
  const rows = query.data?.results ?? [];

  const toggle = (trade: TaxonomyTrade, active: boolean) =>
    update.mutate(
      { code: trade.code, is_active: active },
      {
        onSuccess: () => toast.success(active ? t("activated_toast", { name: trade.name_en }) : t("deactivated_toast", { name: trade.name_en })),
        onError: (e) => toastError(e, tAll),
      },
    );

  return (
    <div>
      <PageHeader
        title={tn("ops_taxonomy")}
        description={t("description")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("new_trade")}
          </Button>
        }
      />
      <Toolbar>
        <Tabs value={tab} onValueChange={(v) => setTab(v as ActiveTab)}>
          <TabsList>
            {(["active", "inactive", "all"] as const).map((x) => (
              <TabsTrigger key={x} value={x}>
                {t(`tab_${x}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <NativeSelect
          aria-label={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("any_category")}
          options={TRADE_CATEGORIES.map((c) => ({ value: c, label: t(`category_${c}`) }))}
          className="sm:w-48"
        />
        <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} className="sm:ml-auto sm:w-64" />
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Tags} title={tAll("common.no_results")} />
      ) : (
        <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
          <Table>
            <THead>
              <tr>
                <Th>{t("trade")}</Th>
                <Th className="max-md:hidden">{t("code")}</Th>
                <Th className="max-sm:hidden">{t("category")}</Th>
                <Th numeric className="max-md:hidden">{t("workers")}</Th>
                <Th numeric className="max-md:hidden">{t("jobs")}</Th>
                <Th>{t("active")}</Th>
                <Th className="text-right">
                  <span className="sr-only">{tAll("common.actions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((tr) => (
                <Tr key={tr.code}>
                  <RowHeader>
                    <span className="block text-fg">{tr.name_en}</span>
                    <span className="block text-xs font-normal text-fg-muted" lang="ne">
                      {tr.name_ne}
                    </span>
                  </RowHeader>
                  <Td className="font-mono text-xs max-md:hidden">{tr.code}</Td>
                  <Td className="max-sm:hidden">{t(`category_${tr.category}`)}</Td>
                  <Td numeric className="max-md:hidden">{f.number(tr.workers_count ?? 0)}</Td>
                  <Td numeric className="max-md:hidden">{f.number(tr.jobs_count ?? 0)}</Td>
                  <Td>
                    <Switch
                      checked={tr.is_active}
                      disabled={update.isPending}
                      onCheckedChange={(v) => toggle(tr, v)}
                      aria-label={t("active_aria", { name: tr.name_en })}
                    />
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(tr)} aria-label={t("edit_aria", { name: tr.name_en })}>
                      <Pencil aria-hidden />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      <TradeDialog trade={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TradeDialog({ trade, onClose }: { trade: TaxonomyTrade | "new" | null; onClose: () => void }) {
  const t = useTranslations("risk.taxonomy");
  const tAll = useTranslations();
  const create = useCreateTrade();
  const update = useUpdateTrade();
  const existing = trade && trade !== "new" ? trade : null;
  const [form, setForm] = React.useState<TradeInput>({ code: "", name_en: "", name_ne: "", category: "general", is_active: true });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!trade) return;
    setForm(
      existing
        ? { code: existing.code, name_en: existing.name_en, name_ne: existing.name_ne, category: existing.category, is_active: existing.is_active }
        : { code: "", name_en: "", name_ne: "", category: "general", is_active: true },
    );
    setErrors({});
    setFormError(null);
  }, [trade, existing]);
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof TradeInput>(k: K, v: TradeInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!existing && !/^[a-z0-9_]{2,40}$/.test(form.code)) next.code = t("code_invalid");
    if (!form.name_en.trim()) next.name_en = tAll("errors.required");
    if (!form.name_ne.trim()) next.name_ne = tAll("errors.required");
    setErrors(next);
    if (Object.keys(next).length) return;
    const opts = {
      onSuccess: () => {
        toast.success(existing ? t("saved_toast") : t("created_toast"));
        onClose();
      },
      onError: (err: unknown) => {
        if (isApiError(err)) {
          const fields: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(err.fields ?? {})) fields[k] = msgs[0];
          setErrors(fields);
          setFormError(err.message || tAll(`errors.${err.code}`));
        } else setFormError(tAll("errors.server_error"));
      },
    };
    if (existing) {
      const { code: _code, ...rest } = form;
      update.mutate({ code: existing.code, ...rest }, opts);
    } else create.mutate(form, opts);
  };

  return (
    <Dialog open={!!trade} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" closeLabel={tAll("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={existing ? t("edit_title") : t("new_trade")} description={existing ? existing.code : t("new_description")} />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <Field id="trade-code" label={t("code")} hint={existing ? t("code_immutable") : t("code_hint")} error={errors.code}>
              <Input
                value={form.code}
                onChange={(e) => set("code", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                disabled={!!existing}
                className="font-mono"
                maxLength={40}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="trade-name-en" label={t("name_en")} error={errors.name_en}>
                <Input value={form.name_en} onChange={(e) => set("name_en", e.target.value)} maxLength={80} />
              </Field>
              <Field id="trade-name-ne" label={t("name_ne")} error={errors.name_ne}>
                <Input value={form.name_ne} onChange={(e) => set("name_ne", e.target.value)} maxLength={80} lang="ne" />
              </Field>
            </div>
            <Field id="trade-category" label={t("category")}>
              <NativeSelect
                value={form.category}
                onChange={(e) => set("category", e.target.value as TradeCategory)}
                options={TRADE_CATEGORIES.map((c) => ({ value: c, label: t(`category_${c}`) }))}
              />
            </Field>
            <label className="flex items-center gap-3 text-sm text-fg">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} />
              {t("active_label")}
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              {tAll("common.cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {tAll("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
