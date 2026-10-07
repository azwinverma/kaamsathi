import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

export interface FieldProps {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}

/**
 * Label + control + hint + error. Wires id / aria-invalid / aria-describedby into the child.
 */
export function Field({
  id,
  label,
  error,
  hint,
  optional,
  optionalLabel = "optional",
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="ml-1 font-normal text-fg-muted">({optionalLabel})</span> : null}
      </Label>
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="flex items-start gap-1 text-xs font-medium text-danger">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error banner (non-field errors). */
export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2.5 text-sm text-danger",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function Fieldset({
  legend,
  description,
  children,
  className,
}: {
  legend: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0 space-y-4", className)}>
      <legend className="mb-1 text-sm font-semibold text-fg">{legend}</legend>
      {description ? <p className="-mt-3 text-sm text-fg-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}
