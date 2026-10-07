"use client";
import { useParams } from "next/navigation";
import { OpsCrewDetail } from "@/components/crews/ops-crew-detail";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <OpsCrewDetail id={id} />;
}
