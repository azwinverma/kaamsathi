"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { OtpInput } from "@/components/auth/otp-input";
import { LegalAccept } from "@/components/security/legal-accept";
import { needsLegalAcceptance } from "@/components/security/helpers";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { errorMessage } from "@/components/ui/feedback";
import { useLogout, useMe, useRequestOtp, useVerifyOtp } from "@/lib/api/hooks/auth";
import { isApiError } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import { isMfaChallenge } from "@/lib/api/types-security";
import { isValidPhone } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { useFormat } from "@/lib/use-format";

const RESEND_SECONDS = 30;

/**
 * Phone + OTP login inside a page (booking flow, Kaam request, Sipalu join) using the same BFF
 * routes as /login, so tokens stay in httpOnly cookies. Renders `children` once signed in.
 * Accounts that need MFA (staff) are sent to the full login page and brought back.
 */
export function InlineLogin({
  title,
  body,
  children,
  headingLevel = 2,
}: {
  title: string;
  body?: string;
  children: (me: Me) => React.ReactNode;
  headingLevel?: 2 | 3;
}) {
  const me = useMe();
  // useVerifyOtp clears the query cache, which detaches this observer from the "me" query, so the
  // freshly signed-in user is also kept here (and updated after legal acceptance).
  const [local, setLocal] = React.useState<Me | null>(null);
  const user = local ?? me.data ?? null;
  if (me.isLoading && !local) return <div className="bg-surface-muted h-40 animate-pulse rounded-card" aria-busy />;
  if (user && !needsLegalAcceptance(user)) return <>{children(user)}</>;
  return (
    <LoginSteps title={title} body={body} headingLevel={headingLevel} pendingUser={user} onSignedIn={setLocal} />
  );
}

function LoginSteps({
  title,
  body,
  headingLevel,
  pendingUser,
  onSignedIn,
}: {
  title: string;
  body?: string;
  headingLevel: 2 | 3;
  pendingUser: Me | null;
  onSignedIn: (me: Me) => void;
}) {
  const t = useTranslations("bolau.auth");
  const tAll = useTranslations();
  const f = useFormat();
  const pathname = usePathname();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const logout = useLogout();
  const [step, setStep] = React.useState<"phone" | "otp" | "mfa" | "legal">(pendingUser ? "legal" : "phone");
  const [user, setUser] = React.useState<Me | null>(pendingUser);
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const H = `h${headingLevel}` as "h2" | "h3";
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  React.useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isValidPhone(phone)) {
      setPhoneError(tAll("errors.invalid_phone"));
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
        else setError(errorMessage(err, tAll));
      },
    });
  };

  const verify = (value = code) => {
    const clean = value.replace(/\s/g, "");
    setError(null);
    if (clean.length !== 6) {
      setError(tAll("auth.enter_full_code"));
      return;
    }
    verifyOtp.mutate(
      { phone, code: clean },
      {
        onSuccess: (res: unknown) => {
          if (isMfaChallenge(res)) {
            setStep("mfa");
            return;
          }
          const u = (res as { user: Me }).user;
          track("login_success", { method: "otp", role: "user" });
          setUser(u);
          if (needsLegalAcceptance(u)) setStep("legal");
          onSignedIn(u);
        },
        onError: (err) => {
          setError(errorMessage(err, tAll));
          setCode("");
        },
      },
    );
  };

  if (step === "legal" && user) {
    return (
      <LegalAccept
        pending={user.pending_legal ?? []}
        onAccepted={(stillPending) => onSignedIn({ ...user, pending_legal: stillPending })}
        onLogout={() => logout.mutate(undefined, { onSettled: () => setStep("phone") })}
      />
    );
  }

  return (
    <section aria-labelledby="inline-login-title" className="border-border bg-surface max-w-xl rounded-card border p-5 sm:p-6">
      <H id="inline-login-title" ref={headingRef} tabIndex={-1} className="text-fg text-lg font-bold focus:outline-none">
        {step === "otp" ? t("code_title") : title}
      </H>
      {step === "mfa" ? (
        <div className="mt-2 space-y-3">
          <p className="text-fg-body text-sm">{t("mfa_needed")}</p>
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="text-brand-text font-semibold underline-offset-4 hover:underline"
          >
            {t("mfa_link")}
          </Link>
        </div>
      ) : step === "otp" ? (
        <form
          className="mt-2 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <p id="inline-otp-desc" className="text-fg-muted text-sm">
            {t("code_sent", { phone: f.phone(phone) })}
          </p>
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError(null);
            }}
            onComplete={(v) => verify(v)}
            invalid={!!error}
            disabled={verifyOtp.isPending}
            labelledBy="inline-login-title"
            describedBy="inline-otp-desc"
            boxLabel={(i) => tAll("auth.otp_digit", { n: i })}
          />
          {devCode ? (
            <p className="border-warning/40 bg-warning-subtle text-warning flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
              <span className="font-semibold">{t("dev_hint")}</span>
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
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={verifyOtp.isPending}>
              {t("verify")}
            </Button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="text-fg-muted hover:text-fg inline-flex min-h-11 items-center gap-1 text-sm"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("change")}
            </button>
            <span className="text-fg-muted ml-auto text-sm" aria-live="polite">
              {cooldown > 0 ? (
                tAll("auth.resend_in", { seconds: f.digits(cooldown) })
              ) : (
                <button type="button" className="text-brand-text font-medium hover:underline" onClick={() => send()}>
                  {tAll("auth.resend")}
                </button>
              )}
            </span>
          </div>
        </form>
      ) : (
        <form className="mt-2 space-y-4" onSubmit={send} noValidate>
          {body ? <p className="text-fg-body text-sm">{body}</p> : null}
          <Field id="inline-phone" label={t("phone")} error={phoneError ?? undefined}>
            <PhoneInput
              name="phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                if (phoneError) setPhoneError(null);
              }}
              required
              enterKeyHint="send"
            />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" loading={requestOtp.isPending}>
            {t("send")}
          </Button>
          <p className="text-fg-muted text-xs leading-relaxed">{tAll("auth.terms")}</p>
        </form>
      )}
    </section>
  );
}
