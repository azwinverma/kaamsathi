"use client";
import { Suspense } from "react";
import { EmployersQueue } from "@/components/kyb/employers-queue";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EmployersQueue />
    </Suspense>
  );
}
