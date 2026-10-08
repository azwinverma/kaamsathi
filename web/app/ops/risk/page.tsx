"use client";
import { Suspense } from "react";
import { RiskPage } from "@/components/risk/risk-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RiskPage />
    </Suspense>
  );
}
