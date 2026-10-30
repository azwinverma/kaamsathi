import { notFound, redirect } from "next/navigation";
import { bolauLive } from "@/lib/bolau/live";

export const dynamic = "force-dynamic";

/** `/sipalu` (people trim a profile link back to it): the list of Sipalu lives on /bolau. */
export default async function SipaluIndex() {
  if (!(await bolauLive())) notFound();
  redirect("/bolau#results");
}
