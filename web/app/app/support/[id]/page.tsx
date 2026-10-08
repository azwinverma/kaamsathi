"use client";
import { useParams } from "next/navigation";
import { OrgCasePage } from "@/components/support/org-support-page";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <OrgCasePage id={id} />;
}
