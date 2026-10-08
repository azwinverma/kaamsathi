"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, FileText, LogOut, RotateCcw } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/ui/field";
import { useOptionalSession } from "@/components/providers/session";
import { isApiError } from "@/lib/api/errors";
import { useLogout } from "@/lib/api/hooks/auth";
import { useAcceptLegal, useCurrentLegal } from "@/lib/api/hooks/security";
import type { LegalDocument, PendingLegal } from "@/lib/api/types-security";
import { useFormat } from "@/lib/use-format";
import { needsLegalAcceptance } from "./helpers";

/**
 * Lists the current legal documents the user hasn't accepted, one checkbox each, and an
 * Accept button. `variant="inline"` sits inside the login card; `"screen"` replaces the shell.
 */
export function LegalAccept({
  pending,
  onAccepted,
  onLogout,
  variant = "inline",
}: {
  pending: PendingLegal[];
  /** Called with the still-pending list after a successful accept. */
  onAccepted?: (stillPending: PendingLegal[]) => void;
  onLogout?: () => void;
  variant?: "inline" | "screen";
}) {
  const t = useTranslations("security.legal");
  const tc = useTranslations();
  const locale = useLocale();
  const f = useFormat();
  const current = useCurrentLegal();
  const accept = useAcceptLegal();
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<{ message: string; reload: boolean } | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const byId = React.useMemo(() => {
    const m = new Map<string, LegalDocument>();
    for (const d of current.data ?? []) m.set(d.id, d);
    return m;
  }, [current.data]);

  const allChecked = pending.length > 0 && pending.every((d) => checked.has(d.id));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!allChecked) {
      setError({ message: t("check_all"), reload: false });
      return;
    }
    accept.mutate(
      pending.map((d) => d.id),
      {
        onSuccess: (res) => onAccepted?.(res.pending_legal ?? []),
        onError: (err) => {
          if (isApiError(err) && err.status === 400) {
            setError({ message: t("outdated"), reload: true });
          } else if (isApiError(err)) {
            setError({ message: err.message || tc(`errors.${err.code}`), reload: false });
          } else {
            setError({ message: tc("errors.server_error"), reload: false });
          }
        },
      },
    );
  };

  const body = (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand-text">
          <FileText className="size-5" aria-hidden />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
          {t("title")}
        </h1>
        <p className="text-sm text-fg-muted">{t("body")}</p>
      </div>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <ul className="space-y-3">
          {pending.map((d) => {
            const doc = byId.get(d.id);
            const summary = doc ? (locale === "ne" ? doc.summary_ne || doc.summary_en : doc.summary_en) : null;
            const id = `legal-${d.id}`;
            const kind = t.has(`kind.${d.kind}`) ? t(`kind.${d.kind}`) : d.kind;
            return (
              <li key={d.id} className="rounded-dense border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="text-base font-semibold text-fg">{kind}</h2>
                  <span className="text-xs text-fg-muted tabular">
                    {t("version", { version: f.digits(String(d.version)) })}
                  </span>
                </div>
                {summary ? (
                  <p className="mt-1.5 text-sm whitespace-pre-line text-fg-body">{summary}</p>
                ) : null}
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline"
                >
                  {t("read", { kind })}
                  <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">{t("new_tab")}</span>
                </a>
                <label htmlFor={id} className="mt-3 flex items-start gap-2.5 text-sm text-fg">
                  <Checkbox
                    id={id}
                    checked={checked.has(d.id)}
                    disabled={accept.isPending}
                    onCheckedChange={(v) => {
                      setChecked((s) => {
                        const n = new Set(s);
                        if (v === true) n.add(d.id);
                        else n.delete(d.id);
                        return n;
                      });
                      if (error && !error.reload) setError(null);
                    }}
                    className="mt-0.5"
                  />
                  <span>{t("accept_one", { kind })}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {error ? (
          <div className="space-y-2">
            <FormError message={error.message} />
            {error.reload ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => window.location.reload()}>
                <RotateCcw aria-hidden />
                {t("reload")}
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={accept.isPending} disabled={!allChecked}>
          {t("accept")}
        </Button>
      </form>
      {onLogout ? (
        <p className="text-center text-sm">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 font-medium text-fg-muted hover:text-fg hover:underline"
          >
            <LogOut className="size-3.5" aria-hidden />
            {t("logout")}
          </button>
        </p>
      ) : null}
    </div>
  );

  if (variant === "inline") return body;
  return (
    <main className="flex min-h-dvh flex-col items-center bg-bg px-4 py-10 sm:justify-center">
      <div className="w-full max-w-lg space-y-6">
        <Logo name={tc("app.name")} />
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">{body}</div>
      </div>
    </main>
  );
}

/**
 * Shell guard for /app and /ops: while current terms are unaccepted, show the acceptance
 * screen instead of the app. Never covers /terms, /privacy or /login.
 */
export function LegalGate({ children }: { children: React.ReactNode }) {
  const session = useOptionalSession();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const me = session?.me;
  if (!me || !needsLegalAcceptance(me, pathname)) return <>{children}</>;
  return (
    <LegalAccept
      variant="screen"
      pending={me.pending_legal ?? []}
      onLogout={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
    />
  );
}
