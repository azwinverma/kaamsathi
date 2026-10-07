"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print / "Save as PDF" (the page has print styles). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden />
      <span className="max-sm:sr-only">{label}</span>
    </Button>
  );
}
