"use client";
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Value representing "no selection" — Radix forbids "" so we map it. */
  allowEmpty?: boolean;
  emptyLabel?: string;
}

const EMPTY = "__empty__";

/** Radix Select styled per DESIGN.md. For very long lists prefer <NativeSelect>. */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      id,
      value,
      defaultValue,
      onValueChange,
      options,
      placeholder,
      disabled,
      className,
      name,
      allowEmpty,
      emptyLabel,
      ...aria
    },
    ref,
  ) => {
    const mapped = value === "" && allowEmpty ? EMPTY : value === "" ? undefined : value;
    return (
      <SelectPrimitive.Root
        value={mapped}
        defaultValue={defaultValue}
        onValueChange={(v) => onValueChange?.(v === EMPTY ? "" : v)}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          className={cn(
            inputClass,
            "flex items-center justify-between gap-2 text-left data-[placeholder]:text-fg-subtle",
            className,
          )}
          {...aria}
        >
          <span className="truncate">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon>
            <ChevronDown className="size-4 text-fg-muted" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="animate-pop-in z-50 max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-dense border border-border bg-surface shadow-floating"
          >
            <SelectPrimitive.Viewport className="p-1">
              {allowEmpty ? (
                <SelectItem value={EMPTY}>{emptyLabel ?? placeholder ?? "—"}</SelectItem>
              ) : null}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);
Select.displayName = "Select";

function SelectItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-9 cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2.5 text-sm text-fg outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
        <Check className="size-4 text-brand-text" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

/** Native <select> — best for long lists (77 districts) & mobile. */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string; options?: SelectOption[] }
>(({ className, placeholder, options, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(inputClass, "appearance-none pr-9", className)}
      {...props}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {typeof o.label === "string" ? o.label : o.value}
        </option>
      ))}
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
      aria-hidden
    />
  </div>
));
NativeSelect.displayName = "NativeSelect";
