"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, LockKeyhole, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/providers/session";
import { isApiError } from "@/lib/api/errors";
import { proxyHref } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import { useMfaConfirm, useMfaDisable, useMfaSetup } from "@/lib/api/hooks/security";
import type { MfaSetupResponse } from "@/lib/api/types-security";
import { toLatinDigits } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { CopyButton, downloadText } from "./copy-button";
import { formatSecret, recoveryCodesText } from "./helpers";
import { MfaRequiredNotice } from "./mfa-required-notice";
import { Notice } from "./notice";

const cleanCode = (v: string) => toLatinDigits(v).replace(/\D/g, "").slice(0, 6);

/** Two-step verification (TOTP): enrol with QR / manual key, recovery codes once, disable. */
export function MfaCard({ showPolicyNotice = true }: { showPolicyNotice?: boolean }) {
  const t = useTranslations("security.mfa");
  const { me } = useSession();
  const qc = useQueryClient();
  const setup = useMfaSetup();
  const [pending, setPending] = React.useState<(MfaSetupResponse & { ts: number }) | null>(null);
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const tc = useTranslations();
  const f = useFormat();
  const enabled = me.mfa_enabled === true;
  const required = me.mfa_required === true;

  const start = () =>
    setup.mutate(undefined, {
      onSuccess: (res) => setPending({ ...res, ts: Date.now() }),
      onError: (e) => {
        if (isApiError(e) && e.code === "invalid_state") {
          toast.info(t("already_enabled"));
          void qc.invalidateQueries({ queryKey: qk.me });
        } else {
          toastError(e, tc);
        }
      },
    });

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("description")}
        action={
          enabled ? (
            <Badge tone="success" dot>
              {t("status_on")}
            </Badge>
          ) : (
            <Badge tone={required ? "warning" : "neutral"} dot>
              {t("status_off")}
            </Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {codes ? (
          <RecoveryCodes
            codes={codes}
            account={[me.full_name, f.phone(me.phone)].filter(Boolean).join(" · ")}
            onDone={() => {
              setCodes(null);
              toast.success(t("enabled_toast"));
            }}
          />
        ) : pending ? (
          <Enrol
            pending={pending}
            onCancel={() => setPending(null)}
            onConfirmed={(c) => {
              setPending(null);
              setCodes(c);
            }}
          />
        ) : enabled ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-fg-body">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {t("enabled_body")}
            </p>
            <Button variant="danger-outline" onClick={() => setDisableOpen(true)}>
              <ShieldOff aria-hidden />
              {t("disable")}
            </Button>
          </div>
        ) : (
          <>
            {required && showPolicyNotice ? <MfaRequiredNotice showAction={false} /> : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-fg-body">{t("disabled_body")}</p>
              <Button onClick={start} loading={setup.isPending}>
                <LockKeyhole aria-hidden />
                {t("setup")}
              </Button>
            </div>
          </>
        )}
      </CardBody>
      <DisableDialog open={disableOpen} onOpenChange={setDisableOpen} required={required} />
    </Card>
  );
}

function Enrol({
  pending,
  onCancel,
  onConfirmed,
}: {
  pending: MfaSetupResponse & { ts: number };
  onCancel: () => void;
  onConfirmed: (codes: string[]) => void;
}) {
  const t = useTranslations("security.mfa");
  const tc = useTranslations();
  const confirm = useMfaConfirm();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [qrFailed, setQrFailed] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError(t("code_length"));
      return;
    }
    confirm.mutate(code, {
      onSuccess: (res) => onConfirmed(res.recovery_codes ?? []),
      onError: (err) => {
        setCode("");
        if (isApiError(err) && err.code === "mfa_invalid") setError(t("code_invalid"));
        else if (isApiError(err)) setError(err.message || tc(`errors.${err.code}`));
        else setError(tc("errors.server_error"));
      },
    });
  };

  return (
    <div className="space-y-5">
      <ol className="grid gap-5 md:grid-cols-[auto_1fr]">
        <li className="flex flex-col items-center gap-2">
          <p className="self-start text-sm font-medium text-fg">{t("step_scan")}</p>
          <div className="flex size-48 items-center justify-center rounded-lg border border-border bg-white p-2">
            {qrFailed ? (
              <p className="px-3 text-center text-xs text-neutral-600">{t("qr_failed")}</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- SVG streamed through the BFF proxy
              <img
                src={proxyHref("/auth/mfa/qr.svg", { ts: pending.ts })}
                alt={t("qr_alt")}
                width={176}
                height={176}
                className="size-44"
                onError={() => setQrFailed(true)}
              />
            )}
          </div>
        </li>
        <li className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-fg">{t("step_manual")}</p>
            <p className="text-xs text-fg-muted">{t("step_manual_hint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-sm tracking-wider break-all text-fg select-all">
                {formatSecret(pending.secret)}
              </code>
              <CopyButton value={pending.secret} />
            </div>
          </div>
          <form className="space-y-3" onSubmit={submit} noValidate>
            <Field id="mfa-confirm-code" label={t("step_code")} hint={t("step_code_hint")} error={error ?? undefined}>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(cleanCode(e.target.value));
                  if (error) setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="max-w-40 font-mono tracking-[0.3em]"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={confirm.isPending}>
                {t("confirm")}
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel} disabled={confirm.isPending}>
                {tc("common.cancel")}
              </Button>
            </div>
          </form>
        </li>
      </ol>
    </div>
  );
}

function RecoveryCodes({ codes, account, onDone }: { codes: string[]; account: string; onDone: () => void }) {
  const t = useTranslations("security.mfa");
  const [saved, setSaved] = React.useState(false);
  const text = recoveryCodesText(codes, {
    title: t("codes_file_title"),
    note: t("codes_file_note"),
    account,
  });
  return (
    <div className="space-y-4">
      <Notice tone="warning" role="alert" title={t("codes_title")}>
        {t("codes_body")}
      </Notice>
      <ul
        className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-muted p-3 font-mono text-sm sm:grid-cols-5"
        aria-label={t("codes_title")}
      >
        {codes.map((c) => (
          <li key={c} className="rounded bg-surface px-2 py-1.5 text-center tracking-wider text-fg select-all">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={codes.join("\n")} label={t("codes_copy")} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => downloadText("kaamsathi-recovery-codes.txt", text)}
        >
          <Download aria-hidden />
          {t("codes_download")}
        </Button>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-fg">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} className="mt-0.5" />
        <span>{t("codes_ack")}</span>
      </label>
      <Button onClick={onDone} disabled={!saved}>
        {t("codes_done")}
      </Button>
    </div>
  );
}

function DisableDialog({
  open,
  onOpenChange,
  required,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  required: boolean;
}) {
  const t = useTranslations("security.mfa");
  const tc = useTranslations();
  const disable = useMfaDisable();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError(t("code_length"));
      return;
    }
    disable.mutate(code, {
      onSuccess: () => {
        toast.success(t("disabled_toast"));
        onOpenChange(false);
      },
      onError: (err) => {
        setCode("");
        if (isApiError(err) && err.code === "mfa_invalid") setError(t("code_invalid"));
        else if (isApiError(err)) setError(err.message || tc(`errors.${err.code}`));
        else setError(tc("errors.server_error"));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !disable.isPending && onOpenChange(o)}>
      <DialogContent size="sm" closeLabel={tc("common.close")}>
        <form onSubmit={submit} noValidate>
          <DialogHeader title={t("disable_title")} description={t("disable_body")} />
          <DialogBody className="space-y-4">
            {required ? <Notice tone="warning">{t("disable_required_warning")}</Notice> : null}
            <Field id="mfa-disable-code" label={t("step_code")}>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(cleanCode(e.target.value));
                  if (error) setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="font-mono tracking-[0.3em]"
                autoFocus
              />
            </Field>
            <FormError message={error} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={disable.isPending}>
              {tc("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={disable.isPending}>
              {t("disable")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
