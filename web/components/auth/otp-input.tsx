"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { toLatinDigits } from "@/lib/format";

/**
 * 6-box OTP input. First box carries autocomplete="one-time-code" so SMS autofill works;
 * pasting a full code (Latin or Devanagari digits) fills all boxes.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid,
  disabled,
  labelledBy,
  describedBy,
  boxLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  labelledBy?: string;
  describedBy?: string;
  boxLabel: (i: number) => string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  // `value` uses " " for empty boxes in the middle so later digits don't shift.
  const digits = Array.from({ length }, (_, i) => (value[i] && value[i] !== " " ? value[i] : ""));
  const join = (arr: string[]) => arr.map((c) => c || " ").join("").replace(/\s+$/, "");

  const setAt = (index: number, chars: string) => {
    const clean = toLatinDigits(chars).replace(/\D/g, "");
    if (!clean) return;
    const arr = digits.slice();
    let i = index;
    for (const c of clean) {
      if (i >= length) break;
      arr[i++] = c;
    }
    const next = join(arr).slice(0, length);
    onChange(next);
    refs.current[Math.min(i, length - 1)]?.focus();
    if (next.length === length && !next.includes(" ")) onComplete?.(next);
  };

  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? length : 1}
          value={d}
          disabled={disabled}
          aria-label={boxLabel(i + 1)}
          aria-invalid={invalid || undefined}
          enterKeyHint={i === length - 1 ? "done" : "next"}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              const arr = digits.slice();
              arr[i] = "";
              onChange(join(arr));
              return;
            }
            const raw = toLatinDigits(v).replace(/\D/g, "");
            // Autofill / multi-char input fills forward; a single keystroke replaces this box.
            setAt(i, raw.length > 2 ? raw : raw.slice(-1));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              const arr = digits.slice();
              arr[i - 1] = "";
              onChange(join(arr));
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) {
              e.preventDefault();
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < length - 1) {
              e.preventDefault();
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            setAt(0, e.clipboardData.getData("text"));
          }}
          className={cn(
            "size-12 rounded-lg border border-border-strong bg-surface text-center text-xl font-semibold text-fg shadow-sm tabular transition-colors focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring sm:size-14 sm:text-2xl",
            invalid && "border-danger",
            disabled && "opacity-60",
          )}
        />
      ))}
    </div>
  );
}
