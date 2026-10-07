"use client";
import * as React from "react";
import Link from "next/link";
import { HardHat, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TradeSelect } from "@/components/shared/selects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/ui/search-input";
import { RowHeader, Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { listResults } from "@/lib/api/client";
import { useTrades } from "@/lib/api/hooks/ref";
import {
  useContractors,
  useCreateContractor,
  useUpdateContractor,
} from "@/lib/api/hooks/compliance";
import { isApiError } from "@/lib/api/errors";
import type { Contractor } from "@/lib/api/types-compliance";
import { isValidPhone } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { ComplianceGate } from "./compliance-page";

export function ContractorsPage() {
  const t = useTranslations("compliance.contractors");
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const { data, isLoading, error, refetch } = useContractors({ q: q || undefined });
  const rows = listResults<Contractor>(data);
  const [editing, setEditing] = React.useState<Contractor | "new" | null>(null);

  return (
    <ComplianceGate>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={t("search")} />
      </Toolbar>
      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title={q ? t("no_results") : t("empty_title")}
          description={q ? undefined : t("empty_body")}
          action={
            q ? null : (
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            )
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("col_name")}</Th>
                <Th>{t("col_phone")}</Th>
                <Th>{t("col_trades")}</Th>
                <Th numeric>{t("col_workers")}</Th>
                <Th>{t("col_status")}</Th>
                <Th className="w-12">
                  <span className="sr-only">{t("edit")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => (
                <Tr key={c.id}>
                  <RowHeader>
                    <Link href={`/app/contractors/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    {c.pan_no ? (
                      <span className="text-fg-muted block text-xs font-normal">
                        PAN {c.pan_no}
                      </span>
                    ) : null}
                  </RowHeader>
                  <Td className="tabular">{f.phone(c.phone)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {c.trades.slice(0, 3).map((tr) => (
                        <Badge key={tr.code} tone="outline">
                          {f.name(tr)}
                        </Badge>
                      ))}
                      {c.trades.length > 3 ? (
                        <Badge tone="neutral">+{f.digits(c.trades.length - 3)}</Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td numeric>{f.number(c.active_workers)}</Td>
                  <Td>
                    <Badge tone={c.is_active ? "success" : "neutral"} dot>
                      {c.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(c)}
                      aria-label={t("edit")}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
      <ContractorDialog
        contractor={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </ComplianceGate>
  );
}

export function ContractorDialog({
  contractor,
  open,
  onOpenChange,
}: {
  contractor: Contractor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("compliance.contractors");
  const tAll = useTranslations();
  const f = useFormat();
  const { data: allTrades } = useTrades();
  const tradeName = (code: string) => {
    const tr = allTrades?.find((x) => x.code === code);
    return tr ? f.name(tr) : code;
  };
  const create = useCreateContractor();
  const update = useUpdateContractor();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pan, setPan] = React.useState("");
  const [trades, setTrades] = React.useState<string[]>([]);
  const [isActive, setIsActive] = React.useState(true);
  const [tradePick, setTradePick] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(contractor?.name ?? "");
    setPhone(contractor?.phone ?? "");
    setPan(contractor?.pan_no ?? "");
    setTrades(contractor?.trades.map((x) => x.code) ?? []);
    setIsActive(contractor?.is_active ?? true);
    setErrors({});
    setFormError(null);
  }, [open, contractor]);

  const save = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = tAll("errors.required");
    if (!isValidPhone(phone)) errs.phone = tAll("errors.invalid_phone");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = {
      name: name.trim(),
      phone,
      pan_no: pan.trim() || null,
      trades,
      is_active: isActive,
    };
    const opts = {
      onSuccess: () => {
        toast.success(contractor ? tAll("common.changes_saved") : t("created_toast"));
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        if (isApiError(e) && Object.keys(e.fields).length) {
          setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, v[0]])));
          setFormError(e.message);
        } else toastError(e, tAll);
      },
    };
    if (contractor) update.mutate({ id: contractor.id, ...body }, opts);
    else create.mutate(body, opts);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tAll("common.close")}>
        <DialogHeader
          title={contractor ? t("edit_title") : t("add_title")}
          description={t("dialog_body")}
        />
        <DialogBody className="space-y-4">
          <FormError message={formError} />
          <Field id="contractor-name" label={t("name")} error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="contractor-phone" label={tAll("term.phone")} error={errors.phone}>
              <PhoneInput value={phone} onChange={setPhone} />
            </Field>
            <Field
              id="contractor-pan"
              label={tAll("term.pan")}
              optional
              optionalLabel={tAll("common.optional")}
              error={errors.pan_no}
            >
              <Input
                value={pan}
                onChange={(e) => setPan(e.target.value)}
                maxLength={20}
                inputMode="numeric"
              />
            </Field>
          </div>
          <Field
            id="contractor-trades"
            label={t("trades")}
            hint={t("trades_hint")}
            error={errors.trades}
          >
            <TradeSelect
              value={tradePick}
              onChange={(code) => {
                if (code && !trades.includes(code)) setTrades([...trades, code]);
                setTradePick("");
              }}
              placeholder={t("add_trade")}
            />
          </Field>
          {trades.length ? (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {trades.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setTrades(trades.filter((x) => x !== code))}
                  className="border-border bg-surface text-fg-body hover:bg-surface-hover rounded-full border px-2.5 py-1 text-xs"
                  aria-label={t("remove_trade", { trade: code })}
                >
                  {tradeName(code)} ×
                </button>
              ))}
            </div>
          ) : null}
          {contractor ? (
            <label className="text-fg flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4"
              />
              {t("is_active")}
            </label>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tAll("common.cancel")}
          </Button>
          <Button onClick={save} loading={create.isPending || update.isPending}>
            {tAll("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
