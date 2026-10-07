"use client";
import * as React from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** A secret shown exactly once, with a copy button and a "store it now" warning. */
export function SecretReveal({ label, value, warning }: { label: string; value: string; warning: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = React.useState(false);
  const id = React.useId();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the value is selectable */
    }
  }
  return (
    <div className="space-y-3">
      <p role="note" className="flex items-start gap-2 rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {warning}
      </p>
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            readOnly
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-muted px-3 font-mono text-xs text-fg"
          />
          <Button type="button" variant="secondary" onClick={copy} aria-live="polite">
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
      </div>
    </div>
  );
}
