"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { inputClass } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useEmployment, useEmployments } from "@/lib/api/hooks/workforce";
import type { Employment } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  value: string;
  onChange: (id: string, employment: Employment | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Which employments to list (default: active). */
  status?: "active" | "ended" | "all";
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

/**
 * Searchable combobox of employments (active by default) (WAI-ARIA combobox pattern: the text input
 * owns focus, options are referenced via aria-activedescendant).
 */
export const EmploymentPicker = React.forwardRef<HTMLInputElement, Props>(function EmploymentPicker(
  { id, value, onChange, placeholder, disabled, className, status = "active", ...aria },
  ref,
) {
  const t = useTranslations("workforce.picker");
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [selected, setSelected] = React.useState<Employment | null>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(h);
  }, [query]);

  const { data, isFetching } = useEmployments(
    { q: debounced || undefined, status: status === "all" ? undefined : status, page_size: 20 },
    open,
  );
  const options = React.useMemo(() => data?.results ?? [], [data]);

  // Resolve a preselected value's label.
  const needsLookup = !!value && selected?.id !== value;
  const { data: lookedUp } = useEmployment(needsLookup ? value : undefined);
  const current = selected?.id === value ? selected : lookedUp?.id === value ? lookedUp : null;

  React.useEffect(() => setActive(0), [debounced]);

  const choose = (emp: Employment) => {
    setSelected(emp);
    onChange(emp.id, emp);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && options[active]) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setQuery("");
      }
    }
  };

  const display = open ? query : current ? current.worker.full_name : "";
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn("relative", className)}>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            ref={ref}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? optionId(active) : undefined}
            autoComplete="off"
            disabled={disabled}
            value={display}
            placeholder={current ? current.worker.full_name : (placeholder ?? t("placeholder"))}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onBlur={() => {
              setOpen(false);
              setQuery("");
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(inputClass, "pr-9 pl-9")}
            {...aria}
          />
          {isFetching && open ? (
            <Loader2
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-fg-subtle"
              aria-hidden
            />
          ) : (
            <ChevronsUpDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-72 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as Node | null;
          if (target && anchorRef.current?.contains(target)) e.preventDefault();
        }}
      >
        <ul id={listId} role="listbox" aria-label={t("label")} className="max-h-72 overflow-y-auto">
          {options.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-fg-muted" role="presentation">
              {isFetching ? t("searching") : t("no_results")}
            </li>
          ) : (
            options.map((emp, i) => {
              const isSel = emp.id === value;
              return (
                <li
                  key={emp.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSel}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(emp)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 text-sm",
                    i === active && "bg-surface-hover",
                  )}
                >
                  <Avatar name={emp.worker.full_name} src={emp.worker.photo} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{emp.worker.full_name}</span>
                    <span className="block truncate text-xs text-fg-muted">
                      {[emp.designation, emp.site?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {isSel ? <Check className="size-4 text-brand-text" aria-hidden /> : null}
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
