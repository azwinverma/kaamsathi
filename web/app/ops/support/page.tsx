"use client";
import { Suspense } from "react";
import { OpsSupportPage } from "@/components/support/ops-support-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OpsSupportPage />
    </Suspense>
  );
}
