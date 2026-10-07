"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BsDatePicker, Money } from "@/components/ui/date";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { PrefixInput, Textarea } from "@/components/ui/input";
import { useCreateAdvance, useUpdateAdvance } from "@/lib/api/hooks/workforce";
import { isApiError } from "@/lib/api/errors";
import type { Advance } from "@/lib/api/types";
import { todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { EmploymentPicker } from "./employment-picker";
import { moneyInput } from "./wage-fields";
import { moneyOrNull, parseAmount } from "./utils";

/** Outstanding balance of an advance (≥ 0). */
export function outstandingOf(a: Pick<Advance, "amount" | "recovered_amount">): number {
  return Math.max(0, (parseAmount(a.amount) ?? 0) - (parseAmount(a.recovered_amount) ?? 0));
}

function monthsToClear(outstanding: number, perMonth: number | null): number | null {
  if (!perMonth || perMonth <= 0) return null;
  return Math.ceil(outstanding / perMonth);
}

type Errors = Partial<Record<"employment" | "amount" | "given_on" | "recover_per_month" | "note", string>>;

function fieldErrors(err: unknown): Errors {
  if (!isApiError(err)) return {};
  return {
    employment: err.fieldError("employment") ?? err.fieldError("employment_id"),
    amount: err.fieldError("amount"),
    given_on: err.fieldError("given_on"),
    recover_per_month: err.fieldError("recover_per_month"),
    note: err.fieldError("note"),
  };
}

export function CreateAdvanceDialog({
  open,
  onOpenChange,
  employmentId,
  workerName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Pre-selected employment (from the worker detail page). */
  employmentId?: string;
  workerName?: string;
}) {
  const t = useTranslations();
  const ta = useTranslations("workforce.advances");
  const f = useFormat();
  const create = useCreateAdvance();
  const [employment, setEmployment] = React.useState(employmentId ?? "");
  const [amount, setAmount] = React.useState("");
  const [givenOn, setGivenOn] = React.useState(todayIso());
  const [perMonth, setPerMonth] = React.useState("");
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setEmployment(employmentId ?? "");
      setAmount("");
      setGivenOn(todayIso());
      setPerMonth("");
      setNote("");
      setErrors({});
      setFormError(null);
    }
  }, [open, employmentId]);

  const amt = parseAmount(amount);
  const pm = parseAmount(perMonth);
  const months = amt !== null ? monthsToClear(amt, pm) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!employment) next.employment = t("errors.required");
    if (amt === null || amt <= 0) next.amount = amount ? t("errors.invalid_number") : t("errors.required");
    if (!givenOn) next.given_on = t("errors.required");
    if (pm === null || pm <= 0) next.recover_per_month = perMonth ? t("errors.invalid_number") : t("errors.required");
    else if (amt !== null && pm > amt) next.recover_per_month = ta("per_month_too_high");
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setFormError(null);
    create.mutate(
      {
        employment,
        amount: moneyOrNull(amount)!,
        given_on: givenOn,
        recover_per_month: moneyOrNull(perMonth)!,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(ta("created"));
          onOpenChange(false);
        },
        onError: (err) => {
          setErrors(fieldErrors(err));
          setFormError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader
            title={ta("create_title")}
            description={workerName ? ta("create_for", { name: workerName }) : ta("create_description")}
          />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            {employmentId ? null : (
              <Field id="adv-employment" label={ta("worker")} error={errors.employment}>
                <EmploymentPicker value={employment} onChange={(id) => setEmployment(id)} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="adv-amount" label={t("common.amount")} error={errors.amount}>
                <PrefixInput
                  prefix={t("term.npr")}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field id="adv-given" label={ta("given_on")} error={errors.given_on}>
                <BsDatePicker value={givenOn} onChange={setGivenOn} max={todayIso()} />
              </Field>
            </div>
            <Field
              id="adv-per-month"
              label={ta("recover_per_month")}
              error={errors.recover_per_month}
              hint={
                months !== null ? ta("months_to_clear", { count: months, n: f.digits(months) }) : ta("recover_hint")
              }
            >
              <PrefixInput
                prefix={t("term.npr")}
                suffix={t("common.per_month")}
                inputMode="decimal"
                value={perMonth}
                onChange={(e) => setPerMonth(e.target.value)}
              />
            </Field>
            <Field id="adv-note" label={t("common.note")} optional optionalLabel={t("common.optional")} error={errors.note}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {ta("create_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditAdvanceDialog({
  advance,
  workerName,
  onOpenChange,
}: {
  advance: Advance | null;
  workerName: string;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const ta = useTranslations("workforce.advances");
  const f = useFormat();
  const update = useUpdateAdvance();
  const [perMonth, setPerMonth] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (advance) {
      setPerMonth(moneyInput(advance.recover_per_month));
      setNote(advance.note ?? "");
      setError(undefined);
      setFormError(null);
    }
  }, [advance]);

  if (!advance) return null;
  const outstanding = outstandingOf(advance);
  const pm = parseAmount(perMonth);
  const months = monthsToClear(outstanding, pm);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pm === null || pm <= 0) {
      setError(perMonth ? t("errors.invalid_number") : t("errors.required"));
      return;
    }
    if (pm > (parseAmount(advance.amount) ?? 0)) {
      setError(ta("per_month_too_high"));
      return;
    }
    setError(undefined);
    setFormError(null);
    update.mutate(
      { id: advance.id, recover_per_month: moneyOrNull(perMonth)!, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t("common.changes_saved"));
          onOpenChange(false);
        },
        onError: (err) => {
          setError(fieldErrors(err).recover_per_month);
          setFormError(isApiError(err) ? err.message || t(`errors.${err.code}`) : t("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={!!advance} onOpenChange={onOpenChange}>
      <DialogContent size="md" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader title={ta("edit_title")} description={workerName} />
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <dl className="grid grid-cols-3 gap-3 rounded-md border border-border bg-surface-muted p-3 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">{t("common.amount")}</dt>
                <dd className="font-medium">
                  <Money value={advance.amount} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">{ta("recovered")}</dt>
                <dd className="font-medium text-success">
                  <Money value={advance.recovered_amount} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">{ta("outstanding")}</dt>
                <dd className="font-medium">
                  <Money value={outstanding} />
                </dd>
              </div>
            </dl>
            <Field
              id="adv-edit-pm"
              label={ta("recover_per_month")}
              error={error}
              hint={months !== null ? ta("months_to_clear", { count: months, n: f.digits(months) }) : undefined}
            >
              <PrefixInput
                prefix={t("term.npr")}
                suffix={t("common.per_month")}
                inputMode="decimal"
                value={perMonth}
                onChange={(e) => setPerMonth(e.target.value)}
              />
            </Field>
            <Field id="adv-edit-note" label={t("common.note")} optional optionalLabel={t("common.optional")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
            <p className="text-xs text-fg-muted">{ta("edit_hint")}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={update.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {t("common.save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
