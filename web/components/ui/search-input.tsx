"use client";
import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

/** Debounced search input. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  delay = 300,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
  label?: string;
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  React.useEffect(() => {
    if (local === value) return;
    const id = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(id);
  }, [local, value, onChange, delay]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        enterKeyHint="search"
        className={cn(inputClass, "pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden")}
      />
      {local ? (
        <button
          type="button"
          onClick={() => {
            setLocal("");
            onChange("");
          }}
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-fg-muted hover:bg-surface-hover"
          aria-label="Clear"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
