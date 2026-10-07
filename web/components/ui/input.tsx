import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg shadow-sm transition-colors placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-visible:outline-danger max-sm:min-h-11 max-sm:text-base";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Input with a fixed prefix (e.g. "Rs." or "+977"). */
export const PrefixInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { prefix: React.ReactNode; suffix?: React.ReactNode }
>(({ className, prefix, suffix, ...props }, ref) => (
  <div
    className={cn(
      "flex h-10 w-full items-center overflow-hidden rounded-md border border-border-strong bg-surface shadow-sm transition-colors focus-within:border-primary-500 focus-within:outline-2 focus-within:outline-ring hover:border-fg-subtle has-[[aria-invalid=true]]:border-danger max-sm:min-h-11",
      className,
    )}
  >
    <span className="flex h-full items-center border-r border-border bg-surface-muted px-3 text-sm text-fg-muted tabular select-none">
      {prefix}
    </span>
    <input
      ref={ref}
      className="h-full w-full min-w-0 bg-transparent px-3 text-sm text-fg outline-none placeholder:text-fg-subtle max-sm:text-base tabular"
      {...props}
    />
    {suffix ? <span className="pr-3 text-sm text-fg-muted">{suffix}</span> : null}
  </div>
));
PrefixInput.displayName = "PrefixInput";
