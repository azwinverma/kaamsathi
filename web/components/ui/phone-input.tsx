"use client";
import * as React from "react";
import { PrefixInput } from "./input";

/** +977 mobile input. Stores raw 10 digits; accepts pasted +977 / spaces / Devanagari digits. */
export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    onChange: (digits: string) => void;
  }
>(({ value, onChange, ...props }, ref) => (
  <PrefixInput
    ref={ref}
    prefix="+977"
    type="tel"
    inputMode="numeric"
    autoComplete="tel-national"
    maxLength={14}
    placeholder="98XXXXXXXX"
    value={value}
    onChange={(e) => {
      const latin = e.target.value.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
      let digits = latin.replace(/\D/g, "");
      if (digits.length > 10 && digits.startsWith("977")) digits = digits.slice(3);
      onChange(digits.slice(0, 10));
    }}
    {...props}
  />
));
PhoneInput.displayName = "PhoneInput";
