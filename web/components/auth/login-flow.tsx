"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Briefcase, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { useRequestOtp, useVerifyOtp } from "@/lib/api/hooks/auth";
import { isApiError } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import { isValidPhone } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { OtpInput } from "./otp-input";

const RESEND_SECONDS = 30;

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return null;
  return next;
}

export function routeAfterLogin(user: Me, next: string | null): string | "choose" {
  const hasOrg = (user.memberships?.length ?? 0) > 0;
  const target = safeNext(next);
  if (target) {
    if (target.startsWith("/ops") && user.is_staff) return target;
    if (target.startsWith("/app") && hasOrg) return target;
    if (!target.startsWith("/ops") && !target.startsWith("/app")) return target;
  }
  if (user.is_staff && hasOrg) return "choose";
  if (user.is_staff) return "/ops";
  if (!hasOrg) return "/onboarding";
  return "/app";
}

export function LoginFlow() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const params = useSearchParams();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = React.useState<"phone" | "otp" | "choose">("phone");
  const [phone, setPhone] = React.useState("");
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const [user, setUser] = React.useState<Me | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const apiMessage = (e: unknown) => {
    if (isApiError(e)) {
      const key = `errors.${e.code}`;
      return e.message && e.code !== "network_error" ? e.message : t.has(key) ? t(key) : t("errors.server_error");
    }
    return t("errors.server_error");
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isValidPhone(phone)) {
      setPhoneError(t("errors.invalid_phone"));
      return;
    }
    setPhoneError(null);
    requestOtp.mutate(phone, {
      onSuccess: (res) => {
        setDevCode(res.dev_code ?? null);
        setCode("");
        setStep("otp");
        setCooldown(RESEND_SECONDS);
      },
      onError: (err) => {
        if (isApiError(err) && err.fields.phone?.[0]) setPhoneError(err.fields.phone[0]);
        else setError(apiMessage(err));
      },
    });
  };

  const verify = (value = code) => {
    const clean = value.replace(/\s/g, "");
    setError(null);
    if (clean.length !== 6) {
      setError(t("auth.enter_full_code"));
      return;
    }
    verifyOtp.mutate(
      { phone, code: clean },
      {
        onSuccess: ({ user: me }) => {
          const dest = routeAfterLogin(me, params.get("next"));
          if (dest === "choose") {
            setUser(me);
            setStep("choose");
          } else {
            router.replace(dest);
          }
        },
        onError: (err) => {
          setError(apiMessage(err));
          setCode("");
        },
      },
    );
  };

  if (step === "choose" && user) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
            {t("auth.choose_title", { name: user.full_name || f.phone(user.phone) })}
          </h1>
          <p className="text-sm text-fg-muted">{t("auth.choose_body")}</p>
        </div>
        <div className="grid gap-3">
          <ChoiceCard
            icon={Briefcase}
            title={t("nav.employer_portal")}
            body={t("auth.choose_app")}
            onClick={() => router.replace("/app")}
          />
          <ChoiceCard
            icon={ShieldCheck}
            title={t("nav.ops")}
            body={t("auth.choose_ops")}
            onClick={() => router.replace("/ops")}
          />
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setError(null);
          }}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("auth.change_number")}
        </button>
        <div className="space-y-1.5">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <KeyRound className="size-5" aria-hidden />
          </div>
          <h1 ref={headingRef} tabIndex={-1} id="otp-heading" className="text-2xl font-semibold focus:outline-none">
            {t("auth.otp_title")}
          </h1>
          <p className="text-sm text-fg-muted" id="otp-desc">
            {t.rich("auth.otp_sent_to", {
              phone: () => <strong className="font-semibold text-fg tabular">{f.phone(phone)}</strong>,
            })}
          </p>
        </div>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError(null);
            }}
            onComplete={(v) => verify(v)}
            invalid={!!error}
            disabled={verifyOtp.isPending}
            labelledBy="otp-heading"
            describedBy="otp-desc"
            boxLabel={(i) => t("auth.otp_digit", { n: i })}
          />
          {devCode ? (
            <p className="flex items-center gap-2 rounded-md border border-dashed border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning">
              <span className="font-semibold">{t("auth.dev_hint")}</span>
              <button
                type="button"
                className="font-mono font-semibold tracking-widest underline underline-offset-2"
                onClick={() => {
                  setCode(devCode);
                  verify(devCode);
                }}
              >
                {devCode}
              </button>
            </p>
          ) : null}
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" loading={verifyOtp.isPending}>
            {t("auth.verify")}
          </Button>
        </form>
        <p className="text-center text-sm text-fg-muted" aria-live="polite">
          {cooldown > 0 ? (
            t("auth.resend_in", { seconds: f.digits(cooldown) })
          ) : (
            <button
              type="button"
              className="font-medium text-brand hover:underline disabled:opacity-50"
              onClick={() => sendCode()}
              disabled={requestOtp.isPending}
            >
              {t("auth.resend")}
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand">
          <Smartphone className="size-5" aria-hidden />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
          {t("auth.title")}
        </h1>
        <p className="text-sm text-fg-muted">{t("auth.subtitle")}</p>
      </div>
      <form className="space-y-5" onSubmit={sendCode} noValidate>
        <Field id="phone" label={t("auth.phone_label")} error={phoneError ?? undefined} hint={t("auth.phone_hint")}>
          <PhoneInput
            name="phone"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              if (phoneError) setPhoneError(null);
            }}
            required
            autoFocus
            enterKeyHint="send"
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={requestOtp.isPending}>
          {t("auth.send_code")}
        </Button>
      </form>
      <p className="text-xs leading-relaxed text-fg-muted">{t("auth.terms")}</p>
    </div>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:border-brand/50 hover:bg-brand-subtle/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block font-semibold text-fg">{title}</span>
        <span className="block text-sm text-fg-muted">{body}</span>
      </span>
    </button>
  );
}
