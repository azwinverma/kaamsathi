"use client";
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({
  value,
  label,
  ...props
}: { value: string; label?: string } & Omit<ButtonProps, "onClick" | "value">) {
  const t = useTranslations("common");
  const [copied, setCopied] = React.useState(false);
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
    <Button type="button" variant="secondary" size="sm" onClick={copy} {...props}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? t("copied") : (label ?? t("copy"))}</span>
    </Button>
  );
}

/** Save text as a file in the browser. */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
